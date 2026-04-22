// A blurred stylized macOS-looking desktop background for showcasing Voxi.
// Drawn with CSS + SVG — abstract, non-branded.

function DesktopBackground({ children, showApp = true }) {
  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #1a1530 0%, #2d1b3d 38%, #4a1f3a 72%, #5e2434 100%)',
    }}>
      {/* Color blobs */}
      <div style={{
        position: 'absolute', top: '-18%', left: '-10%',
        width: '70%', height: '70%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.42) 0%, transparent 60%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', top: '30%', right: '-15%',
        width: '60%', height: '70%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.38) 0%, transparent 60%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '20%',
        width: '60%', height: '60%',
        background: 'radial-gradient(circle, rgba(251,146,60,0.22) 0%, transparent 60%)',
        filter: 'blur(60px)',
      }} />

      {/* Faux menu bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 24,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        gap: 18,
        fontSize: 12.5,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: 'rgba(255,255,255,0.9)',
      }}>
        <span style={{
          width: 13, height: 13, borderRadius: 3,
          background: 'rgba(255,255,255,0.9)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="9" height="11" viewBox="0 0 9 11" fill="#000"><path d="M6.5 2.5c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7 0 1.3-.4 1.7-.8zm.6.9c-1-.1-1.8.5-2.2.5-.5 0-1.2-.5-1.9-.5-1 0-2 .6-2.5 1.5-1.1 1.9-.3 4.7.8 6.2.5.7 1.1 1.6 1.9 1.5.8 0 1-.5 1.9-.5s1.1.5 1.9.5c.8 0 1.3-.7 1.8-1.5.6-.8.8-1.6.8-1.6 0 0-1.5-.6-1.5-2.3 0-1.4 1.2-2.1 1.2-2.1-.7-1-1.7-1.1-2.2-1.2z"/></svg>
        </span>
        <span style={{ fontWeight: 600 }}>Voxi</span>
        <span style={{ opacity: 0.82 }}>File</span>
        <span style={{ opacity: 0.82 }}>Edit</span>
        <span style={{ opacity: 0.82 }}>View</span>
        <span style={{ opacity: 0.82 }}>Window</span>
        <span style={{ opacity: 0.82 }}>Help</span>
        <div style={{ flex: 1 }} />
        <span style={{ opacity: 0.82, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
          Tue 2:47 PM
        </span>
      </div>

      {/* Faux app window — a notes-style doc */}
      {showApp && <FauxAppWindow />}

      {/* Dock suggestion at bottom */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        height: 56,
        padding: '6px 10px',
        display: 'flex', gap: 6, alignItems: 'center',
        background: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {['#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c'].map((c, i) => (
          <div key={i} style={{
            width: 42, height: 42, borderRadius: 10,
            background: `linear-gradient(135deg, ${c}, ${c}cc)`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.15) inset',
          }} />
        ))}
      </div>

      {children}
    </div>
  );
}

function FauxAppWindow() {
  return (
    <div style={{
      position: 'absolute',
      top: 56, left: 48, right: 48, bottom: 120,
      background: 'rgba(28,28,32,0.88)',
      backdropFilter: 'blur(20px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
      border: '0.5px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Title bar */}
      <div style={{
        height: 38, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: '#28c840' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          Launch email — Draft
        </div>
      </div>
      {/* Doc body */}
      <div style={{
        flex: 1, padding: '32px 56px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: 'rgba(255,255,255,0.78)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, color: '#fff', letterSpacing: -0.4 }}>
          Re: Q2 launch plan
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
          To: maya@northlake.co · From: jordan@voxi.dev
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.7, letterSpacing: -0.1 }}>
          <p style={{ margin: '0 0 14px' }}>Hi Maya,</p>
          <p style={{ margin: '0 0 14px' }}>
            Thanks for the thoughtful notes on the roadmap. I went back through the feedback
            doc and pulled out three themes we should address before next Tuesday's review —
          </p>
          <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              [dictation cursor active]
            </span>
            <span style={{
              display: 'inline-block',
              width: 1.5, height: 18,
              background: '#818cf8', marginLeft: 6, verticalAlign: -4,
            }} />
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopBackground });
