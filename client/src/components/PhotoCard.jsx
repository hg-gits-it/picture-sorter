import React, { useMemo } from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import { thumbnailUrl } from '../api/photos.js';
import { parseFilename } from '../utils/parseFilename.js';

export default function PhotoCard({ photo, draggable, onDragStart, onDragOver, onDrop }) {
  const { tagPhoto, setSelectedPhoto } = usePhotos();
  const meta = useMemo(() => parseFilename(photo.filename), [photo.filename]);

  const handleTag = (tag) => {
    if (photo.tag === tag) {
      tagPhoto(photo.id, null);
    } else {
      tagPhoto(photo.id, tag);
    }
  };

  const dragProps = draggable ? {
    draggable: true,
    onDragStart: (e) => onDragStart?.(e, photo),
    onDragOver: (e) => onDragOver?.(e, photo),
    onDrop: (e) => onDrop?.(e, photo),
  } : {};

  return (
    <div className={`photo-card ${draggable ? 'draggable' : ''}`} {...dragProps}>
      <div className="photo-card-image" onClick={() => setSelectedPhoto(photo)}>
        <img src={thumbnailUrl(photo.filename)} alt={meta.title} loading="lazy" />
      </div>
      <div className="photo-card-info">
        <div className="photo-card-meta">
          {meta.number && <span className="photo-card-number">#{meta.number}</span>}
          <span className="photo-card-title" title={meta.title}>{meta.title}</span>
          {meta.artist && <span className="photo-card-artist">{meta.artist}</span>}
          <span className="photo-card-details">
            {meta.medium && <span className="photo-card-medium">{meta.medium}</span>}
            {meta.dimensions && <span className="photo-card-dimensions">{meta.dimensions}</span>}
          </span>
        </div>
        {photo.global_rank != null && (
          <span className="photo-card-rank">#{photo.global_rank}</span>
        )}
      </div>
      <div className="photo-card-actions">
        <button
          className={`tag-btn love ${photo.tag === 'love' ? 'active' : ''}`}
          onClick={() => handleTag('love')}
          title="Love"
        >
          &#9829;
        </button>
        <button
          className={`tag-btn like ${photo.tag === 'like' ? 'active' : ''}`}
          onClick={() => handleTag('like')}
          title="Like"
        >
          &#9757;
        </button>
        <button
          className={`tag-btn meh ${photo.tag === 'meh' ? 'active' : ''}`}
          onClick={() => handleTag('meh')}
          title="Meh"
        >
          &#9759;
        </button>
        <button
          className={`tag-btn tax_deduction ${photo.tag === 'tax_deduction' ? 'active' : ''}`}
          onClick={() => handleTag('tax_deduction')}
          title="Tax Deduction"
        >
          $
        </button>
      </div>
    </div>
  );
}
