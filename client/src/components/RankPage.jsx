import React from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import FilterBar from './FilterBar.jsx';
import TagGroup from './TagGroup.jsx';
import UnratedSection from './UnratedSection.jsx';

export default function RankPage() {
  const { photos, filterTag } = usePhotos();

  const lovePhotos = photos.filter((p) => p.tag === 'love');
  const likePhotos = photos.filter((p) => p.tag === 'like');
  const mehPhotos = photos.filter((p) => p.tag === 'meh');
  const passPhotos = photos.filter((p) => p.tag === 'pass');
  const unratedPhotos = photos.filter((p) => p.tag === 'unrated');

  const showGrouped = filterTag === 'all';

  return (
    <>
      <FilterBar />
      {showGrouped ? (
        <>
          <TagGroup tag="love" photos={lovePhotos} />
          <TagGroup tag="like" photos={likePhotos} />
          <TagGroup tag="meh" photos={mehPhotos} />
          <TagGroup tag="pass" photos={passPhotos} />
          <UnratedSection photos={unratedPhotos} />
        </>
      ) : filterTag === 'unrated' ? (
        <UnratedSection photos={unratedPhotos} />
      ) : (
        <TagGroup tag={filterTag} photos={photos} />
      )}
    </>
  );
}
