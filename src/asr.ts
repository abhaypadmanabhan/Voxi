import { pipeline } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// Module-level singleton — initialized once, reused across calls
let _pipe: AutomaticSpeechRecognitionPipeline | null = null

async function getPipeline(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (_pipe) return _pipe
  console.log('[asr] loading Moonshine model (first run: downloads ~200MB)...')
  _pipe = await pipeline(
    'automatic-speech-recognition',
    'onnx-community/moonshine-base-ONNX',
    { dtype: 'fp32' }
  ) as AutomaticSpeechRecognitionPipeline
  console.log('[asr] Moonshine ready')
  return _pipe
}

export async function initMoonshine(): Promise<void> {
  await getPipeline()
}

// Convert Int16 PCM → Float32 normalized [-1, 1]
function pcm16ToFloat32(pcmBuffer: Buffer): Float32Array {
  const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0
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
  const result = await pipe(float32, { sampling_rate: 16000 }) as { text: string }
  return deRepeat(result.text.trim())
}
