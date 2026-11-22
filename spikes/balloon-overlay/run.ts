// node spikes/balloon-overlay/run.ts   — places one balloon per box of six example figures, measures, and writes out/*.svg (ADR 0078, round 2).
import fs from 'node:fs';
import {renderSource} from '../../lib/render-source.ts';
import {balloonPath} from '../../lib/comic/balloon-path.ts';
import {best, candidates, placeAll, problemsOf, score, sceneOf, type Balloon, type Cand, type Scene} from './place.ts';
import type {Pt, Rect} from './geom.ts';

const out = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(out, {recursive: true});
const NAMES = ['flowchart', 'why-why', 'state-diagram', 'steps', 'canvas-swot', 'canvas-bmc', 'service-blueprint', 'org-chart'], TEXTS = ['要確認', 'ここが変更点'];
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };
let seed = 12345; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const sg = (e: number): number => (rnd() < 0.5 ? -e : e);
const jig = (r: Rect, e: number): Rect => ({x: r.x + sg(e), y: r.y + sg(e), w: r.w + sg(e), h: r.h + sg(e)});
const jigP = (p: Pt[], e: number): Pt[] => p.map(q => [q[0] + sg(e), q[1] + sg(e)] as Pt);
/** noise on EVERY input the placement reads: text rects, boxes, shapes, arrowheads and connector paths */
const jigScene = (sc: Scene, e: number): Scene => ({...sc, texts: sc.texts.map(t => jig(t, e)), boxes: sc.boxes.map(t => jig(t, e)), shapes: sc.shapes.map(p => jigP(p, e)), heads: sc.heads.map(p => jigP(p, e)), lines: sc.lines.map(p => jigP(p, e))});
const key = (c: Cand | undefined): string => c ? `${c.dir}${c.d}` : 'none';

const draw = (sc: Scene, placed: {c: Cand; text: string}[]): string => {
  const g = placed.map(({c, text}) => { const p = balloonPath(c.body, 'shout', {tip: c.tip, halfWidth: 8});
    return `<g class="overlay"><path d="${p.d}" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="${p.d}" fill="#fff4c2" stroke="#22201b" stroke-width="2" stroke-linejoin="round"/><text x="${c.body.x + c.body.w / 2}" y="${c.body.y + 23}" text-anchor="middle" font-size="15" font-weight="700" fill="#22201b">${text}</text></g>`; }).join('');
  return sc.svg.replace('</svg>', `<g id="overlay-layer">${g}</g></svg>`);
};

const T = {prob: 0, probContent: 0, probEnds: 0, probLegs: 0, dirs: {} as Record<string, number>, n: 0, none: 0, zero: 0, ms: 0, diag: 0, flat: 0, corner: 0, tieTier4: 0, tieAll: 0, clean: 0, cands: 0, fixedAngleFallback: 0};
const flips: Record<number, {n: number; flip: number}> = {0: {n: 0, flip: 0}, 0.5: {n: 0, flip: 0}, 1: {n: 0, flip: 0}, 4: {n: 0, flip: 0}};
const perFig: string[] = [], figs: [Scene, Balloon][] = [];
for (const name of NAMES) {
  const sc = sceneOf((await renderSource(new URL(`../../examples/${name}.ts`, import.meta.url).pathname)).svg);
  let n = 0, zero = 0, nothing = 0;
  sc.boxes.forEach((Tg, bi) => {
    const b: Balloon = {text: TEXTS[bi % 2]!, target: Tg, id: `t${bi}`}; figs.push([sc, b]);
    const t0 = performance.now(); const res = best(candidates(b), sc, 0.5); T.ms += performance.now() - t0;
    n++; T.n++;
    for (const c of candidates(b)) { const s1 = score(c, sc); if (s1) { T.cands++; if (s1.content <= 0.5) T.clean++; } }
    if (!res) { nothing++; T.none++; return; }
    if (res.s.content <= 0.5) { zero++; T.zero++; }
    if (res.c.diag) T.diag++;
    const pr = problemsOf(res.s); if (pr.any) T.prob++; if (pr.content) T.probContent++; if (pr.ends) T.probEnds++; if (pr.legs) T.probLegs++;
    T.dirs[res.c.dir] = (T.dirs[res.c.dir] ?? 0) + 1;
    if (res.c.angle < 30) T.flat++;
    if (Math.min(...[[Tg.x, Tg.y], [Tg.x + Tg.w, Tg.y], [Tg.x, Tg.y + Tg.h], [Tg.x + Tg.w, Tg.y + Tg.h]].map(q => Math.hypot(res.c.tip[0] - q[0], res.c.tip[1] - q[1]))) <= 6) T.corner++;
    // how often is the winner decided only by the fixed order? (runner-up equal on tiers 1-4, then also on distance and crossings)
    const ranked = candidates(b).map(c => ({c, s: score(c, sc)})).filter((q): q is {c: Cand; s: Score} => !!q.s).sort((p, q) => p.s.content - q.s.content || p.s.links - q.s.links || p.s.other - q.s.other || p.s.flat - q.s.flat || p.s.diag - q.s.diag || p.s.d - q.s.d || p.s.cross - q.s.cross || p.s.i - q.s.i);
    const [a1, a2] = ranked; if (a1 && a2 && Math.abs(a1.s.content - a2.s.content) <= 0.5 && a1.s.links === a2.s.links && Math.abs(a1.s.other - a2.s.other) <= 2 && a1.s.flat === a2.s.flat && a1.s.diag === a2.s.diag) { T.tieTier4++; if (a1.s.d === a2.s.d && a1.s.cross === a2.s.cross) T.tieAll++; }
    for (const eps of [0, 0.5, 1, 4]) {
      const base = key(best(candidates(b), sc, eps)?.c);
      for (let k = 0; k < 60; k++) { flips[eps]!.n++; if (key(best(candidates(b), jigScene(sc, 0.0156), eps)?.c) !== base) flips[eps]!.flip++; }
    }
  });
  perFig.push(`| ${name} | ${sc.boxes.length} | ${sc.texts.length} | ${sc.shapes.length} | ${sc.lines.length} | ${n} | ${zero} | ${nothing} |`);
  const bs: Balloon[] = sc.boxes.slice(0, 3).map((Tg, i) => ({text: TEXTS[i % 2]!, target: Tg, id: `t${i}`}));
  const res = placeAll(sc, bs, 0.5);
  fs.writeFileSync(`${out}${name}-3balloons.svg`, draw(sc, res.flatMap((q, i) => q ? [{c: q.c, text: bs[i]!.text}] : [])));
  rep(`${name}: 3 balloons -> ${res.map(q => q ? `${key(q.c)} (content ${q.s.content.toFixed(1)}, other ${q.s.other.toFixed(0)}, angle ${q.c.angle.toFixed(0)})` : 'none').join(', ')}`);
}
rep('\n| figure | boxes | texts | shapes (diamonds, circles) | connectors | balloons | covers no content | no candidate |\n|---|---|---|---|---|---|---|---|');
for (const l of perFig) rep(l);
const pc = (a: number, b: number): string => `${a} / ${b} = ${(100 * a / b).toFixed(1)}%`;
rep(`\nbest candidate covers no content (text, shapes; footprint incl. 3px halo; <= 0.5px^2): ${pc(T.zero, T.n)}; no candidate fits the canvas: ${T.none}`);
rep(`D3 problems on the chosen placements (content > 0.5px^2, hidden arrowhead, connector leg hidden >= 50% or >= 40px): none in ${T.n - T.prob} / ${T.n}; content ${T.probContent}, arrowheads ${T.probEnds}, legs ${T.probLegs}; chart marks are not in the spike's scene`);
rep(`direction mix of the chosen placements: ${Object.entries(T.dirs).sort().map(([k, v]) => k + ' ' + v).join(', ')}`);
rep(`candidates that fit the canvas and cover no content: ${pc(T.clean, T.cands)}`);
rep(`chosen placements: diagonal ${pc(T.diag, T.n)}; tail angle to its edge under 30 degrees ${pc(T.flat, T.n)}; tip within 6px of a target corner ${pc(T.corner, T.n)}`);
rep(`runner-up equal on content, links, other, flat, diag (decided by distance / crossings / fixed order): ${pc(T.tieTier4, T.n)}; equal also on distance and crossings (fixed order alone): ${pc(T.tieAll, T.n)}`);
for (const e of [0, 0.5, 1, 4]) rep(`stability, +-0.0156px noise on ALL inputs (texts, boxes, shapes, arrowheads, connectors), eps=${e}: ${pc(flips[e]!.flip, flips[e]!.n)} flips`);
for (const scale of [16, 64, 256]) {
  let f = 0, n = 0;
  for (const [sc, b] of figs) { const base = key(best(candidates(b), sc, 0.5)?.c); for (let k = 0; k < 20; k++) { n++; if (key(best(candidates(b), jigScene(sc, 0.0156 * scale), 0.5)?.c) !== base) f++; } }
  rep(`noise x${scale} (+-${(0.0156 * scale).toFixed(2)}px) on all inputs, eps=0.5: ${pc(f, n)} flips`);
}
rep(`time per balloon (24 candidates, ${T.n} balloons): ${(T.ms / T.n).toFixed(3)} ms`);
// the @at override: the tip is the author's anchor point (+ normal * gap), whatever the nearest edge point says
{
  const [sc, b] = figs[0]!; const a: Balloon = {...b, anchor: {side: 'top', at: 0.3}}, r = best(candidates(a), sc, 0.5)!;
  rep(`@at override (top@0.3 of the first box): tip ${r.c.tip.map(v => v.toFixed(1)).join(',')} (expected x ${(b.target.x + b.target.w * 0.3).toFixed(1)}, y ${(b.target.y - 4).toFixed(1)}); placed ${key(r.c)}`);
}
fs.writeFileSync(`${out}measurements-place.txt`, lines.join('\n') + '\n');
