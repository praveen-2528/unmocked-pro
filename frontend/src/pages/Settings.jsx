import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import { Save, Lock, LogOut, Mail, Calendar, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const currentUser = JSON.parse(localStorage.getItem('unmocked_user') || '{}');
  const navigate = useNavigate();

  const [name, setName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameMsg, setNameMsg] = useState('');
  const [passMsg, setPassMsg] = useState('');

  if (!currentUser?.email) {
    navigate('/');
    return null;
  }

  const handleUpdateName = async () => {
    try {
      const res = await fetch(`/api/users/${currentUser.id}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('unmocked_user', JSON.stringify({ ...currentUser, name: data.name }));
        setNameMsg('Name updated successfully!');
        setTimeout(() => setNameMsg(''), 3000);
      } else {
        setNameMsg(data.error || 'Failed to update name');
      }
    } catch (err) {
      setNameMsg('Error updating name');
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPassMsg("New passwords don't match");
      return;
    }
    try {
      const res = await fetch(`/api/users/${currentUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPassMsg('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPassMsg(''), 3000);
      } else {
        setPassMsg(data.error || 'Failed to update password');
      }
    } catch (err) {
      setPassMsg('Error updating password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('unmocked_user');
    navigate('/');
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Navbar />

      <main style={{ maxWidth: '700px', margin: '80px auto 60px', padding: '0 20px' }}>
        <h1 className="geist-pixel" style={{ color: 'var(--text-primary)', marginBottom: '40px' }}>
          Account Settings
        </h1>

        {/* Profile Settings */}
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <UserIcon size={20} /> Profile Information
          </h2>
          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px' }}>Display Name</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <input 
                type="text" 
                className="input-field" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleUpdateName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> Save
              </button>
            </div>
            {nameMsg && <p style={{ color: nameMsg.includes('success') ? '#22c55e' : '#ef4444', fontSize: '0.9rem', marginTop: '8px' }}>{nameMsg}</p>}
          </div>
        </div>

        {/* Security Settings */}
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Lock size={20} /> Security
          </h2>
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px' }}>Current Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px' }}>New Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '8px' }}>Confirm New Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
            </div>
            <button className="btn btn-primary" onClick={handleUpdatePassword} style={{ alignSelf: 'flex-start' }}>
              Change Password
            </button>
            {passMsg && <p style={{ color: passMsg.includes('success') ? '#22c55e' : '#ef4444', fontSize: '0.9rem' }}>{passMsg}</p>}
          </div>
        </div>

        {/* Account Info */}
        <div className="glass-panel">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginTop: 0, borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Calendar size={20} /> Account Details
          </h2>
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
              <Mail size={18} /> <strong>Email:</strong> {currentUser.email}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '10px 0' }} />
            <button 
              className="btn btn-primary" 
              onClick={handleLogout} 
              style={{ backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
