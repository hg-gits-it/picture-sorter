import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  fetchShowtimePhotos,
  takePhoto,
  restorePhoto,
  thumbnailUrl,
  fullImageUrl,
} from '../api/photos.js';
import ScrollArrows from './ScrollArrows.jsx';
import '../styles/showtime.css';

export default function ShowtimePage() {
  const [photos, setPhotos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [confirmPhoto, setConfirmPhoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const takenRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await fetchShowtimePhotos();
      setPhotos(data.photos);
    } catch {
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const availablePhotos = useMemo(
    () => photos.filter((p) => !p.taken),
    [photos],
  );

  const takenPhotos = useMemo(() => photos.filter((p) => p.taken), [photos]);

  const photoByShowId = useMemo(() => {
    const map = {};
    for (const photo of photos) {
      if (photo.show_id) {
        const normalized = String(parseInt(photo.show_id, 10));
        map[normalized] = photo;
      }
    }
    return map;
  }, [photos]);

  function handleClaim(e) {
    e.preventDefault();
    setError('');
    const num = inputValue.trim();
    if (!num) return;

    const normalized = String(parseInt(num, 10));
    const match = photoByShowId[normalized];

    if (!match) {
      setError(`No artwork found with number ${num}`);
      return;
    }
    setConfirmPhoto({ ...match, action: match.taken ? 'restore' : 'claim' });
  }

  async function handleConfirm() {
    if (!confirmPhoto) return;
    try {
      if (confirmPhoto.action === 'restore') {
        await restorePhoto(confirmPhoto.id);
      } else {
        await takePhoto(confirmPhoto.id);
        setToast({ id: confirmPhoto.id, show_id: confirmPhoto.show_id });
      }
      setConfirmPhoto(null);
      setInputValue('');
      setError('');
      await loadPhotos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(id) {
    try {
      await restorePhoto(id);
      setError('');
      await loadPhotos();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="showtime">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="showtime">
      <header className="showtime-header">
        <h1>Showtime</h1>
        <form className="showtime-claim-form" onSubmit={handleClaim}>
          <input
            type="text"
            className="showtime-input"
            placeholder="Artwork #"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="showtime-claim-btn">
            Claim
          </button>
        </form>
      </header>

      {toast && (
        <div className="showtime-toast">
          <span>Claimed #{toast.show_id}</span>
          <button
            className="showtime-toast-undo"
            onClick={async () => {
              try {
                await restorePhoto(toast.id);
                setToast(null);
                setError('');
                await loadPhotos();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Undo
          </button>
        </div>
      )}

      {error && <div className="showtime-error">{error}</div>}

      <section className="showtime-list">
        {availablePhotos.map((photo) => (
            <div key={photo.id} className="showtime-row">
              <span className="showtime-row-show-id">#{photo.show_id}</span>
              <img
                className="showtime-thumb"
                src={thumbnailUrl(photo.flickr_id)}
                alt={photo.title}
              />
              <span className="showtime-row-title">{photo.title}</span>
              <span className="showtime-row-artist">{photo.artist}</span>
              <span className="showtime-row-medium">{photo.medium}</span>
              <span className="showtime-row-dimensions">{photo.dimensions}</span>
            </div>
          ))}
      </section>

      {takenPhotos.length > 0 && (
        <section className="showtime-taken-section" ref={takenRef}>
          <h2 className="showtime-taken-title">Taken</h2>
          {takenPhotos.map((photo) => (
              <div key={photo.id} className="showtime-row taken">
                <span className="showtime-row-show-id">#{photo.show_id}</span>
                <img
                  className="showtime-thumb"
                  src={thumbnailUrl(photo.flickr_id)}
                  alt={photo.title}
                />
                <span className="showtime-row-title">{photo.title}</span>
                <span className="showtime-row-artist">{photo.artist}</span>
                <span className="showtime-row-medium">{photo.medium}</span>
                <span className="showtime-row-dimensions">{photo.dimensions}</span>
                <button
                  className="showtime-restore-btn"
                  onClick={() => handleRestore(photo.id)}
                >
                  Restore
                </button>
              </div>
            ))}
        </section>
      )}

      <ScrollArrows downRef={takenRef} />

      {confirmPhoto && (
        <div className="modal-overlay" onClick={() => setConfirmPhoto(null)}>
          <div
            className="showtime-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fullImageUrl(confirmPhoto.id)}
              alt={confirmPhoto.title}
            />
            <div className="showtime-confirm-info">
              <div className="showtime-confirm-show-id">
                #{confirmPhoto.show_id}
              </div>
              <div className="showtime-confirm-title">
                {confirmPhoto.title}
              </div>
              <div className="showtime-confirm-artist">
                {confirmPhoto.artist}
              </div>
              <div className="showtime-confirm-details">
                {confirmPhoto.medium}
                {confirmPhoto.dimensions && (
                  <span className="modal-sep">|</span>
                )}
                {confirmPhoto.dimensions}
              </div>
            </div>
            <div className="showtime-confirm-actions">
              <button
                className="showtime-cancel-btn"
                onClick={() => setConfirmPhoto(null)}
              >
                Cancel
              </button>
              <button
                className={
                  confirmPhoto.action === 'restore'
                    ? 'showtime-restore-confirm-btn'
                    : 'showtime-confirm-btn'
                }
                onClick={handleConfirm}
              >
                {confirmPhoto.action === 'restore'
                  ? 'Restore'
                  : 'Confirm Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
