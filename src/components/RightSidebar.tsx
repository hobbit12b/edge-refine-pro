import React from 'react';
import { 
  Plus, 
  Minus, 
  Copy,
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Frame, SpriteSheetSettings, AnimationChapter } from '../types';
import {
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getContrastingTextColor } from '@/utils/chapterColors';

interface RightSidebarProps {
  frames: Frame[];
  selectedIds: Set<string>;
  focusedFrameId: string | null;
  duplicateIds: Set<string>;
  settings: SpriteSheetSettings;
  videoFile: File | null;
  onToggleSelect: (id: string, shiftKey?: boolean, ctrlKey?: boolean) => void;
  onFocusFrame: (id: string) => void;
  onSetSelectionAnchor: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateDuration: (id: string, delta: number) => void;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  onClearAll: () => void;
  onDetectDuplicates: () => void;
  onSetFrames: (frames: Frame[]) => void;
  onReorderEnd: () => void;
  onDeleteSelected: () => void;
  onUpdateFramesOffset: (ids: string[], x: number, y: number) => void;
  isPlaying: boolean;
  playbackFrameId: string | null;
  chapters: AnimationChapter[];
  checkedChapterIds: Set<string>;
  isAllFramesMode: boolean;
  selectionPreviewColor: string | null;
}

interface SortableFrameItemProps {
  key?: string | number;
  frame: Frame;
  isFocused: boolean;
  isSelected: boolean;
  isDuplicate: boolean;
  isPlayingHighlight: boolean;
  onFocus: () => void;
  onToggle: (shift: boolean, ctrl: boolean) => void;
  onNormalClick: () => void;
  gridSize: number;
  activeId: string | null;
  frames: Frame[];
  chapterColor?: string;
  checkedChapterColor?: string;
  stripColor: string;
  isAllFramesMode: boolean;
}

function SortableFrameItem({ 
  frame, 
  isFocused, 
  isSelected, 
  isDuplicate, 
  isPlayingHighlight,
  onFocus, 
  onToggle, 
  onNormalClick,
  gridSize,
  activeId,
  frames,
  chapterColor,
  checkedChapterColor,
  stripColor,
  isAllFramesMode,
}: SortableFrameItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = useSortable({ id: frame.id });

  const isOverItem = over?.id === frame.id && activeId !== frame.id;
  const oldIndex = activeId ? frames.findIndex(f => f.id === activeId) : -1;
  const newIndex = frames.findIndex(f => f.id === frame.id);
  const isForward = oldIndex !== -1 && newIndex > oldIndex;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: gridSize,
    height: gridSize,
    zIndex: isDragging ? 100 : 1,
    padding: '4px',
    position: 'relative' as const,
  };

  return (
    <div
      id={`frame-item-${frame.id}`}
      ref={setNodeRef}
      style={style}
    >
      {/* Drop Indicator Line */}
      {isOverItem && (
        <div className={`absolute top-0 bottom-0 ${isForward ? 'right-[-2px]' : 'left-[-2px]'} w-[4px] z-50 pointer-events-none`}>
          <div className={`w-full h-full ${isForward ? 'border-r-2' : 'border-l-2'} border-dashed border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]`} />
        </div>
      )}
      
      <div
        className={`
          relative w-full h-full rounded-xl border-2 transition-all group cursor-default overflow-hidden shadow-lg p-1
          ${isPlayingHighlight
            ? 'border-white z-30 scale-105 opacity-100 ring-4 ring-white/50 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
              : isFocused 
              ? 'border-white z-40 scale-110 opacity-100 ring-2 ring-white/30 bg-purple-900/10' 
              : isSelected 
                ? (isAllFramesMode ? 'border-zinc-600 bg-zinc-700/10 opacity-100' : 'border-purple-600 bg-purple-600/10 opacity-100') 
                : checkedChapterColor
                  ? 'opacity-90 bg-zinc-900/10'
                  : 'border-zinc-800 opacity-40 hover:opacity-100 hover:border-zinc-700 bg-zinc-900/10'}
          ${isDragging ? 'opacity-30 border-dashed border-purple-500 cursor-grabbing' : 'active:cursor-grabbing'}
        `}
        style={{
          borderColor: isFocused ? '#ffffff' : checkedChapterColor,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            onToggle(e.shiftKey, e.ctrlKey || e.metaKey);
            return;
          }
          onNormalClick();
        }}
        {...attributes}
        {...listeners}
      >
        {chapterColor && (
           <div 
             className="absolute top-1 left-1 w-2 h-2 rounded-full z-30 shadow-sm border border-black/20"
             style={{ backgroundColor: chapterColor }}
           />
        )}
        <div 
          className="absolute inset-x-0 top-0 py-0.5 text-[8px] font-black uppercase text-center transition-colors z-20 cursor-pointer"
          style={{ 
            backgroundColor: stripColor,
            color: getContrastingTextColor(stripColor),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              onToggle(e.shiftKey, e.ctrlKey || e.metaKey);
              return;
            }
            onNormalClick();
          }}
        >
          {frame.index + 1}
        </div>
        <div 
          className="w-full h-full flex items-center justify-center rounded-lg overflow-hidden bg-zinc-950/50"
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              onToggle(e.shiftKey, e.ctrlKey || e.metaKey);
              return;
            }
            onNormalClick();
          }}
        >
          {frame?.url && (
            <img
              src={frame.url}
              alt={`Frame ${frame.index}`}
              draggable="false"
              className="w-full h-full object-contain checkerboard pointer-events-none select-none"
            />
          )}
        </div>
        
        {isDuplicate && !isSelected && !isFocused && (
          <div className="absolute inset-0 bg-orange-500/10 pointer-events-none flex items-center justify-center">
            <Copy size={12} className="text-orange-500/50" />
          </div>
        )}

        {frame.durationMultiplier > 1 && (
          <div className="absolute top-1 right-1 px-1 bg-purple-600 text-white text-[6px] font-bold rounded shadow-sm z-30">
            {frame.durationMultiplier}x
          </div>
        )}
      </div>
    </div>
  );
}

export function RightSidebar({
  frames,
  selectedIds,
  focusedFrameId,
  duplicateIds,
  settings,
  videoFile,
  onToggleSelect,
  onFocusFrame,
  onSetSelectionAnchor,
  onSettingsChange,
  onClearAll,
  onDetectDuplicates,
  onSelectAll,
  onDeselectAll,
  onUpdateDuration,
  onSetFrames,
  onReorderEnd,
  onDeleteSelected,
  onUpdateFramesOffset,
  isPlaying,
  playbackFrameId,
  chapters,
  checkedChapterIds,
  isAllFramesMode,
  selectionPreviewColor,
}: RightSidebarProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isModelLoading, setIsModelLoading] = React.useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateSetting = <K extends keyof SpriteSheetSettings>(key: K, value: SpriteSheetSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over?.id && over) {
      const activeIsSelected = selectedIds.has(active.id);
      
      if (activeIsSelected) {
        const selectedFrames = frames.filter(f => selectedIds.has(f.id));
        const remainingFrames = frames.filter(f => !selectedIds.has(f.id));
        
        const oldIndex = frames.findIndex(f => f.id === active.id);
        const newIndex = frames.findIndex(f => f.id === over.id);
        
        // Find insert position in remaining frames
        let insertIndex = remainingFrames.findIndex(f => f.id === over.id);
        if (newIndex > oldIndex) {
          insertIndex += 1;
        }
        if (insertIndex === -1) insertIndex = remainingFrames.length;

        const newFrames = [...remainingFrames];
        newFrames.splice(insertIndex, 0, ...selectedFrames);
        onSetFrames(newFrames);
      } else {
        const oldIndex = frames.findIndex((f) => f.id === active.id);
        const newIndex = frames.findIndex((f) => f.id === over.id);
        const newFrames = arrayMove(frames, oldIndex, newIndex);
        onSetFrames(newFrames);
      }
    }
    
    setActiveId(null);
    onReorderEnd();
  };

  const activeFrame = frames.find(f => f.id === activeId);
  const isDraggingSelection = activeId && selectedIds.has(activeId);
  const selectionCount = selectedIds.size;

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col h-full overflow-hidden">
      {/* Frames Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">
              Frames ({selectedIds.size}/{frames.length})
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-1 mr-2 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded">
              <div className="flex justify-between text-[7px] font-bold text-zinc-500 uppercase tracking-tighter">
                <span>Scan Sens</span>
                <span>{settings.duplicateSensitivity.toFixed(3)}</span>
              </div>
              <input 
                type="range"
                min="0.001"
                max="0.05"
                step="0.001"
                className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                value={settings.duplicateSensitivity}
                onChange={(e) => updateSetting('duplicateSensitivity', parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={onDetectDuplicates}
              className="px-2 py-1 bg-orange-500/10 text-orange-400 text-[8px] font-bold uppercase rounded border border-orange-500/20 hover:bg-orange-500/20 transition-all font-mono"
            >
              Scan
            </button>
          </div>
        </div>

        {/* Selection Tools Area */}
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Selectie</h4>
            <div className="flex items-center gap-2">
              <button 
                onClick={onSelectAll}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[9px] font-bold uppercase rounded border border-zinc-800 transition-all"
              >
                Alles
              </button>
              <button 
                onClick={onDeselectAll}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[9px] font-bold uppercase rounded border border-zinc-800 transition-all"
              >
                Geen
              </button>
            </div>
          </div>
          
          {(selectedIds.size > 0 || focusedFrameId) && (
            <button 
              onClick={onDeleteSelected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase rounded-xl border border-red-500/20 transition-all group"
            >
              <Trash2 size={14} className="group-hover:scale-110 transition-all" />
              Verwijder Selectie
            </button>
          )}
        </div>

        {/* Frame Grid (DND-KIT) */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={frames.map(f => f.id)}
              strategy={rectSortingStrategy}
            >
              <div 
                className="grid" 
                style={{ 
                  gridTemplateColumns: `repeat(auto-fill, minmax(${settings.frameGridSize + 8}px, 1fr))`,
                  gap: '0px'
                }}
              >
                {frames.map((frame) => {
                  const chapter = chapters.find(c => c.frameIds.includes(frame.id));
                  const checkedChapter = chapters.find(c => checkedChapterIds.has(c.id) && c.frameIds.includes(frame.id));
                  const isSelected = selectedIds.has(frame.id);
                  const stripColor = chapter?.color
                    ? chapter.color
                    : (isSelected && selectionPreviewColor)
                      ? selectionPreviewColor
                      : isAllFramesMode
                        ? '#3f3f46'
                        : 'rgba(0,0,0,0.6)';
                  return (
                    <SortableFrameItem 
                      key={frame.id}
                      frame={frame}
                      isFocused={focusedFrameId === frame.id}
                      isSelected={isSelected}
                      isDuplicate={duplicateIds.has(frame.id)}
                      isPlayingHighlight={isPlaying && playbackFrameId === frame.id}
                      onFocus={() => {
                        onFocusFrame(frame.id);
                        onSetSelectionAnchor(frame.id);
                      }}
                      onNormalClick={() => {
                        onToggleSelect(frame.id, false, false);
                      }}
                      onToggle={(shift, ctrl) => onToggleSelect(frame.id, shift, ctrl)}
                      gridSize={settings.frameGridSize}
                      activeId={activeId}
                      frames={frames}
                      chapterColor={chapter?.color}
                      checkedChapterColor={checkedChapter?.color}
                      stripColor={stripColor}
                      isAllFramesMode={isAllFramesMode}
                    />
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}>
              {activeId && activeFrame ? (
                <div className="relative">
                  {isDraggingSelection && selectionCount > 1 && (
                    <>
                      <div className="absolute top-1 left-1 w-full h-full rounded-lg bg-zinc-800 border border-zinc-700 translate-x-2 translate-y-2 opacity-40" />
                      <div className="absolute top-1 left-1 w-full h-full rounded-lg bg-zinc-800 border border-zinc-700 translate-x-1 translate-y-1 opacity-60" />
                    </>
                  )}
                  <div 
                    className="relative rounded-lg border-2 border-purple-500 bg-zinc-900 shadow-2xl overflow-hidden cursor-grabbing"
                    style={{ width: settings.frameGridSize, height: settings.frameGridSize }}
                  >
                    {activeFrame?.url && (
                      <img src={activeFrame.url} alt="Moving" className="w-full h-full object-contain checkerboard" />
                    )}
                    {isDraggingSelection && selectionCount > 1 && (
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-black rounded-md shadow-lg z-50">
                        {selectionCount}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Thumbnail Size Slider - Moved here to be immediately under thumbnails */}
        <div className="px-4 py-3 border-t border-zinc-900 bg-zinc-950 space-y-2">
          <div className="flex justify-between items-end text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Thumbnail Grootte</span>
            <span className="text-zinc-300 font-mono">{settings.frameGridSize}px</span>
          </div>
          <input
            type="range"
            min="40"
            max="160"
            value={settings.frameGridSize}
            onChange={(e) => updateSetting('frameGridSize', parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Alignment offset is now part of the "Analyze & Align" step. */}

        {/* Frame Selection Info & Actions */}
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
                  {focusedFrameId ? frames.find(f => f.id === focusedFrameId)?.durationMultiplier.toFixed(1) : '1.0'}x
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

        {/* Packing & Zoom Controls */}
      </div>
    </div>
  );
}
