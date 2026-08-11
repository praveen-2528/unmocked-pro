import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { socket } from '../socket';
import useAuthStore from '../store/useAuthStore';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const calculateMaterial = (chessGame) => {
  const board = chessGame.board();
  let whiteScore = 0;
  let blackScore = 0;
  
  const points = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  
  let whiteCounts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  let blackCounts = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  board.forEach(row => {
    row.forEach(piece => {
      if (piece) {
        if (piece.color === 'w') {
          whiteScore += points[piece.type];
          if (piece.type !== 'k') whiteCounts[piece.type]++;
        } else {
          blackScore += points[piece.type];
          if (piece.type !== 'k') blackCounts[piece.type]++;
        }
      }
    });
  });

  const whiteCaptured = [];
  const blackCaptured = [];

  Object.keys(initialCounts).forEach(type => {
    const wMissing = initialCounts[type] - whiteCounts[type];
    const bMissing = initialCounts[type] - blackCounts[type];
    
    // Black captured white pieces
    for (let i = 0; i < wMissing; i++) blackCaptured.push(type);
    // White captured black pieces
    for (let i = 0; i < bMissing; i++) whiteCaptured.push(type);
  });

  // Sort by piece value
  const sortPieces = (arr) => arr.sort((a, b) => points[a] - points[b]);

  return {
    whiteAdvantage: Math.max(0, whiteScore - blackScore),
    blackAdvantage: Math.max(0, blackScore - whiteScore),
    whiteCaptured: sortPieces(whiteCaptured),
    blackCaptured: sortPieces(blackCaptured)
  };
};

const whiteCapturedIcons = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const blackCapturedIcons = { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' };

export default function ChessRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  
  const [game, setGame] = useState(new Chess());
  const [opponent, setOpponent] = useState(null);
  const [myColor, setMyColor] = useState('white');
  const [roomInfo, setRoomInfo] = useState(null);
  const [countdown, setCountdown] = useState(null);
  
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [timeoutWinner, setTimeoutWinner] = useState(null);
  const [gameEndReason, setGameEndReason] = useState(null);

  const [boardWidth, setBoardWidth] = useState(400);
  const containerRef = useRef(null);
  const chatEndRef = useRef(null);

  const [moveFrom, setMoveFrom] = useState('');
  const [optionSquares, setOptionSquares] = useState({});

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Responsive board sizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const maxWidth = Math.min(
          window.innerWidth - 40,
          window.innerHeight - 260 // Space for UI headers and footers
        );
        setBoardWidth(Math.max(300, Math.min(maxWidth, 700)));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const customPieces = useMemo(() => {
    const pieces = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];
    const pieceComponents = {};
    pieces.forEach(piece => {
      pieceComponents[piece] = ({ squareWidth }) => (
        <div style={{ width: squareWidth, height: squareWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={`/chess-pieces/${piece}.png`} style={{ width: '90%', height: '90%', objectFit: 'contain' }} alt={piece} />
        </div>
      );
    });
    return pieceComponents;
  }, []);

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    socket.emit('joinChessRoom', { roomId, user });

    const handleRoomState = (state) => {
      setRoomInfo(state);
      if (state.white && state.white.id === user.id) {
        setMyColor('white');
        setOpponent(state.black);
      } else if (state.black && state.black.id === user.id) {
        setMyColor('black');
        setOpponent(state.white);
      }
      
      if (state.status === 'LOBBY') {
         setWhiteTime(600);
         setBlackTime(600);
         setTimeoutWinner(null);
         setGameEndReason(null);
         setGame(new Chess());
         setCountdown(null);
      }
      
      if (state.status === 'COUNTDOWN') {
        setCountdown(state.countdown);
      }
    };

    const handleChessMove = ({ move, fen }) => {
      const gameCopy = new Chess(fen);
      setGame(gameCopy);
    };

    const handleGameOver = ({ reason, winner }) => {
      setGameEndReason({ reason, winner });
    };

    const handleDrawOffered = () => {
      if (window.confirm("Opponent has offered a draw. Accept?")) {
        socket.emit('chessAcceptDraw', { roomId });
      }
    };

    const handleChatMessage = (msg) => {
      setChatMessages(prev => [...prev, msg]);
    };

    socket.on('chessRoomState', handleRoomState);
    socket.on('chessMove', handleChessMove);
    socket.on('chessCountdown', setCountdown);
    socket.on('chessGameOver', handleGameOver);
    socket.on('chessDrawOffered', handleDrawOffered);
    socket.on('chatMessage', handleChatMessage);

    return () => {
      socket.off('chessRoomState', handleRoomState);
      socket.off('chessMove', handleChessMove);
      socket.off('chessCountdown');
      socket.off('chessGameOver', handleGameOver);
      socket.off('chessDrawOffered', handleDrawOffered);
      socket.off('chatMessage', handleChatMessage);
    };
  }, [roomId, user, navigate]);

  useEffect(() => {
    if (roomInfo?.status === 'PLAYING' && !game.isGameOver() && !timeoutWinner && !gameEndReason) {
      const timer = setInterval(() => {
        if (game.turn() === 'w') {
          setWhiteTime(t => {
            if (t <= 1) { setTimeoutWinner('black'); return 0; }
            return t - 1;
          });
        } else {
          setBlackTime(t => {
            if (t <= 1) { setTimeoutWinner('white'); return 0; }
            return t - 1;
          });
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [roomInfo?.status, game.fen(), timeoutWinner, gameEndReason]);

  function getMoveOptions(square) {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.3) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.3) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.3)',
    };
    setOptionSquares(newSquares);
    return true;
  }

  function onSquareClick(square) {
    if (game.turn() === 'w' && myColor !== 'white') return;
    if (game.turn() === 'b' && myColor !== 'black') return;
    if (timeoutWinner || gameEndReason || game.isGameOver()) return;

    function resetFirstMove(sq) {
      const hasOptions = getMoveOptions(sq);
      if (hasOptions) setMoveFrom(sq);
      else {
        setMoveFrom('');
        setOptionSquares({});
      }
    }

    if (!moveFrom) {
      resetFirstMove(square);
      return;
    }

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: moveFrom,
        to: square,
        promotion: 'q'
      });

      if (move === null) {
        resetFirstMove(square);
        return;
      }
      
      setGame(gameCopy);
      socket.emit('chessMove', { roomId, move, fen: gameCopy.fen(), pgn: gameCopy.pgn() });
      setMoveFrom('');
      setOptionSquares({});
    } catch (e) {
      resetFirstMove(square);
    }
  }

  function onDrop(sourceSquare, targetSquare) {
    if (game.turn() === 'w' && myColor !== 'white') return false;
    if (game.turn() === 'b' && myColor !== 'black') return false;
    if (timeoutWinner || gameEndReason || game.isGameOver()) return false;

    setMoveFrom('');
    setOptionSquares({});

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) return false;
      
      setGame(gameCopy);
      socket.emit('chessMove', { roomId, move, fen: gameCopy.fen(), pgn: gameCopy.pgn() });
      
      return true;
    } catch (e) {
      return false;
    }
  }

  const handleResign = () => {
    if (window.confirm("Are you sure you want to resign?")) {
      socket.emit('chessResign', { roomId, winner: myColor === 'white' ? 'black' : 'white' });
    }
  };

  const handleOfferDraw = () => {
    socket.emit('chessOfferDraw', { roomId });
    alert("Draw offer sent.");
  };

  if (!roomInfo) {
    return (
      <div className="container" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <h2 className="geist-pixel" style={{ color: 'var(--text-primary)' }}>Connecting...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Loading match lobby for {roomId}</p>
        </div>
      </div>
    );
  }

  if (roomInfo.status === 'LOBBY' || roomInfo.status === 'COUNTDOWN') {
    return (
      <div className="container" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <h2 className="geist-pixel" style={{ color: 'var(--text-primary)', marginBottom: '20px' }}>Room: {roomId}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Share this code to invite a friend.</p>
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '30px 0' }}>
             <div style={{ textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '24px', fontWeight: 'bold' }}>
                  {roomInfo.white?.name?.charAt(0) || '?'}
                </div>
                <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>{roomInfo.white?.name || 'Waiting...'}</p>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(White)</span>
             </div>
             <h3 style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>VS</h3>
             <div style={{ textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '24px', fontWeight: 'bold', border: '2px solid #334155' }}>
                  {roomInfo.black?.name?.charAt(0) || '?'}
                </div>
                <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>{roomInfo.black?.name || 'Waiting...'}</p>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>(Black)</span>
             </div>
          </div>
          
          <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
             {roomInfo.status === 'COUNTDOWN' ? (
               <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>Starting in {countdown}s...</p>
             ) : !roomInfo.black ? (
               <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>Waiting for opponent to join...</p>
             ) : roomInfo.p1?.id === user.id ? (
               <button className="btn btn-primary" onClick={() => socket.emit('startChessMatch', { roomId })} style={{ padding: '12px 24px', fontSize: '1.1rem' }}>Start Match</button>
             ) : (
               <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>Waiting for Host to start...</p>
             )}
          </div>

          {/* Lobby Chat */}
          <div style={{ marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px', textAlign: 'left' }}>
             <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>Lobby Chat</h4>
             <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {chatMessages.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>No messages yet...</p>}
               {chatMessages.map((msg, i) => (
                 <div key={i} style={{ fontSize: '0.9rem' }}>
                   <strong style={{ color: msg.user.id === user.id ? 'var(--accent-color)' : 'var(--text-primary)' }}>{msg.user.name}: </strong>
                   <span style={{ color: 'var(--text-secondary)' }}>{msg.text}</span>
                 </div>
               ))}
               <div ref={chatEndRef} />
             </div>
             <form onSubmit={(e) => {
               e.preventDefault();
               if (!chatInput.trim()) return;
               socket.emit('chatMessage', { code: roomId, user, text: chatInput });
               setChatInput('');
             }} style={{ display: 'flex', gap: '8px' }}>
               <input type="text" className="input-field" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ flex: 1, padding: '8px 12px' }} />
               <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }} disabled={!chatInput.trim()}>Send</button>
             </form>
          </div>
        </div>
      </div>
    );
  }

  const myTime = myColor === 'white' ? whiteTime : blackTime;
  const oppTime = myColor === 'white' ? blackTime : whiteTime;
  
  const mat = calculateMaterial(game);
  const myCaptured = myColor === 'white' ? mat.whiteCaptured : mat.blackCaptured;
  const oppCaptured = myColor === 'white' ? mat.blackCaptured : mat.whiteCaptured;
  const myAdvantage = myColor === 'white' ? mat.whiteAdvantage : mat.blackAdvantage;
  const oppAdvantage = myColor === 'white' ? mat.blackAdvantage : mat.whiteAdvantage;
  
  const myIcons = myColor === 'white' ? whiteCapturedIcons : blackCapturedIcons;
  const oppIcons = myColor === 'white' ? blackCapturedIcons : whiteCapturedIcons;

  let gameOverData = gameEndReason;
  if (!gameOverData && game.isGameOver()) {
    if (game.isCheckmate()) gameOverData = { reason: 'Checkmate', winner: game.turn() === 'w' ? 'black' : 'white' };
    else if (game.isStalemate()) gameOverData = { reason: 'Stalemate', winner: null };
    else if (game.isInsufficientMaterial()) gameOverData = { reason: 'Insufficient Material', winner: null };
    else if (game.isThreefoldRepetition()) gameOverData = { reason: '3-fold Repetition', winner: null };
    else gameOverData = { reason: 'Draw (50-move rule)', winner: null };
  } else if (!gameOverData && timeoutWinner) {
    gameOverData = { reason: 'Time Out', winner: timeoutWinner };
  }

  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#10141b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, zIndex: 100 }} ref={containerRef}>
      
      {/* Top Absolute Navigation Bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
        <button onClick={handleResign} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '24px', padding: '8px' }}>✕</button>
        
        <div style={{ background: '#2d3748', borderRadius: '24px', padding: '6px 20px', display: 'flex', gap: '24px', alignItems: 'center', border: '1px solid #4a5568', color: 'white', fontWeight: 'bold' }}>
          <span style={{ color: oppTime < 60 ? 'var(--danger-color)' : (game.turn() === (myColor === 'white' ? 'b' : 'w') ? 'var(--accent-color)' : 'white') }}>
            ⏱ {formatTime(oppTime)}
          </span>
          <span style={{ width: '1px', height: '16px', background: '#4a5568' }} />
          <span style={{ color: myTime < 60 ? 'var(--danger-color)' : (game.turn() === (myColor === 'white' ? 'w' : 'b') ? 'var(--accent-color)' : 'white') }}>
            ⏱ {formatTime(myTime)}
          </span>
        </div>
        
        <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'flex-end' }}>
          {oppAdvantage > 0 && (
            <div style={{ background: '#1e293b', borderRadius: '16px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #334155', color: 'var(--success-color)', fontWeight: 'bold' }}>
              ⬆ {oppAdvantage}
            </div>
          )}
          {myAdvantage > 0 && (
            <div style={{ background: '#1e293b', borderRadius: '16px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #334155', color: 'var(--success-color)', fontWeight: 'bold' }}>
              ⬆ {myAdvantage}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: boardWidth, gap: '12px' }}>
        {/* Opponent Avatar Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: myColor === 'white' ? '#0f172a' : '#f8fafc', color: myColor === 'white' ? 'white' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', border: '2px solid #334155', marginBottom: '8px' }}>
            {opponent?.name?.charAt(0) || '?'}
          </div>
          <div style={{ display: 'flex', gap: '2px', fontSize: '1.2rem', color: 'var(--text-secondary)', minHeight: '24px' }}>
            {oppCaptured.length > 0 && oppCaptured.map((p, i) => <span key={i}>{oppIcons[p]}</span>)}
          </div>
        </div>

        {/* Board */}
        <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', width: boardWidth, height: boardWidth }}>
          <Chessboard 
            position={game.fen()} 
            onPieceDrop={onDrop} 
            onSquareClick={onSquareClick}
            boardOrientation={myColor}
            boardWidth={boardWidth}
            customDarkSquareStyle={{ backgroundColor: '#26353f' }}
            customLightSquareStyle={{ backgroundColor: '#33414e' }}
            customSquareStyles={optionSquares}
            customPieces={customPieces}
            animationDuration={200}
          />
        </div>

        {/* Local Player Avatar Area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2px', fontSize: '1.2rem', color: 'var(--text-secondary)', minHeight: '24px', marginBottom: '8px' }}>
            {myCaptured.length > 0 && myCaptured.map((p, i) => <span key={i}>{myIcons[p]}</span>)}
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: myColor === 'white' ? '#f8fafc' : '#0f172a', color: myColor === 'white' ? '#0f172a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', border: '2px solid #334155' }}>
            {user?.name?.charAt(0) || '?'}
          </div>
        </div>
      </div>

      {gameOverData && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(30, 41, 59, 0.95)', padding: '24px 48px', borderRadius: '16px', border: '1px solid #334155', textAlign: 'center', zIndex: 10, backdropFilter: 'blur(10px)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
          <h2 style={{ color: 'white', marginBottom: '8px', fontSize: '2rem' }}>Game Over</h2>
          <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 0 8px 0' }}>
            {gameOverData.winner ? `${gameOverData.winner === myColor ? 'You' : opponent?.name} win!` : 'Game drawn.'}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>{gameOverData.reason}</p>
        </div>
      )}

      {/* Subtle Bottom Controls (Draw) */}
      <div style={{ position: 'absolute', bottom: '24px', display: 'flex', gap: '16px', zIndex: 5 }}>
        <button className="btn btn-glass" onClick={handleOfferDraw} style={{ padding: '8px 24px', borderRadius: '24px', fontSize: '0.9rem', border: '1px solid #334155', color: 'var(--text-secondary)' }}>Offer Draw</button>
      </div>

    </div>
  );
}
