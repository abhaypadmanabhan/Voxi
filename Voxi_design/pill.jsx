// Voxi pill component — three states: idle, recording, processing
// Aesthetic: dark glass pill, soft glows, spring transitions

const PillMic = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="2" width="4" height="8" rx="2" />
    <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0" />
    <path d="M8 12v2" />
  </svg>
);

const PillKbd = ({ children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 15, height: 15, padding: '0 4px',
    fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
    fontSize: 9.5, fontWeight: 500,
    color: 'rgba(255,255,255,0.72)',
    background: 'rgba(255,255,255,0.08)',
    border: '0.5px solid rgba(255,255,255,0.14)',
    borderRadius: 3.5,
    lineHeight: 1,
  }}>{children}</span>
);

// IDLE PILL — compact, ~120x40
function IdlePill({ onPointerDown, onContextMenu }) {
  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      style={{
        height: 40,
        padding: '0 14px 0 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(12,12,14,0.72)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: 20,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25)',
        color: '#fff',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform .18s cubic-bezier(.2,.7,.3,1), background .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(18,18,22,0.78)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(12,12,14,0.72)'; }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        border: '0.5px solid rgba(255,255,255,0.10)',
        color: 'rgba(255,255,255,0.92)',
      }}>
        <PillMic size={12} />
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: 500, letterSpacing: -0.1,
        color: 'rgba(255,255,255,0.92)',
      }}>Voxi</span>
      <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>
        <PillKbd>⌥</PillKbd>
        <PillKbd>Space</PillKbd>
      </span>
    </div>
  );
}

// RECORDING PILL — expanded, ~280x52, red pulse + waveform
function RecordingPill({ amps, elapsed }) {
  return (
    <div style={{
      height: 52,
      padding: '0 18px 0 16px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(18,10,12,0.78)',
      backdropFilter: 'blur(28px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
      border: '0.5px solid rgba(255,90,110,0.22)',
      borderRadius: 26,
      boxShadow: [
        '0 1px 0 0 rgba(255,255,255,0.06) inset',
        '0 0 0 1px rgba(244,63,94,0.08)',
        '0 0 24px rgba(244,63,94,0.28)',
        '0 8px 32px rgba(0,0,0,0.45)',
      ].join(', '),
      color: '#fff',
      userSelect: 'none',
    }}>
      {/* Pulsing red dot */}
      <div style={{ position: 'relative', width: 10, height: 10 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 5,
          background: '#f43f5e',
          boxShadow: '0 0 8px rgba(244,63,94,0.9)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 5,
          background: '#f43f5e',
          animation: 'voxi-pulse 1.4s ease-out infinite',
        }} />
      </div>

      {/* Waveform — 7 bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24, width: 100 }}>
        {amps.map((a, i) => {
          const h = Math.max(3, Math.min(24, a * 24));
          return (
            <div key={i} style={{
              width: 3, height: h,
              borderRadius: 1.5,
              background: 'linear-gradient(180deg, #ffb4be, #f43f5e)',
              boxShadow: '0 0 6px rgba(244,63,94,0.5)',
              transition: 'height .08s cubic-bezier(.2,.7,.3,1)',
            }} />
          );
        })}
      </div>

      <div style={{
        flex: 1,
        fontSize: 12.5, fontWeight: 500,
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: -0.1,
      }}>Listening</div>

      <div style={{
        fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
        fontSize: 11.5, fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        fontVariantNumeric: 'tabular-nums',
      }}>{formatTime(elapsed)}</div>
    </div>
  );
}

// PROCESSING PILL — medium, ~200x44, spinner + indigo
function ProcessingPill() {
  return (
    <div style={{
      height: 44,
      padding: '0 18px 0 14px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(14,14,22,0.76)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      border: '0.5px solid rgba(129,140,248,0.22)',
      borderRadius: 22,
      boxShadow: [
        '0 1px 0 0 rgba(255,255,255,0.06) inset',
        '0 0 20px rgba(99,102,241,0.22)',
        '0 8px 28px rgba(0,0,0,0.4)',
      ].join(', '),
      color: '#fff',
      userSelect: 'none',
    }}>
      <div style={{
        width: 16, height: 16, position: 'relative',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'voxi-spin 0.9s linear infinite' }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(129,140,248,0.2)" strokeWidth="1.8" />
          <path d="M 8 2 A 6 6 0 0 1 14 8" stroke="#818cf8" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{
        fontSize: 12.5, fontWeight: 500,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: -0.1,
      }}>Transcribing</span>
      <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
        <Dot delay={0} />
        <Dot delay={0.15} />
        <Dot delay={0.3} />
      </span>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span style={{
      width: 3, height: 3, borderRadius: 1.5,
      background: 'rgba(165,180,252,0.9)',
      animation: 'voxi-dot 1.1s ease-in-out infinite',
      animationDelay: `${delay}s`,
    }} />
  );
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

Object.assign(window, { IdlePill, RecordingPill, ProcessingPill });
