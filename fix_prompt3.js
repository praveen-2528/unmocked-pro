const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('8. ROW DELIMITER:') && lines[i].includes('###')) {
        // Find where the \n\n`; is
        lines[i] = lines[i].replace('\\n\\n`;', '\\n`;');
        // Insert rule 9 right after
        lines.splice(i + 1, 0, '    prompt += `9. PASSAGES: If the questions are based on a reading passage (like Reading Comprehension), you MUST include the full passage text in the \\'Passage_Text\\' column for the FIRST question of that passage. Leave it empty for subsequent questions on the same passage, or if there is no passage.\\n\\n`;');
        i++; // skip newly inserted line
    }
    if (lines[i].includes("let headers = ['Question_Text'];")) {
        lines[i] = "    let headers = ['Passage_Text', 'Question_Text'];";
    }
    if (lines[i].includes('prompt += `Evaluate the integral:')) {
        lines[i] = lines[i].replace('prompt += `Evaluate', 'prompt += `|Evaluate');
    }
}

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', lines.join('\n'));
console.log("Updated correctly!");
