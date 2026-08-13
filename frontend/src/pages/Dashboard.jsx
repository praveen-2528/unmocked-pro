import { useState, useEffect, useRef } from 'react';
import { BookOpen, Clock, Settings, Users, ArrowRight, Play, ArrowLeft, FileText, CheckCircle2, ChevronRight, Copy, AlertCircle, Edit2, Check, Pause, Trash2, MessageCircle, Send, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../socket';
import GlobalRoomReviews from '../components/GlobalRoomReviews';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import Tilt from 'react-parallax-tilt';
import { motion } from 'framer-motion';

const TiltWrapper = ({ children }) => (
  <Tilt tiltMaxAngleX={2} tiltMaxAngleY={2} glareEnable={true} glareMaxOpacity={0.1} glarePosition="all" scale={1.01} transitionSpeed={1500} tiltReverse={true}>
    {children}
  </Tilt>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [blueprints, setBlueprints] = useState([]);
  const [pastTests, setPastTests] = useState([]);
  const [savedTests, setSavedTests] = useState([]);
  const [studyRooms, setStudyRooms] = useState([]);
  const [todos, setTodos] = useState([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoTag, setNewTodoTag] = useState('');
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [currentDate, setCurrentDate] = useState('');
  const [selectedExamTab, setSelectedExamTab] = useState('');
  
  const { setActiveRoomCode, clearLobbyMessages } = useChatStore();

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
  const [quizDuelTopics, setQuizDuelTopics] = useState('');
  const [quizDuelCount, setQuizDuelCount] = useState(10);
  const [quizDuelData, setQuizDuelData] = useState('');
  const [quizDuelParsed, setQuizDuelParsed] = useState(null);
  
  // Multiplayer State
  const [playMode, setPlayMode] = useState('Solo'); // 'Solo', 'Multiplayer'
  const [friendlyMode, setFriendlyMode] = useState('Real'); // 'Real', 'Friendly'
  const [joinCode, setJoinCode] = useState('');
  const [lobbyData, setLobbyData] = useState(null);
  const [activeRooms, setActiveRooms] = useState([]);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [activeChessRooms, setActiveChessRooms] = useState([]);
  
  // Study Room State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  
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
          
        fetch(`/api/todos/${currentUser.id}`)
          .then(res => res.json())
          .then(data => setTodos(Array.isArray(data) ? data : []))
          .catch(err => console.error(err));

        if (step === 0) {
          fetch('/api/active-rooms')
            .then(res => res.json())
            .then(data => setActiveRooms(data))
            .catch(err => console.error(err));
            
          fetch('/api/active-chess-rooms')
            .then(res => res.json())
            .then(data => setActiveChessRooms(data))
            .catch(err => console.error(err));
        }
      }
    }

    socket.on('roomCreated', (data) => {
      setLobbyData(data);
      setActiveRoomCode(data.code);
      clearLobbyMessages();
      setStep(5);
    });
    
    socket.on('roomJoined', (data) => {
      setLobbyData(data);
      setActiveRoomCode(data.code);
      clearLobbyMessages();
      setStep(5);
    });

    socket.on('lobbyUpdated', (data) => {
      setLobbyData(data);
    });

    socket.on('roomClosed', () => {
      setLobbyData(null);
      setActiveRoomCode(null);
      clearLobbyMessages();
      setStep(0);
      alert('The host has closed the room.');
    });

    socket.on('gameStarted', (room) => {
      localStorage.setItem('active_test_data', JSON.stringify(room.testData));
      localStorage.setItem('multiplayer_room', JSON.stringify(room));
      const sessionId = 'multi-' + room.code;
      localStorage.setItem('current_test_session_id', sessionId);
      navigate('/test/' + sessionId + '?view=instructions');
    });
    
    socket.on('roomError', (err) => {
      setError(err);
    });
    
    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('lobbyUpdated');
      socket.off('roomClosed');
      socket.off('gameStarted');
      socket.off('roomError');
    }
  }, []);

  // Safety check: if user refreshes on a later step without an active blueprint, bump them to step 1
  useEffect(() => {
    if (step > 1 && step < 5 && !selectedBp) {
      setSearchParams({ step: '1' });
    }
  }, [step, selectedBp, setSearchParams]);

  useEffect(() => {
    fetch('/api/daily-updates/dates')
      .then(res => res.json())
      .then(dates => {
        if (dates && dates.length > 0) {
          setAvailableDates(dates);
          setCurrentDate(dates[0]); // Default to latest
        }
      })
      .catch(err => console.error('Failed to fetch available dates', err));
  }, []);

  useEffect(() => {
    if (!currentDate) return;
    fetch(`/api/daily-updates?date=${currentDate}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const parsed = data.map(d => JSON.parse(d.content));
          setDailyUpdates(parsed);
          
          setDailyUpdates(current => {
             const names = parsed.map(p => p.exam_name);
             setSelectedExamTab(prevTab => names.includes(prevTab) ? prevTab : names[0]);
             return parsed;
          });
        } else {
          setDailyUpdates([]);
        }
      })
      .catch(err => console.error('Failed to fetch daily updates', err));
  }, [currentDate]);

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
    prompt += `Ensure the questions closely mirror the EXACT pattern, syllabus, and extreme rigor of the actual ${examName} exam.\n\n`;
    
    prompt += `CRITICAL INSTRUCTIONS FOR RIGOR & COMPLEXITY:\n`;
    prompt += `1. AVOID BASIC TRIVIA: The questions MUST NOT be basic definitions, direct formula applications, or simple factual lookups. They must require multi-step reasoning, critical thinking, advanced calculations, or deep conceptual understanding.\n`;
    prompt += `2. STRICT EXAM-LEVEL CALIBRATION: Calibrate the difficulty strictly to the ${examName} level. For competitive exams, the questions must be exceptionally challenging, featuring nuanced scenarios, edge cases, and high cognitive load.\n`;
    prompt += `3. PLAUSIBLE DISTRACTORS: The incorrect options MUST be highly plausible. They should represent common student misconceptions, intermediate calculation errors, or partial truths. Do not provide obviously wrong options.\n`;
    prompt += `4. OVERALL DIFFICULTY: The difficulty tier should strictly range from Medium-Hard to Extremely Hard.\n\n`;

    prompt += `FORMAT RULES:\n`;
    prompt += `1. Each question must have exactly ${optionsCount} options.\n`;
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
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      
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
         return; 
      }
      
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
          if (rowType === 'DQ' && pId && currentChartData[pId]) {
             qObj.chartData = currentChartData[pId];
          }
          parsedQs.push(qObj);
      } else {
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
    const trimmedCode = code.trim();
    if (!trimmedCode) return;
    setError('');
    
    socket.emit('joinRoom', { code: trimmedCode, user: currentUser });
  };

  const handleSaveName = (id) => {
    if (!editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    
    const user = JSON.parse(localStorage.getItem('unmocked_user') || '{}');
    if (user.id === id) {
      user.name = editingNameValue.trim();
      localStorage.setItem('unmocked_user', JSON.stringify(user));
    }
    
    socket.emit('updateName', { code: lobbyData.code, userId: id, newName: editingNameValue.trim() });
    
    setEditingNameId(null);
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom', { code: lobbyData.code, userId: currentUser.id });
    setLobbyData(null);
    setActiveRoomCode(null);
    clearLobbyMessages();
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
    const finalMode = `${playMode}-${friendlyMode}`; 
    
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
    }
  };

  const handleAddTodo = () => {
    if (!newTodoTitle.trim()) return;
    fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, title: newTodoTitle, tag: newTodoTag })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.id) {
          setTodos([data, ...todos]);
          setNewTodoTitle('');
          setNewTodoTag('');
        }
      })
      .catch(console.error);
  };

  const handleToggleTodo = (id, currentStatus) => {
    fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !currentStatus })
    }).then(() => {
      setTodos(todos.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));
    }).catch(console.error);
  };

  const handleDeleteTodo = (id) => {
    fetch(`/api/todos/${id}`, { method: 'DELETE' })
      .then(() => {
        setTodos(todos.filter(t => t.id !== id));
      })
      .catch(console.error);
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

  const generateQuizDuelPrompt = () => {
    const topics = quizDuelTopics || 'General Knowledge';
    const count = quizDuelCount || 10;
    
    let prompt = `Generate exactly ${count} quick-fire multiple-choice quiz questions for a rapid-fire quiz game.\n\n`;
    prompt += `TOPICS TO COVER: ${topics}\n\n`;
    prompt += `QUESTION STYLE:\n`;
    prompt += `- Short, punchy questions testing factual recall and quick thinking\n`;
    prompt += `- Focus on: percentages to fractions, formulas, dates, facts, conversions, definitions\n`;
    prompt += `- Each question should be answerable in under 15 seconds\n`;
    prompt += `- Difficulty: Easy to Medium (for leisure/casual play)\n`;
    prompt += `- Distractors should be plausible but clearly distinguishable from the correct answer\n\n`;
    prompt += `FORMAT RULES:\n`;
    prompt += `1. Each question MUST have exactly 4 options\n`;
    prompt += `2. Only ONE option is correct\n`;
    prompt += `3. Output STRICTLY as Pipe-Separated Values (|) format\n`;
    prompt += `4. Do NOT include any conversational text before or after\n`;
    prompt += `5. Append "###" at the end of EVERY row\n`;
    prompt += `6. Use this EXACT row format:\n`;
    prompt += `Q||[Question Text]|[Option A]|[Option B]|[Option C]|[Option D]|[Correct Option Letter]|[Detailed Explanation. Tip to remember: ...]###\n\n`;
    prompt += `EXAMPLE:\n`;
    prompt += `Q||What is 12.5% as a fraction?|1/8|1/6|1/4|1/12|A|12.5% is exactly half of 25% (which is 1/4). Tip to remember: 100 divided by 12.5 is 8.###\n`;
    prompt += `Q||What is the chemical symbol for Gold?|Gd|Go|Au|Ag|C|The symbol comes from its Latin name "Aurum". Tip to remember: "A u" return my gold!###\n`;
    prompt += `Q||Area of a circle with radius r is?|2πr|πr²|πd|2πr²|B|The area is π times the radius squared. Tip to remember: Area is squared (r²), circumference is linear (2πr).###\n\n`;
    prompt += `Generate exactly ${count} questions now. No headers, just the raw PSV rows. Ensure the explanation is detailed and always includes a "Tip to remember".`;
    
    return prompt;
  };

  const handleQuizDuelParse = () => {
    try {
      const raw = quizDuelData.trim();
      if (!raw) { setError('Please paste the AI response first.'); return; }
      
      const rows = raw.split('###').map(r => r.trim()).filter(r => r.length > 0);
      const questions = [];
      
      for (const row of rows) {
        const parts = row.split('|');
        if (parts.length < 8) continue;
        if (parts[0].trim() !== 'Q') continue;
        
        const text = parts[2]?.trim();
        const optA = parts[3]?.trim();
        const optB = parts[4]?.trim();
        const optC = parts[5]?.trim();
        const optD = parts[6]?.trim();
        const answer = parts[7]?.trim()?.toUpperCase();
        const explanation = parts[8]?.trim() || '';
        
        if (!text || !optA || !optB || !optC || !optD || !['A','B','C','D'].includes(answer)) continue;
        
        questions.push({
          id: `qd-${questions.length + 1}`,
          text,
          options: [optA, optB, optC, optD],
          answer,
          explanation
        });
      }
      
      if (questions.length === 0) {
        setError('No valid questions found. Please check the format.');
        return;
      }
      
      const quizData = {
        topics: quizDuelTopics || 'General Knowledge',
        questionCount: questions.length,
        questions
      };
      
      setQuizDuelParsed(quizData);
      setError('');
    } catch (e) {
      setError('Failed to parse quiz data: ' + e.message);
    }
  };

  const launchQuizDuel = () => {
    localStorage.setItem('quiz_duel_data', JSON.stringify(quizDuelParsed));
    navigate('/quiz-duel');
  };

  if (step > 1 && step < 5 && !selectedBp) {
    return (
      <div className="dashboard-container flex-center">
        <p style={{ color: 'var(--text-secondary)' }}>Restoring session...</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}
      >
      <main style={{ padding: '80px 20px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }} className="animate-fade-in">
          <div>
            <h1 className="geist-pixel" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent-color)' }}>
              Welcome, {currentUser.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Launch a new mock test to begin your preparation.</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button className="btn btn-glass" onClick={() => setStep(7)}>Global Reviews</button>
              <button className="btn btn-glass" onClick={() => navigate('/profile')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {currentUser.profile_pic ? (
                  <img src={currentUser.profile_pic} alt="Profile" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                    {(currentUser.name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                My Profile
              </button>
              <button className="btn btn-glass" onClick={() => { useAuthStore.getState().logout(); navigate('/'); }}>Logout</button>
              {currentUser.is_admin && (
                <Link to="/admin" style={{ textDecoration: 'none' }}><button className="btn btn-primary">Admin Panel</button></Link>
              )}
            </div>
        </header>

        {renderWizardTracker()}

        {step === 7 && (
          <GlobalRoomReviews currentUser={currentUser} onBack={() => setStep(0)} />
        )}

        {step === 8 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚡ Quick Quiz Duel Setup</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Set up a split-screen quiz battle for 2 players on one device.</p>
              </div>
              <button className="btn btn-glass" onClick={() => setStep(0)}>Cancel</button>
            </div>

            {!quizDuelParsed ? (
              <div className="glass-panel" style={{ padding: '32px' }}>
                {/* Step 1: Topics */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="input-label" style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '8px', display: 'block' }}>📝 Topics to quiz on</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Percentage to Fractions, Trigonometry Formulas, Indian History, Chemical Symbols..."
                    value={quizDuelTopics}
                    onChange={e => setQuizDuelTopics(e.target.value)}
                    style={{ fontSize: '1rem', padding: '14px 16px' }}
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>Separate multiple topics with commas</p>
                </div>

                {/* Step 2: Question Count - Fully Custom */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="input-label" style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '8px', display: 'block' }}>🔢 Number of Questions</label>
                  <input
                    type="number"
                    className="input-field"
                    min={3}
                    max={50}
                    value={quizDuelCount}
                    onChange={e => setQuizDuelCount(Math.max(3, Math.min(50, parseInt(e.target.value) || 3)))}
                    style={{ width: '120px', fontSize: '1.1rem', padding: '12px 16px', textAlign: 'center' }}
                  />
                  <span style={{ marginLeft: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Min 3, Max 50</span>
                </div>

                {/* Step 3: Generated Prompt */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="input-label" style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>🤖 AI Prompt</label>
                    <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(generateQuizDuelPrompt()); setCopiedSection('quizduel'); setTimeout(() => setCopiedSection(null), 2000); }} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      {copiedSection === 'quizduel' ? '✓ Copied!' : '📋 Copy Prompt'}
                    </button>
                  </div>
                  <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '150px', overflowY: 'auto' }}>
                    {generateQuizDuelPrompt()}
                  </pre>
                </div>

                {/* Step 4: Paste Response */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="input-label" style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '8px', display: 'block' }}>📥 Paste AI Response</label>
                  <textarea
                    className="input-field"
                    placeholder="Paste the AI-generated quiz questions here (Pipe-Separated Values ending with ###)..."
                    value={quizDuelData}
                    onChange={e => setQuizDuelData(e.target.value)}
                    rows={8}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)' }}
                  />
                </div>

                {error && <p style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>}

                <button className="btn btn-primary" onClick={handleQuizDuelParse} style={{ padding: '12px 28px', fontSize: '1rem', width: '100%', background: 'linear-gradient(135deg, #06b6d4, #f472b6)', border: 'none' }}>
                  Parse & Validate Questions
                </button>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 className="geist-pixel" style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Quiz Ready!</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <strong>{quizDuelParsed.questions.length}</strong> questions on <strong>{quizDuelParsed.topics}</strong>
                </p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                  Grab a friend, hold the device between you, and start the duel!
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="btn btn-glass" onClick={() => setQuizDuelParsed(null)}>← Edit Questions</button>
                  <button className="btn btn-primary" onClick={launchQuizDuel} style={{ padding: '12px 32px', fontSize: '1.1rem', background: 'linear-gradient(135deg, #06b6d4, #f472b6)', border: 'none' }}>
                    🚀 Launch Quiz Duel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 0 && (
          <div className="animate-fade-in">

            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginBottom: '32px' }}>
              <BookOpen size={48} style={{ color: 'var(--accent-color)', margin: '0 auto 20px auto' }} />
              <h2 className="geist-pixel" style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Ready to practice?</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px auto', fontSize: '0.95rem' }}>
                Create a highly accurate, AI-generated mock test modeled after standard competitive exams.
              </p>
              <button className="btn btn-primary" onClick={() => setStep(1)} style={{ padding: '10px 24px', fontSize: '1rem', marginBottom: '16px' }}>
                Start a New Mock Test <ArrowRight size={18} />
              </button>
              
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Live Test Sessions</h3>
                {activeRooms.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No live test sessions right now.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '500px' }}>
                    {activeRooms.map(r => (
                      <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '0.9rem' }}>{r.hostName}'s Room</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.examName} • {r.playersCount} Players</div>
                        </div>
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => handleJoinRoom(r.code)}>
                          {r.state === 'LOBBY' ? `Join (${r.code})` : r.state === 'PLAYING' ? `Rejoin (${r.code})` : 'View Results'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {activeChessRooms.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '500px', marginTop: '16px' }}>
                    <h3 className="geist-pixel" style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Live Chess Matches</h3>
                    {activeChessRooms.map(r => (
                      <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '0.9rem' }}>{r.hostName}'s Chess Match</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.playersCount}/2 Players • {r.status}</div>
                        </div>
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate(`/chess/${r.code}`)}>
                          Join ({r.code})
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <input type="text" className="input-field" placeholder="Enter test room code (6-digit)..." value={joinCode} onChange={e => setJoinCode(e.target.value)} style={{ width: '280px', fontSize: '0.9rem', padding: '8px 12px' }} />
                  <button className="btn btn-glass" style={{ padding: '8px 16px', fontSize: '0.9rem' }} onClick={() => handleJoinRoom()}>Join Private</button>
                </div>
                {error && step === 0 && <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem' }}>{error}</p>}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', marginBottom: '32px', borderLeft: '4px solid #f472b6' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>⚡</span>
              <h2 className="geist-pixel" style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Quick Quiz Duel</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px auto', fontSize: '0.95rem' }}>
                Face off on one device! A split-screen quiz for 2 players — perfect for learning facts, formulas & GK during leisure time.
              </p>
              <button className="btn btn-primary" onClick={() => setStep(8)} style={{ padding: '10px 24px', fontSize: '1rem', background: 'linear-gradient(135deg, #06b6d4, #f472b6)', border: 'none' }}>
                Start Quiz Duel <ArrowRight size={18} />
              </button>
            </div>

            <TiltWrapper>
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                <h2 className="geist-pixel" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                  <CheckCircle2 size={24} style={{ color: 'var(--success-color)' }} /> Study To-Do List
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{todos.filter(t => t.is_completed).length} / {todos.length} Completed</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="What do you need to study?" 
                  value={newTodoTitle} 
                  onChange={e => setNewTodoTitle(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                  style={{ flex: 1, padding: '10px 16px', fontSize: '0.95rem' }} 
                />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Tag (e.g. Exam/Subject)" 
                  value={newTodoTag} 
                  onChange={e => setNewTodoTag(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                  style={{ width: '180px', padding: '10px 16px', fontSize: '0.95rem' }} 
                />
                <button className="btn btn-primary" onClick={handleAddTodo} style={{ padding: '0 20px', borderRadius: '8px' }}>Add</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Your study list is empty. Add a topic above!</div>
                ) : (
                  todos.map(todo => (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)', transition: 'all 0.2s', opacity: todo.is_completed ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div 
                          onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                          style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${todo.is_completed ? 'var(--success-color)' : 'var(--text-secondary)'}`, background: todo.is_completed ? 'var(--success-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          {todo.is_completed && <Check size={14} color="#fff" />}
                        </div>
                        <span style={{ fontSize: '1rem', color: 'var(--text-primary)', textDecoration: todo.is_completed ? 'line-through' : 'none', cursor: 'pointer' }} onClick={() => handleToggleTodo(todo.id, todo.is_completed)}>
                          {todo.title}
                        </span>
                        {todo.tag && (
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>{todo.tag}</span>
                        )}
                      </div>
                      <button 
                        onClick={() => handleDeleteTodo(todo.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                        title="Delete task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            </TiltWrapper>

            {savedTests.length > 0 && (
              <TiltWrapper>
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
              </TiltWrapper>
            )}

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
                  <div className="glass-card" style={{ padding: '16px', borderColor: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {lobbyData.host.profile_pic ? (
                      <img src={lobbyData.host.profile_pic} alt="Host Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{lobbyData.host.name.charAt(0).toUpperCase()}</div>
                    )}
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
                  {lobbyData.guests.map((g, i) => (
                    <div key={i} className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {g.profile_pic ? (
                        <img src={g.profile_pic} alt="Guest Profile" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{g.name.charAt(0).toUpperCase()}</div>
                      )}
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
    </motion.div>
    </div>
  );
}
