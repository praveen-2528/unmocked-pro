import { useState, useEffect } from 'react';
import { Settings, Users, Key, Plus, Trash2, Edit3, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import RoomReview from '../components/RoomReview';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('blueprints'); 
  const [blueprints, setBlueprints] = useState([]);
  const [users, setUsers] = useState([]);

  const [systemInfo, setSystemInfo] = useState(null);
  const [rooms, setRooms] = useState({});
  const [historyRooms, setHistoryRooms] = useState([]);
  const [viewingRoomId, setViewingRoomId] = useState(null);
  const [tests, setTests] = useState([]);

  
  const defaultBpForm = { id: null, exam_id: '', exam_name: '', total_duration: 60, options_count: 4, has_sectional_timing: false, sections: [] };
  const [showBlueprintForm, setShowBlueprintForm] = useState(false);
  const [bpForm, setBpForm] = useState(defaultBpForm);

  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    if (!currentUser || !currentUser.is_admin) navigate('/');
    else fetchBlueprints();
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'system') fetchSystemInfo();
      else if (activeTab === 'rooms') fetchRooms();
      else if (activeTab === 'tests') fetchTests();
      else if (activeTab === 'history-rooms') fetchHistoryRooms();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);


  const fetchBlueprints = async () => {
    try {
      const res = await fetch('/api/admin/blueprints', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setBlueprints(await res.json());
    } catch (err) { console.error(err); }
  };

  
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

  const fetchHistoryRooms = async () => {
    try {
      const res = await fetch('/api/admin/history-rooms', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setHistoryRooms(await res.json());
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
      const res = await fetch(`/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'x-user-id': currentUser.id } });
      if (res.ok) fetchTests();
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: { 'x-user-id': currentUser.id } });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'users') fetchUsers();
    else if (tab === 'blueprints') fetchBlueprints();
    else if (tab === 'system') fetchSystemInfo();
    else if (tab === 'rooms') fetchRooms();
    else if (tab === 'tests') fetchTests();
    else if (tab === 'history-rooms') fetchHistoryRooms();
  };

  // Blueprint Form Logic
  const handleSaveBlueprint = async (e) => {
    e.preventDefault();
    const method = bpForm.id ? 'PUT' : 'POST';
    const url = bpForm.id ? `/api/admin/blueprints/${bpForm.id}` : '/api/admin/blueprints';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify(bpForm)
      });
      if (res.ok) {
        setShowBlueprintForm(false);
        setBpForm(defaultBpForm);
        fetchBlueprints();
      } else {
        const errorData = await res.json();
        alert(`Failed to save: ${errorData.error}`);
      }
    } catch (err) { 
      console.error(err);
      alert(`Network error: ${err.message}`);
    }
  };

  const handleDeleteBlueprint = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blueprint?')) return;
    try {
      const res = await fetch(`/api/admin/blueprints/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.id }
      });
      if (res.ok) fetchBlueprints();
    } catch (err) { console.error(err); }
  };

  const handleEditClick = (bp) => {
    setBpForm(bp);
    setShowBlueprintForm(true);
  };

  // Dynamic Section Builder Logic
  const handleAddSection = () => {
    setBpForm({ ...bpForm, sections: [...bpForm.sections, { name: '', questions: 0, duration: 0 }] });
  };
  const handleRemoveSection = (index) => {
    const newSections = [...bpForm.sections];
    newSections.splice(index, 1);
    setBpForm({ ...bpForm, sections: newSections });
  };
  const handleSectionChange = (index, field, value) => {
    const newSections = [...bpForm.sections];
    newSections[index][field] = value;
    setBpForm({ ...bpForm, sections: newSections });
  };

  // User Reset Logic
  const handleResetToken = async (target_user_id) => {
    try {
      const res = await fetch('/api/admin/reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ target_user_id })
      });
      const data = await res.json();
      if (res.ok) alert(`Reset Token Generated: ${data.token}`);
      else alert(data.error);
    } catch (err) { console.error(err); }
  };

  if (!currentUser.is_admin) return null;

  return (
    <main style={{ minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 className="geist-pixel" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent-color)' }}>Admin Panel</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage blueprints, users, and security.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => {
              window.open('/api/admin/database-backup?userId=' + currentUser.id, '_blank');
            }}>
              Download DB Backup
            </button>
            <button className="btn btn-glass" onClick={() => {
              useAuthStore.getState().logout();
              navigate('/');
            }}>Log Out</button>
          </div>
        </header>

        {viewingRoomId && <RoomReview sessionId={viewingRoomId} onBack={() => setViewingRoomId(null)} />}

                {/* Navigation */}
        <div style={{ display: viewingRoomId ? 'none' : 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'blueprints' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('blueprints')}>
            <Settings size={18} /> Blueprints
          </button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('users')}>
            <Users size={18} /> Users
          </button>
          <button className={`btn ${activeTab === 'tests' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('tests')}>
            <Settings size={18} /> User Tests
          </button>
          <button className={`btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('rooms')}>
            <Users size={18} /> Live Rooms
          </button>
          <button className={`btn ${activeTab === 'history-rooms' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('history-rooms')}>
            <Users size={18} /> Room Review
          </button>
          <button className={`btn ${activeTab === 'system' ? 'btn-primary' : 'btn-glass'}`} onClick={() => handleTabChange('system')}>
            <Settings size={18} /> System Info
          </button>
        </div>

        {/* Blueprints Content */}
        {!viewingRoomId && activeTab === 'blueprints' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="geist-pixel" style={{ fontSize: '1.5rem' }}>Exam Blueprints</h2>
              <button className="btn btn-primary" onClick={() => { setBpForm(defaultBpForm); setShowBlueprintForm(!showBlueprintForm); }}>
                {showBlueprintForm ? 'Cancel' : <><Plus size={18} /> Add Blueprint</>}
              </button>
            </div>

            {showBlueprintForm && (
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} onSubmit={handleSaveBlueprint}>
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="input-label">Exam ID</label>
                      <input type="text" className="input-field" value={bpForm.exam_id} onChange={e => setBpForm({...bpForm, exam_id: e.target.value})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="input-label">Exam Name</label>
                      <input type="text" className="input-field" value={bpForm.exam_name} onChange={e => setBpForm({...bpForm, exam_name: e.target.value})} required />
                    </div>
                  </div>
                  
                  <div>
                    <label className="input-label">Total Duration (mins)</label>
                    <input type="number" className="input-field" value={bpForm.total_duration} onChange={e => setBpForm({...bpForm, total_duration: Number(e.target.value)})} required />
                  </div>
                  <div>
                    <label className="input-label">Number of Options (per Q)</label>
                    <input type="number" className="input-field" value={bpForm.options_count} onChange={e => setBpForm({...bpForm, options_count: Number(e.target.value)})} required />
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <input type="checkbox" id="sectionalTiming" checked={bpForm.has_sectional_timing} onChange={e => setBpForm({...bpForm, has_sectional_timing: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <label htmlFor="sectionalTiming" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}>Enable Strict Sectional Timings</label>
                  </div>

                  {/* Dynamic Sections Builder */}
                  <div style={{ gridColumn: 'span 2', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Sections Layout</h3>
                      <button type="button" className="btn btn-glass" onClick={handleAddSection} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                        <Plus size={14} /> Add Section
                      </button>
                    </div>
                    
                    {bpForm.sections.map((sec, i) => (
                      <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ flex: 2 }}>
                          <label className="input-label" style={{ fontSize: '0.8rem' }}>Section Name</label>
                          <input type="text" className="input-field" value={sec.name} onChange={e => handleSectionChange(i, 'name', e.target.value)} required />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="input-label" style={{ fontSize: '0.8rem' }}># Questions</label>
                          <input type="number" className="input-field" value={sec.questions} onChange={e => handleSectionChange(i, 'questions', Number(e.target.value))} required />
                        </div>
                        {bpForm.has_sectional_timing && (
                          <div style={{ flex: 1 }}>
                            <label className="input-label" style={{ fontSize: '0.8rem' }}>Duration (m)</label>
                            <input type="number" className="input-field" value={sec.duration} onChange={e => handleSectionChange(i, 'duration', Number(e.target.value))} required />
                          </div>
                        )}
                        <button type="button" className="btn btn-glass" onClick={() => handleRemoveSection(i)} style={{ color: 'var(--danger-color)', padding: '12px' }}>
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    {bpForm.sections.length === 0 && <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No sections added yet. Click "Add Section" above.</div>}
                  </div>

                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button type="submit" className="btn btn-primary">{bpForm.id ? 'Update Blueprint' : 'Save Blueprint'}</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {blueprints.map(bp => (
                <div key={bp.id} className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>{bp.exam_name}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    ID: {bp.exam_id} • {bp.total_duration}m • {bp.sections.length} Sections {bp.has_sectional_timing ? '(Strict Timings)' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-glass" style={{ padding: '8px', flex: 1 }} onClick={() => handleEditClick(bp)}><Edit3 size={16} /></button>
                    <button className="btn btn-glass" style={{ padding: '8px', flex: 1, color: 'var(--danger-color)' }} onClick={() => handleDeleteBlueprint(bp.id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {blueprints.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No blueprints found.</p>}
            </div>
          </div>
        )}

        {/* Users Content */}
        {!viewingRoomId && activeTab === 'users' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Registered Users</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '12px' }}>Name</th>
                    <th style={{ padding: '12px' }}>Email</th>
                    <th style={{ padding: '12px' }}>Role</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '12px' }}>{u.name}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', background: u.is_admin ? 'rgba(74, 222, 128, 0.2)' : 'var(--glass-bg)', color: u.is_admin ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                          {u.is_admin ? 'Admin' : 'Student'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => handleResetToken(u.id)}>
                          <Key size={14} /> Reset Pwd
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Tests Content */}
        {!viewingRoomId && activeTab === 'tests' && (
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
                    <th style={{ padding: '12px' }}>Date / Time</th>
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
                      <td style={{ padding: '12px' }}>{new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                        <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate(`/review/${t.id}?view=review`)}>View</button>
                        <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--danger-color)' }} onClick={() => handleDeleteTest(t.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {tests.length === 0 && <tr><td colSpan="6" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tests found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Rooms Content */}
        {!viewingRoomId && activeTab === 'rooms' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Live Multiplayer Rooms</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.entries(rooms).map(([code, room]) => (
                <div key={code} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-color)' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Room: {code}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Exam:</strong> {room.testData?.exam_name || room.mode}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Status:</strong> {room.state === 'PLAYING' ? 'Started' : room.state === 'FINISHED' ? 'Finished' : 'Waiting...'}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <strong>Players:</strong> {(room.host ? 1 : 0) + (room.guests ? room.guests.length : 0)}
                  </div>
                </div>
              ))}
              {Object.keys(rooms).length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No live rooms currently.</p>}
            </div>
          </div>
        )}

        {/* Historical Rooms Content */}
        {!viewingRoomId && activeTab === 'history-rooms' && (
          <div className="animate-fade-in glass-panel" style={{ padding: '24px' }}>
            <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Room Review History</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {historyRooms.map((r, i) => (
                <div key={i} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #b45309' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Room: {r.test_session_id}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Exam:</strong> {r.exam_name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <strong>Mode:</strong> {r.game_mode}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    <strong>Players:</strong> {r.participants}
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setViewingRoomId(r.test_session_id)}
                    style={{ width: '100%' }}
                  >
                    Review Room
                  </button>
                </div>
              ))}
              {historyRooms.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No historical rooms found.</p>}
            </div>
          </div>
        )}

        {/* System Info Content */}
        {!viewingRoomId && activeTab === 'system' && systemInfo && (
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
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Project Size on Disk</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{systemInfo.projectSize}</div>
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
      </div>
    </main>
  );
}
