import { useState } from 'react';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Backend is running on port 5000 (adjust if needed, or use Vite proxy)
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Success, redirect to login
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '440px', width: '100%', padding: '40px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="geist-pixel" style={{ fontSize: '2.5rem', marginBottom: '8px', color: 'var(--accent-color)' }}>
            Join UnMocked
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Create an account to start preparing with peers.</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleSubmit}>
          <div>
            <label className="input-label" htmlFor="name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
              <input 
                type="text" 
                id="name" 
                className="input-field" 
                placeholder="Enter your name" 
                style={{ paddingLeft: '48px' }} 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required 
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="email">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
              <input 
                type="email" 
                id="email" 
                className="input-field" 
                placeholder="Enter your email" 
                style={{ paddingLeft: '48px' }} 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required 
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-secondary)', width: '20px', height: '20px' }} />
              <input 
                type="password" 
                id="password" 
                className="input-field" 
                placeholder="••••••••" 
                style={{ paddingLeft: '48px' }} 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Creating Account...' : <>Create Account <ArrowRight size={18} /></>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account? <Link to="/" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
        </div>
      </div>
    </main>
  );
}
