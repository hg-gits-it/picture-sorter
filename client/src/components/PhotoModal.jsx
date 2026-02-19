import React, { useEffect, useMemo } from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import { fullImageUrl } from '../api/photos.js';
import { parseFilename } from '../utils/parseFilename.js';

export default function PhotoModal() {
  const { selectedPhoto, setSelectedPhoto } = usePhotos();
  const meta = useMemo(
    () => selectedPhoto ? parseFilename(selectedPhoto.filename) : null,
    [selectedPhoto]
  );

  useEffect(() => {
    if (!selectedPhoto) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, setSelectedPhoto]);

  if (!selectedPhoto || !meta) return null;

  return (
    <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
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
    </div>
  );
}
