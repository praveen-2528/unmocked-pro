const fs = require('fs');

let c = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

// 1. Add state variables for new tabs
const stateVars = `
  const [systemInfo, setSystemInfo] = useState(null);
  const [rooms, setRooms] = useState({});
  const [tests, setTests] = useState([]);
`;

c = c.replace('const [users, setUsers] = useState([]);', 'const [users, setUsers] = useState([]);\n' + stateVars);

// 2. Add fetch logic for new tabs
const fetchVars = `
  const fetchSystemInfo = async () => {
    try {
      const res = await fetch('/api/admin/system', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setSystemInfo(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/admin/rooms', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setRooms(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchTests = async () => {
    try {
      const res = await fetch('/api/admin/tests', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setTests(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleDeleteTest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this test result?')) return;
    try {
      const res = await fetch(\`/api/admin/tests/\${id}\`, { method: 'DELETE', headers: { 'x-user-id': currentUser.id } });
      if (res.ok) fetchTests();
    } catch (err) { console.error(err); }
  };
`;

c = c.replace('const fetchUsers = async () => {', fetchVars + '\n  const fetchUsers = async () => {');

// 3. Update handleTabChange
const handleTabChangeOld = `  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'users') fetchUsers();
    else fetchBlueprints();
  };`;

const handleTabChangeNew = `  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'users') fetchUsers();
    else if (tab === 'blueprints') fetchBlueprints();
    else if (tab === 'system') fetchSystemInfo();
    else if (tab === 'rooms') fetchRooms();
    else if (tab === 'tests') fetchTests();
  };`;

c = c.replace(handleTabChangeOld, handleTabChangeNew);

// 4. Update Navigation Buttons
const navButtonsOld = `<div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
          <button className={\`btn \${activeTab === 'blueprints' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('blueprints')}>
            <Settings size={18} /> Blueprints
          </button>
          <button className={\`btn \${activeTab === 'users' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('users')}>
            <Users size={18} /> Users
          </button>
        </div>`;

const navButtonsNew = `<div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button className={\`btn \${activeTab === 'blueprints' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('blueprints')}>
            <Settings size={18} /> Blueprints
          </button>
          <button className={\`btn \${activeTab === 'users' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('users')}>
            <Users size={18} /> Users
          </button>
          <button className={\`btn \${activeTab === 'tests' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('tests')}>
            <Settings size={18} /> User Tests
          </button>
          <button className={\`btn \${activeTab === 'rooms' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('rooms')}>
            <Users size={18} /> Live Rooms
          </button>
          <button className={\`btn \${activeTab === 'system' ? 'btn-primary' : 'btn-glass'}\`} onClick={() => handleTabChange('system')}>
            <Settings size={18} /> System Info
          </button>
        </div>`;

c = c.replace(navButtonsOld, navButtonsNew);

// 5. Add UI for new tabs (append before the closing </main>)
const newTabsUI = `
        {/* User Tests Content */}
        {activeTab === 'tests' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Global User Tests</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '12px' }}>ID</th>
                    <th style={{ padding: '12px' }}>User</th>
                    <th style={{ padding: '12px' }}>Exam</th>
                    <th style={{ padding: '12px' }}>Score</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{t.id}</td>
                      <td style={{ padding: '12px' }}>{t.user_name} ({t.user_email})</td>
                      <td style={{ padding: '12px' }}>{t.exam_name} ({t.game_mode})</td>
                      <td style={{ padding: '12px' }}>{t.score} / {t.total_questions}</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => window.open(\`/test/\${t.id}/result\`, '_blank')}>View</button>
                        <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--danger-color)' }} onClick={() => handleDeleteTest(t.id)}><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                  {tests.length === 0 && <tr><td colSpan="5" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tests found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Rooms Content */}
        {activeTab === 'rooms' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Live Multiplayer Rooms</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.entries(rooms).map(([code, room]) => (
                <div key={code} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-color)' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Room: {code}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Exam:</strong> {room.exam_name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Status:</strong> {room.is_started ? 'Started' : 'Waiting...'}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <strong>Players:</strong> {room.players.length}
                  </div>
                </div>
              ))}
              {Object.keys(rooms).length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No live rooms currently.</p>}
            </div>
          </div>
        )}

        {/* System Info Content */}
        {activeTab === 'system' && systemInfo && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>System Diagnostics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Platform</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.platform}</div>
              </div>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Uptime</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.uptime}</div>
              </div>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Memory (Free / Total)</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.freeMem} / {systemInfo.totalMem}</div>
              </div>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>CPU</h4>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.cpuModel} ({systemInfo.cpuCount} Cores)</div>
              </div>
              <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Load Average</h4>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.loadAvg.map(l => l.toFixed(2)).join(', ')}</div>
              </div>
            </div>
          </div>
        )}
`;

c = c.replace('      </div>\n    </main>', newTabsUI + '\n      </div>\n    </main>');

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', c);
console.log("Updated AdminDashboard.jsx");
