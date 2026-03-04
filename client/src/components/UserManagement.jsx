import React, { useState, useEffect } from 'react';
import { fetchUsers, createUser, deleteUser } from '../api/photos.js';

export default function UserManagement({ onClose }) {
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (!newUsername.trim()) return;
    try {
      await createUser(newUsername.trim());
      setNewUsername('');
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    setError('');
    try {
      await deleteUser(id);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-management" onClick={(e) => e.stopPropagation()}>
        <div className="user-management-header">
          <h2>Manage Users</h2>
          <button className="user-management-close" onClick={onClose}>&times;</button>
        </div>

        <form className="user-management-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="New username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="user-management-input"
          />
          <button type="submit" className="user-management-add-btn">Add User</button>
        </form>

        {error && <div className="user-management-error">{error}</div>}

        {loading ? (
          <div className="user-management-loading">Loading...</div>
        ) : (
          <ul className="user-management-list">
            {users.map((u) => (
              <li key={u.id} className="user-management-item">
                <span className="user-management-username">
                  {u.username}
                  {u.isAdmin && <span className="user-management-badge">admin</span>}
                </span>
                {!u.isAdmin && (
                  <button
                    className="user-management-delete-btn"
                    onClick={() => handleDelete(u.id)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
