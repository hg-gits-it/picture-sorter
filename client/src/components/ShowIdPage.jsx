import React from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import FilterBar from './FilterBar.jsx';
import PhotoGrid from './PhotoGrid.jsx';

export default function ShowIdPage() {
  const { photos } = usePhotos();

  return (
    <>
      <FilterBar showTagFilters={false} />
      <PhotoGrid photos={photos} draggable={false} showRank={false} />
    </>
  );
}
