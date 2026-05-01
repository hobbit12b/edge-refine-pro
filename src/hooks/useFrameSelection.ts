import { useCallback, useState } from 'react';
import { Frame } from '@/types';

type UseFrameSelectionOptions = {
  onBeforeSelectAll?: () => void;
  onBeforeDeselectAll?: () => void;
};

export function useFrameSelection(frames: Frame[], options: UseFrameSelectionOptions = {}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [focusedFrameId, setFocusedFrameId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string, shiftKey?: boolean, ctrlKey?: boolean) => {
    let next = new Set(selectedIds);

    if (shiftKey && lastSelectedId) {
      const allIds = frames.map(f => f.id);
      const startIdx = allIds.indexOf(lastSelectedId);
      const endIdx = allIds.indexOf(id);

      if (startIdx !== -1 && endIdx !== -1) {
        const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
        const rangeIds = allIds.slice(min, max + 1);

        if (!ctrlKey) {
          next = new Set(rangeIds);
        } else {
          rangeIds.forEach(rid => next.add(rid));
        }
      }
    } else if (ctrlKey) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next = new Set([id]);
    }

    setSelectedIds(next);
    setLastSelectedId(id);
    setFocusedFrameId(id);
  }, [frames, lastSelectedId, selectedIds]);

  const selectAll = useCallback(() => {
    options.onBeforeSelectAll?.();
    setSelectedIds(new Set(frames.map(f => f.id)));
  }, [frames, options]);

  const deselectAll = useCallback(() => {
    options.onBeforeDeselectAll?.();
    setSelectedIds(new Set());
  }, [options]);

  const resetSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
    setFocusedFrameId(null);
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    lastSelectedId,
    focusedFrameId,
    setFocusedFrameId,
    toggleSelect,
    selectAll,
    deselectAll,
    resetSelection,
  };
}
