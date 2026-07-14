import { Routes, Route } from 'react-router-dom';
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
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/home" element={<Dashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/test" element={<TestEngine />} />
      <Route path="/review/:resultId" element={<TestEngine />} />
      <Route path="/study-room/:groupId" element={<StudyRoom />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

export default App;
