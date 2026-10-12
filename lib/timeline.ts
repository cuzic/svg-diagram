import {textWidth} from './measure.ts';
import type {FontFamily, LaidOutTimeline, TimelineBand, TimelineTone, WidthOf} from './types.ts';

const S = 14, LH = 20, FLAG_H = 2 * LH, FLAG_GAP = 6, STEM_MIN = 16, DOT = 8, TICK = 6, MAX_LEVELS = 5, MS_DAY = 86400000;
const TONE_COLOR: Record<TimelineTone, 'accent' | 'danger' | 'muted'> = {accent: 'accent', danger: 'danger', muted: 'muted'};

/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> days since the epoch (UTC; a year or month means its first day). Never reads the clock. */
export function timelineDay(at: string, what: string): number {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(at));
  if (!m) throw new Error(`timeline(): ${what} must be 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (got ${JSON.stringify(at)})`);
  const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1, t = Date.UTC(y, mo - 1, d);
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

const flagsOf = (band: TimelineBand): Omit<Flag, 'x' | 'w' | 'left' | 'level'>[] => [
  {label: band.now.label ?? '現在', at: band.now.at, tone: 'accent', bold: true, big: false},
  {label: band.deadline.label, at: band.deadline.at, tone: 'danger', bold: true, big: true},
  ...(band.marks ?? []).map(m => ({label: m.label, at: m.at, tone: m.tone ?? 'muted', bold: false, big: false})),
];

/** Ticks on the axis: a step of whole months (1, 3, 6, 12, 24, 60) that leaves at most ~8 of them; each tick is a month that is a multiple of the step. */
function ticksOf(from: number, to: number): {day: number; label: string}[] {
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
export function timelineTexts(band: TimelineBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const f of flagsOf(band)) out.push([f.label, S, 700, 'sans'], [f.at, S, 400, 'sans']);
  const from = timelineDay(band.from, 'from'), to = timelineDay(band.to, 'to');
  for (const t of ticksOf(from, to)) out.push([t.label, S, 400, 'sans']);
  const r = remainingLabel(band);
  if (r) out.push([r, S, 700, 'sans']);
  return out;
}
const remainingLabel = (band: TimelineBand): string => band.remaining === false ? '' : band.remaining ?? remainingText(band.now.at, band.deadline.at);

export function layoutTimeline(band: TimelineBand, x: number, y: number, w: number, widthOf: WidthOf): LaidOutTimeline {
  const from = timelineDay(band.from, 'from'), to = timelineDay(band.to, 'to');
  const plotL = x + 12, plotR = x + w - 12;
  if (plotR - plotL < 200) throw new Error('timeline(): the figure is too narrow (200px of axis at least)');
  const px = (at: string, what: string): number => {
    const day = timelineDay(at, what);
    if (day < from || day > to) throw new Error(`timeline(): ${what} (${at}) is outside the axis (${band.from} - ${band.to})`);
    return plotL + (day - from) / (to - from) * (plotR - plotL);
  };
  const full = band.deadline.line === 'full', dlAt = px(band.deadline.at, 'deadline.at');
  const flags: Flag[] = flagsOf(band).map((f, i) => {
    const fx = px(f.at, i === 0 ? 'now.at' : i === 1 ? 'deadline.at' : `marks[${i - 2}].at`);
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
    type: 'timeline', id: band.id, reveal: band.reveal, x, y, w, h: 0,
    axis: {x1: plotL, x2: plotR, y: axisY}, ticks: [], stems: [], dots: [], texts: [], labelBoxes: [],
  };
  const text = (s: string, tx: number, ty: number, anchor: 'start' | 'middle' | 'end', fill: 'text' | 'muted' | 'accent' | 'danger', bold: boolean, w2?: number) => {
    out.texts.push({text: s, x: tx, y: ty, anchor, fill, bold});
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
    out.bracket = {x1: out.span.x1, x2: out.span.x2, y: by, tone: out.span.tone};
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
