import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import { Users, MessageSquare, FileText, Upload, Send, ArrowLeft, Play } from 'lucide-react';

export default function StudyRoom() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [docs, setDocs] = useState([]);
  const [tests, setTests] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'docs', 'tests'
  const chatEndRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('unmocked_user') || '{}');

  useEffect(() => {
    if (!currentUser.id) {
      navigate('/');
      return;
    }

    fetch(`/api/study-groups/${groupId}/details`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setRoom(data.group);
        setMembers(data.members);
        setMessages(data.messages);
        setDocs(data.docs);
        setTests(data.tests);
        
        socket.emit('joinStudyGroup', { groupId });
      })
      .catch(err => {
        navigate('/home');
      });

    socket.on('studyGroupMessage', (msg) => {
      if (msg.group_id == groupId) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socket.on('newDoc', (doc) => {
      if (doc.group_id == groupId) {
        setDocs(prev => [doc, ...prev]);
      }
    });

    socket.on('newTest', (test) => {
      if (test.group_id == groupId) {
        setTests(prev => [test, ...prev]);
      }
    });

    return () => {
      socket.off('studyGroupMessage');
      socket.off('newDoc');
      socket.off('newTest');
    };
  }, [groupId]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    socket.emit('studyGroupMessage', {
      groupId,
      userId: currentUser.id,
      message: newMessage.trim()
    });
    setNewMessage('');
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docName.trim() && !uploadFile) return;

    const formData = new FormData();
    formData.append('user_id', currentUser.id);
    if (uploadFile) {
      formData.append('file', uploadFile);
    } else {
      formData.append('doc_url', docUrl);
      formData.append('doc_name', docName);
    }

    try {
      const res = await fetch(`/api/study-groups/${groupId}/docs`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setDocUrl('');
        setDocName('');
        setUploadFile(null);
      }
    } catch (err) {
      console.error('Failed to upload document');
    }
  };

  const handleTakeTest = (testDataString) => {
    const parsedTest = JSON.parse(testDataString);
    localStorage.setItem('active_test_data', JSON.stringify(parsedTest));
    localStorage.setItem('test_game_mode', 'Solo-Real');
    localStorage.setItem('current_test_session_id', 'group-' + groupId + '-' + Date.now());
    navigate('/test');
  };

  if (!room) return <div style={{ padding: '40px', color: 'var(--text-primary)' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      {/* Left Sidebar: Room Details & Members */}
      <div style={{ width: '280px', borderRight: '1px solid var(--glass-border)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <button className="btn btn-glass" onClick={() => navigate('/home')} style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Back
        </button>
        
        <h2 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--accent-color)' }}>{room.name}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>{room.description || 'No description'}</p>
        
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '32px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Room Code:</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '2px' }}>{room.join_code}</div>
        </div>

        <h3 className="geist-pixel" style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} /> Members ({members.length})
        </h3>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.9rem' }}>{m.name} {m.id === room.created_by && '(Admin)'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 24px' }}>
          <button 
            style={{ padding: '20px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'chat' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: activeTab === 'chat' ? 'bold' : 'normal' }}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} /> Group Chat
          </button>
          <button 
            style={{ padding: '20px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === 'docs' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'docs' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: activeTab === 'docs' ? 'bold' : 'normal' }}
            onClick={() => setActiveTab('docs')}
          >
            <FileText size={18} /> Documents & Links
          </button>
          <button 
            style={{ padding: '20px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === 'tests' ? '2px solid var(--accent-color)' : '2px solid transparent', color: activeTab === 'tests' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: activeTab === 'tests' ? 'bold' : 'normal' }}
            onClick={() => setActiveTab('tests')}
          >
            <Play size={18} /> Shared Mock Tests
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          
          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>No messages yet. Say hi!</p>}
                {messages.map((msg, i) => {
                  const isMine = msg.user_id === currentUser.id;
                  return (
                    <div key={i} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      {!isMine && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: '4px' }}>{msg.user_name}</div>}
                      <div style={{ padding: '12px 16px', borderRadius: '16px', background: isMine ? 'var(--accent-color)' : 'var(--glass-bg)', color: isMine ? '#000' : 'var(--text-primary)', border: isMine ? 'none' : '1px solid var(--glass-border)', borderBottomRightRadius: isMine ? '4px' : '16px', borderBottomLeftRadius: isMine ? '16px' : '4px' }}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px' }}>
                  <input type="text" className="input-field" placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ flex: 1 }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={18} /> Send</button>
                </form>
              </div>
            </div>
          )}

          {/* DOCS TAB */}
          {activeTab === 'docs' && (
            <div style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                <h3 className="geist-pixel" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Share a Document or URL</h3>
                <form onSubmit={handleUploadDoc}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Upload File</label>
                      <input type="file" className="input-field" onChange={e => setUploadFile(e.target.files[0])} />
                    </div>
                    <div>
                      <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Or Paste URL Link</label>
                      <input type="text" className="input-field" placeholder="https://..." value={docUrl} onChange={e => setDocUrl(e.target.value)} disabled={!!uploadFile} />
                    </div>
                  </div>
                  {!uploadFile && (
                    <div style={{ marginBottom: '16px' }}>
                      <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Document Name</label>
                      <input type="text" className="input-field" placeholder="E.g. Math Formula Sheet" value={docName} onChange={e => setDocName(e.target.value)} />
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Upload size={18} /> Share Resource</button>
                </form>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {docs.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No documents shared yet.</p>}
                {docs.map(doc => (
                  <div key={doc.id} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                      <FileText size={24} style={{ color: 'var(--accent-color)' }} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', wordBreak: 'break-all' }}>{doc.doc_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Shared by {doc.user_name}</div>
                      </div>
                    </div>
                    <a href={doc.is_file ? `${doc.doc_url}` : doc.doc_url} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ textAlign: 'center', textDecoration: 'none', display: 'block', marginTop: 'auto' }}>
                      Open Link
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TESTS TAB */}
          {activeTab === 'tests' && (
            <div style={{ padding: '32px', overflowY: 'auto', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 className="geist-pixel" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Shared Mock Tests</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>These are tests generated by members of this study group. Anyone can take them.</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard?step=1')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Generate New Test <ArrowRight size={16} />
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {tests.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No tests have been shared to this group yet.</p>}
                {tests.map(test => {
                  let testData = {};
                  try { testData = JSON.parse(test.test_data); } catch(e){}
                  const examName = testData?.blueprint?.exam_name || 'Mock Test';
                  
                  return (
                    <div key={test.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '4px' }}>{examName}</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Created by {test.user_name} on {new Date(test.created_at).toLocaleDateString()}
                      </p>
                      <button className="btn btn-glass" onClick={() => handleTakeTest(test.test_data)} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        Take Test Solo <Play size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
