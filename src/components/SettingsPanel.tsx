import { History, Settings as AdvancedIcon, LogOut } from 'lucide-react'
import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import type { HotkeySpec } from '../App'

interface Props {
  onClose: () => void
}

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

function normalizeKey(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null
  if (e.key === ' ') return 'Space'
  if (e.key.length === 1) {
    const ch = e.key.toUpperCase()
    if (/[A-Z0-9]/.test(ch)) return ch
  }
  const named: Record<string, string> = {
    Enter: 'Enter',
    Tab: 'Tab',
    Escape: 'Escape',
    Backspace: 'Backspace',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
  }
  return named[e.key] ?? null
}

function formatSpec(h: HotkeySpec, isMac: boolean): Array<string> {
  const parts: string[] = []
  if (h.meta) parts.push(isMac ? '⌘' : 'Win')
  if (h.ctrl) parts.push(isMac ? '⌃' : 'Ctrl')
  if (h.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (h.shift) parts.push('⇧')
  parts.push(h.key)
  return parts
}

function HotkeyRecorder({ spec, onChange }: { spec: HotkeySpec | null; onChange: (s: HotkeySpec) => void }) {
  const [recording, setRecording] = useState(false)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const isMac = navigator.platform.toLowerCase().includes('mac')

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      setRecording(false)
      btnRef.current?.blur()
      return
    }
    const key = normalizeKey(e)
    if (!key) return
    const hasMod = e.metaKey || e.ctrlKey || e.altKey
    if (!hasMod) return
    const next: HotkeySpec = {
      meta: e.metaKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      key,
    }
    onChange(next)
    setRecording(false)
    btnRef.current?.blur()
  }

  const parts = spec ? formatSpec(spec, isMac) : []

  return (
    <button
      ref={btnRef}
      onClick={() => setRecording((r) => !r)}
      onKeyDown={onKeyDown}
      onBlur={() => setRecording(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 6px',
        minHeight: 24,
        background: recording ? 'rgba(244,63,94,0.14)' : 'rgba(255,255,255,0.04)',
        border: recording
          ? '0.5px solid rgba(244,63,94,0.5)'
          : '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 6,
        cursor: 'pointer',
        outline: 'none',
        fontFamily: 'inherit',
      }}
      title={recording ? 'Press new shortcut (Esc to cancel)' : 'Click to rebind'}
    >
      {recording ? (
        <span style={{ fontSize: 10.5, color: '#fca5a5', padding: '0 4px' }}>press keys…</span>
      ) : parts.length === 0 ? (
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', padding: '0 4px' }}>—</span>
      ) : (
        parts.map((p, i) => <Kbd key={i}>{p}</Kbd>)
      )}
    </button>
  )
}

// ── Primitives ──────────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
        fontSize: 10.5,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.82)',
        background: 'rgba(255,255,255,0.08)',
        border: '0.5px solid rgba(255,255,255,0.14)',
        borderRadius: 4,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-label="Toggle"
      style={{
        width: 30,
        height: 18,
        borderRadius: 9,
        border: 'none',
        padding: 2,
        background: checked ? '#6366f1' : 'rgba(255,255,255,0.14)',
        boxShadow: checked
          ? '0 0 10px rgba(99,102,241,0.4), inset 0 0 0 0.5px rgba(255,255,255,0.06)'
          : 'inset 0 0 0 0.5px rgba(255,255,255,0.06)',
        cursor: 'pointer',
        transition: 'background .18s',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        outline: 'none',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: '#fff',
          transform: checked ? 'translateX(12px)' : 'translateX(0)',
          transition: 'transform .2s cubic-bezier(.2,.7,.3,1)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: '9px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderRadius: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.05px',
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              marginTop: 1,
              letterSpacing: '-0.05px',
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'rgba(255,255,255,0.06)',
        margin: '2px 8px',
      }}
    />
  )
}

function VocabChip({ word, onRemove }: { word: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 4px 0 8px',
        background: 'rgba(99,102,241,0.14)',
        border: '0.5px solid rgba(129,140,248,0.22)',
        borderRadius: 11,
        fontSize: 11.5,
        color: '#c7d2fe',
        fontWeight: 500,
        letterSpacing: '-0.05px',
      }}
    >
      {word}
      <button
        onClick={onRemove}
        aria-label={`Remove ${word}`}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'rgba(199,210,254,0.6)',
          cursor: 'pointer',
          padding: 0,
          width: 13,
          height: 13,
          borderRadius: 6.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          lineHeight: 1,
          outline: 'none',
        }}
      >
        ×
      </button>
    </span>
  )
}

function VocabInput({ onAdd }: { onAdd: (word: string) => void }) {
  const [v, setV] = useState('')
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault()
          const trimmed = v.trim()
          if (trimmed) onAdd(trimmed)
          setV('')
        }
      }}
      placeholder="Add word…"
      style={{
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: '#fff',
        fontSize: 11.5,
        padding: '0 6px',
        height: 22,
        minWidth: 80,
        flex: 1,
        fontFamily: 'inherit',
      }}
    />
  )
}

function MenuItem({
  icon,
  danger,
  disabled,
  onClick,
  children,
}: {
  icon: React.ReactNode
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        borderRadius: 6,
        color: danger ? '#fca5a5' : disabled ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.78)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.05px',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background .12s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Panel ───────────────────────────────────────────────────────────────────

export default function SettingsPanel({ onClose }: Props) {
  const [useLlm, setUseLlm] = useState(false)
  const [vocabulary, setVocabulary] = useState<string[]>([])
  const [hotkey, setHotkeyState] = useState<HotkeySpec | null>(null)

  useEffect(() => {
    window.voxi.getSetting('use_llm_formatter').then((val) => setUseLlm(val === 'true'))
    window.voxi.getHotkey().then(setHotkeyState).catch(() => {})
    refreshVocab()
  }, [])

  async function changeHotkey(spec: HotkeySpec) {
    const applied = await window.voxi.setHotkey(spec)
    setHotkeyState(applied ?? spec)
  }

  async function refreshVocab() {
    const words = await window.voxi.getVocabulary()
    setVocabulary(words ?? [])
  }

  async function addWord(word: string) {
    if (vocabulary.includes(word)) return
    await window.voxi.addVocabEntry(word)
    await refreshVocab()
  }

  async function removeWord(word: string) {
    await window.voxi.removeVocabEntry(word)
    await refreshVocab()
  }

  async function toggleLlm() {
    const next = !useLlm
    setUseLlm(next)
    await window.voxi.setSetting('use_llm_formatter', next ? 'true' : 'false')
  }

  const backdrop: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 76,
    background: 'rgba(0,0,0,0.22)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 50,
    pointerEvents: 'auto', // override parent pointer-events-none
  }

  const panel: CSSProperties = {
    width: 320,
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    background: 'rgba(14,14,16,0.84)',
    backdropFilter: 'blur(36px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(36px) saturate(1.6)',
    border: '0.5px solid rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 6,
    color: '#fff',
    fontSize: 13,
    boxShadow: [
      'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      '0 20px 60px rgba(0,0,0,0.5)',
      '0 4px 12px rgba(0,0,0,0.35)',
    ].join(', '),
    animation: 'voxi-pop 0.18s cubic-bezier(.2,.7,.3,1)',
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '10px 12px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.42)',
            }}
          >
            Preferences
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              width: 20,
              height: 20,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              outline: 'none',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
            }}
          >
            ×
          </button>
        </div>

        {/* Hotkey */}
        <Row label="Hotkey" hint="Hold to record, release to transcribe">
          <HotkeyRecorder spec={hotkey} onChange={changeHotkey} />
        </Row>

        <Divider />

        {/* AI formatter */}
        <Row label="AI formatter" hint="Punctuation, casing, paragraphs">
          <Toggle checked={useLlm} onChange={toggleLlm} />
        </Row>

        {/* STT engine readout */}
        <Row label="STT engine" hint="Local Whisper via whisper.cpp (Metal)">
          <span
            style={{
              fontSize: 10.5,
              fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
              color: '#818cf8',
              textTransform: 'lowercase',
            }}
          >
            small.en
          </span>
        </Row>

        <Divider />

        {/* Vocabulary */}
        <div style={{ padding: '8px 12px 4px' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.92)',
              marginBottom: 2,
              letterSpacing: '-0.05px',
            }}
          >
            Custom vocabulary
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 8,
              letterSpacing: '-0.05px',
            }}
          >
            Names, acronyms, jargon. Biases Whisper decoder — use sparingly.
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '6px 6px 4px',
              background: 'rgba(0,0,0,0.3)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              minHeight: 34,
            }}
          >
            {vocabulary.map((w) => (
              <VocabChip key={w} word={w} onRemove={() => removeWord(w)} />
            ))}
            <VocabInput onAdd={addWord} />
          </div>
        </div>

        <Divider />

        {/* Footer */}
        <div
          style={{
            padding: '6px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <MenuItem icon={<History size={11} strokeWidth={1.5} />} disabled>
            History
          </MenuItem>
          <MenuItem icon={<AdvancedIcon size={11} strokeWidth={1.5} />} disabled>
            Advanced
          </MenuItem>
          <MenuItem
            icon={<LogOut size={11} strokeWidth={1.5} />}
            danger
            onClick={() => window.voxi.quitApp()}
          >
            Quit
          </MenuItem>
        </div>
      </div>
    </div>
  )
}
