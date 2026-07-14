const sqlite3 = require('sqlite3').verbose(); 
const db = new sqlite3.Database('unmocked.db'); 
db.serialize(() => { 
  db.run('DROP TABLE IF EXISTS active_test_sessions'); 
  db.run(`CREATE TABLE active_test_sessions (
    session_id TEXT, 
    user_id INTEGER NOT NULL, 
    answers TEXT NOT NULL DEFAULT '{}', 
    status_map TEXT NOT NULL DEFAULT '{}', 
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, 
    PRIMARY KEY (session_id, user_id), 
    FOREIGN KEY (user_id) REFERENCES users(id))`); 
  console.log('Recreated table'); 
});
