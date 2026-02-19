import React from 'react';
import PhotoGrid from './PhotoGrid.jsx';

const TAG_LABELS = {
  love: 'Love',
  like: 'Like',
  meh: 'Meh',
  tax_deduction: 'Tax Deduction',
};

export default function TagGroup({ tag, photos }) {
  if (photos.length === 0) return null;

  return (
    <section className={`tag-group tag-group-${tag}`}>
      <h2 className="tag-group-title">{TAG_LABELS[tag]}</h2>
      <PhotoGrid photos={photos} draggable />
    </section>
  );
}
