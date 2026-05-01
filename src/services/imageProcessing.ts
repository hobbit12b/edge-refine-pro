// Pure-canvas image processing helpers for color removal & edge refinement.
// All functions take and return RGBA Blobs (PNG) so they slot into the
// existing frame pipeline.

export interface RGB { r: number; g: number; b: number; }

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

async function blobToImageData(blob: Blob): Promise<{ data: ImageData; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas, ctx };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imageDataToBlob(canvas: HTMLCanvasElement, imageData: ImageData): Promise<Blob> {
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

/**
 * Pick the most common color along the outermost border of an image.
 * Useful as a fallback when the user hasn't picked a color manually.
 */
export async function autoDetectBackgroundColor(blob: Blob): Promise<string> {
  const { data } = await blobToImageData(blob);
  const { width: w, height: h, data: px } = data;
  const buckets = new Map<number, number>();
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 200) return;
    // Quantize to 5-bit per channel for grouping similar shades.
    const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  let best = 0, bestKey = 0;
  buckets.forEach((v, k) => { if (v > best) { best = v; bestKey = k; } });
  const r = ((bestKey >> 10) & 31) << 3;
  const g = ((bestKey >> 5) & 31) << 3;
  const b = (bestKey & 31) << 3;
  return rgbToHex({ r, g, b });
}

/**
 * Read a single pixel's color as hex. x,y are integers in image coords.
 */
export async function pickPixelColor(blob: Blob, x: number, y: number): Promise<string> {
  const { data } = await blobToImageData(blob);
  const i = (y * data.width + x) * 4;
  return rgbToHex({ r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] });
}

/**
 * Color-based background removal.
 * - tolerance: 0..100 (mapped to 0..255 distance threshold internally)
 * - mode 'connected': flood fill starting from all 4 borders. Best for sprites
 *   with isolated pixels matching the bg color inside the subject.
 * - mode 'all': mark every pixel within tolerance globally.
 * - softEdge: anti-aliases the alpha falloff in the band [tol, tol*1.6).
 */
export async function removeColorFromBlob(
  blob: Blob,
  hexColor: string,
  tolerance: number,
  mode: "connected" | "all" = "connected",
  softEdge = true,
): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  const { width: w, height: h, data: px } = data;
  const target = hexToRgb(hexColor);
  const tol = Math.max(0, Math.min(100, tolerance)) * 4.42; // 0..442 (sqrt(3*255^2))
  const softTol = tol * 1.6;

  const dist = (i: number) => {
    const dr = px[i] - target.r;
    const dg = px[i + 1] - target.g;
    const db = px[i + 2] - target.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  if (mode === "all") {
    for (let i = 0; i < px.length; i += 4) {
      const d = dist(i);
      if (d <= tol) {
        px[i + 3] = 0;
      } else if (softEdge && d < softTol) {
        const t = (d - tol) / (softTol - tol);
        px[i + 3] = Math.round(px[i + 3] * t);
      }
    }
  } else {
    // Flood fill from borders. Use a Uint8Array visited mask.
    const visited = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const idx = y * w + x;
      if (visited[idx]) return;
      const i = idx * 4;
      const d = dist(i);
      if (d > softTol) return;
      visited[idx] = 1;
      if (d <= tol) {
        px[i + 3] = 0;
      } else if (softEdge) {
        const t = (d - tol) / (softTol - tol);
        px[i + 3] = Math.round(px[i + 3] * t);
      } else {
        return; // don't propagate past hard threshold when soft off
      }
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      push(x, y);
    }
  }

  return imageDataToBlob(canvas, data);
}

/**
 * Remove a connected area from a clicked point using color tolerance.
 * Only pixels connected 4-directionally to the clicked pixel are affected.
 */
export async function removeConnectedAreaFromBlob(
  blob: Blob,
  x: number,
  y: number,
  tolerance: number,
): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  const { width: w, height: h, data: px } = data;
  if (x < 0 || y < 0 || x >= w || y >= h) return blob;

  const seedIdx = (y * w + x) * 4;
  const seed = { r: px[seedIdx], g: px[seedIdx + 1], b: px[seedIdx + 2] };
  const tol = Math.max(0, Math.min(100, tolerance)) * 4.42;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [x, y];
  let removedCount = 0;

  const dist = (i: number) => {
    const dr = px[i] - seed.r;
    const dg = px[i + 1] - seed.g;
    const db = px[i + 2] - seed.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const i = idx * 4;
    if (dist(i) > tol) continue;
    px[i + 3] = 0;
    removedCount++;
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }

  if (removedCount === 0) return blob;
  return imageDataToBlob(canvas, data);
}

export async function restoreConnectedAreaFromOriginalBlob(
  currentBlob: Blob,
  originalBlob: Blob,
  x: number,
  y: number,
  tolerance: number,
): Promise<Blob> {
  const { data: currentData, canvas } = await blobToImageData(currentBlob);
  const { data: originalData } = await blobToImageData(originalBlob);
  const { width: w, height: h, data: curPx } = currentData;
  const origPx = originalData.data;
  if (originalData.width !== w || originalData.height !== h) {
    throw new Error('Current and original frame dimensions differ.');
  }
  if (x < 0 || y < 0 || x >= w || y >= h) return currentBlob;

  const seedIdx = (y * w + x) * 4;
  const tol = Math.max(0, Math.min(100, tolerance)) * 4.42;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const isTransparentAt = (idx: number) => curPx[idx + 3] === 0;
  let seedColor = { r: curPx[seedIdx], g: curPx[seedIdx + 1], b: curPx[seedIdx + 2] };
  let seedFromTransparent = isTransparentAt(seedIdx);

  if (seedFromTransparent) {
    stack.push(x, y);
  } else {
    const probe = [x + 1, y, x - 1, y, x, y + 1, x, y - 1];
    for (let i = 0; i < probe.length; i += 2) {
      const nx = probe[i], ny = probe[i + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = (ny * w + nx) * 4;
      if (isTransparentAt(ni)) { seedFromTransparent = true; break; }
    }
    stack.push(x, y);
  }

  const distToSeed = (i: number) => {
    const dr = curPx[i] - seedColor.r;
    const dg = curPx[i + 1] - seedColor.g;
    const db = curPx[i + 2] - seedColor.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  let restoredCount = 0;
  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const i = idx * 4;

    if (seedFromTransparent) {
      if (!isTransparentAt(i)) continue;
    } else {
      if (distToSeed(i) > tol) continue;
    }

    curPx[i] = origPx[i];
    curPx[i + 1] = origPx[i + 1];
    curPx[i + 2] = origPx[i + 2];
    curPx[i + 3] = origPx[i + 3];
    restoredCount++;
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }

  if (restoredCount === 0) {
    throw new Error('Geen herstelbaar verbonden vlak gevonden.');
  }
  return imageDataToBlob(canvas, currentData);
}

// ---------- Alpha morphology ----------

function alphaMorph(data: ImageData, mode: "erode" | "dilate", iterations: number): void {
  const { width: w, height: h, data: px } = data;
  for (let it = 0; it < iterations; it++) {
    const src = new Uint8ClampedArray(px); // snapshot of alpha source
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let acc = src[(y * w + x) * 4 + 3];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const a = src[(ny * w + nx) * 4 + 3];
            acc = mode === "erode" ? Math.min(acc, a) : Math.max(acc, a);
          }
        }
        px[(y * w + x) * 4 + 3] = acc;
      }
    }
  }
}

export async function erodeAlpha(blob: Blob, px: number): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  alphaMorph(data, "erode", Math.max(1, Math.round(px)));
  return imageDataToBlob(canvas, data);
}

export async function dilateAlpha(blob: Blob, px: number): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  alphaMorph(data, "dilate", Math.max(1, Math.round(px)));
  return imageDataToBlob(canvas, data);
}

/**
 * Feather/blur the alpha channel only (color stays intact).
 */
export async function featherAlpha(blob: Blob, radius: number): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  const r = Math.max(1, Math.round(radius));
  const { width: w, height: h, data: px } = data;
  // Simple separable box blur on alpha channel only, weighted boxes ≈ Gaussian.
  const passes = 2;
  for (let p = 0; p < passes; p++) {
    const src = new Uint8ClampedArray(px);
    // Horizontal
    for (let y = 0; y < h; y++) {
      let sum = 0; let count = 0;
      for (let x = -r; x <= r; x++) {
        const sx = Math.max(0, Math.min(w - 1, x));
        sum += src[(y * w + sx) * 4 + 3]; count++;
      }
      for (let x = 0; x < w; x++) {
        px[(y * w + x) * 4 + 3] = sum / count;
        const out = x - r; const inn = x + r + 1;
        if (out >= 0) sum -= src[(y * w + out) * 4 + 3];
        else count--;
        if (inn < w) sum += src[(y * w + inn) * 4 + 3];
        else count--;
      }
    }
    const src2 = new Uint8ClampedArray(px);
    // Vertical
    for (let x = 0; x < w; x++) {
      let sum = 0; let count = 0;
      for (let y = -r; y <= r; y++) {
        const sy = Math.max(0, Math.min(h - 1, y));
        sum += src2[(sy * w + x) * 4 + 3]; count++;
      }
      for (let y = 0; y < h; y++) {
        px[(y * w + x) * 4 + 3] = sum / count;
        const out = y - r; const inn = y + r + 1;
        if (out >= 0) sum -= src2[(out * w + x) * 4 + 3];
        else count--;
        if (inn < h) sum += src2[(inn * w + x) * 4 + 3];
        else count--;
      }
    }
  }
  return imageDataToBlob(canvas, data);
}

/**
 * Decontaminate edge pixels: estimate the original subject color by removing
 * the contribution of the (known) background color from semi-transparent pixels.
 * Formula per pixel with 0 < alpha < 255:
 *   c_out = (c_in - bg * (1 - a)) / a   clamped to 0..255
 */
export async function decontaminateColors(blob: Blob, hexBg: string): Promise<Blob> {
  const { data, canvas } = await blobToImageData(blob);
  const bg = hexToRgb(hexBg);
  const { data: px } = data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a > 0 && a < 255) {
      const af = a / 255;
      const inv = 1 - af;
      px[i]     = Math.max(0, Math.min(255, (px[i]     - bg.r * inv) / af));
      px[i + 1] = Math.max(0, Math.min(255, (px[i + 1] - bg.g * inv) / af));
      px[i + 2] = Math.max(0, Math.min(255, (px[i + 2] - bg.b * inv) / af));
    }
  }
  return imageDataToBlob(canvas, data);
}
