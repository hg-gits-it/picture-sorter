import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(action) {
    setError('');
    setIsSubmitting(true);
    try {
      await action(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Art Sorter</h1>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(login); }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={isSubmitting}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={isSubmitting}
          />
          {error && <div className="login-error">{error}</div>}
          <div className="login-actions">
            <button type="submit" className="login-btn" disabled={isSubmitting}>
              Log In
            </button>
            <button
              type="button"
              className="register-btn"
              onClick={() => handleSubmit(register)}
              disabled={isSubmitting}
            >
              Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
