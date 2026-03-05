import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/user-menu.css';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-avatar"
        onClick={() => setOpen((v) => !v)}
        title={user.username}
      >
        {user.username.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-name">{user.username}</div>
          <button className="user-menu-logout" onClick={logout}>
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
