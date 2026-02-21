import { useEffect, useMemo, useCallback } from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import { fullImageUrl } from '../api/photos.js';
import TagButtons from './TagButtons.jsx';

export default function PhotoModal() {
  const { selectedPhoto, setSelectedPhoto, photos, tagPhoto } = usePhotos();
  const currentPhoto = useMemo(
    () =>
      selectedPhoto
        ? photos.find((p) => p.id === selectedPhoto.id) || selectedPhoto
        : null,
    [selectedPhoto, photos],
  );

  const currentIndex = useMemo(
    () =>
      currentPhoto ? photos.findIndex((p) => p.id === currentPhoto.id) : -1,
    [currentPhoto, photos],
  );

  const handleTag = useCallback(
    (tag) => {
      if (!currentPhoto) return;
      tagPhoto(currentPhoto.id, currentPhoto.tag === tag ? 'unrated' : tag);
    },
    [currentPhoto, tagPhoto],
  );

  const prevPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;
  const nextPhoto =
    currentIndex >= 0 && currentIndex < photos.length - 1
      ? photos[currentIndex + 1]
      : null;

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

  if (!currentPhoto) return null;

  return (
    <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
      {prevPhoto && (
        <button
          className="modal-nav modal-nav-prev"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
        >
          &#8249;
        </button>
      )}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <img src={fullImageUrl(currentPhoto.id)} alt={currentPhoto.title} />
        <div className="modal-tag-actions">
          <TagButtons currentTag={currentPhoto.tag} onTag={handleTag} />
        </div>
        <div className="modal-info">
          {currentPhoto.show_id && (
            <span className="modal-show-id">#{currentPhoto.show_id}</span>
          )}
          <div className="modal-title">{currentPhoto.title}</div>
          {currentPhoto.artist && <div className="modal-artist">{currentPhoto.artist}</div>}
          <div className="modal-details">
            {currentPhoto.medium && <span>{currentPhoto.medium}</span>}
            {currentPhoto.medium && currentPhoto.dimensions && (
              <span className="modal-sep">&middot;</span>
            )}
            {currentPhoto.dimensions && <span>{currentPhoto.dimensions}</span>}
          </div>
        </div>
      </div>
      {nextPhoto && (
        <button
          className="modal-nav modal-nav-next"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
        >
          &#8250;
        </button>
      )}
    </div>
  );
}
