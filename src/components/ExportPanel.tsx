import React, { useState } from 'react';
import { Download, FileJson, Archive, LayoutGrid, Settings2, Sparkles, X, ArrowRight } from 'lucide-react';
import { Frame, SpriteSheetSettings, Manifest, AnimationChapter } from '../types';
import JSZip from 'jszip';
import { isPowerOfTwo, generateSpriteSheet } from '../utils';

interface ExportPanelProps {
  frames: Frame[];
  settings: SpriteSheetSettings;
  chapters: AnimationChapter[];
  onSettingsChange: (s: SpriteSheetSettings) => void;
  onBack: () => void;
}

export function ExportPanel({ frames, settings, chapters, onSettingsChange, onBack }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const getChapterForFrame = (frameId: string) => {
    for (const chapter of chapters) {
      if (chapter.frameIds.includes(frameId)) return { chapter: chapter.name };
    }
    return null;
  };

  const handleDownloadPNG = async () => {
    setIsExporting(true);
    const result = await generateSpriteSheet(frames, settings);
    if (result.url) {
      const link = document.createElement('a');
      link.download = 'spritesheet.png';
      link.href = result.url;
      link.click();
    }
    setIsExporting(false);
  };

  const handleDownloadJSON = async () => {
    setIsExporting(true);
    const result = await generateSpriteSheet(frames, settings);
    
    const manifestFrames: any = settings.exportFormat === 'phaser' ? [] : {};
    const results = result.multipleResults || [result.packedData];

    results.forEach((res, sheetIndex) => {
      const imgName = `spritesheet_${sheetIndex}.png`;
      res.frames.forEach((pf: any) => {
        const filename = `frame_${String(pf.index).padStart(4, '0')}.png`;
        const isTrimmed = !!pf.trimmedBox && settings.trimSprites;
        
        const chapterInfo = getChapterForFrame(pf.id);
        
        const frameData = {
          filename,
          frame: { x: pf.x, y: pf.y, w: isTrimmed ? pf.trimmedBox.w : settings.frameSize.width, h: isTrimmed ? pf.trimmedBox.h : settings.frameSize.height },
          rotated: false,
          trimmed: isTrimmed,
          spriteSourceSize: isTrimmed ? { x: pf.trimmedBox.x, y: pf.trimmedBox.y, w: pf.trimmedBox.w, h: pf.trimmedBox.h } : { x: 0, y: 0, w: settings.frameSize.width, h: settings.frameSize.height },
          sourceSize: { w: settings.frameSize.width, h: settings.frameSize.height },
          pivot: settings.anchor === 'custom' ? settings.customPivot : { x: 0.5, y: 0.5 },
          duration: Math.round((1000 / settings.fps) * (pf.durationMultiplier || 1)),
          texture: isMultipack ? imgName : undefined,
          ...chapterInfo
        };

        if (Array.isArray(manifestFrames)) {
          manifestFrames.push(frameData);
        } else {
          const { filename: _, ...rest } = frameData;
          manifestFrames[filename] = rest;
        }
      });
    });

    const manifest: Manifest = {
      frames: manifestFrames,
      meta: {
        app: "SpriteMaster V4",
        version: "4.0.0",
        image: isMultipack ? "spritesheet_0.png" : "spritesheet.png",
        format: "RGBA8888",
        size: { w: results[0].width, h: results[0].height },
        scale: "1",
        fps: settings.fps,
        frameWidth: settings.frameSize.width,
        frameHeight: settings.frameSize.height,
        pivot: settings.anchor === 'custom' ? settings.customPivot : { x: 0.5, y: 0.5 }
      }
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    if (blob) {
      const link = document.createElement('a');
      link.download = 'spritesheet.json';
      link.href = URL.createObjectURL(blob);
      link.click();
    }
    setIsExporting(false);
  };

  const handleDownloadZIP = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    const folder = zip.folder('frames');

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const filename = `frame_${String(i).padStart(4, '0')}.png`;
      folder?.file(filename, frame.blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    if (content) {
      const link = document.createElement('a');
      link.download = 'frames.zip';
      link.href = URL.createObjectURL(content);
      link.click();
    }
    setIsExporting(false);
  };

  const getEstimate = () => {
    let packedResults = [];
    if (settings.packingMethod === 'grid') {
      const cellWidth = settings.frameSize.width + settings.padding * 2;
      const cellHeight = settings.frameSize.height + settings.padding * 2;
      const colsPerSheet = Math.floor(settings.maxWidth / cellWidth);
      const rowsPerSheet = Math.floor(settings.maxHeight / cellHeight);
      const framesPerSheet = colsPerSheet * rowsPerSheet || 1;
      const numSheets = Math.ceil(frames.length / framesPerSheet);
      for (let i = 0; i < numSheets; i++) {
        packedResults.push({
          w: Math.min(colsPerSheet * cellWidth, settings.maxWidth),
          h: Math.min(rowsPerSheet * cellHeight, settings.maxHeight)
        });
      }
    } else {
      const sorted = [...frames].sort((a,b) => (b.trimmedBox?.h || b.originalHeight) - (a.trimmedBox?.h || a.originalHeight));
      let curX = 0; let curY = 0; let shelfH = 0; let sheetW = 0; let sheetH = 0;
      let sheetFramesCount = 0;
      for (let i = 0; i < sorted.length; i++) {
        const f = sorted[i];
        const fw = (f.trimmedBox?.w || f.originalWidth) + settings.padding * 2;
        const fh = (f.trimmedBox?.h || f.originalHeight) + settings.padding * 2;
        
        if (curX + fw > settings.maxWidth) {
          curX = 0; curY += shelfH; shelfH = 0;
        }

        if (curY + fh > settings.maxHeight) {
          // Start new sheet estimate
          packedResults.push({ w: sheetW, h: sheetH });
          curX = 0; curY = 0; shelfH = 0; sheetW = 0; sheetH = 0;
        }

        curX += fw;
        shelfH = Math.max(shelfH, fh);
        sheetW = Math.max(sheetW, curX);
        sheetH = Math.max(sheetH, curY + shelfH);
        sheetFramesCount++;
      }
      if (sheetFramesCount > 0) packedResults.push({ w: sheetW, h: sheetH });
    }

    return packedResults.map(p => {
      let w = p.w; let h = p.h;
      if (settings.powerOfTwo) {
        w = isPowerOfTwo(w) ? w : Math.pow(2, Math.ceil(Math.log2(w)));
        h = isPowerOfTwo(h) ? h : Math.pow(2, Math.ceil(Math.log2(h)));
      }
      if (settings.forceSquare) {
        const s = Math.max(w, h);
        w = s; h = s;
        if (settings.powerOfTwo) {
          const p2 = isPowerOfTwo(s) ? s : Math.pow(2, Math.ceil(Math.log2(s)));
          w = p2; h = p2;
        }
      }
      return { w: Math.min(w, settings.maxWidth), h: Math.min(h, settings.maxHeight) };
    });
  };

  const estimates = getEstimate();
  const mainEstimate = estimates[0] || { w: 0, h: 0 };
  const isMultipack = estimates.length > 1;

  const handleFormatChange = (format: SpriteSheetSettings['exportFormat']) => {
    onSettingsChange({ ...settings, exportFormat: format });
  };

  const handleDownloadAll = async () => {
    setIsExporting(true);
    const result = await generateSpriteSheet(frames, settings);
    if (!result.multipleResults) {
      setIsExporting(false);
      return;
    }

    const zip = new JSZip();
    const manifestFrames: any = settings.exportFormat === 'phaser' ? [] : {};

    result.multipleResults.forEach((res, sheetIndex) => {
      const imgName = `spritesheet_${sheetIndex}.png`;
      zip.file(imgName, res.blob);

      res.frames.forEach((pf, i) => {
        const filename = `frame_${String(pf.index).padStart(4, '0')}.png`;
        const isTrimmed = !!pf.trimmedBox && settings.trimSprites;
        const chapterInfo = getChapterForFrame(pf.id);
        
        const frameData = {
          filename,
          frame: { x: pf.x, y: pf.y, w: isTrimmed ? pf.trimmedBox.w : settings.frameSize.width, h: isTrimmed ? pf.trimmedBox.h : settings.frameSize.height },
          rotated: false,
          trimmed: isTrimmed,
          spriteSourceSize: isTrimmed ? { x: pf.trimmedBox.x, y: pf.trimmedBox.y, w: pf.trimmedBox.w, h: pf.trimmedBox.h } : { x: 0, y: 0, w: settings.frameSize.width, h: settings.frameSize.height },
          sourceSize: { w: settings.frameSize.width, h: settings.frameSize.height },
          pivot: settings.anchor === 'custom' ? settings.customPivot : { x: 0.5, y: 0.5 },
          duration: Math.round((1000 / settings.fps) * (pf.durationMultiplier || 1)),
          texture: imgName,
          ...chapterInfo
        };

        if (Array.isArray(manifestFrames)) {
          manifestFrames.push(frameData);
        } else {
          const { filename: _, ...rest } = frameData;
          manifestFrames[filename] = rest;
        }
      });
    });

    const manifest = {
      frames: manifestFrames,
      meta: {
        app: "SpriteMaster V4",
        version: "4.0.0",
        format: "RGBA8888",
        scale: "1",
        smartUpdate: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        pivot: settings.anchor === 'custom' ? settings.customPivot : { x: 0.5, y: 0.5 }
      }
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const content = await zip.generateAsync({ type: 'blob' });
    if (content) {
      const link = document.createElement('a');
      link.download = 'spritesheet_pack.zip';
      link.href = URL.createObjectURL(content);
      link.click();
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-12 py-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-16 h-16 bg-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-600/30">
          <Download size={32} className="text-white" />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight text-white uppercase">Export Center</h2>
          <p className="text-zinc-500 text-sm font-medium">Configureer en download je spritesheets voor gebruik in games.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1 flex items-center gap-2">
              <Settings2 size={12} /> Target Engine / Format
            </h3>
            <div className="grid grid-cols-2 gap-3 bg-black/40 p-2 rounded-2xl border border-zinc-800/50">
              <button 
                onClick={() => handleFormatChange('generic')}
                className={`flex flex-col items-center justify-center py-6 rounded-xl border transition-all gap-2 ${settings.exportFormat === 'generic' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
              >
                <Archive size={20} />
                <span className="text-xs font-black uppercase tracking-tight">JSON Hash</span>
                <span className="text-[9px] opacity-60">Generic / Web</span>
              </button>
              <button 
                onClick={() => handleFormatChange('phaser')}
                className={`flex flex-col items-center justify-center py-6 rounded-xl border transition-all gap-2 ${settings.exportFormat === 'phaser' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
              >
                <Archive size={20} className="rotate-180" />
                <span className="text-xs font-black uppercase tracking-tight">JSON Array</span>
                <span className="text-[9px] opacity-60">Phaser / Unity</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-zinc-500">
                <LayoutGrid size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sheet Info</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Grootte</span>
                  <span className="text-purple-400 font-mono font-bold">
                    {isMultipack ? `${estimates.length} Sheets` : `${mainEstimate.w}x${mainEstimate.h}`}
                  </span>
                </div>
                {isMultipack && (
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Multipack</span>
                    <span className="text-orange-500 font-black uppercase tracking-tighter">Actief</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Methode</span>
                  <span className="text-zinc-300 font-mono capitalize">{settings.packingMethod === 'bin' ? 'Smart (Bin)' : 'Grid (Raster)'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">POT Status</span>
                  <span className={`font-mono ${settings.powerOfTwo ? 'text-green-500' : 'text-zinc-500'}`}>
                    {settings.powerOfTwo ? 'Geforceerd' : 'Auto'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-zinc-500">
                <Settings2 size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Optimalisatie</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Bijsnijden</span>
                  <span className={settings.trimSprites ? 'text-green-500 font-bold' : 'text-zinc-500'}>{settings.trimSprites ? 'Aan' : 'Uit'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Padding</span>
                  <span className="text-zinc-300 font-mono">{settings.padding}px</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Totaal Frames</span>
                  <span className="text-zinc-300 font-mono">{frames.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 flex flex-col justify-center">
          <div className="space-y-3">
            {isMultipack ? (
              <button
                onClick={handleDownloadAll}
                disabled={isExporting}
                className="w-full py-6 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900 text-white rounded-2xl font-black uppercase tracking-tight flex items-center justify-center gap-4 shadow-2xl shadow-orange-600/30 transition-all active:scale-[0.98] text-lg"
              >
                {isExporting ? <Loader2 className="animate-spin" size={24} /> : <Archive size={24} />}
                Download Multipack (ZIP)
              </button>
            ) : (
              <button
                onClick={handleDownloadPNG}
                disabled={isExporting}
                className="w-full py-6 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 text-white rounded-2xl font-black uppercase tracking-tight flex items-center justify-center gap-4 shadow-2xl shadow-purple-600/30 transition-all active:scale-[0.98] text-lg"
              >
                {isExporting ? <Loader2 className="animate-spin" size={24} /> : <Download size={24} />}
                Download Spritesheet (PNG)
              </button>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadJSON}
                disabled={isExporting}
                className="py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={16} /> : <FileJson size={16} className="text-purple-500" />}
                JSON Manifest
              </button>
              <button
                onClick={handleDownloadZIP}
                disabled={isExporting}
                className="py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <Archive size={16} className="text-purple-500" />
                Raw Frames (ZIP)
              </button>
            </div>
          </div>
          
          <div className="bg-purple-900/10 border border-purple-500/20 p-6 rounded-2xl space-y-4">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center shrink-0">
                 <Sparkles className="text-purple-400" size={20} />
               </div>
               <div className="space-y-1">
                 <h4 className="text-xs font-bold text-white uppercase tracking-tight">Klaar voor gebruik?</h4>
                 <p className="text-[10px] text-zinc-400 leading-relaxed">
                   Vergeet niet je frames te analyseren en uit te lijnen in de <span className="text-purple-400 font-bold italic">Analyze & Align</span> tab voordat je exporteert.
                 </p>
               </div>
             </div>
             <button
              onClick={onBack}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/5"
            >
              <ArrowRight size={14} className="rotate-180" />
              Terug naar Editor
            </button>
          </div>
        </div>
      </div>

      <div className="pt-12 border-t border-zinc-900">
        <p className="text-[10px] text-zinc-600 text-center leading-relaxed font-medium uppercase tracking-[0.2em] opacity-50">
          Powered by Browser-Side Extraction & Processing<br/>
          No Server Required • Privacy First • 100% Client Side
        </p>
      </div>
    </div>
  );
}

function Loader2({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
