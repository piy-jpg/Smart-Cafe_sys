const CATEGORY_THEMES = {
  'Hot Coffee': { start: '#7c3f16', end: '#d97706', accent: '#f8fafc' },
  'Iced Coffee': { start: '#0f766e', end: '#38bdf8', accent: '#ecfeff' },
  Tea: { start: '#166534', end: '#84cc16', accent: '#f7fee7' },
  Bakery: { start: '#b45309', end: '#f59e0b', accent: '#fff7ed' },
  Breakfast: { start: '#b91c1c', end: '#fb923c', accent: '#fff7ed' },
  Lunch: { start: '#0369a1', end: '#22c55e', accent: '#f0fdf4' },
  Dessert: { start: '#be185d', end: '#f472b6', accent: '#fdf2f8' },
  Smoothies: { start: '#0f766e', end: '#14b8a6', accent: '#ecfeff' },
  Refreshers: { start: '#0284c7', end: '#60a5fa', accent: '#eff6ff' },
  Milkshakes: { start: '#9333ea', end: '#f472b6', accent: '#fdf4ff' },
  Wraps: { start: '#92400e', end: '#facc15', accent: '#fefce8' },
  Burgers: { start: '#991b1b', end: '#f97316', accent: '#fff7ed' },
  Pasta: { start: '#9a3412', end: '#f59e0b', accent: '#fffbeb' },
  Pizza: { start: '#b91c1c', end: '#f59e0b', accent: '#fff7ed' },
  Salads: { start: '#166534', end: '#22c55e', accent: '#f0fdf4' },
  Mocktails: { start: '#7c2d12', end: '#fb7185', accent: '#fff1f2' },
  Waffles: { start: '#92400e', end: '#fbbf24', accent: '#fffbeb' },
  Sundaes: { start: '#7e22ce', end: '#ec4899', accent: '#fdf4ff' }
};

const DEFAULT_THEME = { start: '#334155', end: '#0ea5e9', accent: '#f8fafc' };

const sanitizeLabel = (value, fallback) => {
  const text = String(value || fallback)
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text || fallback;
};

const getInitials = (name) => (
  sanitizeLabel(name, 'Cafe')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
);

export const getFallbackMenuArt = (item) => {
  const category = sanitizeLabel(item?.category, 'Cafe Special');
  const name = sanitizeLabel(item?.name, 'House Item');
  const theme = CATEGORY_THEMES[category] || DEFAULT_THEME;
  const title = name.toUpperCase().slice(0, 22);
  const subtitle = category.toUpperCase().slice(0, 22);
  const initials = getInitials(name);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.start}" />
          <stop offset="100%" stop-color="${theme.end}" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" rx="28" fill="url(#bg)" />
      <circle cx="314" cy="52" r="58" fill="${theme.accent}" fill-opacity="0.16" />
      <circle cx="355" cy="198" r="84" fill="${theme.accent}" fill-opacity="0.12" />
      <rect x="26" y="26" width="118" height="118" rx="28" fill="${theme.accent}" fill-opacity="0.22" />
      <text x="85" y="101" font-family="Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="${theme.accent}">
        ${initials}
      </text>
      <rect x="26" y="164" width="210" height="10" rx="5" fill="${theme.accent}" fill-opacity="0.28" />
      <rect x="26" y="182" width="168" height="10" rx="5" fill="${theme.accent}" fill-opacity="0.18" />
      <text x="28" y="196" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="#ffffff">
        ${title}
      </text>
      <text x="28" y="224" font-family="Arial, sans-serif" font-size="14" letter-spacing="2" fill="${theme.accent}">
        ${subtitle}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const getMenuImage = (item) => {
  if (item?.image_url) return item.image_url;
  return getFallbackMenuArt(item);
};
