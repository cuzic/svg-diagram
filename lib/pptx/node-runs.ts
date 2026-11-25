import {isSolidTone, toneStyle, type ToneEnv} from '../tokens.ts';
import type {TextTone} from '../types/core.ts';
import type {LaidOutTree, TreeNodeText} from '../types/diagrams.ts';
import type {WrappedRun} from '../types/text-bands.ts';
import type {Rect} from './xml.ts';

/** The shared text inset of tree, cause and state nodes. */
export const NODE_TEXT_PAD_Y = 8;

const RUN_TONES: ReadonlySet<string> = new Set(['text', 'accent', 'muted', 'danger']);

/** The texts drawn inside a node, by the same test the svg uses to colour them. */
const inside = (r: Rect, t: TreeNodeText): boolean => t.x >= r.x && t.x <= r.x + r.w && t.y > r.y && t.y <= r.y + r.h;

/** A node's lines as runs: consecutive lines of the same size, weight and colour are one run, at the baselines the layout gave. */
export function nodeRunsOf(n: Rect & {tone: LaidOutTree['nodes'][number]['tone']}, texts: readonly TreeNodeText[], tones: ToneEnv): WrappedRun[] {
  const solid = isSolidTone(n.tone), soft = toneStyle(tones, n.tone).fill === 'soft';
  const runs: WrappedRun[] = [];
  for (const t of texts.filter(t => inside(n, t))) {
    // as the svg: white on a solid fill (the second line too); the muted second line takes the plain colour on a soft fill; other
    // lines take the tone's text colour (blue on an accent node), where that colour is one a run can name
    const own = toneStyle(tones, n.tone).text;
    const tone = solid ? undefined : t.muted ? (soft ? undefined : 'muted' as const) : RUN_TONES.has(own) && own !== 'text' ? own as TextTone : undefined;
    const y = t.y - (n.y + NODE_TEXT_PAD_Y);
    const last = runs[runs.length - 1];
    if (last && last.size === t.size && (last.weight === 700) === t.bold && last.tone === tone) { last.lines.push(t.text); last.lineYs.push(y); last.text += t.text; continue; }
    runs.push({text: t.text, size: t.size, weight: t.bold ? 700 : 400, mono: false, ...(tone ? {tone} : {}), lines: [t.text], lineYs: [y]});
  }
  return runs;
}
