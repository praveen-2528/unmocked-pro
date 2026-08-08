import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { socket } from './socket';
import useAuthStore from './store/useAuthStore';
import RainBackground from './components/RainBackground';
import Navbar from './components/Navbar';
import FriendsPanel from './components/FriendsPanel';
import GlobalChatBubble from './components/GlobalChatBubble';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import TestEngine from './pages/TestEngine';
import StudyRoom from './pages/StudyRoom';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Settings from './pages/Settings';

function App() {
  const location = useLocation();
  const user = useAuthStore(state => state.user);
  
  const isTestUI = location.pathname.startsWith('/test') || location.pathname.startsWith('/review');
  const isAuth = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/reset-password';
  const showGlobalUI = !isTestUI && !isAuth;

  useEffect(() => {
    if (user?.id) {
      socket.emit('authenticate', user.id);
    }
  }, [user]);

  return (
    <>
      {!isTestUI && <RainBackground />}
      {showGlobalUI && <Navbar />}
      
      {/* Global Friends & Chat System */}
      {user?.id && (
        <>
          <GlobalChatBubble />
          <FriendsPanel />
        </>
      )}

      <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/home" element={<Dashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/test/:sessionId" element={<TestEngine />} />
      <Route path="/test" element={<TestEngine />} />
      <Route path="/review/:resultId" element={<TestEngine />} />
      <Route path="/study-room/:groupId" element={<StudyRoom />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
    </>
  );
}

export default App;
