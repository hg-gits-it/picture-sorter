import React, { useState } from 'react';
import { PhotoProvider, usePhotos } from './context/PhotoContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import FilterBar from './components/FilterBar.jsx';
import TagGroup from './components/TagGroup.jsx';
import UnratedSection from './components/UnratedSection.jsx';
import PhotoModal from './components/PhotoModal.jsx';
import SubmitModal from './components/SubmitModal.jsx';
import UserManagement from './components/UserManagement.jsx';

function AppContent() {
  const { photos, scanPhotos, loading, filterTag } = usePhotos();
  const { user, logout } = useAuth();
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);

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
          <span className="user-info">{user.username}</span>
          <button className="logout-btn" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      <FilterBar />

      <main className="app-main">
        {loading && photos.length === 0 && (
          <div className="loading">Loading photos...</div>
        )}

        {!loading && photos.length === 0 && (
          <div className="empty-state">
            No photos found. Click &quot;Scan Photos&quot;.
          </div>
        )}

        {showGrouped ? (
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
