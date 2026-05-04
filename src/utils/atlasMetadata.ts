import { Frame, SpriteSheetSettings } from '../types';

export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasFrameMetadata {
  sourceSize: { w: number; h: number };
  spriteSourceSize: AtlasRect;
  frame: AtlasRect;
  trimmed: boolean;
  pivot: { x: number; y: number };
  offset: { x: number; y: number };
}

function isValidTrimmedBox(trimmedBox: Frame['trimmedBox'], sourceSize: { w: number; h: number }) {
  if (!trimmedBox) return false;
  if (!Number.isFinite(trimmedBox.x) || !Number.isFinite(trimmedBox.y) || !Number.isFinite(trimmedBox.w) || !Number.isFinite(trimmedBox.h)) return false;
  if (trimmedBox.w <= 0 || trimmedBox.h <= 0) return false;
  if (trimmedBox.x < 0 || trimmedBox.y < 0) return false;
  if (trimmedBox.x + trimmedBox.w > sourceSize.w) return false;
  if (trimmedBox.y + trimmedBox.h > sourceSize.h) return false;
  return true;
}

function isFullFrameTrim(trimmedBox: AtlasRect, sourceSize: { w: number; h: number }) {
  return trimmedBox.x === 0 && trimmedBox.y === 0 && trimmedBox.w === sourceSize.w && trimmedBox.h === sourceSize.h;
}

export function deriveAtlasFrameMetadata(
  frame: Frame,
  settings: Pick<SpriteSheetSettings, 'anchor' | 'customPivot'>,
  packedFrame?: Partial<Pick<AtlasRect, 'x' | 'y'>>
): AtlasFrameMetadata {
  const sourceSize = { w: frame.originalWidth, h: frame.originalHeight };
  const fallbackRect: AtlasRect = { x: 0, y: 0, w: sourceSize.w, h: sourceSize.h };

  const validTrim = isValidTrimmedBox(frame.trimmedBox, sourceSize)
    ? { ...frame.trimmedBox }
    : fallbackRect;

  const trimmed = !isFullFrameTrim(validTrim, sourceSize);

  return {
    sourceSize,
    spriteSourceSize: validTrim,
    frame: {
      x: packedFrame?.x ?? 0,
      y: packedFrame?.y ?? 0,
      w: validTrim.w,
      h: validTrim.h,
    },
    trimmed,
    pivot: settings.anchor === 'custom' ? settings.customPivot : { x: 0.5, y: 0.5 },
    offset: frame.offset,
  };
}
