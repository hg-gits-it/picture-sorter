import React from 'react';
import PhotoGrid from './PhotoGrid.jsx';

export default function UnrankedSection({ photos }) {
  if (photos.length === 0) return null;

  return (
    <section className="tag-group tag-group-unranked">
      <h2 className="tag-group-title">Unranked</h2>
      <PhotoGrid photos={photos} draggable={false} />
    </section>
  );
}
