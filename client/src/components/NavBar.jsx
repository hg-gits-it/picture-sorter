import React from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';

export default function NavBar() {
  const { viewMode, setViewMode } = usePhotos();

  return (
    <nav className="nav-bar">
      <button
        className={`nav-tab${viewMode === 'rank' ? ' active' : ''}`}
        onClick={() => setViewMode('rank')}
      >
        By Rank
      </button>
      <button
        className={`nav-tab${viewMode === 'showId' ? ' active' : ''}`}
        onClick={() => setViewMode('showId')}
      >
        By Show ID
      </button>
    </nav>
  );
}
