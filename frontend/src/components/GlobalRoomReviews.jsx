import React, { useState, useEffect } from 'react';
import { Search, Calendar, Users, Hash } from 'lucide-react';
import RoomReview from './RoomReview';

export default function GlobalRoomReviews({ currentUser, onBack }) {
  const [historyRooms, setHistoryRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingRoomId, setViewingRoomId] = useState(null);

  // Filters
  const [filterRoomCode, setFilterRoomCode] = useState('');
  const [filterUserName, setFilterUserName] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterTestCode, setFilterTestCode] = useState('');

  useEffect(() => {
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

  const filteredRooms = historyRooms.filter(r => {
    if (filterRoomCode && !r.test_session_id?.toLowerCase().includes(filterRoomCode.toLowerCase())) return false;
    if (filterUserName && !r.participant_names?.toLowerCase().includes(filterUserName.toLowerCase())) return false;
    if (filterDate && !r.created_at?.startsWith(filterDate)) return false;
    if (filterTestCode && !r.exam_name?.toLowerCase().includes(filterTestCode.toLowerCase())) return false;
    return true;
  });

  if (viewingRoomId) {
    return <RoomReview sessionId={viewingRoomId} onBack={() => setViewingRoomId(null)} />;
  }

  return (
    <div className="animate-fade-in glass-panel" style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="geist-pixel" style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>Global Room Reviews</h2>
        <button className="btn btn-glass" onClick={onBack}>Back to Home</button>
      </div>
      
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Room Code</label>
          <div style={{ position: 'relative' }}>
            <Hash size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input type="text" className="input-field" placeholder="e.g. multi-..." value={filterRoomCode} onChange={e => setFilterRoomCode(e.target.value)} style={{ width: '100%', paddingLeft: '36px' }} />
          </div>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>User Name</label>
          <div style={{ position: 'relative' }}>
            <Users size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input type="text" className="input-field" placeholder="Search participant..." value={filterUserName} onChange={e => setFilterUserName(e.target.value)} style={{ width: '100%', paddingLeft: '36px' }} />
          </div>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Test Code / Name</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input type="text" className="input-field" placeholder="e.g. Mock Test 1" value={filterTestCode} onChange={e => setFilterTestCode(e.target.value)} style={{ width: '100%', paddingLeft: '36px' }} />
          </div>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Date</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
            <input type="date" className="input-field" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: '100%', paddingLeft: '36px' }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rooms...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredRooms.map((r, i) => (
            <div key={i} className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #b45309' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>Room: {r.test_session_id?.replace('multi-', '')}</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <strong>Exam:</strong> {r.exam_name}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <strong>Mode:</strong> {r.game_mode?.replace('-', ' ')}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <strong>Date:</strong> {new Date(r.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <strong>Players ({r.participants}):</strong> {r.participant_names}
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
          {filteredRooms.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>No historical rooms found matching your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
