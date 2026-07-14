const fs = require('fs');

let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

const t1 = 'prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n\\n`;';
const r1 = 'prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n`;\n    prompt += `9. PASSAGES: If the questions are based on a reading passage (like Reading Comprehension), you MUST include the full passage text in the \\'Passage_Text\\' column for the FIRST question of that passage. Leave it empty for subsequent questions on the same passage, or if there is no passage.\\n\\n`;';

const t2 = "let headers = ['Question_Text'];";
const r2 = "let headers = ['Passage_Text', 'Question_Text'];";

const t3 = "    if(optionsCount === 4) {\n      prompt += `Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;\n    } else {\n      prompt += `Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;\n    }";
const r3 = "    if(optionsCount === 4) {\n      prompt += `|Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;\n    } else {\n      prompt += `|Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;\n    }";

c = c.replace(t1, r1);
c = c.replace(t2, r2);
c = c.replace(t3, r3);

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
console.log("Updated successfully!");
