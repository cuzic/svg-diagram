import {splitAtoms} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import type {Anchor, BoxTone, Dimmed, FontFamily, Rect, RevealOpts, Roles, TextTone, WidthOf} from './types.ts';

export interface FlowStep {label: string; sub?: string; id?: string; tone?: BoxTone}
export interface ChevronOpts extends RevealOpts {id?: string; direction?: 'horizontal' | 'vertical'; first?: 'pentagon' | 'chevron'; gap?: number; current?: number; highlight?: number; width?: number}
export interface FunnelStage {label: string; value?: number; id?: string; tone?: BoxTone}
export interface FunnelOpts extends RevealOpts {id?: string; scale?: 'value' | 'even'; showRate?: boolean; width?: number}
export interface CycleOpts extends RevealOpts {id?: string; centre?: string; direction?: 'cw' | 'ccw'; width?: number}
export interface VennSet {name: string; label?: string; id?: string; tone?: TextTone}
export interface VennOverlap {sets: readonly string[]; label: string}
export interface VennOpts extends RevealOpts {id?: string; overlaps?: readonly VennOverlap[]; centre?: string; universe?: string | boolean; width?: number}
export interface ConcentricRing {label: string; description?: string; id?: string; tone?: TextTone}
export interface ConcentricOpts extends RevealOpts {id?: string; order?: 'outer-first' | 'inner-first'; labels?: 'inside' | 'side'; centre?: string; width?: number}

export interface ChevronBand extends ChevronOpts {type: 'chevron'; steps: FlowStep[]; direction: 'horizontal' | 'vertical'; first: 'pentagon' | 'chevron'; gap: number}
export interface FunnelBand extends FunnelOpts {type: 'funnel'; stages: FunnelStage[]; scale: 'value' | 'even'; showRate: boolean}
export interface CycleBand extends CycleOpts {type: 'cycle'; steps: FlowStep[]; direction: 'cw' | 'ccw'}
export interface VennBand extends VennOpts {type: 'venn'; sets: VennSet[]; overlaps: VennOverlap[]}
export interface ConcentricBand extends ConcentricOpts {type: 'concentric'; rings: ConcentricRing[]; order: 'outer-first' | 'inner-first'; labels: 'inside' | 'side'}
export type FlowShapeBand = ChevronBand | FunnelBand | CycleBand | VennBand | ConcentricBand;

export interface FlowText extends Rect {text: string; tx: number; ty: number; size: number; weight: 400 | 700; anchor: 'start' | 'middle' | 'end'; tone: TextTone}
export type FlowPrimitive =
  | ({k: 'polygon'; points: [number, number][]; tone: BoxTone; dashed?: boolean} & Dimmed)
  | ({k: 'circle'; cx: number; cy: number; r: number; tone: TextTone; opacity?: number; dashed?: boolean} & Dimmed)
  | ({k: 'rect'; x: number; y: number; w: number; h: number; tone: TextTone; label?: string} & Dimmed)
  | ({k: 'path'; d: string; tone: TextTone; arrow?: boolean} & Dimmed);
export interface LaidOutFlowShape extends Rect, Dimmed {type: FlowShapeBand['type']; id?: string; reveal?: number; until?: number; primitives: FlowPrimitive[]; texts: FlowText[]; anchors: Anchor[]; labelBoxes: (Rect & {label: string})[]}

const tones = new Set(['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger']);
const textTones = new Set(['text', 'accent', 'muted', 'danger']);
function common(name: string, xs: readonly {label?: string; id?: string}[], id?: string): void {
  if (!xs.length) throw new Error(`${name}(): at least one item is required`);
  const ids = new Set<string>();
  for (const [i, x] of xs.entries()) {
    if (!x.label?.trim()) throw new Error(`${name}(): item ${i + 1} needs a non-empty label`);
    if (x.id && (x.id === id || ids.has(x.id))) throw new Error(`${name}(): duplicate id "${x.id}"`);
    if (x.id) ids.add(x.id);
  }
}
export function chevronBand(steps: readonly FlowStep[], opts: ChevronOpts = {}): ChevronBand {
  common('chevron', steps, opts.id); steps.forEach((s, i) => { if (s.tone && !tones.has(s.tone)) throw new Error(`chevron(): step ${i + 1} has unknown tone "${s.tone}"`); });
  const current = opts.current ?? opts.highlight; if (current !== undefined && (!Number.isInteger(current) || current < 0 || current >= steps.length)) throw new Error(`chevron(): current/highlight must be a zero-based step index (0..${steps.length - 1})`);
  return {type: 'chevron', steps: [...steps], direction: opts.direction ?? 'horizontal', first: opts.first ?? 'pentagon', gap: opts.gap ?? 4, ...opts};
}
export function funnelBand(stages: readonly FunnelStage[], opts: FunnelOpts = {}): FunnelBand {
  common('funnel', stages, opts.id); stages.forEach((s, i) => { if (s.tone && !tones.has(s.tone)) throw new Error(`funnel(): stage ${i + 1} has unknown tone`); if (s.value !== undefined && (!Number.isFinite(s.value) || s.value < 0)) throw new Error(`funnel(): stage ${i + 1} value must be a finite number >= 0`); });
  if ((opts.scale ?? 'even') === 'value' && stages.some(s => s.value === undefined)) throw new Error('funnel(): scale "value" requires a value on every stage');
  return {type: 'funnel', stages: [...stages], scale: opts.scale ?? 'even', showRate: opts.showRate ?? false, ...opts};
}
export function cycleBand(steps: readonly FlowStep[], opts: CycleOpts = {}): CycleBand {
  if (steps.length < 3 || steps.length > 8) throw new Error(`cycle(): needs 3..8 steps (got ${steps.length})`); common('cycle', steps, opts.id);
  return {type: 'cycle', steps: [...steps], direction: opts.direction ?? 'cw', ...opts};
}
export function vennBand(sets: readonly VennSet[], opts: VennOpts = {}): VennBand {
  if (sets.length < 2 || sets.length > 3) throw new Error(`venn(): needs 2 or 3 sets (got ${sets.length})`); common('venn', sets.map(s => ({label: s.name, id: s.id})), opts.id);
  const names = new Set(sets.map(s => s.name)); if (names.size !== sets.length) throw new Error('venn(): set names must be unique');
  sets.forEach((s, i) => { if (s.tone && !textTones.has(s.tone)) throw new Error(`venn(): set ${i + 1} has unknown tone`); });
  for (const o of opts.overlaps ?? []) if (o.sets.length < 2 || o.sets.some(n => !names.has(n))) throw new Error(`venn(): overlap "${o.label}" names an unknown set`);
  return {type: 'venn', sets: [...sets], ...opts, overlaps: [...(opts.overlaps ?? [])]};
}
export function concentricBand(rings: readonly ConcentricRing[], opts: ConcentricOpts = {}): ConcentricBand {
  common('concentric', rings, opts.id); rings.forEach((r, i) => { if (r.tone && !textTones.has(r.tone)) throw new Error(`concentric(): ring ${i + 1} has unknown tone`); });
  return {type: 'concentric', rings: [...rings], order: opts.order ?? 'outer-first', labels: opts.labels ?? 'inside', ...opts};
}
export const flowShapeIds = (b: FlowShapeBand): string[] => (b.type === 'funnel' ? b.stages : b.type === 'venn' ? b.sets : b.type === 'concentric' ? b.rings : b.steps).flatMap(x => x.id ? [x.id] : []);
export function flowShapeTexts(b: FlowShapeBand, roles: Roles): [string, number, number, FontFamily][] {
  const xs: string[] = b.type === 'funnel' ? b.stages.flatMap(s => [s.label, s.value === undefined ? '' : String(s.value)]) : b.type === 'venn' ? [...b.sets.map(s => s.label ?? s.name), ...b.overlaps.map(o => o.label), typeof b.universe === 'string' ? b.universe : '', b.centre ?? ''] : b.type === 'concentric' ? [...b.rings.flatMap(r => [r.label, r.description ?? '']), b.centre ?? ''] : [...b.steps.flatMap(s => [s.label, s.sub ?? '']), b.type === 'cycle' ? b.centre ?? '' : ''];
  return xs.filter(Boolean).map(s => [s, roles.note, 400, 'sans']);
}

export function layoutFlowShape(b: FlowShapeBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles): LaidOutFlowShape {
  const w = Math.min(cw, b.width ?? cw), ox = x + (cw - w) / 2, primitives: FlowPrimitive[] = [], texts: FlowText[] = [], anchors: Anchor[] = [], labelBoxes: (Rect & {label: string})[] = [];
  const addText = (text: string, cx: number, top: number, maxW: number, weight: 400 | 700 = 700, tone: TextTone = 'text', size = roles.note) => {
    const lines = wrapAtoms(splitAtoms(text), {maxWidth: Math.max(24, maxW), atomWidth: a => widthOf(a, size, weight, 'sans')});
    lines.forEach((line, i) => { const tw = splitAtoms(line).reduce((n, a) => n + widthOf(a, size, weight, 'sans'), 0), yy = top + (i + 1) * size * 1.35; texts.push({text: line, tx: cx, ty: yy, size, weight, anchor: 'middle', tone, x: cx - tw / 2, y: yy - size, w: tw, h: size * 1.2}); labelBoxes.push({label: text, x: cx - tw / 2, y: yy - size, w: tw, h: size * 1.2}); });
    return lines.length * size * 1.35;
  };
  const anchor = (id: string | undefined, r: Rect) => { if (id) anchors.push({id, ...r}); };
  let h = 0;
  if (b.type === 'chevron') {
    const vertical = b.direction === 'vertical', n = b.steps.length, cellW = vertical ? Math.min(360, w) : (w - b.gap * (n - 1)) / n, avail = cellW - 28;
    const lineCounts = b.steps.map(s => Math.max(1, wrapAtoms(splitAtoms(s.label), {maxWidth: avail, atomWidth: a => widthOf(a, roles.note, 700, 'sans')}).length) + (s.sub ? wrapAtoms(splitAtoms(s.sub), {maxWidth: avail, atomWidth: a => widthOf(a, roles.note, 400, 'sans')}).length : 0));
    const cellH = Math.max(60, Math.max(...lineCounts) * roles.note * 1.35 + 20); h = vertical ? n * cellH + (n - 1) * b.gap : cellH;
    b.steps.forEach((s, i) => { const xx = vertical ? ox + (w - cellW) / 2 : ox + i * (cellW + b.gap), yy = vertical ? y + i * (cellH + b.gap) : y, tip = Math.min(22, (vertical ? cellH : cellW) / 4); let pts: [number, number][];
      if (vertical) pts = [[xx, yy], [xx + cellW, yy], [xx + cellW, yy + cellH - tip], [xx + cellW / 2, yy + cellH], [xx, yy + cellH - tip]];
      else pts = [[xx, yy], [xx + cellW - tip, yy], [xx + cellW, yy + cellH / 2], [xx + cellW - tip, yy + cellH], [xx, yy + cellH], ...(i || b.first === 'chevron' ? [[xx + tip, yy + cellH / 2] as [number, number]] : [])];
      primitives.push({k: 'polygon', points: pts, tone: (b.current ?? b.highlight) === i ? 'accent' : s.tone ?? 'plain'}); const r = {x: xx, y: yy, w: cellW, h: cellH}; anchor(s.id, r); const used = addText(s.label, xx + cellW / 2, yy + 8, cellW - 30); if (s.sub) addText(s.sub, xx + cellW / 2, yy + 8 + used, cellW - 30, 400, 'muted'); });
  } else if (b.type === 'funnel') {
    const n = b.stages.length, rowH = 64, max = Math.max(...b.stages.map(s => s.value ?? 1), 1), minW = Math.min(150, w * .3); h = n * rowH;
    b.stages.forEach((s, i) => { const frac = b.scale === 'value' ? Math.max(.15, (s.value ?? 0) / max) : 1 - i * .65 / Math.max(1, n - 1), next = i === n - 1 ? frac * .8 : b.scale === 'value' ? Math.max(.15, (b.stages[i + 1].value ?? 0) / max) : 1 - (i + 1) * .65 / Math.max(1, n - 1); const a = Math.max(minW, w * frac), z = Math.max(minW * .8, w * next), yy = y + i * rowH, cx = ox + w / 2, pts: [number, number][] = [[cx-a/2,yy],[cx+a/2,yy],[cx+z/2,yy+rowH-4],[cx-z/2,yy+rowH-4]]; primitives.push({k:'polygon',points:pts,tone:s.tone ?? (i%2?'muted':'accent')}); const r={x:cx-a/2,y:yy,w:a,h:rowH-4}; anchor(s.id,r); const beside = Math.min(a,z) < 150; addText(`${s.label}${s.value === undefined ? '' : `  ${s.value}`}`, beside ? Math.min(ox+w-70,cx+a/2+70) : cx, yy+14, beside ? 130 : Math.min(a,z)-20, 700, beside?'text':'text'); const previous = i ? b.stages[i - 1].value : undefined; if (b.showRate && previous && s.value !== undefined) addText(`${Math.round(s.value/previous*100)}%`, ox+42, yy+16, 70, 400, 'muted'); });
  } else if (b.type === 'cycle') {
    h = Math.min(520, Math.max(300, w * .62)); const cx=ox+w/2, cy=y+h/2, R=Math.min(w,h)*.34, nr=Math.min(54, Math.max(36, R*.38)); b.steps.forEach((s,i)=>{ const sign=b.direction==='cw'?1:-1, a=-Math.PI/2+sign*2*Math.PI*i/b.steps.length, nx=cx+R*Math.cos(a),ny=cy+R*Math.sin(a), na=-Math.PI/2+sign*2*Math.PI*((i+1)%b.steps.length)/b.steps.length, ex=cx+R*Math.cos(na),ey=cy+R*Math.sin(na), mx=(nx+ex)/2 + (cx-(nx+ex)/2)*.18,my=(ny+ey)/2+(cy-(ny+ey)/2)*.18; primitives.push({k:'path',d:`M${nx},${ny} Q${mx},${my} ${ex},${ey}`,tone:'text',arrow:true}); primitives.push({k:'circle',cx:nx,cy:ny,r:nr,tone:s.tone==='danger'?'danger':s.tone==='muted'?'muted':'accent'}); const r={x:nx-nr,y:ny-nr,w:2*nr,h:2*nr};anchor(s.id,r);addText(s.label,nx,ny-roles.note*1.1,nr*1.55); }); if(b.centre)addText(b.centre,cx,cy-roles.note,w*.25,700,'text',roles.label);
  } else if (b.type === 'venn') {
    h=Math.min(460,w*.58)+(b.universe?32:0); const cx=ox+w/2,cy=y+h/2+8,r=Math.min(w*.23,h*.34), positions=b.sets.length===2?[[cx-r*.58,cy],[cx+r*.58,cy]]:[[cx-r*.55,cy-r*.28],[cx+r*.55,cy-r*.28],[cx,cy+r*.52]]; if(b.universe)primitives.push({k:'rect',x:ox+8,y:y+8,w:w-16,h:h-16,tone:'muted',label:typeof b.universe==='string'?b.universe:undefined}); b.sets.forEach((s,i)=>{const [px,py]=positions[i];primitives.push({k:'circle',cx:px,cy:py,r,tone:s.tone??(['accent','danger','muted'] as TextTone[])[i],opacity:.22,dashed:i===1});anchor(s.id,{x:px-r,y:py-r,w:2*r,h:2*r});addText(s.label??s.name,px,py-r*.7,r*1.2);}); for(const o of b.overlaps){const ps=o.sets.map(n=>positions[b.sets.findIndex(s=>s.name===n)]);addText(o.label,ps.reduce((a,p)=>a+p[0],0)/ps.length,ps.reduce((a,p)=>a+p[1],0)/ps.length-roles.note,Math.max(80,r));} if(b.centre)addText(b.centre,cx,cy-roles.note,Math.max(80,r));
  } else {
    h=Math.min(520,w*.62); const side=b.labels==='side',cx=ox+(side?w*.36:w/2),cy=y+h/2,R=Math.min(h*.43,side?w*.3:w*.42), ordered=b.order==='outer-first'?b.rings:[...b.rings].reverse(); ordered.forEach((r,i)=>{const rr=R*(ordered.length-i)/ordered.length;primitives.push({k:'circle',cx,cy,r:rr,tone:r.tone??(['accent','muted','danger','text'] as TextTone[])[i%4],opacity:.10+(i%2)*.05,dashed:i%2===1});anchor(r.id,{x:cx-rr,y:cy-rr,w:2*rr,h:2*rr}); const ly=side?y+30+i*(h-40)/Math.max(1,ordered.length):cy-rr+12, lx=side?ox+w*.76:cx; addText(`${r.label}${r.description?` — ${r.description}`:''}`,lx,ly,side?w*.42:Math.max(80,rr*1.35),700,r.tone??'text');});if(b.centre)addText(b.centre,cx,cy-roles.note,Math.max(70,R*.6),700,'text');
  }
  return {type:b.type,id:b.id,reveal:b.reveal,until:b.until,x:ox,y,w,h,primitives,texts,anchors,labelBoxes};
}
