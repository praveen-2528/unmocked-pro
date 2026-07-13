import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useParams, useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Profile() {
  const currentUser = JSON.parse(localStorage.getItem('unmocked_user') || '{}');
  const { userId } = useParams();
  const navigate = useNavigate();
  const targetUserId = userId || currentUser.id;

  const [profileData, setProfileData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) {
      navigate('/');
      return;
    }
    
    Promise.all([
      fetch(`/api/users/${targetUserId}/profile`).then(res => res.json()),
      fetch(`/api/test-results/${targetUserId}`).then(res => res.json())
    ])
    .then(([profileRes, historyRes]) => {
      setProfileData(profileRes);
      setHistory(historyRes);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [targetUserId, navigate]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading Profile...</div>;
  if (!profileData || profileData.error) return <div style={{ textAlign: 'center', padding: '40px' }}>User not found</div>;

  // Prepare Chart Data
  const sortedHistory = [...history].reverse(); // Chronological for line chart
  const dates = sortedHistory.map(h => new Date(h.created_at).toLocaleDateString());

  const accuracyData = {
    labels: dates,
    datasets: [{
      label: 'Accuracy (%)',
      data: sortedHistory.map(h => h.accuracy),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.4
    }]
  };

  const scoreData = {
    labels: sortedHistory.map(h => h.exam_name),
    datasets: [{
      label: 'Score',
      data: sortedHistory.map(h => h.score),
      backgroundColor: '#8b5cf6'
    }]
  };

  let totalCorrect = 0, totalIncorrect = 0, totalUnattempted = 0;
  history.forEach(h => {
    totalCorrect += h.correct;
    totalIncorrect += h.incorrect;
    totalUnattempted += h.unattempted;
  });

  const questionData = {
    labels: ['Correct', 'Incorrect', 'Unattempted'],
    datasets: [{
      data: [totalCorrect, totalIncorrect, totalUnattempted],
      backgroundColor: ['#22c55e', '#ef4444', '#94a3b8']
    }]
  };

  // Exam-wise aggregation
  const examMap = {};
  history.forEach(h => {
    if (!examMap[h.exam_name]) examMap[h.exam_name] = { totalAcc: 0, count: 0 };
    examMap[h.exam_name].totalAcc += h.accuracy;
    examMap[h.exam_name].count += 1;
  });
  
  const examLabels = Object.keys(examMap);
  const examAvgAcc = examLabels.map(ex => (examMap[ex].totalAcc / examMap[ex].count).toFixed(2));

  const examPerformanceData = {
    labels: examLabels,
    datasets: [{
      label: 'Average Accuracy (%)',
      data: examAvgAcc,
      backgroundColor: ['#f59e0b', '#ec4899', '#14b8a6', '#6366f1']
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: 'var(--text-primary)' } }
    },
    scales: {
      x: { ticks: { color: 'var(--text-secondary)' } },
      y: { ticks: { color: 'var(--text-secondary)' } }
    }
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Navbar />

      <main style={{ maxWidth: '1200px', margin: '80px auto 60px', padding: '0 20px' }}>
        {/* Header Section */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '40px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 'bold', flexShrink: 0 }}>
            {profileData.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="geist-pixel" style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '2.5rem' }}>
              {profileData.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0', fontSize: '1.1rem' }}>
              {profileData.email} • Member since {new Date(profileData.created_at).toLocaleDateString()}
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div className="glass-card" style={{ padding: '12px 20px', minWidth: '120px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Tests</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{profileData.total_tests || 0}</div>
              </div>
              <div className="glass-card" style={{ padding: '12px 20px', minWidth: '120px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Best Score</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{profileData.best_score || 0}</div>
              </div>
              <div className="glass-card" style={{ padding: '12px 20px', minWidth: '120px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Avg Accuracy</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{profileData.avg_accuracy || 0}%</div>
              </div>
              <div className="glass-card" style={{ padding: '12px 20px', minWidth: '120px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Questions</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{profileData.total_questions_attempted || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {history.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            <div className="glass-panel" style={{ height: '350px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>Accuracy Over Time</h3>
              <div style={{ height: '280px' }}><Line data={accuracyData} options={chartOptions} /></div>
            </div>
            <div className="glass-panel" style={{ height: '350px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>Score Distribution</h3>
              <div style={{ height: '280px' }}><Bar data={scoreData} options={chartOptions} /></div>
            </div>
            <div className="glass-panel" style={{ height: '350px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>Question Breakdown</h3>
              <div style={{ height: '280px', display: 'flex', justifyContent: 'center' }}><Doughnut data={questionData} options={{ ...chartOptions, maintainAspectRatio: false }} /></div>
            </div>
            <div className="glass-panel" style={{ height: '350px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)' }}>Exam-wise Average Accuracy</h3>
              <div style={{ height: '280px' }}><Bar data={examPerformanceData} options={chartOptions} /></div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '40px', marginBottom: '40px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No tests taken yet. Analytics will appear here.</p>
          </div>
        )}

        {/* Test History Table */}
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <h2 style={{ color: 'var(--text-primary)', marginTop: 0, marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>Test History</h2>
          {history.length === 0 ? (
             <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No history found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Exam</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Mode</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Score</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Accuracy</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(test => (
                  <tr key={test.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '12px' }}>{new Date(test.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{test.exam_name}</td>
                    <td style={{ padding: '12px' }}>{test.game_mode}</td>
                    <td style={{ padding: '12px' }}>{test.score}</td>
                    <td style={{ padding: '12px', color: test.accuracy >= 80 ? '#22c55e' : test.accuracy >= 60 ? '#eab308' : '#ef4444', fontWeight: 'bold' }}>{test.accuracy}%</td>
                    <td style={{ padding: '12px' }}>
                      <button className="btn btn-glass" style={{ padding: '6px 12px', fontSize: '0.9rem' }} onClick={() => navigate(`/review/${test.id}`)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
