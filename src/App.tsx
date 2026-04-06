import { useEffect, useRef, useState } from 'react'
import VoxiPill from './components/VoxiPill'
import SettingsPanel from './components/SettingsPanel'

declare global {
  interface Window {
    voxi: {
      startRecording: () => void
      stopRecording: () => void
      onTranscript: (cb: (text: string) => void) => void
      onStatus: (cb: (status: string) => void) => void
      onStartMic: (cb: () => void) => void
      onStopMic: (cb: () => void) => void
      sendAudioChunk: (b64: string) => void
      onStreamingPreview: (cb: (text: string) => void) => void
      onCorrectionLearned: (cb: () => void) => void
      mouseEnterInteractive: () => void
      mouseLeaveInteractive: () => void
      getSetting: (key: string) => Promise<string | null>
      setSetting: (key: string, value: string) => Promise<void>
    }
  }
}

type Status = 'idle' | 'recording' | 'processing'

const WORKLET_CODE = `
class PCM16Processor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch) {
      const out = new Int16Array(ch.length)
      for (let i = 0; i < ch.length; i++)
        out[i] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767)))
      this.port.postMessage(out)
    }
    return true
  }
}
registerProcessor('pcm16-processor', PCM16Processor)
`

interface MicState {
  stream: MediaStream
  ctx: AudioContext
  worklet: AudioWorkletNode
  analyser: AnalyserNode
  timer: ReturnType<typeof setInterval>
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [streamingPreview, setStreamingPreview] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [amplitudes, setAmplitudes] = useState<number[]>(new Array(7).fill(0))
  const [correctionLearned, setCorrectionLearned] = useState(false)
  const micRef = useRef<MicState | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    window.voxi.onStatus((s) => {
      if (s === 'idle' || s === 'recording' || s === 'processing') {
        setStatus(s)
      }
    })
    window.voxi.onTranscript((t) => {
      setTranscript(t)
      setStreamingPreview('')
    })
    window.voxi.onStreamingPreview((token) => {
      setStreamingPreview((p) => p + token)
    })
    window.voxi.onStartMic(() => startMic().catch((e) => console.error('[mic] failed:', e)))
    window.voxi.onStopMic(stopMic)
    window.voxi.onCorrectionLearned(() => {
      setCorrectionLearned(true)
      setTimeout(() => setCorrectionLearned(false), 2500)
    })
  }, [])

  async function startMic() {
    console.log('[mic] requesting getUserMedia')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    const ctx = new AudioContext({ sampleRate: 16000 })
    const workletBlob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
    await ctx.audioWorklet.addModule(URL.createObjectURL(workletBlob))
    const source = ctx.createMediaStreamSource(stream)
    const worklet = new AudioWorkletNode(ctx, 'pcm16-processor')
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    analyser.connect(worklet)
    const buffers: Int16Array[] = []
    worklet.port.onmessage = (e: MessageEvent<Int16Array>) => buffers.push(e.data)
    const timer = setInterval(() => {
      if (!buffers.length) return
      const total = buffers.reduce((n, b) => n + b.length, 0)
      const merged = new Int16Array(total)
      let offset = 0
      for (const b of buffers) {
        merged.set(b, offset)
        offset += b.length
      }
      buffers.length = 0
      const b64 = btoa(String.fromCharCode(...new Uint8Array(merged.buffer)))
      window.voxi.sendAudioChunk(b64)
    }, 250)
    analyserRef.current = analyser
    animFrameRef.current = requestAnimationFrame(tickAmplitude)
    micRef.current = { stream, ctx, worklet, analyser, timer }
    console.log('[mic] started')
  }

  function stopMic() {
    const m = micRef.current
    if (!m) return
    clearInterval(m.timer)
    cancelAnimationFrame(animFrameRef.current)
    analyserRef.current = null
    setAmplitudes(new Array(7).fill(0))
    m.analyser.disconnect()
    m.worklet.disconnect()
    m.ctx.close()
    m.stream.getTracks().forEach((t) => t.stop())
    micRef.current = null
  }

  function tickAmplitude() {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const step = Math.floor(data.length / 7)
    setAmplitudes(Array.from({ length: 7 }, (_, i) => data[i * step] / 255))
    animFrameRef.current = requestAnimationFrame(tickAmplitude)
  }

  function handleClick() {
    if (status === 'idle') {
      window.voxi.startRecording()
    } else if (status === 'recording') {
      window.voxi.stopRecording()
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-end pb-4 pointer-events-none">
      <div
        className="pointer-events-auto"
        onMouseEnter={() => window.voxi.mouseEnterInteractive()}
        onMouseLeave={() => window.voxi.mouseLeaveInteractive()}
      >
        <VoxiPill
          status={status}
          amplitudes={amplitudes}
          streamingPreview={streamingPreview}
          transcript={transcript}
          correctionLearned={correctionLearned}
          onClick={handleClick}
          onRightClick={() => setShowSettings(true)}
          onDismissTranscript={() => {
            setTranscript('')
            setStreamingPreview('')
          }}
        />
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}
