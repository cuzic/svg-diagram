import {textWidth} from './atoms.ts';
import type {FontFamily, LaidOutTimeline, NumericTimelineBand, Roles, TimelineBand, TimelineTone, WidthOf} from './types.ts';

import {must} from './must.ts';
const FLAG_GAP = 6, STEM_MIN = 16, DOT = 8, TICK = 6, MAX_LEVELS = 5, MS_DAY = 86400000;
const TONE_COLOR: Record<TimelineTone, 'accent' | 'danger' | 'muted'> = {accent: 'accent', danger: 'danger', muted: 'muted'};

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> days since the epoch (UTC; a year or month means its first day). Never reads the clock. */
export function timelineDay(at: string, what: string): number {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(at));
  if (!m) throw new Error(`timeline(): ${what} must be 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (got ${JSON.stringify(at)})`);
  const y = +must(m[1]), mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1, t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new Error(`timeline(): ${what} is not a real date (${at})`);
  return t / MS_DAY;
}

/** "あと 1 年 3 か月" / "あと 45 日"; past the deadline: "期限を 2 か月 過ぎた". Whole months by calendar, days only under a month. */
export function remainingText(from: string, to: string): string {
  const a = timelineDay(from, 'now.at'), b = timelineDay(to, 'deadline.at');
  if (a === b) return '期限は今日';
  const [lo, hi] = a < b ? [a, b] : [b, a];
  const l = new Date(lo * MS_DAY), h = new Date(hi * MS_DAY);
  let months = (h.getUTCFullYear() - l.getUTCFullYear()) * 12 + h.getUTCMonth() - l.getUTCMonth();
  if (h.getUTCDate() < l.getUTCDate()) months--;
  const span = months < 1 ? `${hi - lo} 日` : months < 12 ? `${months} か月` : `${Math.floor(months / 12)} 年${months % 12 ? ` ${months % 12} か月` : ''}`;
  return a < b ? `あと ${span}` : `期限を ${span} 過ぎた`;
}

interface Flag {label: string; at: string; tone: TimelineTone; bold: boolean; x: number; w: number; left: number; level: number; big: boolean}

/** The flags in drawing order: now, the deadline, the marks. Flags on the same day are one flag (one stem): labels joined with '・', the deadline's look wins. */
const flagsOf = (band: TimelineBand): Omit<Flag, 'x' | 'w' | 'left' | 'level'>[] => {
  const all: Omit<Flag, 'x' | 'w' | 'left' | 'level'>[] = [
    {label: band.now.label ?? '現在', at: band.now.at, tone: 'accent', bold: true, big: false},
    {label: band.deadline.label, at: band.deadline.at, tone: 'danger', bold: true, big: true},
    ...(band.marks ?? []).map(m => ({label: m.label, at: m.at, tone: m.tone ?? 'muted', bold: false, big: false})),
  ];
  const out: typeof all = [];
  for (const f of all) {
    const same = out.find(o => timelineDay(o.at, 'at') === timelineDay(f.at, 'at'));
    if (!same) { out.push({...f}); continue; }
    same.label += `・${f.label}`;
    if (f.big) { same.big = true; same.tone = 'danger'; } else if (!same.big && f.tone === 'danger') same.tone = 'danger';
    same.bold = same.bold || f.bold;
  }
  return out;
};

/** Ticks on the axis: a step of whole months (1, 3, 6, 12, 24, 60) that leaves at most ~8 of them; each tick is a month that is a multiple of the step. */
export function ticksOf(from: number, to: number): {day: number; label: string}[] {
  const a = new Date(from * MS_DAY), months = Math.max(1, (to - from) / 30.4375);
  const step = [1, 3, 6, 12, 24, 60, 120].find(s => months / s <= 8) ?? 120;
  const out: {day: number; label: string}[] = [];
  let y = a.getUTCFullYear(), m = a.getUTCMonth();
  for (let i = 0; i < 2000; i++) {
    const day = Date.UTC(y, m, 1) / MS_DAY;
    if (day > to) break;
    const idx = step >= 12 ? y : y * 12 + m;
    if (day >= from && (step >= 12 ? m === 0 && y % (step / 12) === 0 : idx % step === 0)) out.push({day, label: m === 0 ? `${y}` : `${y}/${m + 1}`});
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

/** Every string a timeline draws, registered before its geometry is calculated. */
export function timelineTexts(band: TimelineBand | NumericTimelineBand, roles: Roles): [string, number, number, FontFamily][] {
  if ('unit' in band) return numericTexts(band, roles);
  const S = roles.note, out: [string, number, number, FontFamily][] = [];
  for (const f of flagsOf(band)) out.push([f.label, S, 700, 'sans'], [f.at, S, 400, 'sans']);
  const from = timelineDay(band.from, 'from'), to = timelineDay(band.to, 'to');
  for (const t of ticksOf(from, to)) out.push([t.label, S, 400, 'sans']);
  const r = remainingLabel(band);
  if (r) out.push([r, S, 700, 'sans']);
  return out;
}
const remainingLabel = (band: TimelineBand): string => band.remaining === false ? '' : band.remaining ?? remainingText(band.now.at, band.deadline.at);

export function layoutTimeline(band: TimelineBand | NumericTimelineBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutTimeline {
  if ('unit' in band) return layoutNumeric(band, x, y, w, widthOf, roles);
  const S = roles.note, LH = Math.round(S * 20 / 14), FLAG_H = 2 * LH;
  const from = timelineDay(band.from, 'from'), to = timelineDay(band.to, 'to');
  const plotL = x + 12, plotR = x + w - 12;
  if (plotR - plotL < 200) throw new Error('timeline(): the figure is too narrow (200px of axis at least)');
  const px = (at: string, what: string): number => {
    const day = timelineDay(at, what);
    if (day < from || day > to) throw new Error(`timeline(): ${what} (${at}) is outside the axis (${band.from} - ${band.to})`);
    return plotL + (day - from) / (to - from) * (plotR - plotL);
  };
  const full = band.deadline.line === 'full', dlAt = px(band.deadline.at, 'deadline.at');
  const flags: Flag[] = flagsOf(band).map(f => {
    const fx = px(f.at, 'at');
    const fw = Math.max(textWidth(widthOf, f.label, S, 700), textWidth(widthOf, f.at, S, 400)) + 8;
    return {...f, x: fx, w: fw, left: Math.min(Math.max(fx - fw / 2, x), x + w - fw), level: -1};
  });
  // Right to left, each flag takes the first of: starting at its stem, centred on it, ending at it — at the lowest level that works for it where its box meets
  // no other box and no stem crosses a box (a flag's stem rises from the axis to its box). Starting at the stem makes a staircase of close flags.
  const hits = (a: Flag, b: Flag): boolean => !(a.left + a.w + 6 <= b.left || b.left + b.w + 6 <= a.left);
  const inside = (f: Flag, at: number): boolean => at >= f.left - 4 && at <= f.left + f.w + 4;
  const clampLeft = (f: Flag, left: number): number => Math.min(Math.max(left, x), x + w - f.w);
  for (const f of [...flags].sort((p, q) => q.x - p.x)) {
    const isDl = full && f.big;
    // with a full deadline line no box may sit on it: the deadline's own label starts just right of it (or ends just left of it)
    let lefts = isDl ? [clampLeft(f, f.x + 6), clampLeft(f, f.x - f.w - 6)] : [clampLeft(f, f.x - 4), f.left, clampLeft(f, f.x - f.w + 4)];
    if (full) lefts = lefts.filter(l => isDl ? l + f.w <= f.x - 2 || l >= f.x + 2 : !(dlAt >= l - 4 && dlAt <= l + f.w + 4));
    for (const left of lefts) {
      for (let k = 0; k < MAX_LEVELS && f.level < 0; k++) {
        f.left = left;
        if (flags.every(o => o === f || o.level < 0 || (o.level === k ? !hits(f, o) : o.level < k ? !inside(o, f.x) : !inside(f, o.x)))) f.level = k;
      }
    }
    if (f.level < 0) throw new Error(`timeline(): the labels near "${f.label}" do not fit above the axis; shorten them, drop a mark, or widen the figure`);
  }
  const levels = Math.max(...flags.map(f => f.level)) + 1;
  const fillSpan = band.span === 'fill', tickDrop = fillSpan ? 4 : 0;
  const axisY = y + levels * (FLAG_H + FLAG_GAP) + STEM_MIN - FLAG_GAP;
  const out: LaidOutTimeline = {
    type: 'timeline', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: 0,
    axis: {x1: plotL, x2: plotR, y: axisY}, ticks: [], stems: [], dots: [], texts: [], labelBoxes: [],
  };
  const text = (s: string, tx: number, ty: number, anchor: 'start' | 'middle' | 'end', fill: 'text' | 'muted' | 'accent' | 'danger', bold: boolean, w2?: number) => {
    out.texts.push({text: s, x: tx, y: ty, anchor, fill, bold, size: S});
    const tw = w2 ?? textWidth(widthOf, s, S, bold ? 700 : 400);
    out.labelBoxes.push({label: s, x: anchor === 'middle' ? tx - tw / 2 : anchor === 'end' ? tx - tw : tx, y: ty - S, w: tw, h: S + 4});
  };
  for (const f of flags) {
    const boxBottom = axisY - STEM_MIN - f.level * (FLAG_H + FLAG_GAP), boxTop = boxBottom - FLAG_H, cx = f.left + f.w / 2;
    out.stems.push({x: f.x, y1: boxBottom, y2: axisY, tone: TONE_COLOR[f.tone]});
    out.dots.push({x: f.x, y: axisY, r: f.big ? DOT + 4 : DOT, tone: TONE_COLOR[f.tone]});
    text(f.label, cx, boxTop + S + 1, 'middle', f.tone === 'muted' ? 'text' : f.tone, true);
    text(f.at, cx, boxTop + LH + S + 1, 'middle', 'muted', false);
  }
  const nowX = px(band.now.at, 'now.at'), dlX = px(band.deadline.at, 'deadline.at');
  out.span = {x1: Math.min(nowX, dlX), x2: Math.max(nowX, dlX), y: axisY, tone: nowX <= dlX ? 'accent' : 'danger', ...(fillSpan ? {fill: true} : {})};
  // tick labels: centred on their tick, kept inside the figure; a label the deadline line would cross moves to the line's side its tick is on
  // (and is left out, tick kept, if that lands on another label)
  const ty = axisY + TICK + S + 2 + tickDrop;
  const crosses = (left: number, tw: number): boolean => full && dlX >= left - 3 && dlX <= left + tw + 3;
  const placed: {label: string; left: number; tw: number; moved: boolean}[] = [];
  for (const t of ticksOf(from, to)) {
    const tx = plotL + (t.day - from) / (to - from) * (plotR - plotL);
    out.ticks.push({x: tx, y1: axisY, y2: axisY + TICK});
    const tw = textWidth(widthOf, t.label, S, 400);
    let left = Math.min(Math.max(tx - tw / 2, x), x + w - tw), moved = false;
    if (crosses(left, tw)) { left = tx >= dlX ? dlX + 6 : dlX - 6 - tw; moved = true; }
    placed.push({label: t.label, left, tw, moved});
  }
  const clash = (a: {left: number; tw: number}, b: {left: number; tw: number}): boolean => a.left < b.left + b.tw + 6 && b.left < a.left + a.tw + 6;
  for (const p of placed) {
    if (p.moved && (p.left < x || p.left + p.tw > x + w || placed.some(o => o !== p && clash(p, o)))) continue;
    text(p.label, p.left, ty, 'start', 'muted', false, p.tw);
  }
  let bottom = axisY + TICK + S + 2 + 4 + tickDrop;
  const rem = remainingLabel(band);
  if (rem) {
    const by = bottom + 8;
    if (out.span.x2 > out.span.x1) out.bracket = {x1: out.span.x1, x2: out.span.x2, y: by, tone: out.span.tone};
    const rw = textWidth(widthOf, rem, S, 700);
    let rl = Math.min(Math.max((out.span.x1 + out.span.x2) / 2 - rw / 2, x), x + w - rw);
    if (crosses(rl, rw)) rl = out.span.x2 === dlX ? dlX - 6 - rw : dlX + 6; // wider than its span: it keeps to the span's side of the line
    text(rem, rl, by + 6 + S, 'start', out.span.tone, true, rw);
    bottom = by + 6 + S + 4;
  }
  out.h = bottom - y;
  if (full) out.fullLine = {x: dlX, y1: y, y2: y + out.h};
  return out;
}

// ---- numeric axis: timeline({unit: 'ms', from: 0, to: 700, lanes, events, spans}) ----------------------------------------------------

const fmt = (v: number): string => String(+v.toFixed(6));
/** Tick values: `step` (or 1, 2, 5 x a power of ten with at most `max` ticks) from the first multiple of it at or after `from`. */
export function numericTicks(from: number, to: number, step: number | undefined, max: number): number[] {
  let st = step;
  if (st === undefined) {
    const raw = (to - from) / Math.max(1, max), pow = 10 ** Math.floor(Math.log10(raw));
    st = [1, 2, 5, 10].map(m => m * pow).find(c => c >= raw - 1e-12) ?? raw;
  }
  const out: number[] = [];
  for (let k = Math.ceil(from / st - 1e-9); k * st <= to + 1e-9 && out.length < 200; k++) out.push(+(k * st).toFixed(9));
  return out;
}
const spanLabel = (sp: {from: number; to: number; label?: string; dim?: boolean}, unit: string): string | undefined => sp.label ?? (sp.dim ? `${fmt(sp.to - sp.from)}${unit}` : undefined);

function numericTexts(band: NumericTimelineBand, roles: Roles): [string, number, number, FontFamily][] {
  const S = roles.note, out: [string, number, number, FontFamily][] = [];
  for (const e of band.events ?? []) out.push([e.label, S, 700, 'sans'], [`${fmt(e.at)}${band.unit}`, S, 400, 'sans']);
  for (const sp of band.spans ?? []) { const l = spanLabel(sp, band.unit); if (l) out.push([l, S, sp.dim ? 700 : 400, 'sans']); }
  for (const l of band.lanes ?? []) out.push([l, S, 700, 'sans']);
  for (const t of numericTicks(band.from, band.to, band.step, 40)) out.push([`${fmt(t)}${band.unit}`, S, 400, 'sans']);
  return out;
}

function layoutNumeric(band: NumericTimelineBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutTimeline {
  const S = roles.note, LH = Math.round(S * 20 / 14), FLAG_H = 2 * LH, ROW_PAD = 8, BAR_H = 24, BAR_ROW = BAR_H + 8, DIM_ROW = LH + 10;
  const unit = band.unit, lanes: (string | undefined)[] = band.lanes?.length ? band.lanes : [undefined];
  const laneW = band.lanes?.length ? Math.max(...band.lanes.map(l => textWidth(widthOf, l, S, 700))) + 12 : 0;
  const plotL = x + 12 + laneW, plotR = x + w - 12;
  if (plotR - plotL < 200) throw new Error('timeline(): the figure is too narrow (200px of axis at least)');
  const px = (v: number): number => plotL + (v - band.from) / (band.to - band.from) * (plotR - plotL);
  const tw = (s: string, bold = false): number => textWidth(widthOf, s, S, bold ? 700 : 400);
  const out: LaidOutTimeline = {
    type: 'timeline', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: 0,
    axis: {x1: plotL, x2: plotR, y: 0}, ticks: [], stems: [], dots: [], texts: [], labelBoxes: [], guides: [], bars: [], dims: [],
  };
  const text = (s: string, tx: number, ty: number, anchor: 'start' | 'middle' | 'end', fill: 'text' | 'muted' | 'accent' | 'danger', bold: boolean): void => {
    out.texts.push({text: s, x: tx, y: ty, anchor, fill, bold, size: S});
    const t = tw(s, bold);
    out.labelBoxes.push({label: s, x: anchor === 'middle' ? tx - t / 2 : anchor === 'end' ? tx - t : tx, y: ty - S, w: t, h: S + 4});
  };
  const laneOf = (l: string | undefined): number => l === undefined ? 0 : lanes.indexOf(l);
  let cursor = y;
  lanes.forEach((name, li) => {
    const top = cursor;
    // events: flags above the lane's dot line, at the lowest level where neither boxes nor stems collide
    const flags = (band.events ?? []).filter(e => laneOf(e.lane) === li).map(e => {
      const v = `${fmt(e.at)}${unit}`, fw = Math.max(tw(e.label, true), tw(v)) + 8, fx = px(e.at);
      return {e, v, fw, fx, left: Math.min(Math.max(fx - fw / 2, plotL), x + w - fw), level: -1};
    });
    type F = (typeof flags)[number];
    const hits = (a: F, b: F): boolean => !(a.left + a.fw + 6 <= b.left || b.left + b.fw + 6 <= a.left);
    const inside = (f: F, at: number): boolean => at >= f.left - 4 && at <= f.left + f.fw + 4;
    // right to left, each flag tries starting at its stem, centred on it, ending at it (a staircase of close flags), at the lowest level that works
    const clampLeft = (f: F, left: number): number => Math.min(Math.max(left, plotL), x + w - f.fw);
    for (const f of [...flags].sort((p, q) => q.fx - p.fx)) {
      for (const left of [clampLeft(f, f.fx - 4), f.left, clampLeft(f, f.fx - f.fw + 4)]) {
        for (let k = 0; k < MAX_LEVELS && f.level < 0; k++) {
          f.left = left;
          if (flags.every(o => o === f || o.level < 0 || (o.level === k ? !hits(f, o) : o.level < k ? !inside(o, f.fx) : !inside(f, o.fx)))) f.level = k;
        }
      }
      if (f.level < 0) throw new Error(`timeline(): the event labels near "${f.e.label}" do not fit above the lane; shorten them, spread the events over lanes, or widen the figure`);
    }
    const levels = flags.length ? Math.max(...flags.map(f => f.level)) + 1 : 0;
    const dotY = top + ROW_PAD + (levels ? levels * (FLAG_H + FLAG_GAP) + STEM_MIN - FLAG_GAP : 6);
    if (flags.length) must(out.guides).push({x1: plotL, x2: plotR, y: dotY});
    for (const f of flags) {
      const boxBottom = dotY - STEM_MIN - f.level * (FLAG_H + FLAG_GAP), boxTop = boxBottom - FLAG_H, cx = f.left + f.fw / 2, tone = f.e.tone ?? 'muted';
      out.stems.push({x: f.fx, y1: boxBottom, y2: dotY, tone: TONE_COLOR[tone]});
      out.dots.push({x: f.fx, y: dotY, r: DOT, tone: TONE_COLOR[tone]});
      text(f.e.label, cx, boxTop + S + 1, 'middle', tone === 'muted' ? 'text' : tone, true);
      text(f.v, cx, boxTop + LH + S + 1, 'middle', 'muted', false);
    }
    // spans: rows under the dot line; a span's row holds its bar and its label (inside the bar when it fits, else beside it)
    type Item = {sp: NonNullable<NumericTimelineBand['spans']>[number]; x1: number; x2: number; label?: string; lx: number; lw: number; inBar: boolean; lo: number; hi: number};
    const items: Item[] = (band.spans ?? []).filter(sp => laneOf(sp.lane) === li).sort((a, b) => a.from - b.from).map(sp => {
      const x1 = px(sp.from), x2 = px(sp.to), label = spanLabel(sp, unit), lw = label ? tw(label, !!sp.dim) : 0;
      let lx = (x1 + x2) / 2 - lw / 2, inBar = false;
      if (label && !sp.dim) {
        if (lw + 8 <= x2 - x1) { inBar = true; lx = (x1 + x2) / 2 - lw / 2; }
        else if (x2 + 6 + lw <= x + w) lx = x2 + 6;
        else if (x1 - 6 - lw >= plotL) lx = x1 - 6 - lw;
        else throw new Error(`timeline(): the label "${label}" of a span does not fit beside its bar; shorten it or widen the figure`);
      } else if (label) lx = Math.min(Math.max(lx, plotL), x + w - lw);
      return {sp, x1, x2, label, lx, lw, inBar, lo: label ? Math.min(x1, lx) : x1, hi: label ? Math.max(x2, lx + lw) : x2};
    });
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows.find(r => r.every(o => o.hi + 6 <= it.lo || it.hi + 6 <= o.lo));
      if (row) row.push(it); else rows.push([it]);
    }
    let rowTop = dotY + (flags.length ? 14 : 4);
    for (const row of rows) {
      const dim = row.some(i => i.sp.dim), rh = dim ? Math.max(DIM_ROW, row.some(i => !i.sp.dim) ? BAR_ROW : 0) : BAR_ROW;
      for (const it of row) {
        const tone = it.sp.tone ?? 'accent';
        if (it.sp.dim) {
          const ly = rowTop + DIM_ROW - 2;
          must(out.dims).push({x1: it.x1, x2: it.x2, y: ly, tone: TONE_COLOR[tone]});
          if (it.label) text(it.label, it.lx, ly - 6, 'start', tone === 'muted' ? 'text' : tone, true);
        } else {
          must(out.bars).push({x: it.x1, y: rowTop + 4, w: it.x2 - it.x1, h: BAR_H, tone: TONE_COLOR[tone]});
          if (it.label) text(it.label, it.lx, rowTop + 4 + (BAR_H + S) / 2 - 2, 'start', 'text', false);
        }
      }
      rowTop += rh;
    }
    cursor = Math.max(rowTop, dotY + 6) + ROW_PAD;
    if (name !== undefined) text(name, x + 12, (top + cursor) / 2 + S / 2 - 2, 'start', 'muted', true);
    if (li < lanes.length - 1) must(out.guides).push({x1: x, x2: x + w, y: cursor});
  });
  const axisY = cursor + 4;
  out.axis.y = axisY;
  const maxTick = Math.max(2, Math.min(8, Math.floor((plotR - plotL) / (tw(`${fmt(band.to)}${unit}`) + 24))));
  for (const t of numericTicks(band.from, band.to, band.step, band.step === undefined ? maxTick : 40)) {
    const label = `${fmt(t)}${unit}`, lw = tw(label), tx = px(t);
    out.ticks.push({x: tx, y1: axisY, y2: axisY + TICK});
    text(label, Math.min(Math.max(tx - lw / 2, x), x + w - lw), axisY + TICK + S + 2, 'start', 'muted', false);
  }
  out.h = axisY + TICK + S + 2 + 4 - y;
  return out;
}
