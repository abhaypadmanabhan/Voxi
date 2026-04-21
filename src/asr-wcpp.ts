import { Whisper } from 'smart-whisper';
import { cpus } from 'node:os';
import { ensureWhisperModel } from './model-loader.js';

let _whisper: Whisper | null = null;
let _loadPromise: Promise<Whisper> | null = null;

async function getWhisper(): Promise<Whisper> {
  if (_whisper) return _whisper;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const modelPath = await ensureWhisperModel((m) => console.log(m));
    console.log(`[asr-wcpp] loading model from ${modelPath} (gpu=Metal)...`);
    const t0 = Date.now();
    // offload is in seconds (internally setTimeout(_, offload * 1000)). Infinity * 1000
    // overflows int32 → clamped to 1ms → model reloads each call. Use 24h instead.
    const w = new Whisper(modelPath, { gpu: true, offload: 86400 });
    await w.load();
    console.log(`[asr-wcpp] model loaded in ${Date.now() - t0}ms`);
    _whisper = w;
    return w;
  })();

  try {
    return await _loadPromise;
  } catch (err) {
    _loadPromise = null;
    throw err;
  }
}

export async function initMoonshine(): Promise<void> {
  const t0 = Date.now();
  const w = await getWhisper();
  console.log(`[asr-wcpp] init total ${Date.now() - t0}ms`);

  // Warmup: 1s silence through full pipeline
  const silence = new Float32Array(16000);
  try {
    const tWarm = Date.now();
    const task = await w.transcribe(silence, {
      language: 'en',
      n_threads: Math.max(1, cpus().length - 1),
      no_timestamps: true,
      single_segment: true,
      suppress_non_speech_tokens: true,
    });
    const results = await task.result;
    const text = results.map((r) => r.text).join('').trim();
    console.log(`[asr-wcpp] warmup inference ${Date.now() - tWarm}ms, text="${text}"`);
  } catch (err) {
    console.warn('[asr-wcpp] warmup failed (non-fatal):', err);
  }
}

function pcm16ToFloat32(pcmBuffer: Buffer): Float32Array {
  const sampleCount = Math.floor(pcmBuffer.byteLength / 2);
  const view = new DataView(pcmBuffer.buffer, pcmBuffer.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768.0;
  }
  return float32;
}

function deRepeat(text: string): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let run = 1;
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].toLowerCase() === words[i - 1].toLowerCase()) {
      run++;
      if (run > 2) continue;
    } else {
      run = 1;
    }
    out.push(words[i]);
  }
  const dominant = out.reduce<Record<string, number>>((acc, w) => {
    const k = w.toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const maxFreq = Math.max(...Object.values(dominant));
  if (out.length > 4 && maxFreq / out.length > 0.5) return '';
  return out.join(' ');
}

export async function transcribeAudio(base64Pcm: string): Promise<string> {
  const float32 = pcm16ToFloat32(Buffer.from(base64Pcm, 'base64'));

  let peak = 0;
  let rmsAccum = 0;
  for (let i = 0; i < float32.length; i++) {
    const v = Math.abs(float32[i]);
    if (v > peak) peak = v;
    rmsAccum += v * v;
  }
  const rms = Math.sqrt(rmsAccum / float32.length);
  console.log(`[asr-wcpp] audio peak=${peak.toFixed(3)} rms=${rms.toFixed(4)} samples=${float32.length} dur=${(float32.length / 16000).toFixed(2)}s`);
  if (peak < 0.002) {
    console.warn('[asr-wcpp] audio effectively silent — check mic permission / input device');
    return '';
  }

  const w = await getWhisper();
  const tInfer = Date.now();
  const task = await w.transcribe(float32, {
    language: 'en',
    n_threads: Math.max(1, cpus().length - 1),
    no_timestamps: true,
    single_segment: false,
    suppress_non_speech_tokens: true,
    temperature: 0.0,
  });
  const results = await task.result;
  const raw = results.map((r) => r.text).join(' ').trim();
  console.log(`[asr-wcpp] inference ${Date.now() - tInfer}ms, segments=${results.length}, text="${raw}"`);

  const cleaned = deRepeat(raw);
  if (raw && !cleaned) {
    console.warn(`[asr-wcpp] deRepeat zeroed output. raw="${raw.slice(0, 120)}"`);
  }
  return cleaned;
}

/**
 * Streaming-during-capture: encode a partial audio buffer and return best-effort text.
 * Called on each audio_chunk; caller discards intermediate results and uses final transcribeAudio on end_stream.
 * The benefit is that whisper.cpp may cache compute / warm kernels, and we can emit partial hypotheses for UI.
 */
export async function transcribePartial(base64Pcm: string): Promise<string> {
  const float32 = pcm16ToFloat32(Buffer.from(base64Pcm, 'base64'));
  if (float32.length < 16000) return ''; // skip <1s — whisper has 1s minimum mel window

  let peak = 0;
  for (let i = 0; i < float32.length; i++) {
    const v = Math.abs(float32[i]);
    if (v > peak) peak = v;
  }
  if (peak < 0.002) return '';

  const w = await getWhisper();
  const t0 = Date.now();
  const task = await w.transcribe(float32, {
    language: 'en',
    n_threads: Math.max(1, cpus().length - 1),
    no_timestamps: true,
    single_segment: true,
    suppress_non_speech_tokens: true,
    temperature: 0.0,
    no_context: true,
  });
  const results = await task.result;
  const raw = results.map((r) => r.text).join(' ').trim();
  console.log(`[asr-wcpp] partial ${Date.now() - t0}ms dur=${(float32.length / 16000).toFixed(2)}s text="${raw.slice(0, 60)}"`);
  return deRepeat(raw);
}
