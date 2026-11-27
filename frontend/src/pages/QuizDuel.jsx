import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatRichTextHtml, typesetMath } from '../utils/questionUtils';
import './QuizDuel.css';

const QuizDuel = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [quizData, setQuizData] = useState(null);
  const [phase, setPhase] = useState('ready');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [player1Ready, setPlayer1Ready] = useState(false);
  const [player2Ready, setPlayer2Ready] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(15);
  const [player1Answer, setPlayer1Answer] = useState(null);
  const [player2Answer, setPlayer2Answer] = useState(null);
  const [player1AnswerTime, setPlayer1AnswerTime] = useState(null);
  const [player2AnswerTime, setPlayer2AnswerTime] = useState(null);
  const [p1Delta, setP1Delta] = useState(null);
  const [p2Delta, setP2Delta] = useState(null);
  const [revealCountdown, setRevealCountdown] = useState(5);
  const [questionAnim, setQuestionAnim] = useState(false);
  const [history, setHistory] = useState([]);

  // Use refs to track synchronous answers/times for scoring without functional updater side-effects
  const p1AnsRef = useRef(null);
  const p2AnsRef = useRef(null);
  const p1TimeRef = useRef(null);
  const p2TimeRef = useRef(null);

  const timerRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const revealTimerRef = useRef(null);

  useEffect(() => {
    try {
      const reviewId = searchParams.get('reviewId');
      if (reviewId) {
        const histStr = localStorage.getItem('quiz_duel_match_history');
        if (histStr) {
          const histArr = JSON.parse(histStr);
          const match = histArr.find(m => m.id === reviewId);
          if (match) {
            setPlayer1Score(match.p1Score);
            setPlayer2Score(match.p2Score);
            setHistory(match.history);
            setQuizData({ questions: [] }); // Dummy to bypass error screen
            setPhase('review');
            return;
          }
        }
      }

      const dataStr = localStorage.getItem('quiz_duel_data');
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data && data.questions && data.questions.length > 0) {
          setQuizData(data);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse quiz duel data', e);
    }
    setQuizData(null);
  }, [searchParams]);

  // LaTeX support via MathJax
  useEffect(() => {
    return typesetMath();
  }, [currentQuestionIndex, phase, quizData, history]);

  // Save match history when game over
  useEffect(() => {
    if (phase === 'gameover' && quizData) {
      try {
        const prevStr = localStorage.getItem('quiz_duel_match_history');
        const historyArr = prevStr ? JSON.parse(prevStr) : [];
        historyArr.unshift({
          id: `qd-${Date.now()}`,
          date: new Date().toISOString(),
          topics: quizData.topics || 'General Knowledge',
          p1Score: player1Score,
          p2Score: player2Score,
          questionsCount: quizData.questions.length,
          history: history
        });
        localStorage.setItem('quiz_duel_match_history', JSON.stringify(historyArr));
      } catch (e) {
        console.error('Failed to save quiz duel history', e);
      }
    }
  }, [phase]); // Only run when phase becomes gameover

  useEffect(() => {
    if (phase === 'ready' && player1Ready && player2Ready) {
      setPhase('countdown');
      setCountdown(3);
    }
  }, [player1Ready, player2Ready, phase]);

  useEffect(() => {
    if (phase === 'countdown') {
      if (countdown > 0) {
        phaseTimerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else {
        startQuestion();
      }
    }
    return () => clearTimeout(phaseTimerRef.current);
  }, [countdown, phase]);

  const startQuestion = useCallback(() => {
    setPhase('playing');
    setTimeLeft(15);
    setPlayer1Answer(null);
    setPlayer2Answer(null);
    setPlayer1AnswerTime(null);
    setPlayer2AnswerTime(null);
    p1AnsRef.current = null;
    p2AnsRef.current = null;
    p1TimeRef.current = null;
    p2TimeRef.current = null;
    setP1Delta(null);
    setP2Delta(null);
    setQuestionAnim(true);
    setTimeout(() => setQuestionAnim(false), 500);
  }, []);

  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            triggerReveal();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && player1Answer !== null && player2Answer !== null) {
      clearInterval(timerRef.current);
      triggerReveal();
    }
  }, [player1Answer, player2Answer, phase]);

  const triggerReveal = useCallback(() => {
    setPhase('reveal');
    setRevealCountdown(5);
    setTimeout(() => {
      calculateAndApplyScore();
    }, 50);
  }, [quizData, currentQuestionIndex]);

  const calculateAndApplyScore = () => {
    const currentQ = quizData?.questions[currentQuestionIndex];
    if (!currentQ) return;
    
    const correctAns = currentQ.answer;
    const p1Ans = p1AnsRef.current;
    const p2Ans = p2AnsRef.current;
    const p1Time = p1TimeRef.current;
    const p2Time = p2TimeRef.current;

    const p1Correct = p1Ans === correctAns;
    const p2Correct = p2Ans === correctAns;
    const p1Answered = p1Ans !== null && p1Ans !== 'SKIP';
    const p2Answered = p2Ans !== null && p2Ans !== 'SKIP';

    let p1Pts = 0, p2Pts = 0;

    if (p1Correct && p2Correct) {
      if (p1Time && p2Time && p1Time < p2Time) {
        p1Pts = 1; p2Pts = 0.5;
      } else if (p1Time && p2Time && p2Time < p1Time) {
        p1Pts = 0.5; p2Pts = 1;
      } else {
        p1Pts = 1; p2Pts = 1;
      }
    } else if (p1Correct && !p2Correct) {
      p1Pts = 1;
      p2Pts = p2Answered ? -0.5 : 0;
    } else if (!p1Correct && p2Correct) {
      p1Pts = p1Answered ? -0.5 : 0;
      p2Pts = 1;
    } else {
      p1Pts = p1Answered ? -0.5 : 0;
      p2Pts = p2Answered ? -0.5 : 0;
    }

    setP1Delta(p1Pts);
    setP2Delta(p2Pts);
    setPlayer1Score(prev => prev + p1Pts);
    setPlayer2Score(prev => prev + p2Pts);

    setHistory(prev => [...prev, {
      question: currentQ,
      p1Answer: p1Ans,
      p2Answer: p2Ans,
      correct: correctAns,
      p1Pts,
      p2Pts
    }]);
  };

  useEffect(() => {
    if (phase === 'reveal') {
      revealTimerRef.current = setInterval(() => {
        setRevealCountdown(prev => {
          if (prev <= 1) {
            clearInterval(revealTimerRef.current);
            if (currentQuestionIndex + 1 < quizData.questions.length) {
              setCurrentQuestionIndex(i => i + 1);
              startQuestion();
            } else {
              setPhase('gameover');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(revealTimerRef.current);
  }, [phase, currentQuestionIndex, quizData, startQuestion]);

  const handlePlayer1Tap = (idx) => {
    if (phase !== 'playing' || player1Answer !== null) return;
    const ans = ['A', 'B', 'C', 'D'][idx];
    const now = Date.now();
    setPlayer1Answer(ans);
    setPlayer1AnswerTime(now);
    p1AnsRef.current = ans;
    p1TimeRef.current = now;
  };

  const handlePlayer2Tap = (idx) => {
    if (phase !== 'playing' || player2Answer !== null) return;
    const ans = ['A', 'B', 'C', 'D'][idx];
    const now = Date.now();
    setPlayer2Answer(ans);
    setPlayer2AnswerTime(now);
    p2AnsRef.current = ans;
    p2TimeRef.current = now;
  };

  const handlePlayer1Skip = () => {
    if (phase !== 'playing' || player1Answer !== null) return;
    setPlayer1Answer('SKIP');
    p1AnsRef.current = 'SKIP';
  };

  const handlePlayer2Skip = () => {
    if (phase !== 'playing' || player2Answer !== null) return;
    setPlayer2Answer('SKIP');
    p2AnsRef.current = 'SKIP';
  };

  const resetGame = () => {
    setPhase('ready');
    setCurrentQuestionIndex(0);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setPlayer1Ready(false);
    setPlayer2Ready(false);
    setHistory([]);
    setP1Delta(null);
    setP2Delta(null);
  };

  const exitGame = () => navigate('/home');

  if (quizData === null) {
    return (
      <div className="qd-error-screen">
        <div className="qd-error-icon">❌</div>
        <h2>No quiz data found</h2>
        <p>Go back and set up a quiz first.</p>
        <button onClick={exitGame} className="qd-btn qd-btn-exit">Go to Home</button>
      </div>
    );
  }

  const currentQ = quizData.questions[currentQuestionIndex];
  const optionsMap = ['A', 'B', 'C', 'D'];

  // ───── Review Screen ─────
  if (phase === 'review') {
    return (
      <div className="qd-review-screen">
        <div className="qd-review-header">
          <h1 className="geist-pixel qd-review-title">📋 Quiz Review</h1>
          <div className="qd-review-scores">
            <span className="qd-review-p1-score">🔵 P1: {player1Score.toFixed(1)}</span>
            <span className="qd-review-vs">vs</span>
            <span className="qd-review-p2-score">🟠 P2: {player2Score.toFixed(1)}</span>
          </div>
          <div className="qd-review-actions">
            <button onClick={resetGame} className="qd-btn qd-btn-play">🔄 Play Again</button>
            <button onClick={exitGame} className="qd-btn qd-btn-exit">🚪 Exit</button>
          </div>
        </div>
        <div className="qd-review-list">
          {history.map((h, idx) => (
            <div key={idx} className="qd-review-card">
              <div className="qd-review-card-header">
                <span className="qd-review-qnum">Q{idx + 1}</span>
                <div className="qd-review-card-scores">
                  <span className={`qd-review-pts ${h.p1Pts > 0 ? 'pos' : h.p1Pts < 0 ? 'neg' : ''}`}>
                    🔵 {h.p1Pts > 0 ? '+' : ''}{h.p1Pts.toFixed(1)}
                  </span>
                  <span className={`qd-review-pts ${h.p2Pts > 0 ? 'pos' : h.p2Pts < 0 ? 'neg' : ''}`}>
                    🟠 {h.p2Pts > 0 ? '+' : ''}{h.p2Pts.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="qd-review-qtext math-inline-force" dangerouslySetInnerHTML={{ __html: formatRichTextHtml(h.question.text) }} />
              <div className="qd-review-options">
                {h.question.options.map((opt, oi) => {
                  const letter = optionsMap[oi];
                  let cls = 'qd-review-opt';
                  if (letter === h.correct) cls += ' correct';
                  if (letter === h.p1Answer && letter !== h.correct) cls += ' p1-wrong';
                  if (letter === h.p2Answer && letter !== h.correct) cls += ' p2-wrong';
                  const markers = [];
                  if (letter === h.p1Answer) markers.push('🔵');
                  if (letter === h.p2Answer) markers.push('🟠');
                  return (
                    <div key={oi} className={cls}>
                      <span className="qd-review-opt-letter">{letter}.</span>
                      <span className="qd-review-opt-text math-inline-force" dangerouslySetInnerHTML={{ __html: formatRichTextHtml(opt) }} />
                      {markers.length > 0 && <span className="qd-review-markers">{markers.join(' ')}</span>}
                    </div>
                  );
                })}
              </div>
              {(h.p1Answer === 'SKIP' || h.p2Answer === 'SKIP' || h.p1Answer === null || h.p2Answer === null) && (
                <div className="qd-review-skip-info">
                  {h.p1Answer === 'SKIP' && <span>🔵 Skipped</span>}
                  {h.p1Answer === null && <span>🔵 Timed out</span>}
                  {h.p2Answer === 'SKIP' && <span>🟠 Skipped</span>}
                  {h.p2Answer === null && <span>🟠 Timed out</span>}
                </div>
              )}
              {h.question.explanation && (
                <div className="qd-review-explanation math-inline-force" dangerouslySetInnerHTML={{ __html: `💡 ${formatRichTextHtml(h.question.explanation)}` }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ───── Player Half Renderer ─────
  const renderPlayerHalf = (playerNum) => {
    const isP1 = playerNum === 1;
    const score = isP1 ? player1Score : player2Score;
    const ready = isP1 ? player1Ready : player2Ready;
    const setReady = isP1 ? setPlayer1Ready : setPlayer2Ready;
    const answer = isP1 ? player1Answer : player2Answer;
    const handleTap = isP1 ? handlePlayer1Tap : handlePlayer2Tap;
    const handleSkip = isP1 ? handlePlayer1Skip : handlePlayer2Skip;
    const delta = isP1 ? p1Delta : p2Delta;
    const themeClass = isP1 ? 'qd-p1-theme' : 'qd-p2-theme';

    if (phase === 'ready') {
      return (
        <div className={`qd-half ${themeClass}`}>
          <div className="qd-ready-container">
            <div className="qd-ready-label geist-pixel">{isP1 ? 'PLAYER 1' : 'PLAYER 2'}</div>
            <button className={`qd-ready-btn ${ready ? 'ready' : ''}`} onPointerDown={() => setReady(true)}>
              {ready ? '✓ READY!' : '👆 TAP TO READY'}
            </button>
          </div>
        </div>
      );
    }

    if (phase === 'countdown') {
      return (
        <div className={`qd-half ${themeClass}`}>
          <div className="qd-countdown-display geist-pixel">
            <span className="qd-countdown-num" key={countdown}>{countdown > 0 ? countdown : '⚡GO!'}</span>
          </div>
        </div>
      );
    }

    if (phase === 'gameover') {
      const isWinner = isP1 ? player1Score > player2Score : player2Score > player1Score;
      const isTie = player1Score === player2Score;
      return (
        <div className={`qd-half ${themeClass}`}>
          <div className="qd-gameover-content">
            <div className="qd-gameover-emoji">{isTie ? '🤝' : (isWinner ? '🏆' : '😔')}</div>
            <h1 className="geist-pixel qd-result-title">{isTie ? 'TIE GAME!' : (isWinner ? 'YOU WIN!' : 'YOU LOSE')}</h1>
            <div className="qd-final-score geist-pixel">{score.toFixed(1)} pts</div>
            <div className="qd-gameover-actions">
              <button onPointerDown={resetGame} className="qd-btn qd-btn-play">🔄 Again</button>
              <button onPointerDown={() => setPhase('review')} className="qd-btn qd-btn-review">📋 Review</button>
              <button onPointerDown={exitGame} className="qd-btn qd-btn-exit">🚪 Exit</button>
            </div>
          </div>
        </div>
      );
    }

    // Playing / Reveal
    const isRevealing = phase === 'reveal';
    const answered = answer !== null;
    const skipped = answer === 'SKIP';

    return (
      <div className={`qd-half ${themeClass}`}>
        <div className="qd-play-header">
          <div className="qd-score-badge geist-pixel">{score.toFixed(1)}</div>
          {isRevealing && delta !== null && (
            <div className={`qd-point-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero'}`} key={currentQuestionIndex}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </div>
          )}
        </div>

        <div className={`qd-question-area ${questionAnim ? 'slide-in' : ''}`}>
          <div className="qd-question-text math-inline-force" dangerouslySetInnerHTML={{ __html: formatRichTextHtml(currentQ.text) }} />
        </div>

        <div className="qd-options-grid">
          {currentQ.options.map((optText, idx) => {
            const optLetter = optionsMap[idx];
            let cls = 'qd-option';
            if (answer === optLetter) cls += ' selected';
            if (skipped) cls += ' dimmed';
            if (isRevealing) {
              if (currentQ.answer === optLetter) cls += ' correct';
              else if (answer === optLetter && currentQ.answer !== optLetter) cls += ' wrong';
              if (!answered && currentQ.answer !== optLetter) cls += ' dimmed';
            }
            return (
              <button key={idx} className={cls} onPointerDown={() => handleTap(idx)} disabled={isRevealing || answered}>
                <span className="qd-opt-letter">{optLetter}</span>
                <span className="qd-opt-text math-inline-force" dangerouslySetInnerHTML={{ __html: formatRichTextHtml(optText) }} />
              </button>
            );
          })}
        </div>

        <div className="qd-bottom-bar">
          {!isRevealing && !answered && (
            <button className="qd-skip-btn" onPointerDown={handleSkip}>SKIP →</button>
          )}
          {isRevealing && skipped && <div className="qd-status-label skipped">⏭ Skipped</div>}
          {answered && !isRevealing && !skipped && <div className="qd-status-label waiting">⏳ Waiting...</div>}
          {answered && !isRevealing && skipped && <div className="qd-status-label waiting">⏳ Waiting...</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="qd-container">
      <div className="qd-player-top">
        {renderPlayerHalf(1)}
      </div>
      <div className="qd-center-divider">
        <div className="qd-center-content">
          <div className="qd-center-p1">
            <span className="qd-center-label">P1</span>
            <span className="qd-center-score">{player1Score.toFixed(1)}</span>
          </div>
          <div className="qd-center-middle">
            {phase === 'playing' && (
              <div className={`qd-center-timer ${timeLeft <= 5 ? 'urgent' : ''}`}>{timeLeft}s</div>
            )}
            {phase === 'reveal' && (
              <div className="qd-center-timer reveal-timer">Next in {revealCountdown}s</div>
            )}
            <div className="qd-center-qnum geist-pixel">Q{currentQuestionIndex + 1} / {quizData.questions.length}</div>
          </div>
          <div className="qd-center-p2">
            <span className="qd-center-label">P2</span>
            <span className="qd-center-score">{player2Score.toFixed(1)}</span>
          </div>
        </div>
      </div>
      <div className="qd-player-bottom">
        {renderPlayerHalf(2)}
      </div>
    </div>
  );
};

export default QuizDuel;
