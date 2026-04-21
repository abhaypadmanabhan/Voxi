import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// ggml-small.en.bin — 464MB, Metal-accelerated via whisper.cpp
const GGML_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin';
const GGML_FILENAME = 'ggml-small.en.bin';
const GGML_MIN_BYTES = 400_000_000;

export function modelDir(): string {
  const base = process.env.VOXI_MODEL_DIR || join(homedir(), '.cache', 'voxi');
  return join(base, 'whisper-cpp');
}

export function modelPath(): string {
  return join(modelDir(), GGML_FILENAME);
}

function fileOk(path: string, minBytes: number): boolean {
  if (!existsSync(path)) return false;
  try {
    return statSync(path).size >= minBytes;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(destPath));
}

let _readyPromise: Promise<string> | null = null;

/** Ensure the GGML model file is present locally. Returns the file path. */
export function ensureWhisperModel(onProgress?: (msg: string) => void): Promise<string> {
  if (_readyPromise) return _readyPromise;
  _readyPromise = (async () => {
    const dir = modelDir();
    mkdirSync(dir, { recursive: true });
    const dest = modelPath();

    if (fileOk(dest, GGML_MIN_BYTES)) {
      onProgress?.(`[model] cached at ${dest}`);
      return dest;
    }

    onProgress?.(`[model] downloading ${GGML_FILENAME} (~464MB) to ${dir}`);
    const t0 = Date.now();
    await downloadFile(GGML_URL, dest);
    const size = statSync(dest).size;
    if (size < GGML_MIN_BYTES) {
      throw new Error(`downloaded ${GGML_FILENAME} too small (${size} < ${GGML_MIN_BYTES})`);
    }
    onProgress?.(`[model] ${GGML_FILENAME} ${(size / 1e6).toFixed(1)}MB in ${Date.now() - t0}ms`);
    return dest;
  })().catch((err) => {
    _readyPromise = null;
    throw err;
  });
  return _readyPromise;
}
