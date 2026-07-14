const fs = require('fs');
let c = fs.readFileSync('backend/server.js', 'utf8');

if (!c.includes('/api/admin/system')) {
    const adminApis = `
  // --- New Admin Apis ---
  app.get('/api/admin/system', isAdmin, (req, res) => {
    const os = require('os');
    const systemInfo = {
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0].model,
      totalMem: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      freeMem: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      uptime: (os.uptime() / 3600).toFixed(2) + ' Hours',
      platform: os.platform(),
      loadAvg: os.loadavg()
    };
    res.json(systemInfo);
  });

  app.get('/api/admin/rooms', isAdmin, (req, res) => {
    // rooms is a global object in server.js
    res.json(rooms);
  });

  app.get('/api/admin/tests', isAdmin, (req, res) => {
    db.all(\`
      SELECT tr.id, tr.exam_name, tr.game_mode, tr.score, tr.total_questions, tr.created_at, u.name as user_name, u.email as user_email
      FROM test_results tr
      JOIN users u ON tr.user_id = u.id
      ORDER BY tr.created_at DESC
    \`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });

  app.delete('/api/admin/tests/:id', isAdmin, (req, res) => {
    db.run('DELETE FROM test_results WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true, deleted: this.changes });
    });
  });
`;

    // Inject before the "Password Reset Generation" route
    const hook = "// Password Reset Generation";
    c = c.replace(hook, adminApis + "\n\n" + hook);
    fs.writeFileSync('backend/server.js', c);
    console.log("Added admin APIs to server.js");
}
