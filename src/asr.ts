import { pipeline } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Module-level singleton — initialized once, reused across calls
let _pipe: AutomaticSpeechRecognitionPipeline | null = null

async function getPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (_pipe) return _pipe
  console.log('[asr] loading Whisper-small.en quantized (first run: ~90MB)...')
  _pipe = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-small.en',
    { dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } } as any
  ) as AutomaticSpeechRecognitionPipeline
  console.log('[asr] Whisper ready')
  return _pipe
}

export async function initMoonshine(): Promise<void> {
  const pipe = await getPipeline()
  // Warm graph with 1s silence — first real call otherwise eats compile/allocation cost
  const tWarm = Date.now()
  const silence = new Float32Array(16000)
  try {
    const warmResult = await pipe(silence) as { text?: string }
    console.log(`[asr] warmup inference: ${Date.now() - tWarm}ms, text="${warmResult?.text ?? ''}"`)
  } catch (err) {
    console.warn('[asr] warmup inference failed (non-fatal):', err)
  }
}

// Convert Int16 PCM → Float32 normalized [-1, 1].
// Uses DataView to avoid TypedArray byteOffset alignment constraints on Node Buffer pool.
function pcm16ToFloat32(pcmBuffer: Buffer): Float32Array {
  const sampleCount = Math.floor(pcmBuffer.byteLength / 2)
  const view = new DataView(pcmBuffer.buffer, pcmBuffer.byteOffset, sampleCount * 2)
  const float32 = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768.0
  }
  return float32
}

/** Remove consecutive word repetitions that indicate hallucination (e.g. "tone tone tone..."). */
function deRepeat(text: string): string {
  const words = text.split(/\s+/)
  const out: string[] = []
  let run = 1
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].toLowerCase() === words[i - 1].toLowerCase()) {
      run++
      // Allow at most 2 consecutive repeats; truncate the rest
      if (run > 2) continue
    } else {
      run = 1
    }
    out.push(words[i])
  }
  // If more than half the remaining words are still the same token, it's a hallucination
  const dominant = out.reduce<Record<string, number>>((acc, w) => {
    const k = w.toLowerCase()
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const maxFreq = Math.max(...Object.values(dominant))
  if (out.length > 4 && maxFreq / out.length > 0.5) return ''
  return out.join(' ')
}

export async function transcribeAudio(base64Pcm: string): Promise<string> {
  const pipe = await getPipeline()
  const float32 = pcm16ToFloat32(Buffer.from(base64Pcm, 'base64'))

  // Quick amplitude check — detect silent/dead mic
  let peak = 0
  let rmsAccum = 0
  for (let i = 0; i < float32.length; i++) {
    const v = Math.abs(float32[i])
    if (v > peak) peak = v
    rmsAccum += v * v
  }
  const rms = Math.sqrt(rmsAccum / float32.length)
  console.log(`[asr] audio peak=${peak.toFixed(3)} rms=${rms.toFixed(4)} samples=${float32.length} dur=${(float32.length / 16000).toFixed(2)}s`)
  if (peak < 0.002) {
    console.warn('[asr] audio effectively silent — check mic permission / input device')
    return ''
  }

  // transformers.js v4 ASR pipeline expects raw Float32Array (mono 16kHz).
  // Second options arg is generation config — passing sampling_rate here is a no-op.
  // Audio is already 16kHz from renderer AudioContext, so no resampling needed.
  const tInfer = Date.now()
  const result = await pipe(float32) as { text: string } | Array<{ text: string }>
  const resultObj = Array.isArray(result) ? result[0] : result
  console.log(`[asr] inference ${Date.now() - tInfer}ms, keys=${Object.keys(resultObj ?? {}).join(',')}, text="${resultObj?.text ?? 'undefined'}"`)
  const raw = (resultObj?.text ?? '').trim()
  const cleaned = deRepeat(raw)
  if (raw && !cleaned) {
    console.warn(`[asr] deRepeat zeroed output. raw="${raw.slice(0, 120)}" samples=${float32.length}`)
  } else if (!raw) {
    console.warn(`[asr] ASR returned empty. samples=${float32.length} duration=${(float32.length / 16000).toFixed(2)}s`)
  }
  return cleaned
}
