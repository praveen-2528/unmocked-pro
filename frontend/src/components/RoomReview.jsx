import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, CheckCircle, Clock } from 'lucide-react';

export default function RoomReview({ sessionId, onBack }) {
  const [roomData, setRoomData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' or 'questions'
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  
  useEffect(() => {
    fetch(`/api/public/history-rooms/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setRoomData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) return <div style={{ padding: '40px', color: '#fff' }}>Loading room details...</div>;
  if (!roomData || !Array.isArray(roomData) || roomData.length === 0) return <div style={{ padding: '40px', color: '#fff' }}>No data found for this room.</div>;

  // Assuming all players took the same test, parse test_data from the first valid submission
  const firstValid = roomData.find(d => d.test_data && d.test_data !== '{}');
  const testData = firstValid ? JSON.parse(firstValid.test_data) : null;
  const examName = roomData[0].exam_name;
  const gameMode = roomData[0].game_mode;

  // Aggregate stats
  let totalScore = 0;
  let maxScore = 0;
  let totalQuestions = 0;
  let correctSum = 0;
  let totalAttempted = 0;

  const parseJSON = (str) => {
    if (!str) return {};
    try { 
      const parsed = JSON.parse(str); 
      return parsed || {}; 
    } 
    catch(e) { return {}; }
  };

  const players = roomData.map(d => {
    totalScore += d.score;
    maxScore = Math.max(maxScore, d.score);
    totalQuestions = d.total_questions;
    correctSum += d.correct;
    totalAttempted += (d.correct + d.incorrect);
    return {
      id: d.user_id,
      name: d.user_name || 'Unknown',
      score: d.score,
      accuracy: d.accuracy,
      correct: d.correct,
      incorrect: d.incorrect,
      time_spent: parseJSON(d.time_spent),
      answers: parseJSON(d.answers)
    };
  }).sort((a, b) => b.score - a.score);

  const avgAccuracy = totalAttempted > 0 ? (correctSum / totalAttempted) * 100 : 0;

  // Flatten all questions for the Question Review tab
  let allQuestions = [];
  if (testData && testData.sections) {
    testData.sections.forEach((sec, sIdx) => {
      sec.questions.forEach((q, qIdx) => {
        allQuestions.push({ ...q, sectionName: sec.name, sIdx, qIdx });
      });
    });
  }

  const formatTime = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      <button 
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px', fontSize: '1rem' }}
      >
        <ArrowLeft size={20} /> Back to Rooms
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', margin: '0 0 8px 0', color: 'var(--text-primary)' }}>{examName}</h2>
          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> {players.length} Players</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={16} /> Room Avg Accuracy: {avgAccuracy.toFixed(1)}%</span>
            <span>Room Code: {sessionId}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'leaderboard' ? 'var(--accent-color)' : 'var(--surface-color)', color: activeTab === 'leaderboard' ? '#fff' : 'var(--text-primary)' }}
          >
            Leaderboard
          </button>
          <button 
            onClick={() => setActiveTab('questions')}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: activeTab === 'questions' ? 'var(--accent-color)' : 'var(--surface-color)', color: activeTab === 'questions' ? '#fff' : 'var(--text-primary)' }}
          >
            Review Questions
          </button>
        </div>
      </div>

      {activeTab === 'leaderboard' && (
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Rank</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Player</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Score</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Accuracy</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Right / Wrong</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 'bold', color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#fff' }}>
                    #{idx + 1}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="avatar-placeholder" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '500' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{(p.score || 0).toFixed(2)} pts</td>
                  <td style={{ padding: '16px 24px' }}>{(p.accuracy || 0).toFixed(1)}%</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ color: '#4ade80' }}>{p.correct}</span> / <span style={{ color: '#f87171' }}>{p.incorrect}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'questions' && allQuestions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
          {/* Question Viewer */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ margin: 0, color: 'var(--text-secondary)' }}>{allQuestions[currentQuestionIdx].sectionName} - Question {allQuestions[currentQuestionIdx].qIdx + 1}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="btn btn-secondary" style={{ padding: '6px 12px' }}
                >
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentQuestionIdx(prev => Math.min(allQuestions.length - 1, prev + 1))}
                  disabled={currentQuestionIdx === allQuestions.length - 1}
                  className="btn btn-primary" style={{ padding: '6px 12px' }}
                >
                  Next
                </button>
              </div>
            </div>
            
            <div style={{ fontSize: '1.2rem', marginBottom: '24px', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: allQuestions[currentQuestionIdx].question }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['A', 'B', 'C', 'D', 'E'].map(opt => {
                const optText = allQuestions[currentQuestionIdx][`option${opt}`];
                if (!optText) return null;
                const isCorrect = allQuestions[currentQuestionIdx].answer === opt;
                
                return (
                  <div key={opt} style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: isCorrect ? '2px solid #4ade80' : '1px solid var(--glass-border)',
                    background: isCorrect ? 'rgba(74, 222, 128, 0.1)' : 'var(--surface-color)'
                  }}>
                    <strong style={{ marginRight: '12px', color: isCorrect ? '#4ade80' : 'var(--text-secondary)' }}>{opt}.</strong>
                    <span dangerouslySetInnerHTML={{ __html: optText }} />
                    {isCorrect && <span style={{ marginLeft: '12px', color: '#4ade80', fontSize: '0.9rem', fontWeight: 'bold' }}>✓ Correct Answer</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Participant Breakdown Panel */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 16px 0', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>Player Responses</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              {players.map(p => {
                const qId = allQuestions[currentQuestionIdx].id;
                const selectedAns = p.answers[qId];
                const timeSpent = p.time_spent[qId] || 0;
                const actualAns = allQuestions[currentQuestionIdx].answer;
                
                let bgColor = 'var(--surface-color)';
                let borderColor = 'var(--glass-border)';
                let statusText = 'Skipped';
                
                if (selectedAns && selectedAns !== '0') {
                  if (selectedAns === actualAns) {
                    bgColor = 'rgba(74, 222, 128, 0.1)';
                    borderColor = '#4ade80';
                    statusText = `Selected ${selectedAns}`;
                  } else {
                    bgColor = 'rgba(248, 113, 113, 0.1)';
                    borderColor = '#f87171';
                    statusText = `Selected ${selectedAns}`;
                  }
                }
                
                return (
                  <div key={p.id} style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{p.name}</strong>
                      <span style={{ fontWeight: 'bold', color: selectedAns === actualAns ? '#4ade80' : (selectedAns && selectedAns !== '0' ? '#f87171' : 'var(--text-secondary)') }}>
                        {statusText}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <Clock size={14} /> {formatTime(timeSpent)} spent
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
