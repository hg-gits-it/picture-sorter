import React, { useEffect, useMemo, useCallback } from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import { fullImageUrl } from '../api/photos.js';
import { parseFilename } from '../utils/parseFilename.js';

export default function PhotoModal() {
  const { selectedPhoto, setSelectedPhoto, photos } = usePhotos();
  const meta = useMemo(
    () => selectedPhoto ? parseFilename(selectedPhoto.filename) : null,
    [selectedPhoto]
  );

  const currentIndex = useMemo(
    () => selectedPhoto ? photos.findIndex(p => p.id === selectedPhoto.id) : -1,
    [selectedPhoto, photos]
  );

  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto = currentIndex >= 0 && currentIndex < photos.length - 1 ? photos[currentIndex + 1] : null;

  const goToPrev = useCallback(() => {
    if (prevPhoto) setSelectedPhoto(prevPhoto);
  }, [prevPhoto, setSelectedPhoto]);

  const goToNext = useCallback(() => {
    if (nextPhoto) setSelectedPhoto(nextPhoto);
  }, [nextPhoto, setSelectedPhoto]);

  useEffect(() => {
    if (!selectedPhoto) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, setSelectedPhoto, goToPrev, goToNext]);

  if (!selectedPhoto || !meta) return null;

  return (
    <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
      {prevPhoto && (
        <button className="modal-nav modal-nav-prev" onClick={(e) => { e.stopPropagation(); goToPrev(); }}>&#8249;</button>
      )}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <img
          src={fullImageUrl(selectedPhoto.id)}
          alt={meta.title}
        />
        <div className="modal-info">
          <div className="modal-title">{meta.title}</div>
          {meta.artist && <div className="modal-artist">{meta.artist}</div>}
          <div className="modal-details">
            {meta.medium && <span>{meta.medium}</span>}
            {meta.medium && meta.dimensions && <span className="modal-sep">&middot;</span>}
            {meta.dimensions && <span>{meta.dimensions}</span>}
          </div>
        </div>
      </div>
      {nextPhoto && (
        <button className="modal-nav modal-nav-next" onClick={(e) => { e.stopPropagation(); goToNext(); }}>&#8250;</button>
      )}
    </div>
  );
}
