import React, { useRef } from 'react';
import PhotoCard from './PhotoCard.jsx';
import { usePhotos } from '../context/PhotoContext.jsx';

export default function PhotoGrid({ photos, draggable, showRank = true }) {
  const { reorderPhoto } = usePhotos();
  const dragItemRef = useRef(null);

  const handleDragStart = (e, photo) => {
    dragItemRef.current = photo;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetPhoto) => {
    e.preventDefault();
    const sourcePhoto = dragItemRef.current;
    if (!sourcePhoto || sourcePhoto.id === targetPhoto.id) return;

    // Remove dragging class from all cards
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

    reorderPhoto(sourcePhoto.id, targetPhoto.group_position);
    dragItemRef.current = null;
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    dragItemRef.current = null;
  };

  return (
    <div className="photo-grid" onDragEnd={draggable ? handleDragEnd : undefined}>
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          draggable={draggable}
          showRank={showRank}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
