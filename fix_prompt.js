const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

c = c.replace(
    'prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n\\n`;',
    'prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n`;\n    prompt += `9. PASSAGES: If the questions are based on a reading passage (like Reading Comprehension), you MUST include the full passage text in the \\'Passage_Text\\' column for the FIRST question of that passage. Leave it empty for subsequent questions on the same passage, or if there is no passage.\\n\\n`;'
);

c = c.replace(
    "let headers = ['Question_Text'];",
    "let headers = ['Passage_Text', 'Question_Text'];"
);

c = c.replace(
    'prompt += `Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;',
    'prompt += `|Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;'
);

c = c.replace(
    'prompt += `Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;',
    'prompt += `|Evaluate the integral: $$\\\\int x^2 dx$$\\n\\nIt is hard.|$$\\\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;'
);

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
console.log("Updated prompt successfully!");
