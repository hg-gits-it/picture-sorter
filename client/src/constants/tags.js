// Single source of truth for tag definitions on the client.

export const TAGS = [
  { key: 'love', label: 'Love', icon: '\u2764\uFE0F' },
  { key: 'like', label: 'Like', icon: '\uD83D\uDC4D' },
  { key: 'meh', label: 'Meh', icon: '\uD83D\uDE10' },
  { key: 'pass', label: 'Pass', icon: '\u26D4' },
];

export const TAG_LABELS = Object.fromEntries(
  TAGS.map(({ key, label }) => [key, label]),
);

export const TAG_ICONS = Object.fromEntries(
  TAGS.map(({ key, icon }) => [key, icon]),
);
