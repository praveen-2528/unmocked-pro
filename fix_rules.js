const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

const rule7Search = '7. MATH/EQUATIONS: If the question contains mathematics, fractions, or symbols, you MUST use standard LaTeX wrapped in $$ or \\\\( \\\\) (e.g., Solve for x: $$\\frac{x}{2} = 4$$).\\n';
const rule7Replace = '7. MATH/EQUATIONS: If the question contains mathematics, use inline LaTeX wrapped in \\\\( \\\\). Do NOT use $$ display math. For reasoning inequalities (e.g., A > B < C), use inline math \\\\( A > B \\\\).\\n';

const rule10Search = "10. LINE BREAKS FOR COMPLEX QUESTIONS: For questions with multiple statements, conclusions, or analogies (e.g., Syllogisms, Inequalities, Data Sufficiency), you MUST use HTML <br/> tags for line breaks instead of standard newlines so they render correctly on the frontend. Example: 'Statements:<br/>All A are B.<br/>Some B are C.<br/><br/>Conclusions:<br/>I. Some A are C.<br/>II. No A is C.'\\n\\n";
const rule10Replace = "10. LINE BREAKS (CRITICAL): For Syllogisms, Inequalities, and Data Sufficiency, you MUST include standard newlines to separate each statement and conclusion. Do NOT write them as a single continuous string. Example:\\nStatements:\\nAll A are B.\\nSome B are C.\\n\\nConclusions:\\nI. Some A are C.\\nII. No A is C.\\n\\n";

if (c.includes(rule7Search)) {
    c = c.replace(rule7Search, rule7Replace);
} else {
    console.error("Rule 7 not found!");
}

if (c.includes(rule10Search)) {
    c = c.replace(rule10Search, rule10Replace);
} else {
    console.error("Rule 10 not found!");
}

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
console.log("Replaced Rules 7 and 10.");
