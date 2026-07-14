const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'unmocked.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, async (err) => {
      if (!err) {
        db.get('SELECT * FROM users WHERE email = ?', ['admin@unmocked.com'], async (err, row) => {
          if (!row) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash('admin123', salt);
            db.run('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)', ['System Admin', 'admin@unmocked.com', hash, 1]);
          }
        });
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS blueprints (
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
    `, (err) => {
      if (!err) {
        // Seed default exams if empty
        db.get('SELECT COUNT(*) as count FROM blueprints', (err, row) => {
          if (row && row.count === 0) {
            const seedExams = [
              { id: 'SSC-CGL-T1', name: 'SSC CGL Tier 1', duration: 60, options: 4, sectional: 1, marks_correct: 2.0, marks_incorrect: 0.5, sections: [
                { name: 'General Intelligence', questions: 25, duration: 15, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series', 'Venn Diagrams', 'Non-Verbal Reasoning'] },
                { name: 'General Awareness', questions: 25, duration: 15, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Static GK'] },
                { name: 'Quantitative Aptitude', questions: 25, duration: 15, topics: ['Algebra', 'Geometry', 'Trigonometry', 'Data Interpretation', 'Profit and Loss', 'Time and Work', 'Percentages'] },
                { name: 'English Comprehension', questions: 25, duration: 15, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Idioms & Phrases', 'Synonyms & Antonyms'] }
              ]},
              { id: 'SSC-CHSL-T1', name: 'SSC CHSL Tier 1', duration: 60, options: 4, sectional: 1, marks_correct: 2.0, marks_incorrect: 0.5, sections: [
                { name: 'English Language', questions: 25, duration: 15, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Idioms & Phrases'] },
                { name: 'General Intelligence', questions: 25, duration: 15, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series'] },
                { name: 'Quantitative Aptitude', questions: 25, duration: 15, topics: ['Algebra', 'Geometry', 'Trigonometry', 'Data Interpretation', 'Profit and Loss', 'Time and Work'] },
                { name: 'General Awareness', questions: 25, duration: 15, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science'] }
              ]},
              { id: 'SSC-STENO', name: 'SSC Stenographer Grade C & D', duration: 120, options: 4, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
                { name: 'General Intelligence & Reasoning', questions: 50, duration: 30, topics: ['Analogies', 'Blood Relations', 'Syllogism', 'Coding-Decoding', 'Number Series', 'Direction Sense', 'Venn Diagrams'] },
                { name: 'General Awareness', questions: 50, duration: 30, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Static GK'] },
                { name: 'English Language & Comprehension', questions: 100, duration: 60, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles', 'Active & Passive Voice'] }
              ]},
              { id: 'IBPS-PO-PRE', name: 'IBPS PO Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
                { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles'] },
                { name: 'Quantitative Aptitude', questions: 35, duration: 20, topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Simplification', 'Profit and Loss', 'Time and Work'] },
                { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities'] }
              ]},
              { id: 'IBPS-CLERK-PRE', name: 'IBPS Clerk Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
                { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles'] },
                { name: 'Numerical Ability', questions: 35, duration: 20, topics: ['Simplification', 'Number Series', 'Data Interpretation', 'Profit and Loss', 'Time and Work', 'Percentages'] },
                { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities'] }
              ]},
              { id: 'RRB-NTPC-CBT1', name: 'RRB NTPC CBT 1', duration: 90, options: 4, sectional: 0, marks_correct: 1.0, marks_incorrect: 0.33, sections: [
                { name: 'General Awareness', questions: 40, duration: 0, topics: ['Current Affairs', 'History', 'Geography', 'Indian Polity', 'Economics', 'General Science', 'Sports'] },
                { name: 'Mathematics', questions: 30, duration: 0, topics: ['Number System', 'Decimals', 'Fractions', 'LCM and HCF', 'Ratio and Proportions', 'Percentage', 'Mensuration', 'Time and Work'] },
                { name: 'General Intelligence and Reasoning', questions: 30, duration: 0, topics: ['Analogies', 'Coding-Decoding', 'Mathematical Operations', 'Relationships', 'Syllogism', 'Venn Diagrams', 'Data Interpretation'] }
              ]},
              { id: 'SBI-PO-PRE', name: 'SBI PO Prelims', duration: 60, options: 5, sectional: 1, marks_correct: 1.0, marks_incorrect: 0.25, sections: [
                { name: 'English Language', questions: 30, duration: 20, topics: ['Reading Comprehension', 'Cloze Test', 'Error Spotting', 'Sentence Improvement', 'Para Jumbles'] },
                { name: 'Quantitative Aptitude', questions: 35, duration: 20, topics: ['Data Interpretation', 'Number Series', 'Quadratic Equations', 'Simplification', 'Profit and Loss', 'Time and Work'] },
                { name: 'Reasoning Ability', questions: 35, duration: 20, topics: ['Puzzles', 'Seating Arrangement', 'Syllogism', 'Blood Relations', 'Coding-Decoding', 'Inequalities'] }
              ]}
            ];

            const stmt = db.prepare('INSERT INTO blueprints (exam_id, exam_name, total_duration, options_count, has_sectional_timing, marks_correct, marks_incorrect, sections) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            seedExams.forEach(ex => {
              stmt.run(ex.id, ex.name, ex.duration, ex.options, ex.sectional, ex.marks_correct, ex.marks_incorrect, JSON.stringify(ex.sections));
            });
            stmt.finalize();
            console.log('Seeded 7 standard exam blueprints with dynamic marking.');
          }
        });
      }
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        test_session_id TEXT,
        exam_name TEXT NOT NULL,
        game_mode TEXT NOT NULL,
        score REAL NOT NULL,
        total_questions INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        incorrect INTEGER NOT NULL,
        unattempted INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        answers TEXT,
        status_map TEXT,
        test_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // In case the table already exists from a previous migration, try to add the columns safely
    db.run('ALTER TABLE test_results ADD COLUMN test_session_id TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN answers TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN status_map TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN test_data TEXT', (err) => {});

    // Gamification Migrations
    db.run('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0', (err) => {});
    
    db.run(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        badge_key TEXT NOT NULL,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, badge_key)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS active_test_sessions (
        session_id TEXT,
        user_id INTEGER NOT NULL,
        answers TEXT NOT NULL DEFAULT '{}',
        status_map TEXT NOT NULL DEFAULT '{}',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Study Rooms Migrations
    db.run(`
      CREATE TABLE IF NOT EXISTS study_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        join_code TEXT UNIQUE NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS study_group_members (
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES study_groups (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS study_group_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES study_groups (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS study_group_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        test_id TEXT NOT NULL,
        test_data TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES study_groups (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS study_group_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        doc_url TEXT NOT NULL,
        doc_name TEXT NOT NULL,
        is_file BOOLEAN DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES study_groups (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        user_id INTEGER NOT NULL,
        endpoint TEXT PRIMARY KEY,
        keys TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
  }
});

module.exports = db;
