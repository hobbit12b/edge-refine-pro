export interface AnimationInsight {
  type: string;
  description: string;
  tags: string[];
  vibe: string;
  optimizationTips: string[];
}

export interface AnimationChapter {
  id: string;
  name: string;
  frameIds: string[]; // For frames directly in chapter
  isExpanded?: boolean;
  color?: string;
}

export interface KeyBinding {
  id: string;
  keys: string[];
  label: string;
  chapterId: string | null;
  mirror: boolean;
  holdToPlay: boolean;
  loop: boolean;
  finishAnimation?: boolean; // New: finish animation before switching back
}

export interface Frame {
  id: string;
  blob: Blob;
  url: string;
  index: number;
  originalWidth: number;
  originalHeight: number;
  trimmedBox?: { x: number; y: number; w: number; h: number };
  durationMultiplier: number;
  offset: { x: number; y: number }; // Individual frame offset for fine-tuning
}

export interface SpriteSheetSettings {
  fps: number;
  columns: number;
  frameSize: { width: number; height: number };
  padding: number;
  anchor: 'center' | 'bottom-center' | 'top-left' | 'custom';
  customPivot: { x: number; y: number };
  duplicateSensitivity: number;
  stabilize: boolean;
  exportFormat: 'generic' | 'phaser';
  
  // New Pro UI Settings
  previewMode: 'animation' | 'tight' | 'tight-stretch';
  aspectRatio: 'fit' | '4:3' | '16:9' | '3:4' | '9:16';
  offset: { x: number; y: number }; // Global offset
  zoom: number;
  frameGridSize: number;
  
  // Packing & Optimization
  packingMethod: 'grid' | 'bin';
  maxWidth: number;
  maxHeight: number;
  allowRotation: boolean;
  trimSprites: boolean;
  powerOfTwo: boolean;
  forceSquare: boolean;
  
  // Analyzer Settings
  showGrid: boolean;
  analyzerZoom: number;
  guideMode: 'none' | 'grid' | 'guide';
  guidePosition: { x: number; y: number };
  showGroundLine: boolean;
  groundLineY: number;
  showOnionSkin: boolean;
  onionOpacity: number;
  interactionMode: 'none' | 'brush' | 'lasso' | 'poly-lasso' | 'magnetic-lasso';
  brushSize: number;
  brushMode: 'erase' | 'restore';
  antiAlias: boolean;
  showGhost: boolean;
  checkerboardMode: 'transparent' | 'red' | 'green' | 'gray' | 'white' | 'black';
}

export interface Manifest {
  frames: {
    [key: string]: {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean;
      trimmed: boolean;
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
      pivot: { x: number; y: number };
      duration?: number;
      texture?: string;
    };
  } | any[];
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
    fps?: number;
    frameWidth?: number;
    frameHeight?: number;
    pivot?: { x: number; y: number };
  };
}
