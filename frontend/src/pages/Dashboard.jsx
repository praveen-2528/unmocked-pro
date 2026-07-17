import { useState, useEffect } from 'react';
import { BookOpen, Clock, Settings, Users, ArrowRight, Play, ArrowLeft, FileText, CheckCircle2, ChevronRight, Copy, AlertCircle, Edit2, Check, Pause, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket';
import Navbar from '../components/Navbar';
import GlobalRoomReviews from '../components/GlobalRoomReviews';
import useAuthStore from '../store/useAuthStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const [blueprints, setBlueprints] = useState([]);
  const [pastTests, setPastTests] = useState([]);
  const [savedTests, setSavedTests] = useState([]);
  const [studyRooms, setStudyRooms] = useState([]);
  
  // Wizard State
  const [searchParams, setSearchParams] = useSearchParams();
  const step = parseInt(searchParams.get('step') || '0', 10); // 0 = Home, 1 = Blueprint, 2 = Mode, 3 = Generate & Input, 4 = Ready
  
  const setStep = (newStep) => {
    setSearchParams({ step: newStep.toString() });
  };
  const [selectedBp, setSelectedBp] = useState(null);
  const [testMode, setTestMode] = useState(''); // 'Full', 'Sectional', 'Topic'
  const [targetSubject, setTargetSubject] = useState(''); 
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customQuestionCount, setCustomQuestionCount] = useState(20);
  const [customDuration, setCustomDuration] = useState(15);
  const [sectionData, setSectionData] = useState({}); // { "Quant": "...", "English": "..." }
  const [parsedTest, setParsedTest] = useState(null);
  const [error, setError] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  
  // Multiplayer State
  const [playMode, setPlayMode] = useState('Solo'); // 'Solo', 'Multiplayer'
  const [friendlyMode, setFriendlyMode] = useState('Real'); // 'Real', 'Friendly'
  const [joinCode, setJoinCode] = useState('');
  const [lobbyData, setLobbyData] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  
  // Study Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  
  // Public Tunnel State removed
  const currentUser = JSON.parse(localStorage.getItem('unmocked_user') || '{}');

  useEffect(() => {
    if (!currentUser.email) {
      navigate('/');
    } else {
      fetchBlueprints();
      if (currentUser.id) {
        fetch(`/api/test-results/${currentUser.id}`)
          .then(res => res.json())
          .then(data => setPastTests(data))
          .catch(err => console.error(err));
          
        fetch(`/api/study-groups/user/${currentUser.id}`)
          .then(res => res.json())
          .then(data => setStudyRooms(data))
          .catch(err => console.error(err));

        fetch(`/api/test-session/saved/${currentUser.id}`)
          .then(res => res.json())
          .then(data => setSavedTests(Array.isArray(data) ? data : []))
          .catch(err => console.error(err));
          
        if (step === 0) {
          fetch('/api/active-rooms')
            .then(res => res.json())
            .then(data => setActiveRooms(data))
            .catch(err => console.error(err));
        }
      }
    }

    socket.on('roomUpdated', (room) => {
      setLobbyData(room);
      setStep(5);
    });
    socket.on('roomError', (err) => {
      setError(err);
    });
    socket.on('gameStarted', (room) => {
      localStorage.setItem('active_test_data', JSON.stringify(room.testData));
      localStorage.setItem('multiplayer_room', JSON.stringify(room));
      const sessionId = 'multi-' + room.code;
      localStorage.setItem('current_test_session_id', sessionId);
      navigate('/test/' + sessionId + '?view=instructions');
    });
    
    socket.on('roomClosed', () => {
      alert('The host has closed the room.');
      setLobbyData(null);
      setStep(0);
    });
    
    return () => {
      socket.off('roomUpdated');
      socket.off('roomError');
      socket.off('gameStarted');
      socket.off('roomClosed');
    }
  }, []);

  // Safety check: if user refreshes on a later step without an active blueprint, bump them to step 1
  useEffect(() => {
    // Exclude step 5 (Lobby) from this check, as joining a room doesn't require a selectedBp
    if (step > 1 && step < 5 && !selectedBp) {
      setSearchParams({ step: '1' });
    }
  }, [step, selectedBp, setSearchParams]);

  useEffect(() => {
    if (step === 3 && testMode === 'Full' && selectedBp && selectedBp.sections.length > 0) {
      setExpandedSection(selectedBp.sections[0].name);
    } else {
      setExpandedSection(null);
    }
  }, [step, testMode, selectedBp]);

  const fetchBlueprints = async () => {
    try {
      const res = await fetch('/api/blueprints');
      if (res.ok) setBlueprints(await res.json());
    } catch (err) { console.error(err); }
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getExpectedCount = () => {
    if (!selectedBp) return 0;
    if (testMode === 'Sectional' && targetSubject) {
      const sec = selectedBp.sections.find(s => s.name === targetSubject);
      if (sec) return sec.questions;
    }
    if (testMode === 'Topic') {
      return customQuestionCount;
    }
    return selectedBp.sections.reduce((acc, sec) => acc + sec.questions, 0);
  };

  const generatePrompt = (subjectName, qCount) => {
    const examName = selectedBp?.exam_name || 'Exam';
    const optionsCount = selectedBp?.options_count || 4;

    let prompt = `Act as an expert exam creator for the ${examName} exam. `;
    
    if (testMode === 'Topic' && selectedTopics.length > 0) {
      prompt += `I need you to generate exactly ${qCount} multiple-choice questions for the section "${subjectName}". The questions MUST specifically cover the following topics: ${selectedTopics.join(', ')}. `;
    } else {
      prompt += `I need you to generate exactly ${qCount} multiple-choice questions for the subject/topic: "${subjectName}". `;
    }
    prompt += `Ensure the questions closely mirror the most recent pattern and difficulty level of this specific exam.\n\n`;
    
    prompt += `RULES:\n`;
    prompt += `1. The difficulty level should be Medium to Hard.\n`;
    prompt += `2. Each question must have exactly ${optionsCount} options.\n`;
    prompt += `3. Only ONE option can be correct.\n`;
    prompt += `4. You MUST output the final result STRICTLY as a raw Pipe-Separated Values format (|).\n`;
    prompt += `5. Do NOT include any conversational text before or after the output.\n`;
    prompt += `6. CRITICAL: Do NOT wrap any text in double quotes unless it is actually part of the question. The pipe character (|) is the ONLY delimiter.\n`;
    prompt += `7. MATH/EQUATIONS: If the question contains mathematics, use inline LaTeX wrapped in \\( \\). Do NOT use $ display math. For reasoning inequalities (e.g., A > B < C), use inline math \\( A > B \\).\n`;
    prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\n`;
    prompt += `9. PASSAGES (IMPORTANT): For questions based on a reading passage, data interpretation, puzzle, or coding-decoding sets, use this format:\n`;
    prompt += `   - First, output the passage on its own row (Row_Type = P): P|[Passage_ID]|[Full Passage Text]###\n`;
    prompt += `   - Then, for each question related to that passage (Row_Type = PQ): PQ|[Passage_ID]|[Question_Text]|[Options...]|[Correct_Option]|[Explanation]###\n`;
    prompt += `   - For normal standalone questions with no passage (Row_Type = Q): Q||[Question_Text]|[Options...]|[Correct_Option]|[Explanation]###\n`;
    prompt += `10. LINE BREAKS (CRITICAL): For Syllogisms, Inequalities, and Data Sufficiency, you MUST include standard newlines (\\n) to separate each statement and conclusion. Do NOT write them as a single continuous string. Example:\nStatements:\nAll A are B.\nSome B are C.\n\nConclusions:\nI. Some A are C.\nII. No A is C.\n`;
    prompt += `11. INTELLIGENT FORMATTING (CRITICAL): You must analyze the topic (e.g. English Para Jumbles, Reading Comprehension, Puzzles) and intelligently determine the best visual layout. If a question contains multiple distinct sentences, statements, or paragraphs that need to be ordered or read separately, you MUST use standard newlines (\\n) to separate them so they are readable on the UI.\n`;
    prompt += `12. DATA INTERPRETATION (DI) CHARTS: For Data Interpretation questions, use the D/DQ row format instead of P/PQ. This renders charts on the UI.\n`;
    prompt += `   - Output chart data as JSON on a D row: D|[DI_Set_ID]|{"type":"bar|line|pie|table|stacked_bar|radar|mixed","title":"Chart Title","xLabel":"X Axis","yLabel":"Y Axis","categories":["Cat1",...],"series":[{"name":"S1","values":[v1,...]}]}###\n`;
    prompt += `   - The JSON in D row must be valid. Use double quotes for keys/strings. The pipe (|) only separates Row_Type, ID, and JSON.\n`;
    prompt += `   - For each question based on that chart (Row_Type = DQ): DQ|[DI_Set_ID]|[Question_Text]|[Options...]|[Correct_Option]|[Explanation]###\n`;
    prompt += `   - ADVANCED DI TYPES: To make the exam challenging, you MUST frequently use these Advanced DI formats:\n`;
    prompt += `      * "radar": A radar/web chart. Functions like a line chart but plotted circularly.\n`;
    prompt += `      * "table" (Missing DI): A table where some values are missing. Represent missing values in the "values" array as "?" or "-".\n`;
    prompt += `      * "mixed": Multiple charts for one set of questions. Structure JSON as: {"type":"mixed", "charts": [ {chart1 json}, {chart2 json} ] }.\n`;
    prompt += `      * Caselet DI: Dense paragraphs with numerical relationships. Use the P/PQ (Passage) format for Caselet DI instead of D/DQ.\n\n`;

    prompt += `FORMAT HEADERS (Do not change these):\n`;
    let headers = ['Row_Type', 'Passage_ID', 'Text_Content'];
    for(let i=1; i<=optionsCount; i++) headers.push(`Option_${String.fromCharCode(64+i)}`);
    headers.push('Correct_Option');
    headers.push('Explanation');
    prompt += headers.join('|') + '###\n\n';

    prompt += `EXAMPLE OUTPUT:\n`;
    prompt += headers.join('|') + '###\n';
    if(optionsCount === 4) {
      prompt += `P|passage1|This is a reading passage about history.||||||###\n`;
      prompt += `PQ|passage1|What is the main idea?|Opt1|Opt2|Opt3|Opt4|A|Because of X.###\n`;
      prompt += `Q||What is 2+2?|1|2|3|4|D|Basic math.###\n`;
    } else {
      prompt += `P|puzzle1|Seven persons sit in a row...|||||||###\n`;
      prompt += `PQ|puzzle1|Who sits at the end?|A|B|C|D|E|A|A sits at the extreme left.###\n`;
      prompt += `Q||Statements:<br/>All A are B.<br/>Some B are C.<br/><br/>Conclusions:<br/>I. Some A are C.<br/>II. No A is C.|Only I follows|Only II follows|Either I or II|Neither I nor II|Both I and II|C|Either case.###\n`;
    }

    prompt += `\nDI CHART EXAMPLE (when topic involves Data Interpretation):\n`;
    if(optionsCount === 4) {
      prompt += `D|di1|{"type":"bar","title":"Sales (in lakhs)","xLabel":"Year","yLabel":"Sales","categories":["2019","2020","2021","2022"],"series":[{"name":"Product A","values":[45,38,52,61]},{"name":"Product B","values":[30,35,40,55]}]}###\n`;
      prompt += `DQ|di1|What is the total sales of Product A from 2019 to 2022?|186 lakhs|196 lakhs|206 lakhs|176 lakhs|B|45+38+52+61=196 lakhs.###\n`;
      prompt += `DQ|di1|In which year did Product B show the highest growth?|2020|2021|2022|2019|C|2022: 55-40=15 is highest year-on-year increase.###\n`;
    } else {
      prompt += `D|di1|{"type":"bar","title":"Production (in thousands)","xLabel":"Year","yLabel":"Units","categories":["2018","2019","2020","2021","2022"],"series":[{"name":"Company X","values":[120,135,110,150,160]},{"name":"Company Y","values":[100,115,95,130,145]}]}###\n`;
      prompt += `DQ|di1|What is the ratio of Company X to Y production in 2021?|15:13|3:2|10:9|5:4|15:14|A|150:130 = 15:13.###\n`;
    }

    return prompt;
  };

  const handleCopyPrompt = (subjectName, qCount) => {
    const textToCopy = generatePrompt(subjectName, qCount);
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy);
    } else {
      // Fallback for non-secure contexts (e.g. IP address instead of localhost)
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      
      // Move out of screen to avoid scrolling
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error("Failed to copy text: ", error);
      }
      document.body.removeChild(textArea);
    }
    
    setCopiedSection(subjectName);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const parseRawCsv = (csvString, expectedCols) => {
    if (!csvString.trim()) return [];
    let rawRows = csvString.split('###').map(r => r.trim()).filter(r => r.length > 0);
    // Strip header
    if (rawRows[0].includes('Question_Text|') || rawRows[0].includes('Row_Type|')) {
      rawRows = rawRows.slice(1);
    }
    if (rawRows.length === 0) return [];

    let currentPassages = {};
    let currentChartData = {};
    let parsedQs = [];

    rawRows.forEach((row, i) => {
      const cols = row.split('|');
      const rowType = cols[0].trim();
      
      if (rowType === 'P') {
         const pId = cols[1]?.trim();
         const pText = cols[2]?.trim();
         if (pId && pText) {
             currentPassages[pId] = pText;
         }
         return; // Don't add a question for P row
      }
      
      // DI Chart data row — stores chart JSON, similar to P row
      if (rowType === 'D') {
         const dId = cols[1]?.trim();
         const dJson = cols.slice(2).join('|').trim();
         if (dId && dJson) {
             try {
                 currentChartData[dId] = JSON.parse(dJson);
             } catch(e) {
                 console.warn(`Failed to parse DI chart JSON for ${dId}:`, e.message);
             }
         }
         return;
      }
      
      if (rowType === 'DQ' || rowType === 'PQ' || rowType === 'Q') {
          // New format
          const pId = cols[1]?.trim();
          const text = cols[2]?.trim();
          const answer = cols[cols.length - 2]?.trim();
          const explanation = cols[cols.length - 1]?.trim() || '';
          const options = cols.slice(3, cols.length - 2).map(o => o.trim());
          
          const qObj = {
             id: Math.random().toString(36).substr(2, 9),
             text: text,
             options: options,
             answer: answer,
             explanation: explanation,
             passage: rowType === 'PQ' ? (currentPassages[pId] || pId) : null
          };
          // Attach chart data for DQ rows
          if (rowType === 'DQ' && pId && currentChartData[pId]) {
             qObj.chartData = currentChartData[pId];
          }
          parsedQs.push(qObj);
      } else {
          // Old format compatibility
          if (cols.length < expectedCols) throw new Error(`Row ${i+1} is missing pipes. Found ${cols.length} columns. Data: ${row.substring(0, 50)}...`);
          
          let text = cols[0].trim();
          let passage = null;
          
          if (text.toLowerCase().startsWith('passage:')) {
             const parts = text.split('Question:');
             if (parts.length > 1) {
                 passage = parts[0].substring(8).trim();
                 text = parts.slice(1).join('Question:').trim();
             }
          }
          
          parsedQs.push({
            id: Math.random().toString(36).substr(2, 9),
            text: text,
            options: cols.slice(1, expectedCols - 2).map(o => o.trim()),
            answer: cols[expectedCols - 2].trim(),
            explanation: cols[expectedCols - 1]?.trim() || '',
            passage: passage
          });
      }
    });
    
    return parsedQs;
  };


  const shuffleQuestions = (questions) => {
    const blocks = [];
    let currentPassage = null;
    let currentBlock = [];

    questions.forEach(q => {
      if (q.passage) {
        if (currentPassage !== q.passage) {
          if (currentBlock.length > 0) blocks.push(currentBlock);
          currentBlock = [q];
          currentPassage = q.passage;
        } else {
          currentBlock.push(q);
        }
      } else {
        if (currentBlock.length > 0) blocks.push(currentBlock);
        currentBlock = [q];
        currentPassage = null;
      }
    });
    if (currentBlock.length > 0) blocks.push(currentBlock);

    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    return blocks.flat();
  };

  const handleParseAndValidateAll = () => {
    setError('');
    try {
      const expectedCols = selectedBp.options_count + 3;
      let finalSections = [];
      let totalParsed = 0;

      if (testMode === 'Full') {
        for (let sec of selectedBp.sections) {
          const rawData = sectionData[sec.name] || '';
          if (!rawData) throw new Error(`Please provide data for section: ${sec.name}`);
          
          let parsedQs = parseRawCsv(rawData, expectedCols); parsedQs = shuffleQuestions(parsedQs);
          if (parsedQs.length !== sec.questions) {
             throw new Error(`${sec.name} expects ${sec.questions} questions, but parsed ${parsedQs.length}.`);
          }
          finalSections.push({ ...sec, questions: parsedQs });
          totalParsed += parsedQs.length;
        }
      } else {
        // Sectional or Topic
        const rawData = sectionData[targetSubject] || '';
        if (!rawData) throw new Error(`Please provide data for ${targetSubject}`);
        
        const parsedQs = parseRawCsv(rawData, expectedCols);
        const expectedForSec = getExpectedCount();
        if (testMode === 'Sectional' && parsedQs.length !== expectedForSec) {
           throw new Error(`Expected ${expectedForSec} questions, but parsed ${parsedQs.length}.`);
        }
        if (testMode === 'Topic' && parsedQs.length !== customQuestionCount) {
           throw new Error(`Expected ${customQuestionCount} questions, but parsed ${parsedQs.length}.`);
        }
        
        const sectionConfig = { ...(selectedBp.sections.find(s => s.name === targetSubject) || { name: targetSubject, duration: selectedBp.total_duration }) };
        if (testMode === 'Topic') sectionConfig.duration = customDuration;
        finalSections.push({ ...sectionConfig, questions: parsedQs });
        totalParsed += parsedQs.length;
      }

      const finalBlueprint = testMode === 'Topic' 
        ? { ...selectedBp, total_duration: customDuration } 
        : selectedBp;

      setParsedTest({
        test_id: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        blueprint: finalBlueprint,
        mode: testMode,
        sections: finalSections,
        totalParsed: totalParsed,
        expectedCount: getExpectedCount()
      });
      if (testMode !== 'Topic') setCustomDuration(finalBlueprint.total_duration || 60);
      setStep(4);

    } catch (err) {
      setError(`Validation Failed: ${err.message}`);
    }
  };

  const handleJoinRoom = (code = joinCode) => {
    if (!code.trim()) return;
    setError('');
    socket.emit('joinRoom', { code: code.trim(), user: currentUser });
  };

  const handleSaveName = (id) => {
    if (!editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    
    // Update local storage
    const user = JSON.parse(localStorage.getItem('unmocked_user') || '{}');
    if (user.id === id) {
      user.name = editingNameValue.trim();
      localStorage.setItem('unmocked_user', JSON.stringify(user));
    }
    
    // Emit socket event to update on server
    socket.emit('updateName', { code: lobbyData.code, userId: id, newName: editingNameValue.trim() });
    
    setEditingNameId(null);
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom', { code: lobbyData.code, userId: currentUser.id });
    setLobbyData(null);
    setStep(0);
  };

  const handleCloseRoom = () => {
    if (window.confirm("Are you sure you want to close this room? Everyone will be kicked.")) {
      socket.emit('closeRoom', { code: lobbyData.code });
      setLobbyData(null);
      setStep(0);
    }
  };

  const handleTransferHost = (targetUserId) => {
    if (window.confirm("Are you sure you want to transfer host privileges to this user?")) {
      socket.emit('transferHost', { code: lobbyData.code, targetUserId });
    }
  };

  const handleCreateStudyRoom = async () => {
    if (!newRoomName.trim()) { setError('Room name is required'); return; }
    try {
      const res = await fetch('/api/study-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName, description: newRoomDesc, user_id: currentUser.id })
      });
      if (res.ok) {
        const data = await res.json();
        navigate('/study-room/' + data.group_id);
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (e) { setError('Failed to create study room'); }
  };

  const handleJoinStudyRoom = async () => {
    if (!joinRoomCode.trim()) { setError('Room code is required'); return; }
    try {
      const res = await fetch('/api/study-groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ join_code: joinRoomCode, user_id: currentUser.id })
      });
      if (res.ok) {
        const data = await res.json();
        navigate('/study-room/' + data.group_id);
      } else {
        const err = await res.json();
        setError(err.error);
      }
    } catch (e) { setError('Failed to join study room'); }
  };

  const handleLaunchOrHost = () => {
    const finalMode = `${playMode}-${friendlyMode}`; // 'Solo-Real', 'Solo-Friendly', 'Multiplayer-Real', 'Multiplayer-Friendly'
    
    // Apply the user-edited duration to the test data
    let finalTest = parsedTest;
    if (friendlyMode === 'Real' && testMode === 'Topic') {
      finalTest = {
        ...parsedTest,
        blueprint: { ...parsedTest.blueprint, total_duration: customDuration },
        sections: parsedTest.sections.map(sec => ({ ...sec, duration: customDuration }))
      };
    }

    if (playMode === 'Solo') {
      localStorage.setItem('active_test_data', JSON.stringify(finalTest));
      localStorage.setItem('test_game_mode', finalMode);
      const sessionId = 'solo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      localStorage.setItem('current_test_session_id', sessionId);
      localStorage.removeItem('multiplayer_room');
      navigate('/test/' + sessionId + '?view=instructions');
    } else {
      socket.emit('createRoom', { user: currentUser, testData: finalTest, mode: finalMode });
      socket.once('roomCreated', (room) => {
        setLobbyData(room);
        setStep(5);
      });
    }
  };

  const handleStartMultiplayer = () => {
    if (lobbyData && lobbyData.code) {
      socket.emit('startGame', { code: lobbyData.code });
    }
  };

  const renderWizardTracker = () => {
    if (step === 0 || step > 4) return null;
    const stages = [
      { num: 1, label: 'Select Exam' },
      { num: 2, label: 'Mode' },
      { num: 3, label: 'Generate & Input' },
      { num: 4, label: 'Launch' }
    ];

    return (
      <div style={{ display: 'flex', gap: '16px', marginBottom: '40px', alignItems: 'center', overflowX: 'auto', paddingBottom: '8px' }} className="animate-fade-in">
        {stages.map((st, i) => (
          <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: step >= st.num ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= st.num ? 'var(--accent-color)' : 'var(--glass-border)', color: step >= st.num ? '#000' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>{st.num}</span>
            <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{st.label}</span>
            {i < stages.length - 1 && <ChevronRight size={16} style={{ color: 'var(--text-secondary)', marginLeft: '8px' }} />}
          </div>
        ))}
      </div>
    );
  };

  const renderDataInputBlock = (title, count) => {
    const isExpanded = testMode === 'Full' ? expandedSection === title : true;
    
    return (
      <div key={title} className="glass-panel" style={{ padding: '24px', marginBottom: '16px', transition: 'all 0.3s' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: testMode === 'Full' ? 'pointer' : 'default' }}
          onClick={() => {
            if (testMode === 'Full') setExpandedSection(isExpanded ? null : title);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="geist-pixel" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>{title} ({count} Questions)</h3>
            {sectionData[title] && sectionData[title].length > 100 && (
              <CheckCircle2 size={18} style={{ color: 'var(--accent-color)' }} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isExpanded && (
              <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleCopyPrompt(title, count); }} style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {copiedSection === title ? <><CheckCircle2 size={16} /> Copied Prompt</> : <><Copy size={16} /> Copy AI Prompt</>}
              </button>
            )}
            {testMode === 'Full' && (
              <ChevronRight size={20} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-secondary)' }} />
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--glass-border)' }} className="animate-fade-in">
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Generated AI Prompt:</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', maxHeight: '120px', overflowY: 'auto', paddingRight: '8px' }}>
                {generatePrompt(title, count)}
              </pre>
            </div>

            <textarea 
              className="input-field" 
              value={sectionData[title] || ''} 
              onChange={e => setSectionData({ ...sectionData, [title]: e.target.value })} 
              onClick={e => e.stopPropagation()}
              placeholder={`Paste AI response for ${title} here (Pipe-Separated Values ending with ###)...`} 
              rows={6} 
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)' }} 
            />
          </div>
        )}
      </div>
    );
  };

  const shareToStudyGroup = async () => {
    const targetGroupId = searchParams.get('groupId');
    if (!targetGroupId) return;
    try {
      const res = await fetch(`/api/study-groups/${targetGroupId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: parsedTest.test_id,
          test_data: parsedTest,
          user_id: currentUser.id,
          test_name: parsedTest.blueprint.exam_name
        })
      });
      if (res.ok) {
        navigate('/study-room/' + targetGroupId);
      }
    } catch (err) { console.error('Failed to share to group'); }
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Navbar />
      <main style={{ padding: '80px 20px 60px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }} className="animate-fade-in">
          <div>
            <h1 className="geist-pixel" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent-color)' }}>
              Welcome, {currentUser.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Launch a new mock test to begin your preparation.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button className="btn btn-glass" onClick={() => setStep(7)}>Global Reviews</button>
              <button className="btn btn-glass" onClick={() => navigate('/profile')}>My Profile</button>
              <button className="btn btn-glass" onClick={() => { useAuthStore.getState().logout(); navigate('/'); }}>Logout</button>
              {currentUser.is_admin && (
                <Link to="/admin" style={{ textDecoration: 'none' }}><button className="btn btn-primary">Admin Panel</button></Link>
              )}
            </div>
        </header>

        {renderWizardTracker()}

        {/* Step 7: Global Room Reviews */}
        {step === 7 && (
          <GlobalRoomReviews currentUser={currentUser} onBack={() => setStep(0)} />
        )}

        {/* Step 0: Home */}
        {step === 0 && (
          <div className="animate-fade-in">

            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '40px' }}>
              <BookOpen size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 24px auto' }} />
              <h2 className="geist-pixel" style={{ fontSize: '1.8rem', marginBottom: '16px' }}>Ready to practice?</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
                Create a highly accurate, AI-generated mock test modeled after standard competitive exams.
              </p>
              <button className="btn btn-primary" onClick={() => setStep(1)} style={{ padding: '12px 32px', fontSize: '1.1rem', marginBottom: '16px' }}>
                Start a New Mock Test <ArrowRight size={20} />
              </button>
              
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px', marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Live Test Sessions</h3>
                {activeRooms.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No live test sessions right now.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '500px' }}>
                    {activeRooms.map(r => (
                      <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{r.hostName}'s Room</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.examName} • {r.playersCount} Players</div>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleJoinRoom(r.code)}>
                          {r.state === 'LOBBY' ? `Join (${r.code})` : r.state === 'PLAYING' ? `Rejoin (${r.code})` : 'View Results'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <input type="text" className="input-field" placeholder="Or enter 6-digit code..." value={joinCode} onChange={e => setJoinCode(e.target.value)} style={{ width: '220px' }} />
                  <button className="btn btn-glass" onClick={() => handleJoinRoom()}>Join Private</button>
                </div>
                {error && step === 0 && <p style={{ color: 'var(--danger-color)', fontSize: '0.9rem' }}>{error}</p>}
              </div>
            </div>

            {/* Saved Tests (Resume) Section */}
            {savedTests.length > 0 && (
              <div className="glass-panel" style={{ padding: '32px', marginBottom: '40px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 className="geist-pixel" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Pause size={22} style={{ color: '#f59e0b' }} /> Saved Tests
                  </h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{savedTests.length} paused {savedTests.length === 1 ? 'test' : 'tests'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {savedTests.map(st => {
                    const mins = Math.floor((st.time_left || 0) / 60);
                    const secs = (st.time_left || 0) % 60;
                    const savedDate = st.saved_at ? new Date(st.saved_at.replace(' ', 'T') + 'Z') : null;
                    const timeAgo = savedDate ? getTimeAgo(savedDate) : '';
                    return (
                      <div key={st.id} className="glass-card" style={{ padding: '20px', borderLeft: '3px solid #f59e0b', position: 'relative' }}>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this saved test? This cannot be undone.')) {
                              fetch(`/api/test-session/saved/${st.id}`, { method: 'DELETE' })
                                .then(() => setSavedTests(prev => prev.filter(s => s.id !== st.id)))
                                .catch(() => {});
                            }
                          }}
                          style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}
                          title="Delete saved test"
                        >
                          <Trash2 size={14} />
                        </button>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)', paddingRight: '24px' }}>{st.exam_name}</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> {mins}m {secs}s left</span>
                          <span>Q{st.current_question + 1} • Sec {st.current_section + 1}</span>
                          <span>{st.game_mode?.replace('-', ' ')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{timeAgo}</span>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '8px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => navigate(`/test/${st.session_id}?resumeId=${st.id}`)}
                          >
                            <Play size={14} /> Resume
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Study Rooms Section */}
            <div className="glass-panel" style={{ padding: '32px', marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="geist-pixel" style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>My Study Rooms</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-glass" onClick={() => setStep(6)}>Create / Join Room</button>
                </div>
              </div>
              
              {studyRooms.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {studyRooms.map(room => (
                    <div key={room.id} className="glass-card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => navigate('/study-room/' + room.id)} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-color)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>{room.name}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.description || 'No description'}</p>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Code: {room.join_code}</span>
                        <span>{room.member_count} Members</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '24px' }}>You haven't joined any Study Rooms yet. Create or join one to collaborate with friends!</p>
              )}
            </div>

            {/* Analytics placeholders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Recent Tests</h3>
                {pastTests.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                    {pastTests.map(test => (
                      <div key={test.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong style={{ color: 'var(--accent-color)' }}>{test.exam_name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(test.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{test.game_mode.replace('-', ' ')}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <span>Score: {test.score.toFixed(2)} | Acc: {test.accuracy.toFixed(0)}%</span>
                             <button className="btn btn-glass" style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => navigate(`/review/${test.id}`)}>
                               <BookOpen size={14} /> Review
                             </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>You have not taken any tests yet.</p>
                )}
              </div>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Analytics</h3>
                {pastTests.length > 0 ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                       <span>Total Tests Taken</span>
                       <strong style={{ color: 'var(--accent-color)' }}>{pastTests.length}</strong>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '16px' }}>
                       <span>Average Accuracy</span>
                       <strong style={{ color: 'var(--accent-color)' }}>{(pastTests.reduce((acc, t) => acc + t.accuracy, 0) / pastTests.length).toFixed(0)}%</strong>
                     </div>
                     <div style={{ width: '100%', height: 200 }}>
                       <ResponsiveContainer>
                         <LineChart data={pastTests.slice().reverse().map((t, idx) => ({ name: `Test ${idx+1}`, accuracy: t.accuracy }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                           <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                           <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                           <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--accent-color)' }} />
                           <Line type="monotone" dataKey="accuracy" stroke="var(--accent-color)" strokeWidth={3} dot={{ fill: 'var(--surface-color)', stroke: 'var(--accent-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                         </LineChart>
                       </ResponsiveContainer>
                     </div>
                   </div>
                ) : (
                   <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Take a test to generate performance insights.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select Exam */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="geist-pixel" style={{ fontSize: '1.5rem' }}>Select an Exam Blueprint</h2>
              <button className="btn btn-glass" onClick={() => setStep(0)}>Cancel</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {blueprints.map(bp => (
                <div key={bp.id} className="glass-card" style={{ padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => { setSelectedBp(bp); setStep(2); }} onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-color)'} onMouseOut={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>{bp.exam_name}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    {bp.total_duration} mins • {bp.sections.length} Sections {bp.has_sectional_timing ? '• Strict Timings' : ''}
                  </div>
                </div>
              ))}
              {blueprints.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No blueprints available. Ask an Admin to create some.</p>}
            </div>
          </div>
        )}

        {/* Step 2: Select Mode */}
        {step === 2 && (
          <div className="animate-fade-in glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Select Test Scope</h2>
                <p style={{ color: 'var(--text-secondary)' }}>How do you want to generate questions for <strong>{selectedBp.exam_name}</strong>?</p>
              </div>
              <button className="btn btn-glass" onClick={() => setStep(1)}>Back</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
              <div className="glass-card" style={{ padding: '20px', cursor: 'pointer', borderColor: testMode === 'Full' ? 'var(--accent-color)' : 'var(--glass-border)' }} onClick={() => { setTestMode('Full'); setTargetSubject(''); }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>Full Mock Exam</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Generate separate prompts for all sections.</p>
              </div>
              <div className="glass-card" style={{ padding: '20px', cursor: 'pointer', borderColor: testMode === 'Sectional' ? 'var(--accent-color)' : 'var(--glass-border)' }} onClick={() => { setTestMode('Sectional'); setTargetSubject(''); }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>Sectional Test</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Focus on a specific section like English or Quant.</p>
              </div>
              <div className="glass-card" style={{ padding: '20px', cursor: 'pointer', borderColor: testMode === 'Topic' ? 'var(--accent-color)' : 'var(--glass-border)' }} onClick={() => { setTestMode('Topic'); setTargetSubject(''); setSelectedTopics([]); }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '4px' }}>Topic Wise</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Focus on highly specific topics within a section.</p>
              </div>
            </div>

            {testMode && (
              <div className="animate-fade-in">
                {testMode === 'Sectional' && (
                  <div style={{ marginBottom: '24px' }}>
                    <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Select Target Section</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {selectedBp.sections.map((sec, i) => (
                        <button 
                          key={i}
                          onClick={() => setTargetSubject(sec.name)}
                          style={{
                            padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                            border: `1px solid ${targetSubject === sec.name ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                            background: targetSubject === sec.name ? 'rgba(74, 222, 128, 0.1)' : 'var(--glass-bg)',
                            color: targetSubject === sec.name ? 'var(--accent-color)' : 'var(--text-primary)',
                            fontWeight: targetSubject === sec.name ? 'bold' : 'normal'
                          }}
                        >
                          {sec.name} <span style={{ fontSize: '0.85em', opacity: 0.8 }}>({sec.questions} Qs)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {testMode === 'Topic' && (
                  <div className="animate-fade-in" style={{ marginBottom: '24px' }}>
                    <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Step 1: Select Section</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                      {selectedBp.sections.map((sec, i) => (
                        <button 
                          key={i}
                          onClick={() => { setTargetSubject(sec.name); setSelectedTopics([]); setCustomDuration(sec.duration || 15); }}
                          style={{
                            padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                            border: `1px solid ${targetSubject === sec.name ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                            background: targetSubject === sec.name ? 'rgba(74, 222, 128, 0.1)' : 'var(--glass-bg)',
                            color: targetSubject === sec.name ? 'var(--accent-color)' : 'var(--text-primary)',
                            fontWeight: targetSubject === sec.name ? 'bold' : 'normal'
                          }}
                        >
                          {sec.name}
                        </button>
                      ))}
                    </div>

                    {targetSubject && (() => {
                      const currentSec = selectedBp.sections.find(s => s.name === targetSubject);
                      const availableTopics = currentSec?.topics || [];
                      return (
                        <div className="animate-fade-in">
                          <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Step 2: Select Topics (Multi-select)</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                            {availableTopics.map((topic, i) => {
                              const isSelected = selectedTopics.includes(topic);
                              return (
                                <button 
                                  key={i}
                                  onClick={() => {
                                    if (isSelected) setSelectedTopics(selectedTopics.filter(t => t !== topic));
                                    else setSelectedTopics([...selectedTopics, topic]);
                                  }}
                                  style={{
                                    padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s',
                                    border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--glass-border)'}`,
                                    background: isSelected ? 'var(--accent-color)' : 'transparent',
                                    color: isSelected ? '#000' : 'var(--text-secondary)',
                                    fontWeight: isSelected ? 'bold' : 'normal'
                                  }}
                                >
                                  {topic}
                                </button>
                              )
                            })}
                            {availableTopics.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No predefined topics for this section.</p>}
                          </div>

                          <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Step 3: Number of Questions</label>
                          <input 
                            type="number" 
                            className="input-field" 
                            value={customQuestionCount} 
                            onChange={e => setCustomQuestionCount(Math.max(1, parseInt(e.target.value) || 1))} 
                            min="1" max="100" 
                            style={{ width: '150px' }}
                          />
                        </div>
                      )
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!targetSubject && testMode !== 'Full'}>
                    Proceed to Generation <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Generate & Input */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Generate & Input Data</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Copy the prompt for each section and paste the AI's response below.</p>
              </div>
              <button className="btn btn-glass" onClick={() => setStep(2)}>Back</button>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: '#fca5a5', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <AlertCircle size={20} />
                <span style={{ fontSize: '0.95rem' }}>{error}</span>
              </div>
            )}

            {testMode === 'Full' ? (
              selectedBp.sections.map(sec => renderDataInputBlock(sec.name, sec.questions))
            ) : (
              renderDataInputBlock(targetSubject, getExpectedCount())
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleParseAndValidateAll} style={{ padding: '12px 32px', fontSize: '1.1rem' }}>
                Parse & Validate All <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Ready to Launch */}
        {step === 4 && parsedTest && (
          <div className="animate-fade-in">
            <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
              <h2 className="geist-pixel" style={{ fontSize: '2rem', marginBottom: '24px', textAlign: 'center' }}>Select Game Mode</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                <div>
                  <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Play Type</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="glass-card" onClick={() => setPlayMode('Solo')} style={{ padding: '16px', cursor: 'pointer', borderColor: playMode === 'Solo' ? 'var(--accent-color)' : 'var(--glass-border)' }}>
                      <h4 style={{ margin: '0 0 4px 0' }}>Solo</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Take the test alone.</p>
                    </div>
                    <div className="glass-card" onClick={() => setPlayMode('Multiplayer')} style={{ padding: '16px', cursor: 'pointer', borderColor: playMode === 'Multiplayer' ? 'var(--accent-color)' : 'var(--glass-border)' }}>
                      <h4 style={{ margin: '0 0 4px 0' }}>Multiplayer</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Host a room and invite friends.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="input-label" style={{ marginBottom: '12px', display: 'block' }}>Ruleset</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="glass-card" onClick={() => setFriendlyMode('Real')} style={{ padding: '16px', cursor: 'pointer', borderColor: friendlyMode === 'Real' ? 'var(--accent-color)' : 'var(--glass-border)' }}>
                      <h4 style={{ margin: '0 0 4px 0' }}>Real Exam Mode</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Strict timers. Answers revealed at the end.</p>
                    </div>
                    <div className="glass-card" onClick={() => setFriendlyMode('Friendly')} style={{ padding: '16px', cursor: 'pointer', borderColor: friendlyMode === 'Friendly' ? 'var(--accent-color)' : 'var(--glass-border)' }}>
                      <h4 style={{ margin: '0 0 4px 0' }}>Friendly Mode</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No timers. Instant answers or synchronized pacing.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '12px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Exam:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{parsedTest.blueprint.exam_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Parsed Questions:</span>
                  <strong style={{ color: parsedTest.totalParsed === parsedTest.expectedCount ? 'var(--accent-color)' : 'var(--warning-color)' }}>
                    {parsedTest.totalParsed} / {parsedTest.expectedCount} Expected
                  </strong>
                </div>
                {friendlyMode === 'Real' && testMode === 'Topic' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Duration (Minutes):</span>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={customDuration} 
                      onChange={e => setCustomDuration(Math.max(1, parseInt(e.target.value) || 1))} 
                      min="1" max="300" 
                      style={{ width: '100px', textAlign: 'center', padding: '6px 10px', fontSize: '1rem', fontWeight: 'bold' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <button className="btn btn-glass" onClick={() => setStep(3)}>Back to Editor</button>
                {searchParams.get('groupId') ? (
                  <button className="btn btn-primary" onClick={shareToStudyGroup} style={{ padding: '12px 32px', fontSize: '1.1rem', background: 'var(--accent-color)', color: '#000' }}>
                    Share to Study Room <ArrowRight size={20} />
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleLaunchOrHost} style={{ padding: '12px 32px', fontSize: '1.1rem' }}>
                    {playMode === 'Multiplayer' ? 'Create Lobby' : 'Launch Test'} <Play size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Lobby Waiting Room */}
        {step === 5 && lobbyData && (
          <div className="animate-fade-in">
            <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
              <h2 className="geist-pixel" style={{ fontSize: '2.5rem', marginBottom: '8px', color: 'var(--accent-color)' }}>{lobbyData.code}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>Share this 6-digit Room Code with your friends.</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                 <div>
                    <strong style={{ color: 'var(--text-secondary)' }}>Mode:</strong><br/>
                    <span style={{ fontSize: '1.1rem' }}>{lobbyData.mode.replace('-', ' ')}</span>
                 </div>
                 <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Exam:</strong><br/>
                    <span style={{ fontSize: '1.1rem' }}>{lobbyData.testData?.blueprint?.exam_name || 'Multiplayer Exam'}</span>
                 </div>
              </div>

              <div style={{ textAlign: 'left', marginBottom: '40px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Players in Lobby ({1 + lobbyData.guests.length})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                  {/* Host Card */}
                  <div className="glass-card" style={{ padding: '16px', borderColor: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{lobbyData.host.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingNameId === lobbyData.host.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="text" className="input-field" value={editingNameValue} onChange={e => setEditingNameValue(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName(lobbyData.host.id)} />
                          <button onClick={() => handleSaveName(lobbyData.host.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }}><Check size={16} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lobbyData.host.name}</span>
                          {currentUser.id === lobbyData.host.id && (
                            <button onClick={() => { setEditingNameId(lobbyData.host.id); setEditingNameValue(lobbyData.host.name); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', display: 'block' }}>Host</span>
                    </div>
                  </div>
                  {/* Guests Cards */}
                  {lobbyData.guests.map((g, i) => (
                    <div key={i} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{g.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingNameId === g.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="text" className="input-field" value={editingNameValue} onChange={e => setEditingNameValue(e.target.value)} style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100%' }} autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveName(g.id)} />
                            <button onClick={() => handleSaveName(g.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer' }}><Check size={16} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                            {currentUser.id === g.id && (
                              <button onClick={() => { setEditingNameId(g.id); setEditingNameValue(g.name); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                        {currentUser.id === lobbyData.host.id && (
                          <button onClick={() => handleTransferHost(g.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontSize: '0.8rem', cursor: 'pointer', padding: 0, marginTop: '4px', display: 'block' }}>
                            Make Host
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {lobbyData.host.id === currentUser.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button className="btn btn-primary" onClick={handleStartMultiplayer} style={{ padding: '12px 32px', fontSize: '1.2rem', width: '100%' }}>
                    Start Exam <Play size={20} />
                  </button>
                  <button onClick={handleCloseRoom} style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '12px', borderRadius: '8px', cursor: 'pointer', width: '100%' }}>
                    Close Room
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '16px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px', color: 'var(--accent-color)' }}>
                    Waiting for Host to start the exam...
                  </div>
                  <button onClick={handleLeaveRoom} style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '12px', borderRadius: '8px', cursor: 'pointer', width: '100%' }}>
                    Leave Room
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Create/Join Study Room */}
        {step === 6 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="geist-pixel" style={{ fontSize: '1.5rem' }}>Study Rooms</h2>
              <button className="btn btn-glass" onClick={() => setStep(0)}>Back to Home</button>
            </div>
            
            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: '#fca5a5', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.3rem', marginBottom: '24px', color: 'var(--accent-color)' }}>Create a New Room</h3>
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Room Name</label>
                <input type="text" className="input-field" placeholder="E.g. SSC Study Group" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={{ marginBottom: '16px' }} />
                
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Description (Optional)</label>
                <textarea className="input-field" placeholder="What is this group about?" value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} rows={3} style={{ marginBottom: '24px', resize: 'none' }} />
                
                <button className="btn btn-primary" onClick={handleCreateStudyRoom} style={{ width: '100%' }}>Create Study Room</button>
              </div>

              <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.3rem', marginBottom: '24px', color: 'var(--accent-color)' }}>Join an Existing Room</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Ask your friend for their 6-digit Study Room code.</p>
                
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Room Code</label>
                <input type="text" className="input-field" placeholder="Enter 6-Digit Code" value={joinRoomCode} onChange={e => setJoinRoomCode(e.target.value)} style={{ marginBottom: '24px' }} />
                
                <button className="btn btn-primary" onClick={handleJoinStudyRoom} style={{ width: '100%' }}>Join Study Room</button>
              </div>
            </div>
          </div>
        )}

        </div>
      </main>
    </div>
  );
}
