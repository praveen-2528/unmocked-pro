import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import TestEngine from './pages/TestEngine';
import StudyRoom from './pages/StudyRoom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/test" element={<TestEngine />} />
      <Route path="/study-room/:groupId" element={<StudyRoom />} />
    </Routes>
  );
}

export default App;
