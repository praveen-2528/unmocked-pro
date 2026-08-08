import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { socket } from '../socket';
import useAuthStore from '../store/useAuthStore';


export default function ChessRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const [game, setGame] = useState(new Chess());
  const [opponent, setOpponent] = useState(null);
  const [myColor, setMyColor] = useState('white'); // First one is white
  const [roomInfo, setRoomInfo] = useState(null);

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
    };

    const handleChessMove = ({ move, fen }) => {
      const gameCopy = new Chess(fen);
      setGame(gameCopy);
    };

    const handleChessReset = () => {
      setGame(new Chess());
    };

    socket.on('chessRoomState', handleRoomState);
    socket.on('chessMove', handleChessMove);
    socket.on('chessReset', handleChessReset);

    return () => {
      socket.off('chessRoomState', handleRoomState);
      socket.off('chessMove', handleChessMove);
      socket.off('chessReset', handleChessReset);
    };
  }, [roomId, user, navigate]);

  function onDrop(sourceSquare, targetSquare) {
    // Only allow moves if it's our turn
    if (game.turn() === 'w' && myColor !== 'white') return false;
    if (game.turn() === 'b' && myColor !== 'black') return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // always promote to queen for simplicity
      });

      if (move === null) return false;
      
      setGame(gameCopy);
      socket.emit('chessMove', { roomId, move, fen: gameCopy.fen(), pgn: gameCopy.pgn() });
      return true;
    } catch (e) {
      return false;
    }
  }

  const resetGame = () => {
    setGame(new Chess());
    socket.emit('chessReset', { roomId });
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

  if (roomInfo.status === 'LOBBY') {
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
                <p style={{ color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>{roomInfo.white?.name}</p>
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
          {roomInfo.white?.id === user.id ? (
            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.1rem' }} disabled={!roomInfo.black} onClick={() => socket.emit('startChessMatch', { roomId })}>
              {roomInfo.black ? 'Start Match' : 'Waiting for opponent...'}
            </button>
          ) : (
             <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>Waiting for Host to start...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 className="geist-pixel" style={{ color: 'var(--text-primary)', margin: 0 }}>Room: {roomId}</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                {opponent ? `Playing against ${opponent.name}` : 'Waiting for opponent...'}
              </p>
            </div>
            <button className="btn btn-glass" onClick={resetGame}>Reset Board</button>
          </div>
          
          <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <Chessboard 
              position={game.fen()} 
              onPieceDrop={onDrop} 
              boardOrientation={myColor}
              customDarkSquareStyle={{ backgroundColor: '#3b82f6' }}
              customLightSquareStyle={{ backgroundColor: '#eff6ff' }}
            />
          </div>
          
          {game.isGameOver() && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', borderRadius: '8px', textAlign: 'center', color: 'white', fontWeight: 'bold' }}>
              Game Over! {game.isCheckmate() ? 'Checkmate!' : 'Draw!'}
            </div>
          )}
        </div>

    </div>
  );
}
