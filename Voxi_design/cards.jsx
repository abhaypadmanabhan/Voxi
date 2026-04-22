// Transcript preview card + correction badge

function TranscriptCard({ text, streaming, visible }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.98)',
      transition: 'opacity .25s cubic-bezier(.2,.7,.3,1), transform .25s cubic-bezier(.2,.7,.3,1)',
      pointerEvents: visible ? 'auto' : 'none',
      maxWidth: 360,
      padding: '14px 16px',
      background: 'rgba(10,10,12,0.82)',
      backdropFilter: 'blur(32px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
      border: '0.5px solid rgba(255,255,255,0.10)',
      borderRadius: 14,
      boxShadow: [
        '0 1px 0 0 rgba(255,255,255,0.06) inset',
        '0 10px 40px rgba(0,0,0,0.5)',
        '0 2px 8px rgba(0,0,0,0.3)',
      ].join(', '),
      color: '#fff',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.42)',
        marginBottom: 8,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M2 3h6M2 5h6M2 7h4" />
        </svg>
        Transcript
      </div>
      <div style={{
        fontSize: 14, lineHeight: 1.5, letterSpacing: -0.1,
        color: 'rgba(255,255,255,0.94)',
        fontWeight: 400,
        textWrap: 'pretty',
      }}>
        {text}
        {streaming && (
          <span style={{
            display: 'inline-block',
            width: 2, height: 14,
            background: '#818cf8',
            marginLeft: 2, verticalAlign: -2,
            animation: 'voxi-blink 1s step-end infinite',
            borderRadius: 1,
          }} />
        )}
      </div>
    </div>
  );
}

function CorrectionBadge({ visible, word }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.94)',
      transition: 'opacity .2s cubic-bezier(.2,.7,.3,1), transform .25s cubic-bezier(.2,.7,.3,1)',
      pointerEvents: visible ? 'auto' : 'none',
      height: 28,
      padding: '0 11px 0 9px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(6,22,18,0.88)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      border: '0.5px solid rgba(52,211,153,0.28)',
      borderRadius: 14,
      boxShadow: [
        '0 0 0 1px rgba(52,211,153,0.06)',
        '0 0 16px rgba(16,185,129,0.28)',
        '0 4px 14px rgba(0,0,0,0.35)',
      ].join(', '),
      color: '#d1fae5',
      fontSize: 11.5, fontWeight: 500,
      letterSpacing: -0.05,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6ee7b7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.5l2.5 2.5L10 3.5" />
      </svg>
      <span>Correction learned</span>
      {word && (
        <>
          <span style={{ opacity: 0.4, margin: '0 1px' }}>·</span>
          <span style={{
            fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
            fontSize: 10.5,
            color: '#6ee7b7',
          }}>{word}</span>
        </>
      )}
    </div>
  );
}

Object.assign(window, { TranscriptCard, CorrectionBadge });
