import React, { useState } from 'react';
import { PhotoProvider, usePhotos } from './context/PhotoContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import RankPage from './components/RankPage.jsx';
import ShowIdPage from './components/ShowIdPage.jsx';
import UserMenu from './components/UserMenu.jsx';
import PhotoModal from './components/PhotoModal.jsx';
import SubmitModal from './components/SubmitModal.jsx';
import UserManagement from './components/UserManagement.jsx';

function AppContent() {
  const { scanPhotos, loading, photos, viewMode } = usePhotos();
  const { user } = useAuth();
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <img src="/logo.svg" alt="" className="app-logo" />
          Art Sorter
        </h1>
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
          <UserMenu />
        </div>
      </header>

      <NavBar />

      <main className="app-main">
        {loading && photos.length === 0 && (
          <div className="loading">Loading photos...</div>
        )}

        {!loading && photos.length === 0 && (
          <div className="empty-state">
            No photos found. Click &quot;Scan Photos&quot;.
          </div>
        )}

        {viewMode === 'showId' ? <ShowIdPage /> : <RankPage />}
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
