import React, { useState, useRef } from "react";
import { usePhotos } from "../context/PhotoContext.jsx";
import { thumbnailUrl } from "../api/photos.js";

export default function PhotoCard({
  photo,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const { tagPhoto, setSelectedPhoto, reorderPhoto } = usePhotos();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  const handleTag = (tag) => {
    if (photo.tag === tag) {
      tagPhoto(photo.id, null);
    } else {
      tagPhoto(photo.id, tag);
    }
  };

  const dragProps = draggable
    ? {
        draggable: true,
        onDragStart: (e) => onDragStart?.(e, photo),
        onDragOver: (e) => onDragOver?.(e, photo),
        onDrop: (e) => onDrop?.(e, photo),
      }
    : {};

  return (
    <div
      className={`photo-card ${draggable ? "draggable" : ""} ${photo.taken ? "taken" : ""}`}
      {...dragProps}
    >
      <div className="photo-card-image" onClick={() => setSelectedPhoto(photo)}>
        <img
          src={thumbnailUrl(photo.filename)}
          alt={photo.title}
          loading="lazy"
        />
        {photo.taken && <div className="photo-card-claimed">Claimed</div>}
      </div>
      <div className="photo-card-info">
        <div className="photo-card-meta">
          {photo.number && (
            <span className="photo-card-number">#{photo.number}</span>
          )}
          <span className="photo-card-title" title={photo.title}>
            {photo.title}
          </span>
          {photo.artist && (
            <span className="photo-card-artist">{photo.artist}</span>
          )}
          <span className="photo-card-details">
            {photo.medium && (
              <span className="photo-card-medium">{photo.medium}</span>
            )}
            {photo.dimensions && (
              <span className="photo-card-dimensions">{photo.dimensions}</span>
            )}
          </span>
        </div>
        {photo.tag != null &&
          photo.group_position != null &&
          (editing ? (
            <input
              ref={inputRef}
              className="photo-card-rank-input"
              type="number"
              min={1}
              defaultValue={photo.group_position}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.target.blur();
                } else if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              onBlur={(e) => {
                setEditing(false);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val !== photo.group_position) {
                  reorderPhoto(photo.id, val);
                }
              }}
            />
          ) : (
            <span
              className="photo-card-rank"
              onClick={() => {
                setEditing(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <span className="photo-card-rank-edit-icon">&#9998;</span>
              {photo.group_position}
            </span>
          ))}
      </div>
      <div className="photo-card-actions">
        <button
          className={`tag-btn love ${photo.tag === "love" ? "active" : ""}`}
          onClick={() => handleTag("love")}
          title="Love"
        >
          &#9829;
        </button>
        <button
          className={`tag-btn like ${photo.tag === "like" ? "active" : ""}`}
          onClick={() => handleTag("like")}
          title="Like"
        >
          &#9757;
        </button>
        <button
          className={`tag-btn meh ${photo.tag === "meh" ? "active" : ""}`}
          onClick={() => handleTag("meh")}
          title="Meh"
        >
          &#9759;
        </button>
        <button
          className={`tag-btn tax_deduction ${photo.tag === "tax_deduction" ? "active" : ""}`}
          onClick={() => handleTag("tax_deduction")}
          title="Tax Deduction"
        >
          $
        </button>
      </div>
    </div>
  );
}
