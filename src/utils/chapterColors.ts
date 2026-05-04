import { AnimationChapter } from '@/types';

export const CHAPTER_COLORS = [
  '#a855f7',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
];

export const getNextChapterColor = (chapters: AnimationChapter[]) =>
  CHAPTER_COLORS[chapters.length % CHAPTER_COLORS.length];

export const getContrastingTextColor = (backgroundHex: string, light = '#ffffff', dark = '#111827') => {
  if (typeof backgroundHex !== 'string') return light;

  const hex = backgroundHex.replace('#', '').trim();
  const normalized = hex.length === 3
    ? hex.split('').map(ch => `${ch}${ch}`).join('')
    : hex;

  if (normalized.length !== 6) return light;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) return light;

  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance > 150 ? dark : light;
};

export const darkenHexColor = (hexColor: string, amount = 0.25) => {
  if (typeof hexColor !== 'string') return '#27272a';
  const hex = hexColor.replace('#', '').trim();
  const normalized = hex.length === 3
    ? hex.split('').map(ch => `${ch}${ch}`).join('')
    : hex;
  if (normalized.length !== 6) return '#27272a';

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#27272a';

  const factor = Math.max(0, Math.min(1, 1 - amount));
  const darkR = Math.round(r * factor);
  const darkG = Math.round(g * factor);
  const darkB = Math.round(b * factor);
  return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
};
