const fs = require('fs');

let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

const oldRule = "    prompt += `10. LINE BREAKS (CRITICAL): For Syllogisms, Inequalities, and Data Sufficiency, you MUST include standard newlines to separate each statement and conclusion. Do NOT write them as a single continuous string. Example:\\nStatements:\\nAll A are B.\\nSome B are C.\\n\\nConclusions:\\nI. Some A are C.\\nII. No A is C.\\n\\n`;";

const newRule = "    prompt += `10. LINE BREAKS (CRITICAL): For Syllogisms, Inequalities, and Data Sufficiency, you MUST include standard newlines (\\\\n) to separate each statement and conclusion. Do NOT write them as a single continuous string. Example:\\nStatements:\\nAll A are B.\\nSome B are C.\\n\\nConclusions:\\nI. Some A are C.\\nII. No A is C.\\n`;\n    prompt += `11. INTELLIGENT FORMATTING (CRITICAL): You must analyze the topic (e.g. English Para Jumbles, Reading Comprehension, Puzzles) and intelligently determine the best visual layout. If a question contains multiple distinct sentences, statements, or paragraphs that need to be ordered or read separately, you MUST use standard newlines (\\\\n) to separate them so they are readable on the UI.\\n\\n`;";

if (c.includes(oldRule)) {
    c = c.replace(oldRule, newRule);
    fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
    console.log("Updated AI prompt with intelligent formatting rules.");
} else {
    console.log("Could not find old rule. Ensure exact match.");
}
