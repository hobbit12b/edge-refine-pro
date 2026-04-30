import { removeBackground as removeBackgroundImgly, Config } from '@imgly/background-removal';
import { Frame } from '../types';

let isModelLoaded = false;

export async function initBackgroundRemoval(onProgress?: (progress: number) => void) {
  // @imgly/background-removal handles its own loading. 
  // We can just return a dummy resolved promise or check status.
  return Promise.resolve();
}

export async function removeBackground(frame: Frame, onProgress?: (progress: number) => void): Promise<Blob> {
  try {
    const config: Config = {
      debug: true, // Enable debug logging to help diagnose issues in console
      model: 'isnet', // Standard model for imgly
      output: {
        format: 'image/png',
        quality: 0.95,
      },
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          onProgress(current / total);
        }
      }
    };

    // The library handles its own WASM and model downloading.
    // Ensure we have a blob (convert data URL if needed)
    let input: Blob;
    if (typeof frame.blob === 'string' && (frame.blob as string).startsWith('data:')) {
      const resp = await fetch(frame.blob);
      input = await resp.blob();
    } else {
      // Re-wrap blob to ensure it is a File with a type if missing/mismatch
      if (frame.blob instanceof Blob) {
        input = new File([frame.blob], `frame_${frame.id}.png`, { type: 'image/png' });
      } else {
        input = frame.blob;
      }
    }
    
    const resultBlob = await removeBackgroundImgly(input, config);
    isModelLoaded = true;
    return resultBlob;
  } catch (error) {
    console.error('Error removing background with imgly:', error);
    throw error;
  }
}
