import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Frame, SpriteSheetSettings } from '../types';
import { Pencil, RotateCcw, Eraser, WandSparkles, Lasso, LassoSelect, Magnet, Ghost } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface FrameManualEditorProps {
  frame: Frame;
  originalFrame: Frame;
  settings: SpriteSheetSettings;
  onSettingsChange: (settings: SpriteSheetSettings) => void;
  onUpdate: (id: string, newBlob: Blob) => void;
  visualScale: number;
}

export function FrameManualEditor({
  frame,
  originalFrame,
  settings,
  onSettingsChange,
  onUpdate,
  visualScale
}: FrameManualEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const isSpacePressedRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [localOffset, setLocalOffset] = useState(settings.offset);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [guidePos, setGuidePos] = useState<{ x: number; y: number } | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [areaMode, setAreaMode] = useState<'wand' | null>(null);
  const prevFrameIdRef = useRef(frame.id);
  const actionGroupRef = useRef<HTMLDivElement>(null);
  const [actionGroupWidth, setActionGroupWidth] = useState(0);
  const { toast } = useToast();
  const toolbarGroupGap = 16;

  useEffect(() => {
    const node = actionGroupRef.current;
    if (!node) return;

    const updateWidth = () => setActionGroupWidth(node.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const renderPreview = useCallback(() => {
    if (!canvasRef.current || !maskCanvasRef.current || !originalImage) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Use a temporary canvas to draw the masked result so it doesn't clip the ghosted background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Redraw scene
    ctx.clearRect(0, 0, width, height);

    // 1. Draw original image with ghosting effect if requested
    if (settings.showGhost) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.drawImage(originalImage, 0, 0, width, height);
      ctx.restore();
    }

    // 2. Draw the main result (masked) into a temp canvas first
    tempCtx.drawImage(originalImage, 0, 0, width, height);
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(maskCanvasRef.current, 0, 0);

    // 3. Draw the masked result on top of ghosted background
    ctx.drawImage(tempCanvas, 0, 0);

    // Lasso path visualization - Only for lasso modes
    const isLassoMode = settings.interactionMode === 'lasso' || settings.interactionMode === 'poly-lasso' || settings.interactionMode === 'magnetic-lasso';
    if (isLassoMode && (points.length > 0 || guidePos)) {
      ctx.save();
      
      const fillPath = new Path2D();
      if (points.length > 0) {
        fillPath.moveTo(points[0].x, points[0].y);
        points.forEach(p => fillPath.lineTo(p.x, p.y));
        if (guidePos && settings.interactionMode === 'poly-lasso') {
          fillPath.lineTo(guidePos.x, guidePos.y);
        }
        fillPath.closePath();
      }

      // 1. Draw the area shading
      const canClose = (settings.interactionMode === 'poly-lasso' ? (points.length >= 2 && guidePos) || points.length >= 3 : points.length >= 3);
      if (canClose && points.length > 0) {
        ctx.fillStyle = settings.brushMode === 'erase' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)';
        ctx.fill(fillPath, 'evenodd');
      }
      
      // 2. Draw the path line (marching ants animated)
      ctx.beginPath();
      if (points.length > 0) {
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      if (settings.interactionMode === 'poly-lasso' && guidePos) {
        if (points.length === 0) ctx.moveTo(guidePos.x, guidePos.y);
        else ctx.lineTo(guidePos.x, guidePos.y);
      }
      
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      
      // Animated dashed line
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      const timeOffset = (Date.now() / 40) % 8;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -timeOffset;
      ctx.stroke();

      // Start point highlight for poly lasso
      if (settings.interactionMode === 'poly-lasso' && points.length > 0) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }, [originalImage, points, guidePos, settings.interactionMode, settings.brushMode, settings.showGhost]);

  // Animation trigger for marching ants
  useEffect(() => {
    let animId: number;
    const animate = () => {
      renderPreview();
      animId = requestAnimationFrame(animate);
    };
    const isLassoMode = settings.interactionMode === 'lasso' || settings.interactionMode === 'poly-lasso' || settings.interactionMode === 'magnetic-lasso';
    if (isLassoMode && (points.length > 0 || guidePos)) {
      animId = requestAnimationFrame(animate);
    } else {
      // Force one render frame to ensure everything is visible even if not in lasso mode
      renderPreview();
    }
    return () => cancelAnimationFrame(animId);
  }, [points.length, guidePos, renderPreview, settings.interactionMode, isReady]);

  const saveToParent = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !originalImage) return;

    // Create a clean result for saving (Original + Mask, NO UI OVERLAYS)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskCanvas.width;
    tempCanvas.height = maskCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(originalImage, 0, 0);
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(maskCanvas, 0, 0);
      
      tempCanvas.toBlob((blob) => {
        if (blob) onUpdate(frame.id, blob);
      }, 'image/png');
    }
  }, [frame.id, onUpdate, originalImage]);

  // Initialize canvases and images
  const prevUrlRef = useRef(frame?.url);
  useEffect(() => {
    if (!frame || !originalFrame || !frame.url || !originalFrame.url) return;
    // Re-initialize if frame ID or URL changes (URL changes on undo/redo)
    if (originalImage && frame.id === prevFrameIdRef.current && frame.url === prevUrlRef.current) return;
    
    setIsReady(false); // Reset readiness
    prevFrameIdRef.current = frame.id;
    prevUrlRef.current = frame.url;

    const origImg = new Image();
    origImg.crossOrigin = 'anonymous';
    origImg.src = originalFrame.url;
    origImg.onload = () => setOriginalImage(origImg);

    const currImg = new Image();
    currImg.crossOrigin = 'anonymous';
    currImg.src = frame.url;
    currImg.onload = () => {
      setCurrentImage(currImg);
      if (maskCanvasRef.current && canvasRef.current) {
        const maskCanvas = maskCanvasRef.current;
        const canvas = canvasRef.current;
        canvas.width = originalFrame.originalWidth;
        canvas.height = originalFrame.originalHeight;
        maskCanvas.width = originalFrame.originalWidth;
        maskCanvas.height = originalFrame.originalHeight;

        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          maskCtx.drawImage(currImg, 0, 0);
          maskCtx.globalCompositeOperation = 'source-in';
          maskCtx.fillStyle = 'white';
          maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
        renderPreview();
        setIsReady(true);
      }
    };
  }, [frame.url, originalFrame.url, frame.id, renderPreview, settings.frameSize.width, settings.frameSize.height]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }
      
      if (e.code === 'Escape') {
        if (areaMode) {
          e.preventDefault();
          e.stopPropagation();
          setAreaMode(null);
          return;
        }
        if (points.length > 0 || guidePos) {
          e.preventDefault();
          e.stopPropagation();
          setPoints([]);
          setGuidePos(null);
          setIsDrawing(false);
          renderPreview();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [areaMode, points.length, guidePos, renderPreview]);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (settings.interactionMode === 'poly-lasso' && points.length > 2) {
      applyLassoMask();
      setPoints([]);
      setGuidePos(null);
      setIsDrawing(false);
      saveToParent();
      renderPreview();
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSpacePressedRef.current) {
      setIsPanning(true);
      setLastMousePos({ 
        x: 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX,
        y: 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
      });
      return;
    }
    if (areaMode) {
      const pos = getCanvasPos(e);
      const px = Math.round(pos.x);
      const py = Math.round(pos.y);
      (async () => {
        try {
          const { removeConnectedAreaFromBlob, restoreConnectedAreaFromOriginalBlob } = await import('@/services/imageProcessing');
          const newBlob = settings.brushMode === 'erase'
            ? await removeConnectedAreaFromBlob(frame.blob, px, py, settings.colorTolerance)
            : await restoreConnectedAreaFromOriginalBlob(frame.blob, originalFrame.blob, px, py, settings.colorTolerance);
          onUpdate(frame.id, newBlob);
          toast({
            title: settings.brushMode === 'erase' ? 'Verbonden vlak verwijderd' : 'Verbonden vlak hersteld',
            description: settings.brushMode === 'erase'
              ? 'Verbonden vlak is transparant gemaakt op het actieve frame.'
              : 'Verbonden vlak is hersteld vanaf het originele frame.',
          });
        } catch (err) {
          console.error('Area tool failed:', err);
          toast({
            title: 'Toverstaf bewerking mislukt',
            description: err instanceof Error ? err.message : 'Kon het geselecteerde vlak niet verwerken.',
            variant: 'destructive',
          });
        }
      })();
      return;
    }
    if (settings.interactionMode === 'none') return;
    const pos = getCanvasPos(e);

    if (settings.interactionMode === 'poly-lasso') {
      setIsDrawing(true);
      // Check if double click would happen or if manually closing
      if (points.length > 2) {
        const dist = Math.hypot(pos.x - points[0].x, pos.y - points[0].y);
        if (dist < 12) {
          applyLassoMask();
          setPoints([]);
          setGuidePos(null);
          setIsDrawing(false);
          saveToParent();
          renderPreview();
          return;
        }
      }
      setPoints([...points, pos]);
    } else {
      setIsDrawing(true);
      setPoints([pos]);
      if (settings.interactionMode === 'brush') {
        drawBrush(pos, pos);
      }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isPanning) {
      const deltaX = clientX - lastMousePos.x;
      const deltaY = clientY - lastMousePos.y;
      
      const newOffset = {
        x: localOffset.x + deltaX,
        y: localOffset.y + deltaY
      };
      setLocalOffset(newOffset);
      onSettingsChange({ ...settings, offset: newOffset });
      setLastMousePos({ x: clientX, y: clientY });
      return;
    }

    const pos = getCanvasPos(e);

    if (isDrawing) {
      if (settings.interactionMode === 'brush') {
        const lastPoint = points.length > 0 ? points[points.length - 1] : pos;
        drawBrush(lastPoint, pos);
        setPoints([...points, pos]);
      } else if (settings.interactionMode === 'lasso') {
        setPoints([...points, pos]);
      } else if (settings.interactionMode === 'magnetic-lasso') {
        const snappedPos = snapToEdge(pos);
        const last = points[points.length - 1];
        if (!last || Math.hypot(snappedPos.x - last.x, snappedPos.y - last.y) > 2) {
          setPoints([...points, snappedPos]);
        }
      } else if (settings.interactionMode === 'poly-lasso' && points.length > 0) {
        setGuidePos(pos);
      }
    } else if (settings.interactionMode === 'poly-lasso' && points.length > 0) {
      setGuidePos(pos);
    } else {
      setGuidePos(null);
    }
    renderPreview();
  };

  const snapToEdge = (pos: { x: number; y: number }) => {
    if (!originalImage) return pos;
    
    // Use a small temporary canvas to get original image data for better edge detection
    const tempCanvas = document.createElement('canvas');
    const radius = 16;
    tempCanvas.width = radius * 2;
    tempCanvas.height = radius * 2;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return pos;

    const x = Math.round(pos.x);
    const y = Math.round(pos.y);
    const startX = x - radius;
    const startY = y - radius;

    tempCtx.drawImage(originalImage, startX, startY, radius * 2, radius * 2, 0, 0, radius * 2, radius * 2);
    const imageData = tempCtx.getImageData(0, 0, radius * 2, radius * 2);
    const data = imageData.data;
    const width = radius * 2;
    const height = radius * 2;
    
    let maxGrad = -1;
    let bestX = pos.x;
    let bestY = pos.y;

    for (let j = 1; j < height - 1; j++) {
      for (let i = 1; i < width - 1; i++) {
        const idx = (j * width + i) * 4;
        
        const getV = (ox: number, oy: number) => {
          const ii = (oy * width + ox) * 4;
          const r = data[ii];
          const g = data[ii+1];
          const b = data[ii+2];
          const a = data[ii+3] / 255;
          return (r * 0.299 + g * 0.587 + b * 0.114) * a;
        };

        const gx = (getV(i+1, j) - getV(i-1, j));
        const gy = (getV(i, j+1) - getV(i, j-1));
        let grad = Math.sqrt(gx*gx + gy*gy);
        
        // Boost gradient at alpha boundaries (most important for sprites)
        const alpha = data[idx+3];
        const nextA = data[idx+7];
        const prevA = data[idx-1];
        const downA = data[idx + (width*4) + 3];
        const upA = data[idx - (width*4) + 3];
        const alphaDelta = Math.abs(alpha - nextA) + Math.abs(alpha - downA) + Math.abs(alpha - prevA) + Math.abs(alpha - upA);
        grad += alphaDelta * 1.5;

        const dx = i - radius;
        const dy = j - radius;
        const distSq = dx*dx + dy*dy;
        const weight = Math.exp(-distSq / (radius * 0.8)); 
        
        const score = grad * weight;

        if (score > maxGrad) {
          maxGrad = score;
          bestX = startX + i;
          bestY = startY + j;
        }
      }
    }
    
    if (maxGrad > 10) {
      const lerp = Math.min(0.8, maxGrad / 150);
      return {
        x: pos.x * (1 - lerp) + bestX * lerp,
        y: pos.y * (1 - lerp) + bestY * lerp
      };
    }
    return pos;
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    
    if (settings.interactionMode === 'lasso' || settings.interactionMode === 'magnetic-lasso') {
      applyLassoMask();
      setIsDrawing(false);
      setPoints([]);
    } else if (settings.interactionMode === 'brush') {
      setIsDrawing(false);
      setPoints([]);
      saveToParent();
    }
    // Poly lasso sticks until double click or manual close
    renderPreview();
  };

  const drawBrush = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    if (!maskCtx) return;

    maskCtx.lineJoin = 'round';
    maskCtx.lineCap = 'round';
    maskCtx.lineWidth = settings.brushSize ?? 2;
    
    if (settings.antiAlias) {
      maskCtx.shadowBlur = 1;
      maskCtx.shadowColor = settings.brushMode === 'erase' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
    } else {
      maskCtx.shadowBlur = 0;
    }

    if (settings.brushMode === 'erase') {
      maskCtx.globalCompositeOperation = 'destination-out';
    } else {
      maskCtx.globalCompositeOperation = 'source-over';
      maskCtx.strokeStyle = 'white';
    }

    maskCtx.beginPath();
    maskCtx.moveTo(from.x, from.y);
    maskCtx.lineTo(to.x, to.y);
    maskCtx.stroke();
  };

  const applyLassoMask = (manualPoints?: { x: number, y: number }[]) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    const targetPoints = manualPoints || points;
    
    if (!maskCtx || targetPoints.length < 3) return;

    maskCtx.save();
    
    // 1. Create the path
    const path = new Path2D();
    path.moveTo(targetPoints[0].x, targetPoints[0].y);
    for (let i = 1; i < targetPoints.length; i++) {
      path.lineTo(targetPoints[i].x, targetPoints[i].y);
    }
    path.closePath();

    // 2. Configure context for solid fill
    maskCtx.setLineDash([]);
    maskCtx.lineWidth = 0;
    maskCtx.shadowBlur = 0;
    maskCtx.lineJoin = 'miter';
    maskCtx.lineCap = 'butt';

    if (settings.brushMode === 'erase') {
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fillStyle = 'white'; 
      maskCtx.fill(path, 'evenodd');
    } else {
      maskCtx.globalCompositeOperation = 'source-over';
      maskCtx.fillStyle = 'white';
      maskCtx.fill(path, 'evenodd');
    }
    
    maskCtx.restore();
    
    setGuidePos(null);
    saveToParent();
    renderPreview();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900 shadow-xl z-20">
        <div className="inline-grid grid-cols-[auto_auto] gap-x-4 gap-y-2 items-start">
          <div ref={actionGroupRef} className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onSettingsChange({ ...settings, brushMode: 'erase' })}
              className={`p-1.5 rounded-lg flex items-center gap-2 px-4 transition-all ${settings.brushMode === 'erase' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Gum Mode (E)"
            >
              <Eraser size={14} />
              <span className="text-[10px] font-black uppercase tracking-tight">Gum</span>
            </button>
            <button
              onClick={() => onSettingsChange({ ...settings, brushMode: 'restore', showGhost: true })}
              className={`p-1.5 rounded-lg flex items-center gap-2 px-4 transition-all ${settings.brushMode === 'restore' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Herstel Mode (R)"
            >
              <RotateCcw size={14} />
              <span className="text-[10px] font-black uppercase tracking-tight">Herstel</span>
            </button>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {([
              { mode: 'brush', label: 'Penseel', Icon: Pencil, title: 'Penseel (B)' },
              { mode: 'lasso', label: 'Lasso', Icon: Lasso, title: 'Lasso (L)' },
              { mode: 'poly-lasso', label: 'Poly', Icon: LassoSelect, title: 'Veelhoek Lasso (P)' },
              { mode: 'magnetic-lasso', label: 'Magnetic', Icon: Magnet, title: 'Magnetische Lasso (M)' },
            ] as const).map(({ mode, label, Icon, title }) => (
              <button
                key={mode}
                onClick={() => {
                  setAreaMode(null);
                  onSettingsChange({ ...settings, interactionMode: settings.interactionMode === mode ? 'none' : mode });
                }}
                className={`p-1.5 rounded-lg flex items-center gap-1.5 px-3 transition-all ${settings.interactionMode === mode ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                title={title}
              >
                <Icon size={14} />
                <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setAreaMode(prev => prev === 'wand' ? null : 'wand');
                onSettingsChange({ ...settings, interactionMode: 'none' });
              }}
              className={`p-1.5 rounded-lg flex items-center gap-2 px-3 transition-all ${areaMode === 'wand' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Toverstaf: klik een verbonden vlak (Esc annuleert)"
            >
              <WandSparkles size={14} />
              <span className="text-[10px] font-black uppercase tracking-tight">Toverstaf</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div
          className="inline-grid items-center"
          style={{
            gridTemplateColumns: `${Math.max(actionGroupWidth, 0)}px minmax(0, 1fr)`,
            columnGap: `${toolbarGroupGap}px`
          }}
        >
          <div aria-hidden="true" />
          <div className="flex items-center gap-4">
            {(settings.interactionMode === 'brush') && (
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Grootte</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={settings.brushSize}
                    onChange={(e) => onSettingsChange({ ...settings, brushSize: parseInt(e.target.value) })}
                    className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <span className="text-[10px] text-zinc-300 font-mono font-bold w-8">{settings.brushSize}px</span>
                </div>
              </div>
            )}

            {areaMode === 'wand' && (
              <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Tolerantie</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.colorTolerance}
                  onChange={(e) => onSettingsChange({ ...settings, colorTolerance: parseInt(e.target.value) })}
                  className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-[10px] text-zinc-300 font-mono font-bold w-8">{settings.colorTolerance}</span>
              </div>
            )}

            <div className="h-6 w-px bg-zinc-800 mx-1" />
            <div className="flex items-center gap-4 px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${settings.antiAlias ? 'bg-purple-600 border-purple-500' : 'bg-zinc-800 border-zinc-700 group-hover:border-zinc-500'}`}>
                  {settings.antiAlias && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={settings.antiAlias}
                    onChange={(e) => onSettingsChange({ ...settings, antiAlias: e.target.checked })}
                  />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-zinc-200">Anti-Alias</span>
              </label>

              <button
                onClick={() => onSettingsChange({ ...settings, showGhost: !settings.showGhost })}
                className={`p-1.5 rounded-lg flex items-center gap-2 px-3 border transition-all ${settings.showGhost ? 'bg-zinc-100 text-black border-white' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                title="Ghosting Effect (T)"
              >
                <Ghost size={14} className={settings.showGhost ? 'opacity-100' : 'opacity-40'} />
                <span className="text-[9px] font-black uppercase tracking-tight">Ghosting</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className={`flex-1 relative flex items-center justify-center p-12 overflow-hidden ${
          settings.checkerboardMode === 'transparent' ? 'bg-black' : 
          settings.checkerboardMode === 'red' ? 'bg-red-900' :
          settings.checkerboardMode === 'green' ? 'bg-green-900' :
          settings.checkerboardMode === 'gray' ? 'bg-zinc-800' :
          settings.checkerboardMode === 'white' ? 'bg-white' :
          'bg-black'
        }`}
        style={{ cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : (isDrawing ? 'none' : 'default') }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchEndCapture={handleEnd}
        onTouchCancel={handleEnd}
      >
        <div 
          className="relative z-10 shadow-2xl"
          style={{ 
            width: `${settings.frameSize.width * (settings.zoom / 100) * visualScale}px`,
            height: `${settings.frameSize.height * (settings.zoom / 100) * visualScale}px`,
            transform: `translate(${localOffset.x}px, ${localOffset.y}px)`,
          }}
        >
          <div className="absolute inset-0 checkerboard opacity-20 pointer-events-none" />
          
          {frame?.url && (
            <img 
              src={frame.url} 
              alt="Loading..."
              className={`absolute select-none max-w-none max-h-none ${isReady ? 'hidden' : 'block'}`}
              style={{ 
                imageRendering: 'pixelated',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${originalFrame.originalWidth * (settings.zoom / 100) * visualScale}px`,
                height: `${originalFrame.originalHeight * (settings.zoom / 100) * visualScale}px`,
              }}
            />
          )}

          <canvas 
            ref={canvasRef}
            className={`absolute max-w-none max-h-none ${!isReady ? 'invisible' : 'visible'}`}
            style={{ 
              imageRendering: 'pixelated',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${originalFrame.originalWidth * (settings.zoom / 100) * visualScale}px`,
              height: `${originalFrame.originalHeight * (settings.zoom / 100) * visualScale}px`,
              cursor: isDrawing ? 'none' : (settings.interactionMode === 'brush' ? 'crosshair' : 'default'),
              ...(areaMode ? { cursor: 'crosshair' } : {}),
            }}
          />

          {/* Canvas Bound Overlay - Shows what is being cropped */}
          <div 
            className="absolute border-2 border-red-500/50 pointer-events-none z-50 pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${settings.frameSize.width * (settings.zoom / 100)}px`,
              height: `${settings.frameSize.height * (settings.zoom / 100)}px`,
              boxShadow: '0 0 0 10000px rgba(0,0,0,0.4)',
            }}
          >
            <div className="absolute -top-6 left-0 bg-red-600 text-[10px] text-white px-2 py-0.5 rounded font-black uppercase tracking-wider shadow-lg">
              Export Kader (Crop Zone)
            </div>
          </div>
        </div>
        
        <canvas ref={maskCanvasRef} style={{ display: 'none' }} />
      </div>

      {/* Bottom bar no longer needed with persistent main controls? 
          Actually, checkerboard and zoom are good here too. 
          But the user asked for them in the main window.
      */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-medium">
        <div className="flex items-center gap-4">
          <p className="italic uppercase tracking-tight opacity-50">
            Tip: Eraser verbergt, Herstel brengt terug.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {areaMode === 'wand' && (
            <p className="text-orange-300">Toverstaf actief: klik op een verbonden vlak om te {settings.brushMode === 'erase' ? 'gummen' : 'herstellen'}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
