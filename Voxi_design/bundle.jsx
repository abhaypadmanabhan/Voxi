
// ==== design-canvas.jsx ====

// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), labels/titles are inline-editable,
// and any artboard can be opened in a fullscreen focus overlay (←/→/Esc).
// State persists to a .design-canvas.state.json sidecar via the host
// bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = [
    '.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}',
    '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}',
    '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}',
    '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}',
    '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}',
    '.dc-card{transition:box-shadow .15s,transform .15s}',
    '.dc-card *{scrollbar-width:none}',
    '.dc-card *::-webkit-scrollbar{display:none}',
    '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px}',
    '.dc-grip{cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s}',
    '.dc-grip:hover{background:rgba(0,0,0,.08)}',
    '.dc-grip:active{cursor:grabbing}',
    '.dc-labeltext{cursor:pointer;border-radius:4px;padding:3px 6px;display:flex;align-items:center;transition:background .12s}',
    '.dc-labeltext:hover{background:rgba(0,0,0,.05)}',
    '.dc-expand{position:absolute;bottom:100%;right:0;margin-bottom:5px;z-index:2;opacity:0;transition:opacity .12s,background .12s;',
    '  width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;',
    '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center}',
    '.dc-expand:hover{background:rgba(0,0,0,.06);color:#2a251f}',
    '[data-dc-slot]:hover .dc-expand{opacity:1}',
  ].join('\n');
  document.head.appendChild(s);
}

const DCCtx = React.createContext(null);

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, focused
// artboard). Order/titles/labels persist to a .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';

function DesignCanvas({ children, minScale, maxScale, style }) {
  const [state, setState] = React.useState({ sections: {}, focus: null });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);

  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE)
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => {
        if (off || !saved || !saved.sections) return;
        skipNextWrite.current = true;
        setState((s) => ({ ...s, sections: saved.sections }));
      })
      .catch(() => {})
      .finally(() => { didRead.current = true; if (!off) setReady(true); });
    const t = setTimeout(() => { if (!off) setReady(true); }, 150);
    return () => { off = true; clearTimeout(t); };
  }, []);

  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) { skipNextWrite.current = false; return; }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({ sections: state.sections })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Only direct DCSection > DCArtboard children are
  // walked — wrapping them in other elements opts out of focus/reorder.
  const registry = {};     // slotId -> { sectionId, artboard }
  const sectionMeta = {};  // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  React.Children.forEach(children, (sec) => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const srcIds = [];
    React.Children.forEach(sec.props.children, (ab) => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (!aid) return;
      registry[`${sid}/${aid}`] = { sectionId: sid, artboard: ab };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter((k) => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter((k) => !kept.includes(k))],
    };
  });

  const api = React.useMemo(() => ({
    state,
    section: (id) => state.sections[id] || {},
    patchSection: (id, p) => setState((s) => ({
      ...s,
      sections: { ...s.sections, [id]: { ...s.sections[id], ...(typeof p === 'function' ? p(s.sections[id] || {}) : p) } },
    })),
    setFocus: (slotId) => setState((s) => ({ ...s, focus: slotId })),
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') api.setFocus(null); };
    const onPd = (e) => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);

  return (
    <DCCtx.Provider value={api}>
      <DCViewport minScale={minScale} maxScale={maxScale} style={style}>{ready && children}</DCViewport>
      {state.focus && registry[state.focus] && (
        <DCFocusOverlay entry={registry[state.focus]} sectionMeta={sectionMeta} sectionOrder={sectionOrder} />
      )}
    </DCCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({ children, minScale = 0.1, maxScale = 8, style = {} }) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({ x: 0, y: 0, scale: 1 });

  const apply = React.useCallback(() => {
    const { x, y, scale } = tf.current;
    const el = worldRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left, py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = (e) =>
      e.deltaMode !== 0 ||
      (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);

    const onWheel = (e) => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if (e.ctrlKey) {
        // trackpad pinch (or explicit ctrl+wheel)
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = (e) => { e.preventDefault(); isGesturing = true; gsBase = tf.current.scale; };
    const onGestureChange = (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, (gsBase * e.scale) / tf.current.scale);
    };
    const onGestureEnd = (e) => { e.preventDefault(); isGesturing = false; };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = (e) => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || (e.button === 0 && onBg))) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', onGestureStart, { passive: false });
    vp.addEventListener('gesturechange', onGestureChange, { passive: false });
    vp.addEventListener('gestureend', onGestureEnd, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);

  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return (
    <div
      ref={vpRef}
      className="design-canvas"
      style={{
        height: '100vh', width: '100vw',
        background: DC.bg,
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        position: 'relative',
        fontFamily: DC.font,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
          width: 'max-content', minWidth: '100%',
          minHeight: '100%',
          padding: '60px 0 80px',
        }}
      >
        <div style={{ position: 'absolute', inset: -6000, backgroundImage: gridSvg, backgroundSize: '120px 120px', pointerEvents: 'none', zIndex: -1 }} />
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({ id, title, subtitle, children, gap = 48 }) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(children);
  const artboards = all.filter((c) => c && c.type === DCArtboard);
  const rest = all.filter((c) => !(c && c.type === DCArtboard));
  const srcOrder = artboards.map((a) => a.props.id ?? a.props.label);
  const sec = (ctx && sid && ctx.section(sid)) || {};

  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter((k) => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter((k) => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);

  const byId = Object.fromEntries(artboards.map((a) => [a.props.id ?? a.props.label, a]));

  return (
    <div data-dc-section={sid} style={{ marginBottom: 80, position: 'relative' }}>
      <div style={{ padding: '0 60px 56px' }}>
        <DCEditable tag="div" value={sec.title ?? title}
          onChange={(v) => ctx && sid && ctx.patchSection(sid, { title: v })}
          style={{ fontSize: 28, fontWeight: 600, color: DC.title, letterSpacing: -0.4, marginBottom: 6, display: 'inline-block' }} />
        {subtitle && <div style={{ fontSize: 16, color: DC.subtitle }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'flex', gap, padding: '0 60px', alignItems: 'flex-start', width: 'max-content' }}>
        {order.map((k) => (
          <DCArtboardFrame key={k} sectionId={sid} artboard={byId[k]} order={order}
            label={(sec.labels || {})[k] ?? byId[k].props.label}
            onRename={(v) => ctx && ctx.patchSection(sid, (x) => ({ labels: { ...x.labels, [k]: v } }))}
            onReorder={(next) => ctx && ctx.patchSection(sid, { order: next })}
            onFocus={() => ctx && ctx.setFocus(`${sid}/${k}`)} />
        ))}
      </div>
      {rest}
    </div>
  );
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() { return null; }

function DCArtboardFrame({ sectionId, artboard, label, order, onRename, onReorder, onFocus }) {
  const { id: rawId, label: rawLabel, width = 260, height = 480, children, style = {} } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map((el) => ({ el, id: el.dataset.dcSlot, x: el.getBoundingClientRect().left }));
    const slotXs = homes.map((h) => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');

    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };

    const move = (ev) => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0, best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) { best = d; nearest = i; }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter((k) => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) { h.el.style.transition = 'none'; h.el.style.transform = ''; }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <div ref={ref} data-dc-slot={id} style={{ position: 'relative', flexShrink: 0 }}>
      <div className="dc-labelrow" style={{ position: 'absolute', bottom: '100%', left: -4, marginBottom: 4, color: DC.label }}>
        <div className="dc-grip" onPointerDown={onGripDown} title="Drag to reorder">
          <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor"><circle cx="2" cy="2" r="1.1"/><circle cx="7" cy="2" r="1.1"/><circle cx="2" cy="6.5" r="1.1"/><circle cx="7" cy="6.5" r="1.1"/><circle cx="2" cy="11" r="1.1"/><circle cx="7" cy="11" r="1.1"/></svg>
        </div>
        <div className="dc-labeltext" onClick={onFocus} title="Click to focus">
          <DCEditable value={label} onChange={onRename} onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 15, fontWeight: 500, color: DC.label, lineHeight: 1 }} />
        </div>
      </div>
      <button className="dc-expand" onClick={onFocus} onPointerDown={(e) => e.stopPropagation()} title="Focus">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"/></svg>
      </button>
      <div className="dc-card"
        style={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)', overflow: 'hidden', width, height, background: '#fff', ...style }}>
        {children || <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13, fontFamily: DC.font }}>{id}</div>}
      </div>
    </div>
  );
}

// Inline rename — commits on blur or Enter.
function DCEditable({ value, onChange, style, tag = 'span', onClick }) {
  const T = tag;
  return (
    <T className="dc-editable" contentEditable suppressContentEditableWarning
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onChange && onChange(e.currentTarget.textContent)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      style={style}>{value}</T>
  );
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({ entry, sectionMeta, sectionOrder }) {
  const ctx = React.useContext(DCCtx);
  const { sectionId, artboard } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);

  const go = (d) => { const n = peers[(idx + d + peers.length) % peers.length]; if (n) ctx.setFocus(`${sectionId}/${n}`); };
  const goSection = (d) => {
    const ns = sectionOrder[(secIdx + d + sectionOrder.length) % sectionOrder.length];
    const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
    if (first) ctx.setFocus(`${ns}/${first}`);
  };

  React.useEffect(() => {
    const k = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goSection(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); goSection(1); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const { width = 260, height = 480, children } = artboard.props;
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => { const r = () => setVp({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));

  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({ dir, onClick }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ position: 'absolute', top: '50%', [dir]: 28, transform: 'translateY(-50%)',
        border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.9)',
        width: 44, height: 44, borderRadius: 22, fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.18)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'} /></svg>
    </button>
  );

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(
    <div onClick={() => ctx.setFocus(null)}
      onWheel={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(24,20,16,.6)', backdropFilter: 'blur(14px)',
        fontFamily: DC.font, color: '#fff' }}>

      {/* top bar: section dropdown (left) · close (right) */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, display: 'flex', alignItems: 'flex-start', padding: '16px 20px 0', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setDd((o) => !o)}
            style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: '6px 8px',
              borderRadius: 6, textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>{meta.title}</span>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: .7 }}><path d="M2 4l3.5 3.5L9 4"/></svg>
            </span>
            {meta.subtitle && <span style={{ display: 'block', fontSize: 13, opacity: .6, fontWeight: 400, marginTop: 2 }}>{meta.subtitle}</span>}
          </button>
          {ddOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#2a251f', borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)', padding: 4, minWidth: 200, zIndex: 10 }}>
              {sectionOrder.map((sid) => (
                <button key={sid} onClick={() => { setDd(false); const f = sectionMeta[sid].slotIds[0]; if (f) ctx.setFocus(`${sid}/${f}`); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent', color: '#fff',
                    padding: '8px 12px', borderRadius: 5, fontSize: 14, fontWeight: sid === sectionId ? 600 : 400, fontFamily: 'inherit' }}>
                  {sectionMeta[sid].title}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => ctx.setFocus(null)}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,.7)', width: 32, height: 32,
            borderRadius: 16, fontSize: 20, cursor: 'pointer', lineHeight: 1, transition: 'background .12s' }}>×</button>
      </div>

      {/* card centered, label + index below — only the card itself stops
          propagation so any backdrop click (including the margins around
          the card) exits focus */}
      <div
        style={{ position: 'absolute', top: 64, bottom: 56, left: 100, right: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: width * scale, height: height * scale, position: 'relative' }}>
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', background: '#fff', borderRadius: 2, overflow: 'hidden',
            boxShadow: '0 20px 80px rgba(0,0,0,.4)' }}>
            {children || <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>{aid}</div>}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ fontSize: 14, fontWeight: 500, opacity: .85, textAlign: 'center' }}>
          {(sec.labels || {})[aid] ?? artboard.props.label}
          <span style={{ opacity: .5, marginLeft: 10, fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {peers.length}</span>
        </div>
      </div>

      <Arrow dir="left" onClick={() => go(-1)} />
      <Arrow dir="right" onClick={() => go(1)} />

      {/* dots */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
        {peers.map((p, i) => (
          <button key={p} onClick={() => ctx.setFocus(`${sectionId}/${p}`)}
            style={{ border: 'none', padding: 0, cursor: 'pointer', width: 6, height: 6, borderRadius: 3,
              background: i === idx ? '#fff' : 'rgba(255,255,255,.3)' }} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({ children, top, left, right, bottom, rotate = -2, width = 180 }) {
  return (
    <div style={{
      position: 'absolute', top, left, right, bottom, width,
      background: DC.postitBg, padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14, lineHeight: 1.4, color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5,
    }}>{children}</div>
  );
}

Object.assign(window, { DesignCanvas, DCSection, DCArtboard, DCPostIt });



// ==== pill.jsx ====
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


// ==== cards.jsx ====
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


// ==== settings.jsx ====
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


// ==== desktop.jsx ====
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


// ==== voxi-live.jsx ====
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


// ==== app.jsx ====
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

