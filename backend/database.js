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
        profile_pic TEXT,
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
        exam_id TEXT,
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
        time_spent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // In case the table already exists from a previous migration, try to add the columns safely
    db.run('ALTER TABLE test_results ADD COLUMN exam_id TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN test_session_id TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN answers TEXT', (err) => {});
    db.run('ALTER TABLE test_results ADD COLUMN time_spent TEXT', (err) => {});
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

    db.run(`
      CREATE TABLE IF NOT EXISTS saved_test_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        exam_name TEXT NOT NULL,
        game_mode TEXT NOT NULL DEFAULT 'Solo-Real',
        test_data TEXT NOT NULL,
        answers TEXT NOT NULL DEFAULT '{}',
        status_map TEXT NOT NULL DEFAULT '{}',
        time_left INTEGER NOT NULL DEFAULT 0,
        current_section INTEGER NOT NULL DEFAULT 0,
        current_question INTEGER NOT NULL DEFAULT 0,
        time_spent_map TEXT NOT NULL DEFAULT '{}',
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    db.run(`
      CREATE TABLE IF NOT EXISTS daily_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        exam_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, exam_name)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        tag TEXT,
        is_completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Friends and Messaging Migrations
    db.run(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id_1 INTEGER NOT NULL,
        user_id_2 INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id_1) REFERENCES users (id),
        FOREIGN KEY (user_id_2) REFERENCES users (id),
        UNIQUE(user_id_1, user_id_2)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        file_type TEXT,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (receiver_id) REFERENCES users (id)
      )
    `);

    // Migration for file columns in private_messages
    db.run("ALTER TABLE private_messages ADD COLUMN file_url TEXT", (err) => {
      if (err && !err.message.includes("duplicate column name")) console.error("Migration error file_url:", err.message);
    });
    db.run("ALTER TABLE private_messages ADD COLUMN file_name TEXT", (err) => {
      if (err && !err.message.includes("duplicate column name")) console.error("Migration error file_name:", err.message);
    });
    db.run("ALTER TABLE private_messages ADD COLUMN file_type TEXT", (err) => {
      if (err && !err.message.includes("duplicate column name")) console.error("Migration error file_type:", err.message);
    });
  }
});

module.exports = db;
