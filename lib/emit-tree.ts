import {PALETTE, colorOf, toneStyle, isSolidTone} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutTree} from './types/diagrams.ts';
import {visibleAt} from './reveal-visibility.ts';
import {snap4, emojiSpan, lineAttrs} from './emit-common.ts';
import {compareEdgeOrder, edgeStrokes, isOnePath} from './tree-edge-style.ts';
import {renderBoxRect} from './emit-box-frame.ts';

import {must} from './must.ts';

export function renderTree(b: LaidOutTree, day: Theme, tones: ToneEnv, stage?: number): string {
  const out: string[] = [];
  // default lines first, then styled ones (ADR 0081), lit lines (focus) last: siblings share the trunk of an elbow, and the later one is drawn over it
  for (const e of b.edges.filter(e => visibleAt(e, stage)).toSorted(compareEdgeOrder)) { // (only a funnel line carries its own reveal)
    const a = must(e.points[0]), z = must(e.points[e.points.length - 1]);
    // curve: a cubic that leaves and arrives along the axis the tree grows on (`curve`), so it reads as one smooth S
    const dOf = (pts: readonly {x: number; y: number}[]): string => `M${pts.map(p => `${snap4(p.x)},${snap4(p.y)}`).join(' L')}`;
    const d = e.curve ? (e.curve === 'x' ? `M${snap4(a.x)},${snap4(a.y)} C${snap4((a.x + z.x) / 2)},${snap4(a.y)} ${snap4((a.x + z.x) / 2)},${snap4(z.y)} ${snap4(z.x)},${snap4(z.y)}` : `M${snap4(a.x)},${snap4(a.y)} C${snap4(a.x)},${snap4((a.y + z.y) / 2)} ${snap4(z.x)},${snap4((a.y + z.y) / 2)} ${snap4(z.x)},${snap4(z.y)}`) : dOf(e.points);
    const {own, trunk} = edgeStrokes(e, b.dim, day, tones), width = e.bold ? 4 : 2;
    const path = (dd: string, st: typeof own): string => `<path d="${dd}" fill="none" stroke="${st.color}" stroke-width="${width}"${lineAttrs(st.line)}/>`;
    // the segments shared with the siblings and the item's own last one look different (ADR 0081): two paths, else the one path as ever
    if (isOnePath(own, trunk) || e.curve || e.points.length < 3) out.push(path(d, own));
    else { out.push(path(dOf(e.points.slice(0, -1)), trunk)); out.push(path(dOf(e.points.slice(-2)), own)); }
  }
  for (const br of b.braces ?? []) { // a `{`: two quarter turns in, a point toward the parent, two quarter turns out
    const s = br.side === 'right' ? 1 : -1, r = 8, x = snap4(br.x), xt = snap4(br.tipX), y1 = snap4(br.y1), y2 = snap4(br.y2), ym = snap4(br.ymid);
    out.push(`<path d="M${x + s * r},${y1} Q${x},${y1} ${x},${y1 + r} V${ym - r} Q${x},${ym} ${xt},${ym} Q${x},${ym} ${x},${ym + r} V${y2 - r} Q${x},${y2} ${x + s * r},${y2}" fill="none" stroke="${PALETTE.muted}" stroke-width="2"/>`);
  }
  for (const n of b.nodes) if (!n.band) out.push(renderBoxRect({...n, dim: b.dim}, day, tones, 'plain')); // a band node is drawn by its own band
  const nodes = b.nodes;
  const ink = (t: LaidOutTree['texts'][number]): string => {
    if (b.dim) return PALETTE.muted;
    const n = nodes.find(r => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h);
    if (n && isSolidTone(n.tone)) return colorOf(toneStyle(tones, n.tone).text, day); // white on the fill, the sub line too
    // the muted second line is 4.48:1 on a soft (accent / new) fill, under the 4.5 the text rules ask for: it takes the plain text colour there
    if (t.muted) return n && toneStyle(tones, n.tone).fill === 'soft' ? PALETTE.text : PALETTE.muted;
    return colorOf(toneStyle(tones, n?.tone).text, day);
  };
  for (const t of b.texts) out.push(`<text x="${Math.round(t.x)}" y="${Math.round(t.y)}" text-anchor="middle" font-size="${t.size}"${t.bold ? ' font-weight="700"' : ''} fill="${ink(t)}">${emojiSpan(t.text)}</text>`);
  return out.join('\n  ');
}
