import React from 'react';
import { usePhotos } from '../context/PhotoContext.jsx';
import { TAGS } from '../constants/tags.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  ...TAGS,
  { key: 'unrated', label: 'Unrated' },
];

export default function FilterBar() {
  const { filterTag, setFilterTag, searchQuery, setSearchQuery, counts, hideClaimed, setHideClaimed } =
    usePhotos();

  const getCount = (key) => {
    if (key === 'all') return counts.total;
    return counts[key] || 0;
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-top">
        <div className="filter-buttons">
          {FILTERS.map(({ key, label, icon }) => (
            <button
              key={label}
              className={`filter-btn ${filterTag === key ? 'active' : ''} filter-${key}`}
              onClick={() => setFilterTag(key)}
            >
              {icon && <span className="filter-icon">{icon}</span>}
              {label}
              <span className="filter-count">{getCount(key)}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <label className="toggle-switch" title={hideClaimed ? 'Showing unclaimed only' : 'Showing all pieces'}>
        <input
          type="checkbox"
          checked={hideClaimed}
          onChange={(e) => setHideClaimed(e.target.checked)}
        />
        <span className="toggle-slider" />
        <span className="toggle-label">Hide claimed</span>
      </label>
    </div>
  );
}
