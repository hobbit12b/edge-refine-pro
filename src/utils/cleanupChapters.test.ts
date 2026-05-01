import { describe, expect, it } from 'vitest';
import { cleanupChapters } from './cleanupChapters';
import { AnimationChapter, KeyBinding } from '@/types';

const chapters: AnimationChapter[] = [
  { id: 'chapter-empty', name: 'Empty', frameIds: ['frame-gone'], color: '#f00', isExpanded: true },
  { id: 'chapter-mixed', name: 'Mixed', frameIds: ['frame-keep', 'frame-gone-2'], color: '#0f0' },
];

const bindings: KeyBinding[] = [
  {
    id: 'binding-empty',
    keys: ['1'],
    label: 'Empty Binding',
    chapterId: 'chapter-empty',
    mirror: false,
    holdToPlay: false,
    loop: true,
    finishAnimation: false,
  },
  {
    id: 'binding-mixed',
    keys: ['2'],
    label: 'Mixed Binding',
    chapterId: 'chapter-mixed',
    mirror: false,
    holdToPlay: false,
    loop: true,
    finishAnimation: false,
  },
];

describe('cleanupChapters', () => {
  it('removes empty chapters, keeps valid chapters, and updates bindings', () => {
    const result = cleanupChapters({
      chapters,
      bindings,
      validFrameIds: new Set(['frame-keep']),
    });

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]).toEqual({
      id: 'chapter-mixed',
      name: 'Mixed',
      frameIds: ['frame-keep'],
      color: '#0f0',
    });

    expect(result.bindings).toEqual([
      { ...bindings[0], chapterId: null },
      bindings[1],
    ]);
    expect(result.removedChapterCount).toBe(1);
  });
});
