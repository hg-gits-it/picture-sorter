import React from 'react';
import PhotoGrid from './PhotoGrid.jsx';

export default function UnratedSection({ photos }) {
  if (photos.length === 0) return null;

  return (
    <section className="tag-group tag-group-unrated">
      <h2 className="tag-group-title">Unrated</h2>
      <PhotoGrid photos={photos} draggable={false} />
    </section>
  );
}
