import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


export default function ChessLobby() {
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  const handleCreate = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    navigate(`/chess/${code}`);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length === 4) {
      navigate(`/chess/${joinCode.toUpperCase()}`);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <div className="glass-panel" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <h1 className="geist-pixel" style={{ fontSize: '2rem', color: 'var(--text-primary)', marginBottom: '20px' }}>♟️ Chess Lobby</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Play real-time chess with anyone on the platform.</p>
          
          <button className="btn btn-primary" onClick={handleCreate} style={{ width: '100%', padding: '14px', fontSize: '1.1rem', marginBottom: '30px' }}>
            Create New Match
          </button>
          
          <div style={{ position: 'relative', marginBottom: '30px' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--glass-border)', zIndex: 0 }}></div>
            <span style={{ position: 'relative', background: 'var(--bg-main)', padding: '0 12px', color: 'var(--text-secondary)', zIndex: 1, fontSize: '0.9rem' }}>OR</span>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Enter 4-character code" 
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ flex: 1, fontSize: '1.1rem', textAlign: 'center', letterSpacing: '2px' }}
            />
            <button type="submit" className="btn btn-primary" disabled={joinCode.length !== 4}>Join</button>
          </form>
        </div>

    </div>
  );
}
