import { TAGS } from '../constants/tags.js';

export default function TagButtons({ currentTag, onTag }) {
  return TAGS.map(({ key, label, icon }) => (
    <button
      key={key}
      className={`tag-btn ${key} ${currentTag === key ? 'active' : ''}`}
      onClick={() => onTag(key)}
      title={label}
    >
      {icon}
    </button>
  ));
}
