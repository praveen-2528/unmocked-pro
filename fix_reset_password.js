const fs = require('fs');
const path = require('path');

// 1. Update backend/server.js
let serverJs = fs.readFileSync('backend/server.js', 'utf8');
if (!serverJs.includes('/api/reset-password')) {
    const resetApiCode = `
// Process Password Reset
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

  db.get('SELECT user_id, expires_at FROM reset_tokens WHERE token = ?', [token], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(400).json({ error: 'Invalid reset token' });
    
    if (new Date() > new Date(row.expires_at)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    try {
      const hash = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update password' });
        
        // Delete token after successful use
        db.run('DELETE FROM reset_tokens WHERE token = ?', [token]);
        res.json({ message: 'Password reset successfully. You can now login.' });
      });
    } catch (hashErr) {
      res.status(500).json({ error: 'Failed to hash password' });
    }
  });
});
`;
    // Insert right after the /api/admin/reset-token block
    const hook = "res.status(201).json({ message: 'Token generated', token });\n    });\n  });";
    serverJs = serverJs.replace(hook, hook + "\n" + resetApiCode);
    fs.writeFileSync('backend/server.js', serverJs);
    console.log("Updated server.js");
}

// 2. Create ResetPassword.jsx
const resetJsx = `import { useState } from 'react';
import { ArrowRight, Lock, Key } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ token: '', newPassword: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setStatus({ type: 'success', message: 'Password reset successfully! Redirecting to login...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '40px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="geist-pixel" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent-color)' }}>
            Reset Password
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Enter the 6-digit reset token provided by your administrator.</p>
        </div>

        {status.message && (
          <div style={{ 
            backgroundColor: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
            border: \`1px solid \${status.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'}\`, 
            color: status.type === 'error' ? '#fca5a5' : '#86efac', 
            padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' 
          }}>
            {status.message}
          </div>
        )}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleSubmit}>
          <div>
            <label className="input-label" htmlFor="token">Reset Token (6 Digits)</label>
            <div style={{ position: 'relative' }}>
              <Key style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
              <input 
                type="text" 
                id="token" 
                className="input-field" 
                placeholder="123456" 
                style={{ paddingLeft: '48px', letterSpacing: '4px' }} 
                value={formData.token}
                onChange={(e) => setFormData({...formData, token: e.target.value})}
                required 
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="newPassword">New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
              <input 
                type="password" 
                id="newPassword" 
                className="input-field" 
                placeholder="••••••••" 
                style={{ paddingLeft: '48px' }} 
                value={formData.newPassword}
                onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                required 
                minLength="6"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Resetting...' : <>Reset Password <ArrowRight size={18} /></>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Remembered your password? <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '500' }}>Back to Login</Link>
        </div>
      </div>
    </main>
  );
}
`;
fs.writeFileSync('frontend/src/pages/ResetPassword.jsx', resetJsx);
console.log("Created ResetPassword.jsx");

// 3. Update App.jsx
let appJsx = fs.readFileSync('frontend/src/App.jsx', 'utf8');
if (!appJsx.includes('ResetPassword')) {
    appJsx = appJsx.replace("import Login from './pages/Login';", "import Login from './pages/Login';\nimport ResetPassword from './pages/ResetPassword';");
    appJsx = appJsx.replace('<Route path="/login" element={<Login />} />', '<Route path="/login" element={<Login />} />\n        <Route path="/reset" element={<ResetPassword />} />');
    fs.writeFileSync('frontend/src/App.jsx', appJsx);
    console.log("Updated App.jsx");
}

// 4. Update Login.jsx
let loginJsx = fs.readFileSync('frontend/src/pages/Login.jsx', 'utf8');
if (!loginJsx.includes('Link to="/reset"')) {
    loginJsx = loginJsx.replace(
        '<a href="#" style={{ color: \'var(--text-secondary)\', fontSize: \'0.85rem\', textDecoration: \'none\' }}>Forgot password?</a>',
        '<Link to="/reset" style={{ color: \'var(--text-secondary)\', fontSize: \'0.85rem\', textDecoration: \'none\' }}>Forgot password?</Link>'
    );
    fs.writeFileSync('frontend/src/pages/Login.jsx', loginJsx);
    console.log("Updated Login.jsx");
}

console.log("Reset Password feature complete.");
