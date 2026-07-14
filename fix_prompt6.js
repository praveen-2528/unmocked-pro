const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('9. PASSAGES:')) {
        const newRule = "    prompt += `10. LINE BREAKS FOR COMPLEX QUESTIONS: For questions with multiple statements, conclusions, or analogies (e.g., Syllogisms, Inequalities, Data Sufficiency), you MUST use HTML <br/> tags for line breaks instead of standard newlines so they render correctly on the frontend. Example: 'Statements:<br/>All A are B.<br/>Some B are C.<br/><br/>Conclusions:<br/>I. Some A are C.<br/>II. No A is C.'\\n\\n`;";
        lines.splice(i + 1, 0, newRule);
        break; // Only insert once
    }
}

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', lines.join('\n'));
console.log("Updated correctly!");
