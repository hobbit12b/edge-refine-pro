import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Settings, 
  Keyboard, 
  ArrowLeft, 
  ArrowRight, 
  Space,
  Gamepad2,
  X,
  Plus
} from 'lucide-react';
import { Frame, SpriteSheetSettings, AnimationChapter, KeyBinding } from '../types';
import { PlaybackControls } from './PlaybackControls';

interface AnimationTesterProps {
  frames: Frame[];
  settings: SpriteSheetSettings;
  chapters: AnimationChapter[];
  bindings: KeyBinding[];
  activeBindingId: string;
  onActiveBindingChange: (id: string) => void;
  onBindingsChange: (bindings: KeyBinding[]) => void;
  onBack: () => void;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  activeView: string;
  onViewChange: (view: any) => void;
  onShowExport: () => void;
  onStartOver: () => void;
  steps: any[];
}

export function AnimationTester({
  frames,
  settings,
  chapters,
  bindings,
  activeBindingId,
  onActiveBindingChange,
  onBindingsChange,
  onBack,
  onSettingsChange,
  activeView,
  onViewChange,
  onShowExport,
  onStartOver,
  steps,
}: AnimationTesterProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListeningForId, setIsListeningForId] = useState<string | null>(null);
  const [queuedBindingId, setQueuedBindingId] = useState<string | null>(null);

  const activeBinding = bindings.find(b => b.id === activeBindingId) || bindings.find(b => b.id === 'default')!;
  const activeChapter = chapters.find(c => c.id === activeBinding.chapterId);
  
  const playbackFrames = useMemo(() => {
    if (!activeChapter) return [];
    return frames.filter(f => activeChapter.frameIds.includes(f.id));
  }, [frames, activeChapter]);

  // Reset index when changing animations
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeBinding.chapterId, activeBinding.id]);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && playbackFrames.length > 0) {
      const currentFrame = playbackFrames[currentIndex % playbackFrames.length];
      const duration = (1000 / settings.fps) * (currentFrame?.durationMultiplier || 1);
      
      timerRef.current = window.setTimeout(() => {
        const nextIndex = currentIndex + 1;
        
        // Handle transitioning if queued
        const animationFinished = nextIndex >= playbackFrames.length;

        if (animationFinished) {
          if (queuedBindingId) {
            onActiveBindingChange(queuedBindingId);
            setQueuedBindingId(null);
            setCurrentIndex(0);
          } else if (!activeBinding.loop) {
            // Finished playing once, return to default
            onActiveBindingChange('default');
            setCurrentIndex(0);
          } else {
            setCurrentIndex(0);
          }
        } else {
          setCurrentIndex(nextIndex);
        }
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, playbackFrames.length, settings.fps, currentIndex, playbackFrames, activeBinding.loop]);

  const pressedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling with arrow keys or space globally in test view
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        // Only prevent if not in an input
        if (!(document.activeElement instanceof HTMLInputElement)) {
          e.preventDefault();
        }
      }

      if (e.repeat) return;
      pressedKeysRef.current.add(e.key);

      if (isListeningForId) {
        e.preventDefault();
        // Update the binding's keys as they are pressed
        const newKeys = Array.from(pressedKeysRef.current) as string[];
        onBindingsChange(bindings.map(b => b.id === isListeningForId ? { ...b, keys: newKeys } : b));
        // Don't close the listener yet, wait for keys to be released
        return;
      }

      // Find the binding with the MOST matching keys among currently pressed keys
      const activeKeys = Array.from(pressedKeysRef.current);
      const possibleBindings = bindings.filter(b => 
        b.keys && 
        b.keys.length > 0 && 
        b.keys.every(k => activeKeys.includes(k)) &&
        b.chapterId
      );

      // Sort by number of keys (most specific first)
      possibleBindings.sort((a, b) => (b.keys?.length || 0) - (a.keys?.length || 0));

      const bestBinding = possibleBindings[0];
      if (bestBinding && bestBinding.id !== 'default') {
        e.preventDefault();
        if (activeBindingId !== bestBinding.id) {
          if (activeBinding.finishAnimation && currentIndex < playbackFrames.length - 1 && playbackFrames.length > 1) {
            setQueuedBindingId(bestBinding.id);
          } else {
            setQueuedBindingId(null);
            onActiveBindingChange(bestBinding.id);
            setCurrentIndex(0);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key);
      
      if (isListeningForId) {
        // Only finalize when ALL keys are released
        if (pressedKeysRef.current.size === 0) {
          setIsListeningForId(null);
        }
        return;
      }
      
      // Re-evaluate what should be playing based on remaining pressed keys
      const activeKeys = Array.from(pressedKeysRef.current);
      const possibleBindings = bindings.filter(b => 
        b.keys && 
        b.keys.length > 0 && 
        b.keys.every(k => activeKeys.includes(k)) &&
        b.chapterId
      );
      possibleBindings.sort((a, b) => (b.keys?.length || 0) - (a.keys?.length || 0));
      const bestBinding = possibleBindings[0];
      const targetId = bestBinding?.id || 'default';

      if (activeBindingId !== targetId) {
        if (activeBinding.finishAnimation && currentIndex < playbackFrames.length - 1 && playbackFrames.length > 1) {
          setQueuedBindingId(targetId);
        } else {
          setQueuedBindingId(null);
          onActiveBindingChange(targetId);
          setCurrentIndex(0);
        }
      } else {
        setQueuedBindingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [bindings, isListeningForId, activeBindingId]);

  const currentFrame = playbackFrames[currentIndex % playbackFrames.length];

  const updateBinding = (id: string, updates: Partial<KeyBinding>) => {
    onBindingsChange(bindings.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const addBinding = () => {
    const newBinding: KeyBinding = {
      id: crypto.randomUUID(),
      keys: ['?'],
      label: 'Nieuwe Actie',
      chapterId: null,
      mirror: false,
      holdToPlay: false,
      loop: true
    };
    onBindingsChange([...bindings, newBinding]);
  };

  const removeBinding = (id: string) => {
    if (id === 'default') return;
    onBindingsChange(bindings.filter(b => b.id !== id));
    if (activeBindingId === id) onActiveBindingChange('default');
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const fitToScreen = () => {
    if (!currentFrame || !previewContainerRef.current) return;
    
    const frameW = currentFrame.originalWidth;
    const frameH = currentFrame.originalHeight;
    const containerW = previewContainerRef.current.clientWidth;
    const containerH = previewContainerRef.current.clientHeight;
    
    if (frameW > 0 && frameH > 0) {
      const scaleW = (containerW - 100) / frameW;
      const scaleH = (containerH - 100) / frameH;
      const fitScale = Math.min(scaleW, scaleH, 1.0) * 100;
      onSettingsChange({ ...settings, zoom: Math.floor(fitScale) });
    }
  };

  // Focus container and Auto-fit when entering test view
  useEffect(() => {
    if (activeView === 'test') {
      containerRef.current?.focus();
      // Small delay to ensure parent dimension are ready
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [activeView, !!currentFrame]);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="flex-1 flex flex-col bg-zinc-950 overflow-hidden relative outline-none"
    >
      <div 
        ref={previewContainerRef}
        className="flex-1 flex items-center justify-center relative p-20 bg-zinc-950 pb-28"
      >
        <div className="absolute inset-0 checkerboard opacity-5 pointer-events-none" />
        
        {/* Environment mockup floor */}
        <div className="absolute bottom-[30%] left-0 right-0 h-px bg-zinc-800" />
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-zinc-900/20 to-transparent pointer-events-none" style={{ transform: 'rotateX(60deg)' }} />

        {currentFrame ? (
          <div 
            className="absolute transition-all duration-200"
            style={{
              left: '50%',
              top: '70%', // Align with the floor line (bottom: 30% is top: 70%)
              width: settings.frameSize.width * (settings.zoom / 100),
              height: settings.frameSize.height * (settings.zoom / 100),
              transform: `translate(-${(settings.customPivot?.x || 0.5) * 100}%, -${(settings.customPivot?.y || 0.5) * 100}%) ${activeBinding.mirror ? 'scaleX(-1)' : ''}`,
              transformOrigin: `${(settings.customPivot?.x || 0.5) * 100}% ${(settings.customPivot?.y || 0.5) * 100}%`
            }}
          >
            <img 
              src={currentFrame.url} 
              alt="Test Preview"
              className="absolute select-none max-w-none max-h-none"
              style={{ 
                imageRendering: 'pixelated',
                left: '50%',
                top: '50%',
                width: `${currentFrame.originalWidth * (settings.zoom / 100)}px`,
                height: `${currentFrame.originalHeight * (settings.zoom / 100)}px`,
                transform: `translate(calc(-50% + ${(currentFrame.offset?.x || 0) * (settings.zoom / 100)}px), calc(-50% + ${(currentFrame.offset?.y || 0) * (settings.zoom / 100)}px))`,
              }}
            />
            {/* Visual Pivot Point for debugging/confirmation */}
            <div className="absolute w-2 h-2 -ml-1 -mt-1 bg-purple-500 rounded-full border border-white shadow-[0_0_10px_rgba(168,85,247,0.8)] z-[200]" style={{ left: (settings.customPivot?.x || 0.5) * 100 + '%', top: (settings.customPivot?.y || 0.5) * 100 + '%' }} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-zinc-500">
            <Gamepad2 size={48} className="opacity-20" />
            <p className="text-sm font-medium">Selecteer een hoofdstuk om te testen</p>
          </div>
        )}
      </div>
      <div className="absolute left-6 top-20 bottom-28 w-80 bg-zinc-950/90 backdrop-blur-2xl border border-zinc-800 rounded-3xl p-6 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-purple-500">
            <Gamepad2 size={24} />
            <h3 className="font-bold tracking-tight">Test Controller</h3>
          </div>
          <button 
            onClick={addBinding}
            className="p-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-500 rounded-xl transition-colors"
            title="Voeg actie toe"
          >
            <Keyboard size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-20">
            {bindings.map((b) => {
              const chapter = chapters.find(c => c.id === b.chapterId);
              const chapterColor = chapter?.color || '#a855f7';
              
              return (
                <div 
                  key={b.id} 
                  className={`p-4 rounded-2xl border transition-all ${activeBindingId === b.id ? 'bg-purple-600/5 border-purple-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                  style={{ borderLeftWidth: activeBindingId === b.id ? '4px' : '1px', borderLeftColor: activeBindingId === b.id ? chapterColor : undefined }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <input 
                      type="text" 
                      value={b.label}
                      readOnly={b.id === 'default'}
                      onChange={(e) => updateBinding(b.id, { label: e.target.value })}
                      className="bg-transparent border-none text-xs font-bold text-zinc-200 outline-none w-2/3"
                      style={{ color: activeBindingId === b.id ? chapterColor : undefined }}
                    />
                    {b.id !== 'default' && (
                      <button 
                        onClick={() => removeBinding(b.id)}
                        className="p-1 hover:text-red-400 text-zinc-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Key Setup */}
                    {b.id !== 'default' && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-zinc-500 uppercase">Toets</span>
                        <button 
                          onClick={() => setIsListeningForId(b.id)}
                          className={`px-2 py-1 rounded font-mono text-[10px] border transition-all ${isListeningForId === b.id ? 'bg-purple-600 border-purple-400 text-white animate-pulse' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                        >
                          {isListeningForId === b.id ? 'Druk toets...' : (b.keys || []).join(' + ').toUpperCase()}
                        </button>
                      </div>
                    )}

                    {/* Chapter Select */}
                    <div className="relative">
                      <select 
                        value={b.chapterId || ''}
                        onChange={(e) => updateBinding(b.id, { chapterId: e.target.value || null })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-300 outline-none focus:ring-1 focus:ring-purple-500/50 appearance-none"
                      >
                        <option value="">Selecteer animatie</option>
                        {chapters.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {chapter && (
                        <div 
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                          style={{ backgroundColor: chapterColor }}
                        />
                      )}
                    </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => updateBinding(b.id, { mirror: !b.mirror })}
                          className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${b.mirror ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                        >
                          Spiegelen
                        </button>
                        <button 
                          onClick={() => updateBinding(b.id, { loop: !b.loop })}
                          className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${b.loop ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                        >
                          Herhalen
                        </button>
                        {b.id !== 'default' && (
                          <>
                            <button 
                              onClick={() => updateBinding(b.id, { holdToPlay: !b.holdToPlay })}
                              className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${b.holdToPlay ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                            >
                              Houden
                            </button>
                            <button 
                              onClick={() => updateBinding(b.id, { finishAnimation: !b.finishAnimation })}
                              className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${b.finishAnimation ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                            >
                              Afmaken
                            </button>
                          </>
                        )}
                      </div>
                  </div>
                </div>
              );
            })}
          
          <button 
            onClick={addBinding}
            className="w-full flex items-center justify-center gap-2 p-4 bg-zinc-900/30 border-2 border-dashed border-zinc-800 hover:border-purple-500/50 hover:bg-purple-600/5 text-zinc-500 hover:text-purple-400 rounded-2xl transition-all group"
          >
            <Plus size={18} className="group-hover:scale-110 transition-all" />
            <span className="text-[10px] font-black uppercase tracking-widest">Nieuwe Actie Toevoegen</span>
          </button>
        </div>
      </div>

      {/* Playback Controls Fixed at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 flex items-center px-6 gap-6 z-[100]">
        {/* Legend integrated into the bottom bar */}
        <div className="flex items-center gap-3 border-r border-zinc-800 pr-6">
          {bindings.filter(b => b.keys && !b.keys.includes('default') && b.chapterId).map(b => {
             const chapter = chapters.find(c => c.id === b.chapterId);
             const chapterColor = chapter?.color || '#a855f7'; // fallback purple
             return (
              <div key={b.id} className={`flex flex-col items-center gap-1 transition-all ${activeBindingId === b.id ? 'scale-105 opacity-100' : 'opacity-30'}`}>
                  <div 
                    className={`px-2 py-1 bg-zinc-950 border rounded-lg font-mono text-[9px] flex items-center gap-1.5 transition-colors`}
                    style={{ 
                      borderColor: activeBindingId === b.id ? chapterColor : 'rgb(39 39 42)',
                      color: activeBindingId === b.id ? chapterColor : 'rgb(113 113 122)'
                    }}
                  >
                    {(b.keys || []).map((k, i) => (
                      <React.Fragment key={k}>
                        {i > 0 && <span className="text-[7px] opacity-40">+</span>}
                        {k === 'ArrowRight' ? <ArrowRight size={10} /> : k === 'ArrowLeft' ? <ArrowLeft size={10} /> : k === ' ' ? <Space size={10} /> : null}
                        {k === ' ' ? 'SPACE' : k.replace('Arrow', '').toUpperCase()}
                      </React.Fragment>
                    ))}
                  </div>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">{b.label}</span>
              </div>
            );
          })}
          <div className={`flex flex-col items-center gap-1 transition-all ${activeBindingId === 'default' ? 'scale-105 opacity-100' : 'opacity-30'}`}>
             <div className={`px-2 py-1 bg-zinc-950 border rounded-lg font-mono text-[9px] flex items-center gap-1.5 ${activeBindingId === 'default' ? 'border-zinc-400 text-zinc-200' : 'border-zinc-800 text-zinc-600'}`}>
                RUST
             </div>
             <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Idle</span>
          </div>
        </div>

        <PlaybackControls 
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onStepBack={() => setCurrentIndex(prev => (prev - 1 + playbackFrames.length) % playbackFrames.length)}
          onStepForward={() => setCurrentIndex(prev => (prev + 1) % playbackFrames.length)}
          fps={settings.fps}
          onFpsChange={(val) => onSettingsChange({ ...settings, fps: val })}
          zoom={settings.zoom}
          onZoomChange={(val) => onSettingsChange({ ...settings, zoom: val })}
          onFitToScreen={() => onSettingsChange({ ...settings, zoom: 100 })}
          currentIndex={currentIndex % (playbackFrames.length || 1)}
          totalFrames={playbackFrames.length}
          className="flex-1 !bg-transparent !border-none !shadow-none !p-0"
        />
      </div>
    </div>
  );
}
