import React from "react";
import { usePhotos } from "../context/PhotoContext.jsx";

const FILTERS = [
  { key: null, label: "All" },
  { key: "love", label: "Love" },
  { key: "like", label: "Like" },
  { key: "meh", label: "Meh" },
  { key: "tax_deduction", label: "Tax Deduction" },
  { key: "unranked", label: "Unranked" },
];

export default function FilterBar() {
  const { filterTag, setFilterTag, searchQuery, setSearchQuery, counts } =
    usePhotos();

  const getCount = (key) => {
    if (key === null) return counts.total;
    return counts[key] || 0;
  };

  return (
    <div className="filter-bar">
      <div className="filter-buttons">
        {FILTERS.map(({ key, label }) => (
          <button
            key={label}
            className={`filter-btn ${filterTag === key ? "active" : ""} ${key ? "filter-" + key : "filter-all"}`}
            onClick={() => setFilterTag(key)}
          >
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
  );
}
