// node spikes/comic-extensions/run-checks.ts — the new checks on the real geometry (expect none) and on mutated copies (expect hits).
import {measureWithFonts} from '../../lib/font-metrics.ts';
import {layoutComic} from '../comic-worksheet/proto.ts';
import {sample} from '../comic-worksheet/sample.ts';
import {checkOrderAndTails, readingOrder} from './checks.ts';

const hb = (text: string, size: number, weight = 400) => measureWithFonts(new Map([['k', {text, size, weight, font: 'sans' as const}]])).get('k')!.w;
const geo = layoutComic(sample, hb).geometry;
const panels = sample.panels.map(p => ({id: p.id, speakers: p.lines.map(l => l.kind === 'narration' ? null : l.speaker)}));
const t0 = performance.now(); const real = checkOrderAndTails(geo, panels); const ms = performance.now() - t0;
const mut = structuredClone(geo);
const swap = (a: string, b: string) => { const t = mut.bubbles[a]!; mut.bubbles[a] = {...mut.bubbles[b]!}; mut.bubbles[b] = {...t}; };
swap('p2.b0', 'p2.b1');                                   // a stack read bottom-up
mut.bubbles['p3.b0'] = {...mut.bubbles['p3.b0']!, x: 24}; // the right speaker's bubble dragged over the left speaker (an `anchor` override)
console.log(JSON.stringify({real, realMs: +ms.toFixed(2), mutated: checkOrderAndTails(mut, panels), order: readingOrder([{x: 10, y: 0, w: 100, h: 50}, {x: 200, y: 10, w: 100, h: 50}, {x: 10, y: 60, w: 100, h: 50}], 'ltr')}, null, 1));
