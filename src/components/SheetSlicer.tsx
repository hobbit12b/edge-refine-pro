import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Grid, LayoutGrid, ArrowRight, X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Frame } from '../types';

interface SheetSlicerProps {
  file: File;
  onSliced: (frames: Frame[]) => void;
  onCancel: () => void;
}

export function SheetSlicer({ file, onSliced, onCancel }: SheetSlicerProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cols, setCols] = useState(8);
  const [rows, setRows] = useState(4);
  const [frameWidth, setFrameWidth] = useState(0);
  const [frameHeight, setFrameHeight] = useState(0);
  const [mode, setMode] = useState<'grid' | 'size'>('grid');
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log("SheetSlicer: Loading file via FileReader", file.name, file.size);
    
    // Safety timeout to prevent infinite hanging
    const timeout = setTimeout(() => {
      if (!image) {
        console.error("SheetSlicer: Loading timed out after 5s");
        onCancel();
      }
    }, 5000);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        console.error("SheetSlicer: FileReader result is empty");
        onCancel();
        return;
      }

      const img = new Image();
      img.onload = () => {
        clearTimeout(timeout);
        console.log("SheetSlicer: Image loaded via FileReader", img.width, "x", img.height);
        setImage(img);
        setCols(1);
        setRows(1);
        setFrameWidth(img.width);
        setFrameHeight(img.height);
      };
      img.onerror = (err) => {
        clearTimeout(timeout);
        console.error("SheetSlicer: Image object error", err);
        onCancel();
      };
      img.src = dataUrl;
    };
    reader.onerror = (err) => {
      clearTimeout(timeout);
      console.error("SheetSlicer: FileReader error", err);
      onCancel();
    };
    reader.readAsDataURL(file);

    return () => {
      clearTimeout(timeout);
      console.log("SheetSlicer: Unmounting/Cleaning up");
    };
  }, [file]);

  const handleSlice = async () => {
    if (!image) return;

    const frames: Frame[] = [];
    const w = Math.round(mode === 'grid' ? image.width / (cols || 1) : (frameWidth || 1));
    const h = Math.round(mode === 'grid' ? image.height / (rows || 1) : (frameHeight || 1));
    const finalCols = mode === 'grid' ? cols : Math.floor(image.width / (frameWidth || 1));
    const finalRows = mode === 'grid' ? rows : Math.floor(image.height / (frameHeight || 1));

    for (let y = 0; y < finalRows; y++) {
      for (let x = 0; x < finalCols; x++) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, x * w, y * h, w, h, 0, 0, w, h);
          const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));
          frames.push({
            id: crypto.randomUUID(),
            index: frames.length,
            url: canvas.toDataURL(),
            blob: blob,
            originalWidth: w,
            originalHeight: h,
            offset: { x: 0, y: 0 },
            durationMultiplier: 1
          });
        }
      }
    }
    onSliced(frames);
  };

  if (!image) return (
    <div key="loading-image" className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Afbeelding laden...</span>
      </div>
    </div>
  );

  const currentW = mode === 'grid' ? image.width / (cols || 1) : (frameWidth || 1);
  const currentH = mode === 'grid' ? image.height / (rows || 1) : (frameHeight || 1);
  const displayCols = mode === 'grid' ? cols : Math.floor(image.width / (frameWidth || 1));
  const displayRows = mode === 'grid' ? rows : Math.floor(image.height / (frameHeight || 1));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
            <X size={20} />
          </button>
          <div className="h-6 w-px bg-zinc-800" />
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Scissors size={20} className="text-purple-500" />
            Slice Spritesheet
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-lg border border-zinc-700 mr-4">
             <button 
              onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
              className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] font-mono font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
              className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button
            onClick={handleSlice}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20"
          >
            Import Frames <ArrowRight size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <div className="w-80 border-r border-zinc-800 bg-zinc-900/20 p-6 flex flex-col gap-8">
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Slicing Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setMode('grid')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'grid' ? 'bg-purple-600/10 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
              >
                <Grid size={20} />
                <span className="text-[10px] font-bold">Rows & Cols</span>
              </button>
              <button 
                onClick={() => setMode('size')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'size' ? 'bg-purple-600/10 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
              >
                <LayoutGrid size={20} />
                <span className="text-[10px] font-bold">Frame Size</span>
              </button>
            </div>
          </section>

          {mode === 'grid' ? (
            <section className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Columns</span>
                  <span className="text-purple-400">{cols}</span>
                </div>
                <input 
                  type="range" min="1" max="32" value={cols} 
                  onChange={(e) => {
                    const c = parseInt(e.target.value);
                    setCols(c);
                    setFrameWidth(Math.floor(image.width / c));
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Rows</span>
                  <span className="text-purple-400">{rows}</span>
                </div>
                <input 
                  type="range" min="1" max="32" value={rows} 
                  onChange={(e) => {
                    const r = parseInt(e.target.value);
                    setRows(r);
                    setFrameHeight(Math.floor(image.height / r));
                  }}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Width (px)</span>
                  <input 
                    type="number" value={frameWidth}
                    onChange={(e) => setFrameWidth(parseInt(e.target.value) || 0)}
                    className="bg-transparent text-purple-400 font-mono w-16 text-right outline-none"
                  />
                </div>
                <input 
                  type="range" min="8" max={image.width} value={frameWidth} 
                  onChange={(e) => setFrameWidth(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Height (px)</span>
                  <input 
                    type="number" value={frameHeight}
                    onChange={(e) => setFrameHeight(parseInt(e.target.value) || 0)}
                    className="bg-transparent text-purple-400 font-mono w-16 text-right outline-none"
                  />
                </div>
                <input 
                  type="range" min="8" max={image.height} value={frameHeight} 
                  onChange={(e) => setFrameHeight(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </section>
          )}

          <div className="mt-auto p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
            <p className="text-[10px] text-purple-300 leading-relaxed">
              Detected Total: <span className="font-bold">{displayCols * displayRows} frames</span><br/>
              Size: {Math.round(currentW)} x {Math.round(currentH)} px per frame
            </p>
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 bg-[#050505] overflow-auto custom-scrollbar p-12 checkerboard">
          <div 
            className="relative mx-auto border-2 border-zinc-800 shadow-2xl transition-transform origin-top-left bg-zinc-900"
            style={{ 
              width: image.width, 
              height: image.height,
              transform: `scale(${zoom})`,
              imageRendering: 'pixelated'
            }}
          >
            <img 
              src={image.src} 
              alt="Sheet" 
              className="w-full h-full block" 
            />
            
            {/* Slicing Grid */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(168, 85, 247, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(168, 85, 247, 0.5) 1px, transparent 1px)`,
                backgroundSize: `${currentW}px ${currentH}px`
              }}
            />

            {/* Labels */}
            {Array.from({ length: Math.min(32, displayRows) }).map((_, r) => (
              Array.from({ length: Math.min(32, displayCols) }).map((_, c) => (
                <div 
                  key={`${r}-${c}`}
                  className="absolute text-[8px] font-mono text-purple-400 opacity-40 bg-purple-900/20 px-1 rounded"
                  style={{
                    left: c * currentW + 5,
                    top: r * currentH + 5
                  }}
                >
                  {r * displayCols + c}
                </div>
              ))
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
