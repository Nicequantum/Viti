import Tesseract from 'tesseract.js';

const OCR_TIMEOUT_MS = 120_000;
const MAX_DIM_FAST = 1600;
const MAX_DIM_FULL = 2200;

const TESSERACT_OPTS = {
  workerPath: '/tesseract/worker.min.js',
  langPath: '/tesseract',
  corePath: '/tesseract',
  gzip: true,
  workerBlobURL: false,
} as const;

type OcrPageSegMode = '4' | '6' | '11';

interface TesseractLoggerMessage {
  status: string;
  progress: number;
}

let sharedWorker: Tesseract.Worker | null = null;
let workerInitPromise: Promise<Tesseract.Worker> | null = null;
let progressListener: ((p: number) => void) | null = null;
let ocrJobChain: Promise<unknown> = Promise.resolve();

function withOcrLock<T>(fn: () => Promise<T>): Promise<T> {
  const job = ocrJobChain.then(() => fn());
  ocrJobChain = job.then(() => undefined).catch(() => undefined);
  return job;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function getSharedWorker(): Promise<Tesseract.Worker> {
  if (sharedWorker) return sharedWorker;
  if (!workerInitPromise) {
    workerInitPromise = Tesseract.createWorker('eng', 1, {
      ...TESSERACT_OPTS,
      logger: (message: TesseractLoggerMessage) => {
        if (message.status === 'recognizing text' && progressListener) {
          progressListener(Math.round(message.progress * 100));
        }
      },
    }).then((worker) => {
      sharedWorker = worker;
      return worker;
    });
  }
  return workerInitPromise;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for OCR'));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode preprocessed image'))),
      'image/png',
      0.92
    );
  });
}

async function preprocessFast(file: File): Promise<Blob> {
  const img = await loadImage(file);
  try {
    let w = img.width;
    let h = img.height;
    if (Math.max(w, h) > MAX_DIM_FAST) {
      const scale = MAX_DIM_FAST / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    let minV = 255;
    let maxV = 0;
    for (let i = 0; i < data.length; i += 4) {
      minV = Math.min(minV, data[i]);
      maxV = Math.max(maxV, data[i]);
    }
    const range = Math.max(1, maxV - minV);
    for (let i = 0; i < data.length; i += 4) {
      let v = Math.round(((data[i] - minV) / range) * 255);
      v = Math.min(255, Math.max(0, Math.round((v - 128) * 1.8 + 128)));
      const binary = v > 140 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }
    ctx.putImageData(imageData, 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

async function preprocessFull(file: File): Promise<Blob> {
  const img = await loadImage(file);
  try {
    let w = img.width;
    let h = img.height;
    if (Math.max(w, h) > MAX_DIM_FULL) {
      const scale = MAX_DIM_FULL / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    let minV = 255;
    let maxV = 0;
    for (let i = 0; i < data.length; i += 4) {
      minV = Math.min(minV, data[i]);
      maxV = Math.max(maxV, data[i]);
    }
    const range = Math.max(1, maxV - minV);
    for (let i = 0; i < data.length; i += 4) {
      let v = Math.round(((data[i] - minV) / range) * 255);
      v = Math.min(255, Math.max(0, Math.round((v - 128) * 2.2 + 128)));
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    const threshold = 140;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    return await canvasToBlob(canvas);
  } catch (e) {
    console.warn('Full preprocess failed', e);
    return file;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

export async function preprocessImageForOCR(file: File, mode: 'fast' | 'full' = 'fast'): Promise<Blob> {
  try {
    return mode === 'full' ? await preprocessFull(file) : await preprocessFast(file);
  } catch (e) {
    console.warn('Preprocess failed', e);
    return file;
  }
}

export async function runOCR(
  imageSource: Blob | File,
  onProgress?: (p: number) => void,
  pageSegMode: OcrPageSegMode = '6'
): Promise<string> {
  return withOcrLock(async () => {
    const localProgress = onProgress ?? null;
    progressListener = localProgress;
    const recognize = async () => {
      const worker = await getSharedWorker();
      const {
        data: { text },
      } = await worker.recognize(imageSource, {
        // Tesseract.js accepts engine-specific keys at runtime
        ...({
          tessedit_pageseg_mode: pageSegMode,
          tessedit_oem: '3',
          tessedit_char_whitelist:
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;/-_()[]#%&*+=@\'" \n',
        } as Record<string, string | number>),
      });
      return text;
    };
    if (localProgress) localProgress(5);
    try {
      const text = await withTimeout(recognize(), OCR_TIMEOUT_MS, 'On-device OCR');
      if (localProgress) localProgress(100);
      return text;
    } finally {
      if (progressListener === localProgress) progressListener = null;
    }
  });
}

export async function runMultiPassOCR(file: File, onProgress?: (p: number) => void): Promise<string> {
  const full = await preprocessImageForOCR(file, 'full');
  const fast = await preprocessImageForOCR(file, 'fast');
  const pass1 = await runOCR(full, onProgress ? (p) => onProgress(Math.round(p * 0.35)) : undefined, '6');
  const pass2 = await runOCR(fast, onProgress ? (p) => onProgress(35 + Math.round(p * 0.35)) : undefined, '6');
  const pass3 = await runOCR(file, onProgress ? (p) => onProgress(70 + Math.round(p * 0.3)) : undefined, '6');
  const parts = [pass1, pass2, pass3].map((p) => p?.trim()).filter(Boolean) as string[];
  if (parts.length === 0) return '';
  return parts.reduce((a, b) => (b.length > a.length ? b : a));
}