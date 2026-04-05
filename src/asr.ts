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

export async function transcribeAudio(base64Pcm: string): Promise<string> {
  const pipe = await getPipeline()
  const float32 = pcm16ToFloat32(Buffer.from(base64Pcm, 'base64'))
  const result = await pipe(float32, { sampling_rate: 16000 }) as { text: string }
  return result.text.trim()
}
