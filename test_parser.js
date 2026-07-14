const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

const parseStart = c.indexOf('  const parseRawCsv = (csvString, expectedCols) => {');
const parseEnd = c.indexOf('  const shuffleQuestions = (questions) => {');
let parseCode = c.substring(parseStart, parseEnd);

// Expose it
parseCode = parseCode.replace('const parseRawCsv', 'global.parseRawCsv');

eval(parseCode);

const csvInput = `Row_Type|Passage_ID|Text_Content|Option_A|Option_B|Option_C|Option_D|Correct_Option|Explanation###
P|puzzle1|Seven persons sit in a row...||||||###
PQ|puzzle1|Who sits at the end?|A|B|C|D|A|A sits at the extreme left.###
Q||What is 2+2?|1|2|3|4|D|Basic math.###`;

const parsed = global.parseRawCsv(csvInput, 6);
console.log(JSON.stringify(parsed, null, 2));

const oldCsvInput = `Question_Text|Option_A|Option_B|Option_C|Option_D|Correct_Option|Explanation###
Passage: Some long text. Question: What is the main idea?|Opt1|Opt2|Opt3|Opt4|A|Because of X.###
What is 3+3?|1|6|3|4|B|Basic math.###`;

const oldParsed = global.parseRawCsv(oldCsvInput, 6);
console.log(JSON.stringify(oldParsed, null, 2));
