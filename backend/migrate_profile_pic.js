const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'unmocked.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`ALTER TABLE users ADD COLUMN profile_pic TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('Column profile_pic already exists.');
      } else {
        console.error('Error adding column:', err.message);
      }
    } else {
      console.log('Successfully added profile_pic column to users table.');
    }
    db.close();
  });
});
