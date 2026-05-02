import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Repeat, 
  RotateCcw,
  X, 
  Maximize2,
  ZoomIn,
  ZoomOut,
  Target,
  Loader2,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Frame, SpriteSheetSettings } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { FrameManualEditor } from './FrameManualEditor';
import { PlaybackControls } from './PlaybackControls';

interface MainPreviewProps {
  frames: Frame[];
  activeFrames: Frame[];
  originalFrames: Frame[];
  selectedIds: Set<string>;
  focusedFrameId: string | null;
  onFocusFrame: (id: string | null) => void;
  onUpdateFrame: (id: string, newBlob: Blob) => void;
  duplicateIds: Set<string>;
  settings: SpriteSheetSettings;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  onStartOver: () => void;
  onAnalyze: () => void;
  activeView: string;
  onViewChange: (view: any) => void;
  onShowExport: () => void;
  isDetectingDuplicates: boolean;
  onDeleteDuplicates: () => void;
  onDetectDuplicates: () => void;
  visualScale: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentIndex: number;
  setCurrentIndex: (idx: number) => void;
  steps: any[];
  isPickingColor?: boolean;
  onColorPick?: (frameId: string, x: number, y: number) => void;
}

export function MainPreview({ 
  frames,
  activeFrames,
  originalFrames,
  selectedIds, 
  focusedFrameId, 
  onFocusFrame,
  onUpdateFrame,
  duplicateIds,
  settings, 
  onSettingsChange, 
  onStartOver,
  onAnalyze,
  activeView,
  onViewChange,
  onShowExport,
  isDetectingDuplicates,
  onDeleteDuplicates,
  onDetectDuplicates,
  visualScale,
  isPlaying,
  onTogglePlay,
  currentIndex,
  setCurrentIndex,
  steps,
  isPickingColor,
  onColorPick,
}: MainPreviewProps) {
  const isSpacePressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false); // keep state for UI re-render (cursor etc)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [manualEditorDismissedForFrameId, setManualEditorDismissedForFrameId] = useState<string | null>(null);

  // Sync initial pan offset from settings
  useEffect(() => {
    setPanOffset(settings.offset);
  }, [settings.offset.x, settings.offset.y]);

  const stats = useMemo(() => {
    if (frames.length === 0) return null;
    
    const originalArea = frames.length * settings.frameSize.width * settings.frameSize.height;
    let trimmedArea = 0;
    
    frames.forEach(f => {
      if (f.trimmedBox && settings.trimSprites) {
        trimmedArea += f.trimmedBox.w * f.trimmedBox.h;
      } else {
        trimmedArea += settings.frameSize.width * settings.frameSize.height;
      }
    });

    const savings = originalArea > 0 ? (1 - trimmedArea / originalArea) * 100 : 0;
    const mbOriginal = (originalArea * 4) / (1024 * 1024);
    const mbTrimmed = (trimmedArea * 4) / (1024 * 1024);

    return {
      savings: Math.round(savings),
      mbSaved: (mbOriginal - mbTrimmed).toFixed(2)
    };
  }, [frames, settings.trimSprites, settings.frameSize]);

  useEffect(() => {
    if (focusedFrameId) {
      if (isPlaying) onTogglePlay();
    }
  }, [focusedFrameId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);


  const singleSelectedFrameId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const manualEditorFrameId = focusedFrameId || singleSelectedFrameId;
  const shouldShowManualEditor = Boolean(
    !isPlaying &&
    manualEditorFrameId &&
    (!singleSelectedFrameId || manualEditorDismissedForFrameId !== singleSelectedFrameId)
  );

  const updateSetting = <K extends keyof SpriteSheetSettings>(key: K, value: SpriteSheetSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedIds.size]);

  useEffect(() => {
    if (selectedIds.size !== 1) {
      setManualEditorDismissedForFrameId(null);
      return;
    }

    const selectedFrameId = Array.from(selectedIds)[0];
    if (manualEditorDismissedForFrameId && manualEditorDismissedForFrameId !== selectedFrameId) {
      setManualEditorDismissedForFrameId(null);
    }
  }, [selectedIds, manualEditorDismissedForFrameId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        const isFocusedOnInput = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
        if (isFocusedOnInput) return;

        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
        if (isPlaying) onTogglePlay();
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          updateSetting('interactionMode', 'none');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings, isPlaying]);

  if (activeFrames.length === 0) {
    return (
      <div className="flex-1 bg-zinc-900 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">No frames available</div>
      </div>
    );
  }

  const focusedFrame = frames.find(f => f.id === focusedFrameId);
  const currentFrame = activeFrames[currentIndex % activeFrames.length];

  const handleTogglePlay = () => {
    onTogglePlay();
    if (!isPlaying && settings.interactionMode !== 'none') {
      updateSetting('interactionMode', 'none');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      updateSetting('offset', panOffset);
    }
    setIsPanning(false);
  };

  const fitToScreen = () => {
    const frameW = settings.frameSize.width * visualScale;
    const frameH = settings.frameSize.height * visualScale;
    const containerW = workspaceRef.current?.clientWidth || window.innerWidth - 600;
    const containerH = workspaceRef.current?.clientHeight || window.innerHeight - 200;

    if (frameW > 0 && frameH > 0) {
      const scaleW = (containerW - 100) / frameW;
      const scaleH = (containerH - 100) / frameH;
      const fitScale = Math.min(scaleW, scaleH) * 100;
      const nextSettings = {
        ...settings,
        zoom: Math.floor(fitScale),
        offset: { x: 0, y: 0 },
      };

      setPanOffset({ x: 0, y: 0 });
      onSettingsChange(nextSettings);
    }
  };

  const handleStepForward = () => {
    if (isPlaying) onTogglePlay();
    const nextIdx = (currentIndex + 1) % activeFrames.length;
    setCurrentIndex(nextIdx);
    onFocusFrame(activeFrames[nextIdx].id);
  };

  const handleStepBack = () => {
    if (isPlaying) onTogglePlay();
    const prevIdx = (currentIndex - 1 + activeFrames.length) % activeFrames.length;
    setCurrentIndex(prevIdx);
    onFocusFrame(activeFrames[prevIdx].id);
  };

  // Auto-fit when entering view
  useEffect(() => {
    if (activeView === 'editor') {
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [activeView, frames.length]);

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-900 relative overflow-hidden">
      {/* Duplicate Detection Banner */}
      <AnimatePresence>
        {(duplicateIds.size > 0 || isDetectingDuplicates) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-500/10 border-b border-orange-500/20 overflow-hidden"
          >
            <div className="h-12 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                {isDetectingDuplicates ? (
                  <Loader2 className="animate-spin text-orange-500" size={16} />
                ) : (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
                <span className="text-[11px] font-bold text-orange-500 uppercase tracking-widest">
                  {isDetectingDuplicates ? 'Motion analyseren...' : `Gedetecteerd: ${duplicateIds.size} potentiële dubbele frames`}
                </span>
              </div>
              {!isDetectingDuplicates && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={onDeleteDuplicates}
                    className="px-3 py-1 bg-orange-500 text-black text-[10px] font-black uppercase tracking-tight rounded-md hover:bg-orange-400 transition-all active:scale-95"
                  >
                    Dubbele Frames Opschonen
                  </button>
                  <button 
                    onClick={onDetectDuplicates}
                    className="p-1 px-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase"
                  >
                    HER-SCAN
                  </button>
                  <div className="w-px h-4 bg-zinc-800 mx-1" />
                  <button 
                    onClick={() => {
                      // We need to tell the parent to clear duplicates
                      (onDeleteDuplicates as any).clearOnly?.() || window.dispatchEvent(new CustomEvent('clear-duplicates'));
                    }}
                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors"
                    title="Sluiten"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Preview Area */}
      <div 
        className={`flex-1 relative overflow-hidden ${
          settings.checkerboardMode === 'transparent' ? 'bg-zinc-950' : 
          settings.checkerboardMode === 'red' ? 'bg-red-900' :
          settings.checkerboardMode === 'green' ? 'bg-green-900' :
          settings.checkerboardMode === 'gray' ? 'bg-zinc-800' :
          settings.checkerboardMode === 'white' ? 'bg-white' :
          'bg-zinc-950'
        }`}
        style={{ cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {shouldShowManualEditor ? (
          (() => {
            const editorFrame = frames.find(f => f.id === manualEditorFrameId);
            const editorOriginalFrame = originalFrames.find(f => f.id === manualEditorFrameId);
            
            if (!editorFrame || !editorOriginalFrame) return null;
            
            return (
              <div className="absolute inset-0 z-50 bg-zinc-950">
                <FrameManualEditor 
                  frame={editorFrame}
                  originalFrame={editorOriginalFrame}
                  settings={settings}
                  onSettingsChange={onSettingsChange}
                  onUpdate={onUpdateFrame}
                  onClose={() => {
                    updateSetting('interactionMode', 'none');
                    if (singleSelectedFrameId) {
                      setManualEditorDismissedForFrameId(singleSelectedFrameId);
                    }
                  }}
                  visualScale={visualScale}
                />
              </div>
            );
          })()
        ) : null}
        
        <div
          ref={workspaceRef}
          className="absolute top-0 left-0 right-0 bottom-24 flex items-center justify-center p-20 overflow-hidden"
        >
          <div className="absolute inset-0 checkerboard opacity-10 pointer-events-none" />

          {/* Preview Container */}
          <div 
            ref={containerRef}
            className={`relative shadow-2xl flex-none`}
            style={{
              width: settings.frameSize.width * (settings.zoom / 100),
              height: settings.frameSize.height * (settings.zoom / 100),
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
            }}
          >
          {/* Bounding Box Overlay */}
          <div className="absolute inset-0 border border-dashed border-purple-500/50 pointer-events-none" />
          
          {currentFrame?.url && (
            <>
              {/* Original Bounds (Faded) */}
              <div className="absolute inset-0 border border-zinc-800/30 pointer-events-none" />
              
              <img 
                src={currentFrame.url} 
                alt="Preview"
                draggable="false"
                className="absolute select-none max-w-none max-h-none"
                style={{ 
                  imageRendering: 'pixelated',
                  left: '50%',
                  top: '50%',
                  width: `${currentFrame.originalWidth * (settings.zoom / 100) * visualScale}px`,
                  height: `${currentFrame.originalHeight * (settings.zoom / 100) * visualScale}px`,
                  transform: `translate(calc(-50% + ${(currentFrame.offset?.x || 0) * (settings.zoom / 100) * visualScale}px), calc(-50% + ${(currentFrame.offset?.y || 0) * (settings.zoom / 100) * visualScale}px))`,
                  cursor: isPickingColor ? 'crosshair' : undefined,
                  pointerEvents: isPickingColor ? 'auto' : 'none',
                }}
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
                  const x = Math.floor(((e.clientX - rect.left) / rect.width) * currentFrame.originalWidth);
                  const y = Math.floor(((e.clientY - rect.top) / rect.height) * currentFrame.originalHeight);
                  if (isPickingColor && onColorPick) {
                    onColorPick(currentFrame.id, x, y);
                  }
                }}
              />

              {/* Canvas Bound Overlay - Shows what is being cropped */}
              <div 
                className="absolute border-2 border-red-500/50 pointer-events-none z-50 shadow-[0_0_0_1000px_rgba(0,0,0,0.3)]"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${settings.frameSize.width * (settings.zoom / 100)}px`,
                  height: `${settings.frameSize.height * (settings.zoom / 100)}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="absolute -top-6 left-0 bg-red-500/80 text-[10px] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                  Canvas Kader (Crop Zone)
                </div>
              </div>

              {/* Pivot Point Handle */}
              <div 
                className="absolute pointer-events-none"
                style={{
                  left: settings.customPivot.x * 100 + '%',
                  top: settings.customPivot.y * 100 + '%',
                  zIndex: 40
                }}
              >
                <div className={`w-4 h-4 -ml-2 -mt-2 border-2 border-white rounded-full bg-purple-600 shadow-xl shadow-purple-600/50 flex items-center justify-center`}>
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
              </div>

              {/* Trimmed Bounds (Pro Visualization) */}
              {settings.trimSprites && currentFrame.trimmedBox && (
                <div 
                  className="absolute border border-purple-500/40 pointer-events-none transition-all duration-200"
                  style={{
                    left: (currentFrame.trimmedBox.x / currentFrame.originalWidth) * 100 + '%',
                    top: (currentFrame.trimmedBox.y / currentFrame.originalHeight) * 100 + '%',
                    width: (currentFrame.trimmedBox.w / currentFrame.originalWidth) * 100 + '%',
                    height: (currentFrame.trimmedBox.h / currentFrame.originalHeight) * 100 + '%',
                  }}
                >
                  <div className="absolute -top-4 left-0 text-[8px] font-bold text-purple-400 uppercase tracking-widest whitespace-nowrap bg-zinc-950/80 px-1 rounded">
                    Trim: {currentFrame.trimmedBox.w}x{currentFrame.trimmedBox.h}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>

        {/* Bottom persistent controls - Fixed design */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-center z-[100]">
          <PlaybackControls 
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            fps={settings.fps}
            onFpsChange={(val) => updateSetting('fps', val)}
            zoom={settings.zoom}
            onZoomChange={(val) => updateSetting('zoom', val)}
            onFitToScreen={fitToScreen}
            currentIndex={currentIndex % activeFrames.length}
            totalFrames={activeFrames.length}
            className="w-full max-w-5xl !bg-transparent !border-none !shadow-none"
          />
        </div>
      </div>
    </div>
  );
}
