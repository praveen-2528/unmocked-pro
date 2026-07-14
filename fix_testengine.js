const fs = require('fs'); 
let c = fs.readFileSync('frontend/src/pages/TestEngine.jsx', 'utf8'); 
const start = c.indexOf('<div className="te-question-content">'); 
const end = c.indexOf('<div className="te-options-list">'); 
const replacement = `<div className="te-question-content" style={{ display: 'flex', gap: '20px' }}>
                  {currentQuestion.passage && (
                      <div className="te-passage-panel" style={{ flex: '1 1 50%', paddingRight: '20px', borderRight: '1px solid var(--border-color)', maxHeight: '550px', overflowY: 'auto' }}>
                          <h4 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-dark)' }}>Read the passage carefully:</h4>
                          <div 
                              className="math-inline-force" 
                              style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-dark)', whiteSpace: 'pre-wrap' }}
                              dangerouslySetInnerHTML={{ __html: currentQuestion.passage }} 
                          />
                      </div>
                  )}

                  <div style={{ flex: currentQuestion.passage ? '1 1 50%' : '1' }}>
                      <div 
                          className="math-inline-force" 
                          style={{ marginBottom: '1rem', fontSize: '1.1rem' }}
                          dangerouslySetInnerHTML={{ __html: currentQuestion.text }} 
                      />

                      `; 
c = c.substring(0, start) + replacement + c.substring(end); 

// Also need to close the extra div after te-options-list and explanation
const endContent = c.indexOf('</div>', c.indexOf('<h4 style={{ margin: \'0 0 12px 0\'', end)) + 6;
// Actually, it's easier to just find the end of the te-question-content block and insert a closing div.
// Wait, te-question-content contains te-options-list and the explanation div.
// The easiest way is to close the newly added `div` right before the end of `te-question-content`.
// Let's just find the closing tag of te-question-content.
const endOfContent = c.indexOf('</div>', c.indexOf('No explanation provided." }} />\n                       </div>\n                    )')) + 'No explanation provided." }} />\n                       </div>\n                    )'.length;
// Hmm, it's safer to just replace `className="te-question-content"` and the div structure.
// I'll do it carefully with regex or direct index.
fs.writeFileSync('frontend/src/pages/TestEngine.jsx', c);
