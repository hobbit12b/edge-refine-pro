import React from 'react';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize 
} from 'lucide-react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  fps: number;
  onFpsChange: (fps: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen: () => void;
  currentIndex: number;
  totalFrames: number;
  className?: string;
}

export function PlaybackControls({
  isPlaying,
  onTogglePlay,
  onStepBack,
  onStepForward,
  fps,
  onFpsChange,
  zoom,
  onZoomChange,
  onFitToScreen,
  currentIndex,
  totalFrames,
  className = '',
}: PlaybackControlsProps) {
  return (
    <div className={`flex items-center gap-6 bg-zinc-950/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-zinc-800 shadow-2xl ${className}`}>
      {/* Navigation & Playback */}
      <div className="flex items-center gap-2">
        <button 
          onClick={onStepBack}
          className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors outline-none"
          title="Stap achteruit"
        >
          <ChevronLeft size={20} />
        </button>

        <button 
          onClick={onTogglePlay}
          className="w-10 h-10 flex items-center justify-center bg-purple-600 text-white rounded-full hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/20 active:scale-90 outline-none"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>

        <button 
          onClick={onStepForward}
          className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors outline-none"
          title="Stap vooruit"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      
      <div className="h-6 w-px bg-zinc-800" />

      {/* FPS Control */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Speed</span>
          <div className="flex items-center gap-1.5">
            <input 
              type="number" 
              value={fps}
              min={1}
              max={60}
              onChange={(e) => onFpsChange(parseInt(e.target.value) || 1)}
              className="w-14 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm font-mono text-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">FPS</span>
          </div>
        </div>
      </div>

      <div className="h-6 w-px bg-zinc-800" />
      
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => onZoomChange(Math.max(10, zoom - 10))}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
          title="Zoom uit"
        >
          <ZoomOut size={16} />
        </button>

        <div className="flex flex-col items-center gap-0.5 min-w-[120px]">
          <span className="text-[8px] font-mono font-bold text-purple-400 leading-none">
            {Math.round(zoom)}%
          </span>
          <input 
            type="range" 
            min="10"
            max="1000"
            value={zoom}
            onChange={(e) => onZoomChange(parseInt(e.target.value))}
            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        <button 
          onClick={() => onZoomChange(Math.min(1000, zoom + 10))}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>

        <button 
          onClick={onFitToScreen}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 ml-1 border-l border-zinc-800/50 pl-2 transition-colors"
          title="Fit to Screen"
        >
          <Maximize size={16} />
        </button>
      </div>

      <div className="h-6 w-px bg-zinc-800" />

      {/* Frame Counter */}
      <div className="flex items-center gap-2 min-w-[80px] justify-end">
        <span className="text-[10px] font-mono font-bold text-zinc-400">
          <span className="text-zinc-200">{currentIndex + 1}</span>
          <span className="mx-1 text-zinc-600">/</span>
          <span>{totalFrames}</span>
        </span>
      </div>
    </div>
  );
}
