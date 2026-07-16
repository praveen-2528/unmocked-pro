import React, { useState, useEffect } from 'react';
import { Search, Calendar, Users, Hash, Play, Eye, Clock, BarChart2, Target, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import RoomReview from './RoomReview';

const EXAM_COLORS = {
  'SSC': '#6366f1',
  'IBPS': '#f59e0b',
  'RRB': '#10b981',
  'SBI': '#ef4444',
  'DEFAULT': '#8b5cf6'
};

function getExamColor(examName) {
  const name = (examName || '').toUpperCase();
  for (const key in EXAM_COLORS) {
    if (name.includes(key)) return EXAM_COLORS[key];
  }
  return EXAM_COLORS.DEFAULT;
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T') + 'Z');
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

function getModeLabel(mode) {
  if (!mode) return 'Unknown';
  return mode.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default function GlobalRoomReviews({ currentUser, onBack }) {
  const [historyRooms, setHistoryRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewingRoomId, setViewingRoomId] = useState(searchParams.get('roomId') || null);
  const [reattemptingRoom, setReattemptingRoom] = useState(null);

  const handleBackToRooms = () => {
    setViewingRoomId(null);
    if (searchParams.has('roomId')) {
      searchParams.delete('roomId');
      setSearchParams(searchParams);
    }
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'participants', 'name'

  useEffect(() => {
    setLoading(true);
    fetch('/api/public/history-rooms', {
      headers: { 'x-user-id': currentUser?.id }
    })
      .then(res => res.json())
      .then(data => {
        setHistoryRooms(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentUser]);

  const handleReattempt = (room) => {
    setReattemptingRoom(room.test_session_id);
    // Fetch full room details to get test_data
    fetch(`/api/public/history-rooms/${room.test_session_id}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          alert('Could not load test data for this room.');
          setReattemptingRoom(null);
          return;
        }
        const firstValid = data.find(d => d.test_data && d.test_data !== '{}');
        if (!firstValid) {
          alert('No test data available for this room.');
          setReattemptingRoom(null);
          return;
        }
        const testData = JSON.parse(firstValid.test_data);
        // Launch as fresh solo test
        localStorage.setItem('active_test_data', JSON.stringify(testData));
        localStorage.setItem('test_game_mode', 'Solo-Real');
        const sessionId = 'reattempt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        localStorage.setItem('current_test_session_id', sessionId);
        localStorage.removeItem('multiplayer_room');
        navigate('/test/' + sessionId + '?view=instructions');
      })
      .catch(err => {
        console.error(err);
        alert('Failed to load test data.');
        setReattemptingRoom(null);
      });
  };

  // Filtering and Sorting
  const filteredRooms = historyRooms
    .filter(r => {
      const query = searchQuery.toLowerCase();
      if (query) {
        const matchesCode = r.test_session_id?.toLowerCase().includes(query);
        const matchesExam = r.exam_name?.toLowerCase().includes(query);
        const matchesUser = r.participant_names?.toLowerCase().includes(query);
        if (!matchesCode && !matchesExam && !matchesUser) return false;
      }
      if (filterDate && !r.created_at?.startsWith(filterDate)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'participants') return (b.participants || 0) - (a.participants || 0);
      if (sortBy === 'name') return (a.exam_name || '').localeCompare(b.exam_name || '');
      return 0;
    });

  if (viewingRoomId) {
    return <RoomReview currentUser={currentUser} sessionId={viewingRoomId} onBack={handleBackToRooms} />;
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            className="btn btn-glass"
            onClick={onBack}
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h2 className="geist-pixel" style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: 0 }}>
              Test Library
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Review past sessions or reattempt any test paper
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0 8px' }}>Sort:</span>
          {['recent', 'participants', 'name'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                background: sortBy === s ? 'var(--accent-color)' : 'transparent',
                color: sortBy === s ? '#000' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              {s === 'recent' ? '🕐 Recent' : s === 'participants' ? '👥 Popular' : '📝 Name'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by exam name, room code, or participant..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>
        <div style={{ flex: '0 0 auto', position: 'relative' }}>
          <Calendar size={16} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-secondary)' }} />
          <input
            type="date"
            className="input-field"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ paddingLeft: '40px', minWidth: '160px' }}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {filteredRooms.length} {filteredRooms.length === 1 ? 'session' : 'sessions'}
        </div>
      </div>

      {/* Room Cards */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <div>Loading sessions...</div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <Search size={40} style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '8px' }}>No sessions found</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', opacity: 0.7 }}>
            {searchQuery || filterDate ? 'Try adjusting your filters' : 'Complete a test to see it here'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredRooms.map((r, i) => {
            const color = getExamColor(r.exam_name);
            const participants = r.participant_names?.split(',').map(n => n.trim()).filter(Boolean) || [];
            const isReattempting = reattemptingRoom === r.test_session_id;
            return (
              <div
                key={i}
                className="glass-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  transition: 'all 0.25s ease',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = color + '60'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Color accent bar */}
                <div style={{ height: '4px', background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

                <div style={{ padding: '20px' }}>
                  {/* Header: exam name + time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                        {r.exam_name || 'Unknown Exam'}
                      </h3>
                      <span style={{
                        display: 'inline-block', fontSize: '0.7rem', padding: '2px 10px', borderRadius: '20px', fontWeight: '600',
                        background: color + '18', color: color, letterSpacing: '0.5px'
                      }}>
                        {getModeLabel(r.game_mode)}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {getTimeAgo(r.created_at)}
                    </span>
                  </div>

                  {/* Participants */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex' }}>
                      {participants.slice(0, 4).map((name, pi) => (
                        <div
                          key={pi}
                          title={name}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: `hsl(${(name.charCodeAt(0) * 37) % 360}, 60%, 45%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: '700', color: '#fff',
                            marginLeft: pi > 0 ? '-8px' : '0',
                            border: '2px solid var(--surface-color)',
                            zIndex: 4 - pi
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {participants.length > 4 && (
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', color: 'var(--text-secondary)',
                          marginLeft: '-8px', border: '2px solid var(--surface-color)'
                        }}>
                          +{participants.length - 4}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {r.participants} {r.participants === 1 ? 'player' : 'players'}
                    </span>
                  </div>

                  {/* Room Code (subtle) */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '16px', fontFamily: 'monospace' }}>
                    #{r.test_session_id?.replace('multi-', '').substring(0, 12)}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-glass"
                      onClick={() => setViewingRoomId(r.test_session_id)}
                      style={{ flex: 1, padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Eye size={15} /> Review
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleReattempt(r)}
                      disabled={isReattempting}
                      style={{
                        flex: 1, padding: '10px', fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        opacity: isReattempting ? 0.6 : 1,
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`
                      }}
                    >
                      {isReattempting ? (
                        <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</>
                      ) : (
                        <><Play size={14} /> Reattempt</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
