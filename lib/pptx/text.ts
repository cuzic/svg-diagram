import {escapeXml} from '../emit-common.ts';
import {runColorOf, textColorOf} from '../tokens.ts';
import type {ToneEnv} from '../tokens.ts';
import {LINE_HEIGHT_EM} from '../layout-util.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutBox} from '../types/text-bands.ts';
import {emu, hex, attr, solidFill, type Fonts} from './xml.ts';

type Run = LaidOutBox['wrappedRuns'][number];

/** Line pitch of a run: measured when it wraps, the nominal line height otherwise. */
export const pitchOf = (r: Run): number => r.lines.length > 1 ? r.lineYs[1]! - r.lineYs[0]! : Math.round(r.size * LINE_HEIGHT_EM);

export function runXml(text: string, size: number, bold: boolean, mono: boolean, color: string, fonts: Fonts): string {
  const face = mono ? fonts.mono : fonts.sans;
  const rpr = `<a:rPr lang="ja-JP" sz="${Math.round(size * 75)}" b="${bold ? 1 : 0}" kern="0" dirty="0">${solidFill(color)}<a:latin typeface="${attr(face)}"/><a:ea typeface="${attr(face)}"/></a:rPr>`;
  return `<a:r>${rpr}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

export function paragraphsOf(runs: Run[], boxTone: string | undefined, day: LaidOutDiagram['day'], tones: ToneEnv, align: string, fonts: Fonts): string {
  return runs.map((r, i) => {
    const pitch = pitchOf(r);
    const prev = i > 0 ? runs[i - 1]! : undefined;
    const before = prev ? Math.max(0, r.lineYs[0]! - prev.lineYs[prev.lineYs.length - 1]! - pitch) : 0;
    const base = hex(runColorOf(tones, r.tone, boxTone, day));
    const lines = r.lines.map((ln, k) => {
      const spans = r.lineSpans?.[k];
      const body = spans ? spans.map(sp => runXml(sp.text, r.size, sp.bold === true || r.weight === 700, r.mono, sp.tone ? hex(textColorOf(tones, sp.tone, day)) : base, fonts)).join('') : runXml(ln, r.size, r.weight === 700, r.mono, base, fonts);
      return (k ? `<a:br><a:rPr lang="ja-JP" sz="${Math.round(r.size * 75)}"/></a:br>` : '') + body;
    }).join('');
    // `indent` (room for a step badge / icon) narrows and shifts the whole run: every line of it (lib/emit-common.ts renderTextRuns)
    const ind = r.indent ? ` marL="${emu(r.indent)}"` : '';
    return `<a:p><a:pPr algn="${align}"${ind}><a:lnSpc><a:spcPts val="${Math.round(pitch * 75)}"/></a:lnSpc><a:spcBef><a:spcPts val="${Math.round(before * 75)}"/></a:spcBef></a:pPr>${lines}</a:p>`;
  }).join('');
}
