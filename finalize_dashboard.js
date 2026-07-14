const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Dashboard.jsx', 'utf8');

const shuffleCode = `
  const shuffleQuestions = (questions) => {
    const blocks = [];
    let currentPassage = null;
    let currentBlock = [];

    questions.forEach(q => {
      if (q.passage) {
        if (currentPassage !== q.passage) {
          if (currentBlock.length > 0) blocks.push(currentBlock);
          currentBlock = [q];
          currentPassage = q.passage;
        } else {
          currentBlock.push(q);
        }
      } else {
        if (currentBlock.length > 0) blocks.push(currentBlock);
        currentBlock = [q];
        currentPassage = null;
      }
    });
    if (currentBlock.length > 0) blocks.push(currentBlock);

    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    return blocks.flat();
  };
`;

if (!c.includes('const shuffleQuestions = (questions) => {')) {
    const insertIdx = c.indexOf('  const handleParseAndValidateAll = () => {');
    c = c.substring(0, insertIdx) + shuffleCode + '\n' + c.substring(insertIdx);
}

c = c.replace('const parsedQs = parseRawCsv(rawData, expectedCols);', 'let parsedQs = parseRawCsv(rawData, expectedCols); parsedQs = shuffleQuestions(parsedQs);');
c = c.replace('const parsedQs = parseRawCsv(rawData, expectedCols);\n          const expectedForSec = getExpectedCount();', 'let parsedQs = parseRawCsv(rawData, expectedCols);\n          parsedQs = shuffleQuestions(parsedQs);\n          const expectedForSec = getExpectedCount();');


c = c.replace('Active Multiplayer Rooms', 'Live Test Sessions');
c = c.replace('No active multiplayer rooms right now.', 'No live test sessions right now.');

const buttonSearch = '<button className="btn btn-primary" onClick={() => handleJoinRoom(r.code)}>Join ({r.code})</button>';
const buttonReplace = `<button className="btn btn-primary" onClick={() => handleJoinRoom(r.code)}>
                          {r.state === 'LOBBY' ? \`Join (\${r.code})\` : r.state === 'PLAYING' ? \`Rejoin (\${r.code})\` : 'View Results'}
                        </button>`;
if (c.includes(buttonSearch)) {
    c = c.replace(buttonSearch, buttonReplace);
}

fs.writeFileSync('frontend/src/pages/Dashboard.jsx', c);
console.log('Finalized Dashboard!');
