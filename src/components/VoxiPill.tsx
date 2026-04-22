import { AnimatePresence, motion } from 'framer-motion'
import { Mic, Settings as SettingsIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'

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
          style={{
            width: 3,
            borderRadius: 3,
            background: 'linear-gradient(to top, #f43f5e, #ffb4be)',
            boxShadow: '0 0 6px rgba(244,63,94,0.5)',
          }}
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
          className="mb-2 max-w-[360px]"
          style={{
            background: 'rgba(10,10,12,0.82)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: 14,
            padding: '12px 16px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.5,
            boxShadow:
              'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {text}
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: 2,
                color: '#818cf8',
                animation: 'voxi-blink 1s step-end infinite',
              }}
            >
              |
            </span>
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
          className="mb-2 flex items-center gap-1.5"
          style={{
            height: 28,
            padding: '0 11px 0 9px',
            background: 'rgba(6,22,18,0.88)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            border: '0.5px solid rgba(52,211,153,0.28)',
            borderRadius: 14,
            fontSize: 11.5,
            fontWeight: 500,
            color: '#d1fae5',
          }}
        >
          <span style={{ color: '#6ee7b7', fontSize: 10 }}>●</span>
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

  const pillStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(24px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
    cursor: 'pointer',
    border: '0.5px solid',
    outline: 'none',
    ...(status === 'idle' && {
      background: 'rgba(12,12,14,0.72)',
      borderColor: 'rgba(255,255,255,0.10)',
      borderRadius: 20,
      boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.35)',
    }),
    ...(status === 'recording' && {
      background: 'rgba(18,10,12,0.78)',
      borderColor: 'rgba(255,90,110,0.22)',
      borderRadius: 26,
      boxShadow: '0 0 24px rgba(244,63,94,0.28), 0 6px 24px rgba(0,0,0,0.4)',
    }),
    ...(status === 'processing' && {
      background: 'rgba(14,14,22,0.76)',
      borderColor: 'rgba(129,140,248,0.22)',
      borderRadius: 22,
      boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.4)',
    }),
  }

  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <PreviewText text={previewText} isStreaming={isStreaming} onDismiss={onDismissTranscript} />
      <CorrectionBadge show={correctionLearned} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <motion.button
          layout
          transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
          onClick={onClick}
          onContextMenu={(e) => {
            e.preventDefault()
            onRightClick()
          }}
          style={{
            ...pillStyle,
            width: status === 'idle' ? 120 : status === 'recording' ? 280 : 200,
            height: status === 'idle' ? 40 : status === 'recording' ? 52 : 44,
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
              style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.55)' }}
            >
              <Mic size={15} strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>Voxi</span>
              <kbd style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontFamily: 'monospace', marginLeft: 2 }}>
                ⌥ Space
              </kbd>
            </motion.div>
          )}

          {status === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px 0 16px' }}
            >
              <span style={{ position: 'relative', flexShrink: 0, width: 8, height: 8 }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: '#f43f5e',
                    animation: 'voxi-pulse 1.4s ease-out infinite',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    display: 'block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#f43f5e',
                  }}
                />
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 18px 0 14px',
                color: 'rgba(255,255,255,0.65)',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                style={{ flexShrink: 0, animation: 'voxi-spin 0.9s linear infinite' }}
              >
                <circle cx="7.5" cy="7.5" r="6" stroke="rgba(129,140,248,0.25)" strokeWidth="1.5" />
                <path d="M7.5 1.5 A6 6 0 0 1 13.5 7.5" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>Transcribing</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 1 }}>
                {[0, 0.18, 0.36].map((delay, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: '#818cf8',
                      animation: `voxi-dot 1.1s ease-in-out ${delay}s infinite`,
                    }}
                  />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.button>

        {/* Settings affordance — reveals on hover when idle. Right-click on pill also works. */}
        <AnimatePresence>
          {status === 'idle' && hovered && (
            <motion.button
              key="gear"
              initial={{ opacity: 0, x: -4, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -4, scale: 0.85 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.28 }}
              onClick={(e) => {
                e.stopPropagation()
                onRightClick()
              }}
              aria-label="Open settings"
              title="Settings"
              style={{
                position: 'absolute',
                left: 'calc(100% + 6px)',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 32,
                height: 32,
                borderRadius: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(12,12,14,0.72)',
                backdropFilter: 'blur(24px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.35)',
                color: 'rgba(255,255,255,0.65)',
                cursor: 'pointer',
                outline: 'none',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
                e.currentTarget.style.background = 'rgba(18,18,22,0.78)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                e.currentTarget.style.background = 'rgba(12,12,14,0.72)'
              }}
            >
              <SettingsIcon size={14} strokeWidth={1.8} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
