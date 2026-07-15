import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import UserProfileModal from '../components/UserProfileModal';


export default function Leaderboard() {
  const currentUser = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfileName, setSelectedProfileName] = useState(null);

  useEffect(() => {
    if (!currentUser?.email) {
      navigate('/');
      return;
    }
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [navigate, currentUser.email]);

  const getRankColor = (rank) => {
    if (rank === 1) return '#fbbf24'; // Gold
    if (rank === 2) return '#94a3b8'; // Silver
    if (rank === 3) return '#d97706'; // Bronze
    return 'var(--glass-border)';
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Navbar />
      
      <main style={{ maxWidth: '1000px', margin: '80px auto 60px', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 className="geist-pixel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '2.5rem', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            <Trophy size={40} color="#fbbf24" /> Global Leaderboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>
            Ranked by average accuracy across all tests
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : leaderboard.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No data yet. Take some tests to appear on the leaderboard!</p>
          </div>
        ) : (
          <>
            {/* Podium for Top 3 */}
            {leaderboard.length >= 3 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '20px', marginBottom: '40px' }}>
                {/* 2nd Place */}
                <div className="glass-card" onClick={() => setSelectedProfileName(leaderboard[1].name)} style={{ width: '200px', height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: getRankColor(2), cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥈</div>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
                    {leaderboard[1].name.charAt(0).toUpperCase()}
                  </div>
                  <strong style={{ fontSize: '1.2rem' }}>{leaderboard[1].name}</strong>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{leaderboard[1].avg_accuracy}% Acc</span>
                </div>
                
                {/* 1st Place */}
                <div className="glass-card" onClick={() => setSelectedProfileName(leaderboard[0].name)} style={{ width: '220px', height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: getRankColor(1), borderWidth: '2px', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 8px 32px rgba(251, 191, 36, 0.2)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>🥇</div>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fbbf24', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', marginBottom: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    {leaderboard[0].name.charAt(0).toUpperCase()}
                  </div>
                  <strong style={{ fontSize: '1.4rem' }}>{leaderboard[0].name}</strong>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>{leaderboard[0].avg_accuracy}% Acc</span>
                </div>

                {/* 3rd Place */}
                <div className="glass-card" onClick={() => setSelectedProfileName(leaderboard[2].name)} style={{ width: '200px', height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: getRankColor(3), cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥉</div>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#d97706', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
                    {leaderboard[2].name.charAt(0).toUpperCase()}
                  </div>
                  <strong style={{ fontSize: '1.2rem' }}>{leaderboard[2].name}</strong>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{leaderboard[2].avg_accuracy}% Acc</span>
                </div>
              </div>
            )}

            {/* Full Table */}
            <div className="glass-panel" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                    <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Rank</th>
                    <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>User</th>
                    <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Tests Taken</th>
                    <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Best Score</th>
                    <th style={{ padding: '16px', color: 'var(--text-secondary)' }}>Avg Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user, index) => {
                    const rank = index + 1;
                    const isCurrentUser = user.id === currentUser.id;
                    const accColor = user.avg_accuracy >= 80 ? '#22c55e' : user.avg_accuracy >= 60 ? '#eab308' : '#ef4444';

                    return (
                      <tr 
                        key={user.id} 
                        onClick={() => setSelectedProfileName(user.name)}
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          backgroundColor: isCurrentUser ? 'rgba(37,99,235,0.1)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (!isCurrentUser) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                        }}
                        onMouseOut={(e) => {
                          if (!isCurrentUser) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '16px', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {getRankEmoji(rank)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isCurrentUser ? 'var(--accent-color)' : 'var(--text-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <strong style={{ color: 'var(--text-primary)' }}>{user.name} {isCurrentUser && '(You)'}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{user.tests_taken}</td>
                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{user.best_score}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: accColor }}></span>
                            {user.avg_accuracy}%
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {selectedProfileName && (
        <UserProfileModal 
          queryName={selectedProfileName} 
          onClose={() => setSelectedProfileName(null)} 
        />
      )}
    </div>
  );
}
