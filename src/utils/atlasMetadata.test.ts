import { describe, expect, it } from 'vitest';
import { deriveAtlasFrameMetadata } from './atlasMetadata';
import { Frame } from '../types';

const baseFrame: Frame = {
  id: 'f1',
  blob: new Blob(),
  url: 'blob://f1',
  index: 0,
  originalWidth: 100,
  originalHeight: 50,
  durationMultiplier: 1,
  offset: { x: 3, y: -2 },
};

describe('deriveAtlasFrameMetadata', () => {
  it('derives sourceSize from originalWidth/originalHeight', () => {
    const out = deriveAtlasFrameMetadata(baseFrame, { anchor: 'center', customPivot: { x: 0.2, y: 0.9 } });
    expect(out.sourceSize).toEqual({ w: 100, h: 50 });
  });

  it('derives spriteSourceSize from trimmedBox when available', () => {
    const out = deriveAtlasFrameMetadata(
      { ...baseFrame, trimmedBox: { x: 10, y: 5, w: 30, h: 20 } },
      { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }
    );
    expect(out.spriteSourceSize).toEqual({ x: 10, y: 5, w: 30, h: 20 });
    expect(out.frame.w).toBe(30);
    expect(out.frame.h).toBe(20);
  });

  it('falls back to full frame when trimmedBox is missing', () => {
    const out = deriveAtlasFrameMetadata(baseFrame, { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } });
    expect(out.spriteSourceSize).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  it('sets trimmed false for full-frame bounds', () => {
    const out = deriveAtlasFrameMetadata(
      { ...baseFrame, trimmedBox: { x: 0, y: 0, w: 100, h: 50 } },
      { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }
    );
    expect(out.trimmed).toBe(false);
  });

  it('sets trimmed true only when trimmedBox is smaller than sourceSize', () => {
    const out = deriveAtlasFrameMetadata(
      { ...baseFrame, trimmedBox: { x: 1, y: 1, w: 80, h: 40 } },
      { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }
    );
    expect(out.trimmed).toBe(true);
  });

  it('passes offset through from frame', () => {
    const out = deriveAtlasFrameMetadata(baseFrame, { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } });
    expect(out.offset).toEqual({ x: 3, y: -2 });
  });

  it('passes pivot through from customPivot when anchor is custom', () => {
    const out = deriveAtlasFrameMetadata(baseFrame, { anchor: 'custom', customPivot: { x: 0.25, y: 0.75 } });
    expect(out.pivot).toEqual({ x: 0.25, y: 0.75 });
  });

  it('uses packed coordinates when provided and defaults to x/y 0 otherwise', () => {
    const out = deriveAtlasFrameMetadata(baseFrame, { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }, { x: 12, y: 34 });
    expect(out.frame.x).toBe(12);
    expect(out.frame.y).toBe(34);
  });

  it('defensively falls back for invalid trimmedBox', () => {
    const out = deriveAtlasFrameMetadata(
      { ...baseFrame, trimmedBox: { x: -1, y: 0, w: 10, h: 10 } },
      { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }
    );
    expect(out.spriteSourceSize).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(out.trimmed).toBe(false);
  });

  it.each([
    { x: Number.NaN, y: 0, w: 10, h: 10 },
    { x: Infinity, y: 0, w: 10, h: 10 },
    { x: -Infinity, y: 0, w: 10, h: 10 },
  ])('falls back to full frame for non-finite trimmedBox values: %o', (trimmedBox) => {
    const out = deriveAtlasFrameMetadata(
      { ...baseFrame, trimmedBox },
      { anchor: 'center', customPivot: { x: 0.5, y: 0.5 } }
    );
    expect(out.spriteSourceSize).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(out.frame.w).toBe(100);
    expect(out.frame.h).toBe(50);
    expect(out.trimmed).toBe(false);
  });
});
