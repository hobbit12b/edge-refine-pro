import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { Frame } from '@/types';

type HistorySnapshot = {
  frames: Frame[];
  selectedIds: Set<string>;
};

type UseHistoryParams = {
  frames: Frame[];
  selectedIds: Set<string>;
  setFrames: Dispatch<SetStateAction<Frame[]>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
};

export function useHistory({ frames, selectedIds, setFrames, setSelectedIds }: UseHistoryParams) {
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  const pushToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), { frames: [...frames], selectedIds: new Set(selectedIds) }]);
    setRedoStack([]);
  }, [frames, selectedIds]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setHistory(prev => {
      const newHistory = [...prev];
      const prevState = newHistory.pop();
      if (prevState) {
        setRedoStack(redo => [...redo, { frames: [...frames], selectedIds: new Set(selectedIds) }]);
        setFrames(prevState.frames);
        setSelectedIds(prevState.selectedIds);
      }
      return newHistory;
    });
  }, [history, frames, selectedIds, setFrames, setSelectedIds]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    setRedoStack(prev => {
      const newRedo = [...prev];
      const nextState = newRedo.pop();
      if (nextState) {
        setHistory(h => [...h, { frames: [...frames], selectedIds: new Set(selectedIds) }]);
        setFrames(nextState.frames);
        setSelectedIds(nextState.selectedIds);
      }
      return newRedo;
    });
  }, [redoStack, frames, selectedIds, setFrames, setSelectedIds]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setRedoStack([]);
  }, []);

  return {
    history,
    setHistory,
    redoStack,
    setRedoStack,
    pushToHistory,
    undo,
    redo,
    clearHistory,
  };
}
