import React, { useState, useEffect, useRef } from 'react';
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

  function onDrop(sourceSquare, targetSquare) {
    if (game.turn() === 'w' && myColor !== 'white') return false;
    if (game.turn() === 'b' && myColor !== 'black') return false;
    if (timeoutWinner || gameEndReason || game.isGameOver()) return false;

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
      
      if (gameCopy.isGameOver()) {
         // The game is over locally due to this move, let's notify the server implicitly or let the game loop handle it.
         // chess.js handles it locally, so we don't necessarily need a server emit, but we could.
      }
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
    <div className="container" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }} ref={containerRef}>
        <div className="glass-panel" style={{ padding: '20px', maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: boardWidth, marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: myColor === 'white' ? '#0f172a' : '#f8fafc', color: myColor === 'white' ? 'white' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', border: '2px solid #334155' }}>
                {opponent?.name?.charAt(0) || '?'}
              </div>
              <div>
                <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>{opponent ? opponent.name : 'Opponent'}</p>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {oppCaptured.map((p, i) => <span key={i}>{oppIcons[p]}</span>)}
                  {oppAdvantage > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--success-color)', marginLeft: '4px', fontWeight: 'bold' }}>+{oppAdvantage}</span>}
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '1.2rem', color: oppTime < 60 ? 'var(--danger-color)' : 'white' }}>
              {formatTime(oppTime)}
            </div>
          </div>
          
          <div style={{ borderRadius: '4px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', position: 'relative', width: boardWidth, height: boardWidth, marginBottom: '10px' }}>
            <Chessboard 
              position={game.fen()} 
              onPieceDrop={onDrop} 
              boardOrientation={myColor}
              boardWidth={boardWidth}
              customDarkSquareStyle={{ backgroundColor: '#3b82f6' }}
              customLightSquareStyle={{ backgroundColor: '#eff6ff' }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: boardWidth }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: myColor === 'white' ? '#f8fafc' : '#0f172a', color: myColor === 'white' ? '#0f172a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', border: '2px solid #334155' }}>
                {user?.name?.charAt(0) || '?'}
              </div>
              <div>
                <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>{user ? user.name : 'You'}</p>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {myCaptured.map((p, i) => <span key={i}>{myIcons[p]}</span>)}
                  {myAdvantage > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--success-color)', marginLeft: '4px', fontWeight: 'bold' }}>+{myAdvantage}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '1.2rem', color: myTime < 60 ? 'var(--danger-color)' : 'white' }}>
                {formatTime(myTime)}
              </div>
            </div>
          </div>

          {!gameOverData && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: boardWidth, marginTop: '20px', gap: '12px' }}>
               <button className="btn btn-glass" onClick={handleOfferDraw} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Offer Draw</button>
               <button className="btn btn-primary" onClick={handleResign} style={{ background: 'var(--danger-color)', padding: '8px 16px', fontSize: '0.9rem' }}>Resign</button>
            </div>
          )}
          
          {gameOverData && (
            <div style={{ marginTop: '20px', width: boardWidth, padding: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', textAlign: 'center' }}>
              <h3 style={{ color: 'white', marginBottom: '8px' }}>Game Over</h3>
              <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem', margin: 0 }}>
                {gameOverData.winner ? `${gameOverData.winner === myColor ? user?.name : opponent?.name} wins!` : 'Game drawn.'}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>{gameOverData.reason}</p>
            </div>
          )}

          {/* In-Game Chat */}
          <div style={{ marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px', width: boardWidth, textAlign: 'left' }}>
             <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>Match Chat</h4>
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
