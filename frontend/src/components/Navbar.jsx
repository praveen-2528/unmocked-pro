import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Trophy, User, Settings } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';


export default function Navbar() {
  const currentUser = useAuthStore(state => state.user);
  const navigate = useNavigate();

  const handleAvatarClick = () => {
    navigate('/profile');
  };

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px'
    }}>
      {/* Logo Area */}
      <div 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        onClick={() => navigate('/home')}
      >
        <span style={{ fontSize: '24px' }}>🦉</span>
        <span className="geist-pixel" style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>UnMocked</span>
      </div>

      {/* Navigation Links */}
      <div style={{ display: 'flex', gap: '32px', height: '100%', alignItems: 'center' }}>
        <NavLink 
          to="/home" 
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '6px', 
            textDecoration: 'none', 
            color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
            height: '100%',
            transition: 'all 0.2s'
          })}
        >
          <Home size={18} /> Home
        </NavLink>
        <NavLink 
          to="/leaderboard" 
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '6px', 
            textDecoration: 'none', 
            color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
            height: '100%',
            transition: 'all 0.2s'
          })}
        >
          <Trophy size={18} /> Leaderboard
        </NavLink>
        <NavLink 
          to="/profile" 
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '6px', 
            textDecoration: 'none', 
            color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
            height: '100%',
            transition: 'all 0.2s'
          })}
        >
          <User size={18} /> Profile
        </NavLink>
        <NavLink 
          to="/settings" 
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '6px', 
            textDecoration: 'none', 
            color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: isActive ? 'bold' : 'normal',
            borderBottom: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
            height: '100%',
            transition: 'all 0.2s'
          })}
        >
          <Settings size={18} /> Settings
        </NavLink>
      </div>

      {/* User Profile Area */}
      {currentUser?.name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
            {currentUser.name}
          </span>
          <div 
            onClick={handleAvatarClick}
            style={{
              width: '36px', height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(37,99,235,0.2)'
            }}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </nav>
  );
}
