// Settings panel — appears on right-click of pill

function SettingsPanel({ open, onClose, settings, setSettings }) {
  if (!open) return null;
  const update = (k, v) => setSettings({ ...settings, [k]: v });

  return (
    <div style={{
      position: 'absolute',
      bottom: 64,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 320,
      background: 'rgba(14,14,16,0.84)',
      backdropFilter: 'blur(36px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(36px) saturate(1.6)',
      border: '0.5px solid rgba(255,255,255,0.10)',
      borderRadius: 14,
      boxShadow: [
        '0 1px 0 0 rgba(255,255,255,0.06) inset',
        '0 20px 60px rgba(0,0,0,0.5)',
        '0 4px 12px rgba(0,0,0,0.35)',
      ].join(', '),
      padding: 6,
      color: '#fff',
      fontSize: 13,
      animation: 'voxi-pop .18s cubic-bezier(.2,.7,.3,1)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)',
        }}>Preferences</div>
        <button onClick={onClose} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)', width: 18, height: 18, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>

      {/* Hotkey */}
      <Row label="Hotkey">
        <div style={{ display: 'flex', gap: 3 }}>
          <Kbd>⌥</Kbd>
          <Kbd>Space</Kbd>
        </div>
      </Row>

      <Divider />

      {/* LLM Formatter toggle */}
      <Row
        label="AI formatter"
        hint="Punctuation, casing, paragraphs"
      >
        <Toggle checked={settings.formatter} onChange={(v) => update('formatter', v)} />
      </Row>

      {/* Auto-paste toggle */}
      <Row
        label="Auto-paste"
        hint="Insert at cursor when done"
      >
        <Toggle checked={settings.autopaste} onChange={(v) => update('autopaste', v)} />
      </Row>

      {/* Learn corrections */}
      <Row
        label="Learn corrections"
        hint="Remember edits to your dictation"
      >
        <Toggle checked={settings.learn} onChange={(v) => update('learn', v)} />
      </Row>

      <Divider />

      {/* Vocabulary */}
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: 'rgba(255,255,255,0.92)', marginBottom: 2,
        }}>Custom vocabulary</div>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.45)',
          marginBottom: 8, letterSpacing: -0.05,
        }}>Names, acronyms, and jargon Voxi should always spell this way.</div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          padding: '6px 6px 4px',
          background: 'rgba(0,0,0,0.3)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          minHeight: 34,
        }}>
          {settings.vocab.map((w, i) => (
            <VocabChip key={w + i} word={w} onRemove={() => {
              update('vocab', settings.vocab.filter((_, j) => j !== i));
            }} />
          ))}
          <VocabInput onAdd={(w) => {
            if (w && !settings.vocab.includes(w)) update('vocab', [...settings.vocab, w]);
          }} />
        </div>
      </div>

      <Divider />

      {/* Footer */}
      <div style={{
        padding: '6px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <MenuItem icon={<IconHistory />}>History</MenuItem>
        <MenuItem icon={<IconGear />}>Advanced</MenuItem>
        <MenuItem icon={<IconQuit />} danger>Quit</MenuItem>
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{
      padding: '9px 12px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderRadius: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.92)', letterSpacing: -0.05 }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, letterSpacing: -0.05 }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 8px' }} />;
}

function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
      fontSize: 10.5, fontWeight: 500,
      color: 'rgba(255,255,255,0.82)',
      background: 'rgba(255,255,255,0.08)',
      border: '0.5px solid rgba(255,255,255,0.14)',
      borderRadius: 4,
      lineHeight: 1,
    }}>{children}</span>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 30, height: 18, borderRadius: 9,
        border: 'none', padding: 2,
        background: checked ? '#6366f1' : 'rgba(255,255,255,0.14)',
        boxShadow: checked ? '0 0 10px rgba(99,102,241,0.4), 0 0 0 0.5px rgba(255,255,255,0.06) inset' : '0 0 0 0.5px rgba(255,255,255,0.06) inset',
        cursor: 'pointer',
        transition: 'background .18s',
        display: 'flex', alignItems: 'center',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 7,
        background: '#fff',
        transform: checked ? 'translateX(12px)' : 'translateX(0)',
        transition: 'transform .2s cubic-bezier(.2,.7,.3,1)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function VocabChip({ word, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 22, padding: '0 4px 0 8px',
      background: 'rgba(99,102,241,0.14)',
      border: '0.5px solid rgba(129,140,248,0.22)',
      borderRadius: 11,
      fontSize: 11.5,
      color: '#c7d2fe',
      fontWeight: 500,
      letterSpacing: -0.05,
    }}>
      {word}
      <button onClick={onRemove} style={{
        border: 'none', background: 'transparent',
        color: 'rgba(199,210,254,0.6)',
        cursor: 'pointer', padding: 0,
        width: 13, height: 13, borderRadius: 6.5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, lineHeight: 1,
      }}>×</button>
    </span>
  );
}

function VocabInput({ onAdd }) {
  const [v, setV] = React.useState('');
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          onAdd(v.trim());
          setV('');
        }
      }}
      placeholder="Add word…"
      style={{
        border: 'none', outline: 'none', background: 'transparent',
        color: '#fff',
        fontSize: 11.5,
        padding: '0 6px',
        height: 22,
        minWidth: 80, flex: 1,
        fontFamily: 'inherit',
      }}
    />
  );
}

function MenuItem({ icon, children, danger }) {
  return (
    <button style={{
      flex: 1,
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 10px',
      border: 'none', background: 'transparent',
      borderRadius: 6,
      color: danger ? '#fca5a5' : 'rgba(255,255,255,0.78)',
      fontSize: 11.5, fontWeight: 500, letterSpacing: -0.05,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'background .12s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {icon}
      {children}
    </button>
  );
}

const IconHistory = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="6" cy="6" r="4.5" /><path d="M6 3v3l2 1.2" />
  </svg>
);
const IconGear = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="1.6" />
    <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" />
  </svg>
);
const IconQuit = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M7.5 3.5V2.5a.5.5 0 00-.5-.5H3a.5.5 0 00-.5.5v7a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V8.5M5.5 6h5M8.5 4l2 2-2 2" />
  </svg>
);

Object.assign(window, { SettingsPanel });
