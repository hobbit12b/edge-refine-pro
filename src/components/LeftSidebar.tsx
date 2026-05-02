import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Undo2,
  Zap,
  Sparkles,
  Loader2,
  CircleDashed,
  Pencil,
  Scissors,
  Eraser,
  Magnet,
  Plus,
  FolderPlus,
  Save,
  FileUp,
  LayoutList,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit2,
  ListPlus,
  Link,
  ChevronUp,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { SpriteSheetSettings, Frame, AnimationChapter } from '../types';
import { CHAPTER_COLORS, getNextChapterColor } from '@/utils/chapterColors';

interface LeftSidebarProps {
  settings: SpriteSheetSettings;
  frames: Frame[];
  chapters: AnimationChapter[];
  onChaptersChange: (chapters: AnimationChapter[]) => void;
  selectedIds: Set<string>;
  onSelectIds: (ids: Set<string>) => void;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  onStartOver: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  removalState: { active: boolean, current: number, total: number, progress: number };
  onRemoveBackground: () => void;
  focusedFrameId: string | null;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  onAddFrames: () => void;
  onReorderChapters: (startIndex: number, endIndex: number) => void;
  checkedChapterIds: Set<string>;
  onToggleChapterChecked: (chapterId: string) => void;
  onDeleteChapter: (chapterId: string) => void;
  onChapterCreated: (chapterId: string) => void;
  // Color removal
  onPickColor: () => void;
  onApplyColorRemoval: () => void;
  onAutoColorRemoval: () => void;
  isPickingColor: boolean;
  // Edge refine
  onEdgeOp: (op: 'erode' | 'dilate' | 'feather' | 'decontaminate') => void;
  edgeBusy: boolean;
  isAllFramesMode: boolean;
  onAllFramesToggle: () => void;
  selectionPreviewColor: string | null;
}

export function LeftSidebar({ 
  settings, 
  frames,
  chapters,
  onChaptersChange,
  selectedIds,
  onSelectIds,
  onSettingsChange, 
  onStartOver,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  removalState,
  onRemoveBackground,
  focusedFrameId,
  onSaveProject,
  onLoadProject,
  onAddFrames,
  onReorderChapters,
  checkedChapterIds,
  onToggleChapterChecked,
  onDeleteChapter,
  onChapterCreated,
  onPickColor,
  onApplyColorRemoval,
  onAutoColorRemoval,
  isPickingColor,
  onEdgeOp,
  edgeBusy,
  isAllFramesMode,
  onAllFramesToggle,
  selectionPreviewColor,
}: LeftSidebarProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');

  const updateSetting = <K extends keyof SpriteSheetSettings>(key: K, value: SpriteSheetSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const addChapter = () => {
    if (selectedIds.size === 0) return;

    const newChapter: AnimationChapter = {
      id: crypto.randomUUID(),
      name: 'Nieuw Hoofdstuk',
      frameIds: Array.from(selectedIds),
      isExpanded: true,
      color: selectionPreviewColor ?? getNextChapterColor(chapters)
    };
    onChaptersChange([...chapters, newChapter]);
    onChapterCreated(newChapter.id);
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

  const assignSelectedToChapter = (chapterId: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    onChaptersChange(chapters.map(c => {
      if (c.id === chapterId) {
        return { ...c, frameIds: Array.from(new Set([...c.frameIds, ...ids])) };
      }
      return c;
    }));
  };

  const selectChapterFrames = (chapter: AnimationChapter, isMultiSelect: boolean) => {
    const currentIds = new Set(chapter.frameIds);
    
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
  };

  const updateChapterColor = (id: string, color: string) => {
    onChaptersChange(chapters.map(c => c.id === id ? { ...c, color } : c));
  };

  const getChapterColor = (chapter: AnimationChapter, index: number) => {
     return chapter.color || CHAPTER_COLORS[index % CHAPTER_COLORS.length];
  };

  return (
    <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col h-full overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-6">
        {/* Project Actions */}
        <section className="grid grid-cols-2 gap-2">
          <button 
            onClick={onStartOver}
            className="flex flex-col items-center justify-center gap-1 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all group"
            title="Nieuw Project"
          >
            <FolderPlus size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Nieuw</span>
          </button>
          <button 
            onClick={onAddFrames}
            className="flex flex-col items-center justify-center gap-1 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all group"
            title="Voeg frames toe"
          >
            <Plus size={18} className="group-hover:scale-110 transition-transform text-purple-500" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Frames +</span>
          </button>
          <button 
            onClick={onSaveProject}
            className="flex flex-col items-center justify-center gap-1 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all group"
            title="Sla project op"
          >
            <Save size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Opslaan</span>
          </button>
          <label className="flex flex-col items-center justify-center gap-1 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all group cursor-pointer">
            <FileUp size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Openen</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".spritemaster" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLoadProject(file);
              }}
            />
          </label>
        </section>

        {/* Index / Table of Contents */}
        <section className="space-y-4 pb-4 border-t border-zinc-900 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <LayoutList size={12} className="text-purple-500" />
              Naam geselecteerde frames
            </h3>
            <button 
              onClick={addChapter}
              className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="Voeg hoofdstuk toe (met selectie)"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {/* All Frames Item */}
            <div className="group flex items-center gap-1 p-1.5 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-lg border border-zinc-800 transition-all">
              <div className="flex items-center px-1 py-1 cursor-pointer" onClick={(e) => {
                e.stopPropagation();
                onAllFramesToggle();
              }}>
                <input 
                  type="checkbox"
                  checked={isAllFramesMode}
                  onChange={() => {}} // Handled by div click
                  className="w-3 h-3 rounded border-zinc-700 bg-zinc-950 accent-purple-500 cursor-pointer pointer-events-none"
                />
              </div>
              <button 
                onClick={onAllFramesToggle}
                className="flex-1 text-left text-[10px] font-bold text-zinc-300 hover:text-white truncate py-0.5"
              >
                Alle Frames
                <span className="ml-1 text-[7px] text-zinc-600 font-mono">({frames.length})</span>
              </button>
            </div>

            <div className="h-px bg-zinc-900 my-2 mx-2" />

            {chapters.map((chapter, idx) => {
              const allChapterIds = new Set(chapter.frameIds);
              const isSelected = allChapterIds.size > 0 && Array.from(allChapterIds).every(id => selectedIds.has(id));
              const isChecked = checkedChapterIds.has(chapter.id);
              const chapterColor = getChapterColor(chapter, idx);
              
              return (
                <div key={chapter.id} className="space-y-1">
                  <div 
                    className="group flex items-center gap-1 p-1.5 bg-zinc-900/50 rounded-lg border transition-all"
                    style={{ borderColor: (isSelected || isChecked) ? chapterColor : 'rgb(39 39 42)' }}
                  >
                    <div className="flex items-center px-0.5 py-1 cursor-pointer" onClick={(e) => {
                      e.stopPropagation();
                      onToggleChapterChecked(chapter.id);
                    }}>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Hit area handled by div
                        style={{ accentColor: chapterColor }}
                        className="w-3 h-3 rounded border-zinc-700 bg-zinc-950 cursor-pointer pointer-events-none"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {editingId === chapter.id ? (
                        <input 
                          autoFocus
                          className="w-full bg-zinc-950 text-[10px] font-bold px-1 rounded border border-purple-500 outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(chapter.id)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(chapter.id)}
                        />
                      ) : (
                        <div className="flex flex-col">
                          <button 
                            onClick={(e) => selectChapterFrames(chapter, e.ctrlKey || e.metaKey)}
                            onDoubleClick={() => startEditing(chapter.id, chapter.name)}
                            className="text-left text-[10px] font-bold text-zinc-300 hover:text-white truncate"
                          >
                            {chapter.name}
                            <span className="ml-1 text-[7px] text-zinc-600 font-mono">
                              ({chapter.frameIds.length})
                            </span>
                          </button>
                          
                          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {CHAPTER_COLORS.map(color => (
                               <button
                                 key={color}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   updateChapterColor(chapter.id, color);
                                 }}
                                 className={`w-2 h-2 rounded-full transition-all ${getChapterColor(chapter, idx) === color ? 'ring-1 ring-white scale-110' : 'opacity-40 hover:opacity-100'}`}
                                 style={{ backgroundColor: color }}
                               />
                             ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button 
                        onClick={() => assignSelectedToChapter(chapter.id)}
                        className="p-0.5 text-zinc-500 hover:text-purple-400"
                        title="Link selectie"
                      >
                        <Link size={10} />
                      </button>
                      <button 
                        onClick={() => startEditing(chapter.id, chapter.name)}
                        className="p-0.5 text-zinc-500 hover:text-blue-400"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button 
                        onClick={() => onDeleteChapter(chapter.id)}
                        className="p-0.5 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {chapters.length === 0 && (
              <div className="text-[9px] text-zinc-600 italic py-2 px-1 text-center bg-zinc-900/20 rounded-lg border border-dashed border-zinc-800">
                Geen hoofdstukken. Selecteer frames en klik op +
              </div>
            )}
          </div>
        </section>

        {/* AI Tools */}
        <section className="space-y-3 pb-2 pt-2 border-t border-zinc-900 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              AI Tools
            </h3>
            {removalState.active ? (
              <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 animate-pulse uppercase tracking-tighter">
                {removalState.current} van {removalState.total} klaar
              </span>
            ) : (
              <span className="text-[8px] font-mono text-zinc-500">
                {selectedIds.size} / {frames.length}
              </span>
            )}
          </div>
          <button 
            onClick={onRemoveBackground}
            disabled={removalState.active || frames.length === 0}
            className={`
              w-full py-2.5 rounded-xl flex flex-col items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all relative overflow-hidden
              ${removalState.active 
                ? 'bg-zinc-900 border border-purple-900/30 text-zinc-400' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] active:scale-95 shadow-lg shadow-purple-600/20'}
              disabled:opacity-50 disabled:grayscale
            `}
          >
            {removalState.active ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative flex items-center justify-center w-20 h-20">
                  {/* Thinking Animation (Circle) - Use CSS for better persistence during JS load */}
                  <div className="absolute inset-0 flex items-center justify-center text-purple-500 animate-[spin_1.5s_linear_infinite]">
                    <Loader2 size={48} strokeWidth={1.5} />
                  </div>
                  
                  {/* Percentage in center */}
                  <div className="relative z-10 flex flex-col items-center justify-center">
                    <span className="text-[16px] font-black tracking-tighter text-white tabular-nums drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">
                      {Math.round(removalState.progress * 100)}%
                    </span>
                    <span className="text-[6px] text-zinc-500 font-bold uppercase tracking-widest -mt-1 opacity-80">
                      Processing
                    </span>
                  </div>

                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-purple-500/10 blur-[20px] rounded-full animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Sparkles size={14} className="text-purple-400" />
                <span>AI BG REMOVER (ISNet)</span>
              </div>
            )}
          </button>
          
          {removalState.active && (
            <div className="w-full px-1">
              <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden mt-1 relative border border-zinc-800/80 shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 via-indigo-400 to-purple-600 bg-[length:200%_100%]"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${Math.round(removalState.progress * 100)}%`,
                    backgroundPosition: ["0% 0%", "100% 0%"]
                  }}
                  transition={{ 
                    width: { duration: 0.1, ease: "linear" },
                    backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
                  }}
                />
              </div>
            </div>
          )}
          
          {!removalState.active && (
            <div className="pt-2 group">
              <div className="flex items-center justify-between mb-2 text-zinc-500 uppercase font-bold text-[8px] tracking-widest">
                <span>Achtergrond Kleur (Menu)</span>
              </div>
              <div className="flex items-center gap-2">
                {(['transparent', 'red', 'green', 'gray', 'white'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSetting('checkerboardMode', mode)}
                    className={`flex-1 h-8 rounded-lg border transition-all relative overflow-hidden group/btn ${
                      settings.checkerboardMode === mode ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                    title={`${mode} background`}
                  >
                    <div className={`absolute inset-0 ${
                      mode === 'transparent' ? 'checkerboard-small opacity-50' : 
                      mode === 'red' ? 'bg-red-900' :
                      mode === 'green' ? 'bg-green-900' : 
                      mode === 'white' ? 'bg-white' :
                      'bg-zinc-800'
                    }`} />
                    {settings.checkerboardMode === mode && (
                      <div className="absolute inset-0 flex items-center justify-center bg-purple-600/20">
                        <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Color removal */}
        <section className="space-y-3 pt-3 border-t border-zinc-900">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mr-auto">Kleur verwijderen</h3>
            <Pencil size={12} className="text-cyan-400" />
            <button
              onClick={onPickColor}
              className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-tight transition-all ${
                isPickingColor
                  ? 'bg-cyan-600 border-cyan-400 text-white ring-2 ring-cyan-400/40'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
              }`}
              title="Klik daarna op een pixel in de preview (Esc = annuleren)"
            >
              {isPickingColor ? 'Klik…' : 'Kies pixel'}
            </button>
            <input
              type="color"
              value={settings.pickedColor || '#000000'}
              onChange={(e) => updateSetting('pickedColor', e.target.value)}
              className="w-8 h-7 rounded-md bg-zinc-950 border border-zinc-800 cursor-pointer"
              title="Of kies handmatig"
            />
          </div>
          {isPickingColor && (
            <p className="text-[9px] text-cyan-300 leading-tight -mt-1">
              Klik nu op een achtergrondpixel in de preview. Druk Esc om te annuleren.
            </p>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
              <span>Tolerantie</span>
              <span className="text-purple-400 font-mono">{settings.colorTolerance}</span>
            </div>
            <input
              type="range" min={0} max={100} value={settings.colorTolerance}
              onChange={(e) => updateSetting('colorTolerance', parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => updateSetting('colorMode', 'connected')}
              className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase ${settings.colorMode === 'connected' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >Vanaf rand</button>
            <button
              onClick={() => updateSetting('colorMode', 'all')}
              className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase ${settings.colorMode === 'all' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >Alle pixels</button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.colorSoftEdge}
              onChange={(e) => updateSetting('colorSoftEdge', e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">Zachte rand (anti-alias)</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onApplyColorRemoval}
              disabled={removalState.active || !settings.pickedColor || frames.length === 0}
              className="py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-tight disabled:opacity-40 disabled:grayscale active:scale-95"
            >
              Toepassen
            </button>
            <button
              onClick={onAutoColorRemoval}
              disabled={removalState.active || frames.length === 0}
              className="py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] font-black uppercase tracking-tight hover:border-purple-500 disabled:opacity-40"
              title="Gemini bepaalt kleur + tolerantie per frame en past chroma-key toe"
            >
              Auto (AI)
            </button>
          </div>
          <p className="text-[8px] text-zinc-600 leading-tight">
            Werkt op {selectedIds.size > 0 ? `${selectedIds.size} geselecteerde` : focusedFrameId ? '1 actief' : '0'} frame{selectedIds.size === 1 || (!selectedIds.size && focusedFrameId) ? '' : 's'}.
          </p>
        </section>

        {/* Edge refine */}
        <section className="space-y-3 pt-3 border-t border-zinc-900">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Rand verfijnen</h3>
            <span className="text-[9px] font-mono text-purple-400">{settings.edgeStrength}px</span>
          </div>
          <input
            type="range" min={1} max={3} value={settings.edgeStrength}
            onChange={(e) => updateSetting('edgeStrength', parseInt(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onEdgeOp('erode')}
              disabled={edgeBusy || frames.length === 0}
              className="py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] font-bold uppercase hover:border-purple-500 disabled:opacity-40"
              title="Vreet vuile achtergrondrandjes weg"
            >
              Rand krimpen
            </button>
            <button
              onClick={() => onEdgeOp('dilate')}
              disabled={edgeBusy || frames.length === 0}
              className="py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] font-bold uppercase hover:border-purple-500 disabled:opacity-40"
              title="Herstelt te agressief weggesneden sprites"
            >
              Rand uitbreiden
            </button>
            <button
              onClick={() => onEdgeOp('feather')}
              disabled={edgeBusy || frames.length === 0}
              className="py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] font-bold uppercase hover:border-purple-500 disabled:opacity-40"
              title="Verzacht alpha rand (niet voor pixelart)"
            >
              Rand verzachten
            </button>
            <button
              onClick={() => onEdgeOp('decontaminate')}
              disabled={edgeBusy || frames.length === 0 || !settings.pickedColor}
              className="py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[10px] font-bold uppercase hover:border-purple-500 disabled:opacity-40"
              title="Verwijdert achtergrondkleurzweem uit randpixels (kies eerst kleur)"
            >
              Halo weg
            </button>
          </div>
          <p className="text-[8px] text-zinc-600 leading-tight">Werkt op selectie. Stapelbaar via Undo/Redo.</p>
        </section>

        {/* Packing & Optimization */}
        <section className="space-y-4 pt-4 border-t border-zinc-900">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inpakken & Optimalisatie</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => updateSetting('packingMethod', 'grid')}
              className={`p-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${settings.packingMethod === 'grid' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
            >
              Grid (Raster)
            </button>
            <button 
              onClick={() => updateSetting('packingMethod', 'bin')}
              className={`p-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${settings.packingMethod === 'bin' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
            >
              Smart (Bin)
            </button>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer group pt-2 border-t border-zinc-900">
              <input 
                type="checkbox" 
                checked={settings.trimSprites}
                onChange={(e) => updateSetting('trimSprites', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">Automatisch Bijsnijden (Trim)</span>
            </label>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={settings.powerOfTwo}
                  onChange={(e) => updateSetting('powerOfTwo', e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">POT</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={settings.forceSquare}
                  onChange={(e) => updateSetting('forceSquare', e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-900 text-purple-500 focus:ring-purple-500"
                />
                <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200">Vierkant</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                <span>Max Sheet Size</span>
                <span className="text-zinc-300 font-mono">{settings.maxWidth}x{settings.maxHeight}</span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
                {[512, 1024, 2048, 4096].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      updateSetting('maxWidth', size);
                      updateSetting('maxHeight', size);
                    }}
                    className={`flex-none px-2 py-1 rounded text-[9px] font-mono border transition-all ${settings.maxWidth === size ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-auto p-4 border-t border-zinc-800 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Padding (Afstand)</span>
            <span className="text-purple-400 font-mono">{settings.padding}px</span>
          </div>
          <input 
            type="range" 
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            min="0"
            max="32"
            value={settings.padding}
            onChange={(e) => updateSetting('padding', parseInt(e.target.value))}
          />
          <p className="text-[8px] text-zinc-600 leading-tight">Witruimte tussen frames (voorkomt vlekschade/bleeding).</p>
        </div>
      </div>
    </div>
  );
}
