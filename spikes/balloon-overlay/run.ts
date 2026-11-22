// node spikes/balloon-overlay/run.ts   — places one balloon per box of three example figures, measures, and writes out/*.svg (ADR 0078).
import fs from 'node:fs';
import {renderSource} from '../../lib/render-source.ts';
import {balloonPath} from '../../lib/comic/balloon-path.ts';
import {score as bestOne, best, bodySize, candidates, placeAll, sceneOf, type Balloon, type Cand, type Scene} from './place.ts';
import {clipArea, rectPoly, type Rect} from './geom.ts';

const out = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(out, {recursive: true});
const NAMES = ['flowchart', 'why-why', 'state-diagram', 'steps', 'canvas-swot', 'canvas-bmc'], TEXTS = ['要確認', 'ここが変更点'];
const lines: string[] = []; const rep = (s: string): void => { lines.push(s); console.log(s); };
let seed = 12345; const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const jig = (r: Rect, e: number): Rect => { const s = (): number => (rnd() < 0.5 ? -e : e); return {x: r.x + s(), y: r.y + s(), w: r.w + s(), h: r.h + s()}; };
const key = (c: Cand | undefined): string => c ? `${c.dir}${c.d}` : 'none';

const draw = (sc: Scene, placed: {c: Cand; text: string}[], extra = ''): string => {
  const g = placed.map(({c, text}) => { const p = balloonPath(c.body, 'say', {tip: c.tip, halfWidth: 8});
    return `<g class="overlay"><path d="${p.d}" fill="#fff4c2" stroke="#22201b" stroke-width="2" stroke-linejoin="round"/><text x="${c.body.x + c.body.w / 2}" y="${c.body.y + 23}" text-anchor="middle" font-size="15" font-weight="700" fill="#22201b">${text}</text></g>`; }).join('');
  return sc.svg.replace('</svg>', `<g id="overlay-layer">${g}${extra}</g></svg>`);
};

const feas = {cands: 0, clean: 0};
const total = {n: 0, none: 0, zeroText: 0, covText: 0, ms: 0};
const flips: Record<number, {n: number; flip: number}> = {0: {n: 0, flip: 0}, 1: {n: 0, flip: 0}, 4: {n: 0, flip: 0}};
const perFig: string[] = [];
for (const name of NAMES) {
  const r = await renderSource(new URL(`../../examples/${name}.ts`, import.meta.url).pathname); const sc = sceneOf(r.svg);
  let n = 0, zero = 0, nothing = 0, other0 = 0;
  sc.boxes.forEach((T, bi) => {
    const b: Balloon = {text: TEXTS[bi % 2]!, target: T, id: `t${bi}`};
    const t0 = performance.now(); const res = best(candidates(b), sc, 0.5); total.ms += performance.now() - t0;
    n++; total.n++;
    for (const c of candidates(b)) { const sc1 = bestOne(c, sc as never); if (sc1) { feas.cands++; if (sc1.text <= 0.5) feas.clean++; } }
    if (!res) { nothing++; total.none++; return; }
    if (res.s.text <= 0.5) { zero++; total.zeroText++; } else total.covText++;
    if (res.s.other === 0) other0++;
    for (const eps of [0, 1, 4]) {
      const base = key(best(candidates(b), sc, eps)?.c);
      for (let k = 0; k < 60; k++) {
        const o = {...sc, texts: sc.texts.map(t => jig(t, 0.0156))}; // measurement noise on every text rectangle
        flips[eps]!.n++; if (key(best(candidates(b), o, eps)?.c) !== base) flips[eps]!.flip++;
      }
    }
  });
  perFig.push(`| ${name} | ${sc.boxes.length} | ${sc.texts.length} | ${sc.lines.length} | ${n} | ${zero} | ${nothing} | ${other0} |`);
  // three balloons in declaration order on the first three boxes (the later ones see the earlier ones as obstacles)
  const bs: Balloon[] = sc.boxes.slice(0, 3).map((T, i) => ({text: TEXTS[i % 2]!, target: T, id: `t${i}`}));
  const res = placeAll(sc, bs, 0.5);
  fs.writeFileSync(`${out}${name}-3balloons.svg`, draw(sc, res.flatMap((q, i) => q ? [{c: q.c, text: bs[i]!.text}] : [])));
  rep(`${name}: 3 balloons -> ${res.map(q => q ? `${key(q.c)} (text ${q.s.text.toFixed(1)}, other ${q.s.other.toFixed(0)})` : 'none').join(', ')}`);
}
rep('\n| figure | boxes | texts | connectors | balloons | covers no text | no candidate | also covers nothing else |\n|---|---|---|---|---|---|---|---|');
for (const l of perFig) rep(l);
rep(`\nbest candidate covers no text (<= 0.5px^2): ${total.zeroText} / ${total.n}; covers some text: ${total.covText}; no candidate fits the canvas: ${total.none}`);
for (const e of [0, 1, 4]) rep(`stability under +-0.0156px noise on every text rect, eps=${e}px^2: ${flips[e]!.flip} flips / ${flips[e]!.n} trials = ${(100 * flips[e]!.flip / flips[e]!.n).toFixed(2)}%`);
rep(`candidates that fit the canvas and cover no text: ${feas.clean} / ${feas.cands} = ${(100 * feas.clean / feas.cands).toFixed(1)}%`);
rep(`time per balloon (24 candidates, ${total.n} balloons): ${(total.ms / total.n).toFixed(3)} ms`);
// where would it start to flip? the same test with the noise scaled up (eps = 0.5px^2, the proposed rule)
{
  const figs: [Scene, Balloon][] = [];
  for (const name of NAMES) { const sc = sceneOf((await renderSource(new URL(`../../examples/${name}.ts`, import.meta.url).pathname)).svg); sc.boxes.forEach((T, bi) => figs.push([sc, {text: TEXTS[bi % 2]!, target: T, id: 't'}])); }
  for (const scale of [1, 16, 64, 256]) {
    let f = 0, n = 0;
    for (const [sc, b] of figs) { const base = key(best(candidates(b), sc, 0.5)?.c); for (let k = 0; k < 20; k++) { n++; if (key(best(candidates(b), {...sc, texts: sc.texts.map(t => jig(t, 0.0156 * scale))}, 0.5)?.c) !== base) f++; } }
    rep(`noise x${scale} (+-${(0.0156 * scale).toFixed(2)}px), eps=0.5: ${f} flips / ${n} = ${(100 * f / n).toFixed(2)}%`);
  }
}
fs.writeFileSync(`${out}measurements-place.txt`, lines.join('\n') + '\n');
