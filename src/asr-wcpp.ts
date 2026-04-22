import { Whisper, WhisperSamplingStrategy } from 'smart-whisper';
import { cpus } from 'node:os';
import { ensureWhisperModel } from './model-loader.js';

export interface TranscribeOptions {
  /** Optional vocabulary hint: proper nouns / domain terms the user explicitly added. */
  vocabulary?: string[];
  /** Optional active app name for minimal domain context. */
  appName?: string;
}

// Fresh Whisper instance per inference — smart-whisper@0.8.1 leaks graph-allocator /
// KV-cache state across calls (`ggml_gallocr_needs_realloc: KQ_mask` spam + stutter
// repetition "this, this, this") despite no_context:true. Reload neutralizes it.
//
// Warm-spare: keep `_active` for the current call and `_spare` preloaded idle. On
// release, free active, promote spare, refill spare in background. Caller sees
// zero added latency after steady state. ~2x model RAM.
let _active: Whisper | null = null;
let _spare: Whisper | null = null;
let _spareLoading: Promise<Whisper> | null = null;
let _activeLoading: Promise<Whisper> | null = null;
let _modelPath: string | null = null;

async function loadFreshWhisper(): Promise<Whisper> {
  if (!_modelPath) {
    _modelPath = await ensureWhisperModel((m) => console.log(m));
  }
  const t0 = Date.now();
  // offload is in seconds (internally setTimeout(_, offload * 1000)). Infinity * 1000
  // overflows int32 → clamped to 1ms → model reloads each call. Use 24h instead.
  const w = new Whisper(_modelPath, { gpu: true, offload: 86400 });
  await w.load();
  console.log(`[asr-wcpp] model loaded in ${Date.now() - t0}ms`);
  return w;
}

function ensureSpareLoading(): Promise<Whisper> {
  if (_spare) return Promise.resolve(_spare);
  if (_spareLoading) return _spareLoading;
  _spareLoading = loadFreshWhisper()
    .then((w) => {
      _spare = w;
      _spareLoading = null;
      return w;
    })
    .catch((err) => {
      _spareLoading = null;
      throw err;
    });
  return _spareLoading;
}

async function acquire(): Promise<Whisper> {
  if (_active) return _active;
  if (_activeLoading) return _activeLoading;
  // No active yet — promote spare if ready, else load one directly.
  if (_spare) {
    _active = _spare;
    _spare = null;
    // Kick off spare refill in background; don't await.
    void ensureSpareLoading().catch((err) =>
      console.warn('[asr-wcpp] spare refill failed:', err),
    );
    return _active;
  }
  _activeLoading = loadFreshWhisper()
    .then((w) => {
      _active = w;
      _activeLoading = null;
      return w;
    })
    .catch((err) => {
      _activeLoading = null;
      throw err;
    });
  return _activeLoading;
}

function release(w: Whisper): void {
  // Fire-and-forget: free the just-used instance, promote spare, refill spare.
  if (_active === w) _active = null;
  void (async () => {
    try {
      await w.free();
    } catch (err) {
      console.warn('[asr-wcpp] free failed:', err);
    }
    if (_spare) {
      _active = _spare;
      _spare = null;
    }
    try {
      await ensureSpareLoading();
    } catch (err) {
      console.warn('[asr-wcpp] spare refill failed:', err);
    }
  })();
}

export async function initMoonshine(): Promise<void> {
  const t0 = Date.now();
  const w = await acquire();
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

  // Preload spare so first real inference also gets a fresh instance.
  void ensureSpareLoading().catch((err) =>
    console.warn('[asr-wcpp] spare preload failed:', err),
  );
}

/**
 * Trim leading + trailing silence. Whisper hallucinates on long silent tails, producing
 * "Play... Play... Play..." repetition loops. Windowed RMS: 20ms frames, keep from first
 * to last frame above threshold, pad each side by 200ms so we don't clip speech onsets.
 */
function trimSilence(pcm: Float32Array, sampleRate = 16000, rmsThold = 0.008): Float32Array {
  const frame = Math.floor(sampleRate * 0.02); // 20ms
  const pad = Math.floor(sampleRate * 0.2); // 200ms
  if (pcm.length <= frame * 3) return pcm;
  let firstVoiced = -1;
  let lastVoiced = -1;
  for (let i = 0; i + frame <= pcm.length; i += frame) {
    let acc = 0;
    for (let j = 0; j < frame; j++) {
      const v = pcm[i + j];
      acc += v * v;
    }
    const rms = Math.sqrt(acc / frame);
    if (rms >= rmsThold) {
      if (firstVoiced < 0) firstVoiced = i;
      lastVoiced = i + frame;
    }
  }
  if (firstVoiced < 0) return pcm; // all silence — let energy gate below handle it
  const start = Math.max(0, firstVoiced - pad);
  const end = Math.min(pcm.length, lastVoiced + pad);
  if (end - start === pcm.length) return pcm;
  return pcm.slice(start, end);
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

/**
 * Build Whisper `initial_prompt` from explicit vocabulary + light app context.
 * whisper.cpp prepends this as "preceding context" tokens — decoder treats the words as
 * recently spoken and gives them higher probability during beam search. Does NOT inject
 * words without acoustic support, unlike regex substitution.
 */
function buildPrompt(opts: TranscribeOptions): string {
  const parts: string[] = [];
  // Skip unknown/empty app — "Dictating in Unknown." is garbage context that hurts decoder.
  if (opts.appName && opts.appName !== 'Unknown') {
    parts.push(`Dictating in ${opts.appName}.`);
  }
  if (opts.vocabulary && opts.vocabulary.length) {
    // Cap at 15 terms — large prompts bias too strongly and may leak into unrelated audio.
    const terms = opts.vocabulary.slice(0, 15).join(', ');
    parts.push(`Vocabulary: ${terms}.`);
  }
  return parts.join(' ').slice(0, 900); // ≈ 200 tokens, under whisper's 224 budget
}

export async function transcribeAudio(base64Pcm: string, opts: TranscribeOptions = {}): Promise<string> {
  const raw32 = pcm16ToFloat32(Buffer.from(base64Pcm, 'base64'));
  const rawDur = (raw32.length / 16000).toFixed(2);
  const float32 = trimSilence(raw32);
  const trimmedDur = (float32.length / 16000).toFixed(2);
  if (raw32.length !== float32.length) {
    console.log(`[asr-wcpp] trimmed silence: ${rawDur}s → ${trimmedDur}s`);
  }

  let peak = 0;
  let rmsAccum = 0;
  for (let i = 0; i < float32.length; i++) {
    const v = Math.abs(float32[i]);
    if (v > peak) peak = v;
    rmsAccum += v * v;
  }
  const rms = Math.sqrt(rmsAccum / float32.length);
  console.log(`[asr-wcpp] audio peak=${peak.toFixed(3)} rms=${rms.toFixed(4)} samples=${float32.length} dur=${trimmedDur}s`);
  if (peak < 0.002) {
    console.warn('[asr-wcpp] audio effectively silent — check mic permission / input device');
    return '';
  }
  // Energy gate: noise-only audio (breath, fan, ambient) → Whisper hallucinates. Skip.
  if (rms < 0.006) {
    console.warn(`[asr-wcpp] audio below speech energy threshold (rms=${rms.toFixed(4)}) — treating as no-speech`);
    return '';
  }

  const initialPrompt = buildPrompt(opts);
  if (initialPrompt) {
    console.log(`[asr-wcpp] initial_prompt="${initialPrompt}"`);
  }

  const w = await acquire();
  const tInfer = Date.now();
  // audio_ctx: whisper pads audio to 30s and decodes the full padded window by default.
  // Setting audio_ctx to ceil(actualDurSeconds/0.02) clamps decoder attention to real audio,
  // preventing hallucination loops on the silent tail. 1500 = full 30s window.
  const audioFrames = Math.min(1500, Math.max(128, Math.ceil(float32.length / 16000 / 0.02)));
  const task = await w.transcribe(float32, {
    strategy: WhisperSamplingStrategy.WHISPER_SAMPLING_BEAM_SEARCH,
    beam_size: 5,
    best_of: 5,
    audio_ctx: audioFrames,
    language: 'en',
    n_threads: Math.max(1, cpus().length - 1),
    no_timestamps: true,
    single_segment: true, // short dictations, avoid cross-segment confusion
    suppress_non_speech_tokens: true,
    suppress_blank: true,
    temperature: 0.0,
    // temperature fallback IS the cure for repetition loops, not the cause. When greedy
    // decode at T=0 enters a loop ("Play... Play... Play..."), whisper retries at T+=0.2
    // and usually escapes. Disabling this (inc=0.0) removed the escape hatch and made
    // stutter unrecoverable once triggered.
    temperature_inc: 0.2,
    // Triggers temperature fallback when decoder entropy too low (i.e., stuck repeating
    // same token). Default is 2.4; 2.8 is stricter = catches loops earlier.
    entropy_thold: 2.8,
    logprob_thold: -1.0,
    no_speech_thold: 0.7,
    no_context: true,        // disables condition_on_previous_text — belt-and-suspenders with per-call reload.
    max_tokens: 224,         // hard cap per segment — bounds worst-case loop length.
    initial_prompt: initialPrompt || undefined,
  });
  const results = await task.result;
  const raw = results.map((r) => r.text).join(' ').trim();
  console.log(`[asr-wcpp] inference ${Date.now() - tInfer}ms, segments=${results.length}, text="${raw}"`);
  // Release (free + promote spare + refill) happens in background — caller returns immediately.
  release(w);

  const cleaned = deRepeat(raw);
  if (raw && !cleaned) {
    console.warn(`[asr-wcpp] deRepeat zeroed output. raw="${raw.slice(0, 120)}"`);
  }
  return cleaned;
}
