// Shared by the causal / dependency layout tests: seeded diagrams, and the two checks every sweep runs on a drawn SVG —
// `checkDiagram` (generation side) and lint-svg's geometry rules (the rule that a line must not run through a text only shows up here).
import {checkDiagram, diagram, renderDiagram} from '../../lib/dsl.ts';
import type {CausalNode, DependencyEdge} from '../../lib/dsl.ts';
import {loadConfig} from '../../lib/config.ts';
import {geometryChecks} from '../../lib/geometry-checks.ts';
import type {ChartBand} from '../../lib/charts.ts';
import type {CausalLink} from '../../lib/semnet-analysis.ts';

export const rng = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const LABELS = ['品質', '満足', '受注', '負荷', '残業', '離職', '標準の合意', '早期の果実'];
/** A 5-node loop plus two outside nodes that act on it; polarities and delays are drawn from the seed. */
export function causalCase(seed: number): {nodes: CausalNode[]; links: CausalLink[]} {
  const rand = rng(seed), pol = () => (rand() < .5 ? '+' : '-') as '+' | '-';
  const nodes = LABELS.slice(0, 7).map((label, i) => ({id: `n${i}`, label}));
  const links: CausalLink[] = [];
  for (let i = 0; i < 5; i++) links.push({from: `n${i}`, to: `n${(i + 1) % 5}`, polarity: pol(), ...(rand() < .3 ? {delay: true} : {})});
  for (const o of [5, 6]) links.push({from: `n${o}`, to: `n${Math.floor(rand() * 5)}`, polarity: pol(), ...(rand() < .3 ? {delay: true} : {})});
  return {nodes, links};
}
/** A small random dependency network, with edge labels (weights and types). */
export function dependencyCase(seed: number): {nodes: {id: string; label: string}[]; edges: DependencyEdge[]} {
  const rand = rng(seed), n = 5 + Math.floor(rand() * 3), nodes = Array.from({length: n}, (_, i) => ({id: `d${i}`, label: LABELS[i]}));
  const edges: DependencyEdge[] = [];
  for (let i = 1; i < n; i++) edges.push({from: `d${Math.floor(rand() * i)}`, to: `d${i}`, type: rand() < .5 ? 'depends' : 'uses', weight: 1 + Math.floor(rand() * 5)});
  for (let k = 0; k < 3; k++) { const a = Math.floor(rand() * n), b = Math.floor(rand() * n); if (a < b && !edges.some(e => e.from === `d${a}` && e.to === `d${b}`)) edges.push({from: `d${a}`, to: `d${b}`, type: 'blocks'}); }
  return {nodes, edges};
}

export interface SweepResult {error?: string; problems: string[]; lint: string[]; svg: string}
/** Draw one band; either a refusal (the error message), or the problems from `checkDiagram` and from lint-svg's geometry rules. */
export async function drawAndCheck(band: ChartBand): Promise<SweepResult> {
  const d = diagram({theme: 'blue'}).add(band as never);
  let svg: string;
  try { svg = (await renderDiagram(d, {name: 'sweep.svg', budget: 'measure'})).svg; } catch (e) { return {error: (e as Error).message, problems: [], lint: [], svg: ''}; }
  const g = geometryChecks(svg, loadConfig().fonts)!;
  return {problems: (await checkDiagram(d)).verdict.problems, lint: [...g.covered.map(c => `"${c.txt}" is ${c.how === 'crosses' ? 'crossed by' : 'covered by'} a ${c.by}`), ...g.textOverlap.map(t => `text "${t.a}" overlaps "${t.b}"`), ...g.containerOverflow.map(t => `"${t.txt}" overflows its box`)], svg};
}
/** A denser causal figure: 3-6 nodes, about twice as many links, 40% with a delay and 40% with a free text label. */
export function denseCausalCase(seed: number): {nodes: CausalNode[]; links: CausalLink[]} {
  const rand = rng(seed), k = 3 + Math.floor(rand() * 4), nodes = Array.from({length: k}, (_, i) => ({id: `n${i}`, label: `要素${i}`}));
  const links: CausalLink[] = [];
  for (let i = 0; i < k * 2; i++) {
    const a = Math.floor(rand() * k), b = Math.floor(rand() * k);
    if (a !== b && !links.some(l => l.from === `n${a}` && l.to === `n${b}`)) links.push({from: `n${a}`, to: `n${b}`, polarity: rand() < .5 ? '+' : '-', ...(rand() < .4 ? {delay: true} : {}), ...(rand() < .4 ? {label: '短期的な効果'} : {})});
  }
  return {nodes, links};
}

interface Bx {x: number; y: number; w: number; h: number}
const boxesOf = (svg: string, re: RegExp, pick: (m: RegExpExecArray) => number[]): Bx[] => [...svg.matchAll(re)].map(m => { const n = pick(m), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1); return {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}; });
const inter = (a: Bx, b: Bx): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** Does the plate reach into the box by 1.5px or more both ways (the checker lets a label touch by up to 0.5px, and the plate is 2px wider than its text)? */
const cut = (a: Bx, b: Bx): boolean => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) >= 1.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) >= 1.5;
/**
 * What a label plate hides. `heads`: arrow heads at least half under plates; `nodes`: plates that reach a node box (its edge is cut).
 * (lint-svg rule 5 only sees a line drawn after a text, so a plate that hides a line or a head is invisible to it.)
 */
export function plateDamage(svg: string): {heads: number; nodes: number} {
  const num = '(-?[\\d.]+)', plates = boxesOf(svg, new RegExp(`<path d="M${num},${num} H${num} V${num} H${num} Z" fill="#ffffff"/>`, 'g'), m => [+m[1], +m[2], +m[3], +m[4]]);
  const nodes = boxesOf(svg, new RegExp(`<path d="M${num},${num} H${num} V${num} H${num} Z" fill="#ffffff" stroke=`, 'g'), m => [+m[1], +m[2], +m[3], +m[4]]);
  const heads = boxesOf(svg, new RegExp(`<path d="M${num},${num} L${num},${num} L${num},${num} Z" fill="#[0-9a-f]{6}"/>`, 'g'), m => [+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]]);
  return {heads: heads.filter(h => h.w * h.h > 0 && plates.reduce((a, p) => a + inter(h, p), 0) >= .5 * h.w * h.h).length, nodes: plates.filter(p => nodes.some(n => cut(p, n))).length};
}
/** Number of drawn `<text>` elements whose content is exactly `s`. */
export const countText = (svg: string, s: string): number => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].filter(m => m[1] === s).length;
