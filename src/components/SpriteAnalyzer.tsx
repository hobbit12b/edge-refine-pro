import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Grid, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown,
  Layers,
  Plus,
  Minus,
  Play,
  Pause,
  Undo2,
  Target,
  Loader2,
  Save,
  LayoutList,
  Link,
  ListPlus,
  Edit2,
  Trash2,
  HelpCircle,
  MoveDown,
  Anchor,
  RotateCcw,
  ArrowUpDown,
  Check,
  Crosshair
} from 'lucide-react';
import { Frame, SpriteSheetSettings, AnimationChapter } from '../types';
import { PlaybackControls } from './PlaybackControls';
import { darkenHexColor, getContrastingTextColor } from '@/utils/chapterColors';

interface SpriteAnalyzerProps {
  frames: Frame[];
  settings: SpriteSheetSettings;
  focusedFrameId: string | null;
  chapters: AnimationChapter[];
  checkedChapterIds: Set<string>;
  onToggleChapterChecked: (chapterId: string) => void;
  onChaptersChange: (chapters: AnimationChapter[]) => void;
  selectedIds: Set<string>;
  onSelectIds: (ids: Set<string>) => void;
  onBack: () => void;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  onUpdateFrameOffset: (id: string, x: number, y: number) => void;
  onUpdateDuration: (id: string, delta: number) => void;
  onReorderFrames: (startIndex: number, endIndex: number) => void;
  onFocusFrame: (id: string) => void;
  onUpdateFramesOffset: (ids: string[], x: number, y: number) => void;
  onUndo: () => void;
  canUndo: boolean;
  visualScale: number;
  allFramesCount: number;
  onVisualScaleChange: (scale: number) => void;
  onScaleSelection: (factor: number) => void;
  activeView: string;
  onViewChange: (view: any) => void;
  onShowExport: () => void;
  onStartOver: () => void;
  onReorderChapters: (startIndex: number, endIndex: number) => void;
  onDeleteChapter: (chapterId: string) => void;
  onAllFramesToggle: () => void;
  onToggleSelect: (id: string, shift: boolean, ctrl: boolean) => void;
  onSetSelectionAnchor: (id: string) => void;
  steps: any[];
  activeFrames: Frame[];
  isAllFramesChecked: boolean;
  selectionPreviewColor: string | null;
}


export function SpriteAnalyzer({
  frames,
  settings,
  focusedFrameId,
  chapters,
  checkedChapterIds,
  onToggleChapterChecked,
  onChaptersChange,
  selectedIds,
  onBack,
  onSettingsChange,
  onUpdateFrameOffset,
  onUpdateDuration,
  onReorderFrames,
  onFocusFrame,
  onUpdateFramesOffset,
  onSelectIds,
  onUndo,
  canUndo,
  visualScale,
  allFramesCount,
  onVisualScaleChange,
  activeView,
  onViewChange,
  onShowExport,
  onStartOver,
  onReorderChapters,
  onDeleteChapter,
  onAllFramesToggle,
  onToggleSelect,
  onSetSelectionAnchor,
  steps,
  activeFrames,
  isAllFramesChecked,
  selectionPreviewColor,
}: SpriteAnalyzerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDraggingGuide, setIsDraggingGuide] = useState(false);
  const [isDraggingGround, setIsDraggingGround] = useState(false);
  const [isDraggingFrame, setIsDraggingFrame] = useState(false);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanningViewport, setIsPanningViewport] = useState(false);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [onionSkinDir, setOnionSkinDir] = useState<-1 | 1>(-1);
  const [showFrameBounds, setShowFrameBounds] = useState(true);
  const [showTrimmedBounds, setShowTrimmedBounds] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const workAreaRef = useRef<HTMLDivElement>(null);
  const hasMovedGuideRef = useRef(false);

  const playbackFrames = activeFrames;

  const focusedFrame = playbackFrames.find(f => f.id === focusedFrameId) || playbackFrames[0] || null;
  const focusedIndex = focusedFrame ? playbackFrames.findIndex(f => f.id === focusedFrame.id) : -1;


  const chapterByFrameId = useMemo(() => {
    const map = new Map<string, AnimationChapter>();
    chapters.forEach((chapter) => {
      chapter.frameIds.forEach((frameId) => {
        if (!map.has(frameId)) map.set(frameId, chapter);
      });
    });
    return map;
  }, [chapters]);

  const chapterColorsByFrameId = useMemo(() => {
    const map = new Map<string, string[]>();
    chapters.forEach((chapter) => {
      if (!chapter.color) return;
      chapter.frameIds.forEach((frameId) => {
        const colors = map.get(frameId) || [];
        colors.push(chapter.color!);
        map.set(frameId, colors);
      });
    });
    return map;
  }, [chapters]);

  const chapterGridSections = useMemo(() => {
    if (isAllFramesChecked) {
      return [{ chapter: null, frames: playbackFrames }];
    }

    const frameById = new Map(playbackFrames.map((frame) => [frame.id, frame]));
    const seenFrameIds = new Set<string>();

    return chapters
      .filter((chapter) => checkedChapterIds.has(chapter.id))
      .map((chapter) => {
        const chapterFrames = chapter.frameIds
          .map((frameId) => frameById.get(frameId))
          .filter((frame): frame is Frame => Boolean(frame))
          .filter((frame) => {
            if (seenFrameIds.has(frame.id)) return false;
            seenFrameIds.add(frame.id);
            return true;
          });

        return { chapter, frames: chapterFrames };
      })
      .filter((section) => section.frames.length > 0);
  }, [isAllFramesChecked, playbackFrames, chapters, checkedChapterIds]);

  const checkedChapterColorByFrameId = useMemo(() => {
    const map = new Map<string, string>();
    chapters.forEach((chapter) => {
      if (!checkedChapterIds.has(chapter.id) || !chapter.color) return;
      chapter.frameIds.forEach((frameId) => {
        if (!map.has(frameId)) map.set(frameId, chapter.color!);
      });
    });
    return map;
  }, [chapters, checkedChapterIds]);

  const getTopStripColor = (frameId: string, isSelected: boolean) => {
    const chapter = chapterByFrameId.get(frameId);
    if (chapter?.color) {
      if (checkedChapterIds.has(chapter.id)) return chapter.color;
    }
    return '#3f3f46';
  };

  const getTopStripColors = (frameId: string, isSelected: boolean) => {
    const chapterColors = chapterColorsByFrameId.get(frameId);
    if (chapterColors && chapterColors.length > 0) return chapterColors;
    return [getTopStripColor(frameId, isSelected)];
  };

  const toggleChapter = (chapterId: string) => {
    onChaptersChange(chapters.map(c => c.id === chapterId ? { ...c, isExpanded: !c.isExpanded } : c));
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const saveEdit = (chapterId: string) => {
    onChaptersChange(chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, name: editValue };
      }
      return c;
    }));
    setEditingId(null);
  };

  const deleteChapter = (chapterId: string) => {
    onDeleteChapter(chapterId);
  };

  const selectChapterFrames = (chapter: AnimationChapter, isMultiSelect: boolean) => {
    const currentIds = new Set(chapter.frameIds);
    
    if (currentIds.size === 0) return;

    if (isMultiSelect) {
      const next = new Set(selectedIds);
      const allSelected = currentIds.size > 0 && Array.from(currentIds).every(id => next.has(id));
      
      if (allSelected) {
        currentIds.forEach(id => next.delete(id));
      } else {
        currentIds.forEach(id => next.add(id));
      }
      onSelectIds(next);
    } else {
      onSelectIds(currentIds);
    }

    const firstFrameId = Array.from(currentIds)[0];
    if (firstFrameId) onFocusFrame(firstFrameId);
  };

  const fitToScreen = () => {
    const frameW = settings.frameSize.width * visualScale;
    const frameH = settings.frameSize.height * visualScale;
    const viewportW = workAreaRef.current?.clientWidth || viewportRef.current?.clientWidth || window.innerWidth - 600;
    const viewportH = workAreaRef.current?.clientHeight || viewportRef.current?.clientHeight || window.innerHeight - 260;
    const horizontalPadding = 64;
    const verticalPadding = 64;
    const containerW = Math.max(100, viewportW - horizontalPadding);
    const containerH = Math.max(100, viewportH - verticalPadding);

    if (frameW > 0 && frameH > 0) {
      const scaleW = containerW / frameW;
      const scaleH = containerH / frameH;
      const fitScale = Math.max(10, Math.min(800, Math.floor(Math.min(scaleW, scaleH) * 100)));
      onSettingsChange({ ...settings, analyzerZoom: fitScale });
      setViewportOffset({ x: 0, y: 0 });
    }
  };

  const handleTogglePlay = () => {
    if (!isPlaying) {
      // Start from the focused frame within playback scope, or first frame
      const idxInPlayback = focusedFrameId ? playbackFrames.findIndex(f => f.id === focusedFrameId) : -1;
      setCurrentIndex(idxInPlayback !== -1 ? idxInPlayback : 0);
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (playbackFrames.length === 0 || !focusedFrameId) return;
    const isFocusedInPlayback = playbackFrames.some(frame => frame.id === focusedFrameId);
    if (!isFocusedInPlayback) {
      onFocusFrame(playbackFrames[0].id);
    }
  }, [playbackFrames, focusedFrameId, onFocusFrame]);

  useEffect(() => {
    if (isPlaying && playbackFrames.length > 0) {
      const currentFrame = playbackFrames[currentIndex % playbackFrames.length];
      const duration = (1000 / settings.fps) * (currentFrame?.durationMultiplier || 1);
      
      timerRef.current = window.setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % playbackFrames.length);
      }, duration);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, playbackFrames.length, settings.fps, currentIndex, playbackFrames]);

  const navigateFrame = (delta: number) => {
    if (playbackFrames.length === 0) return;
    
    // Find current index in playback list
    let currentIdxInPlayback = playbackFrames.findIndex(f => f.id === focusedFrameId);
    
    // If not found (e.g. focused frame is not in selection), default to 0
    if (currentIdxInPlayback === -1) {
      currentIdxInPlayback = 0;
    }
    
    const nextIndex = (currentIdxInPlayback + delta + playbackFrames.length) % playbackFrames.length;
    onFocusFrame(playbackFrames[nextIndex].id);
  };

  const onionSkinFrame = useMemo(() => {
    if (focusedIndex === -1 || playbackFrames.length === 0) return null;
    const skinIndex = (focusedIndex + onionSkinDir + playbackFrames.length) % playbackFrames.length;
    return playbackFrames[skinIndex];
  }, [focusedIndex, onionSkinDir, playbackFrames]);

  const toggleGridMode = () => {
    const nextMode = settings.guideMode === 'grid' ? 'none' : 'grid';
    onSettingsChange({ ...settings, guideMode: nextMode });
  };

  const toggleCrosshairMode = () => {
    const nextMode = settings.guideMode === 'guide' ? 'none' : 'guide';

    if (nextMode === 'guide' && !hasMovedGuideRef.current && settings.guidePosition.x === 50 && settings.guidePosition.y === 50) {
      onSettingsChange({
        ...settings,
        guideMode: nextMode,
        guidePosition: { x: 0, y: 0 },
      });
      return;
    }

    onSettingsChange({ ...settings, guideMode: nextMode });
  };

  const handleGuideMouseDown = (e: React.MouseEvent) => {
    if (settings.guideMode === 'guide') {
      setIsDraggingGuide(true);
    }
  };

  useEffect(() => {
    if (activeView === 'analyzer') {
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [activeView, frames.length]);

  const handleFrameMouseDown = (e: React.MouseEvent) => {
    if (isPlaying) return;
    setIsDraggingFrame(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePivotMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPivot(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingGuide && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      
      hasMovedGuideRef.current = true;
      onSettingsChange({
        ...settings,
        guidePosition: { 
          x: Math.max(-50, Math.min(150, relX)), 
          y: Math.max(-50, Math.min(150, relY)) 
        }
      });
    } else if (isDraggingGround && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      onSettingsChange({
        ...settings,
        groundLineY: Math.max(0, Math.min(100, relY))
      });
    } else if (isDraggingPivot && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      onSettingsChange({
        ...settings,
        customPivot: { 
          x: Math.max(0, Math.min(1, x)), 
          y: Math.max(0, Math.min(1, y)) 
        },
        anchor: 'custom'
      });
    } else if (isDraggingFrame && (focusedFrame || selectedIds.size > 0)) {
      const deltaX = (e.clientX - dragStart.x) / (settings.analyzerZoom / 100);
      const deltaY = (e.clientY - dragStart.y) / (settings.analyzerZoom / 100);
      
      if (Math.abs(deltaX) >= 1 || Math.abs(deltaY) >= 1) {
        const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (focusedFrameId ? [focusedFrameId] : []);
        onUpdateFramesOffset(targetIds, Math.round(deltaX), Math.round(deltaY));
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingGuide(false);
    setIsDraggingGround(false);
    setIsDraggingFrame(false);
    setIsDraggingPivot(false);
    setIsPanningViewport(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;

      const delta = e.shiftKey ? 10 : 1;
      
      const move = (x: number, y: number) => {
        const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (focusedFrameId ? [focusedFrameId] : []);
        if (targetIds.length > 0) {
          onUpdateFramesOffset(targetIds, x, y);
        }
      };

      switch (e.key) {
        case ' ':
          e.preventDefault();
          break;
        case 'ArrowLeft': {
          e.preventDefault();
          setIsPlaying(false);
          navigateFrame(-1);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          setIsPlaying(false);
          navigateFrame(1);
          break;
        }
        case 'ArrowUp':
          e.preventDefault();
          move(0, -delta);
          break;
        case 'ArrowDown':
          e.preventDefault();
          move(0, delta);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, focusedFrameId, onUpdateFramesOffset, navigateFrame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        setIsPanningViewport(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, []);

  const safePlaybackLength = playbackFrames.length;
  const safePlaybackIndex = safePlaybackLength > 0
    ? ((currentIndex % safePlaybackLength) + safePlaybackLength) % safePlaybackLength
    : 0;

  const currentPreviewFrame = isPlaying && safePlaybackLength > 0
    ? playbackFrames[safePlaybackIndex]
    : focusedFrame;

  const hasTrimmedBounds = Boolean(currentPreviewFrame?.trimmedBox);
  const metadataFrame = currentPreviewFrame;
  const frameChapters = metadataFrame
    ? chapters.filter((chapter) => chapter.frameIds.includes(metadataFrame.id)).map((chapter) => chapter.name)
    : [];
  const expectedAutoOffset = metadataFrame?.trimmedBox
    ? {
        x: metadataFrame.originalWidth / 2 - (metadataFrame.trimmedBox.x + metadataFrame.trimmedBox.w / 2),
        y: metadataFrame.originalHeight / 2 - (metadataFrame.trimmedBox.y + metadataFrame.trimmedBox.h / 2),
      }
    : null;
  const hasNonZeroOffset = Boolean(metadataFrame?.offset && (metadataFrame.offset.x !== 0 || metadataFrame.offset.y !== 0));
  const isGenuineZeroOffset = Boolean(
    metadataFrame?.offset
      && metadataFrame.offset.x === 0
      && metadataFrame.offset.y === 0
      && expectedAutoOffset
      && expectedAutoOffset.x === 0
      && expectedAutoOffset.y === 0
  );
  const hasCalculatedOffset = hasNonZeroOffset || isGenuineZeroOffset;

  const metadataRows = [
    { label: 'Frame ID', value: metadataFrame?.id ?? 'not available' },
    { label: 'Frame #', value: metadataFrame ? String(metadataFrame.index + 1) : 'not available' },
    { label: 'Chapter', value: metadataFrame ? (frameChapters.length > 0 ? frameChapters.join(', ') : 'No chapter') : 'not available' },
    { label: 'Original Size', value: metadataFrame ? `${metadataFrame.originalWidth} × ${metadataFrame.originalHeight}` : 'not available' },
    { label: 'Canvas Size', value: settings?.frameSize ? `${settings.frameSize.width} × ${settings.frameSize.height}` : 'not available' },
    {
      label: 'Frame Bounds',
      value: metadataFrame ? `x: 0, y: 0, w: ${metadataFrame.originalWidth}, h: ${metadataFrame.originalHeight}` : 'not available',
    },
    {
      label: 'Sprite Bounds',
      value: metadataFrame?.trimmedBox
        ? `x: ${metadataFrame.trimmedBox.x}, y: ${metadataFrame.trimmedBox.y}, w: ${metadataFrame.trimmedBox.w}, h: ${metadataFrame.trimmedBox.h}`
        : 'not calculated',
    },
    {
      label: 'Pivot',
      value: settings?.customPivot
        ? `x: ${settings.customPivot.x.toFixed(3)}, y: ${settings.customPivot.y.toFixed(3)}`
        : 'not available',
    },
    {
      label: 'Offset',
      value: hasCalculatedOffset && metadataFrame?.offset ? `x: ${metadataFrame.offset.x}, y: ${metadataFrame.offset.y}` : 'not calculated',
    },
    { label: 'sourceSize', value: 'not calculated' },
    { label: 'spriteSourceSize', value: 'not calculated' },
  ];

  return (
    <div className="flex-1 w-full bg-[#0a0a0a] text-zinc-100 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Index Panel */}
        <div className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full overflow-hidden">
          <div className="p-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/10">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <LayoutList size={12} className="text-purple-500" />
              Geselecteerde frames
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {/* Alignment & Guides Section */}
            <div className="p-2 space-y-3 bg-zinc-900/30 rounded-xl mb-4 border border-zinc-800/50">
              
              {/* Pivot punt info */}
              <div className="px-1 py-2 border-b border-zinc-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                  <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">Pivot punt</span>
                </div>
                <p className="text-[8px] text-zinc-400/90 leading-relaxed italic">
                  Bepaal het ankerpunt van je personage door de paarse stip te verplaatsen.
                </p>
              </div>

              {/* Directional Alignment Controls Moved Here */}
              <div className="space-y-3 pt-4 border-t border-zinc-800/50 mt-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Target size={12} className="text-purple-500" />
                    Fine-tune
                  </div>
                  <span className="text-purple-400 font-mono text-[9px]">{focusedFrame?.offset?.x || 0}, {focusedFrame?.offset?.y || 0}</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    <div />
                    <button onClick={(e) => {
                      const delta = e.shiftKey ? 10 : 1;
                      focusedFrame && onUpdateFrameOffset(focusedFrame.id, 0, -delta);
                    }} disabled={!focusedFrame} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 outline-none"><ChevronUp size={14} /></button>
                    <div />
                    
                    <button onClick={(e) => {
                      const delta = e.shiftKey ? 10 : 1;
                      focusedFrame && onUpdateFrameOffset(focusedFrame.id, -delta, 0);
                    }} disabled={!focusedFrame} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 outline-none"><ChevronLeft size={14} /></button>
                    <button 
                      onClick={() => focusedFrame && onUpdateFrameOffset(focusedFrame.id, -(focusedFrame.offset?.x || 0), -(focusedFrame.offset?.y || 0))}
                      disabled={!focusedFrame || ((focusedFrame.offset?.x || 0) === 0 && (focusedFrame.offset?.y || 0) === 0)}
                      className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-purple-400 outline-none"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button onClick={(e) => {
                      const delta = e.shiftKey ? 10 : 1;
                      focusedFrame && onUpdateFrameOffset(focusedFrame.id, delta, 0);
                    }} disabled={!focusedFrame} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 outline-none"><ChevronRight size={14} /></button>
                    
                    <div />
                    <button onClick={(e) => {
                      const delta = e.shiftKey ? 10 : 1;
                      focusedFrame && onUpdateFrameOffset(focusedFrame.id, 0, delta);
                    }} disabled={!focusedFrame} className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800 outline-none"><ChevronDown size={14} /></button>
                    <div />
                  </div>
                  <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest italic">Shift + klik = 10px</span>
                </div>
              </div>

            </div>

            <div className="h-px bg-zinc-900 mb-2" />
            {/* All Frames Item */}
            <div className="group flex items-center gap-1 p-1 bg-zinc-900/50 hover:bg-zinc-800/50 rounded border border-zinc-800 transition-all">
              <div className="flex items-center gap-2 px-1 py-1 cursor-pointer" onClick={(e) => {
                e.stopPropagation();
                onAllFramesToggle();
              }}>
                <input 
                  type="checkbox"
                  checked={isAllFramesChecked}
                  onChange={() => {}} // Handled by div click
                  style={{ accentColor: '#3f3f46' }}
                  className="w-3 h-3 rounded border-zinc-700 bg-zinc-950 cursor-pointer pointer-events-none"
                />
              </div>
              <button 
                onClick={onAllFramesToggle}
                className="flex-1 text-left text-[9px] font-bold text-zinc-300 hover:text-white truncate py-1"
              >
                Alle Frames
                <span className="ml-1 text-[7px] text-zinc-600 font-mono">({allFramesCount})</span>
              </button>
            </div>

            <div className="h-px bg-zinc-800 my-1 mx-2" />

            {chapters.map((chapter, idx) => {
              const allChapterIds = new Set(chapter.frameIds);
              const isChecked = checkedChapterIds.has(chapter.id);

              return (
                <div key={chapter.id} className="space-y-1">
                  <div className="group flex items-center gap-1 p-1 bg-zinc-900/50 rounded border transition-all" style={{ borderColor: chapter.color || '#a855f7' }}>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); idx > 0 && onReorderChapters(idx, idx - 1); }}
                        className={`p-0.5 rounded hover:bg-zinc-800 transition-colors ${idx === 0 ? 'text-zinc-800 pointer-events-none' : 'text-zinc-300 hover:text-white'}`}
                        title="Omhoog"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); idx < chapters.length - 1 && onReorderChapters(idx, idx + 1); }}
                        className={`p-0.5 rounded hover:bg-zinc-800 transition-colors ${idx === chapters.length - 1 ? 'text-zinc-800 pointer-events-none' : 'text-zinc-300 hover:text-white'}`}
                        title="Omlaag"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="flex items-center px-1 py-1 cursor-pointer" onClick={(e) => {
                      e.stopPropagation();
                      onToggleChapterChecked(chapter.id);
                    }}>
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${isChecked ? 'border-transparent' : 'border-zinc-200 bg-white'}`} style={isChecked ? { backgroundColor: chapter.color || '#a855f7' } : undefined}>
                        {isChecked && <Check size={10} strokeWidth={4} />}
                      </div>
                    </div>
                    {editingId === chapter.id ? (
                      <input 
                        autoFocus
                        className="flex-1 bg-zinc-950 text-[9px] font-bold px-1 rounded border border-purple-500 outline-none ml-2"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(chapter.id)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(chapter.id)}
                      />
                    ) : (
                      <button 
                        onClick={(e) => selectChapterFrames(chapter, e.ctrlKey || e.metaKey)}
                        onDoubleClick={() => startEditing(chapter.id, chapter.name)}
                        className="flex-1 text-left text-[9px] font-bold text-zinc-300 hover:text-white truncate ml-2"
                      >
                        {chapter.name}
                        <span className="ml-1 text-[7px] text-zinc-400 font-mono">
                          ({allChapterIds.size})
                        </span>
                      </button>
                    )}

                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button onClick={() => startEditing(chapter.id, chapter.name)} className="p-0.5 text-zinc-500 hover:text-blue-400"><Edit2 size={8} /></button>
                      <button onClick={() => deleteChapter(chapter.id)} className="p-0.5 text-zinc-500 hover:text-red-400"><Trash2 size={8} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {chapters.length === 0 && (
              <div className="text-[9px] text-zinc-700 italic p-4 text-center">Nog geen hoofdstukken.</div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-800 bg-zinc-900/20 space-y-2">
            <button
              onClick={() => setShowMetadataPanel((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-1 text-left"
            >
              <div className="flex items-center gap-2">
                <HelpCircle size={12} className="text-cyan-400" />
                <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Frame metadata</h4>
              </div>
              <ChevronDown size={12} className={`text-zinc-500 transition-transform ${showMetadataPanel ? 'rotate-180' : ''}`} />
            </button>
            {showMetadataPanel && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2 space-y-1.5">
                {metadataRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-2 text-[8px]">
                    <span className="text-zinc-500 uppercase tracking-widest font-bold">{row.label}</span>
                    <span className="text-zinc-300 font-mono text-right break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Preview */}
        <div 
          ref={viewportRef}
          className="flex-1 relative overflow-hidden bg-[#050505] checkerboard-dark flex items-center justify-center p-4 md:p-8"
          onMouseMove={(e) => {
            if (isPanningViewport) {
              const dx = e.clientX - panStart.x;
              const dy = e.clientY - panStart.y;
              setViewportOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
              setPanStart({ x: e.clientX, y: e.clientY });
              return;
            }
            handleMouseMove(e);
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={(e) => {
            if (isSpacePressed) {
              e.preventDefault();
              setIsPanningViewport(true);
              setPanStart({ x: e.clientX, y: e.clientY });
            }
          }}
          style={{ cursor: isSpacePressed ? (isPanningViewport ? 'grabbing' : 'grab') : undefined }}
        >
          <div className="absolute top-3 left-3 right-3 z-[70] flex items-center gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/90 p-2 backdrop-blur-sm">
            <button onClick={toggleGridMode} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${settings.guideMode === 'grid' ? 'bg-purple-600/10 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Grid size={12} />Grid</button>
            <button onClick={toggleCrosshairMode} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${settings.guideMode === 'guide' ? 'bg-purple-600/10 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Crosshair size={12} />Crosshair</button>
            <div className="flex items-center gap-1">
              <button onClick={() => onSettingsChange({ ...settings, showOnionSkin: !settings.showOnionSkin })} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${settings.showOnionSkin ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Layers size={12} />Onion</button>
              <button onClick={() => setOnionSkinDir(-1)} disabled={!settings.showOnionSkin} className="px-2 py-1 rounded-md text-[9px] font-bold border border-zinc-800 text-zinc-400 disabled:opacity-40">PREV</button>
              <button onClick={() => setOnionSkinDir(1)} disabled={!settings.showOnionSkin} className="px-2 py-1 rounded-md text-[9px] font-bold border border-zinc-800 text-zinc-400 disabled:opacity-40">NEXT</button>
            </div>
            <button onClick={() => onSettingsChange({ ...settings, showGroundLine: !settings.showGroundLine })} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${settings.showGroundLine ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><ArrowUpDown size={12} />Ground</button>
            <button onClick={() => setShowFrameBounds((prev) => !prev)} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${showFrameBounds ? 'bg-rose-600/10 border-rose-500/50 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Target size={12} />Frame bounds</button>
            {hasTrimmedBounds && <button onClick={() => setShowTrimmedBounds((prev) => !prev)} className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 ${showTrimmedBounds ? 'bg-amber-600/10 border-amber-500/50 text-amber-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><Target size={12} />Trimmed bounds</button>}
          </div>
          <div ref={workAreaRef} className="absolute inset-x-0 top-0 bottom-24 pointer-events-none" />
          <div 
            ref={containerRef}
            className="relative transition-transform duration-200 shadow-2xl flex-shrink-0"
            style={{ 
              transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px) scale(${settings.analyzerZoom / 100})`,
              width: settings.frameSize.width * visualScale,
              height: settings.frameSize.height * visualScale,
              transformOrigin: 'center center'
            }}
          >
              {settings.showGroundLine && (
                <div 
                  className="absolute left-0 right-0 h-px bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-[45] pointer-events-all"
                  style={{ top: `${settings.groundLineY}%`, height: '2px', cursor: isDraggingGround ? 'grabbing' : 'ns-resize' }}
                  onMouseDown={(e) => { e.stopPropagation(); setIsDraggingGround(true); }}
                >
                  <div className="absolute right-2 -top-4 w-8 h-8 rounded-full bg-emerald-500/95 border-2 border-white shadow-[0_0_12px_rgba(16,185,129,0.9)] flex items-center justify-center">
                    <ArrowUpDown size={12} className="text-white" />
                  </div>
                  <div className="absolute right-12 -top-6 bg-emerald-500 text-[9px] font-bold text-white px-2 py-0.5 rounded flex items-center gap-2">
                    GRONDLIJN
                  </div>
                </div>
              )}

                {settings.guideMode === 'grid' && (
                <div className="absolute top-[-200%] left-[-200%] right-[-200%] bottom-[-200%] pointer-events-none z-40">
                  <div className="absolute border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" 
                    style={{ width: settings.frameSize.width * visualScale, height: settings.frameSize.height * visualScale, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  />
                  <div 
                    className="absolute inset-0 opacity-32" 
                    style={{ 
                      backgroundImage: 'linear-gradient(to right, rgba(216,180,254,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(216,180,254,0.55) 1px, transparent 1px)', 
                      backgroundSize: `${32 * visualScale}px ${32 * visualScale}px` 
                    }} 
                  />
                </div>
              )}

              {settings.guideMode === 'guide' && (
                <div 
                  className="absolute top-[-50%] left-[-50%] right-[-50%] bottom-[-50%] pointer-events-none z-30"
                  onMouseDown={handleGuideMouseDown}
                  style={{ cursor: isDraggingGuide ? 'grabbing' : 'grab', pointerEvents: 'all' }}
                >
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                    style={{ left: `${25 + settings.guidePosition.x / 2}%` }}
                  />
                  <div 
                    className="absolute left-0 right-0 h-px bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                    style={{ top: `${25 + settings.guidePosition.y / 2}%` }}
                  />
                  <div className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                    style={{ left: `${25 + settings.guidePosition.x / 2}%`, top: `${25 + settings.guidePosition.y / 2}%` }}
                  >
                    <div className="w-4 h-4 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.8)] border-2 border-white" />
                  </div>
                </div>
              )}

              <div 
                onMouseDown={handleFrameMouseDown}
                className={`relative w-full h-full border border-zinc-700/50 ${isDraggingFrame ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                {settings.showOnionSkin && onionSkinFrame?.url && !isPlaying && (
                  <img
                    src={onionSkinFrame.url}
                    alt="Onion Skin"
                    className="absolute left-1/2 top-1/2 select-none pointer-events-none grayscale sepia opacity-50 max-w-none max-h-none"
                    style={{
                      width: `${onionSkinFrame.originalWidth * visualScale}px`,
                      height: `${onionSkinFrame.originalHeight * visualScale}px`,
                      transform: `translate(calc(-50% + ${onionSkinFrame.offset.x * visualScale}px), calc(-50% + ${onionSkinFrame.offset.y * visualScale}px))`,
                      imageRendering: 'pixelated',
                      zIndex: 1,
                    }}
                  />
                )}

                  {currentPreviewFrame?.url && (
                    <img
                      src={currentPreviewFrame.url}
                      alt="Preview"
                      className="absolute left-1/2 top-1/2 select-none max-w-none max-h-none"
                      style={{
                        width: `${currentPreviewFrame.originalWidth * visualScale}px`,
                        height: `${currentPreviewFrame.originalHeight * visualScale}px`,
                        transform: `translate(calc(-50% + ${(currentPreviewFrame.offset?.x || 0) * visualScale}px), calc(-50% + ${(currentPreviewFrame.offset?.y || 0) * visualScale}px))`,
                        imageRendering: 'pixelated',
                        zIndex: 2,
                        opacity: settings.showOnionSkin ? settings.onionOpacity / 100 : 1
                      }}
                    />
                  )}

                  {showFrameBounds && (
                    <div 
                      className="absolute border-2 border-red-500/60 pointer-events-none z-50"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${settings.frameSize.width * visualScale}px`,
                        height: `${settings.frameSize.height * visualScale}px`,
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-red-500/80 text-[10px] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">
                        Frame bounds
                      </div>
                    </div>
                  )}

                  {showTrimmedBounds && currentPreviewFrame?.trimmedBox && (
                    <div
                      className="absolute border border-amber-300 pointer-events-none z-[55]"
                      style={{
                        left: `calc(50% + ${(currentPreviewFrame.offset?.x || 0) * visualScale}px + ${(currentPreviewFrame.trimmedBox.x - currentPreviewFrame.originalWidth / 2) * visualScale}px)`,
                        top: `calc(50% + ${(currentPreviewFrame.offset?.y || 0) * visualScale}px + ${(currentPreviewFrame.trimmedBox.y - currentPreviewFrame.originalHeight / 2) * visualScale}px)`,
                        width: `${currentPreviewFrame.trimmedBox.w * visualScale}px`,
                        height: `${currentPreviewFrame.trimmedBox.h * visualScale}px`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 bg-amber-400/90 text-[9px] text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">
                        Trimmed bounds
                      </div>
                    </div>
                  )}
              </div>

              {!isPlaying && (
                <div 
                  onMouseDown={handlePivotMouseDown}
                  className={`absolute z-[100] w-10 h-10 -ml-5 -mt-5 flex items-center justify-center cursor-move group/pivot-handle`}
                  style={{
                    left: (settings.customPivot?.x || 0.5) * 100 + '%',
                    top: (settings.customPivot?.y || 0.5) * 100 + '%'
                  }}
                >
                  <div className="w-5 h-5 -ml-2.5 -mt-2.5 border-2 border-white rounded-full bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.6)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                </div>
              )}
            </div>

            {/* Playback Controls Overlay */}
          <div data-analyzer-controls="true" className="absolute bottom-0 left-0 right-0 h-24 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-center z-[60]">
            <PlaybackControls 
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onStepBack={() => { setIsPlaying(false); navigateFrame(-1); }}
              onStepForward={() => { setIsPlaying(false); navigateFrame(1); }}
              fps={settings.fps}
              onFpsChange={(val) => onSettingsChange({ ...settings, fps: val })}
              zoom={settings.analyzerZoom}
              onZoomChange={(val) => onSettingsChange({ ...settings, analyzerZoom: val })}
              onFitToScreen={fitToScreen}
              currentIndex={isPlaying ? safePlaybackIndex : (focusedIndex !== -1 ? focusedIndex : 0)}
              totalFrames={playbackFrames.length}
              className="w-full max-w-5xl !bg-transparent !border-none !shadow-none"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <span>Spritesheet Grid ({selectedIds.size}/{frames.length})</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="space-y-8">
                {chapterGridSections.map(({ chapter, frames: chapterFrames }, sectionIndex) => {
                  return (
                    <div key={chapter?.id ?? `all-frames-${sectionIndex}`} className="space-y-2">
                      {chapter && (
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1 h-3 rounded-full" style={{ backgroundColor: chapter.color || '#a855f7' }} />
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{chapter.name}</span>
                        </div>
                      )}
                      <div 
                        className="grid" 
                        style={{ 
                          gridTemplateColumns: `repeat(auto-fill, minmax(${settings.frameGridSize + 8}px, 1fr))`,
                          gap: '0px'
                        }}
                      >
                        {chapterFrames.map((frame) => {
                          const isFocused = focusedFrameId === frame.id;
                          const isSelected = selectedIds.has(frame.id);
                          const isPlayingHighlight = isPlaying && safePlaybackLength > 0 && playbackFrames[safePlaybackIndex]?.id === frame.id;
                          const stripColors = getTopStripColors(frame.id, isSelected);
                          const stripBaseColor = stripColors[0] || '#3f3f46';
                          const frameBadgeColor = darkenHexColor(stripBaseColor, 0.28);
                          const frameBadgeTextColor = getContrastingTextColor(frameBadgeColor);
                          const effectiveSelectionPreviewColor = selectionPreviewColor || '#a855f7';

                          return (
                            <div
                              key={frame.id}
                              style={{ 
                                width: settings.frameGridSize, 
                                height: settings.frameGridSize,
                                padding: '4px',
                                position: 'relative'
                              }}
                            >
                              <div
                                className={`
                                  relative w-full h-full rounded-xl border-2 transition-all group cursor-default overflow-hidden shadow-lg p-1
                                  ${isPlayingHighlight
                                    ? 'border-white z-30 scale-105 opacity-100 ring-4 ring-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
                                    : isFocused 
                                      ? 'border-white z-40 scale-110 opacity-100 ring-2 ring-white/30' 
                                      : isSelected
                                        ? 'bg-purple-600/10 opacity-100' 
                                        : 'border-zinc-700/50 opacity-80 bg-zinc-900/10'}
                                `}
                                style={{
                                  borderColor: isFocused ? '#ffffff' : checkedChapterColorByFrameId.get(frame.id),
                                  backgroundColor: (isSelected || isFocused) && chapterByFrameId.get(frame.id)?.color ? `${chapterByFrameId.get(frame.id)?.color}1A` : undefined
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const isModifiedSelection = e.shiftKey || e.metaKey || e.ctrlKey;
                                  setIsPlaying(false);
                                  onFocusFrame(frame.id);
                                  if (!isModifiedSelection) {
                                    onSetSelectionAnchor(frame.id);
                                  }
                                  onToggleSelect(frame.id, e.shiftKey, e.metaKey || e.ctrlKey);
                                }}
                              >
                                <div 
                                  className={`absolute inset-x-0 top-0 h-3 text-[8px] font-black uppercase text-center transition-colors z-20 ${
                                    isFocused ? 'text-white' : 'text-zinc-400 group-hover:text-white'
                                  }`}
                                  style={{ color: isFocused ? '#ffffff' : getContrastingTextColor(stripBaseColor) }}
                                >
                                  <div className="absolute inset-0 flex pointer-events-none">
                                    {stripColors.map((color, idx) => (
                                      <div key={`${frame.id}-strip-${idx}`} className="h-full" style={{ width: `${100 / stripColors.length}%`, backgroundColor: color }} />
                                    ))}
                                  </div>
                                  <span className="relative z-10 inline-flex mt-[1px] px-1 rounded-sm leading-none" style={{ backgroundColor: frameBadgeColor, color: frameBadgeTextColor }}>
                                    {frame.index + 1}
                                  </span>
                                </div>
                                <div className="w-full h-full flex items-center justify-center rounded-lg overflow-hidden bg-zinc-950/50">
                                  {frame?.url && (
                                    <img
                                      src={frame.url}
                                      alt={`Frame ${frame.index}`}
                                      draggable="false"
                                      className="w-full h-full object-contain checkerboard pointer-events-none select-none"
                                    />
                                  )}
                                </div>
                                {frame.durationMultiplier > 1 && (
                                  <div className="absolute top-1 right-1 px-1 bg-purple-600 text-white text-[6px] font-bold rounded shadow-sm z-30">
                                    {frame.durationMultiplier}x
                                  </div>
                                )}
                                {isSelected && (
                                  <div
                                    className="absolute inset-0 rounded-xl pointer-events-none z-20"
                                    style={{ boxShadow: `inset 0 0 0 2px ${effectiveSelectionPreviewColor}, 0 0 10px ${effectiveSelectionPreviewColor}` }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-950 space-y-6 flex-shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between items-end text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <span>Thumbnail Grootte</span>
                <span className="text-zinc-300 font-mono">{settings.frameGridSize}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="160"
                value={settings.frameGridSize}
                onChange={(e) => onSettingsChange({ ...settings, frameGridSize: parseInt(e.target.value) })}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>


          {/* Frame Timing Controls (Mirrored from RightSidebar) */}
          {(focusedFrameId || selectedIds.size > 0) && (
            <div className="p-4 bg-zinc-900/40 border-t border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Duration Multiplier
                </h3>
                <span className="text-[10px] text-purple-400 font-mono">
                  {focusedFrameId ? 'Frame focus' : `${selectedIds.size} selected`}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="text-[8px] text-zinc-500 uppercase tracking-widest">Relative Speed</div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      if (focusedFrameId) onUpdateDuration(focusedFrameId, -0.5);
                      else selectedIds.forEach(sid => onUpdateDuration(sid, -0.5));
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-xs font-mono text-white min-w-[3ch] text-center">
                    {focusedFrame ? focusedFrame.durationMultiplier.toFixed(1) : '1.0'}x
                  </span>
                  <button 
                    onClick={() => {
                      if (focusedFrameId) onUpdateDuration(focusedFrameId, 0.5);
                      else selectedIds.forEach(sid => onUpdateDuration(sid, 0.5));
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
