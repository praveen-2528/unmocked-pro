const fs = require('fs');

let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

// 1. Shuffling and Passage grouping
const parseAndValidateReplacement = `  const shuffleQuestions = (questions) => {
    // Extract passage blocks to keep them grouped
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

    // Shuffle the blocks themselves
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    return blocks.flat();
  };

  const handleParseAndValidateAll = () => {
    try {
      const finalSections = [];
      let totalParsed = 0;
      for (const sectionInput of sectionsData) {
        let parsedQs = JSON.parse(sectionInput.jsonOutput);
        
        // --- PASSAGE SUPPORT PARSING ---
        // Iterate through parsedQs and identify passages
        let currentActivePassage = null;
        parsedQs = parsedQs.map(q => {
            if (q.Passage_Text && q.Passage_Text.trim().length > 0) {
                currentActivePassage = q.Passage_Text;
            } else if (q.question && typeof q.question === 'string' && q.question.toLowerCase().startsWith('passage:')) {
                // Also support if the AI just prefixes the question with Passage:
                const parts = q.question.split('Question:');
                if (parts.length > 1) {
                    currentActivePassage = parts[0].substring(8).trim();
                    q.question = parts.slice(1).join('Question:').trim();
                }
            }
            if (currentActivePassage) {
                return { ...q, id: q.id || Math.random().toString(36).substr(2, 9), text: q.question, answer: q.correctAnswer, options: q.options || [q.A, q.B, q.C, q.D, q.E].filter(Boolean), explanation: q.explanation, passage: currentActivePassage };
            }
            return { ...q, id: q.id || Math.random().toString(36).substr(2, 9), text: q.question, answer: q.correctAnswer, options: q.options || [q.A, q.B, q.C, q.D, q.E].filter(Boolean), explanation: q.explanation };
        });
        
        const targetSubject = sectionInput.subject;
        const targetCount = selectedBp.sections.find(s => s.name === targetSubject)?.num_questions;
        const customQuestionCount = parseInt(sectionsData[0].questionCount, 10);
        if (testMode === 'Full' && parsedQs.length !== targetCount) {
          throw new Error(\`Expected \${targetCount} questions for \${targetSubject}, but parsed \${parsedQs.length}.\`);
        }
        if (testMode === 'Topic' && parsedQs.length !== customQuestionCount) {
           throw new Error(\`Expected \${customQuestionCount} questions, but parsed \${parsedQs.length}.\`);
        }
        
        parsedQs = shuffleQuestions(parsedQs);
        
        const sectionConfig = { ...(selectedBp.sections.find(s => s.name === targetSubject) || { name: targetSubject, duration: selectedBp.total_duration }) };
        if (testMode === 'Topic') sectionConfig.duration = customDuration;
        finalSections.push({ ...sectionConfig, questions: parsedQs });
        totalParsed += parsedQs.length;
      }
      setParsedTest({ test_id: Math.random().toString(36).substr(2, 9), blueprint: selectedBp, sections: finalSections, total_questions: totalParsed });
      setStep(4);
    } catch (err) {
      setError(err.message);
    }
  };`;

const startIdx = c.indexOf('const handleParseAndValidateAll = () => {');
const endIdx = c.indexOf('const handleLaunchOrHost = () => {');
c = c.substring(0, startIdx) + parseAndValidateReplacement + '\n\n  ' + c.substring(endIdx);

// 2. Active Multiplayer Rooms -> Live Test Sessions
c = c.replace('Active Multiplayer Rooms', 'Live Test Sessions');
c = c.replace('No active multiplayer rooms right now.', 'No live test sessions right now.');

// 3. Update the button
const buttonSearch = '<button className="btn btn-primary" onClick={() => handleJoinRoom(r.code)}>Join ({r.code})</button>';
const buttonReplace = `<button className="btn btn-primary" onClick={() => handleJoinRoom(r.code)}>
                          {r.state === 'LOBBY' ? \`Join (\${r.code})\` : r.state === 'PLAYING' ? \`Rejoin (\${r.code})\` : 'View Results'}
                        </button>`;
c = c.replace(buttonSearch, buttonReplace);

// Fix margin top for Dashboard (Since we git checkout'ed, we need to add the margin top fix again to Dashboard)
c = c.replace('<div className="dashboard-container">', '<div className="dashboard-container" style={{ paddingTop: "60px" }}>');

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
