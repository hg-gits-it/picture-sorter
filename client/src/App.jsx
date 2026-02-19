import React from "react";
import { PhotoProvider, usePhotos } from "./context/PhotoContext.jsx";
import FilterBar from "./components/FilterBar.jsx";
import TagGroup from "./components/TagGroup.jsx";
import UnrankedSection from "./components/UnrankedSection.jsx";
import PhotoModal from "./components/PhotoModal.jsx";

function AppContent() {
  const { photos, scanPhotos, loading, filterTag } = usePhotos();

  const lovePhotos = photos.filter((p) => p.tag === "love");
  const likePhotos = photos.filter((p) => p.tag === "like");
  const mehPhotos = photos.filter((p) => p.tag === "meh");
  const taxDeductionPhotos = photos.filter((p) => p.tag === "tax_deduction");
  const unrankedPhotos = photos.filter((p) => p.tag === null);

  // When a specific tag filter is active, show as flat grid
  const showGrouped = !filterTag || filterTag === null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Art Sorter</h1>
        <button className="scan-btn" onClick={scanPhotos}>
          Scan Photos
        </button>
      </header>

      <FilterBar />

      <main className="app-main">
        {loading && photos.length === 0 && (
          <div className="loading">Loading photos...</div>
        )}

        {!loading && photos.length === 0 && (
          <div className="empty-state">
            No photos found. Place JPEG files in the <code>photos/</code>{" "}
            directory and click "Scan Photos".
          </div>
        )}

        {showGrouped ? (
          <>
            <TagGroup tag="love" photos={lovePhotos} />
            <TagGroup tag="like" photos={likePhotos} />
            <TagGroup tag="meh" photos={mehPhotos} />
            <TagGroup tag="tax_deduction" photos={taxDeductionPhotos} />
            <UnrankedSection photos={unrankedPhotos} />
          </>
        ) : filterTag === "unranked" ? (
          <UnrankedSection photos={unrankedPhotos} />
        ) : (
          <TagGroup tag={filterTag} photos={photos} />
        )}
      </main>

      <PhotoModal />
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
