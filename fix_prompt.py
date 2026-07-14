import os

filepath = 'frontend/src/pages/Dashboard.jsx'
with open(filepath, 'r', encoding='utf8') as f:
    content = f.read()

target = """    prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n\\n`;"""
replacement = """    prompt += `8. ROW DELIMITER: You MUST append the exact string "###" at the very end of EVERY row (after the Explanation). This is critical for parsing newlines correctly.\\n`;
    prompt += `9. PASSAGES: If the questions are based on a reading passage (like Reading Comprehension), you MUST include the full passage text in the 'Passage_Text' column for the FIRST question of that passage. Leave it empty for subsequent questions on the same passage, or if there is no passage.\\n\\n`;"""
content = content.replace(target, replacement)

target2 = """    let headers = ['Question_Text'];"""
replacement2 = """    let headers = ['Passage_Text', 'Question_Text'];"""
content = content.replace(target2, replacement2)

target3 = """    if(optionsCount === 4) {
      prompt += `Evaluate the integral: $$\\int x^2 dx$$\\n\\nIt is hard.|$$\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;
    } else {
      prompt += `Evaluate the integral: $$\\int x^2 dx$$\\n\\nIt is hard.|$$\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;
    }"""
replacement3 = """    if(optionsCount === 4) {
      prompt += `|Evaluate the integral: $$\\int x^2 dx$$\\n\\nIt is hard.|$$\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\frac{x^2}{2} + C$$|A|Use the power rule for integration.###\\n`;
    } else {
      prompt += `|Evaluate the integral: $$\\int x^2 dx$$\\n\\nIt is hard.|$$\\frac{x^3}{3} + C$$|$$x^3 + C$$|$$2x$$|$$\\frac{x^2}{2} + C$$|$$x$$|A|Use the power rule for integration.###\\n`;
    }"""
content = content.replace(target3, replacement3)

with open(filepath, 'w', encoding='utf8') as f:
    f.write(content)

print("Updated successfully")
