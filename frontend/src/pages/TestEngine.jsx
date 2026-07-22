import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Clock, CheckCircle2, AlertCircle, Bookmark, ChevronRight, XCircle, MessageCircle, BarChart2, Users, FastForward, Send } from 'lucide-react';
import { socket } from '../socket';
import Results from '../components/Results';
import DIChartRenderer from '../components/DIChartRenderer';
import '../TestEngine.css';

const formatHtml = (text) => text ? text.replace(/\\n/g, '<br/>').replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : '';

export default function TestEngine() {
  const navigate = useNavigate();
  const { resultId, sessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'instructions';
  const [testData, setTestData] = useState(null);
  
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  
  const [answers, setAnswers] = useState({}); // { [qId]: 'A' }
  const [statusMap, setStatusMap] = useState({}); // { [qId]: 'answered' | 'review' | 'not_answered' }
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [instructionsAccepted, setInstructionsAccepted] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [testSessionId, setTestSessionId] = useState('');
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [pastRoomResults, setPastRoomResults] = useState(null);
  
  const [timeSpentMap, setTimeSpentMap] = useState({});
  const [reviewUserName, setReviewUserName] = useState('');

  // --- Multiplayer & Modes State ---
  const currentUser = JSON.parse(localStorage.getItem('unmocked_user') || '{}');
  const [gameMode, setGameMode] = useState('Solo-Real');
  const [room, setRoom] = useState(null);
  
  const [friendlyRevealed, setFriendlyRevealed] = useState({}); // { [qId]: true }
  
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);
  const [latestMessage, setLatestMessage] = useState(null);
  const showChatRef = useRef(false);
  const latestMessageTimerRef = useRef(null);
  
  const [liveStats, setLiveStats] = useState({});
  const [showLiveStats, setShowLiveStats] = useState(false);
  
  const [friendlyWaitingData, setFriendlyWaitingData] = useState({ submitted: 0, total: 0 });
  const [rightPanelTab, setRightPanelTab] = useState('status'); // 'status' or 'grid'
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [friendlyTimer, setFriendlyTimer] = useState(0);
  const [roomStatusData, setRoomStatusData] = useState([]);
  const messagesEndRef = useRef(null);
  
  const isMultiplayer = gameMode.startsWith('Multiplayer');
  const isFriendly = gameMode.endsWith('Friendly');
  const isHost = room && room.host.id === currentUser.id;

  useEffect(() => {
    if (room) {
      const users = [];
      if (room.host && room.host.name) {
        users.push({ id: room.host.id, name: room.host.name, profile_pic: room.host.profile_pic, isHost: true });
      }
      if (room.guests) {
        room.guests.forEach(g => users.push({ id: g.id, name: g.name, profile_pic: g.profile_pic, isHost: false }));
      }
      setRoomStatusData(users);
    }
  }, [room]);

  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch((err) => console.error('MathJax error:', err));
    }
  }, [currentQuestionIdx, currentSectionIdx, testData, isSubmitted, friendlyRevealed, showInstructions]);

  useEffect(() => {
    if (resultId) {
      // Load past test from backend
      fetch(`/api/test-results/detail/${resultId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            alert('Past test not found');
            navigate('/home');
            return;
          }
          if (!data.test_data || data.test_data === '{}') {
            alert('Detailed review is not available for this older test.');
            navigate('/home');
            return;
          }
          const parsedData = JSON.parse(data.test_data);
          if (!parsedData || !parsedData.sections) {
            alert('Test data is corrupted or incomplete.');
            navigate('/home');
            return;
          }
          setTestData(parsedData);
          setGameMode(data.game_mode);
          setAnswers(JSON.parse(data.answers || '{}'));
          setStatusMap(JSON.parse(data.status_map || '{}'));
          setScoreData({
            correct: data.correct,
            incorrect: data.incorrect,
            unattempted: data.unattempted,
            total: data.total_questions,
            marks: data.score,
            mc: parsedData.blueprint?.marks_correct || 1,
            mi: parsedData.blueprint?.marks_incorrect || 0.25
          });
          if (data.time_spent) setTimeSpentMap(JSON.parse(data.time_spent));
          if (data.user_name) setReviewUserName(data.user_name);
          setIsSubmitted(false);
          setReviewMode(true);
          
          if (data.game_mode === 'Multiplayer-Friendly' && data.test_session_id) {
             fetch(`/api/public/history-rooms/${data.test_session_id}`)
               .then(r => r.json())
               .then(roomData => {
                  setPastRoomResults(roomData);
                  const revealed = {};
                  parsedData.sections.forEach(s => s.questions.forEach(q => revealed[q.id] = true));
                  setFriendlyRevealed(revealed);
               })
               .catch(e => console.error(e));
          }
          setSearchParams({ view: 'review' });
        })
        .catch(err => {
          console.error(err);
          navigate('/home');
        });
      return;
    }

    // Check if resuming a saved test
    const resumeId = new URLSearchParams(window.location.search).get('resumeId');
    if (resumeId) {
      fetch(`/api/test-session/saved-detail/${resumeId}`)
        .then(r => r.json())
        .then(saved => {
          if (saved.error) { alert('Saved test not found.'); navigate('/home'); return; }
          const td = JSON.parse(saved.test_data);
          setTestData(td);
          setGameMode(saved.game_mode || 'Solo-Real');
          setTestSessionId(saved.session_id);
          setAnswers(JSON.parse(saved.answers || '{}'));
          setStatusMap(JSON.parse(saved.status_map || '{}'));
          setTimeSpentMap(JSON.parse(saved.time_spent_map || '{}'));
          setCurrentSectionIdx(saved.current_section || 0);
          setCurrentQuestionIdx(saved.current_question || 0);
          if (saved.time_left > 0) setTimeLeft(saved.time_left);
          else if (td.blueprint?.has_sectional_timing) setTimeLeft((td.sections[saved.current_section || 0]?.duration || 15) * 60);
          else setTimeLeft((td.blueprint?.total_duration || 60) * 60);
          localStorage.setItem('active_test_data', JSON.stringify(td));
          localStorage.setItem('test_game_mode', saved.game_mode || 'Solo-Real');
          localStorage.setItem('current_test_session_id', saved.session_id);
          localStorage.removeItem('multiplayer_room');
          // Delete the saved session since it's being resumed
          fetch(`/api/test-session/saved/${resumeId}`, { method: 'DELETE' }).catch(() => {});
          setSearchParams({ view: 'play' });
        })
        .catch(() => { navigate('/home'); });
      return;
    }

    const data = JSON.parse(localStorage.getItem('active_test_data'));
    const mpRoom = JSON.parse(localStorage.getItem('multiplayer_room'));
    const mode = mpRoom ? mpRoom.mode : (localStorage.getItem('test_game_mode') || 'Solo-Real');
    
    if (!data) {
      navigate('/home');
      return;
    }
    
    setTestData(data);
    setGameMode(mode);
    if (mpRoom) {
      setRoom(mpRoom);
      setLiveStats(mpRoom.stats || {});
      setTestSessionId(mpRoom.code); // Shared test session ID for everyone in the room
      socket.emit('joinRoom', { code: mpRoom.code, user: currentUser });
      if (mpRoom.state === 'FINISHED') {
        setIsSubmitted(true);
      }
    } else {
      setTestSessionId(sessionId || localStorage.getItem('current_test_session_id') || 'solo-' + Date.now());
    }

    const savedProgress = localStorage.getItem('test_progress_' + (sessionId || mpRoom?.code || ''));
    if (savedProgress) {
        try {
            const p = JSON.parse(savedProgress);
            if (p.currentSectionIdx !== undefined) setCurrentSectionIdx(p.currentSectionIdx);
            if (p.currentQuestionIdx !== undefined) setCurrentQuestionIdx(p.currentQuestionIdx);
            if (p.timeLeft !== undefined && p.timeLeft > 0) setTimeLeft(p.timeLeft);
        } catch(e) {}
    } else if (!mode.endsWith('Friendly')) {
      if (data.blueprint.has_sectional_timing) {
        setTimeLeft((data.sections[0].duration || 15) * 60);
      } else {
        setTimeLeft((data.blueprint.total_duration || 60) * 60);
      }
    }
  }, [navigate, sessionId]);

  useEffect(() => {
    if (currentView === 'instructions') {
      setShowInstructions(true);
      setIsSubmitted(false);
      setReviewMode(false);
    } else if (currentView === 'play') {
      setShowInstructions(false);
      setIsSubmitted(false);
      setReviewMode(false);
    } else if (currentView === 'results') {
      setShowInstructions(false);
      setIsSubmitted(true);
      setReviewMode(false);
    } else if (currentView === 'review') {
      setShowInstructions(false);
      setIsSubmitted(false);
      setReviewMode(true);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView === 'play' && testSessionId) {
       localStorage.setItem('test_progress_' + testSessionId, JSON.stringify({
          currentSectionIdx,
          currentQuestionIdx,
          timeLeft
       }));
    }
  }, [currentSectionIdx, currentQuestionIdx, timeLeft, currentView, testSessionId]);

  useEffect(() => {
    if (!testSessionId || !currentUser.id) return;
    
    // Save to local storage for solo mode persistence
    localStorage.setItem('current_test_session_id', testSessionId);

    // Check if the user already submitted this test session
    fetch(`/api/test-results/session/${testSessionId}?userId=${currentUser.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Not submitted');
        return res.json();
      })
      .then(data => {
         // User already finished! Load their result data and show results view
         setAnswers(JSON.parse(data.answers || '{}'));
         setStatusMap(JSON.parse(data.status_map || '{}'));
         if (data.time_spent) setTimeSpentMap(JSON.parse(data.time_spent));
         
         const parsedData = JSON.parse(data.test_data || '{}');
         setScoreData({
            correct: data.correct,
            incorrect: data.incorrect,
            unattempted: data.unattempted,
            total: data.total_questions,
            marks: data.score,
            mc: parsedData.blueprint?.marks_correct || 1,
            mi: parsedData.blueprint?.marks_incorrect || 0.25
         });
         
         setIsSubmitted(true);
         setSearchParams({ view: 'results' });
         setSessionLoaded(true);
      })
      .catch(() => {
        // Not submitted yet, load active session progress
        fetch(`/api/test-session/${testSessionId}?userId=${currentUser.id}`)
          .then(res => {
            if (!res.ok) throw new Error('No session');
            return res.json();
          })
          .then(data => {
            const localSession = JSON.parse(localStorage.getItem(`unmocked_session_${testSessionId}`) || '{}');
            const mergedAnswers = { ...(data.answers || {}), ...(localSession.answers || {}) };
            const mergedStatus = { ...(data.status_map || {}), ...(localSession.status_map || {}) };

            if (Object.keys(mergedAnswers).length > 0 || Object.keys(mergedStatus).length > 0) {
              setAnswers(mergedAnswers);
              setStatusMap(mergedStatus);
              
              const mpRoom = JSON.parse(localStorage.getItem('multiplayer_room'));
              const td = JSON.parse(localStorage.getItem('active_test_data'));
              if (mpRoom && td) {
                  let attempted = 0, skipped = 0, right = 0, wrong = 0;
                  td.sections.forEach(sec => {
                    sec.questions.forEach(q => {
                      const userAns = mergedAnswers[q.id];
                      const status = mergedStatus[q.id];
                      if (status === 'answered' || status === 'review') {
                        if (userAns) {
                          attempted++;
                          if (userAns === q.answer) right++;
                          else wrong++;
                        }
                      } else if (status === 'not_answered') {
                        skipped++;
                      }
                    });
                  });
                  const accuracy = attempted > 0 ? ((right / attempted) * 100) : 0;
                  socket.emit('submitStats', { code: mpRoom.code, userId: currentUser.id, statsUpdate: { attempted, skipped, right, wrong, accuracy } });
              }
            }
          })
          .catch(err => { 
            const localSession = JSON.parse(localStorage.getItem(`unmocked_session_${testSessionId}`) || '{}');
            if (localSession.answers && localSession.status_map) {
              setAnswers(localSession.answers);
              setStatusMap(localSession.status_map);
            }
          })
          .finally(() => setSessionLoaded(true));
      });
  }, [testSessionId]);

  useEffect(() => {
    if (reviewMode && gameMode === 'Multiplayer-Friendly' && pastRoomResults && testData && testData.sections) {
      const currentQuestion = testData.sections[currentSectionIdx]?.questions[currentQuestionIdx];
      if (currentQuestion) {
        const newRoomStatusData = pastRoomResults.map(pr => {
          let submitted = null;
          try {
            const ans = pr.answers ? (typeof pr.answers === 'string' ? JSON.parse(pr.answers) : pr.answers) : {};
            const ts = pr.time_spent ? (typeof pr.time_spent === 'string' ? JSON.parse(pr.time_spent) : pr.time_spent) : {};
            const qId = currentQuestion.id;
            
            if (ans[qId] !== undefined) {
              submitted = { answer: ans[qId], timeTaken: ts[qId] || 0 };
            }
          } catch(e) {}
          
          return {
            id: pr.user_id,
            name: pr.user_name || pr.user_email || 'Unknown Player',
            profile_pic: pr.user_profile_pic,
            isHost: false,
            submitted: submitted
          };
        });
        setRoomStatusData(newRoomStatusData);
      }
    }
  }, [currentQuestionIdx, currentSectionIdx, pastRoomResults, reviewMode, gameMode, testData]);

  useEffect(() => {
    if (!testSessionId || !currentUser.id || isSubmitted || !sessionLoaded) return;
    
    // Save locally immediately as a fallback against network disconnects
    localStorage.setItem(`unmocked_session_${testSessionId}`, JSON.stringify({ answers, status_map: statusMap }));

    // Debounce the save to prevent spamming the server
    const timer = setTimeout(() => {
      fetch('/api/test-session/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: testSessionId,
          user_id: currentUser.id,
          answers,
          status_map: statusMap
        })
      }).catch(err => console.error('Failed to save session', err));
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [answers, statusMap, testSessionId, isSubmitted]);

  useEffect(() => {
    if (!isMultiplayer || !room) return;
    
    const handleConnect = () => {
      socket.emit('joinRoom', { code: room.code, user: currentUser });
    };
    socket.on('connect', handleConnect);

    socket.on('statsUpdated', (stats) => setLiveStats(stats));
    socket.on('chatMessage', (msg) => {
      setChatMessages(prev => [...prev, msg]);
      if (!showChatRef.current) {
        setUnreadChat(true);
        setLatestMessage(msg);
        if (latestMessageTimerRef.current) {
          clearTimeout(latestMessageTimerRef.current);
        }
        latestMessageTimerRef.current = setTimeout(() => {
          setLatestMessage(null);
        }, 4000);
      }
    });
    socket.on('testFinished', () => {
      // Host ended the exam, auto submit without blocking alert
      submitTest();
    });
    socket.on('multiplayerTestStarted', () => {
      setSearchParams({ view: 'play' });
    });
    
    if (isFriendly) {
      socket.on('friendlySubmissionCount', (submitted, total) => {
        setFriendlyWaitingData({ submitted, total });
      });

      socket.on('friendlyStatusUpdate', (data) => {
        setRoomStatusData(data);
      });

      socket.on('roomError', (errMsg) => {
         alert(errMsg);
         navigate('/home');
      });

      socket.on('friendlyReveal', () => {
         setFriendlyRevealed(prev => {
            const currentQId = testData.sections[currentSectionIdx].questions[currentQuestionIdx].id;
            return { ...prev, [currentQId]: true };
         });
         setFriendlyWaitingData({ submitted: 0, total: 0 });
      });
      socket.on('friendlyNextQuestion', ({ secIdx, qIdx }) => {
         setCurrentSectionIdx(secIdx);
         setCurrentQuestionIdx(qIdx);
         setQuestionStartTime(Date.now());
         setFriendlyTimer(0);
      });
      socket.on('friendlyRejoinWaiting', ({ ans, qId }) => {
         // The server says we already submitted for this question before we disconnected.
         if (qId) {
            setAnswers(prev => ({ ...prev, [qId]: ans }));
            setFriendlyRevealed(prev => ({ ...prev, [qId]: 'waiting' }));
         }
      });
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('statsUpdated');
      socket.off('chatMessage');
      socket.off('testFinished');
      socket.off('friendlySubmissionCount');
      socket.off('friendlyReveal');
      socket.off('friendlyNextQuestion');
      socket.off('friendlyRejoinWaiting');
    }
  }, [isMultiplayer, isFriendly, room, testData, currentSectionIdx, currentQuestionIdx]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    showChatRef.current = showChat;
    if (showChat) setUnreadChat(false);
  }, [chatMessages, showChat]);

  useEffect(() => {
    if (isSubmitted || reviewMode || !testData || showInstructions) return;
    
    // Time tracking map updates every second for the active question
    const sec = testData.sections[currentSectionIdx];
    const qId = sec?.questions[currentQuestionIdx]?.id;
    
    let timer;
    if (qId && !(isFriendly && friendlyRevealed[qId])) {
      timer = setInterval(() => {
        setTimeSpentMap(prev => ({
          ...prev,
          [qId]: (prev[qId] || 0) + 1
        }));
      }, 1000);
    }
    
    if (isFriendly) return () => timer && clearInterval(timer);
    
    const overallTimer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timer) clearInterval(timer);
      clearInterval(overallTimer);
    };
  }, [testData, isSubmitted, currentSectionIdx, currentQuestionIdx, isFriendly, friendlyRevealed, showInstructions, reviewMode]);

  useEffect(() => {
    if (!isFriendly || showInstructions || isSubmitted || !testData) return;
    
    const sec = testData.sections[currentSectionIdx];
    const qId = sec?.questions[currentQuestionIdx]?.id;
    if (!qId) return;

    // Freeze timer if the user has already submitted the question
    if (friendlyRevealed[qId]) return;

    const interval = setInterval(() => {
      setFriendlyTimer(Math.round((Date.now() - questionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isFriendly, showInstructions, isSubmitted, questionStartTime, friendlyRevealed, testData, currentSectionIdx, currentQuestionIdx]);

  useEffect(() => {
    if (reviewMode && isFriendly) {
      setRightPanelTab('grid');
    }
  }, [reviewMode, isFriendly]);

  const submitSection = () => {
    if (testData.blueprint.has_sectional_timing) {
      if (currentSectionIdx < testData.sections.length - 1) {
        if (window.confirm(`Are you sure you want to submit the ${testData.sections[currentSectionIdx].name} section? You cannot return to it.`)) {
          setCurrentSectionIdx(prev => {
            const nextIdx = prev + 1;
            setTimeLeft((testData.sections[nextIdx].duration || 15) * 60);
            setCurrentQuestionIdx(0);
            return nextIdx;
          });
        }
      } else {
        if (window.confirm("This is the last section. Are you sure you want to submit the entire test?")) {
          submitTest();
        }
      }
    }
  };

  const handleTimeUp = () => {
    if (testData.blueprint.has_sectional_timing) {
      if (currentSectionIdx < testData.sections.length - 1) {
        // Time is up for section, auto-advance without blocking alert
        setCurrentSectionIdx(prev => {
          const nextIdx = prev + 1;
          setTimeLeft((testData.sections[nextIdx].duration || 15) * 60);
          setCurrentQuestionIdx(0);
          return nextIdx;
        });
      } else {
        // Time is up, auto submit without blocking alert
        submitTest();
      }
    } else {
      // Time is up, auto submit without blocking alert
      submitTest();
    }
  };

  const submitTest = () => {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let total = 0;
    
    testData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        total++;
        const userAns = answers[q.id];
        if (!userAns) unattempted++;
        else if (userAns === q.answer) correct++;
        else incorrect++;
      });
    });

    const mc = testData.blueprint.marks_correct || 1.0;
    const mi = testData.blueprint.marks_incorrect || 0.25;
    const marks = (correct * mc) - (incorrect * mi);
    
    if (isMultiplayer) {
      socket.emit('submitStats', { 
        code: room.code, 
        userId: currentUser.id, 
        statsUpdate: { 
          attempted: correct + incorrect, 
          skipped: unattempted, 
          right: correct, 
          wrong: incorrect, 
          accuracy: total > 0 ? ((correct / (correct + incorrect)) * 100) : 0,
          score: marks,
          finished: true 
        } 
      });
    }

    setScoreData({ correct, incorrect, unattempted, total, marks, mc, mi });
    setIsSubmitted(true);
  };

  const emitStatsUpdate = (newAnswers, newStatusMap) => {
    if (!isMultiplayer) return;
    let attempted = 0, skipped = 0, right = 0, wrong = 0;
    
    testData.sections.forEach(sec => {
      sec.questions.forEach(q => {
        const userAns = newAnswers[q.id];
        const status = newStatusMap[q.id];
        if (status === 'answered' || status === 'review') {
          if (userAns) {
            attempted++;
            if (userAns === q.answer) right++;
            else wrong++;
          }
        } else if (status === 'not_answered') {
          skipped++;
        }
      });
    });
    
    const accuracy = attempted > 0 ? ((right / attempted) * 100) : 0;
    socket.emit('submitStats', { code: room.code, userId: currentUser.id, statsUpdate: { attempted, skipped, right, wrong, accuracy } });
  };

  const previousQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    } else if (currentSectionIdx > 0 && !testData.blueprint.has_sectional_timing) {
      // Global timing - can seamlessly jump to previous section
      setCurrentSectionIdx(prev => prev - 1);
      setCurrentQuestionIdx(testData.sections[currentSectionIdx - 1].questions.length - 1);
    } else {
      alert("You are at the first question.");
    }
    setQuestionStartTime(Date.now());
    setFriendlyTimer(0);
  };

  const advanceQuestion = () => {
    const currentSection = testData.sections[currentSectionIdx];
    if (currentQuestionIdx < currentSection.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Reached end of section
      if (testData.blueprint.has_sectional_timing) {
        alert("You have reached the last question of this section. You can review your answers or manually submit this section early using the 'Submit Section' button.");
      } else {
        // Global timing - can seamlessly jump to next section
        if (currentSectionIdx < testData.sections.length - 1) {
          setCurrentSectionIdx(prev => prev + 1);
          setCurrentQuestionIdx(0);
        } else {
          alert("You have reached the last question of the test. You can review your answers or submit the test.");
        }
      }
    }
    setQuestionStartTime(Date.now());
    setFriendlyTimer(0);
  };

  const handleSaveAndExit = () => {
    if (!testData || !currentUser.id) return;
    const examName = testData.blueprint?.exam_name || 'Saved Test';
    if (!window.confirm(`Save your progress for "${examName}" and exit? You can resume later from the Dashboard.`)) return;
    
    fetch('/api/test-session/save-exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: testSessionId,
        user_id: currentUser.id,
        exam_name: examName,
        game_mode: gameMode,
        test_data: testData,
        answers,
        status_map: statusMap,
        time_left: timeLeft,
        current_section: currentSectionIdx,
        current_question: currentQuestionIdx,
        time_spent_map: timeSpentMap
      })
    })
    .then(r => r.json())
    .then(() => {
      localStorage.removeItem('active_test_data');
      localStorage.removeItem('test_game_mode');
      localStorage.removeItem('current_test_session_id');
      localStorage.removeItem('test_progress_' + testSessionId);
      navigate('/home');
    })
    .catch(err => {
      console.error('Save failed:', err);
      alert('Failed to save. Please try again.');
    });
  };

  const handleSaveNext = () => {
    const qId = currentQuestion.id;
    let newStatusMap = { ...statusMap };
    if (answers[qId]) {
      newStatusMap[qId] = 'answered';
    } else {
      newStatusMap[qId] = 'not_answered';
    }
    setStatusMap(newStatusMap);
    emitStatsUpdate(answers, newStatusMap);
    advanceQuestion();
  };

  const handleMarkReview = () => {
    let newStatusMap = { ...statusMap, [currentQuestion.id]: 'review' };
    setStatusMap(newStatusMap);
    emitStatsUpdate(answers, newStatusMap);
    advanceQuestion();
  };

  const handleClear = () => {
    const newAnswers = { ...answers };
    delete newAnswers[currentQuestion.id];
    setAnswers(newAnswers);
    let newStatusMap = { ...statusMap, [currentQuestion.id]: 'not_answered' };
    setStatusMap(newStatusMap);
    emitStatsUpdate(newAnswers, newStatusMap);
  };

  const handleFriendlySkip = () => {
    const currentQuestion = testData.sections[currentSectionIdx].questions[currentQuestionIdx];
    const qId = currentQuestion.id;
    
    let newAnswers = { ...answers, [qId]: '0' };
    setAnswers(newAnswers);
    let newStatusMap = { ...statusMap, [qId]: 'answered' };
    setStatusMap(newStatusMap);
    emitStatsUpdate(newAnswers, newStatusMap);
    
    const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(3);
    
    if (gameMode === 'Solo-Friendly') {
      setFriendlyRevealed(prev => ({ ...prev, [qId]: true }));
    } else if (gameMode === 'Multiplayer-Friendly') {
      socket.emit('friendlySubmit', { code: room?.code, userId: currentUser.id, answer: '0', timeTaken });
      setFriendlyRevealed(prev => ({ ...prev, [qId]: 'waiting' }));
    }
  };

  const handleFriendlySubmit = () => {
    const currentQuestion = testData.sections[currentSectionIdx].questions[currentQuestionIdx];
    const qId = currentQuestion.id;
    if (!answers[qId] || answers[qId] === '0') {
      alert("Please select an answer first, or use the Skip button.");
      return;
    }
    
    const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(3);
    
    if (gameMode === 'Solo-Friendly') {
      setFriendlyRevealed(prev => ({ ...prev, [qId]: true }));
    } else if (gameMode === 'Multiplayer-Friendly') {
      socket.emit('friendlySubmit', { code: room?.code, userId: currentUser.id, answer: answers[qId], timeTaken });
      setFriendlyRevealed(prev => ({ ...prev, [qId]: 'waiting' }));
    }
  };

  const handleHostNext = () => {
    const currentSection = testData.sections[currentSectionIdx];
    let nextSecIdx = currentSectionIdx;
    let nextQIdx = currentQuestionIdx + 1;
    if (nextQIdx >= currentSection.questions.length) {
      if (nextSecIdx < testData.sections.length - 1) {
        nextSecIdx++;
        nextQIdx = 0;
      } else {
        alert("This is the last question. Use 'Finish Test'.");
        return;
      }
    }
    socket.emit('friendlyNext', { code: room.code, secIdx: nextSecIdx, qIdx: nextQIdx });
  };

  const handleHostForceReveal = () => {
    socket.emit('friendlyForceReveal', { code: room.code });
  };

  const handleHostSkipAll = () => {
    socket.emit('friendlySkipAll', { code: room.code });
  };

  const handleHostFinish = () => {
    if (window.confirm("End test for everyone?")) {
      socket.emit('finishTest', { code: room.code, userId: currentUser.id });
    }
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!testData) return <div style={{ color: '#fff', padding: '40px' }}>Loading test engine...</div>;

  if (isSubmitted && !reviewMode) {
    return (
      <Results 
        scoreData={scoreData} 
        testData={testData} 
        gameMode={gameMode} 
        liveStats={liveStats} 
        currentUser={currentUser} 
        testSessionId={testSessionId}
        answers={answers}
        statusMap={statusMap}
        timeSpentMap={timeSpentMap}
        reviewUserName={reviewUserName}
        onReviewAnswers={() => { setIsSubmitted(false); setReviewMode(true); }}
      />
    );
  }

  const currentSection = testData.sections[currentSectionIdx];
  const currentQuestion = currentSection.questions[currentQuestionIdx];
  const optionsLetters = ['A', 'B', 'C', 'D', 'E'];

  if (currentView === 'instructions') {
    return (
      <div className="test-engine-container">
        <header className="te-top-header">
          <div className="te-header-left">
            <div className="te-logo">
              <h1>UnMocked</h1>
              <span>{testData.blueprint.exam_name.toUpperCase()}</span>
            </div>
          </div>
          <div className="te-header-right">
            {reviewMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                <div className="avatar-placeholder">{reviewUserName ? reviewUserName.charAt(0).toUpperCase() : (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U')}</div>
                <strong style={{ color: 'var(--text-dark)' }}>{reviewUserName || currentUser.name}</strong>
              </div>
            )}
            {!reviewMode && (
              <div className="te-avatars">
                <div className="te-avatar">
                  <div className="avatar-placeholder">{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
                </div>
              </div>
            )}
          </div>
        </header>
        
        <div style={{ flex: 1, padding: '32px 64px', overflowY: 'auto', backgroundColor: '#fff' }}>
          <h2 style={{ color: '#e74c3c', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '24px' }}>General Instructions:</h2>
          <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#333' }}>
            <p><strong>Please read the instructions carefully</strong></p>
            <ol style={{ marginLeft: '24px', marginBottom: '24px' }}>
              <li>Total duration of the examination is <strong>{testData.blueprint.has_sectional_timing ? 'based on strictly timed sections' : testData.blueprint.total_duration + ' minutes'}</strong>.</li>
              <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination.</li>
              <li>The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                <ul style={{ listStyleType: 'none', paddingLeft: 0, marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="tcs-palette-btn not-answered" style={{ width: '30px', height: '30px', pointerEvents: 'none' }}></div> You have not answered the question.</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="tcs-palette-btn answered" style={{ width: '30px', height: '30px', pointerEvents: 'none' }}></div> You have answered the question.</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="tcs-palette-btn marked" style={{ width: '30px', height: '30px', pointerEvents: 'none' }}></div> You have marked the question for review.</li>
                </ul>
              </li>
              <li>You can click on the "&gt;" arrow which appears to the left of question palette to collapse the question palette thereby maximizing the question window.</li>
              <li>To answer a question, click on the button against the chosen option among the given choices.</li>
              <li>To change your chosen answer, click on the button of another option or click on the <strong>Clear Response</strong> button.</li>
              <li>To save your answer, you MUST click on the <strong>Save & Next</strong> button.</li>
            </ol>
            
            <h3 style={{ color: '#e74c3c', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '16px' }}>Declaration:</h3>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: '#f8f9fa', padding: '16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={instructionsAccepted} onChange={e => setInstructionsAccepted(e.target.checked)} style={{ marginTop: '4px', transform: 'scale(1.2)' }} />
              <span>I have read and understood the instructions. I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action.</span>
            </label>
          </div>
        </div>

        <div style={{ padding: '16px 64px', borderTop: '1px solid #ccc', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center' }}>
          {(!isMultiplayer || isHost || room?.testStarted) ? (
            <button 
              className="te-btn submit" 
              style={{ backgroundColor: instructionsAccepted ? '#1abc9c' : '#ccc', color: '#fff', padding: '12px 48px', fontSize: '16px', borderRadius: '4px', border: 'none', cursor: instructionsAccepted ? 'pointer' : 'not-allowed' }}
              disabled={!instructionsAccepted}
              onClick={() => {
                if (isMultiplayer && isHost && !room?.testStarted) {
                  socket.emit('beginTestForAll', { code: room.code });
                } else {
                  setSearchParams({ view: 'play' });
                }
              }}
            >
              {isMultiplayer && isHost && !room?.testStarted ? 'Start Test for All' : 'I am ready to begin'}
            </button>
          ) : (
            <button 
              className="te-btn submit" 
              style={{ backgroundColor: '#ccc', color: '#fff', padding: '12px 48px', fontSize: '16px', borderRadius: '4px', border: 'none', cursor: 'not-allowed' }}
              disabled
            >
              {instructionsAccepted ? 'Waiting for Host to start...' : 'Please read and accept instructions'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="test-engine-container">
      {/* Top Header */}
      <header className="te-top-header">
        <div className="te-header-left">
          <div className="te-logo">
            <h1>UnMocked</h1>
            <span>{testData.blueprint.exam_name.toUpperCase()}</span>
          </div>
        </div>
        <div className="te-header-center">
          <div className="zoom-controls">
            <button className="zoom-btn">Zoom (+)</button>
            <button className="zoom-btn">Zoom (-)</button>
          </div>
          <h2>{testData.sections[currentSectionIdx].name.substring(0, 35)}{testData.sections[currentSectionIdx].name.length > 35 ? '...' : ''}</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Roll No : {gameMode.toUpperCase()}
          </span>
        </div>
        <div className="te-header-right">
          <div className="te-timer-box" style={{ display: 'flex', alignItems: 'center', marginRight: '0.5rem', background: reviewMode ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)', border: reviewMode ? '1px solid rgba(52, 152, 219, 0.3)' : '1px solid rgba(231, 76, 60, 0.3)' }}>
              <div className="te-timer">
                  <span className="time-label" style={{ color: reviewMode ? 'var(--text-muted)' : '#e74c3c' }}>
                      {reviewMode ? 'Post-Test' : isFriendly ? 'Time Elapsed' : 'Time Left'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="time-value" style={{ color: reviewMode ? 'var(--accent-color)' : '#e74c3c', fontWeight: 'bold' }}>
                          {reviewMode ? 'Review Mode' : formatTime(isFriendly ? friendlyTimer : timeLeft)}
                      </span>
                  </div>
              </div>
          </div>
          {isMultiplayer && (
             <button className="te-btn" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', marginRight: '1rem', background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setShowLiveStats(!showLiveStats)}>Live Progress</button>
          )}
          <div className="te-avatars">
             <div className="te-avatar">
                <div className="avatar-placeholder">{currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}</div>
             </div>
          </div>
        </div>
      </header>

      {/* Sub Top Bar */}
      <div className="te-sub-header">
          <div className="te-sub-links">
              <span>SYMBOLS</span>
              <span>INSTRUCTIONS</span>
              <span>OVERALL TEST SUMMARY</span>
          </div>
          <div className="te-total-answered">
              Total Questions Answered: <span className="badge-yellow">{Object.values(statusMap).filter(s => s === 'answered').length}</span>
          </div>
      </div>

      {/* Action Bar */}
      {testData.sections.length > 0 && (
          <div className="te-action-bar">
              <div className="te-section-tabs">
                  {testData.sections.map((sec, i) => {
                      const isStrict = testData.blueprint.has_sectional_timing;
                      const isActive = currentSectionIdx === i;
                      return (
                          <div 
                              key={i} 
                              className={`te-tab ${isActive ? 'active' : ''}`}
                              onClick={() => {
                                  if (!isStrict || reviewMode) {
                                      setCurrentSectionIdx(i);
                                      setCurrentQuestionIdx(0);
                                  }
                              }}
                              style={{ opacity: (isStrict && !isActive && !reviewMode) ? 0.5 : 1, cursor: (!isStrict || reviewMode) ? 'pointer' : 'default' }}
                          >
                              {sec.name}
                          </div>
                      );
                  })}
              </div>
              <div className="te-buttons">
                  {reviewMode ? (
                      <>
                          <button className="te-btn submit" style={{ background: '#34495e' }} onClick={previousQuestion}>Previous Question</button>
                          <button className="te-btn submit" onClick={advanceQuestion}>Next Question</button>
                          <button className="te-btn save" onClick={() => { setIsSubmitted(true); setReviewMode(false); }}>Back to Results</button>
                          <button className="te-btn" style={{ background: '#8b5cf6', color: 'white' }} onClick={() => navigate(`/home?step=7&roomId=${testSessionId}`)}>Back to Analytics</button>
                      </>
                  ) : !isFriendly ? (
                      <>
                          <button className="te-btn" onClick={handleMarkReview}>Mark for Review & Next</button>
                          <button className="te-btn" onClick={handleClear}>Clear Response</button>
                          <button className="te-btn submit" onClick={handleSaveNext}>Save & Next</button>
                          <button className="te-btn submit" onClick={() => {
                              if (window.confirm("Are you sure you want to submit the entire test?")) {
                                  submitTest();
                              }
                          }}>Submit Test</button>
                      </>
                  ) : (
                      <>
                          {!friendlyRevealed[currentQuestion.id] && (
                              <>
                                  <button className="te-btn" onClick={handleFriendlySkip}>Skip</button>
                                  <button className="te-btn" onClick={handleClear}>Clear Response</button>
                                  <button className="te-btn submit" onClick={handleFriendlySubmit}>Submit</button>
                              </>
                          )}
                          
                          {friendlyRevealed[currentQuestion.id] === 'waiting' && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', marginRight: '1rem', display: 'flex', alignItems: 'center' }}>
                                  ✓ Response submitted. Waiting for others...
                              </span>
                          )}

                          {isHost && gameMode === 'Multiplayer-Friendly' && friendlyRevealed[currentQuestion.id] !== true && (
                              <>
                                  <button className="te-btn" style={{ background: 'var(--c-accent2)', color: 'var(--text-dark)' }} onClick={handleHostSkipAll}>Skip for All</button>
                                  <button className="te-btn" style={{ background: 'var(--c-primary)', color: '#2C2F40' }} onClick={handleHostForceReveal}>Force Reveal</button>
                              </>
                          )}
                          
                          {(gameMode === 'Solo-Friendly' && friendlyRevealed[currentQuestion.id] === true) && (
                              <button className="te-btn submit" onClick={advanceQuestion}>Next Question</button>
                          )}

                          {gameMode === 'Multiplayer-Friendly' && isHost && friendlyRevealed[currentQuestion.id] === true && (
                              <button className="te-btn submit" onClick={handleHostNext}>Next Question</button>
                          )}
                      </>
                  )}
              </div>
          </div>
      )}

      {/* Main Content Area */}
      <div className="te-main-area">
          
          {/* Left Pane (Question) */}
          <div className="te-left-pane">
              <div className="te-question-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className="te-question-no">Question No. {currentQuestionIdx + 1}</span>
                      {isFriendly ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                  className="te-btn submit" 
                                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                                  onClick={() => submitTest()}
                              >
                                  Finish Individual Test
                              </button>
                              {isHost && gameMode === 'Multiplayer-Friendly' && (
                                  <button 
                                      className="te-btn save" 
                                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: '#c0392b' }}
                                      onClick={handleHostFinish}
                                  >
                                      Finish Test For All
                                  </button>
                              )}
                          </div>
                      ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Pause</span>
                              {testData?.blueprint?.has_sectional_timing && !reviewMode && !isFriendly && (
                                <button 
                                  className="te-btn save" 
                                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: '#e67e22', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  onClick={submitSection}
                                >
                                  Submit Section
                                </button>
                              )}
                              <button className="te-btn save" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: '#34495e', color: 'white' }} onClick={handleSaveAndExit}>Save & Exit</button>
                          </div>
                      )}
                  </div>
                  <div>
                      <span style={{ fontSize: '0.8rem', marginRight: '1rem' }}>Select Language <select><option>English</option></select></span>
                      <span style={{ fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-muted)' }}>⚠️ Report</span>
                  </div>
              </div>

              <div className="te-question-content" style={{ display: 'flex', gap: '20px' }}>
                  {currentQuestion.passage && (
                      <div className="te-passage-panel" style={{ flex: '1 1 50%', paddingRight: '20px', borderRight: '1px solid var(--border-color)', maxHeight: '600px', overflowY: 'auto' }}>
                          <h4 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-dark)' }}>Read the following carefully:</h4>
                          <div 
                              className="math-inline-force" 
                              style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-dark)', whiteSpace: 'pre-wrap' }}
                              dangerouslySetInnerHTML={{ __html: formatHtml(currentQuestion.passage) }} 
                          />
                      </div>
                  )}

                  {currentQuestion.chartData && (
                      <div className="te-passage-panel" style={{ flex: '1 1 50%', paddingRight: '20px', borderRight: '1px solid var(--border-color)', maxHeight: '600px', overflowY: 'auto' }}>
                          <h4 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 Data Interpretation</h4>
                          <DIChartRenderer chartData={currentQuestion.chartData} />
                      </div>
                  )}

                  <div style={{ flex: (currentQuestion.passage || currentQuestion.chartData) ? '1 1 50%' : '1' }}>
                      <div 
                          className="math-inline-force" 
                          style={{ marginBottom: '1rem', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
                          dangerouslySetInnerHTML={{ __html: formatHtml(currentQuestion.text) }} 
                      />

                      <div className="te-options-list">
                      {currentQuestion.options.map((opt, i) => {
                          const letter = optionsLetters[i];
                          const isSelected = answers[currentQuestion.id] === letter;
                          const isRevealed = friendlyRevealed[currentQuestion.id] === true || reviewMode;
                          const isCorrect = isRevealed && letter === currentQuestion.answer;
                          const isWrongSelected = isRevealed && isSelected && letter !== currentQuestion.answer;
                          const isWaiting = friendlyRevealed[currentQuestion.id] === 'waiting';

                          let optionClass = `te-option-item ${isSelected ? 'selected' : ''}`.trim();
                          if (isRevealed) {
                              if (isCorrect) optionClass += ' reveal-correct';
                              else if (isWrongSelected) optionClass += ' reveal-incorrect';
                          }

                          return (
                              <label 
                                  key={i}
                                  className={optionClass}
                                  onClick={() => {
                                      if (!isRevealed && !isWaiting && !reviewMode) setAnswers(prev => ({ ...prev, [currentQuestion.id]: letter }));
                                  }}
                              >
                                  <input type="radio" className="te-option-radio" checked={isSelected} readOnly />
                                  <div className="math-inline-force" dangerouslySetInnerHTML={{ __html: formatHtml(opt) }} />
                                  {isCorrect && <CheckCircle2 size={20} color="#1abc9c" style={{ marginLeft: 'auto' }} />}
                                  {isWrongSelected && <XCircle size={20} color="#e74c3c" style={{ marginLeft: 'auto' }} />}
                              </label>
                          );
                      })}
                  </div>

                  {friendlyRevealed[currentQuestion.id] === 'waiting' && !reviewMode && (
                     <div style={{ marginTop: '24px', padding: '16px', background: '#eef3f7', border: '1px solid #758ba8', borderRadius: '4px', textAlign: 'center', color: '#4b5e78', fontWeight: 'bold' }}>
                       Waiting for other players to submit... ({friendlyWaitingData.submitted} / {friendlyWaitingData.total})
                     </div>
                  )}

                  {(friendlyRevealed[currentQuestion.id] === true || reviewMode) && (
                     <div className="animate-fade-in" style={{ marginTop: '2rem', padding: '1rem', background: 'var(--c-accent1)', color: 'white', borderRadius: '4px' }}>
                       <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <CheckCircle2 size={18} /> Explanation
                       </h4>
                       <div className="math-inline-force" style={{ lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: formatHtml(currentQuestion.explanation || "No explanation provided.") }} />
                     </div>
                  )}
              </div>
          </div>
              </div>

          {/* Right Pane (Palette) */}
          <div className="te-right-pane">
              <div className="te-right-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>▶ Test / Status</span>
              </div>
              
              {isFriendly && (
                  <div className="te-tabs">
                      <button className={`te-tab ${rightPanelTab === 'status' ? 'active' : ''}`} onClick={() => setRightPanelTab('status')}>Status</button>
                      <button className={`te-tab ${rightPanelTab === 'grid' ? 'active' : ''}`} onClick={() => setRightPanelTab('grid')}>Grid</button>
                  </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto' }}>
                  {(rightPanelTab === 'grid' || !isFriendly) ? (
                      <>
                          <div className="te-grid-container">
                              <div className="te-question-grid">
                                  {currentSection.questions.map((q, i) => {
                                      const stat = statusMap[q.id];
                                      let cls = '';
                                      if (reviewMode || (isFriendly && friendlyRevealed[q.id] === true)) {
                                          const userAns = answers[q.id];
                                          if (!userAns || userAns === '0') {
                                              cls = 'skipped-grey';
                                          } else if (userAns === q.answer) {
                                              cls = 'answered'; // Green
                                          } else {
                                              cls = 'not-answered'; // Red
                                          }
                                      } else if (isFriendly) {
                                          if (stat === 'answered') cls = 'answered';
                                          else cls = 'not-visited'; // White
                                      } else {
                                          if (stat === 'answered') cls = 'answered';
                                          else if (stat === 'review') cls = 'marked';
                                          else if (stat === 'not_answered') cls = 'not-answered';
                                          else cls = 'not-visited';
                                      }

                                      return (
                                          <button 
                                              key={i} 
                                              className={`te-grid-btn status-${cls}`}
                                              onClick={() => {
                                                  if (reviewMode || gameMode !== 'Multiplayer-Friendly') {
                                                      setCurrentQuestionIdx(i);
                                                  } else {
                                                      const qId = currentSection.questions[i].id;
                                                      const isRevealed = friendlyRevealed[qId] === true;
                                                      let activeRoomQIdx = currentSection.questions.findIndex(q => friendlyRevealed[q.id] !== true);
                                                      if (activeRoomQIdx === -1) activeRoomQIdx = currentSection.questions.length;
                                                      
                                                      if (isRevealed || i === activeRoomQIdx) {
                                                          setCurrentQuestionIdx(i);
                                                      }
                                                  }
                                              }}
                                              style={{
                                                  ...(currentQuestionIdx === i ? { border: '2px solid #000' } : {}),
                                                  ...(!reviewMode && gameMode === 'Multiplayer-Friendly' && currentQuestionIdx !== i && i === currentSection.questions.findIndex(q => friendlyRevealed[q.id] !== true) ? { border: '2px dashed var(--accent-color)' } : {})
                                              }}
                                          >
                                              {i + 1}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                          
                          {reviewMode && timeSpentMap[currentQuestion.id] !== undefined && (
                              <div style={{ padding: '12px', background: 'var(--surface-color)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>Time Spent</span>
                                  <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{formatTime(timeSpentMap[currentQuestion.id])}</span>
                              </div>
                          )}

                          <div className="te-analysis-table">
                              <table>
                                  <thead>
                                      <tr><th colSpan="2">{currentSection.name.substring(0, 30)} Analysis</th></tr>
                                  </thead>
                                  <tbody>
                                      <tr>
                                          <td>Answered</td>
                                          <td className="count-badge">{currentSection.questions.filter(q => statusMap[q.id] === 'answered').length}</td>
                                      </tr>
                                      <tr>
                                          <td>Not Answered</td>
                                          <td className="count-badge" style={{color:'red'}}>{currentSection.questions.filter(q => statusMap[q.id] === 'not_answered').length}</td>
                                      </tr>
                                      <tr>
                                          <td>Mark for Review</td>
                                          <td className="count-badge" style={{color:'purple'}}>{currentSection.questions.filter(q => statusMap[q.id] === 'review').length}</td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </>
                  ) : (
                      <div style={{ padding: '1rem' }}>
                          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#333' }}>Live Room Status</h4>
                          {roomStatusData.map((u, i) => {
                               const isRevealed = friendlyRevealed[currentQuestion.id] === true;
                               let resultText = '';
                               let resultColor = '#333';
                               let borderColor = '#ccc';
                               let optLabel = '';
                               
                               if (u.submitted) {
                                 if (isRevealed) {
                                   if (u.submitted.answer === '0') {
                                     optLabel = 'Skipped';
                                     resultText = 'Skipped';
                                     resultColor = '#758ba8';
                                     borderColor = '#758ba8';
                                   } else {
                                     const optIdx = optionsLetters.indexOf(u.submitted.answer);
                                     optLabel = `Option ${optIdx + 1}`;
                                     if (u.submitted.answer === currentQuestion.answer) {
                                       resultText = `Correct (Option ${u.submitted.answer})`;
                                       resultColor = '#1abc9c';
                                       borderColor = '#1abc9c';
                                     } else {
                                       resultText = `Incorrect (Option ${u.submitted.answer})`;
                                       resultColor = '#e74c3c';
                                       borderColor = '#e74c3c';
                                     }
                                   }
                                 } else {
                                   optLabel = 'Hidden';
                                   resultText = 'Submitted';
                                   resultColor = '#3498db';
                                   borderColor = '#3498db';
                                 }
                               } else {
                                 if (isRevealed) {
                                   optLabel = 'No Response';
                                   resultText = 'Not Answered';
                                   resultColor = '#e74c3c';
                                   borderColor = '#e74c3c';
                                 } else {
                                   optLabel = 'Waiting...';
                                   resultText = 'Answering';
                                   resultColor = '#f39c12';
                                 }
                               }
            
                               return (
                                 <div key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: '4px', padding: '10px', marginBottom: '10px', background: 'white' }}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                       {u.profile_pic ? (
                                         <img src={u.profile_pic} alt="Profile" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                                       ) : (
                                         <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                                           {(u.name || "U").charAt(0).toUpperCase()}
                                         </div>
                                       )}
                                       <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>{u.name}</span>
                                     </div>
                                     <span style={{ fontSize: '12px', fontWeight: 'bold', color: resultColor }}>{resultText}</span>
                                   </div>
                                   <div style={{ fontSize: '12px', color: '#758ba8' }}>
                                     <div>Selected: {optLabel}</div>
                                     {u.submitted && <div>Time taken: {u.submitted.timeTaken || 0}s</div>}
                                   </div>
                                 </div>
                               );
                          })}
                          {roomStatusData.length === 0 && (
                            <div style={{ color: '#758ba8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                              Waiting for players to answer...
                            </div>
                          )}
                      </div>
                  )}
              </div>
          </div>
          
          {/* Live Progress Overlay */}
          {showLiveStats && isMultiplayer && (
             <div className="animate-fade-in" style={{ position: 'absolute', top: '100px', right: '310px', width: '300px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-dark)' }}>Live Progress</h3>
                 <XCircle size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowLiveStats(false)} />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                 {Object.values(liveStats).map((st, i) => (
                   <div key={i} style={{ background: 'var(--bg-alt)', padding: '8px', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {st.profile_pic ? (
                             <img src={st.profile_pic} alt="Profile" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                             <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                               {(st.name || "U").charAt(0).toUpperCase()}
                             </div>
                          )}
                          <strong style={{ color: 'var(--text-dark)', fontSize: '13px' }}>{st.name} {st.name === currentUser.name && '(You)'}</strong>
                        </div>
                       <span style={{ color: 'var(--status-answered)', fontSize: '12px', fontWeight: 'bold' }}>{st.accuracy?.toFixed(0) || 0}% Acc</span>
                     </div>
                     <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                       <span style={{ color: 'var(--status-answered)' }}>{st.right} R</span> • 
                       <span style={{ color: 'var(--status-not-answered)' }}>{st.wrong} W</span> • 
                       <span>{st.attempted} Att</span> • 
                       <span>{st.skipped} Skip</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}

      </div>

      {/* Floating Chat Bubble */}
      {isMultiplayer && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          {showChat && (
            <div className="animate-fade-in" style={{ width: '320px', height: '400px', background: 'var(--bg-main)', backdropFilter: 'blur(20px)', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--c-secondary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <MessageCircle size={18} /> Room Chat
                </div>
                <XCircle size={18} style={{ cursor: 'pointer', color: '#fff' }} onClick={() => setShowChat(false)} />
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-alt)' }}>
                {chatMessages.map((msg, idx) => {
                  const isMe = msg.user.id === currentUser.id;
                  return (
                    <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {!isMe && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px' }}>{msg.user.name}</div>}
                      <div style={{ background: isMe ? 'var(--status-answered)' : '#fff', color: isMe ? '#fff' : 'var(--text-dark)', border: isMe ? 'none' : '1px solid var(--border-color)', padding: '8px 12px', borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0', fontSize: '0.9rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', background: '#fff' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '8px 12px', fontSize: '0.9rem', flex: 1, borderRadius: '20px', border: '1px solid var(--border-color)', color: 'var(--text-dark)', background: 'var(--bg-alt)' }} 
                  placeholder="Message..." 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      socket.emit('chatMessage', { code: room.code, user: currentUser, text: chatInput.trim() });
                      setChatInput('');
                    }
                  }}
                />
                <button 
                  style={{ background: 'var(--status-answered)', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    if (chatInput.trim()) {
                      socket.emit('chatMessage', { code: room.code, user: currentUser, text: chatInput.trim() });
                      setChatInput('');
                    }
                  }}
                ><Send size={16}/></button>
              </div>
            </div>
          )}
          {isMultiplayer && !showChat && (
            <div style={{ position: 'relative' }}>
              {latestMessage && (
                <div className="animate-fade-in" style={{ position: 'absolute', bottom: '70px', right: '0px', width: '250px', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', color: 'var(--text-dark)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--c-primary)', marginBottom: '4px' }}>{latestMessage.user.name}</div>
                  <div style={{ fontSize: '0.9rem' }}>{latestMessage.text}</div>
                </div>
              )}
              <button 
                onClick={() => setShowChat(true)}
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--c-secondary)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', transition: 'transform 0.2s', position: 'relative' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <MessageCircle size={28} />
                {unreadChat && (
                  <span style={{ position: 'absolute', top: '0px', right: '0px', background: '#e74c3c', color: 'white', fontSize: '12px', fontWeight: 'bold', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                    !
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    );
}


