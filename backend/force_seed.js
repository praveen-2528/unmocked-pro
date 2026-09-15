const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'unmocked.db');
const db = new sqlite3.Database(dbPath);

const seedExams = [
  { id: 'SSC-CGL-T1', name: 'SSC CGL Tier 1', duration: 60, options: 4, sectional: 1, marks_correct: 2.0, marks_incorrect: 0.5, sections: [
    { name: 'General Intelligence', questions: 25, duration: 15, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series', 'Venn Diagrams', 'Non-Verbal Reasoning', 'Paper Folding', 'Mirror Images', 'Embedded Figures'] },
    { name: 'General Awareness', questions: 25, duration: 15, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Static GK', 'Books & Authors', 'Awards', 'Art & Culture'] },
    { name: 'Quantitative Aptitude', questions: 25, duration: 15, topics: ['Algebra', 'Geometry', 'Trigonometry', 'Data Interpretation', 'Profit and Loss', 'Time and Work', 'Percentages', 'Mensuration', 'Number System', 'Simple/Compound Interest', 'Ratio & Proportion'] },
    { name: 'English Comprehension', questions: 25, duration: 15, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Idioms & Phrases', 'Synonyms & Antonyms', 'Active/Passive Voice', 'Direct/Indirect Speech', 'Spelling Corrections'] }
  ]},
  { id: 'SSC-CHSL-T1', name: 'SSC CHSL Tier 1', duration: 60, options: 4, sectional: 1, marks_correct: 2.0, marks_incorrect: 0.5, sections: [
    { name: 'English Language', questions: 25, duration: 15, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Idioms & Phrases', 'Synonyms & Antonyms', 'Active/Passive Voice'] },
    { name: 'General Intelligence', questions: 25, duration: 15, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series', 'Venn Diagrams', 'Mirror Images'] },
    { name: 'Quantitative Aptitude', questions: 25, duration: 15, topics: ['Algebra', 'Geometry', 'Trigonometry', 'Data Interpretation', 'Profit and Loss', 'Time and Work', 'Percentages', 'Mensuration'] },
    { name: 'General Awareness', questions: 25, duration: 15, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Static GK', 'Books & Authors'] }
  ]},
  { id: 'SSC-STENO', name: 'SSC Stenographer Grade C & D', duration: 120, options: 4, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
    { name: 'General Intelligence & Reasoning', questions: 50, duration: 30, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series', 'Direction Sense', 'Venn Diagrams', 'Non-Verbal Reasoning', 'Matrix'] },
    { name: 'General Awareness', questions: 50, duration: 30, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Static GK', 'Sports', 'Art & Culture'] },
    { name: 'English Language & Comprehension', questions: 100, duration: 60, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Active & Passive Voice', 'Direct & Indirect Speech', 'Vocabulary'] }
  ]},
  { id: 'IBPS-PO-PRE', name: 'IBPS PO Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
    { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Vocabulary', 'Fill in the Blanks', 'Word Swap'] },
    { name: 'Quantitative Aptitude', questions: 35, duration: 20, topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Simplification', 'Approximation', 'Profit and Loss', 'Time and Work', 'Time, Speed & Distance', 'Mixture & Allegation'] },
    { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities', 'Direction Sense', 'Order & Ranking'] }
  ]},
  { id: 'IBPS-CLERK-PRE', name: 'IBPS Clerk Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
    { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Vocabulary', 'Fill in the Blanks'] },
    { name: 'Numerical Ability', questions: 35, duration: 20, topics: ['Simplification', 'Approximation', 'Number Series', 'Data Interpretation', 'Profit and Loss', 'Time and Work', 'Percentages', 'Simple/Compound Interest'] },
    { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities', 'Direction Sense', 'Alphanumeric Series'] }
  ]},
  { id: 'RRB-NTPC-CBT1', name: 'RRB NTPC CBT 1', duration: 90, options: 4, sectional: 0, marks_correct: 1.0, marks_incorrect: 0.33, sections: [
    { name: 'General Awareness', questions: 40, duration: 0, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Sports', 'Art & Culture', 'Monuments of India'] },
    { name: 'Mathematics', questions: 30, duration: 0, topics: ['Number System', 'Decimals', 'Fractions', 'LCM and HCF', 'Ratio and Proportions', 'Percentage', 'Mensuration', 'Time and Work', 'Time & Distance', 'Elementary Algebra', 'Geometry'] },
    { name: 'General Intelligence and Reasoning', questions: 30, duration: 0, topics: ['Analogies', 'Coding-Decoding', 'Mathematical Operations', 'Relationships', 'Syllogism', 'Venn Diagrams', 'Data Interpretation', 'Puzzles', 'Data Sufficiency', 'Statement-Conclusion'] }
  ]},
  { id: 'SBI-PO-PRE', name: 'SBI PO Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
    { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Vocabulary', 'Fill in the Blanks', 'Word Swap'] },
    { name: 'Quantitative Aptitude', questions: 35, duration: 20, topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Simplification', 'Approximation', 'Profit and Loss', 'Time and Work', 'Time, Speed & Distance', 'Mixture & Allegation', 'Probability'] },
    { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities', 'Direction Sense', 'Order & Ranking', 'Input-Output'] }
  ]},
  { id: 'UPSC-PRE-GS1', name: 'UPSC Prelims GS Paper 1', duration: 120, options: 4, sectional: 0, marks_correct: 2.0, marks_incorrect: 0.66, sections: [
    { name: 'General Studies', questions: 100, duration: 120, topics: ['History of India', 'Indian and World Geography', 'Indian Polity and Governance', 'Economic and Social Development', 'General Issues on Environmental Ecology', 'General Science', 'Current Events'] }
  ]},
  { id: 'UPSC-MAINS-GS1', name: 'UPSC Mains GS Paper 1', duration: 180, options: 0, sectional: 0, marks_correct: 10.0, marks_incorrect: 0.0, sections: [
    { name: '10 Mark Questions', questions: 10, duration: 90, marks_correct: 10.0, topics: ['Indian Heritage and Culture', 'History of the World and Society', 'Geography of the World'] },
    { name: '15 Mark Questions', questions: 10, duration: 90, marks_correct: 15.0, topics: ['Indian Heritage and Culture', 'History of the World and Society', 'Geography of the World'] }
  ]},
  { id: 'IBPS-PO-MAINS-DESC', name: 'IBPS PO Mains Descriptive', duration: 30, options: 0, sectional: 1, marks_correct: 15.0, marks_incorrect: 0.0, sections: [
    { name: 'Essay Writing', questions: 1, duration: 15, marks_correct: 15.0, topics: ['Current Social Issues', 'Economy and Banking', 'Technology'] },
    { name: 'Letter Writing', questions: 1, duration: 15, marks_correct: 10.0, topics: ['Formal Letter to Editor', 'Bank Manager Letter', 'Complaint Letter'] }
  ]},
  { id: 'IBPS-CLERK-MAINS-DESC', name: 'IBPS Clerk Mains Descriptive', duration: 30, options: 0, sectional: 1, marks_correct: 15.0, marks_incorrect: 0.0, sections: [
    { name: 'Essay Writing', questions: 1, duration: 15, marks_correct: 15.0, topics: ['Current Social Issues', 'Economy and Banking', 'Technology'] },
    { name: 'Letter Writing', questions: 1, duration: 15, marks_correct: 10.0, topics: ['Formal Letter to Editor', 'Bank Manager Letter', 'Complaint Letter'] }
  ]}
];

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS blueprints');
  db.run(`
    CREATE TABLE blueprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id TEXT NOT NULL,
      exam_name TEXT NOT NULL,
      total_duration INTEGER NOT NULL,
      options_count INTEGER DEFAULT 4,
      has_sectional_timing BOOLEAN DEFAULT 0,
      marks_correct REAL DEFAULT 1.0,
      marks_incorrect REAL DEFAULT 0.25,
      sections TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const stmt = db.prepare('INSERT INTO blueprints (exam_id, exam_name, total_duration, options_count, has_sectional_timing, marks_correct, marks_incorrect, sections) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  seedExams.forEach(ex => {
    stmt.run(ex.id, ex.name, ex.duration, ex.options, ex.sectional, ex.marks_correct, ex.marks_incorrect, JSON.stringify(ex.sections));
  });
  stmt.finalize();
  console.log('Successfully dropped old table and generated all 7 exams with dynamic marking!');
});
