const TAGS = [
  { key: 'love', label: 'Love', icon: '\u2764\uFE0F' },
  { key: 'like', label: 'Like', icon: '\uD83D\uDC4D' },
  { key: 'meh', label: 'Meh', icon: '\uD83D\uDE10' },
  { key: 'tax_deduction', label: 'Tax Deduction', icon: '\uD83D\uDCB2' },
];

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
