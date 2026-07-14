const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

// 1. Find generatePrompt bounds
const genPromptStart = c.indexOf('  const generatePrompt = (subjectName, qCount) => {');
const genPromptEnd = c.indexOf('  const handleCopyPrompt = ', genPromptStart);

if (genPromptStart === -1 || genPromptEnd === -1) {
    throw new Error('Could not find generatePrompt bounds');
}

const newGenPrompt = `  const generatePrompt = (subjectName, qCount) => {
    const examName = selectedBp?.exam_name || 'Exam';
    const optionsCount = selectedBp?.options_count || 4;

    let prompt = \`Act as an expert exam creator for the \${examName} exam. \`;
    
    if (testMode === 'Topic' && selectedTopics.length > 0) {
      prompt += \`I need you to generate exactly \${qCount} multiple-choice questions for the section "\${subjectName}". The questions MUST specifically cover the following topics: \${selectedTopics.join(', ')}. \`;
    } else {
      prompt += \`I need you to generate exactly \${qCount} multiple-choice questions for the subject/topic: "\${subjectName}". \`;
    }
    prompt += \`Ensure the questions closely mirror the most recent pattern and difficulty level of this specific exam.\\n\\n\`;
    
    prompt += \`RULES:\\n\`;
    prompt += \`1. The difficulty level should be Medium to Hard.\\n\`;
    prompt += \`2. Each question must have exactly \${optionsCount} options.\\n\`;
    prompt += \`3. Only ONE option can be correct.\\n\`;
    prompt += \`4. You MUST output the final result STRICTLY as a raw Pipe-Separated Values format (|).\\n\`;
    prompt += \`5. Do NOT include any conversational text before or after the output.\\n\`;
    prompt += \`6. CRITICAL: Do NOT wrap any text in double quotes unless it is actually part of the question. The pipe character (|) is the ONLY delimiter.\\n\`;
    prompt += \`7. MATH/EQUATIONS: If the question contains mathematics, fractions, or symbols, you MUST use standard LaTeX wrapped in $$ or \\\\( \\\\) (e.g., Solve for x: $$\\frac{x}{2} = 4$$).\\n\`;
    prompt += \`8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n\`;
    prompt += \`9. PASSAGES (IMPORTANT): For questions based on a reading passage, data interpretation, or puzzle, use this format:\\n\`;
    prompt += \`   - First, output the passage on its own row: P|[Passage_ID]|[Full Passage Text]###\\n\`;
    prompt += \`   - Then, for each question related to that passage: PQ|[Passage_ID]|[Question_Text]|[Options...]|[Correct_Option]|[Explanation]###\\n\`;
    prompt += \`   - For normal standalone questions (no passage): Q||[Question_Text]|[Options...]|[Correct_Option]|[Explanation]###\\n\`;
    prompt += \`10. LINE BREAKS FOR COMPLEX QUESTIONS: For questions with multiple statements, conclusions, or analogies (e.g., Syllogisms, Inequalities, Data Sufficiency), you MUST use HTML <br/> tags for line breaks instead of standard newlines so they render correctly on the frontend. Example: 'Statements:<br/>All A are B.<br/>Some B are C.<br/><br/>Conclusions:<br/>I. Some A are C.<br/>II. No A is C.'\\n\\n\`;

    prompt += \`FORMAT HEADERS (Do not change these):\\n\`;
    let headers = ['Row_Type', 'Passage_ID', 'Text_Content'];
    for(let i=1; i<=optionsCount; i++) headers.push(\`Option_\${String.fromCharCode(64+i)}\`);
    headers.push('Correct_Option');
    headers.push('Explanation');
    prompt += headers.join('|') + '###\\n\\n';

    prompt += \`EXAMPLE OUTPUT:\\n\`;
    prompt += headers.join('|') + '###\\n';
    if(optionsCount === 4) {
      prompt += \`P|passage1|This is a reading passage about history.||||||###\\n\`;
      prompt += \`PQ|passage1|What is the main idea?|Opt1|Opt2|Opt3|Opt4|A|Because of X.###\\n\`;
      prompt += \`Q||What is 2+2?|1|2|3|4|D|Basic math.###\\n\`;
    } else {
      prompt += \`P|puzzle1|Seven persons sit in a row...|||||||###\\n\`;
      prompt += \`PQ|puzzle1|Who sits at the end?|A|B|C|D|E|A|A sits at the extreme left.###\\n\`;
      prompt += \`Q||Statements:<br/>All A are B.<br/>Some B are C.<br/><br/>Conclusions:<br/>I. Some A are C.<br/>II. No A is C.|Only I follows|Only II follows|Either I or II|Neither I nor II|Both I and II|C|Either case.###\\n\`;
    }

    return prompt;
  };

`;

c = c.substring(0, genPromptStart) + newGenPrompt + c.substring(genPromptEnd);

// 2. Replace parseRawCsv
const parseStart = c.indexOf('  const parseRawCsv = (csvString, expectedCols) => {');
const parseEnd = c.indexOf('  const handleParseAndValidateAll = () => {', parseStart);

if (parseStart === -1 || parseEnd === -1) {
    throw new Error('Could not find parseRawCsv bounds');
}

const newParse = `  const parseRawCsv = (csvString, expectedCols) => {
    if (!csvString.trim()) return [];
    let rawRows = csvString.split('###').map(r => r.trim()).filter(r => r.length > 0);
    // Strip header
    if (rawRows[0].includes('Question_Text|') || rawRows[0].includes('Row_Type|')) {
      rawRows = rawRows.slice(1);
    }
    if (rawRows.length === 0) return [];

    let currentPassages = {};
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
      
      if (rowType === 'PQ' || rowType === 'Q') {
          // New format
          const pId = cols[1]?.trim();
          const text = cols[2]?.trim();
          const answer = cols[cols.length - 2]?.trim();
          const explanation = cols[cols.length - 1]?.trim() || '';
          const options = cols.slice(3, cols.length - 2).map(o => o.trim());
          
          parsedQs.push({
             id: Math.random().toString(36).substr(2, 9),
             text: text,
             options: options,
             answer: answer,
             explanation: explanation,
             passage: rowType === 'PQ' ? (currentPassages[pId] || pId) : null
          });
      } else {
          // Old format compatibility
          if (cols.length < expectedCols) throw new Error(\`Row \${i+1} is missing pipes. Found \${cols.length} columns. Data: \${row.substring(0, 50)}...\`);
          
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

`;

c = c.substring(0, parseStart) + newParse + c.substring(parseEnd);

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
console.log("Updated correctly!");
