import { useEffect } from 'react';
import { Trophy, CheckCircle2, Home, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Results({ scoreData, testData, gameMode, liveStats, currentUser, testSessionId }) {
  const navigate = useNavigate();
  const isMultiplayer = gameMode.startsWith('Multiplayer');

  const mc = testData.blueprint.marks_correct || 1.0;
  const mi = testData.blueprint.marks_incorrect || 0.25;

  useEffect(() => {
    if (currentUser?.id && scoreData && testSessionId) {
      const accuracy = (scoreData.correct + scoreData.incorrect) > 0 
        ? (scoreData.correct / (scoreData.correct + scoreData.incorrect) * 100) 
        : 0;
        
      fetch('/api/test-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          test_session_id: testSessionId,
          exam_name: testData.blueprint.exam_name,
          game_mode: gameMode,
          score: scoreData.marks,
          total_questions: scoreData.total,
          correct: scoreData.correct,
          incorrect: scoreData.incorrect,
          unattempted: scoreData.unattempted,
          accuracy: accuracy
        })
      }).catch(err => console.error('Failed to save test:', err));
    }
  }, [currentUser, scoreData, testData, gameMode, testSessionId]);

  const renderSoloResults = () => (
    <div className="glass-panel animate-fade-in" style={{ padding: '40px', maxWidth: '600px', width: '100%', textAlign: 'center' }}>
      <CheckCircle2 size={64} style={{ color: 'var(--accent-color)', margin: '0 auto 24px auto' }} />
      <h1 className="geist-pixel" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Test Submitted!</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>{testData.blueprint.exam_name}</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '8px' }}>
            {scoreData.marks.toFixed(2)}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>Total Score</div>
        </div>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
            {((scoreData.correct / scoreData.total) * 100).toFixed(0)}%
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>Accuracy</div>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', textAlign: 'left', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: 'var(--text-secondary)' }}>Total Questions:</span> <strong>{scoreData.total}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: 'var(--accent-color)' }}>Correct (+{mc}):</span> <strong>{scoreData.correct}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span style={{ color: 'var(--danger-color)' }}>Incorrect (-{mi}):</span> <strong>{scoreData.incorrect}</strong></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'gray' }}>Unattempted:</span> <strong>{scoreData.unattempted}</strong></div>
      </div>

      <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ padding: '12px 32px', fontSize: '1.1rem' }}>
        <Home size={18} style={{ marginRight: '8px' }} /> Return to Dashboard
      </button>
    </div>
  );

  const renderMultiplayerResults = () => {
    // Inject current user's final score into the pool if they actually took the test
    const finalStats = { ...liveStats };
    if (scoreData) {
      finalStats[currentUser.id] = {
        name: currentUser.name,
        attempted: scoreData.correct + scoreData.incorrect,
        skipped: scoreData.unattempted,
        right: scoreData.correct,
        wrong: scoreData.incorrect,
        accuracy: scoreData.total > 0 ? ((scoreData.correct / (scoreData.correct + scoreData.incorrect)) * 100) : 0,
        score: scoreData.marks
      };
    }

    const players = Object.values(finalStats).map(st => {
      const right = st.right || 0;
      const wrong = st.wrong || 0;
      const score = st.score !== undefined ? st.score : (right * mc) - (wrong * mi);
      return { ...st, score };
    }).sort((a, b) => b.score - a.score);

    const podium = players.slice(0, 3);
    const others = players.slice(3);

    return (
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Trophy size={64} style={{ color: '#fbbf24', margin: '0 auto 16px auto' }} />
          <h1 className="geist-pixel" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Final Leaderboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{testData.blueprint.exam_name} ({gameMode.replace('-', ' ')})</p>
        </div>

        {/* Podium */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', height: '250px', marginBottom: '48px' }}>
          {/* 2nd Place */}
          {podium[1] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>{podium[1].name}</div>
              <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '16px' }}>{podium[1].score.toFixed(2)} pts</div>
              <div style={{ width: '100%', height: '140px', background: 'linear-gradient(to top, rgba(148, 163, 184, 0.4), rgba(148, 163, 184, 0.1))', borderTop: '4px solid #94a3b8', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#94a3b8' }}>2</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {podium[0] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center', color: '#fbbf24' }}>{podium[0].name}</div>
              <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '16px', fontSize: '1.2rem' }}>{podium[0].score.toFixed(2)} pts</div>
              <div style={{ width: '100%', height: '180px', background: 'linear-gradient(to top, rgba(251, 191, 36, 0.4), rgba(251, 191, 36, 0.1))', borderTop: '4px solid #fbbf24', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                <span style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fbbf24' }}>1</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {podium[2] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>{podium[2].name}</div>
              <div style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '16px' }}>{podium[2].score.toFixed(2)} pts</div>
              <div style={{ width: '100%', height: '110px', background: 'linear-gradient(to top, rgba(180, 83, 9, 0.4), rgba(180, 83, 9, 0.1))', borderTop: '4px solid #b45309', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#b45309' }}>3</span>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Stats Table */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Rank</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Player</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Score</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Accuracy</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>R / W / S</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)', background: p.name === currentUser.name ? 'rgba(74, 222, 128, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 'bold', color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#fff' }}>
                    #{idx + 1}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: p.name === currentUser.name ? 'bold' : 'normal' }}>
                    {p.name} {p.name === currentUser.name && <span style={{ color: 'var(--accent-color)', fontSize: '0.8rem', marginLeft: '8px' }}>(You)</span>}
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                    {p.score.toFixed(2)}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {p.accuracy ? p.accuracy.toFixed(0) : 0}%
                  </td>
                  <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--accent-color)' }}>{p.right}</span> / <span style={{ color: 'var(--danger-color)' }}>{p.wrong}</span> / <span>{p.skipped}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ padding: '12px 32px', fontSize: '1.1rem' }}>
            <Home size={18} style={{ marginRight: '8px' }} /> Return to Dashboard
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
       {isMultiplayer ? renderMultiplayerResults() : renderSoloResults()}
    </div>
  );
}
