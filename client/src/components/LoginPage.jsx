import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchSetupStatus } from '../api/photos.js';
import '../styles/login.css';

export default function LoginPage() {
  const { login, setup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(null);

  useEffect(() => {
    fetchSetupStatus()
      .then((data) => setNeedsSetup(data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

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

  if (needsSetup === null) return null;

  const action = needsSetup ? setup : login;
  const buttonLabel = needsSetup ? 'Create Admin Account' : 'Log In';
  const heading = needsSetup ? 'Initial Setup' : 'Art Sorter';

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{heading}</h1>
        {needsSetup && (
          <p className="setup-hint">Create the first admin account to get started.</p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(action); }}>
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
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            disabled={isSubmitting}
          />
          {error && <div className="login-error">{error}</div>}
          <div className="login-actions">
            <button type="submit" className="login-btn" disabled={isSubmitting}>
              {buttonLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
