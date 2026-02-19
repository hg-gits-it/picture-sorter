import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchShowtimePhotos, takePhoto, restorePhoto, thumbnailUrl, fullImageUrl } from '../api/photos.js';
import { parseFilename } from '../utils/parseFilename.js';

export default function ShowtimePage() {
  const [photos, setPhotos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [confirmPhoto, setConfirmPhoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const takenRef = useRef(null);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await fetchShowtimePhotos();
      setPhotos(data.photos);
    } catch (err) {
      setError('Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const availablePhotos = useMemo(
    () => photos.filter(p => !p.taken),
    [photos]
  );

  const takenPhotos = useMemo(
    () => photos.filter(p => p.taken),
    [photos]
  );

  const photoByNumber = useMemo(() => {
    const map = {};
    for (const photo of photos) {
      const parsed = parseFilename(photo.filename);
      if (parsed.number) {
        // Strip leading zeros for lookup
        const normalized = String(parseInt(parsed.number, 10));
        map[normalized] = { ...photo, parsed };
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
    const match = photoByNumber[normalized];

    if (!match) {
      setError(`No artwork found with number ${num}`);
      return;
    }
    if (match.taken) {
      setError(`Artwork #${num} is already taken`);
      return;
    }
    setConfirmPhoto(match);
  }

  async function handleConfirm() {
    if (!confirmPhoto) return;
    try {
      await takePhoto(confirmPhoto.id);
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

  function getParsed(photo) {
    return parseFilename(photo.filename);
  }

  if (loading) {
    return <div className="showtime"><div className="loading">Loading...</div></div>;
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
            onChange={e => setInputValue(e.target.value)}
            autoFocus
          />
          <button type="submit" className="showtime-claim-btn">Claim</button>
        </form>
      </header>

      {error && <div className="showtime-error">{error}</div>}

      <section className="showtime-list">
        {availablePhotos.map(photo => {
          const p = getParsed(photo);
          return (
            <div key={photo.id} className="showtime-row">
              <img
                className="showtime-thumb"
                src={thumbnailUrl(photo.filename)}
                alt={p.title}
              />
              <span className="showtime-row-rank">#{photo.global_rank}</span>
              <span className="showtime-row-number">{p.number}</span>
              <span className="showtime-row-title">{p.title}</span>
              <span className="showtime-row-artist">{p.artist}</span>
              <span className="showtime-row-medium">{p.medium}</span>
              <span className="showtime-row-dimensions">{p.dimensions}</span>
            </div>
          );
        })}
      </section>

      {takenPhotos.length > 0 && (
        <section className="showtime-taken-section" ref={takenRef}>
          <h2 className="showtime-taken-title">Taken</h2>
          {takenPhotos.map(photo => {
            const p = getParsed(photo);
            return (
              <div key={photo.id} className="showtime-row taken">
                <img
                  className="showtime-thumb"
                  src={thumbnailUrl(photo.filename)}
                  alt={p.title}
                />
                <span className="showtime-row-rank">#{photo.global_rank}</span>
                <span className="showtime-row-number">{p.number}</span>
                <span className="showtime-row-title">{p.title}</span>
                <span className="showtime-row-artist">{p.artist}</span>
                <span className="showtime-row-medium">{p.medium}</span>
                <span className="showtime-row-dimensions">{p.dimensions}</span>
                <button
                  className="showtime-restore-btn"
                  onClick={() => handleRestore(photo.id)}
                >Restore</button>
              </div>
            );
          })}
        </section>
      )}

      <div className="showtime-nav-arrows">
        <button
          className="showtime-nav-btn"
          title="Scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >&#x2191;</button>
        {takenPhotos.length > 0 && (
          <button
            className="showtime-nav-btn"
            title="Scroll to Taken"
            onClick={() => takenRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >&#x2193;</button>
        )}
      </div>

      {confirmPhoto && (
        <div className="modal-overlay" onClick={() => setConfirmPhoto(null)}>
          <div className="showtime-confirm" onClick={e => e.stopPropagation()}>
            <img src={fullImageUrl(confirmPhoto.id)} alt={confirmPhoto.parsed.title} />
            <div className="showtime-confirm-info">
              <div className="showtime-confirm-number">#{confirmPhoto.parsed.number}</div>
              <div className="showtime-confirm-title">{confirmPhoto.parsed.title}</div>
              <div className="showtime-confirm-artist">{confirmPhoto.parsed.artist}</div>
              <div className="showtime-confirm-details">
                {confirmPhoto.parsed.medium}
                {confirmPhoto.parsed.dimensions && (
                  <span className="modal-sep">|</span>
                )}
                {confirmPhoto.parsed.dimensions}
              </div>
            </div>
            <div className="showtime-confirm-actions">
              <button className="showtime-cancel-btn" onClick={() => setConfirmPhoto(null)}>
                Cancel
              </button>
              <button className="showtime-confirm-btn" onClick={handleConfirm}>
                Confirm Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
