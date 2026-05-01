import { Frame, SpriteSheetSettings } from './types';

export async function extractFrames(
  videoFile: File,
  fps: number,
  startTime: number,
  endTime: number,
  onProgress: (progress: number) => void,
  signal?: AbortSignal
): Promise<Frame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    document.body.appendChild(video);

    if (!videoFile) {
      reject(new Error('Geen videobestand opgegeven.'));
      return;
    }

    const objectUrl = URL.createObjectURL(videoFile);
    let settled = false;
    let cleaned = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const onAbort = () => {
      fail('Video-extractie is geannuleerd.');
    };

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      signal?.removeEventListener('abort', onAbort);
    };

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
      return new Promise<T>((resolveTimeout, rejectTimeout) => {
        const timeoutId = window.setTimeout(() => {
          rejectTimeout(new Error(timeoutMessage));
        }, timeoutMs);

        promise
          .then((value) => {
            window.clearTimeout(timeoutId);
            resolveTimeout(value);
          })
          .catch((error) => {
            window.clearTimeout(timeoutId);
            rejectTimeout(error);
          });
      });
    };

    const waitForEvent = (eventName: keyof HTMLMediaElementEventMap): Promise<void> => {
      return new Promise((resolveEvent, rejectEvent) => {
        const onEvent = () => {
          cleanupListeners();
          resolveEvent();
        };

        const onError = () => {
          cleanupListeners();
          const err = video.error;
          rejectEvent(new Error(`Video laden mislukt: ${err?.message || `Decoderfout (code: ${err?.code ?? 'onbekend'})`}`));
        };

        const onAbortEvent = () => {
          cleanupListeners();
          rejectEvent(new Error('Video-extractie is geannuleerd.'));
        };

        const cleanupListeners = () => {
          video.removeEventListener(eventName, onEvent);
          video.removeEventListener('error', onError);
          signal?.removeEventListener('abort', onAbortEvent);
        };

        video.addEventListener(eventName, onEvent, { once: true });
        video.addEventListener('error', onError, { once: true });
        signal?.addEventListener('abort', onAbortEvent, { once: true });
      });
    };

    const waitForSeeked = (time: number): Promise<void> => {
      return new Promise((resolveSeek, rejectSeek) => {
        const onSeeked = () => {
          cleanupListeners();
          resolveSeek();
        };

        const onError = () => {
          cleanupListeners();
          const err = video.error;
          rejectSeek(new Error(`Frame zoeken mislukt rond ${time.toFixed(2)}s: ${err?.message || `Decoderfout (code: ${err?.code ?? 'onbekend'})`}`));
        };

        const onAbortEvent = () => {
          cleanupListeners();
          rejectSeek(new Error('Video-extractie is geannuleerd.'));
        };

        const cleanupListeners = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          signal?.removeEventListener('abort', onAbortEvent);
        };

        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        signal?.addEventListener('abort', onAbortEvent, { once: true });

        video.currentTime = time;
      });
    };

    const run = async () => {
      try {
        if (signal?.aborted) {
          throw new Error('Video-extractie is geannuleerd.');
        }
        signal?.addEventListener('abort', onAbort);

        video.src = objectUrl;

        await withTimeout(
          waitForEvent('loadedmetadata'),
          15000,
          'Video metadata laden duurt te lang. Probeer een ander bestand of kortere video.'
        );

        if (!video.videoWidth || !video.videoHeight) {
          await withTimeout(
            waitForEvent('loadeddata'),
            15000,
            'Video beelddata laden duurt te lang. Probeer een ander bestand of lagere resolutie.'
          );
        }

        if (!video.videoWidth || !video.videoHeight) {
          throw new Error('Video bevat geen geldige afmetingen.');
        }

        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error('Videoduur kon niet worden bepaald.');
        }

        const actualStart = Math.max(0, startTime);
        const actualEndTime = Math.min(Math.max(actualStart, endTime), duration);
        const totalSeconds = Math.max(0, actualEndTime - actualStart);
        const totalFrames = Math.max(0, Math.floor(totalSeconds * fps));
        const frames: Frame[] = [];

        if (totalFrames === 0) {
          settled = true;
          cleanup();
          resolve(frames);
          return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          throw new Error('Canvas initialiseren is mislukt.');
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const interval = 1 / fps;

        for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
          if (signal?.aborted) {
            throw new Error('Video-extractie is geannuleerd.');
          }

          const targetTime = Math.min(actualStart + currentFrame * interval, Math.max(actualStart, actualEndTime - 0.0001));

          await withTimeout(
            waitForSeeked(targetTime),
            12000,
            `Frame zoeken duurt te lang rond ${targetTime.toFixed(2)}s. Probeer minder FPS of een korter fragment.`
          );

          ctx.drawImage(video, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const trimmedBox = getTrimmedBox(imageData);

          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
          if (blob) {
            frames.push({
              id: crypto.randomUUID(),
              blob,
              url: URL.createObjectURL(blob),
              index: currentFrame,
              originalWidth: video.videoWidth,
              originalHeight: video.videoHeight,
              trimmedBox,
              durationMultiplier: 1,
              offset: { x: 0, y: 0 }
            });
          }

          onProgress(Math.min(1, (currentFrame + 1) / totalFrames));
        }

        settled = true;
        cleanup();
        resolve(frames);
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Onbekende fout tijdens video-extractie.');
      }
    };

    run();
  });
}

export function getTrimmedBox(imageData: ImageData, threshold = 10) {
  const { width, height, data } = imageData;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export async function areFramesSimilar(frameA: Frame, frameB: Frame, threshold = 0.005): Promise<boolean> {
  if (!frameA?.url || !frameB?.url) return false;
  
  const imgA = new Image();
  imgA.src = frameA.url;
  const imgB = new Image();
  imgB.src = frameB.url;

  await Promise.all([
    new Promise(r => imgA.onload = r),
    new Promise(r => imgB.onload = r)
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  // Use a slightly larger scale for better precision
  canvas.width = 64;
  canvas.height = 64;

  ctx.drawImage(imgA, 0, 0, 64, 64);
  const dataA = ctx.getImageData(0, 0, 64, 64).data;

  ctx.clearRect(0, 0, 64, 64);
  ctx.drawImage(imgB, 0, 0, 64, 64);
  const dataB = ctx.getImageData(0, 0, 64, 64).data;

  let diff = 0;
  for (let i = 0; i < dataA.length; i += 4) {
    // Compare RGB and Alpha
    diff += Math.abs(dataA[i] - dataB[i]);
    diff += Math.abs(dataA[i+1] - dataB[i+1]);
    diff += Math.abs(dataA[i+2] - dataB[i+2]);
    diff += Math.abs(dataA[i+3] - dataB[i+3]);
  }

  const maxDiff = 64 * 64 * 4 * 255;
  const result = (diff / maxDiff);
  
  return result < threshold;
}

export async function findDuplicateFrames(frames: Frame[], threshold: number, onProgress?: (p: number) => void): Promise<Set<string>> {
  const duplicates = new Set<string>();
  if (frames.length < 2) return duplicates;

  // We primarily check consecutive frames as they are the most likely duplicates in a video sequence
  for (let i = 0; i < frames.length - 1; i++) {
    const isSimilar = await areFramesSimilar(frames[i], frames[i + 1], threshold);
    if (isSimilar) {
      duplicates.add(frames[i + 1].id);
    }
    if (onProgress && i % 5 === 0) onProgress((i + 1) / (frames.length - 1));
  }

  return duplicates;
}

export function autoAlignFrames(frames: Frame[]): Frame[] {
  return frames.map(frame => {
    if (!frame.trimmedBox) return frame;

    const centerX = frame.originalWidth / 2;
    const centerY = frame.originalHeight / 2;

    const spriteCenterX = frame.trimmedBox.x + frame.trimmedBox.w / 2;
    const spriteCenterY = frame.trimmedBox.y + frame.trimmedBox.h / 2;

    const offsetX = centerX - spriteCenterX;
    const offsetY = centerY - spriteCenterY;

    return {
      ...frame,
      offset: { x: offsetX, y: offsetY }
    };
  });
}

export function isPowerOfTwo(n: number) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function getNextPowerOfTwo(n: number) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

export interface PackedFrame extends Frame {
  x: number;
  y: number;
  width: number;
  height: number;
  sheetIndex: number;
}

export interface PackedResult {
  width: number;
  height: number;
  frames: PackedFrame[];
}

export function packSprites(
  frames: Frame[],
  padding: number,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  multipack: boolean = false
): PackedResult[] {
  // Sort frames by height for cleaner shelf packing
  const sortedFrames = [...frames].sort((a, b) => {
    const hA = a.trimmedBox ? a.trimmedBox.h : a.originalHeight;
    const hB = b.trimmedBox ? b.trimmedBox.h : b.originalHeight;
    return hB - hA;
  });

  const results: PackedResult[] = [];
  let currentSheetFrames: PackedFrame[] = [];
  let currentX = 0;
  let currentY = 0;
  let shelfHeight = 0;
  let sheetWidth = 0;
  let sheetHeight = 0;
  let sheetIndex = 0;

  const startNewSheet = () => {
    if (currentSheetFrames.length > 0) {
      results.push({
        width: sheetWidth,
        height: sheetHeight,
        frames: currentSheetFrames
      });
    }
    currentSheetFrames = [];
    currentX = 0;
    currentY = 0;
    shelfHeight = 0;
    sheetWidth = 0;
    sheetHeight = 0;
    sheetIndex++;
  };

  for (const frame of sortedFrames) {
    const fw = (frame.trimmedBox ? frame.trimmedBox.w : frame.originalWidth) + padding * 2;
    const fh = (frame.trimmedBox ? frame.trimmedBox.h : frame.originalHeight) + padding * 2;

    // Check if single sprite exceeds max sheet size
    if (fw > maxWidth || fh > maxHeight) {
      console.error(`Sprite ${frame.id} is larger than maximum sheet size.`);
      // We skip it or force it, but let's just place it in its own sheet for now if possible
    }

    if (currentX + fw > maxWidth) {
      currentX = 0;
      currentY += shelfHeight;
      shelfHeight = 0;
    }

    // Check if we exceed maxHeight for this sheet
    if (currentY + fh > maxHeight) {
      if (multipack) {
        startNewSheet();
        // Recalculate for the new sheet
        currentX = 0;
        currentY = 0;
        shelfHeight = 0;
      } else {
        console.warn('SpriteSheet: Exceeded maxHeight, frames will be clipped');
      }
    }

    currentSheetFrames.push({
      ...frame,
      x: currentX + padding,
      y: currentY + padding,
      width: fw - padding * 2,
      height: fh - padding * 2,
      sheetIndex
    });

    currentX += fw;
    shelfHeight = Math.max(shelfHeight, fh);
    sheetWidth = Math.max(sheetWidth, currentX);
    sheetHeight = Math.max(sheetHeight, currentY + shelfHeight);
  }

  // Add the last sheet
  if (currentSheetFrames.length > 0) {
    results.push({
      width: sheetWidth,
      height: sheetHeight,
      frames: currentSheetFrames
    });
  }

  return results;
}

export async function generateSpriteSheet(
  frames: Frame[],
  settings: SpriteSheetSettings
): Promise<{ url: string; packedData?: any; blob?: Blob; multipleResults?: { url: string; blob: Blob; width: number; height: number; frames: PackedFrame[] }[] }> {
  // Helper to load images
  const images = await Promise.all(
    frames.map(frame => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image for frame ${frame.id}`));
      img.src = frame.url;
    }))
  );

  let packedResults: PackedResult[] = [];

  if (settings.packingMethod === 'bin') {
    packedResults = packSprites(frames, settings.padding, settings.maxWidth, settings.maxHeight, true); // Multipack always on for bin for now
  } else {
    // Grid packing (we don't multipack grid for simplicity, or we can)
    const cellWidth = settings.frameSize.width + settings.padding * 2;
    const cellHeight = settings.frameSize.height + settings.padding * 2;
    
    // Calculate how many fit per sheet
    const colsPerSheet = Math.floor(settings.maxWidth / cellWidth);
    const rowsPerSheet = Math.floor(settings.maxHeight / cellHeight);
    const framesPerSheet = colsPerSheet * rowsPerSheet;

    if (framesPerSheet <= 0) {
       // Sprite too big for max size, just do 1 per sheet
       frames.forEach((f, i) => {
         packedResults.push({
           width: cellWidth,
           height: cellHeight,
           frames: [{ ...f, x: settings.padding, y: settings.padding, width: settings.frameSize.width, height: settings.frameSize.height, sheetIndex: i }]
         });
       });
    } else {
      const numSheets = Math.ceil(frames.length / framesPerSheet);
      for (let s = 0; s < numSheets; s++) {
        const sheetFrames: PackedFrame[] = [];
        const framesInThisSheet = frames.slice(s * framesPerSheet, (s + 1) * framesPerSheet);
        
        framesInThisSheet.forEach((f, i) => {
          const col = i % colsPerSheet;
          const row = Math.floor(i / colsPerSheet);
          sheetFrames.push({
            ...f,
            x: col * cellWidth + settings.padding,
            y: row * cellHeight + settings.padding,
            width: settings.frameSize.width,
            height: settings.frameSize.height,
            sheetIndex: s
          });
        });

        packedResults.push({
          width: Math.min(colsPerSheet * cellWidth, settings.maxWidth),
          height: Math.min(Math.ceil(framesInThisSheet.length / colsPerSheet) * cellHeight, settings.maxHeight),
          frames: sheetFrames
        });
      }
    }
  }

  const finalResults = await Promise.all(packedResults.map(async (pr) => {
    let finalWidth = pr.width;
    let finalHeight = pr.height;

    if (settings.powerOfTwo) {
      finalWidth = getNextPowerOfTwo(finalWidth);
      finalHeight = getNextPowerOfTwo(finalHeight);
    }

    if (settings.forceSquare) {
      const size = Math.max(finalWidth, finalHeight);
      finalWidth = size;
      finalHeight = size;
      if (settings.powerOfTwo) {
        const potSize = getNextPowerOfTwo(size);
        finalWidth = potSize;
        finalHeight = potSize;
      }
    }

    finalWidth = Math.min(finalWidth, settings.maxWidth);
    finalHeight = Math.min(finalHeight, settings.maxHeight);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No ctx');
    
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pr.frames.forEach(pf => {
      const imgIndex = frames.findIndex(f => f.id === pf.id);
      const img = images[imgIndex];
      if (settings.trimSprites && pf.trimmedBox) {
        ctx.drawImage(
          img,
          pf.trimmedBox.x, pf.trimmedBox.y, pf.trimmedBox.w, pf.trimmedBox.h,
          pf.x, pf.y, pf.trimmedBox.w, pf.trimmedBox.h
        );
      } else {
        const targetW = pf.width;
        const targetH = pf.height;
        const drawX = pf.x + (targetW - img.width) / 2 + (pf.offset?.x || 0);
        const drawY = pf.y + (targetH - img.height) / 2 + (pf.offset?.y || 0);
        ctx.drawImage(img, drawX, drawY);
      }
    });

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('No blob');

    return {
      url: URL.createObjectURL(blob),
      blob,
      width: finalWidth,
      height: finalHeight,
      frames: pr.frames
    };
  }));

  return {
    url: finalResults[0].url,
    blob: finalResults[0].blob,
    packedData: {
      width: finalResults[0].width,
      height: finalResults[0].height,
      frames: finalResults[0].frames
    },
    multipleResults: finalResults
  };
}
