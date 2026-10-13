// Wireframe parts for monitoring-style screens (kept in its own module; wireframe.ts hands over its drawing helpers).
//
//   states     state: 'missing' | 'disconnected' | 'loading' | 'empty' | 'stale' on ANY widget (a visual one gets hatching; a data widget a skeleton / message)
//   region     wf.region(label, {n, emphasis, hint})   a named block for coarse, whole-screen wireframes
//   anatomy    parts: {level: 1, ...}                    numbers on a part's inner pieces (insight, robot, fusion, compare)
//   fusion     wf.fusion({layers, opacity})        camera + point cloud + thermal overlaid, with layer toggles and an opacity slider
//   robot      wf.robot / wf.battery / wf.signal   a vehicle's status (name, mode, battery, link, last received)
//   map        markers: {kind: 'robot', id, shape, heading, fov}   — a robot is told apart by shape + letter, never colour alone
//   insight    wf.insight({title, level, text, evidence})          evidence + its acquisition time are REQUIRED
//   nav        wf.breadcrumb([...])
//   compare    wf.compare({left, right, at, diff, sync})           split view with a divider and diff boxes
//   controls   wf.toggle / wf.checkbox / wf.radio / wf.slider
//
// Everything is token-coloured (bg/text/muted/border/code/danger/accent/soft), >= 14px text, and every state
// is shown by shape, hatching or words as well as colour (WCAG 1.4.1).

import {toneStyle} from './tokens.ts';
import type {
  ColorKey, GlyphOpts, WfBattery, WfBreadcrumb, WfCheckbox, WfCompare, WfCtx, WfFusion, WfFusionLayerSpec, WfHelpers, WfInsight,
  WfInsightOpts, WfNode, WfPartKey, WfPartsApi, WfRadio, WfRegion, WfRobot, WfSignal, WfSlider, WfState, WfToggle, WfTone, WfType,
} from './types.ts';

interface StateInfo {title: string; tone: ColorKey}
interface FusionLayer extends WfFusionLayerSpec {kind: 'camera' | 'cloud' | 'thermal'; bad: WfState | undefined; on: boolean}

export function installParts(h: WfHelpers): WfPartsApi {
  const {wf, DRAW, NAT, AUTO_W, S, T, lh, rect, circle, badge, text, path, line, pts, mid, tw, wrapT, drawChip, chipW, hideUnder} = h;
  const mk = (t: WfType, o: object = {}) => ({t, ...o});

  // ---- constructors ----------------------------------------------------------------------
  Object.assign(wf, {
    fusion: (o?: object) => mk('fusion', o),
    compare: (o?: object) => mk('compare', o),
    region: (label: string, o?: object) => mk('region', {...o, label}),
    robot: (o: object) => mk('robot', o),
    battery: (level: number, o?: object) => mk('battery', {...o, level}),
    signal: (level: number | undefined, o?: object) => mk('signal', {...o, level}),
    insight: (o: WfInsightOpts) => { checkInsight(o); return mk('insight', o); },
    breadcrumb: (items: string[], o?: object) => mk('breadcrumb', {...o, items}),
    toggle: (label: string, o?: object) => mk('toggle', {...o, label}),
    checkbox: (label: string, o?: object) => mk('checkbox', {...o, label}),
    radio: (label: string, o?: object) => mk('radio', {...o, label}),
    slider: (label: string, o?: object) => mk('slider', {...o, label}),
  });

  // ---- shared drawing bits -----------------------------------------------------------------
  // A robot marker: shape + letter, so two vehicles never differ by colour alone.
  function glyph(ctx: WfCtx, cx: number, cy: number, o: GlyphOpts = {}) {
    const shape = o.shape ?? 'circle', r = o.r ?? 11, fill = o.fill ?? 'accent';
    badge(ctx, cx, cy, o.id ?? '', {shape, r, fill, aria: o.id ? `ロボット ${o.id}` : 'ロボット'});
  }
  const dirOf = (deg: number): [number, number] => { const a = (deg - 90) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; }; // 0 = up, clockwise
  function headingArrow(ctx: WfCtx, px: number, py: number, deg: number, r: number) {
    const [dx, dy] = dirOf(deg), [qx, qy] = [-dy, dx];
    path(ctx, pts([[px + dx * (r + 11), py + dy * (r + 11)], [px + dx * (r + 1) + qx * 5, py + dy * (r + 1) + qy * 5], [px + dx * (r + 1) - qx * 5, py + dy * (r + 1) - qy * 5]]) + ' Z', {fill: 'text', stroke: 'bg', sw: 1.5});
  }
  function fovSector(ctx: WfCtx, px: number, py: number, deg: number, fov: number, R: number) {
    const p: [number, number][] = [[px, py]];
    for (let i = 0; i <= 8; i++) { const [dx, dy] = dirOf(deg - fov / 2 + fov * i / 8); p.push([px + dx * R, py + dy * R]); }
    path(ctx, pts(p) + ' Z', {fill: 'accent', op: 0.18});
  }

  // ---- states: missing / disconnected / loading ------------------------------------------------
  const STATES: Record<WfState, StateInfo> = {
    missing: {title: 'データ欠損中', tone: 'muted'},
    disconnected: {title: '通信断', tone: 'danger'},
    loading: {title: '読み込み中', tone: 'muted'},
    empty: {title: 'データなし', tone: 'muted'},
    stale: {title: '古い情報', tone: 'muted'},
  };
  const VISUAL_T = new Set(['map', 'video', 'heat', 'pointcloud', 'chart', 'image', 'compare', 'fusion', 'region']);
  function drawStateIcon(n: WfNode, ix: number, iy: number, ctx: WfCtx) {
    if (n.state === 'disconnected') { circle(ctx, ix, iy, 11, {stroke: 'danger', sw: 2.5}); line(ctx, ix - 5, iy - 5, ix + 5, iy + 5, {stroke: 'danger', sw: 2.5}); line(ctx, ix - 5, iy + 5, ix + 5, iy - 5, {stroke: 'danger', sw: 2.5}); }
    else if (n.state === 'missing') { path(ctx, pts([[ix, iy - 12], [ix + 12, iy + 10], [ix - 12, iy + 10]]) + ' Z', {stroke: 'muted', sw: 2.5}); text(ctx, '!', ix, mid(iy + 3), {weight: 700, fill: 'muted', anchor: 'middle'}); }
    else if (n.state === 'empty') { rect(ctx, ix - 10, iy - 10, 20, 20, {r: 3, stroke: 'muted', sw: 2.5, dash: '4,3'}); }
    else { circle(ctx, ix, iy, 11, {stroke: 'muted', sw: 2.5}); line(ctx, ix, iy, ix, iy - 7, {stroke: 'muted', sw: 2.5}); line(ctx, ix, iy, ix + 5, iy + 2, {stroke: 'muted', sw: 2.5}); }
  }
  // the message box: icon at the left of the words, or - in a narrow frame - above them
  function stateBoxData(n: WfNode, st: StateInfo, w: number, ctx: WfCtx) {
    const title = n.stateTitle ?? st.title;
    const wide = tw(ctx, title, T, 700) + 64 <= w - 16;
    const note = n.stateNote ? wrapT(ctx, n.stateNote, S, 400, Math.max(60, wide ? Math.min(w - 72, 240) : w - 40)) : [];
    const inner = Math.max(tw(ctx, title, T, 700), ...note.map((l: string) => tw(ctx, l, S, 400)));
    const bw = Math.min(w - 16, inner + (wide ? 64 : 24));
    const bh = 12 + (wide ? 0 : 28) + lh(T) + (note.length ? note.length * lh(S) + 2 : 0) + 12;
    return {title, wide, note, bw, bh};
  }
  // The height a widget needs so its state's message box fits inside the frame (8px of air above and below).
  // stale only adds a badge on the edge, and a loading data widget draws skeleton bars: neither needs more.
  function stateMinH(n: WfNode, w: number, ctx: WfCtx): number {
    const st: StateInfo | undefined = n.state ? STATES[n.state] : undefined;
    if (!st || n.state === 'stale' || (n.state === 'loading' && !VISUAL_T.has(n.t))) return 0;
    return Math.ceil(stateBoxData(n, st, w, ctx).bh) + 16;
  }
  function drawStateBox(n: WfNode, st: StateInfo, x: number, y: number, w: number, hh: number, ctx: WfCtx) {
    const tone = st.tone === 'danger' ? 'danger' : 'text';
    const {title, wide, note, bw, bh} = stateBoxData(n, st, w, ctx);
    const bx = x + (w - bw) / 2, by = y + (hh - bh) / 2;
    rect(ctx, bx, by, bw, bh, {r: 8, fill: 'bg', stroke: st.tone, sw: 2.5});
    if (wide) {
      drawStateIcon(n, bx + 24, by + bh / 2, ctx);
      text(ctx, title, bx + 46, by + 12 + T, {size: T, weight: 700, fill: tone});
      note.forEach((l: string, k: number) => text(ctx, l, bx + 46, by + 12 + lh(T) + S + 2 + k * lh(S), {fill: 'muted'}));
    } else {
      drawStateIcon(n, x + w / 2, by + 24, ctx);
      text(ctx, title, x + w / 2, by + 12 + 28 + T, {size: T, weight: 700, fill: tone, anchor: 'middle'});
      note.forEach((l: string, k: number) => text(ctx, l, x + w / 2, by + 12 + 28 + lh(T) + S + 2 + k * lh(S), {fill: 'muted', anchor: 'middle'}));
    }
  }
  // state: any widget can be missing / disconnected / loading / empty / stale. Visual widgets (video, map ...)
  // get hatching; data widgets (stat, list, table, robot, insight ...) get a skeleton while loading.
  function drawState(n: WfNode, x: number, y: number, w: number, hh: number, ctx: WfCtx) {
    const st: StateInfo | undefined = n.state ? STATES[n.state] : undefined;
    if (!st) throw new Error(`wireframe(): unknown state "${n.state}" (use ${Object.keys(STATES).join(' / ')})`);
    if (hh < 40 || w < 80) throw new Error(`wireframe(): state "${n.state}" needs a widget at least 80x40px (a "${n.t}" here is ${Math.round(w)}x${Math.round(hh)})`);
    const visual = VISUAL_T.has(n.t);
    if (n.state === 'stale') { // the data stays fully readable; a dashed outline and a badge on the top edge say how old it is
      rect(ctx, x, y, w, hh, {r: 6, stroke: 'muted', sw: 2, dash: '6,4'});
      const lab = `${n.stateTitle ?? st.title}${n.stateNote ? ` ${n.stateNote}` : ''}`, cw = Math.min(chipW(ctx, lab), w - 16);
      drawChip(ctx, lab, x + w - 8 - cw, y - 12, 'muted'); // on the top edge: the bottom rows ("last received" ...) stay readable
      return;
    }
    // every other state replaces the content: what lies under it is not drawn (it would be invisible, and stale values must not look current)
    hideUnder(ctx, x, y, w, hh);
    rect(ctx, x, y, w, hh, {r: 6, fill: 'bg', stroke: 'border', sw: 2});
    if (n.state === 'loading' && !visual) { // skeleton bars where the content will be
      for (let k = 0, by = y + 42; by + 12 < y + hh - 8 && k < 5; k++, by += 22) rect(ctx, x + 12, by, (w - 24) * [0.85, 0.6, 0.75, 0.45, 0.65][k], 10, {r: 5, fill: 'border'});
      const lab = n.stateTitle ?? st.title, cw = chipW(ctx, lab);
      drawChip(ctx, lab, x + w - 8 - Math.min(cw, w - 16), y + 8, 'muted');
      return;
    }
    if (n.state !== 'empty') { // hatching for the states where the data is missing
      for (let x0 = x - hh; x0 < x + w; x0 += 16) { // 45-degree hatching, clipped to the frame
        const ax = Math.max(x0, x), bx = Math.min(x0 + hh, x + w);
        if (bx - ax > 2) line(ctx, ax, y + hh - (ax - x0), bx, y + hh - (bx - x0), {stroke: 'muted', sw: 1.5, op: 0.3});
      }
    }
    drawStateBox(n, st, x, y, w, hh, ctx);
    const label = (n as {label?: string}).label; // only some widgets have a label
    if (visual && label && n.t !== 'chart') { // keep the frame's name (it says WHICH one is in this state), drawn after the hatching
      const lw = tw(ctx, label, S, 700) + 12;
      rect(ctx, x + 8, y + hh - 30, lw, 22, {r: 4, fill: 'bg'});
      text(ctx, label, x + 14, mid(y + hh - 19), {weight: 700, fill: 'muted'});
    }
  }

  // numbers on a part's inner pieces: wf.insight({parts: {level: 1, evidence: 2}})
  const part = (ctx: WfCtx, n: WfNode, key: WfPartKey, px: number, py: number) => { const v = n.parts?.[key]; if (v != null && v !== true) ctx.callouts.push({n: v, x: px, y: py}); };

  // ---- small controls -------------------------------------------------------------------------
  function drawToggleAt(ctx: WfCtx, x: number, y: number, on: boolean, label: string | undefined, o: {disabled?: boolean} = {}) {
    if (o.disabled) { // a layer that cannot be switched on (its data is missing)
      rect(ctx, x, y + 4, 36, 20, {r: 10, fill: 'code', stroke: 'border', dash: '4,3'});
      line(ctx, x + 12, y + 10, x + 24, y + 18, {stroke: 'muted', sw: 2}); line(ctx, x + 12, y + 18, x + 24, y + 10, {stroke: 'muted', sw: 2});
      if (label) text(ctx, label, x + 44, mid(y + 14), {fill: 'muted'});
      return 44 + (label ? tw(ctx, label, S, 400) : 0);
    }
    rect(ctx, x, y + 4, 36, 20, {r: 10, fill: on ? 'accent' : 'code', stroke: on ? null : 'muted'});
    if (on) path(ctx, pts([[x + 8, y + 14], [x + 12, y + 18], [x + 18, y + 10]]), {stroke: 'bg', sw: 2.5});
    circle(ctx, on ? x + 26 : x + 10, y + 14, 7, {fill: 'bg', stroke: on ? null : 'muted', sw: 2});
    if (label) text(ctx, label, x + 44, mid(y + 14), {});
    return 44 + (label ? tw(ctx, label, S, 400) : 0);
  }
  function drawSliderAt(ctx: WfCtx, x: number, y: number, w: number, value: number) {
    const cy = y + 14, at = x + 8 + (w - 16) * Math.max(0, Math.min(1, value));
    line(ctx, x + 8, cy, x + w - 8, cy, {stroke: 'border', sw: 4});
    line(ctx, x + 8, cy, at, cy, {stroke: 'accent', sw: 4});
    circle(ctx, at, cy, 8, {fill: 'bg', stroke: 'accent', sw: 3});
  }
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

  Object.assign(AUTO_W, {
    toggle: (n: WfToggle, ctx: WfCtx) => 44 + tw(ctx, n.label, S, 400),
    checkbox: (n: WfCheckbox, ctx: WfCtx) => 28 + tw(ctx, n.label, S, 400),
    radio: (n: WfRadio, ctx: WfCtx) => 28 + tw(ctx, n.label, S, 400),
    battery: (n: WfBattery, ctx: WfCtx) => 46 + tw(ctx, batteryText(n), S, 700),
    signal: (n: WfSignal, ctx: WfCtx) => 30 + tw(ctx, signalText(n), S, 700),
  });
  Object.assign(NAT, {toggle: () => 28, checkbox: () => 28, radio: () => 28, slider: () => 32, battery: () => 24, signal: () => 24, breadcrumb: () => 28, robot: (n: WfRobot, w: number) => (compactRobot(n, w) ? 150 : 104),
    insight: (n: WfInsight, w: number, ctx: WfCtx) => insightData(n, w, ctx).h});

  Object.assign(DRAW, {
    toggle: (n: WfToggle, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => ({w: drawToggleAt(ctx, x, y, n.on !== false, n.label), h: 28}),
    checkbox: (n: WfCheckbox, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => {
      const on = n.checked !== false;
      rect(ctx, x, y + 5, 18, 18, {r: 3, fill: on ? 'accent' : 'bg', stroke: on ? null : 'text'});
      if (on) path(ctx, pts([[x + 4, y + 14], [x + 8, y + 18], [x + 14, y + 10]]), {stroke: 'bg', sw: 2.5});
      text(ctx, n.label, x + 28, mid(y + 14), {});
      return {w: 28 + tw(ctx, n.label, S, 400), h: 28};
    },
    slider: (n: WfSlider, x: number, y: number, w: number, _hh: number, ctx: WfCtx) => {
      const lw = n.label ? tw(ctx, n.label, S, 400) + 12 : 0, dw = n.display ? tw(ctx, n.display, S, 700) + 12 : 0;
      if (n.label) text(ctx, n.label, x, mid(y + 14), {});
      drawSliderAt(ctx, x + lw, y, w - lw - dw, n.value ?? 0.5);
      if (n.display) text(ctx, n.display, x + w, mid(y + 14), {weight: 700, anchor: 'end'});
      return {w, h: 32};
    },
    battery: (n: WfBattery, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => {
      const lv = Math.max(0, Math.min(1, n.level)), low = lv < 0.2;
      rect(ctx, x, y + 4, 36, 16, {r: 3, fill: 'bg', stroke: low ? 'danger' : 'text'});
      rect(ctx, x + 36, y + 9, 3, 6, {fill: low ? 'danger' : 'text'});
      if (lv > 0) rect(ctx, x + 3, y + 7, Math.max(2, 30 * lv), 10, {fill: low ? 'danger' : 'accent'});
      text(ctx, batteryText(n), x + 46, mid(y + 12), {weight: 700, fill: low ? 'danger' : 'text'});
      return {w: 46 + tw(ctx, batteryText(n), S, 700), h: 24};
    },
    signal: (n: WfSignal, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => {
      const lv = Math.max(0, Math.min(3, n.level ?? 3));
      [6, 11, 16].forEach((bh, i) => rect(ctx, x + i * 8, y + 20 - bh, 6, bh, {fill: i < lv ? 'accent' : 'border'}));
      if (lv === 0) { line(ctx, x - 1, y + 3, x + 23, y + 21, {stroke: 'danger', sw: 2.5}); }
      text(ctx, signalText(n), x + 30, mid(y + 12), {weight: 700, fill: lv === 0 ? 'danger' : 'text'});
      return {w: 30 + tw(ctx, signalText(n), S, 700), h: 24};
    },
  });
  // radio needs the same signature as the others; defined separately to keep the Object.assign tidy
  DRAW.radio = (n: WfRadio, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => {
    circle(ctx, x + 9, y + 14, 9, {fill: 'bg', stroke: 'text'});
    if (n.selected !== false) circle(ctx, x + 9, y + 14, 5, {fill: 'accent'});
    text(ctx, n.label, x + 28, mid(y + 14), {});
    return {w: 28 + tw(ctx, n.label, S, 400), h: 28};
  };

  const batteryText = (n: {level: number}) => `${pct(n.level)}${n.level < 0.2 ? ' 低下' : ''}`;
  const signalText = (n: {level?: number; text?: string}) => n.text ?? ['途絶', '弱い', 'やや弱い', '良好'][Math.max(0, Math.min(3, n.level ?? 3))];

  // ---- robot status card -----------------------------------------------------------------
  // narrow frames (a cell in a state matrix, a side rail) stack the card's rows instead of laying them side by side
  const compactRobot = (n: WfRobot, w: number) => n.compact ?? w < 210;
  DRAW.robot = (n: WfRobot, x: number, y: number, w: number, _hh: number, ctx: WfCtx) => {
    const lost = (n.link ?? 3) === 0, compact = compactRobot(n, w), H = compact ? 150 : 104;
    rect(ctx, x, y, w, H, {r: 8, fill: n.active ? 'soft' : 'bg', stroke: lost ? 'danger' : n.active ? 'accent' : 'border', sw: n.active ? 2.5 : 2, dash: lost ? '6,4' : undefined});
    let tx = x + 14;
    if (n.marker) { glyph(ctx, x + 26, y + 26, {shape: n.marker.shape, id: n.marker.id}); tx = x + 48; }
    text(ctx, n.name, tx, y + 31, {size: T, weight: 700});
    const bat = {t: 'battery', level: n.battery ?? 0} as WfBattery, batW = AUTO_W.battery!(bat, ctx);
    const modeW = n.mode ? chipW(ctx, n.mode) : 0, modeTone = n.modeTone ?? (lost ? 'danger' : 'accent');
    // rows: wide = [name .. mode] [battery  signal] [last];  compact = [name] [mode] [battery] [signal] [last]
    const mx = compact ? x + 14 : x + w - 12 - modeW, my = compact ? y + 44 : y + 14;
    const by = compact ? y + 76 : y + 46, sx = compact ? x + 14 : x + 14 + batW + 24, sy = compact ? y + 102 : y + 46, ly = compact ? y + 142 : y + 90;
    if (n.mode) drawChip(ctx, n.mode, mx, my, modeTone);
    DRAW.battery!(bat, x + 14, by, w, 24, ctx);
    DRAW.signal!({t: 'signal', level: n.link ?? 3} as WfSignal, sx, sy, w, 24, ctx);
    text(ctx, n.last ? `最終受信 ${n.last}` : '最終受信 —', x + 14, ly, {fill: lost ? 'danger' : 'muted', weight: lost ? 700 : 400});
    part(ctx, n, 'marker', x + 14, y + 12); part(ctx, n, 'name', tx - 2, y + 12); part(ctx, n, 'mode', mx + (compact ? -2 : modeW), my);
    part(ctx, n, 'battery', x + 8, by); part(ctx, n, 'signal', sx - 6, sy); part(ctx, n, 'last', x + 8, ly - 12);
    return {w, h: H};
  };

  // ---- insight card (evidence + acquisition time are required) -------------------------------------
  function checkInsight(n: WfInsightOpts) {
    const name = `wf.insight("${n.title ?? ''}")`;
    if (!n.evidence?.length) throw new Error(`${name}: evidence is required — an insight shows the data it rests on and when it was taken`);
    for (const e of n.evidence) if (!e.kind || !e.at) throw new Error(`${name}: every evidence needs {kind, at} — kind of data and its acquisition time`);
  }
  // an insight level is a chip tone and a label; the card's outline and side bar are that tone's own colours (tokens.ts TONES)
  const levelOf = (chip: WfTone, label: string): {chip: WfTone; label: string; stroke: ColorKey; bar: ColorKey} => {
    const t = toneStyle(chip);
    return {chip, label, stroke: t.chipStroke ?? t.stroke ?? t.fill, bar: t.ink};
  };
  const LEVEL: Record<'danger' | 'warn' | 'info', {chip: WfTone; label: string; stroke: ColorKey; bar: ColorKey}> = {
    danger: levelOf('solid-danger', '要確認'),
    warn: levelOf('danger', '注意'),
    info: levelOf('muted', '参考'),
  };
  function insightData(n: WfInsight, w: number, ctx: WfCtx) {
    checkInsight(n);
    const inner = w - 28;
    const tl = wrapT(ctx, n.title, T, 700, inner);
    const bl = n.text ? wrapT(ctx, n.text, S, 400, inner) : [];
    // an evidence row is "kind  time" on one line; when that does not fit, the time goes on a second line
    const rows = n.evidence.map(e => ({e, stacked: 38 + tw(ctx, e.kind, S, 700) + 12 + tw(ctx, e.at, S, 400) > w - 12}));
    // chips: the level and "参考表示" share a row when they fit; in a narrow card the second one drops to its own row.
    // A stale badge sits on the top edge (down to y + 12), so the card's content starts 4px lower then.
    const lv = LEVEL[n.level ?? 'info'] ?? LEVEL.info, level = n.badge ?? lv.label;
    const stacked2 = n.reference !== false && 18 + chipW(ctx, level) + 8 + chipW(ctx, '参考表示') > w - 8;
    const top = n.state === 'stale' ? 4 : 0, chipExtra = stacked2 ? 28 : 0;
    const hgt = top + chipExtra + 12 + 24 + 6 + tl.length * lh(T) + (bl.length ? 4 + bl.length * lh(S) : 0) + 8 + rows.reduce((a, r) => a + (r.stacked ? 44 : 24), 0) + 12;
    return {tl, bl, rows, h: hgt, top, stacked2, chipExtra};
  }
  DRAW.insight = (n: WfInsight, x: number, y: number, w: number, _hh: number, ctx: WfCtx) => {
    const lv = LEVEL[n.level ?? 'info'] ?? LEVEL.info, d = insightData(n, w, ctx);
    rect(ctx, x, y, w, d.h, {r: 8, fill: 'bg', stroke: lv.stroke});
    rect(ctx, x + 1, y + 1, 6, d.h - 2, {fill: lv.bar});
    let cx = x + 18;
    const cy = y + 10 + d.top;
    part(ctx, n, 'level', x + 4, cy);
    cx += drawChip(ctx, n.badge ?? lv.label, cx, cy, lv.chip) + 8;
    if (n.reference !== false) { // an insight is a reference, not a judgement
      const ry = d.stacked2 ? cy + 28 : cy;
      if (d.stacked2) cx = x + 18;
      part(ctx, n, 'reference', cx + chipW(ctx, '参考表示') - 4, ry);
      drawChip(ctx, '参考表示', cx, ry, 'plain');
    }
    let ty = y + d.top + d.chipExtra + 12 + 24 + 6;
    part(ctx, n, 'title', x + 4, ty + 10);
    for (const l of d.tl) { text(ctx, l, x + 18, ty + T, {size: T, weight: 700}); ty += lh(T); }
    if (d.bl.length) { ty += 4; part(ctx, n, 'text', x + 4, ty + 10); for (const l of d.bl) { text(ctx, l, x + 18, ty + S, {fill: 'text'}); ty += lh(S); } }
    ty += 8;
    part(ctx, n, 'evidence', x + 4, ty + 11);
    for (const {e, stacked} of d.rows) {
      rect(ctx, x + 18, ty + 5, 12, 12, {r: 2, stroke: 'muted', sw: 2});
      text(ctx, e.kind, x + 38, mid(ty + 11), {weight: 700});
      if (stacked) { text(ctx, e.at, x + 38, mid(ty + 31), {fill: 'muted'}); ty += 44; }
      else { text(ctx, e.at, x + 38 + tw(ctx, e.kind, S, 700) + 12, mid(ty + 11), {fill: 'muted'}); ty += 24; }
    }
    return {w, h: d.h};
  };

  // ---- region: a named block (for the coarse, whole-screen wireframe) ----------------------------------
  DRAW.region = (n: WfRegion, x: number, y: number, w: number, hh: number, ctx: WfCtx) => {
    const primary = n.emphasis === 'primary';
    rect(ctx, x, y, w, hh, {r: 6, fill: primary ? 'soft' : 'code', stroke: primary ? 'accent' : 'border', sw: primary ? 2.5 : 2, dash: n.dashed ? '6,4' : undefined});
    const lines = wrapT(ctx, n.label, T, 700, w - 20), hint = n.hint ? wrapT(ctx, n.hint, S, 400, w - 20) : [];
    const total = lines.length * lh(T) + (hint.length ? 4 + hint.length * lh(S) : 0);
    let ty = y + Math.max(8, (hh - total) / 2);
    lines.forEach((l: string, k: number) => text(ctx, l, x + w / 2, ty + T + k * lh(T), {size: T, weight: 700, anchor: 'middle', fill: primary ? 'accent' : 'text'}));
    ty += lines.length * lh(T) + 4;
    hint.forEach((l: string, k: number) => text(ctx, l, x + w / 2, ty + S + k * lh(S), {anchor: 'middle', fill: 'muted'}));
    return {w, h: hh};
  };

  // ---- breadcrumb ---------------------------------------------------------------------------
  DRAW.breadcrumb = (n: WfBreadcrumb, x: number, y: number, _w: number, _hh: number, ctx: WfCtx) => {
    let cx = x;
    n.items.forEach((it, i) => {
      const last = i === n.items.length - 1, wt = last ? 700 : 400, iw = tw(ctx, it, S, wt);
      text(ctx, it, cx, mid(y + 14), {weight: wt, fill: last ? 'text' : 'accent'});
      if (!last) { line(ctx, cx, y + 23, cx + iw, y + 23, {stroke: 'accent', sw: 1.5}); }
      cx += iw;
      if (!last) { path(ctx, pts([[cx + 9, y + 8], [cx + 15, y + 14], [cx + 9, y + 20]]), {stroke: 'muted', sw: 2}); cx += 24; }
    });
    return {w: cx - x, h: 28};
  };

  // ---- scenes shared by fusion / compare ----------------------------------------------------------
  const KIND = (l: {label: string}) => /点群/.test(l.label) ? 'cloud' : /赤外|熱/.test(l.label) ? 'thermal' : 'camera';
  function sceneBox(x: number, y: number, w: number, hh: number) { return {bx: x + w * 0.36, by: y + hh * 0.3, bw: w * 0.26, bh: hh * 0.42}; }
  function drawCamera(ctx: WfCtx, x: number, y: number, w: number, hh: number) {
    const f = y + hh * 0.72;
    line(ctx, x + 8, f, x + w - 8, f, {stroke: 'muted', sw: 2});
    line(ctx, x + w * 0.2, y + 8, x + w * 0.2, f, {stroke: 'border', sw: 2});
    const b = sceneBox(x, y, w, hh);
    rect(ctx, b.bx, b.by, b.bw, b.bh, {r: 4, fill: 'bg', stroke: 'muted'});
    rect(ctx, b.bx + b.bw * 0.2, b.by + b.bh * 0.18, b.bw * 0.6, b.bh * 0.25, {stroke: 'border', sw: 1.5});
  }
  function drawCloud(ctx: WfCtx, x: number, y: number, w: number, hh: number, seed = 3) {
    let a = seed * 9301 + 49297;
    const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
    const b = sceneBox(x, y, w, hh);
    for (let i = 0; i < 90; i++) {
      const onBox = i % 3 !== 0;
      const px = onBox ? b.bx + rnd() * b.bw : x + 12 + rnd() * (w - 24), py = onBox ? b.by + rnd() * b.bh : y + hh * 0.72 + (rnd() - 0.5) * hh * 0.05;
      rect(ctx, px, py, 4, 4, {fill: 'accent', op: 0.35 + rnd() * 0.5});
    }
  }
  function drawThermal(ctx: WfCtx, x: number, y: number, w: number, hh: number, label?: string) {
    const b = sceneBox(x, y, w, hh), hx = b.bx + b.bw * 0.55, hy = b.by + b.bh * 0.28;
    [[0.34, 0.12], [0.22, 0.25], [0.11, 0.5]].forEach(([r, op]) => circle(ctx, hx, hy, Math.min(w, hh) * r * 0.55, {fill: 'danger', op}));
    line(ctx, hx - 12, hy, hx + 12, hy, {stroke: 'text', sw: 2}); line(ctx, hx, hy - 12, hx, hy + 12, {stroke: 'text', sw: 2});
    if (label) {
      const lw = tw(ctx, label, S, 700) + 12;
      rect(ctx, hx + 16, hy - 34, lw, 22, {r: 4, fill: 'bg', stroke: 'danger'});
      text(ctx, label, hx + 16 + lw / 2, mid(hy - 23), {weight: 700, fill: 'danger', anchor: 'middle'});
    }
  }

  // ---- fusion: camera + point cloud + thermal in one frame, with layer controls -------------------------
  DRAW.fusion = (n: WfFusion, x: number, y: number, w: number, hh: number, ctx: WfCtx) => {
    const layers: FusionLayer[] = (n.layers ?? ['カメラ', '点群', '赤外線']).map((l): WfFusionLayerSpec => typeof l === 'string' ? {label: l} : l).map(l => ({...l, kind: l.kind ?? KIND(l), bad: l.state, on: !l.state && l.on !== false}));
    const lname = (l: FusionLayer) => l.bad ? `${l.label}（${STATES[l.bad]?.title ?? l.bad}）` : l.label;
    // controls: the layer toggles wrap onto as many rows as the width needs; the opacity slider gets its own row
    const rows: {l: FusionLayer; lw: number}[][] = [[]];
    let used = 0;
    for (const l of layers) {
      const lw = 44 + tw(ctx, lname(l), S, 400);
      if (rows.at(-1)!.length && used + lw > w - 16) { rows.push([]); used = 0; }
      rows.at(-1)!.push({l, lw}); used += lw + 16;
    }
    const withSlider = n.controls !== false && n.opacity !== false;
    const strip = n.controls === false ? 0 : 8 + rows.length * 28 + (withSlider ? 30 : 0) + 6, vh = Math.max(60, hh - strip);
    rect(ctx, x, y, w, vh, {r: 6, fill: 'code', stroke: 'border'});
    for (const k of ['camera', 'cloud', 'thermal']) {
      if (!layers.some(l => l.kind === k && l.on)) continue;
      if (k === 'camera') drawCamera(ctx, x, y, w, vh); else if (k === 'cloud') drawCloud(ctx, x, y, w, vh); else drawThermal(ctx, x, y, w, vh, n.hot);
    }
    let cx = x + 8;
    part(ctx, n, 'layers', x + 8, y + 8);
    for (const l of layers.filter(l => l.on || l.bad)) cx += drawChip(ctx, l.bad ? lname(l) : l.label, cx, y + 8, l.bad ? 'muted' : l.kind === 'thermal' ? 'danger' : l.kind === 'cloud' ? 'accent' : 'plain') + 6;
    if (n.stamp) { const sw = tw(ctx, n.stamp, S, 400) + 12; rect(ctx, x + w - 8 - sw, y + vh - 30, sw, 22, {r: 4, fill: 'bg', op: 0.92}); text(ctx, n.stamp, x + w - 14, mid(y + vh - 19), {fill: 'muted', anchor: 'end'}); }
    if (strip) {
      let ty = y + vh + 8;
      part(ctx, n, 'controls', x + 6, ty + 14);
      for (const row of rows) { let tx = x + 8; for (const {l, lw} of row) { drawToggleAt(ctx, tx, ty, l.on, lname(l), {disabled: !!l.bad}); tx += lw + 16; } ty += 28; }
      if (withSlider) {
        const op = (n.opacity ?? 0.6) as number, lab = `重ねる濃さ ${pct(op)}`, lw = tw(ctx, lab, S, 400) + 8;
        part(ctx, n, 'opacity', x + 6, ty + 14);
        text(ctx, lab, x + 8, mid(ty + 14), {fill: 'muted'});
        drawSliderAt(ctx, x + 8 + lw, ty, w - 16 - lw, op);
      }
    }
    return {w, h: hh};
  };

  // ---- compare: split view with a divider, labels and diff boxes ---------------------------------------
  DRAW.compare = (n: WfCompare, x: number, y: number, w: number, hh: number, ctx: WfCtx) => {
    const at = n.at ?? 0.5, sx = x + w * at;
    rect(ctx, x, y, w, hh, {r: 6, fill: 'code', stroke: 'border'});
    rect(ctx, x + 1, y + 1, sx - x - 1, hh - 2, {fill: 'bg', op: 0.55});
    drawCamera(ctx, x, y, w, hh);
    if (n.kind === 'map') { for (let k = 1; k < 4; k++) line(ctx, x + w * k / 4, y + 8, x + w * k / 4, y + hh - 8, {stroke: 'border', sw: 1.5}); }
    for (const d of n.diff ?? []) rect(ctx, x + w * d.x, y + hh * d.y, w * d.w, hh * d.h, {r: 4, stroke: 'danger', sw: 2.5, dash: '6,4'});
    if (n.diff?.length) part(ctx, n, 'diff', x + w * n.diff[0].x, y + hh * n.diff[0].y);
    line(ctx, sx, y, sx, y + hh, {stroke: 'text', sw: 3});
    circle(ctx, sx, y + hh / 2, 14, {fill: 'bg', stroke: 'text', sw: 2.5});
    path(ctx, pts([[sx - 3, y + hh / 2 - 6], [sx - 9, y + hh / 2], [sx - 3, y + hh / 2 + 6]]), {stroke: 'text', sw: 2});
    path(ctx, pts([[sx + 3, y + hh / 2 - 6], [sx + 9, y + hh / 2], [sx + 3, y + hh / 2 + 6]]), {stroke: 'text', sw: 2});
    part(ctx, n, 'labels', x + 8, y + 8); part(ctx, n, 'divider', sx, y + 10);
    if (n.left) drawChip(ctx, n.left, x + 8, y + 8, 'plain');
    if (n.right) { const cw = chipW(ctx, n.right); drawChip(ctx, n.right, x + w - 8 - cw, y + 8, 'accent'); }
    if (n.sync) {
      const lab = typeof n.sync === 'string' ? n.sync : '再生位置を同期', lw = tw(ctx, lab, S, 700) + 20;
      part(ctx, n, 'sync', sx - lw / 2, y + hh - 22);
      rect(ctx, sx - lw / 2, y + hh - 34, lw, 24, {r: 12, fill: 'bg', stroke: 'muted'});
      text(ctx, lab, sx, mid(y + hh - 22), {weight: 700, anchor: 'middle'});
    }
    return {w, h: hh};
  };

  // Every string a part may draw that is NOT literally in the node tree (defaults, formatted numbers),
  // so that wireframe.ts measures it before layout.
  const ALWAYS: string[] = [...Object.values(STATES).map(x => x.title), ...Object.values(LEVEL).map(x => x.label), '参考表示', '再生位置を同期', '途絶', '弱い', 'やや弱い', '良好', ' 低下', '最終受信 —', 'カメラ', '点群', '赤外線'];
  function strings(n: WfNode) {
    const out: string[] = [];
    if (n.t === 'battery') out.push(batteryText(n));
    if (n.t === 'signal') out.push(signalText(n));
    if (n.t === 'robot') out.push(batteryText({level: n.battery ?? 0}), signalText({level: n.link ?? 3}), n.last ? `最終受信 ${n.last}` : '最終受信 —');
    if (n.t === 'fusion') { out.push(`重ねる濃さ ${pct((n.opacity ?? 0.6) as number)}`); for (const l of n.layers ?? []) if (typeof l !== 'string' && l.state) out.push(`${l.label}（${STATES[l.state]?.title ?? l.state}）`); }
    if (n.t === 'compare' && typeof n.sync === 'string') out.push(n.sync);
    return out;
  }
  return {drawState, stateMinH, glyph, fovSector, headingArrow, strings, always: ALWAYS};
}
