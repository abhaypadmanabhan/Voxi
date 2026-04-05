import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Mic } from 'lucide-react'
import { useEffect } from 'react'

type Status = 'idle' | 'recording' | 'processing'

interface Props {
  status: Status
  amplitudes: number[]
  streamingPreview: string
  transcript: string
  correctionLearned: boolean
  onClick: () => void
  onRightClick: () => void
  onDismissTranscript: () => void
}

function AudioVisualizer({ amplitudes }: { amplitudes: number[] }) {
  return (
    <div className="flex items-center gap-[3px] h-6">
      {amplitudes.map((amp, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-rose-400"
          animate={{ height: `${Math.max(4, amp * 24)}px` }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}
    </div>
  )
}

function PreviewText({
  text,
  isStreaming,
  onDismiss,
}: {
  text: string
  isStreaming: boolean
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!isStreaming && text) {
      const t = setTimeout(onDismiss, 2000)
      return () => clearTimeout(t)
    }
  }, [isStreaming, text, onDismiss])

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key="preview"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
          className="mb-2 max-w-[360px] bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white/90 leading-relaxed"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        >
          {text}
          {isStreaming && (
            <span className="inline-block ml-1 opacity-60 animate-pulse">▋</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CorrectionBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="badge"
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 4 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
          className="mb-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium"
        >
          Correction learned
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function VoxiPill({
  status,
  amplitudes,
  streamingPreview,
  transcript,
  correctionLearned,
  onClick,
  onRightClick,
  onDismissTranscript,
}: Props) {
  const previewText = streamingPreview || transcript
  const isStreaming = status === 'processing' && !!streamingPreview

  return (
    <div className="flex flex-col items-center">
      <PreviewText
        text={previewText}
        isStreaming={isStreaming}
        onDismiss={onDismissTranscript}
      />
      <CorrectionBadge show={correctionLearned} />
      <motion.button
        layout
        transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          onRightClick()
        }}
        className={`
          relative flex items-center justify-center rounded-full
          bg-black/75 backdrop-blur-xl border border-white/10
          focus:outline-none hover:bg-black/85 transition-colors
          ${status === 'idle' ? 'w-[120px] h-[40px]' : ''}
          ${status === 'recording' ? 'w-[280px] h-[52px]' : ''}
          ${status === 'processing' ? 'w-[200px] h-[44px]' : ''}
        `}
        style={{
          boxShadow:
            status === 'recording'
              ? '0 0 32px rgba(225, 29, 72, 0.3), 0 6px 24px rgba(0,0,0,0.4)'
              : '0 6px 24px rgba(0,0,0,0.35)',
        }}
      >
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-2 text-white/70"
            >
              <Mic size={16} strokeWidth={2} />
              <span className="text-[13px] font-medium tracking-wide">Voxi</span>
            </motion.div>
          )}

          {status === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-3 px-4"
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                <span className="relative rounded-full bg-rose-500 h-2 w-2" />
              </span>
              <AudioVisualizer amplitudes={amplitudes} />
            </motion.div>
          )}

          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-2 px-4 text-white/70"
            >
              <Loader2 size={15} className="animate-spin text-indigo-400 flex-shrink-0" />
              <span className="text-[13px] font-medium tracking-wide">Transcribing...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
