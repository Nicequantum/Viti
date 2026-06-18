export interface CompressedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function compressImageForStorage(
  file: File,
  maxDim = 1400,
  quality = 0.72
): Promise<CompressedImage> {
  const img = await loadImage(file);
  try {
    let { width, height } = img;
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const dataUrl = await fileToDataUrl(file);
      return { dataUrl, blob: file, width: img.width, height: img.height };
    }

    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToJpegBlob(canvas, quality);
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, blob, width, height };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))),
      'image/jpeg',
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return blobToDataUrl(file);
}

export async function dataUrlToFile(dataUrl: string, filename = 'image.jpg'): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}