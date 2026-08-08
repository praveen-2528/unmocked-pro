import { Routes, Route, useLocation } from 'react-router-dom';
import RainBackground from './components/RainBackground';
import Navbar from './components/Navbar';
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
  const isTestUI = location.pathname.startsWith('/test') || location.pathname.startsWith('/review');
  const isAuth = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/reset-password';
  const showGlobalUI = !isTestUI && !isAuth;

  return (
    <>
      {!isTestUI && <RainBackground />}
      {showGlobalUI && <Navbar />}
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
