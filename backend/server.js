const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./database');
const webpush = require('web-push');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Setup uploads directory for documents
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Configure web-push with VAPID keys
// In production, these should be in .env. We use the generated ones for this session.
const publicVapidKey = 'BN0jG5zg31oq_z1VUNF2cxxbiMjOhn6NauLUS04otWfVRBRmBZHtftEGbTrqT1JCU9dsmseHjZjSy60LB4No84E';
const privateVapidKey = 'xyQY0UEiOI3ziapUQ1QLcBaNoh4Tw0QQXq9uG3_cRUI';
webpush.setVapidDetails('mailto:admin@unmocked.com', publicVapidKey, privateVapidKey);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.send('UnMocked API is running');
});

// Authentication Endpoints
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'User created successfully', userId: this.lastID });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return simple token/user data (for MVP)
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin === 1 || user.is_admin === true
      }
    });
  });
});

// --- Admin Middleware ---
const isAdmin = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  db.get('SELECT is_admin FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user || !user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    next();
  });
};

// --- Admin Endpoints ---

// Blueprints CRUD
app.get('/api/admin/blueprints', isAdmin, (req, res) => {
  db.all('SELECT * FROM blueprints ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const parsed = rows.map(r => ({
      ...r,
      has_sectional_timing: r.has_sectional_timing === 1,
      sections: r.sections ? JSON.parse(r.sections) : []
    }));
    res.json(parsed);
  });
});

app.post('/api/admin/blueprints', isAdmin, (req, res) => {
  const { exam_id, exam_name, total_duration, options_count, has_sectional_timing, sections } = req.body;
  db.run(
    'INSERT INTO blueprints (exam_id, exam_name, total_duration, options_count, has_sectional_timing, sections) VALUES (?, ?, ?, ?, ?, ?)',
    [exam_id, exam_name, total_duration, options_count, has_sectional_timing ? 1 : 0, JSON.stringify(sections || [])],
    function(err) {
      if (err) { console.error(err.message); return res.status(500).json({ error: err.message }); }
      res.status(201).json({ message: 'Blueprint created', id: this.lastID });
    }
  );
});

app.put('/api/admin/blueprints/:id', isAdmin, (req, res) => {
  const { exam_id, exam_name, total_duration, options_count, has_sectional_timing, sections } = req.body;
  db.run(
    'UPDATE blueprints SET exam_id = ?, exam_name = ?, total_duration = ?, options_count = ?, has_sectional_timing = ?, sections = ? WHERE id = ?',
    [exam_id, exam_name, total_duration, options_count, has_sectional_timing ? 1 : 0, JSON.stringify(sections || []), req.params.id],
    function(err) {
      if (err) { console.error(err.message); return res.status(500).json({ error: err.message }); }
      res.json({ message: 'Blueprint updated' });
    }
  );
});

app.delete('/api/admin/blueprints/:id', isAdmin, (req, res) => {
  db.run('DELETE FROM blueprints WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Blueprint deleted' });
  });
});

// Users Management
app.get('/api/admin/users', isAdmin, (req, res) => {
  db.all('SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Password Reset Generation
app.post('/api/admin/reset-token', isAdmin, (req, res) => {
  const { target_user_id } = req.body;
  const token = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.run('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [target_user_id, token, expiresAt], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({ message: 'Token generated', token });
  });
});

// Public Blueprints (for students)
app.get('/api/blueprints', (req, res) => {
  db.all('SELECT * FROM blueprints ORDER BY exam_name ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const parsed = rows.map(r => ({
      ...r,
      has_sectional_timing: r.has_sectional_timing === 1,
      sections: r.sections ? JSON.parse(r.sections) : []
    }));
    res.json(parsed);
  });
});

app.get('/api/active-rooms', (req, res) => {
  const activeRooms = Object.values(rooms)
    .filter(r => r.state === 'LOBBY')
    .map(r => ({
      code: r.code,
      hostName: r.host.name,
      mode: r.mode,
      examName: r.testData?.blueprint?.exam_name || 'Multiplayer Exam',
      playersCount: 1 + r.guests.length
    }));
  res.json(activeRooms);
});

// Push Notifications Endpoints
app.post('/api/subscribe', (req, res) => {
  const { user_id, subscription } = req.body;
  if (!user_id || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription data' });
  }

  const { endpoint, keys } = subscription;
  
  // Upsert subscription
  db.get('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (row) {
      db.run('UPDATE push_subscriptions SET user_id = ?, keys = ? WHERE endpoint = ?', [user_id, JSON.stringify(keys), endpoint]);
    } else {
      db.run('INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES (?, ?, ?)', [user_id, endpoint, JSON.stringify(keys)]);
    }
    res.status(201).json({ message: 'Subscription saved' });
  });
});

app.get('/api/vapidPublicKey', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

// Test Results Endpoints
app.post('/api/test-session/update', (req, res) => {
  const { session_id, user_id, answers, status_map } = req.body;
  if (!session_id || !user_id) return res.status(400).json({ error: 'Missing required fields' });

  db.run(
    'INSERT INTO active_test_sessions (session_id, user_id, answers, status_map, last_updated) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET answers=excluded.answers, status_map=excluded.status_map, last_updated=CURRENT_TIMESTAMP',
    [session_id, user_id, JSON.stringify(answers || {}), JSON.stringify(status_map || {})],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.status(200).json({ message: 'Session updated' });
    }
  );
});

app.get('/api/test-session/:sessionId', (req, res) => {
  db.get('SELECT * FROM active_test_sessions WHERE session_id = ?', [req.params.sessionId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Session not found' });
    res.json({
      answers: JSON.parse(row.answers),
      status_map: JSON.parse(row.status_map)
    });
  });
});

app.post('/api/test-results', (req, res) => {
  const { user_id, test_session_id, exam_name, game_mode, score, total_questions, correct, incorrect, unattempted, accuracy } = req.body;
  if (!user_id || !exam_name || !game_mode || !test_session_id) return res.status(400).json({ error: 'Missing required fields' });
  
  db.get('SELECT id FROM test_results WHERE test_session_id = ?', [test_session_id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(200).json({ message: 'Result already saved', id: row.id });

    db.run(
      'INSERT INTO test_results (user_id, test_session_id, exam_name, game_mode, score, total_questions, correct, incorrect, unattempted, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, test_session_id, exam_name, game_mode, score, total_questions, correct, incorrect, unattempted, accuracy],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        // Cleanup active session
        db.run('DELETE FROM active_test_sessions WHERE session_id = ?', [test_session_id]);
        
        res.status(201).json({ message: 'Test result saved', id: this.lastID });
      }
    );
  });
});

app.get('/api/test-results/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all('SELECT * FROM test_results WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// --- Study Groups Helpers ---
const sendPushNotificationToGroup = (groupId, payload, excludeUserId = null) => {
  db.all(
    `SELECT p.endpoint, p.keys, p.user_id 
     FROM push_subscriptions p
     JOIN study_group_members m ON p.user_id = m.user_id
     WHERE m.group_id = ? AND p.user_id != ?`,
    [groupId, excludeUserId || 0],
    (err, subscriptions) => {
      if (err || !subscriptions) return;
      subscriptions.forEach(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: JSON.parse(sub.keys)
        };
        webpush.sendNotification(pushSubscription, JSON.stringify(payload))
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
            }
          });
      });
    }
  );
};

// --- Study Groups APIs ---
app.post('/api/study-groups', (req, res) => {
  const { name, description, user_id } = req.body;
  const join_code = Math.random().toString(36).substr(2, 6).toUpperCase();
  
  db.run(
    'INSERT INTO study_groups (name, description, join_code, created_by) VALUES (?, ?, ?, ?)',
    [name, description, join_code, user_id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      const groupId = this.lastID;
      
      db.run('INSERT INTO study_group_members (group_id, user_id) VALUES (?, ?)', [groupId, user_id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Database error joining group' });
        res.status(201).json({ message: 'Group created', group_id: groupId, join_code });
      });
    }
  );
});

app.post('/api/study-groups/join', (req, res) => {
  const { join_code, user_id } = req.body;
  db.get('SELECT id, name FROM study_groups WHERE join_code = ?', [join_code.toUpperCase()], (err, group) => {
    if (err || !group) return res.status(404).json({ error: 'Invalid join code' });
    
    db.run('INSERT INTO study_group_members (group_id, user_id) VALUES (?, ?)', [group.id, user_id], function(err2) {
      if (err2) {
        if (err2.message.includes('UNIQUE constraint failed')) return res.status(400).json({ error: 'Already a member' });
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(200).json({ message: 'Joined successfully', group_id: group.id, name: group.name });
    });
  });
});

app.get('/api/study-groups/user/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all(
    `SELECT g.id, g.name, g.description, g.join_code, g.created_by, (SELECT COUNT(*) FROM study_group_members WHERE group_id = g.id) as member_count 
     FROM study_groups g 
     JOIN study_group_members m ON g.id = m.group_id 
     WHERE m.user_id = ? ORDER BY g.created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    }
  );
});

app.get('/api/study-groups/:groupId/details', (req, res) => {
  const groupId = req.params.groupId;
  const result = { group: null, members: [], messages: [], docs: [], tests: [] };
  
  db.get('SELECT * FROM study_groups WHERE id = ?', [groupId], (err, group) => {
    if (!group) return res.status(404).json({ error: 'Not found' });
    result.group = group;
    
    db.all('SELECT u.id, u.name FROM users u JOIN study_group_members m ON u.id = m.user_id WHERE m.group_id = ?', [groupId], (err, members) => {
      result.members = members || [];
      db.all('SELECT d.*, u.name as user_name FROM study_group_docs d JOIN users u ON d.created_by = u.id WHERE d.group_id = ? ORDER BY d.created_at DESC', [groupId], (err, docs) => {
        result.docs = docs || [];
        db.all('SELECT t.*, u.name as user_name FROM study_group_tests t JOIN users u ON t.created_by = u.id WHERE t.group_id = ? ORDER BY t.created_at DESC', [groupId], (err, tests) => {
          result.tests = tests || [];
          db.all('SELECT m.*, u.name as user_name FROM study_group_messages m JOIN users u ON m.user_id = u.id WHERE m.group_id = ? ORDER BY m.created_at ASC LIMIT 50', [groupId], (err, msgs) => {
            result.messages = msgs || [];
            res.json(result);
          });
        });
      });
    });
  });
});

app.post('/api/study-groups/:groupId/docs', upload.single('file'), (req, res) => {
  const groupId = req.params.groupId;
  const { user_id, doc_url, doc_name } = req.body;
  
  let finalUrl = doc_url;
  let finalName = doc_name;
  let isFile = 0;

  if (req.file) {
    finalUrl = `/uploads/${req.file.filename}`;
    finalName = req.file.originalname;
    isFile = 1;
  }

  db.run(
    'INSERT INTO study_group_docs (group_id, doc_url, doc_name, is_file, created_by) VALUES (?, ?, ?, ?, ?)',
    [groupId, finalUrl, finalName, isFile, user_id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      const newDoc = { id: this.lastID, group_id: groupId, doc_url: finalUrl, doc_name: finalName, is_file: isFile, created_by: user_id, created_at: new Date() };
      io.to('study_group_' + groupId).emit('newDoc', newDoc);
      
      db.get('SELECT name FROM users WHERE id = ?', [user_id], (err, user) => {
        sendPushNotificationToGroup(groupId, {
          title: 'New Document Shared',
          body: `${user ? user.name : 'Someone'} shared ${finalName} in your Study Room.`,
          url: `/dashboard?step=6&groupId=${groupId}` // Assuming step 6 will be study rooms
        }, user_id);
      });
      
      res.status(201).json(newDoc);
    }
  );
});

app.post('/api/study-groups/:groupId/tests', (req, res) => {
  const groupId = req.params.groupId;
  const { test_id, test_data, user_id, test_name } = req.body;
  
  db.run(
    'INSERT INTO study_group_tests (group_id, test_id, test_data, created_by) VALUES (?, ?, ?, ?)',
    [groupId, test_id, JSON.stringify(test_data), user_id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      const newTest = { id: this.lastID, group_id: groupId, test_id, test_data: JSON.stringify(test_data), created_by: user_id, created_at: new Date() };
      io.to('study_group_' + groupId).emit('newTest', newTest);
      
      db.get('SELECT name FROM users WHERE id = ?', [user_id], (err, user) => {
        sendPushNotificationToGroup(groupId, {
          title: 'New Test Shared',
          body: `${user ? user.name : 'Someone'} created a new mock test in your Study Room!`,
          url: `/dashboard?step=6&groupId=${groupId}`
        }, user_id);
      });
      
      res.status(201).json(newTest);
    }
  );
});

const rooms = {};

const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ user, testData, mode }) => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      host: { socketId: socket.id, connected: true, ...user },
      guests: [],
      testData,
      mode, // 'Multiplayer-Real' | 'Multiplayer-Friendly'
      state: 'LOBBY', // 'LOBBY', 'PLAYING', 'FINISHED'
      currentQuestionIndex: 0,
      currentSectionIndex: 0,
      answersSubmitted: {}, // tracking who submitted for the current friendly question
      stats: {
        [user.id]: { name: user.name, attempted: 0, skipped: 0, right: 0, wrong: 0, accuracy: 0, score: 0, timeTaken: 0 }
      }
    };
    socket.join(code);
    socket.emit('roomCreated', rooms[code]);
  });

  socket.on('joinRoom', ({ code, user }) => {
    if (!rooms[code]) return socket.emit('roomError', 'Room not found');

    const exists = rooms[code].guests.find(g => g.id === user.id) || rooms[code].host.id === user.id;

    if (!exists) {
      rooms[code].guests.push({ socketId: socket.id, connected: true, ...user });
      rooms[code].stats[user.id] = { name: user.name, attempted: 0, skipped: 0, right: 0, wrong: 0, accuracy: 0, score: 0, timeTaken: 0 };
    } else if (rooms[code].host.id === user.id) {
       rooms[code].host.socketId = socket.id;
       rooms[code].host.connected = true;
    } else {
       const guest = rooms[code].guests.find(g => g.id === user.id);
       if (guest) {
         guest.socketId = socket.id;
         guest.connected = true;
       }
    }
    
    socket.join(code);
    
    if (rooms[code].state === 'LOBBY') {
      io.to(code).emit('roomUpdated', rooms[code]);
    } else {
      socket.emit('gameStarted', rooms[code]);
      io.to(code).emit('statsUpdated', rooms[code].stats);
      
      if (rooms[code].mode.endsWith('Friendly')) {
        socket.emit('friendlyNextQuestion', { 
           secIdx: rooms[code].currentSectionIndex, 
           qIdx: rooms[code].currentQuestionIndex 
        });
        
        const totalPlayers = (rooms[code].host.connected ? 1 : 0) + rooms[code].guests.filter(g => g.connected).length;
        io.to(code).emit('friendlySubmissionCount', Object.keys(rooms[code].answersSubmitted).length, totalPlayers);
        
        if (totalPlayers > 0 && Object.keys(rooms[code].answersSubmitted).length >= totalPlayers) {
          socket.emit('friendlyReveal', rooms[code].answersSubmitted);
        } else if (rooms[code].answersSubmitted[user.id]) {
          const qId = rooms[code].testData.sections[rooms[code].currentSectionIndex].questions[rooms[code].currentQuestionIndex].id;
          socket.emit('friendlyRejoinWaiting', { ans: rooms[code].answersSubmitted[user.id], qId });
        }
      }
    }
  });

  socket.on('updateName', ({ code, userId, newName }) => {
    if (rooms[code]) {
      let updated = false;
      if (rooms[code].host.id === userId) {
        rooms[code].host.name = newName;
        updated = true;
      } else {
        const guest = rooms[code].guests.find(g => g.id === userId);
        if (guest) {
          guest.name = newName;
          updated = true;
        }
      }
      if (updated) {
        io.to(code).emit('roomUpdated', rooms[code]);
      }
    }
  });

  socket.on('leaveRoom', ({ code, userId }) => {
    if (rooms[code]) {
      rooms[code].guests = rooms[code].guests.filter(g => g.id !== userId);
      io.to(code).emit('roomUpdated', rooms[code]);
      socket.leave(code);
    }
  });

  socket.on('closeRoom', ({ code }) => {
    if (rooms[code]) {
      io.to(code).emit('roomClosed');
      delete rooms[code];
    }
  });

  socket.on('transferHost', ({ code, targetUserId }) => {
    if (rooms[code]) {
      const newHostIndex = rooms[code].guests.findIndex(g => g.id === targetUserId);
      if (newHostIndex !== -1) {
        const newHost = rooms[code].guests[newHostIndex];
        const oldHost = rooms[code].host;
        
        rooms[code].host = newHost;
        rooms[code].guests.splice(newHostIndex, 1);
        rooms[code].guests.push(oldHost);
        
        io.to(code).emit('roomUpdated', rooms[code]);
      }
    }
  });

  socket.on('startGame', ({ code }) => {
    if (rooms[code]) {
      rooms[code].state = 'PLAYING';
      io.to(code).emit('gameStarted', rooms[code]);
    }
  });

  socket.on('beginTestForAll', ({ code }) => {
    if (rooms[code]) {
      io.to(code).emit('multiplayerTestStarted');
    }
  });

  socket.on('submitStats', ({ code, userId, statsUpdate }) => {
    if (rooms[code] && rooms[code].stats[userId]) {
      rooms[code].stats[userId] = { ...rooms[code].stats[userId], ...statsUpdate };
      io.to(code).emit('statsUpdated', rooms[code].stats);
    }
  });

  const getRoomStatusData = (room) => {
    const users = [];
    if (room.host.connected) {
      users.push({ id: room.host.id, name: room.host.name, isHost: true, submitted: room.answersSubmitted[room.host.id] });
    }
    room.guests.forEach(g => {
      if (g.connected) {
        users.push({ id: g.id, name: g.name, isHost: false, submitted: room.answersSubmitted[g.id] });
      }
    });
    return users;
  };

  socket.on('friendlySubmit', ({ code, userId, answer, timeTaken }) => {
    if (!rooms[code]) {
      return socket.emit('roomError', 'Room no longer exists (server might have restarted). Please create a new room.');
    }
    const room = rooms[code];
    room.answersSubmitted[userId] = { answer, timeTaken };
    const totalPlayers = (room.host.connected ? 1 : 0) + room.guests.filter(g => g.connected).length;
    
    io.to(code).emit('friendlyStatusUpdate', getRoomStatusData(room));
    io.to(code).emit('friendlySubmissionCount', Object.keys(room.answersSubmitted).length, totalPlayers);
    
    if (totalPlayers > 0 && Object.keys(room.answersSubmitted).length >= totalPlayers) {
      io.to(code).emit('friendlyReveal', room.answersSubmitted);
    }
  });

  socket.on('friendlyNext', ({ code, secIdx, qIdx }) => {
    if (!rooms[code]) {
      return socket.emit('roomError', 'Room no longer exists. Please create a new room.');
    }
    rooms[code].currentSectionIndex = secIdx;
    rooms[code].currentQuestionIndex = qIdx;
    rooms[code].answersSubmitted = {};
    io.to(code).emit('friendlyNextQuestion', { secIdx, qIdx });
    io.to(code).emit('friendlyStatusUpdate', getRoomStatusData(rooms[code]));
  });

  socket.on('friendlyForceReveal', ({ code }) => {
    if (!rooms[code]) {
      return socket.emit('roomError', 'Room no longer exists. Please create a new room.');
    }
    io.to(code).emit('friendlyReveal', rooms[code].answersSubmitted);
  });

  socket.on('friendlySkipAll', ({ code }) => {
    if (!rooms[code]) return;
    const room = rooms[code];
    
    if (room.host.connected && !room.answersSubmitted[room.host.id]) {
      room.answersSubmitted[room.host.id] = { answer: '0', timeTaken: 0 };
    }
    room.guests.forEach(g => {
      if (g.connected && !room.answersSubmitted[g.id]) {
        room.answersSubmitted[g.id] = { answer: '0', timeTaken: 0 };
      }
    });
    
    io.to(code).emit('friendlyStatusUpdate', getRoomStatusData(room));
    const totalPlayers = (room.host.connected ? 1 : 0) + room.guests.filter(g => g.connected).length;
    io.to(code).emit('friendlySubmissionCount', Object.keys(room.answersSubmitted).length, totalPlayers);
    
    io.to(code).emit('friendlyReveal', room.answersSubmitted);
  });

  socket.on('chatMessage', ({ code, user, text }) => {
    if (rooms[code]) {
      io.to(code).emit('chatMessage', { user, text, timestamp: new Date() });
    }
  });

  socket.on('finishTest', ({ code, userId }) => {
    if (rooms[code]) {
      if (rooms[code].host.id === userId) {
        rooms[code].state = 'FINISHED';
        io.to(code).emit('testFinished');
      }
    }
  });

  // --- Study Group Sockets ---
  socket.on('joinStudyGroup', ({ groupId }) => {
    socket.join('study_group_' + groupId);
  });

  socket.on('studyGroupMessage', ({ groupId, userId, message }) => {
    db.run(
      'INSERT INTO study_group_messages (group_id, user_id, message) VALUES (?, ?, ?)',
      [groupId, userId, message],
      function(err) {
        if (err) return;
        
        db.get('SELECT name FROM users WHERE id = ?', [userId], (err, user) => {
          const newMsg = {
            id: this.lastID,
            group_id: groupId,
            user_id: userId,
            message,
            created_at: new Date(),
            user_name: user ? user.name : 'Unknown'
          };
          
          io.to('study_group_' + groupId).emit('studyGroupMessage', newMsg);
          
          // Send push notification to offline members
          sendPushNotificationToGroup(groupId, {
            title: `New Message from ${newMsg.user_name}`,
            body: message.length > 50 ? message.substring(0, 50) + '...' : message,
            url: `/dashboard?step=6&groupId=${groupId}`
          }, userId);
        });
      }
    );
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const code in rooms) {
      const room = rooms[code];
      let stateChanged = false;

      if (room.host.socketId === socket.id) {
        room.host.connected = false;
        stateChanged = true;
      }

      const guest = room.guests.find(g => g.socketId === socket.id);
      if (guest) {
        guest.connected = false;
        stateChanged = true;
      }

      if (stateChanged && room.state === 'PLAYING' && room.mode === 'Multiplayer-Friendly') {
        const totalPlayers = (room.host.connected ? 1 : 0) + room.guests.filter(g => g.connected).length;
        io.to(code).emit('friendlySubmissionCount', Object.keys(room.answersSubmitted).length, totalPlayers);
        
        if (totalPlayers > 0 && Object.keys(room.answersSubmitted).length >= totalPlayers) {
          io.to(code).emit('friendlyReveal', room.answersSubmitted);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
