import { useEffect, useRef, useState } from 'react'
import RecordingBubble from './components/RecordingBubble'
import TranscriptToast from './components/TranscriptToast'
import SettingsPanel from './components/SettingsPanel'
import UpgradeToast from './components/UpgradeToast'

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
      onGate: (cb: () => void) => void
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
  timer: ReturnType<typeof setInterval>
}

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [streamingPreview, setStreamingPreview] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showUpgradeToast, setShowUpgradeToast] = useState(false)
  const micRef = useRef<MicState | null>(null)

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
    window.voxi.onGate(() => setShowUpgradeToast(true))
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
    source.connect(worklet)
    micRef.current = { stream, ctx, worklet, timer }
    console.log('[mic] started')
  }

  function stopMic() {
    const m = micRef.current
    if (!m) return
    clearInterval(m.timer)
    m.worklet.disconnect()
    m.ctx.close()
    m.stream.getTracks().forEach((t) => t.stop())
    micRef.current = null
  }

  function handleClick() {
    if (status === 'idle') {
      window.voxi.startRecording()
    } else if (status === 'recording') {
      window.voxi.stopRecording()
    }
  }

  return (
    <>
      <RecordingBubble
        status={status}
        onClick={handleClick}
        onRightClick={() => setShowSettings(true)}
      />
      {(streamingPreview || transcript) && (
        <TranscriptToast
          text={streamingPreview || transcript}
          isStreaming={status === 'processing'}
          onDismiss={() => {
            setTranscript('')
            setStreamingPreview('')
          }}
        />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showUpgradeToast && (
        <UpgradeToast onDismiss={() => setShowUpgradeToast(false)} />
      )}
    </>
  )
}
