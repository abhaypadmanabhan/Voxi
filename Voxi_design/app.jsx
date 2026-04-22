// Main app — design canvas with all Voxi artboards

const TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "indigo",
  "recordingTint": "rose",
  "autoDemo": true,
  "showDesktop": true
}/*EDITMODE-END*/;

// Static preview of any one pill state, plus a mini desktop behind.
function StatePreview({ state, label, caption, showPill = true, showTranscript, showCorrection, transcriptText, corrected }) {
  const amps = [0.3, 0.6, 0.95, 0.85, 0.4, 0.7, 0.25];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DesktopBackground showApp />
      <div style={{
        position: 'absolute', bottom: 76, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {showCorrection && <CorrectionBadge visible word={corrected || 'voxi'} />}
        {showTranscript && (
          <TranscriptCard
            text={transcriptText}
            streaming={state === 'processing'}
            visible
          />
        )}
        {showPill && (
          <>
            {state === 'idle' && <IdlePill />}
            {state === 'recording' && <RecordingPill amps={amps} elapsed={3200} />}
            {state === 'processing' && <ProcessingPill />}
          </>
        )}
      </div>
      {label && (
        <div style={{
          position: 'absolute', top: 44, left: 24,
          fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
        }}>{label}</div>
      )}
      {caption && (
        <div style={{
          position: 'absolute', top: 62, left: 24, maxWidth: 360,
          fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4,
        }}>{caption}</div>
      )}
    </div>
  );
}

// Live prototype — self-driving demo loop
function LivePrototype() {
  const [pillState, setPillState] = React.useState('idle');
  const [settings, setSettings] = React.useState({
    formatter: true,
    autopaste: true,
    learn: true,
    vocab: ['Voxi', 'Maya', 'Northlake', 'OKR'],
  });
  const [showSettings, setShowSettings] = React.useState(false);
  const [showCorrection, setShowCorrection] = React.useState(false);
  const autoTimerRef = React.useRef([]);

  React.useEffect(() => {
    if (!TWEAKS.autoDemo) return;
    const timers = autoTimerRef.current;
    const add = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clear = () => { timers.forEach(clearTimeout); timers.length = 0; };

    const run = () => {
      clear();
      setPillState('idle');
      add(() => setPillState('recording'), 2200);
      add(() => setPillState('processing'), 2200 + 3200);
      add(() => {
        setShowCorrection(true);
        add(() => setShowCorrection(false), 2400);
      }, 2200 + 3200 + 5500);
      add(run, 2200 + 3200 + 5500 + 3000);
    };
    run();
    return clear;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DesktopBackground showApp />
      <div style={{
        position: 'absolute', bottom: 76, left: '50%',
        transform: 'translateX(-50%)',
      }}>
        <VoxiLive
          pillState={pillState}
          setPillState={setPillState}
          settings={settings}
          setSettings={setSettings}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          showCorrection={showCorrection}
        />
      </div>
      <div style={{
        position: 'absolute', top: 40, right: 24,
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        fontSize: 11.5, color: 'rgba(255,255,255,0.72)',
        letterSpacing: -0.05,
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2 }}>Try it</div>
        <div>Click pill to cycle states · right-click pill for settings</div>
      </div>
    </div>
  );
}

function SettingsPreview() {
  const [settings, setSettings] = React.useState({
    formatter: true,
    autopaste: true,
    learn: false,
    vocab: ['Voxi', 'Maya', 'Northlake', 'OKR', 'TTS'],
  });
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DesktopBackground showApp />
      <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
        <SettingsPanel open onClose={() => {}} settings={settings} setSettings={setSettings} />
        <IdlePill />
      </div>
    </div>
  );
}

function AllStatesRow() {
  const amps = [0.3, 0.6, 0.95, 0.85, 0.4, 0.7, 0.25];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #1a1530, #2d1b3d 45%, #4a1f3a)',
      padding: 32,
      display: 'flex', flexDirection: 'column',
      gap: 24,
    }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 4 }}>State machine</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', letterSpacing: -0.05 }}>
          Hold ⌥ Space to dictate. Release to transcribe.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
        <StateRow label="Idle" meta="120 × 40 · unobtrusive">
          <IdlePill />
        </StateRow>
        <StateRow label="Recording" meta="280 × 52 · red glow + waveform">
          <RecordingPill amps={amps} elapsed={3200} />
        </StateRow>
        <StateRow label="Processing" meta="200 × 44 · indigo">
          <ProcessingPill />
        </StateRow>
      </div>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.35)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        fontSize: 11.5, color: 'rgba(255,255,255,0.65)',
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M6 2v4l2.5 1.5" /><circle cx="6" cy="6" r="4.5"/></svg>
        Transitions spring between states (stiffness 260, damping 28).
      </div>
    </div>
  );
}

function StateRow({ label, meta, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 120 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: -0.05 }}>{meta}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  );
}

function CardsGallery() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(135deg, #1a1530, #4a1f3a)',
      padding: 32,
      display: 'flex', flexDirection: 'column',
      gap: 22,
    }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4, marginBottom: 4 }}>Floating cards</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', letterSpacing: -0.05 }}>
          Anchored above the pill, dismissed automatically.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <Tag>Transcript preview</Tag>
          <TranscriptCard
            text="Hey Maya — I went through the roadmap this morning and pulled out three things worth discussing: telemetry cutover, onboarding cohorts, and legal review."
            streaming
            visible
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Tag>Correction badge</Tag>
          <CorrectionBadge visible word="Voxi" />
        </div>
      </div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
    }}>{children}</span>
  );
}

function AnatomySheet() {
  const amps = [0.3, 0.6, 0.95, 0.85, 0.4, 0.7, 0.25];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0f0f14',
      padding: 40,
      color: '#fff',
      display: 'flex', flexDirection: 'column', gap: 32,
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>Anatomy — Recording state</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          Dimensions, spacing and color tokens. Everything else inherits from these.
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <RecordingPill amps={amps} elapsed={3200} />
          <Anno top={-26} left="50%" tx="-50%">280 × 52</Anno>
          <Anno top={"50%"} left={-110} ty="-50%">glow rgba(244,63,94) / 28%</Anno>
          <Anno top={"50%"} right={-140} ty="-50%">bg rgba(18,10,12) / 78%<br/>blur 28px · sat 1.5</Anno>
          <Anno bottom={-26} left="50%" tx="-50%">border 0.5px rose/22%</Anno>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Token swatch="#f43f5e" label="Rose · recording" code="rgb(244,63,94)" />
        <Token swatch="#6366f1" label="Indigo · processing" code="rgb(99,102,241)" />
        <Token swatch="#10b981" label="Emerald · correction" code="rgb(16,185,129)" />
        <Token swatch="rgba(0,0,0,0.72)" label="Base glass" code="bg-black / 72%" />
      </div>
    </div>
  );
}

function Anno({ children, top, bottom, left, right, tx, ty }) {
  return (
    <div style={{
      position: 'absolute', top, bottom, left, right,
      transform: `translate(${tx || 0},${ty || 0})`,
      fontSize: 10.5, fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
      color: 'rgba(129,140,248,0.9)', letterSpacing: 0.2,
      whiteSpace: 'nowrap', lineHeight: 1.3,
    }}>{children}</div>
  );
}

function Token({ swatch, label, code }) {
  return (
    <div style={{
      padding: 14,
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
    }}>
      <div style={{
        height: 40, borderRadius: 6,
        background: swatch,
        border: '0.5px solid rgba(255,255,255,0.08)',
        marginBottom: 10,
      }} />
      <div style={{ fontSize: 11.5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', marginTop: 2 }}>{code}</div>
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection id="hero" title="Voxi" subtitle="Floating voice dictation — interactive prototype + component set">
        <DCArtboard id="live" label="Live prototype · click pill to cycle states" width={960} height={600}>
          <LivePrototype />
        </DCArtboard>
        <DCArtboard id="states" label="All three states" width={640} height={600}>
          <AllStatesRow />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-ctx" title="States in context" subtitle="Each state rendered against a desktop backdrop, pill anchored bottom-center.">
        <DCArtboard id="idle" label="01 · Idle — compact pill" width={720} height={480}>
          <StatePreview state="idle" label="Idle" caption="Compact 120×40 pill with hotkey hint. Sits quietly above every app, dismissible with ⌥⎋." />
        </DCArtboard>
        <DCArtboard id="recording" label="02 · Recording — waveform" width={720} height={480}>
          <StatePreview state="recording" label="Recording" caption="Pill expands to 280×52. Red pulse + 7-bar spring waveform react to amplitude. Elapsed time is monospaced." />
        </DCArtboard>
        <DCArtboard id="processing" label="03 · Processing — transcript streaming" width={720} height={480}>
          <StatePreview
            state="processing"
            label="Processing"
            caption="Indigo spinner. Transcript card streams above the pill with a blinking cursor; fades 2s after the final token."
            showTranscript
            transcriptText="Hey Maya — I went through the roadmap this morning and pulled out three things worth"
          />
        </DCArtboard>
      </DCSection>

      <DCSection id="cards" title="Floating cards" subtitle="Stacked above the pill, reveal-springed.">
        <DCArtboard id="transcript" label="Transcript preview" width={640} height={520}>
          <CardsGallery />
        </DCArtboard>
        <DCArtboard id="correction" label="Correction learned" width={720} height={480}>
          <StatePreview
            state="idle"
            label="Correction badge"
            caption="Appears briefly when the user edits a transcribed word — Voxi stores the substitution and applies it next time."
            showCorrection
            corrected="Northlake"
          />
        </DCArtboard>
      </DCSection>

      <DCSection id="settings" title="Settings" subtitle="Right-click the pill. Popover anchors to it, dismisses on outside click.">
        <DCArtboard id="settings-open" label="Popover anchored to pill" width={720} height={600}>
          <SettingsPreview />
        </DCArtboard>
      </DCSection>

      <DCSection id="anatomy" title="Anatomy & tokens" subtitle="Dimensions, blur, color.">
        <DCArtboard id="anatomy-sheet" label="Recording state — annotated" width={800} height={560}>
          <AnatomySheet />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

window.parent?.postMessage({ type: '__edit_mode_available' }, '*');
