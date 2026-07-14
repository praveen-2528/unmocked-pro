const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');
const start = c.indexOf('const handleParseAndValidateAll = () => {');
const end = c.indexOf('const handleLaunchOrHost = () => {');

const replacement = `  const handleParseAndValidateAll = () => {
    setError('');
    try {
      const expectedCols = selectedBp.options_count + 4;
      let finalSections = [];
      let totalParsed = 0;

      const shuffleQuestions = (questions) => {
        let passages = [];
        let standalone = [];
        let currentPassage = null;
        let currentGroup = [];
        for (const q of questions) {
          if (q.passage) {
            if (currentPassage !== q.passage) {
              if (currentGroup.length > 0) passages.push(currentGroup);
              currentPassage = q.passage;
              currentGroup = [q];
            } else { currentGroup.push(q); }
          } else {
            if (currentGroup.length > 0) passages.push(currentGroup);
            currentPassage = null;
            currentGroup = [];
            standalone.push([q]);
          }
        }
        if (currentGroup.length > 0) passages.push(currentGroup);
        let allGroups = [...passages, ...standalone];
        for (let i = allGroups.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allGroups[i], allGroups[j]] = [allGroups[j], allGroups[i]];
        }
        return allGroups.flat();
      };

      if (testMode === 'Full') {
        for (let sec of selectedBp.sections) {
          const rawData = sectionData[sec.name] || '';
          if (!rawData) throw new Error(\`Please provide data for section: \${sec.name}\`);
          let parsedQs = parseRawCsv(rawData, expectedCols);
          if (parsedQs.length !== sec.questions) {
             throw new Error(\`\${sec.name} expects \${sec.questions} questions, but parsed \${parsedQs.length}.\`);
          }
          parsedQs = shuffleQuestions(parsedQs);
          finalSections.push({ ...sec, questions: parsedQs });
          totalParsed += parsedQs.length;
        }
      } else {
        const rawData = sectionData[targetSubject] || '';
        if (!rawData) throw new Error(\`Please provide data for \${targetSubject}\`);
        let parsedQs = parseRawCsv(rawData, expectedCols);
        const expectedForSec = getExpectedCount();
        if (testMode === 'Sectional' && parsedQs.length !== expectedForSec) {
           throw new Error(\`Expected \${expectedForSec} questions, but parsed \${parsedQs.length}.\`);
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
  };

  `;

c = c.substring(0, start) + replacement + c.substring(end);
fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
