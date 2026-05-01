import { AnimationChapter, KeyBinding } from '@/types';

interface CleanupChaptersInput {
  chapters: AnimationChapter[];
  bindings: KeyBinding[];
  validFrameIds: Set<string>;
}

interface CleanupChaptersResult {
  chapters: AnimationChapter[];
  bindings: KeyBinding[];
  removedChapterCount: number;
}

export function cleanupChapters({
  chapters,
  bindings,
  validFrameIds,
}: CleanupChaptersInput): CleanupChaptersResult {
  const nextChapters = chapters
    .map((chapter) => ({
      ...chapter,
      frameIds: chapter.frameIds.filter((frameId) => validFrameIds.has(frameId)),
    }))
    .filter((chapter) => chapter.frameIds.length > 0);

  const validChapterIds = new Set(nextChapters.map((chapter) => chapter.id));
  const nextBindings = bindings.map((binding) => (
    binding.chapterId && !validChapterIds.has(binding.chapterId)
      ? { ...binding, chapterId: null }
      : binding
  ));

  return {
    chapters: nextChapters,
    bindings: nextBindings,
    removedChapterCount: chapters.length - nextChapters.length,
  };
}
