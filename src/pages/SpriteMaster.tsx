import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFrameSelection } from '@/hooks/useFrameSelection';
import { useHistory } from '@/hooks/useHistory';
import { useObjectUrlRegistry } from '@/hooks/useObjectUrlRegistry';
import { FileUpload } from '@/components/FileUpload';
import { LeftSidebar } from '@/components/LeftSidebar';
import { MainPreview } from '@/components/MainPreview';
import { RightSidebar } from '@/components/RightSidebar';
import { ExportPanel } from '@/components/ExportPanel';
import { SpriteAnalyzer } from '@/components/SpriteAnalyzer';
import { SheetSlicer } from '@/components/SheetSlicer';
import { AnimationTester } from '@/components/AnimationTester';
import { AnimationChapter, Frame, SpriteSheetSettings, KeyBinding } from '@/types';
import { extractFrames, findDuplicateFrames, autoAlignFrames, getTrimmedBox } from '@/utils';
import { removeBackground } from '@/services/backgroundRemovalService';
import { TopHeader } from '@/components/TopHeader';
import { Loader2, Download, X, Scissors, Sparkles, FolderPlus, Save, FileUp, Gamepad2, Repeat, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { serializeProject, deserializeProject } from '@/services/projectService';
import { toast } from '@/components/ui/use-toast';
import { cleanupChapters } from '@/utils/cleanupChapters';

export default function SpriteMaster() {
  const { trackUrl, createTrackedUrl, revokeUnused, revokeAll } = useObjectUrlRegistry();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [originalFrames, setOriginalFrames] = useState<Frame[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeView, setActiveView] = useState<'editor' | 'analyzer' | 'test' | 'export'>('editor');
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [removalState, setRemovalState] = useState({ active: false, current: 0, total: 0, progress: 0 });
  const [isAppending, setIsAppending] = useState(false);
  const [visualScale, setVisualScale] = useState(1.0);
  const [hasProject, setHasProject] = useState(false);
  const [activeBindingId, setActiveBindingId] = useState<string>('default');
  const [chapters, setChapters] = useState<AnimationChapter[]>([]);
  const [bindings, setBindings] = useState<KeyBinding[]>([
    { id: 'default', keys: ['default'], label: 'Rust (Idle)', chapterId: null, mirror: false, holdToPlay: false, loop: true, finishAnimation: false },
    { id: 'walk-right', keys: ['ArrowRight'], label: 'Lopen Rechts', chapterId: null, mirror: false, holdToPlay: true, loop: true, finishAnimation: false },
    { id: 'walk-left', keys: ['ArrowLeft'], label: 'Lopen Links', chapterId: null, mirror: true, holdToPlay: true, loop: true, finishAnimation: false },
    { id: 'jump', keys: [' '], label: 'Springen', chapterId: null, mirror: false, holdToPlay: false, loop: false, finishAnimation: true },
  ]);
  
  const [settings, setSettings] = useState<SpriteSheetSettings>({
    fps: 12,
    columns: 8,
    frameSize: { width: 256, height: 256 },
    padding: 2,
    anchor: 'center',
    customPivot: { x: 0.5, y: 0.5 },
    duplicateSensitivity: 0.005,
    stabilize: true,
    exportFormat: 'generic',
    
    // Pro UI Settings
    chromaTolerance: 80,
    edgeChromaPasses: 3,
    edgeSmooth: 2.5,
    previewMode: 'animation',
    aspectRatio: 'fit',
    offset: { x: 0, y: 0 },
    zoom: 100,
    frameGridSize: 80,
    
    // Analyzer Settings
    showGrid: true,
    analyzerZoom: 100,
    guideMode: 'none',
    guidePosition: { x: 50, y: 50 },
    showGroundLine: false,
    groundLineY: 80,
    showOnionSkin: false,
    onionOpacity: 50,
    interactionMode: 'none',
    brushSize: 2,
    brushMode: 'erase',
    antiAlias: true,
    showGhost: true,
    checkerboardMode: 'transparent',
    
    // Packing & Optimization Defaults
    packingMethod: 'grid',
    maxWidth: 2048,
    maxHeight: 2048,
    allowRotation: false,
    trimSprites: true,
    powerOfTwo: false,
    forceSquare: false,

    // Color removal defaults
    pickedColor: undefined,
    colorTolerance: 15,
    colorMode: 'connected',
    colorSoftEdge: true,

    // Edge refine default
    edgeStrength: 1,
  });

  // Global Editor Playback State
  const [isEditorPlaying, setIsEditorPlaying] = useState(false);
  const [editorCurrentIndex, setEditorCurrentIndex] = useState(0);

  useEffect(() => {
    if (chapters.length > 0) {
      setBindings(prev => prev.map(binding => {
        if (binding.chapterId) return binding;
        
        let foundChapter = null;
        const label = binding.label.toLowerCase();
        
        if (label.includes('idle') || label.includes('rust')) {
          foundChapter = chapters.find(c => c.name.toLowerCase().includes('idle') || c.name.toLowerCase().includes('rust'));
        } else if (label.includes('walk') || label.includes('loop') || label.includes('lopen')) {
          foundChapter = chapters.find(c => c.name.toLowerCase().includes('walk') || c.name.toLowerCase().includes('loop') || c.name.toLowerCase().includes('lopen'));
        } else if (label.includes('jump') || label.includes('sprong') || label.includes('spring')) {
          foundChapter = chapters.find(c => c.name.toLowerCase().includes('jump') || c.name.toLowerCase().includes('sprong') || c.name.toLowerCase().includes('spring'));
        }
        
        // Fallback for default to first chapter if nothing found
        if (!foundChapter && binding.id === 'default' && chapters.length > 0) {
          foundChapter = chapters[0];
        }
        
        return foundChapter ? { ...binding, chapterId: foundChapter.id } : binding;
      }));
    }
  }, [chapters]);

  const {
    selectedIds,
    setSelectedIds,
    focusedFrameId,
    setFocusedFrameId,
    toggleSelect,
    selectAll,
    deselectAll,
    resetSelection,
  } = useFrameSelection(frames);

  const {
    history,
    redoStack,
    pushToHistory,
    undo,
    redo,
    clearHistory,
  } = useHistory({
    frames,
    selectedIds,
    setFrames,
    setSelectedIds,
  });

  const isDefaultAllFramesMode = useMemo(() => {
  return frames.length > 0 && chapters.length === 0;
}, [frames.length, chapters.length]);

const isAllFramesMode = useMemo(() => {
  return frames.length > 0 && (
    isDefaultAllFramesMode ||
    selectedIds.size === frames.length
  );
}, [frames.length, selectedIds.size, isDefaultAllFramesMode]);

const activeFrames = useMemo(() => {
  if (isDefaultAllFramesMode || isAllFramesMode) return frames;
  return selectedIds.size > 0
    ? frames.filter(f => selectedIds.has(f.id))
    : frames;
}, [frames, selectedIds, isDefaultAllFramesMode, isAllFramesMode]);


  useEffect(() => {
    if (isEditorPlaying && activeFrames.length > 0) {
      const currentFrame = activeFrames[editorCurrentIndex % activeFrames.length];
      const duration = (1000 / settings.fps) * (currentFrame?.durationMultiplier || 1);
      
      const timer = window.setTimeout(() => {
        setEditorCurrentIndex((prev) => (prev + 1) % activeFrames.length);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isEditorPlaying, activeFrames, editorCurrentIndex, settings.fps]);

  useEffect(() => {
    // Focus the app container on mount to enable shortcuts immediately
    const container = document.getElementById('app-container');
    container?.focus();
  }, []);

  const handleFileSelect = (file: File, isAppend: boolean = false) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    const isVideo = type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov');
    const isImage = type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.bmp');

    if (isVideo) {
      handleVideoSelect(file, isAppend).catch(err => console.error("App: Video handling failed", err));
    } else if (isImage) {
      setIsExtracting(false);
      setVideoFile(null);
      setUploadedImage(file);
    }
  };

  const handleVideoSelect = async (file: File, isAppend: boolean = false) => {
    if (!isAppend) setVideoFile(file);
    setIsExtracting(true);
    setProgress(0);
    try {
      const extracted = await extractFrames(file, settings.fps, 0, 999, (p) => setProgress(p));
      
      if (isAppend) {
        pushToHistory();
        const offset = frames.length;
        const reindexed = extracted.map((f, i) => ({ ...f, index: offset + i, id: crypto.randomUUID() }));
        trackFrameUrls(reindexed);
        setFrames(prev => [...prev, ...reindexed]);
        setOriginalFrames(prev => [...prev, ...reindexed]);

        // Update frameSize if new frames are larger
        if (reindexed.length > 0) {
          const maxWidth = Math.max(settings.frameSize.width, ...reindexed.map(f => f.originalWidth));
          const maxHeight = Math.max(settings.frameSize.height, ...reindexed.map(f => f.originalHeight));
          if (maxWidth > settings.frameSize.width || maxHeight > settings.frameSize.height) {
            setSettings(prev => ({
              ...prev,
              frameSize: { width: maxWidth, height: maxHeight }
            }));
          }
        }

        setIsAppending(false);
      } else {
        clearHistory();
        revokeAll();
        trackFrameUrls(extracted);
        setFrames(extracted);
        setOriginalFrames(extracted);
        setChapters([]);
        setBindings([
          { id: 'default', keys: ['default'], label: 'Rust (Idle)', chapterId: null, mirror: false, holdToPlay: false, loop: true, finishAnimation: false },
          { id: 'walk-right', keys: ['ArrowRight'], label: 'Lopen Rechts', chapterId: null, mirror: false, holdToPlay: true, loop: true, finishAnimation: false },
          { id: 'walk-left', keys: ['ArrowLeft'], label: 'Lopen Links', chapterId: null, mirror: true, holdToPlay: true, loop: true, finishAnimation: false },
          { id: 'jump', keys: [' '], label: 'Springen', chapterId: null, mirror: false, holdToPlay: false, loop: false, finishAnimation: true },
        ]);
        setActiveBindingId('default');
        const allIds = extracted.map(f => f.id);
        setSelectedIds(new Set(allIds));
        setHasProject(true);
        
        if (extracted.length > 0) {
          setFocusedFrameId(extracted[0].id);
          setSettings(prev => ({
            ...prev,
            frameSize: {
              width: extracted[0].originalWidth,
              height: extracted[0].originalHeight
            }
          }));
        }
      }
    } catch (error) {
      console.error('App: Extraction failed:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  const saveProject = async () => {
    const content = await serializeProject({ settings, chapters, bindings, frames });
    if (content) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `project_${new Date().toISOString().slice(0, 10)}.spritemaster`;
      link.click();
    }
  };

  const loadProject = async (file: File) => {
    try {
      revokeAll();
      const { projectData, loadedFrames } = await deserializeProject({ file, createTrackedUrl });

      clearHistory();
      trackFrameUrls(loadedFrames);

      setSettings(projectData.settings);
      if (projectData.chapters) setChapters(projectData.chapters);
      if (projectData.bindings) {
        const migrated = projectData.bindings.map((b: any) => ({
          ...b,
          keys: b.keys || (b.key ? [b.key] : []),
          finishAnimation: b.finishAnimation ?? (b.id === 'jump')
        }));
        setBindings(migrated);
      }
      if (projectData.activeBindingId) setActiveBindingId(projectData.activeBindingId);
      setFrames(loadedFrames);
      setOriginalFrames(loadedFrames);
      setSelectedIds(new Set());
      setHasProject(true);
    } catch (error) {
      console.error("Load Project Failed:", error);
      alert("Failed to load project: " + (error as Error).message);
    }
  };

  const handleDetectDuplicates = async (targetFrames = frames) => {
    setIsDetectingDuplicates(true);
    setDuplicateIds(new Set());
    try {
      const dups = await findDuplicateFrames(targetFrames, settings.duplicateSensitivity);
      setDuplicateIds(dups);
      const nextSelected = new Set(selectedIds);
      dups.forEach(id => nextSelected.delete(id));
      setSelectedIds(nextSelected);
    } catch (error) {
      console.error('Duplicate detection failed:', error);
    } finally {
      setIsDetectingDuplicates(false);
    }
  };

  const deleteDuplicates = () => {
    pushToHistory();
    const dups = new Set(duplicateIds);
    const nextFrames: Frame[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (dups.has(frame.id)) {
        if (nextFrames.length > 0) {
          nextFrames[nextFrames.length - 1] = {
            ...nextFrames[nextFrames.length - 1],
            durationMultiplier: nextFrames[nextFrames.length - 1].durationMultiplier + (frame.durationMultiplier || 1)
          };
        }
      } else {
        nextFrames.push({ ...frame });
      }
    }

    if (nextFrames.length === 0) {
      resetToEmptyProjectState();
      return;
    }

    setFrames(nextFrames);
    cleanupChaptersAndBindingsForFrames(nextFrames);
    setDuplicateIds(new Set());
    const nextSelected = new Set(selectedIds);
    dups.forEach(id => nextSelected.delete(id));
    setSelectedIds(nextSelected);
  };

  const handleSliced = (slicedFrames: Frame[]) => {
    if (isAppending) {
      pushToHistory();
      const offset = frames.length;
      const reindexed = slicedFrames.map((f, i) => ({
        ...f,
        index: offset + i,
        id: crypto.randomUUID()
      }));
      trackFrameUrls(reindexed);
      setFrames(prev => [...prev, ...reindexed]);
      setOriginalFrames(prev => [...prev, ...reindexed]);
      
      // Update frameSize if new frames are larger
      if (reindexed.length > 0) {
        const maxWidth = Math.max(settings.frameSize.width, ...reindexed.map(f => f.originalWidth));
        const maxHeight = Math.max(settings.frameSize.height, ...reindexed.map(f => f.originalHeight));
        if (maxWidth > settings.frameSize.width || maxHeight > settings.frameSize.height) {
          setSettings(prev => ({
            ...prev,
            frameSize: { width: maxWidth, height: maxHeight }
          }));
        }
      }
      
      // Select and focus the first of the new frames
      if (reindexed.length > 0) {
        setSelectedIds(new Set([reindexed[0].id]));
        setFocusedFrameId(reindexed[0].id);
      }
      
      setIsAppending(false);
      setUploadedImage(null);
      } else {
        clearHistory();
        revokeAll();
        trackFrameUrls(slicedFrames);
        setFrames(slicedFrames);
        setOriginalFrames(slicedFrames);
        setChapters([]);
        setBindings([
          { id: 'default', keys: ['default'], label: 'Rust (Idle)', chapterId: null, mirror: false, holdToPlay: false, loop: true, finishAnimation: false },
          { id: 'walk-right', keys: ['ArrowRight'], label: 'Lopen Rechts', chapterId: null, mirror: false, holdToPlay: true, loop: true, finishAnimation: false },
          { id: 'walk-left', keys: ['ArrowLeft'], label: 'Lopen Links', chapterId: null, mirror: true, holdToPlay: true, loop: true, finishAnimation: false },
          { id: 'jump', keys: [' '], label: 'Springen', chapterId: null, mirror: false, holdToPlay: false, loop: false, finishAnimation: true },
        ]);
        setActiveBindingId('default');
        setSelectedIds(new Set(slicedFrames.map(f => f.id)));
        if (slicedFrames.length > 0) {
          setFocusedFrameId(slicedFrames[0].id);
          setSettings(prev => ({
            ...prev,
            frameSize: {
              width: slicedFrames[0].originalWidth,
              height: slicedFrames[0].originalHeight
            }
          }));
        }
        setVideoFile(new File([], uploadedImage?.name || 'spritesheet.png'));
        setUploadedImage(null);
        setHasProject(true);
      }
  };

  const trackFrameUrls = useCallback((nextFrames: Frame[]) => {
    nextFrames.forEach(frame => trackUrl(frame.url));
  }, [trackUrl]);

  useEffect(() => {
    if (history.length > 0 || redoStack.length > 0) return;
    const activeUrls = [...frames, ...originalFrames].map(frame => frame.url);
    revokeUnused(activeUrls);
  }, [frames, originalFrames, history.length, redoStack.length, revokeUnused]);

  const selectAllWithHistory = useCallback(() => {
    pushToHistory();
    selectAll();
  }, [pushToHistory, selectAll]);

  const deselectAllWithHistory = useCallback(() => {
    pushToHistory();
    deselectAll();
  }, [pushToHistory, deselectAll]);


  const cleanupChaptersAndBindingsForFrames = useCallback((nextFrames: Frame[]) => {
    const validFrameIds = new Set(nextFrames.map((frame) => frame.id));

    setChapters((prevChapters) => {
      const cleaned = cleanupChapters({
        chapters: prevChapters,
        bindings,
        validFrameIds,
      });

      if (cleaned.removedChapterCount > 0) {
        toast({
          description: cleaned.removedChapterCount === 1 ? 'Lege selectie verwijderd' : 'Lege selecties verwijderd',
        });
      }

      setBindings(cleaned.bindings);
      return cleaned.chapters;
    });
  }, [bindings, setChapters, setBindings]);

  const resetToEmptyProjectState = useCallback(() => {
    revokeAll();
    setVideoFile(null);
    setUploadedImage(null);
    setFrames([]);
    setOriginalFrames([]);
    setIsExtracting(false);
    setProgress(0);
    resetSelection();
    setActiveView('editor');
    clearHistory();
    setDuplicateIds(new Set());
    setIsDetectingDuplicates(false);
    setRemovalState({ active: false, current: 0, total: 0, progress: 0 });
    setIsAppending(false);
    setHasProject(false);
    setChapters([]);
    setBindings([
      { id: 'default', keys: ['default'], label: 'Rust (Idle)', chapterId: null, mirror: false, holdToPlay: false, loop: true, finishAnimation: false },
      { id: 'walk-right', keys: ['ArrowRight'], label: 'Lopen Rechts', chapterId: null, mirror: false, holdToPlay: true, loop: true, finishAnimation: false },
      { id: 'walk-left', keys: ['ArrowLeft'], label: 'Lopen Links', chapterId: null, mirror: true, holdToPlay: true, loop: true, finishAnimation: false },
      { id: 'jump', keys: [' '], label: 'Springen', chapterId: null, mirror: false, holdToPlay: false, loop: false, finishAnimation: true },
    ]);
    setActiveBindingId('default');
  }, [clearHistory, resetSelection, revokeAll]);


  const deleteSelected = useCallback(() => {
    pushToHistory();
    const toDelete = selectedIds.size > 0
      ? selectedIds
      : (focusedFrameId ? new Set([focusedFrameId]) : new Set<string>());

    if (toDelete.size === 0) return;

    const nextFrames = frames.filter(f => !toDelete.has(f.id));
    if (nextFrames.length === 0) {
      resetToEmptyProjectState();
      return;
    }

    setFrames(nextFrames);
    cleanupChaptersAndBindingsForFrames(nextFrames);
    setSelectedIds(new Set());
    setFocusedFrameId(null);
  }, [pushToHistory, selectedIds, focusedFrameId, frames, resetToEmptyProjectState, cleanupChaptersAndBindingsForFrames]);

  const keepOnlySelected = useCallback(() => {
    pushToHistory();
    const nextFrames = frames.filter(f => selectedIds.has(f.id));
    if (nextFrames.length === 0) {
      resetToEmptyProjectState();
      return;
    }
    setFrames(nextFrames);
    cleanupChaptersAndBindingsForFrames(nextFrames);
    setSelectedIds(new Set());
  }, [pushToHistory, selectedIds, frames, resetToEmptyProjectState, cleanupChaptersAndBindingsForFrames]);

  const onScaleSelection = useCallback(async (factor: number) => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : frames.map(f => f.id);
    if (targetIds.length === 0) return;

    pushToHistory();
    
    const newFrames = [...frames];
    const newOriginalFrames = [...originalFrames];

    for (const id of targetIds) {
      const idx = newFrames.findIndex(f => f.id === id);
      if (idx === -1) continue;

      const frame = newFrames[idx];
      const origFrameIdx = newOriginalFrames.findIndex(f => f.id === id);
      
      // Scale current edited frame
      const frameImg = new Image();
      frameImg.src = frame.url;
      await new Promise(r => frameImg.onload = r);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(frameImg.width * factor);
      canvas.height = Math.round(frameImg.height * factor);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      }

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/png'));
      if (!blob) continue;
      const url = createTrackedUrl(blob);

      newFrames[idx] = {
        ...frame,
        blob,
        url,
        originalWidth: canvas.width,
        originalHeight: canvas.height,
      };

      // Scale original frame reference
      if (origFrameIdx !== -1) {
        const origFrame = newOriginalFrames[origFrameIdx];
        const origImg = new Image();
        origImg.src = origFrame.url;
        await new Promise(r => origImg.onload = r);

        const origCanvas = document.createElement('canvas');
        origCanvas.width = canvas.width;
        origCanvas.height = canvas.height;
        const origCtx = origCanvas.getContext('2d');
        if (origCtx) {
          origCtx.imageSmoothingEnabled = false;
          origCtx.drawImage(origImg, 0, 0, origCanvas.width, origCanvas.height);
        }

        const origBlob = await new Promise<Blob | null>(r => origCanvas.toBlob(b => r(b), 'image/png'));
        if (!origBlob) continue;
        const origUrl = createTrackedUrl(origBlob);

        newOriginalFrames[origFrameIdx] = {
          ...origFrame,
          blob: origBlob,
          url: origUrl,
          originalWidth: canvas.width,
          originalHeight: canvas.height,
        };
      }
    }
    
    if (targetIds.length === frames.length && newFrames.length > 0) {
      const firstFrame = newFrames[0];
      setSettings(prev => ({
        ...prev,
        frameSize: {
          width: firstFrame.originalWidth,
          height: firstFrame.originalHeight
        }
      }));
    }

    setFrames(newFrames);
    setOriginalFrames(newOriginalFrames);
  }, [frames, originalFrames, selectedIds, pushToHistory, setSettings]);

  const onUpdateFrame = useCallback(async (id: string, newBlob: Blob) => {
    if (!newBlob) return;
    pushToHistory();
    const newUrl = createTrackedUrl(newBlob);
    
    // Recalculate trimmed box
    const img = new Image();
    img.src = newUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const trimmedBox = getTrimmedBox(imageData);
      setFrames(prev => prev.map(f => f.id === id ? { ...f, blob: newBlob, url: newUrl, trimmedBox } : f));
    } else {
      setFrames(prev => prev.map(f => f.id === id ? { ...f, blob: newBlob, url: newUrl } : f));
    }
  }, [pushToHistory]);

  const updateDuration = useCallback((id: string, delta: number) => {
    pushToHistory();
    setFrames(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, durationMultiplier: Math.max(0.5, f.durationMultiplier + delta) };
      }
      return f;
    }));
  }, [pushToHistory]);

  const updateFrameOffset = useCallback((id: string, x: number, y: number) => {
    pushToHistory();
    setFrames(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, offset: { x: f.offset.x + x, y: f.offset.y + y } };
      }
      return f;
    }));
  }, [pushToHistory]);

  const updateFramesOffset = useCallback((ids: string[], x: number, y: number) => {
    pushToHistory();
    const idSet = new Set(ids);
    setFrames(prev => prev.map(f => {
      if (idSet.has(f.id)) {
        return { ...f, offset: { x: (f.offset?.x || 0) + x, y: (f.offset?.y || 0) + y } };
      }
      return f;
    }));
  }, [pushToHistory]);

  const [isReordering, setIsReordering] = useState(false);

  const handleSetFrames = useCallback((newFrames: Frame[]) => {
    if (!isReordering) {
      pushToHistory();
      setIsReordering(true);
    }
    const indexedFrames = newFrames.map((f: Frame, i: number) => ({ ...f, index: i }));
    setFrames(indexedFrames);
  }, [isReordering, pushToHistory]);

  const handleReorderEnd = useCallback(() => {
    setIsReordering(false);
  }, []);

  const reorderFrames = useCallback((startIndex: number, endIndex: number) => {
    pushToHistory();
    setFrames(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((f: Frame, i: number) => ({ ...f, index: i }));
    });
  }, [pushToHistory]);

  const reorderChapters = useCallback((startIndex: number, endIndex: number) => {
    setChapters(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const handleStartOver = useCallback(() => {
    resetToEmptyProjectState();
  }, [resetToEmptyProjectState]);

  useEffect(() => {
    const handleClearDuplicates = () => setDuplicateIds(new Set());
    window.addEventListener('clear-duplicates', handleClearDuplicates);
    return () => window.removeEventListener('clear-duplicates', handleClearDuplicates);
  }, []);

  const steps = [
    { id: 'editor', label: 'Frames voorbereiden', icon: Repeat },
    { id: 'analyzer', label: 'Analyze & Align', icon: Target },
    { id: 'test', label: 'Test', icon: Gamepad2 },
    { id: 'export', label: 'Export Spritesheet', icon: Download },
  ];

  const handleStepClick = (stepId: string) => {
    setActiveView(stepId as any);
  };

  // Color removal / edge refinement state (declared early so keyboard handler can reference)
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [edgeBusy, setEdgeBusy] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape handling
      if (e.key === 'Escape') {
        if (isPickingColor) {
          setIsPickingColor(false);
          return;
        }
        if (!focusedFrameId) {
          setSelectedIds(new Set());
          setSettings(prev => ({ ...prev, interactionMode: 'none' }));
        }
        return;
      }

      // Arrow movement / navigation
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (activeView === 'test') return;

        const isTextInput = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
        if (isTextInput) return;

        const shouldNavigateFrames = activeView === 'editor'
          && settings.interactionMode === 'none'
          && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
          && activeFrames.length > 0;

        if (shouldNavigateFrames) {
          e.preventDefault();
          const currentSafeIndex = ((editorCurrentIndex % activeFrames.length) + activeFrames.length) % activeFrames.length;
          const nextIndex = e.key === 'ArrowRight'
            ? (currentSafeIndex + 1) % activeFrames.length
            : (currentSafeIndex - 1 + activeFrames.length) % activeFrames.length;
          setEditorCurrentIndex(nextIndex);
          setFocusedFrameId(activeFrames[nextIndex].id);
          return;
        }

        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (focusedFrameId ? [focusedFrameId] : []);

        if (targetIds.length > 0) {
          let dx = 0, dy = 0;
          if (e.key === 'ArrowLeft') dx = -delta;
          if (e.key === 'ArrowRight') dx = delta;
          if (e.key === 'ArrowUp') dy = -delta;
          if (e.key === 'ArrowDown') dy = delta;

          updateFramesOffset(targetIds, dx, dy);
        }
      }

      // Undo/Redo handling
      const isZ = e.code === 'KeyZ';
      const isY = e.code === 'KeyY';
      const isDelete = e.key === 'Delete' || e.key === 'Backspace';

      if (isDelete && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Only if not focused on input
        if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          deleteSelected();
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyA') {
          e.preventDefault();
          selectAllWithHistory();
        } else if (e.code === 'KeyD') {
          e.preventDefault();
          deselectAllWithHistory();
        } else if (isZ) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (isY) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, focusedFrameId, selectedIds, activeView, updateFramesOffset, selectAllWithHistory, deselectAllWithHistory, deleteSelected, isPickingColor, settings.interactionMode, activeFrames, editorCurrentIndex]);

  const handleRemoveBackground = async () => {
    const targetIds = selectedIds.size > 0 ? Array.from(selectedIds) : (focusedFrameId ? [focusedFrameId] : []);
    if (targetIds.length === 0) return;

    pushToHistory();
    // Initialize removal state clearly
    setRemovalState({ 
      active: true, 
      current: 0, 
      total: targetIds.length, 
      progress: 0 
    });

    try {
      const newFrames = [...frames];
      
      for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const frameIdx = newFrames.findIndex(f => f.id === id);
        if (frameIdx === -1) continue;

        const frame = newFrames[frameIdx];
        if (!frame.blob) continue;
        
        // --- Process Frame ---
        // UI yielding to prevent freezes - wait for next tick
        await new Promise(r => setTimeout(r, 150));

        const originalImg = new Image();
        const originalUrl = URL.createObjectURL(frame.blob);
        await new Promise((resolve, reject) => {
          originalImg.onload = resolve;
          originalImg.onerror = reject;
          originalImg.src = originalUrl;
        });

        // Small yield after image load
        await new Promise(r => setTimeout(r, 0));

        // Background removal (heavy call)
        const removedBgBlob = await removeBackground(frame);

        // Yield after heavy work - allow UI to breathe
        await new Promise(r => setTimeout(r, 200));
        
        if (!removedBgBlob) {
          URL.revokeObjectURL(originalUrl);
          continue;
        }
        
        const removedBgImg = new Image();
        const removedBgUrl = URL.createObjectURL(removedBgBlob);
        await new Promise((resolve, reject) => {
          removedBgImg.onload = resolve;
          removedBgImg.onerror = reject;
          removedBgImg.src = removedBgUrl;
        });

        const mergeCanvas = document.createElement('canvas');
        mergeCanvas.width = frame.originalWidth;
        mergeCanvas.height = frame.originalHeight;
        const mergeCtx = mergeCanvas.getContext('2d');
        if (mergeCtx) {
          mergeCtx.drawImage(originalImg, 0, 0);
          mergeCtx.globalCompositeOperation = 'destination-in';
          mergeCtx.drawImage(removedBgImg, 0, 0);
        }
        
        const mergedBlob = await new Promise<Blob | null>(resolve => 
          mergeCanvas.toBlob(b => resolve(b), 'image/png')
        );

        URL.revokeObjectURL(originalUrl);
        URL.revokeObjectURL(removedBgUrl);

        if (mergedBlob) {
          const newUrl = URL.createObjectURL(mergedBlob);
          const img = new Image();
          img.src = newUrl;
          await new Promise(r => img.onload = r);
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0);
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const trimmedBox = getTrimmedBox(imageData);
            
            newFrames[frameIdx] = {
              ...frame,
              blob: mergedBlob,
              url: newUrl,
              trimmedBox
            };
          }
        }
        
        setRemovalState(prev => {
          // Discrete progress jump per frame completion
          const nextCompletedCount = i + 1;
          const totalFrames = targetIds.length;
          const nextProgress = nextCompletedCount / totalFrames;
          
          return {
            ...prev,
            current: nextCompletedCount,
            progress: nextProgress
          };
        });
        
        setFrames([...newFrames]);
        // Yield to browser to keep UI alive and show progress
        await new Promise(r => setTimeout(r, 50));
      }
    } catch (error) {
      console.error('Background removal failed:', error);
    } finally {
      // Keep result visible for a bit before clearing UI
      await new Promise(r => setTimeout(r, 1000));
      setRemovalState(prev => ({ ...prev, active: false }));
    }
  };

  // (isPickingColor / edgeBusy declared above near keyboard handler)


  const getTargetIds = useCallback(() => {
    if (selectedIds.size > 0) return Array.from(selectedIds);
    if (focusedFrameId) return [focusedFrameId];
    return [];
  }, [selectedIds, focusedFrameId]);

  const replaceFrameBlob = useCallback(async (frame: Frame, newBlob: Blob): Promise<Frame> => {
    // NOTE: do NOT revoke frame.url — the previous Frame object (with that url)
    // is still referenced by undo/redo history snapshots and existing thumbnails.
    // Revoking here would break Ctrl+Z and turn thumbnails into broken images.
    const newUrl = createTrackedUrl(newBlob);
    const img = new Image();
    img.src = newUrl;
    await new Promise(r => { img.onload = r; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d');
    let trimmedBox = frame.trimmedBox;
    if (cx) {
      cx.drawImage(img, 0, 0);
      trimmedBox = getTrimmedBox(cx.getImageData(0, 0, c.width, c.height));
    }
    return { ...frame, blob: newBlob, url: newUrl, trimmedBox };
  }, []);

  const handlePickColor = () => {
    if (!focusedFrameId && frames.length === 0) return;
    setIsPickingColor(true);
  };

  // Triggered by MainPreview when user clicks a pixel while picking is active
  const handleColorPicked = useCallback(async (frameId: string, x: number, y: number) => {
    const frame = frames.find(f => f.id === frameId);
    if (!frame) { setIsPickingColor(false); return; }
    try {
      const { pickPixelColor } = await import('@/services/imageProcessing');
      const hex = await pickPixelColor(frame.blob, x, y);
      setSettings(prev => ({ ...prev, pickedColor: hex }));
    } catch (e) { console.error(e); }
    setIsPickingColor(false);
  }, [frames]);

  const handleApplyColorRemoval = async () => {
    const ids = getTargetIds();
    if (ids.length === 0 || !settings.pickedColor) return;
    pushToHistory();
    setRemovalState({ active: true, current: 0, total: ids.length, progress: 0 });
    try {
      const { removeColorFromBlob } = await import('@/services/imageProcessing');
      const next = [...frames];
      for (let i = 0; i < ids.length; i++) {
        const idx = next.findIndex(f => f.id === ids[i]);
        if (idx === -1) continue;
        const newBlob = await removeColorFromBlob(
          next[idx].blob,
          settings.pickedColor!,
          settings.colorTolerance,
          settings.colorMode,
          settings.colorSoftEdge,
        );
        next[idx] = await replaceFrameBlob(next[idx], newBlob);
        setFrames([...next]);
        setRemovalState(prev => ({ ...prev, current: i + 1, progress: (i + 1) / ids.length }));
        await new Promise(r => setTimeout(r, 0));
      }
    } catch (e) {
      console.error('Color removal failed:', e);
    } finally {
      await new Promise(r => setTimeout(r, 400));
      setRemovalState(prev => ({ ...prev, active: false }));
    }
  };


  const handleAutoColorRemoval = async () => {
    const ids = getTargetIds();
    if (ids.length === 0) return;
    pushToHistory();
    setRemovalState({ active: true, current: 0, total: ids.length, progress: 0 });
    try {
      const { removeColorFromBlob } = await import('@/services/imageProcessing');
      const { detectSubject } = await import('@/services/geminiService');
      const next = [...frames];
      for (let i = 0; i < ids.length; i++) {
        const idx = next.findIndex(f => f.id === ids[i]);
        if (idx === -1) continue;
        const detection = await detectSubject(next[idx]);
        const newBlob = await removeColorFromBlob(
          next[idx].blob,
          detection.chromaColor,
          Math.max(5, Math.min(50, detection.tolerance)),
          'connected',
          true,
        );
        next[idx] = await replaceFrameBlob(next[idx], newBlob);
        setFrames([...next]);
        // Stash the last detected color so the user sees what AI picked
        setSettings(prev => ({ ...prev, pickedColor: detection.chromaColor }));
        setRemovalState(prev => ({ ...prev, current: i + 1, progress: (i + 1) / ids.length }));
      }
    } catch (e) {
      console.error('Auto color removal failed:', e);
    } finally {
      await new Promise(r => setTimeout(r, 400));
      setRemovalState(prev => ({ ...prev, active: false }));
    }
  };

  const handleEdgeOp = async (op: 'erode' | 'dilate' | 'feather' | 'decontaminate') => {
    const ids = getTargetIds();
    if (ids.length === 0) return;
    pushToHistory();
    setEdgeBusy(true);
    try {
      const mod = await import('@/services/imageProcessing');
      const next = [...frames];
      for (const id of ids) {
        const idx = next.findIndex(f => f.id === id);
        if (idx === -1) continue;
        let blob = next[idx].blob;
        if (op === 'erode') blob = await mod.erodeAlpha(blob, settings.edgeStrength);
        else if (op === 'dilate') blob = await mod.dilateAlpha(blob, settings.edgeStrength);
        else if (op === 'feather') blob = await mod.featherAlpha(blob, settings.edgeStrength);
        else if (op === 'decontaminate') {
          if (!settings.pickedColor) continue;
          blob = await mod.decontaminateColors(blob, settings.pickedColor);
        }
        next[idx] = await replaceFrameBlob(next[idx], blob);
        setFrames([...next]);
      }
    } catch (e) {
      console.error('Edge op failed:', e);
    } finally {
      setEdgeBusy(false);
    }
  };

  const analyzerFrames = useMemo(() => frames.filter(f => selectedIds.has(f.id)), [frames, selectedIds]);

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

  const showImporter = (!hasProject || isAppending || uploadedImage) && !isExtracting;

  return (
    <div id="app-container" className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden selection:bg-purple-500/30 font-sans outline-none" tabIndex={0}>
      {!showImporter && !isExtracting && (
        <TopHeader 
          activeView={activeView}
          onViewChange={setActiveView}
          steps={steps}
          onUndo={undo}
          onRedo={redo}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0}
          onShowExport={() => setActiveView('export')}
          onStartOver={handleStartOver}
          stats={stats}
        />
      )}

      <AnimatePresence mode="wait">
        {showImporter ? (
          <motion.div
            key="importer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center relative"
          >
            {uploadedImage ? (
              <div className="fixed inset-0 z-[60] bg-zinc-950">
                <SheetSlicer 
                  file={uploadedImage} 
                  onSliced={handleSliced} 
                  onCancel={() => {
                    setUploadedImage(null);
                    setIsAppending(false);
                  }} 
                />
              </div>
            ) : (
              <>
                {isAppending && (
                  <button 
                    onClick={() => setIsAppending(false)}
                    className="absolute top-8 left-8 z-[70] flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-2xl"
                  >
                    <X size={18} />
                    <span className="text-xs font-bold uppercase tracking-tight">Terug naar Editor</span>
                  </button>
                )}
                
                <div className="mb-12 space-y-4">
                  <div className="w-20 h-20 bg-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-600/20 mx-auto mb-6">
                    <Scissors className="text-white" size={40} />
                  </div>
                  <h1 className="text-5xl font-black tracking-tighter text-white">
                    SpriteMaster <span className="text-purple-500">V5</span>
                  </h1>
                  <p className="text-zinc-400 max-w-md mx-auto text-lg lowercase">
                    {isAppending ? 'Voeg meer frames toe aan je project' : 'De ultieme tool voor video extractie & optimalisatie.'}
                  </p>
                </div>
                
                <FileUpload onFileSelect={(file) => handleFileSelect(file, isAppending)} />
                
                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.spritemaster';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) loadProject(file);
                        };
                        input.click();
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white hover:border-zinc-700 transition-all font-bold uppercase tracking-tight text-xs shadow-xl active:scale-95"
                    >
                      <FileUp size={18} className="text-purple-500" />
                      Open Project
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-12 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-12">
                    <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> Client Side</span>
                    <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> Video & Sheets</span>
                    <span className="flex items-center gap-2"><div className="w-1 h-1 bg-purple-500 rounded-full" /> Pro Analyzer</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ) : isExtracting ? (
          <motion.div
            key="extracting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center space-y-8"
          >
            <div className="relative">
              <Loader2 className="animate-spin text-purple-500" size={64} />
              <div className="absolute inset-0 blur-2xl bg-purple-500/20 animate-pulse" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold tracking-tight">Frames Extraheren...</h3>
              <p className="text-zinc-500 text-sm font-medium">Bezig met {videoFile?.name || 'video'}</p>
            </div>
            <div className="w-80 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
              />
            </div>
          </motion.div>
        ) : activeView === 'analyzer' ? (
          <motion.div
            key="analyzer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden"
          >
            <SpriteAnalyzer
              frames={frames}
              settings={settings}
              focusedFrameId={focusedFrameId}
              chapters={chapters}
              onChaptersChange={setChapters}
              selectedIds={selectedIds}
              onSelectIds={setSelectedIds}
              onFocusFrame={setFocusedFrameId}
              onBack={() => setActiveView('editor')}
              onSettingsChange={setSettings}
              onUpdateFrameOffset={updateFrameOffset}
              onUpdateDuration={updateDuration}
              onReorderFrames={reorderFrames}
              onUndo={undo}
              canUndo={history.length > 0}
              visualScale={visualScale}
              onVisualScaleChange={setVisualScale}
              onScaleSelection={onScaleSelection}
              allFramesCount={frames.length}
              onUpdateFramesOffset={updateFramesOffset}
              activeView={activeView}
              onViewChange={setActiveView}
              onShowExport={() => setActiveView('export')}
              onStartOver={handleStartOver}
              onReorderChapters={reorderChapters}
              steps={steps}
            />
          </motion.div>
        ) : activeView === 'test' ? (
          <motion.div
            key="test"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden"
          >
            <AnimationTester
              frames={frames}
              settings={settings}
              chapters={chapters}
              bindings={bindings}
              activeBindingId={activeBindingId}
              onActiveBindingChange={setActiveBindingId}
              onBindingsChange={setBindings}
              onBack={() => setActiveView('editor')}
              onSettingsChange={setSettings}
              activeView={activeView}
              onViewChange={setActiveView}
              onShowExport={() => setActiveView('export')}
              onStartOver={handleStartOver}
              steps={steps}
            />
          </motion.div>
        ) : activeView === 'editor' ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden"
          >
            <LeftSidebar 
              settings={settings} 
              frames={frames}
              chapters={chapters}
              onChaptersChange={setChapters}
              selectedIds={selectedIds}
              onSelectIds={setSelectedIds}
              onSettingsChange={setSettings} 
              onStartOver={handleStartOver}
              removalState={removalState}
              onRemoveBackground={handleRemoveBackground}
              focusedFrameId={focusedFrameId}
              onUndo={undo}
              onRedo={redo}
              canUndo={history.length > 0}
              canRedo={redoStack.length > 0}
              onSaveProject={saveProject}
              onLoadProject={loadProject}
              onAddFrames={() => {
                setIsAppending(true);
                setVideoFile(null);
                setUploadedImage(null);
              }}
              onReorderChapters={reorderChapters}
              onPickColor={handlePickColor}
              onApplyColorRemoval={handleApplyColorRemoval}
              onAutoColorRemoval={handleAutoColorRemoval}
              isPickingColor={isPickingColor}
              onEdgeOp={handleEdgeOp}
              edgeBusy={edgeBusy}
              isAllFramesMode={isAllFramesMode}
            />
            
            <MainPreview 
              frames={frames} 
              originalFrames={originalFrames}
              selectedIds={selectedIds} 
              focusedFrameId={focusedFrameId}
              onFocusFrame={setFocusedFrameId}
              onUpdateFrame={onUpdateFrame}
              duplicateIds={duplicateIds}
              settings={settings}
              onSettingsChange={setSettings}
              onStartOver={handleStartOver}
              onAnalyze={() => setActiveView('analyzer')}
              activeView={activeView}
              onViewChange={setActiveView}
              onShowExport={() => setActiveView('export')}
              isDetectingDuplicates={isDetectingDuplicates}
              onDeleteDuplicates={deleteDuplicates}
              onDetectDuplicates={() => handleDetectDuplicates()}
              visualScale={visualScale}
              activeFrames={activeFrames}
              isPlaying={isEditorPlaying}
              onTogglePlay={() => setIsEditorPlaying(!isEditorPlaying)}
              currentIndex={editorCurrentIndex}
              setCurrentIndex={setEditorCurrentIndex}
              steps={steps}
              isPickingColor={isPickingColor}
              onColorPick={handleColorPicked}
            />
            
            <RightSidebar 
              frames={frames}
              chapters={chapters}
              selectedIds={selectedIds}
              focusedFrameId={focusedFrameId}
              duplicateIds={duplicateIds}
              settings={settings}
              videoFile={videoFile}
              onToggleSelect={toggleSelect}
              onFocusFrame={setFocusedFrameId}
              onSelectAll={selectAllWithHistory}
              onDeselectAll={deselectAllWithHistory}
              onUpdateDuration={updateDuration}
              onSettingsChange={setSettings}
              onClearAll={handleStartOver}
              onDetectDuplicates={() => handleDetectDuplicates()}
              onSetFrames={handleSetFrames}
              onReorderEnd={handleReorderEnd}
              onDeleteSelected={deleteSelected}
              onUpdateFramesOffset={updateFramesOffset}
              isPlaying={isEditorPlaying}
              playbackFrameId={isEditorPlaying && activeFrames[editorCurrentIndex] ? activeFrames[editorCurrentIndex].id : null}
              isAllFramesMode={isAllFramesMode}
            />
          </motion.div>
        ) : (
          <motion.div
            key="export"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden bg-zinc-950 p-6"
          >
            <div className="max-w-6xl mx-auto w-full">
              <ExportPanel 
                frames={frames} 
                settings={settings} 
                onSettingsChange={setSettings}
                onBack={() => setActiveView('editor')}
                chapters={chapters} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Export Modal Overlay - Removed and moved to main view flow */}

    </div>
  );
}
