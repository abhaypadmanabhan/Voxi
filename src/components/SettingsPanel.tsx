import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  onClose: () => void
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle"
      style={{
        position: 'relative',
        width: 30,
        height: 18,
        borderRadius: 9,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.2s cubic-bezier(.2,.7,.3,1), box-shadow 0.2s cubic-bezier(.2,.7,.3,1)',
        background: on ? '#6366f1' : 'rgba(255,255,255,0.14)',
        boxShadow: on ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
        outline: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 14 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s cubic-bezier(.2,.7,.3,1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
}

const LABEL: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.65)',
  letterSpacing: '0.01em',
}

const VALUE: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#818cf8',
}

export default function SettingsPanel({ onClose }: Props) {
  const [useLlm, setUseLlm] = useState(false)
  const [model, setModel] = useState('gemma4:e4b')
  const [vocabulary, setVocabulary] = useState<string[]>([])

  useEffect(() => {
    window.voxi.getSetting('use_llm_formatter').then((val) => setUseLlm(val === 'true'))
    window.voxi.getSetting('llm_model').then((val) => { if (val) setModel(val) })
    window.voxi.getSetting('vocabulary').then((val) => {
      if (val) {
        try { setVocabulary(JSON.parse(val)) } catch { /* ignore malformed */ }
      }
    })
  }, [])

  async function toggleLlm() {
    const next = !useLlm
    setUseLlm(next)
    await window.voxi.setSetting('use_llm_formatter', next ? 'true' : 'false')
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center pb-16 z-50"
      style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320,
          background: 'rgba(14,14,16,0.84)',
          backdropFilter: 'blur(36px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(36px) saturate(1.6)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
          padding: '16px 16px 18px',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.6)',
          animation: 'voxi-pop 0.18s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)',
              padding: 2,
              display: 'flex',
              outline: 'none',
            }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Shortcut */}
          <div style={ROW}>
            <span style={LABEL}>Global shortcut</span>
            <kbd
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: 'rgba(255,255,255,0.75)',
                background: 'rgba(0,0,0,0.4)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                padding: '2px 7px',
              }}
            >
              ⌥ Space
            </kbd>
          </div>

          {/* STT engine */}
          <div style={ROW}>
            <span style={LABEL}>STT engine</span>
            <span style={VALUE}>Whisper (local)</span>
          </div>

          {/* LLM formatter */}
          <div style={ROW}>
            <span style={LABEL}>LLM formatter</span>
            <Toggle on={useLlm} onToggle={toggleLlm} />
          </div>

          {/* Model (conditional) */}
          {useLlm && (
            <div style={ROW}>
              <span style={{ ...LABEL, color: 'rgba(255,255,255,0.40)', fontSize: 11.5 }}>Model</span>
              <span style={VALUE}>{model}</span>
            </div>
          )}

          {/* Vocabulary */}
          <div
            style={{
              ...ROW,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={LABEL}>Vocabulary</span>
            {vocabulary.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {vocabulary.map((word) => (
                  <span
                    key={word}
                    style={{
                      padding: '3px 9px',
                      background: 'rgba(99,102,241,0.14)',
                      border: '0.5px solid rgba(129,140,248,0.22)',
                      borderRadius: 11,
                      fontSize: 12,
                      color: '#c7d2fe',
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                No custom words yet
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
