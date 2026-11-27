import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Check, Eye } from 'lucide-react';
import QuestionRenderer from './QuestionRenderer';
import DIChartRenderer from './DIChartRenderer';
import { formatRichTextHtml, typesetMath } from '../utils/questionUtils';
import styles from '../pages/Test.module.css';
const cx = (...classes) => classes.filter(Boolean).map(c => styles[c] || c).join(' '); // Reuse Test UI styles

const SolutionsView = ({ questions, answers, timeSpent, markingScheme, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [reattemptMode, setReattemptMode] = useState(false);
    const [reattemptAnswers, setReattemptAnswers] = useState({});
    const [showSolution, setShowSolution] = useState(false);
    const contentRef = useRef(null);

    const q = questions[currentIndex];

    useEffect(() => {
        return typesetMath(contentRef.current ? [contentRef.current] : null);
    }, [currentIndex, showSolution, reattemptMode, questions]);
    
    // Original answer stats
    const originalAnswer = answers[currentIndex];
    const isAttempted = originalAnswer !== undefined && originalAnswer !== -1 && originalAnswer !== '';
    const isCorrect = isAttempted && originalAnswer === q?.correctAnswer;
    
    // Average time calculation
    const allTimes = timeSpent.filter(t => t > 0);
    const avgTime = allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 0;
    const myTime = timeSpent[currentIndex] || 0;

    const formatTime = (seconds) => {
        if (!seconds) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleOptionSelect = (optIdx) => {
        if (!reattemptMode) return;
        setReattemptAnswers(prev => ({ ...prev, [currentIndex]: optIdx }));
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setShowSolution(false);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setShowSolution(false);
        }
    };

    const toggleReattempt = () => {
        setReattemptMode(!reattemptMode);
        if (!reattemptMode) {
            setShowSolution(false); // Hide solution if turning reattempt on
        }
    };

    const getPaletteStatus = (idx) => {
        const ans = answers[idx];
        const isAnsAttempted = ans !== undefined && ans !== -1 && ans !== '';
        if (!isAnsAttempted) return 'not-answered';
        return ans === questions[idx].correctAnswer ? 'correct' : 'wrong';
    };

    // Derived classes based on reattempt / solution state
    const getOptionClass = (optIdx) => {
        const clsList = ['te-option-item'];
        
        if (showSolution || !reattemptMode) {
            // View Solution Mode: Show what the correct answer is, and what they picked
            if (optIdx === q?.correctAnswer) {
                clsList.push('reveal-correct');
            } else if (originalAnswer === optIdx && !reattemptMode) {
                clsList.push('reveal-incorrect');
            } else if (reattemptMode && reattemptAnswers[currentIndex] === optIdx) {
                clsList.push('reveal-incorrect'); // they picked wrong in reattempt mode
            }
        } else if (reattemptMode) {
            // Re-attempt Mode Active: behaving like actual test
            if (reattemptAnswers[currentIndex] === optIdx) {
                clsList.push('selected');
            }
        }

        return cx(...clsList);
    };

    return (
        <div className={cx('test-engine-container', 'animate-fade-in')} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: '#ffffff', color: '#0f172a' }}>
            <header className={cx('te-top-header')} style={{ position: 'relative' }}>
                <div className={cx('te-header-left')}>
                    <button className={cx('te-btn')} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 0.9rem', background: 'rgba(255,255,255,0.9)', color: '#0f172a', border: 'none', cursor: 'pointer' }}>
                        <ChevronLeft size={16} /> Back to Summary
                    </button>
                    <div className={cx('te-logo')} style={{ marginLeft: '1rem' }}>
                        <h1>UnMocked</h1>
                        <span>SOLUTIONS</span>
                    </div>
                </div>
            </header>

            <div className={cx('te-main-area')}>
                {/* Left Pane (Question & Explanation) */}
                <div className={cx('te-left-pane')} ref={contentRef}>
                    <div className={cx('te-question-header')} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={cx('te-question-no')}>Question No. {currentIndex + 1}</span>
                        
                        {!reattemptMode && (
                            <span style={{
                                padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                                background: !isAttempted ? 'rgba(156, 163, 175, 0.2)' : isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: !isAttempted ? '#475569' : isCorrect ? '#059669' : '#dc2626'
                            }}>
                                {!isAttempted ? 'Unattempted' : isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#475569' }}>
                            <Clock size={14} /> You: {formatTime(myTime)} | Avg: {formatTime(avgTime)}
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#0f172a' }}>Marks: <span style={{ color: '#059669', fontWeight: 'bold' }}>+{markingScheme?.correct || 1}</span> <span style={{ color: '#dc2626' }}>-{markingScheme?.incorrect || 0}</span></span>
                        </div>
                    </div>

                    <div className={cx('te-question-content')} style={{ flex: 1, overflowY: 'auto' }}>
                        {q ? (
                            <>
                                {q.passage && (
                                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', lineHeight: 1.6 }} className="math-inline-force" dangerouslySetInnerHTML={{ __html: formatRichTextHtml(q.passage) }} />
                                )}

                                <QuestionRenderer text={q.question_text || q.text || ''} theme="light" />
                                
                                {q.image_url && (
                                    <div style={{ margin: '1rem 0' }}>
                                        <img src={q.image_url} alt="Question" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    </div>
                                )}

                                {q.chartData && (
                                    <div style={{ margin: '1rem 0' }}>
                                        <DIChartRenderer chartData={q.chartData} />
                                    </div>
                                )}

                                <div className={cx('te-options-list')}>
                                    {q.options && q.options.map((opt, i) => {
                                        const optCls = getOptionClass(i);
                                        const isOptCorrect = optCls.includes('reveal-correct');
                                        const isOptWrong = optCls.includes('reveal-incorrect');
                                        return (
                                            <div 
                                                key={i} 
                                                className={optCls}
                                                onClick={() => handleOptionSelect(i)}
                                                style={{
                                                    cursor: (reattemptMode && !showSolution) ? 'pointer' : 'default',
                                                    gap: '12px'
                                                }}
                                            >
                                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#e2e8f0', color: '#0f172a', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                                <div className="math-inline-force" style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word' }} dangerouslySetInnerHTML={{ __html: formatRichTextHtml(opt) }} />
                                                {isOptCorrect && <CheckCircle size={18} color="#059669" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                                {isOptWrong && <XCircle size={18} color="#dc2626" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                                            </div>
                                        );
                                    })}
                                </div>

                                {(showSolution || !reattemptMode) && q.explanation && (
                                    <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '6px', color: '#0f172a' }}>
                                        <h4 style={{ color: '#1d4ed8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Check size={18} /> Solution & Explanation
                                        </h4>
                                        <div className="math-inline-force" style={{ lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: formatRichTextHtml(q.explanation || "No detailed explanation provided for this question.") }} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div>Loading question...</div>
                        )}
                    </div>
                    
                    {/* Bottom Action Bar inside Left Pane */}
                    <div className={cx('te-action-bar')} style={{ background: '#f8fafc', borderTop: '1px solid #cbd5e1', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <button className={cx('te-btn')} onClick={handlePrev} disabled={currentIndex === 0}>
                                <ChevronLeft size={16} /> Previous
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: reattemptMode ? 'rgba(16, 185, 129, 0.15)' : '#e2e8f0', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s' }}>
                                <input 
                                    type="checkbox" 
                                    checked={reattemptMode} 
                                    onChange={toggleReattempt} 
                                    style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: reattemptMode ? '#059669' : '#475569' }}>Re-attempt Mode</span>
                            </label>
                            
                            {reattemptMode && !showSolution && (
                                <button className={cx('te-btn', 'submit')} onClick={() => setShowSolution(true)} style={{ background: '#3b82f6', color: '#fff' }}>
                                    <Eye size={16} /> View Solution
                                </button>
                            )}

                            <button className={cx('te-btn')} onClick={handleNext} disabled={currentIndex === questions.length - 1}>
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Pane (Palette) */}
                <div className={cx('te-right-pane')}>
                    <div className={cx('te-palette-section')} style={{ flex: 1, overflowY: 'auto' }}>
                        <div className={cx('te-palette-header')}>
                            <h3>Question Palette</h3>
                        </div>
                        
                        <div className={cx('te-palette-legend')} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%' }}></div> Correct
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%' }}></div> Incorrect
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '12px', height: '12px', background: 'var(--card-bg)', border: '1px solid var(--text-muted)', borderRadius: '50%' }}></div> Unattempted
                            </div>
                        </div>

                        <div className={cx('te-palette-grid')}>
                            {questions.map((_, i) => {
                                const status = getPaletteStatus(i);
                                let bg = 'var(--card-bg)';
                                let color = 'var(--text-primary)';
                                let border = '1px solid var(--card-border)';

                                if (status === 'correct') {
                                    bg = '#10b981';
                                    color = 'white';
                                    border = '1px solid #059669';
                                } else if (status === 'wrong') {
                                    bg = '#ef4444';
                                    color = 'white';
                                    border = '1px solid #dc2626';
                                }

                                const isActive = i === currentIndex;

                                return (
                                    <button 
                                        key={i} 
                                        className={cx('te-palette-btn')}
                                        onClick={() => {
                                            setCurrentIndex(i);
                                            setShowSolution(false);
                                        }}
                                        style={{
                                            background: bg,
                                            color: color,
                                            border: border,
                                            transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                            boxShadow: isActive ? '0 0 0 2px var(--bg-color), 0 0 0 4px var(--primary)' : 'none',
                                            transition: 'all 0.2s',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SolutionsView;
