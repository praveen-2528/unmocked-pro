const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('9. PASSAGES:')) {
        lines[i] = "    prompt += `9. PASSAGES: If the questions are based on a reading passage, DO NOT add a new column. Instead, for the FIRST question of that passage, combine the passage and the question inside the 'Question_Text' column using this exact format: 'Passage: [Full Passage Text] Question: [The Question Text]'. For subsequent questions, just output the question normally.\\n\\n`;";
    }
    if (lines[i].includes("let headers = ['Passage_Text', 'Question_Text'];")) {
        lines[i] = "    let headers = ['Question_Text'];";
    }
    if (lines[i].includes("prompt += `|Evaluate the integral:")) {
        lines[i] = lines[i].replace("prompt += `|Evaluate", "prompt += `Evaluate");
    }
}

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', lines.join('\n'));
console.log("Updated correctly!");
