import React, { useState, useRef, useEffect } from 'react';
import { PhotoProvider, usePhotos } from './context/PhotoContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import FilterBar from './components/FilterBar.jsx';
import TagGroup from './components/TagGroup.jsx';
import UnratedSection from './components/UnratedSection.jsx';
import PhotoGrid from './components/PhotoGrid.jsx';
import PhotoModal from './components/PhotoModal.jsx';
import SubmitModal from './components/SubmitModal.jsx';
import UserManagement from './components/UserManagement.jsx';

function AppContent() {
  const { photos, scanPhotos, loading, filterTag, viewMode } = usePhotos();
  const { user, logout } = useAuth();
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  const lovePhotos = photos.filter((p) => p.tag === 'love');
  const likePhotos = photos.filter((p) => p.tag === 'like');
  const mehPhotos = photos.filter((p) => p.tag === 'meh');
  const taxDeductionPhotos = photos.filter((p) => p.tag === 'tax_deduction');
  const unratedPhotos = photos.filter((p) => p.tag === 'unrated');

  // When a specific tag filter is active, show as flat grid
  const showGrouped = filterTag === 'all';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Art Sorter</h1>
        <div className="header-actions">
          {user.isAdmin && (
            <>
              <button className="scan-btn" onClick={scanPhotos}>
                Scan Photos
              </button>
              <button
                className="users-btn"
                onClick={() => setUserMgmtOpen(true)}
              >
                Users
              </button>
            </>
          )}
          <button
            className="submit-btn"
            onClick={() => setSubmitModalOpen(true)}
          >
            Submit to Show
          </button>
          <div className="user-menu" ref={userMenuRef}>
            <button
              className="user-avatar"
              onClick={() => setUserMenuOpen((v) => !v)}
              title={user.username}
            >
              {user.username.charAt(0).toUpperCase()}
            </button>
            {userMenuOpen && (
              <div className="user-menu-dropdown">
                <div className="user-menu-name">{user.username}</div>
                <button className="user-menu-logout" onClick={logout}>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NavBar />

      <FilterBar showTagFilters={viewMode === 'rank'} />

      <main className="app-main">
        {loading && photos.length === 0 && (
          <div className="loading">Loading photos...</div>
        )}

        {!loading && photos.length === 0 && (
          <div className="empty-state">
            No photos found. Click &quot;Scan Photos&quot;.
          </div>
        )}

        {viewMode === 'showId' ? (
          <PhotoGrid photos={photos} draggable={false} showRank={false} />
        ) : showGrouped ? (
          <>
            <TagGroup tag="love" photos={lovePhotos} />
            <TagGroup tag="like" photos={likePhotos} />
            <TagGroup tag="meh" photos={mehPhotos} />
            <TagGroup tag="tax_deduction" photos={taxDeductionPhotos} />
            <UnratedSection photos={unratedPhotos} />
          </>
        ) : filterTag === 'unrated' ? (
          <UnratedSection photos={unratedPhotos} />
        ) : (
          <TagGroup tag={filterTag} photos={photos} />
        )}
      </main>

      <PhotoModal />
      <SubmitModal
        open={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
      />
      {userMgmtOpen && (
        <UserManagement onClose={() => setUserMgmtOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PhotoProvider>
      <AppContent />
    </PhotoProvider>
  );
}
