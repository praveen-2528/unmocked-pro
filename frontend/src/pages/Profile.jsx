import useAuthStore from '../store/useAuthStore';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import BadgeIcon from '../components/BadgeSVGs';
import ContributionCalendar from '../components/ContributionCalendar';
import QuestionRenderer from '../components/QuestionRenderer';
import PerformanceCharts from '../components/PerformanceCharts';
import { 
    ChevronLeft, Award, Clock, Eye, CheckCircle, XCircle, 
    RefreshCw, Flame, Sparkles, Lock, Trophy, Calendar, BookOpen, X 
} from 'lucide-react';
import styles from './Profile.module.css';
const cx = (...classes) => classes.filter(Boolean).flatMap(c => String(c).split(' ')).map(c => styles[c] || c).join(' ').trim();

const ProfileInner = () => {
    const navigate = useNavigate();
    
    let currentUser = {};
    try {
        const stored = localStorage.getItem('unmocked_user');
        if (stored && stored !== 'undefined') {
            currentUser = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse unmocked_user', e);
    }
    const authFetch = (url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'user-id': currentUser.id,
                'Content-Type': 'application/json'
            }
        });
    };

    const [searchParams] = useSearchParams();
    
    // Get query details from URL if viewing a friend's profile
    const queryEmail = searchParams.get('email');
    const queryName = searchParams.get('name');

    const [profile, setProfile] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Detailed exam view state
    const [selectedExamDetail, setSelectedExamDetail] = useState(null);
    const [loadingExamDetail, setLoadingExamDetail] = useState(false);

    // Reattempt states
    const [reattempts, setReattempts] = useState({});
    const [reattemptMode, setReattemptMode] = useState(false);
    const [selectedBadge, setSelectedBadge] = useState(null);

    // Historical Leaderboard states
    const [historicalLeaderboard, setHistoricalLeaderboard] = useState(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('profile_pic', file);
        formData.append('userId', currentUser.id);

        try {
            const res = await fetch('/api/profile/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setProfile({ ...profile, profile_pic: data.profile_pic });
                const updatedUser = { ...currentUser, profile_pic: data.profile_pic };
                localStorage.setItem('unmocked_user', JSON.stringify(updatedUser));
                window.dispatchEvent(new Event('storage'));
            } else {
                alert(data.error || 'Failed to upload photo');
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed');
        }
    };

    const loadHistoricalLeaderboard = async (code) => {
        setLoadingLeaderboard(true);
        try {
            const res = await authFetch(`/api/history/room/${code}`);
            const data = await res.json();
            if (res.ok) {
                setHistoricalLeaderboard(data.leaderboard || []);
            } else {
                alert(data.error || 'Failed to load leaderboard');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load leaderboard');
        }
        setLoadingLeaderboard(false);
    };

    // Fetch user profile & test history
    useEffect(() => {
        let url = '/api/users/profile';
        const params = [];
        
        // Clean up email/name query
        const cleanEmail = (queryEmail && queryEmail !== 'null' && queryEmail !== 'undefined') ? queryEmail.trim() : null;
        const cleanName = (queryName && queryName !== 'null' && queryName !== 'undefined') ? queryName.trim() : null;

        if (cleanEmail) params.push(`email=${encodeURIComponent(cleanEmail)}`);
        else if (cleanName) params.push(`name=${encodeURIComponent(cleanName)}`);

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        Promise.resolve().then(() => {
            setLoading(true);
            setError('');
        });
        authFetch(url)
            .then(r => {
                if (!r.ok) {
                    if (r.status === 404) throw new Error('User has not completed any exams yet or profile not found.');
                    throw new Error('Failed to load user profile');
                }
                
                const contentType = r.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    return r.json();
                } else {
                    return r.text().then(text => {
                        throw new Error("Received HTML error from server. Did you restart the backend? " + text.substring(0, 50));
                    });
                }
            })
            .then(data => {
                setProfile(data.user);
                setHistory(data.history || []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [queryEmail, queryName]);

    // Fetch details of a specific exam
    const handleSelectExam = (examId) => {
        setLoadingExamDetail(true);
        setSelectedExamDetail(null);
        setReattempts({});

        authFetch(`/api/history/${examId}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load exam details');
                
                const contentType = r.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    return r.json();
                } else {
                    return r.text().then(text => {
                        throw new Error("Received HTML error from server. Did you restart the backend? " + text.substring(0, 50));
                    });
                }
            })
            .then(data => {
                setSelectedExamDetail(data.detail);
                setLoadingExamDetail(false);
            })
            .catch(err => {
                alert(err.message);
                setLoadingExamDetail(false);
            });
    };

    const formatTime = (seconds) => {
        if (!seconds) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // const formatDuration = (seconds) => {
    //     const h = Math.floor(seconds / 3600);
    //     const m = Math.floor((seconds % 3600) / 60);
    //     if (h > 0) return `${h}h ${m}m`;
    //     return `${m}m`;
    // };

    const formatDate = (iso) => {
        if (!iso) return 'Recently';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return 'Recently';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Level progression calculations
    const levelMetrics = useMemo(() => {
        if (!profile) return null;
        const { xp, level, currentLevelMinXp, nextLevelXp } = profile;
        const levelRange = (nextLevelXp || 100) - (currentLevelMinXp || 0);
        const levelProgress = levelRange > 0 ? (xp - (currentLevelMinXp || 0)) / levelRange : 0;
        return {
            xp: xp || 0,
            level: level || 1,
            progressPercent: Math.min(100, Math.max(0, Math.floor(levelProgress * 100)))
        };
    }, [profile]);

    // Heatmap helper (relative to average time)
    const renderHeatmap = (timeSpent, questions) => {
        const allTimes = timeSpent.filter(t => t > 0);
        const avgTime = allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 0;

        const getHeatColor = (time) => {
            if (!time || time === 0) return 'rgba(255, 255, 255, 0.05)';
            const ratio = time / avgTime;
            if (ratio < 0.5) return '#10b981';
            if (ratio < 1.0) return '#34d399';
            if (ratio < 1.5) return '#fbbf24';
            if (ratio < 2.5) return '#f97316';
            return '#ef4444';
        };

        return (
            <Card className={cx('heatmap-card', 'glass')}>
                <h3 className={cx('heatmap-title')}>🌡️ Time Difficulty Heatmap</h3>
                <p className={cx('heatmap-subtitle')}>Color shows time spent vs average ({formatTime(Math.round(avgTime))})</p>
                <div className={cx('heatmap-grid')}>
                    {questions.map((_, idx) => {
                        const time = timeSpent[idx] || 0;
                        const userAnswer = selectedExamDetail.answers?.[idx];
                        const isCorrect = userAnswer !== undefined && userAnswer === questions[idx].correctAnswer;
                        return (
                            <div
                                key={idx}
                                className={cx('heatmap-cell', userAnswer === undefined ? 'skipped' : '')}
                                style={{ background: getHeatColor(time) }}
                                title={`Q${idx + 1}: ${formatTime(time)}${userAnswer !== undefined ? (isCorrect ? ' ✅' : ' ❌') : ' (skipped)'}`}
                            >
                                <span className={cx('heatmap-num')}>{idx + 1}</span>
                                {userAnswer !== undefined && (
                                    <span className={cx('heatmap-dot', isCorrect ? 'correct' : 'wrong')}></span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className={cx('profile-container', 'animate-fade-in')}>
                <div className={cx('loading-screen')}><div className={cx('loading-spinner')} /></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cx('profile-container', 'animate-fade-in')}>
                <div className={cx('profile-header-back')}>
                    <Button variant="ghost" onClick={() => navigate('/')}><ChevronLeft size={16} /> Back</Button>
                </div>
                <Card className={cx('error-state', 'glass')}>
                    <h2>Profile Loading Error</h2>
                    <p>⚠️ {error}</p>
                    <Button variant="primary" onClick={() => navigate('/')}>Return to Lobby</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className={cx('profile-container', 'animate-fade-in')}>
            {/* Header Back Link */}
            <div className={cx('profile-header-back')}>
                <Button variant="ghost" onClick={() => navigate(-1)}><ChevronLeft size={16} /> Back</Button>
            </div>

            {/* Profile Overview Card */}
            {profile && !selectedExamDetail && !loadingExamDetail && (
                <div className={cx('profile-grid')}>
                    {/* Left Column: Profile Card + Level + Badges */}
                    <div className={cx('profile-main-col')}>
                        <Card className={cx('profile-info-card', 'glass')}>
                            <div className={cx('profile-meta-row')}>
                                <div className={cx('profile-avatar')} style={{ position: 'relative', overflow: 'hidden', cursor: (!queryEmail && !queryName) ? 'pointer' : 'default' }}>
                                    {profile.profile_pic ? (
                                        <img src={profile.profile_pic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        (profile.name || "").charAt(0).toUpperCase()
                                    )}
                                    {(!queryEmail && !queryName) && (
                                        <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} title="Change Profile Photo" />
                                    )}
                                </div>
                                <div className={cx('profile-details')}>
                                    <h2>{profile.name}</h2>
                                    <span className={cx('profile-email-text')}>{profile.email}</span>
                                    <div className={cx('profile-level-badge')}>
                                        <Sparkles size={12} className={cx('text-yellow-400')} />
                                        <span>Level {levelMetrics.level} Enthusiast</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Level and Streak Stats Row */}
                        <div className={cx('profile-stats-grid')}>
                            <Card className={cx('profile-level-card', 'glass')}>
                                <div className={cx('level-gauge-wrapper')}>
                                    <div className={cx('level-gauge')}>
                                        <svg viewBox="0 0 100 100" className={cx('radial-progress')}>
                                            <circle cx="50" cy="50" r="40" className={cx('radial-bg')} />
                                            <circle 
                                                cx="50" 
                                                cy="50" 
                                                r="40" 
                                                className={cx('radial-fill')} 
                                                style={{ strokeDasharray: `${2 * Math.PI * 40}`, strokeDashoffset: `${2 * Math.PI * 40 * (1 - levelMetrics.progressPercent / 100)}` }}
                                            />
                                        </svg>
                                        <div className={cx('level-gauge-text')}>
                                            <span className={cx('lvl-num')}>{levelMetrics.level}</span>
                                            <span className={cx('lvl-lbl')}>LEVEL</span>
                                        </div>
                                    </div>
                                    <div className={cx('level-info')}>
                                        <h3 className={cx('lvl-header')}>Rank Status</h3>
                                        <p className={cx('xp-details')}>
                                            <Sparkles size={12} className={cx('xp-icon')} /> 
                                            <strong>{levelMetrics.xp} XP</strong> total
                                        </p>
                                        <div className={cx('xp-progress-bar-bg')}>
                                            <div className={cx('xp-progress-bar-fill')} style={{ width: `${levelMetrics.progressPercent}%` }}></div>
                                        </div>
                                        <p className={cx('xp-remaining')}>
                                            {profile.nextLevelXp - levelMetrics.xp} XP to Level {levelMetrics.level + 1}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card className={cx('profile-streak-card', 'glass')}>
                                <div className={cx('streak-flame-wrapper')}>
                                    <div className={cx('streak-flame')}>
                                        <Flame size={44} className={cx('flame-icon', 'pulsing')} />
                                    </div>
                                    <div className={cx('streak-info')}>
                                        <h3 className={cx('streak-header')}>Testing Streak</h3>
                                        <span className={cx('streak-count')}>{profile.streak} Day{profile.streak !== 1 ? 's' : ''}</span>
                                        <p className={cx('streak-message')}>
                                            {profile.streak > 0 
                                                ? 'Active mock testing streak is burning bright!'
                                                : 'Take daily tests to build up a learning streak.'}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Advanced Performance Charts Widget */}
                        {history && history.length > 0 && (
                            <PerformanceCharts history={history} />
                        )}

                        {/* Consistency Calendar Widget */}
                        <div className={cx('calendar-section')}>
                            <ContributionCalendar activity={profile.activity || {}} />
                        </div>

                        {/* Badges Showcase Widget */}
                        <Card className={cx('badges-showcase-card', 'glass')}>
                            <h3>Achievements Showcase</h3>
                            <p className={cx('badges-subtitle')}>Badges unlocked by completing tests with high accuracy and speed</p>
                            
                            <div className={cx('badges-showcase-grid')}>
                                {(profile.badges || []).map((badge) => (
                                    <div 
                                        key={badge.key} 
                                        className={cx('badge-item-wrap', badge.isUnlocked ? 'unlocked' : 'locked')}
                                        onClick={() => setSelectedBadge(badge)}
                                    >
                                        <div className={cx('badge-visual-container')}>
                                            <BadgeIcon badgeKey={badge.key} size={68} animated={badge.isUnlocked} />
                                            {badge.isUnlocked && badge.earnedCount > 1 && (
                                                <div className={cx('badge-multiplier')}>x{badge.earnedCount}</div>
                                            )}
                                            {!badge.isUnlocked && (
                                                <div className={cx('badge-lock-shield')}>
                                                    <Lock size={15} className={cx('lock-svg')} />
                                                </div>
                                            )}
                                        </div>
                                        <div className={cx('badge-details-box')}>
                                            <span className={cx('badge-name-text')}>{badge.name}</span>
                                            <span className={cx('badge-desc-text')}>{badge.description}</span>
                                            {badge.isUnlocked ? (
                                                <span className={cx('badge-earned-label')}>
                                                    Unlocked {badge.earnedAt ? formatDate(badge.earnedAt) : 'Recently'}
                                                </span>
                                            ) : (
                                                <span className={cx('badge-locked-label')}>Locked</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Right Column: Recent Tests Summary */}
                    <div className={cx('profile-sidebar-col')}>
                        <Card className={cx('profile-recent-card', 'glass')}>
                            <div className={cx('sidebar-recent-header')}>
                                <BookOpen size={20} className={cx('sidebar-recent-icon')} />
                                <h3>Test History ({history.length})</h3>
                            </div>
                            
                            <div className={cx('sidebar-tests-list')}>
                                {history.length === 0 ? (
                                    <div className={cx('sidebar-tests-empty')}>
                                        <p>No test attempts found.</p>
                                    </div>
                                ) : (
                                    history.map((h) => (
                                        <div 
                                            key={h.id} 
                                            className={cx('sidebar-test-row', 'hover-lift')}
                                            onClick={() => handleSelectExam(h.id)}
                                        >
                                            <div className={cx('sidebar-test-details')}>
                                                <span className={cx('s-exam-type')}>{(h.examType || "").toUpperCase()} Mock</span>
                                                <span className={cx('s-exam-date')}>{formatDate(h.date)}</span>
                                            </div>
                                            <div className={cx('sidebar-test-score')}>
                                                <span className={cx('s-pct-badge', h.percentage >= 70 ? 'good' : h.percentage >= 40 ? 'avg' : 'low')}>
                                                    {h.percentage?.toFixed(0)}%
                                                </span>
                                                <span className={cx('s-raw-score')}>{h.score}/{h.total}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {loadingExamDetail && (
                <div className={cx('loading-screen')} style={{ minHeight: '300px' }}><div className={cx('loading-spinner')} /></div>
            )}

            {/* Detailed Exam Breakdown Review View */}
            {selectedExamDetail && !loadingExamDetail && (
                <div className={cx('profile-exam-detail', 'animate-fade-in')}>
                    <Card className={cx('exam-detail-header-card', 'glass')}>
                        <div className={cx('upm-detail-nav')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Button variant="ghost" className={cx('btn-sm')} onClick={() => setSelectedExamDetail(null)}>
                                    <ChevronLeft size={16} /> Back to Profile Summary
                                </Button>
                                <span className={cx('upm-detail-title')}>
                                    {(selectedExamDetail.examType || "").toUpperCase()} Exam Breakdown — Score: {selectedExamDetail.score}/{selectedExamDetail.total} ({selectedExamDetail.percentage}%)
                                </span>
                            </div>
                            {selectedExamDetail.isMultiplayer && selectedExamDetail.testCode && (
                                <Button variant="primary" className={cx('btn-sm')} onClick={() => loadHistoricalLeaderboard(selectedExamDetail.testCode)} disabled={loadingLeaderboard}>
                                    <Trophy size={16} style={{marginRight: '6px'}} /> {loadingLeaderboard ? 'Loading...' : 'View Multiplayer Leaderboard'}
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* Render Heatmap */}
                    {selectedExamDetail.timeSpent && renderHeatmap(selectedExamDetail.timeSpent, selectedExamDetail.questions)}

                    {/* Questions review with reattempt option */}
                    <div className={cx('upm-questions-review')}>
                        <div className={cx('review-header-row')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 className={cx('section-title')} style={{ margin: 0 }}>📋 Detailed Questions Review & Reattempt</h3>
                            <div className={cx('reattempt-toggle-container', 'glass')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>🧠 Reattempt Mode</span>
                                <label className={cx('switch')} style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={reattemptMode} 
                                        onChange={(e) => setReattemptMode(e.target.checked)} 
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span className={cx('slider')} style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: reattemptMode ? 'var(--primary)' : 'rgba(255,255,255,0.1)', transition: '.3s', borderRadius: '20px' }}>
                                        <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: reattemptMode ? '22px' : '3px', bottom: '3px', background: 'white', transition: '.3s', borderRadius: '50%' }}></span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        {selectedExamDetail.questions.map((q, idx) => {
                            const userAnswer = selectedExamDetail.answers?.[idx];
                            const isCorrect = userAnswer !== undefined && userAnswer === q.correctAnswer;
                            const isAttempted = userAnswer !== undefined && userAnswer !== -1;

                            const cardBorderClass = reattemptMode 
                                ? 'skipped-border' 
                                : (isAttempted ? (isCorrect ? 'correct-border' : 'incorrect-border') : 'skipped-border');

                            const chosenIdx = reattempts[idx];
                            const isReattempted = chosenIdx !== undefined;

                            return (
                                <Card key={idx} className={cx('review-card', cardBorderClass, 'mb-4')}>
                                    <div className={cx('review-q-header')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className={cx('q-number')}>Question {idx + 1}</span>
                                            {selectedExamDetail.timeSpent?.[idx] > 0 && (
                                                <span className={cx('q-time', 'text-slate-400')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                                    <Clock size={14} /> {formatTime(selectedExamDetail.timeSpent[idx])}
                                                </span>
                                            )}
                                        </div>
                                        {!reattemptMode && (
                                            <div className={cx('q-status')}>
                                                {!isAttempted && <span className={cx('status-badge', 'skipped')}>Skipped</span>}
                                                {isAttempted && isCorrect && <span className={cx('status-badge', 'correct')}><CheckCircle size={14} /> Correct</span>}
                                                {isAttempted && !isCorrect && <span className={cx('status-badge', 'incorrect')}><XCircle size={14} /> Incorrect</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div className={cx('review-q-text', 'mb-4')}>
                                        <QuestionRenderer text={q.text} subject={q.subject} />
                                    </div>

                                    <div className={cx('review-options', 'mb-3')}>
                                        {q.options.map((opt, optIdx) => {
                                            let optClass = "review-opt ";
                                            if (!reattemptMode) {
                                                if (optIdx === q.correctAnswer) optClass += "is-correct";
                                                else if (userAnswer === optIdx) optClass += "is-wrong";
                                            } else {
                                                optClass += "clickable ";
                                                if (isReattempted) {
                                                    if (optIdx === q.correctAnswer) optClass += "is-correct";
                                                    else if (optIdx === chosenIdx && chosenIdx !== q.correctAnswer) optClass += "is-wrong";
                                                }
                                            }

                                            return (
                                                <div 
                                                    key={optIdx} 
                                                    className={optClass}
                                                    onClick={() => {
                                                        if (reattemptMode && !isReattempted) {
                                                            setReattempts(prev => ({ ...prev, [idx]: optIdx }));
                                                        }
                                                    }}
                                                    style={{ cursor: (reattemptMode && !isReattempted) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', padding: '1rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.75rem' }}
                                                >
                                                    <span className={cx('opt-letter')} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', marginRight: '1rem', fontSize: '0.875rem', fontWeight: '600' }}>{String.fromCharCode(65 + optIdx)}</span>
                                                    <span className={cx('opt-text')} style={{ flex: 1 }}>{opt}</span>
                                                    {!reattemptMode ? (
                                                        <>
                                                            {optIdx === q.correctAnswer && <CheckCircle className={cx('opt-icon', 'success')} style={{ marginLeft: '1rem', color: '#34d399' }} size={16} />}
                                                            {userAnswer === optIdx && !isCorrect && <XCircle className={cx('opt-icon', 'danger')} style={{ marginLeft: '1rem', color: '#f87171' }} size={16} />}
                                                        </>
                                                    ) : (
                                                        isReattempted && (
                                                            <>
                                                                {optIdx === q.correctAnswer && <CheckCircle className={cx('opt-icon', 'success')} style={{ marginLeft: '1rem', color: '#34d399' }} size={16} />}
                                                                {optIdx === chosenIdx && chosenIdx !== q.correctAnswer && <XCircle className={cx('opt-icon', 'danger')} style={{ marginLeft: '1rem', color: '#f87171' }} size={16} />}
                                                            </>
                                                        )
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {reattemptMode && (
                                        <div className={cx('reattempt-feedback-row')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingBottom: '1rem', borderBottom: isReattempted && q.explanation ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                <span>First Attempt: </span>
                                                {isAttempted ? (
                                                    <span style={{ fontWeight: '600', color: isCorrect ? '#34d399' : '#f87171' }}>
                                                        Option {String.fromCharCode(65 + userAnswer)} ({isCorrect ? 'Correct' : 'Incorrect'})
                                                    </span>
                                                ) : (
                                                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>Skipped</span>
                                                )}
                                            </div>
                                            {isReattempted && (
                                                <button 
                                                    onClick={() => {
                                                        setReattempts(prev => { const upd = {...prev}; delete upd[idx]; return upd; });
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--primary)',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}
                                                >
                                                    <RefreshCw size={12} /> Try Again
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {(!reattemptMode || isReattempted) && q.explanation && (
                                        <div className={cx('explanation-box', 'mb-4')} style={{ marginTop: reattemptMode ? '1rem' : '0' }}>
                                            <h5>Explanation</h5>
                                            <p>{q.explanation}</p>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {selectedBadge && (
                <div className={cx('badge-modal-backdrop')} onClick={() => setSelectedBadge(null)}>
                    <div className={cx('badge-modal-card', 'glass')} onClick={(e) => e.stopPropagation()}>
                        <button className={cx('badge-modal-close')} onClick={() => setSelectedBadge(null)}>
                            <X size={16} />
                        </button>
                        <div className={cx('badge-modal-visual')}>
                            <BadgeIcon badgeKey={selectedBadge.key} size={80} animated={selectedBadge.isUnlocked} />
                            {!selectedBadge.isUnlocked && (
                                <div className={cx('badge-modal-lock')}>
                                    <Lock size={16} />
                                </div>
                            )}
                        </div>
                        <h3 className={cx('badge-modal-name')}>{selectedBadge.name}</h3>
                        <p className={cx('badge-modal-desc')}>{selectedBadge.description}</p>
                        
                        <div className={cx('badge-modal-status', selectedBadge.isUnlocked ? 'unlocked' : 'locked')}>
                            {selectedBadge.isUnlocked ? (
                                <>
                                    <CheckCircle size={16} />
                                    <span>Unlocked {selectedBadge.earnedAt ? formatDate(selectedBadge.earnedAt) : 'Recently'}</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={16} />
                                    <span>Locked — Complete requirements to unlock</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Historical Leaderboard Modal */}
            {historicalLeaderboard && (
                <div className={cx('modal-overlay')} onClick={() => setHistoricalLeaderboard(null)} style={{ zIndex: 9999 }}>
                    <div className={cx('modal-content', 'glass')} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', padding: '1.5rem', borderRadius: '16px' }}>
                        <div className={cx('modal-header')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}><Trophy size={24} color="#facc15" /> Multiplayer Leaderboard</h2>
                            <button className={cx('icon-btn')} onClick={() => setHistoricalLeaderboard(null)}><X size={20} /></button>
                        </div>
                        <div className={cx('modal-body')}>
                            {historicalLeaderboard.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No leaderboard data found for this room.</p>
                            ) : (
                                <div className={cx('leaderboard-list')}>
                                    {historicalLeaderboard.map((player, idx) => (
                                        <div key={player.playerId} className={cx('leaderboard-item')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', background: idx === 0 ? 'rgba(255,215,0,0.1)' : idx === 1 ? 'rgba(192,192,192,0.1)' : idx === 2 ? 'rgba(205,127,50,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div className={cx('rank-circle')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: idx === 0 ? '#facc15' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : 'rgba(255,255,255,0.1)', color: idx < 3 ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                                    {idx + 1}
                                                </div>
                                                {player.profile_pic ? (
                                                    <img src={player.profile_pic} alt="Profile" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                                                ) : (
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem' }}>
                                                        {(player.playerName || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong style={{ fontSize: '1.1rem' }}>{player.playerName}</strong>
                                                    {player.email && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{player.email}</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{player.score} <span style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>/{player.total}</span></div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                                    <Clock size={12} /> {formatTime(player.totalTime)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



class ProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Profile Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#f87171', background: 'var(--bg-color)', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>React Crash in Profile.jsx</h2>
          <p>{this.state.error && this.state.error.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', background: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children; 
  }
}
const Profile = (props) => (
  <ProfileErrorBoundary>
    <ProfileInner {...props} />
  </ProfileErrorBoundary>
);

export default Profile;

