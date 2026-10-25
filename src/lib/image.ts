const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;

export type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

export function targetDimensions(
  width: number,
  height: number,
  maxEdge = MAX_EDGE
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4);
}

async function loadBitmap(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('That image could not be read.'));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscales and re-encodes a photo before upload. Canvas output strips EXIF metadata,
 * including location data. The image is never persisted by the app.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a photo of your meal.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('That photo is too large. Try a smaller image.');
  }

  const { source, width, height } = await loadBitmap(file);
  const size = targetDimensions(width, height);
  if (size.width === 0 || size.height === 0) {
    throw new Error('That image could not be read.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(source, 0, 0, size.width, size.height);

  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes > 4 * 1024 * 1024) {
    throw new Error('That photo is still too large after resizing.');
  }

  return { dataUrl, width: size.width, height: size.height, bytes };
}
