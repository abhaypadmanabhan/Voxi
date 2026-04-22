// Main app — the live interactive prototype shown in the hero artboard.
// Orchestrates state machine: idle ↔ recording ↔ processing → done

const SAMPLE_TRANSCRIPTS = [
  "Hey Maya — I went through the roadmap this morning and pulled out three things worth discussing: the telemetry cutover, onboarding cohorts, and what we owe legal before the launch window.",
  "Can you move the all hands to Thursday at 3? Also flag Priya on the hiring loop — we need her feedback by Friday.",
  "The build is failing on the staging branch. I think it's the new migration script but I can't tell without looking at the logs.",
];

function VoxiLive({ pillState, setPillState, settings, setSettings, showSettings, setShowSettings, onTranscribeDone, showCorrection, paused }) {
  const [amps, setAmps] = React.useState(() => Array(7).fill(0.2));
  const [elapsed, setElapsed] = React.useState(0);
  const [transcriptText, setTranscriptText] = React.useState('');
  const [transcriptVisible, setTranscriptVisible] = React.useState(false);
  const startRef = React.useRef(0);
  const fullTextRef = React.useRef('');
  const transcriptIdxRef = React.useRef(0);

  // Recording: animate waveform + clock
  React.useEffect(() => {
    if (pillState !== 'recording' || paused) return;
    startRef.current = Date.now() - elapsed;
    let raf;
    const tick = () => {
      setElapsed(Date.now() - startRef.current);
      setAmps((prev) => prev.map(() => {
        // smooth-ish random amp with bias
        return 0.2 + Math.random() * 0.75;
      }));
      raf = setTimeout(tick, 95);
    };
    tick();
    return () => clearTimeout(raf);
  }, [pillState, paused]);

  // Reset elapsed when entering recording fresh from idle
  React.useEffect(() => {
    if (pillState === 'recording' && elapsed === 0) startRef.current = Date.now();
    if (pillState === 'idle') setElapsed(0);
  }, [pillState]);

  // Processing: stream text in
  React.useEffect(() => {
    if (pillState !== 'processing') return;
    const pick = SAMPLE_TRANSCRIPTS[transcriptIdxRef.current % SAMPLE_TRANSCRIPTS.length];
    transcriptIdxRef.current++;
    fullTextRef.current = pick;
    setTranscriptText('');
    setTranscriptVisible(true);
    let i = 0;
    const step = () => {
      if (i < pick.length) {
        // variable speed for realism
        const chunk = Math.max(1, Math.floor(Math.random() * 4));
        setTranscriptText(pick.slice(0, i + chunk));
        i += chunk;
        setTimeout(step, 28 + Math.random() * 40);
      } else {
        // finished streaming
        setTimeout(() => {
          setPillState('idle');
          onTranscribeDone && onTranscribeDone();
          // Keep transcript visible for 2s, then fade
          setTimeout(() => setTranscriptVisible(false), 2000);
        }, 450);
      }
    };
    const startId = setTimeout(step, 280);
    return () => clearTimeout(startId);
  }, [pillState]);

  const handlePillDown = (e) => {
    if (e.button === 2) return; // context handled separately
    // Simulate push-to-talk toggle: tap idle → recording, tap recording → processing
    if (pillState === 'idle') {
      setPillState('recording');
      setElapsed(0);
      setTranscriptVisible(false);
    } else if (pillState === 'recording') {
      setPillState('processing');
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setShowSettings(!showSettings);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Floating cards stack ABOVE pill */}
      <div style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 12,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 10,
        pointerEvents: 'none',
      }}>
        {showCorrection && (
          <div style={{ pointerEvents: 'auto' }}>
            <CorrectionBadge visible={showCorrection} word="voxi" />
          </div>
        )}
        <div style={{ pointerEvents: 'auto' }}>
          <TranscriptCard
            text={transcriptText || '\u00A0'}
            streaming={pillState === 'processing'}
            visible={transcriptVisible}
          />
        </div>
      </div>

      {/* Settings panel */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Pill */}
      <div onPointerDown={handlePillDown} onContextMenu={handleContextMenu}>
        {pillState === 'idle' && <IdlePill />}
        {pillState === 'recording' && <RecordingPill amps={amps} elapsed={elapsed} />}
        {pillState === 'processing' && <ProcessingPill />}
      </div>
    </div>
  );
}

Object.assign(window, { VoxiLive });
