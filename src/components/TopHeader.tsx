import React from 'react';
import { Undo2, Redo2, Zap } from 'lucide-react';

interface TopHeaderProps {
  activeView: string;
  onViewChange: (view: any) => void;
  steps: any[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onShowExport: () => void;
  onStartOver: () => void;
  stats?: { savings: number; mbSaved: string } | null;
}

export function TopHeader({
  activeView,
  onViewChange,
  steps,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onShowExport,
  onStartOver,
  stats,
}: TopHeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-800 flex items-center px-0 bg-zinc-950 backdrop-blur-xl z-[100] flex-none">
      <div className="flex items-center w-80 px-4 shrink-0 border-r border-zinc-800 h-full">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
          <span className="text-purple-500">SpriteMaster</span>
          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 uppercase tracking-widest">V5</span>
        </h1>
      </div>

      <div className="flex-1 flex items-center justify-between px-0">
        <div className="flex items-center gap-1 ml-8">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mr-2">
            <button 
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-colors ${canUndo ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'text-zinc-800 cursor-not-allowed'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors ${canRedo ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white' : 'text-zinc-800 cursor-not-allowed'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/50">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = activeView === step.id;
              const isExport = step.id === 'export';
              const isNew = step.id === 'new';

              return (
                <button 
                  key={step.id}
                  onClick={() => {
                    if (isNew) onStartOver();
                    else if (isExport) onShowExport();
                    else onViewChange(step.id);
                  }}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all
                    ${isActive 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                      : isExport 
                        ? 'text-emerald-500 hover:bg-emerald-500/10'
                        : isNew
                          ? 'text-zinc-500 hover:text-zinc-200'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }
                  `}
                >
                  <Icon size={14} />
                  <span className="hidden lg:block">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {stats && (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <Zap size={14} className="text-emerald-500/50" />
            <div className="flex flex-col leading-none">
              <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-tighter">VRAM Saved</span>
              <span className="text-[11px] font-mono font-bold text-emerald-400">{stats.mbSaved} MB</span>
            </div>
            <div className="w-[1px] h-4 bg-emerald-500/10 mx-1" />
            <span className="text-[10px] font-mono text-emerald-500 font-black">+{stats.savings}%</span>
          </div>
        )}
      </div>
    </header>
  );
}
