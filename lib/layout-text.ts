// How a band's text is cut up: the text runs of caption / banner / box, the atoms (and spans) a run is measured and wrapped in,
// and the wrapped content of a box-like band. One place, so what is registered for measuring is what layout looks up.

import {splitAtoms, textWidth} from './atoms.ts';
import {wrapStyledAtoms} from './wrap.ts';
import {assertSpans} from './rich.ts';
import {isSolidTone} from './tokens.ts';
import {BOX_INNER_GAP, ICON_INDENT, LINE_HEIGHT_EM, STEP_INDENT, topIcon} from './layout-util.ts';
import type {Band, FontWeight, Roles, Span, TextRun, TextTone, WidthOf, WrappedRun} from './types.ts';

import {must} from './must.ts';
/** `run` with the pieces of its text attached, when it has any (a plain run stays exactly as it was). */
export function withSpans(run: TextRun, spans: Span[] | undefined): TextRun {
  if (!spans) return run;
  assertSpans(run.text, spans, `text "${run.text.slice(0, 20)}"`); // add() takes a band as it is: hand-made spans may not match
  if (run.nowrap) throw new Error(`"${run.text.slice(0, 20)}" cannot have spans: a stat value is one unbroken string`);
  return {...run, spans};
}

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
type TextRunsOf<B> = (band: B, roles: Roles) => TextRun[];
/** Per band type that has wrapped text runs of its own (the box-like ones; every other type draws its text itself). */
type TextRunTable = {[T in Band['type']]?: TextRunsOf<BandOf<T>>};

const captionRuns: TextRunsOf<BandOf<'caption'>> = (band, roles) =>
  [withSpans({text: band.text, size: roles[band.role ?? 'label'], weight: band.bold ? 700 : 400, mono: !!band.mono, tone: band.tone}, band.spans?.text)];

const bannerRuns: TextRunsOf<BandOf<'banner'>> = (band, roles) => {
  const runs: TextRun[] = [withSpans({text: band.headline, size: roles[band.headlineRole ?? 'banner'], weight: 700, mono: false, tone: band.headlineTone}, band.spans?.headline)];
  if (band.sub) runs.push(withSpans({text: band.sub, size: roles.note, weight: 400, mono: false, tone: band.subTone ?? (isSolidTone(band.tone) ? undefined : 'muted')}, band.spans?.sub));
  return runs;
};

const boxRuns: TextRunsOf<BandOf<'box'>> = (band, roles) => {
  const runs: TextRun[] = [];
  const iconIndent = band.icon && !topIcon(band) ? {indent: ICON_INDENT} : {}; // (spread, so a box without an icon gets no new field)
  if (band.title) runs.push(withSpans({text: band.title, size: roles.title, weight: 700, mono: !!band.titleMono, tone: band.titleTone, indent: (band.step != null ? STEP_INDENT : 0) + (band.icon && !topIcon(band) ? ICON_INDENT : 0)}, band.spans?.title));
  if (band.body) runs.push(withSpans({text: band.body, size: roles.body, weight: 400, mono: !!band.bodyMono, tone: band.bodyTone, ...iconIndent}, band.spans?.body));
  if (band.lines) for (const l of band.lines) {
    const line: Exclude<typeof l, string> = typeof l === 'string' ? {text: l} : l;
    runs.push(withSpans({text: line.text, size: roles[line.role ?? 'body'], weight: line.bold ? 700 : 400, mono: !!line.mono, tone: line.tone, nowrap: band.statValue === line.text && runs.length === 0, ...iconIndent}, line.spans));
  }
  if (band.note) runs.push(withSpans({text: band.note, size: roles.note, weight: 400, mono: false, tone: band.noteTone ?? (isSolidTone(band.tone) ? undefined : 'muted'), ...iconIndent}, band.spans?.note));
  return runs;
};

export const TEXT_RUNS = {caption: captionRuns, banner: bannerRuns, box: boxRuns} satisfies TextRunTable;

/** The text runs of a band's own text (none for a type that is not in TEXT_RUNS). */
export function textRuns(band: Band, roles: Roles): TextRun[] {
  return ((TEXT_RUNS as TextRunTable)[band.type] as TextRunsOf<Band> | undefined)?.(band, roles) ?? [];
}

/** An atom of a run's text with the weight (and tone) it is drawn in; `glue`: it continues the atom before it (see wrapStyledAtoms). */
export interface StyledAtom {text: string; weight: FontWeight; tone?: TextTone; glue?: boolean}

/**
 * The atoms of a run, each with its own weight: the ONE place a run is cut up for measuring, wrapping and the width of a line,
 * so what is registered is what is looked up. The plain text is cut as ever (splitAtoms); an atom that a span boundary falls
 * inside ('API' | 's') is cut there into pieces, each continuing the one before it, so it is measured per piece but never
 * broken between lines.
 */
export function styledAtoms(run: TextRun): StyledAtom[] {
  const atoms = splitAtoms(run.text);
  if (!run.spans) return atoms.map(text => ({text, weight: run.weight}));
  const spanAt: number[] = [];
  run.spans.forEach((sp, i) => { for (let k = 0; k < sp.text.length; k++) spanAt.push(i); });
  const out: StyledAtom[] = [];
  let at = 0;
  for (const atom of atoms) {
    for (let from = 0, to = 1; from < atom.length; from = to, to = from + 1) {
      const i = must(spanAt[at + from]);
      while (to < atom.length && spanAt[at + to] === i) to++;
      const sp = must(run.spans[i]);
      out.push({text: atom.slice(from, to), weight: sp.bold ? 700 : run.weight, tone: sp.tone, ...(from > 0 ? {glue: true} : {})});
    }
    at += atom.length;
  }
  return out;
}

/** The pieces of one wrapped line (neighbouring atoms of one weight and tone make one span). */
function lineSpans(run: TextRun, atoms: StyledAtom[]): Span[] {
  const out: Span[] = [];
  for (const a of atoms) {
    const bold = a.weight !== run.weight, last = out[out.length - 1];
    if (last && !!last.bold === bold && last.tone === a.tone) last.text += a.text;
    else out.push({text: a.text, ...(bold ? {bold: true} : {}), ...(a.tone ? {tone: a.tone} : {})});
  }
  return out;
}

/** Width of line `i` of a wrapped run: its atoms' widths added (the pieces of a line with spans, each in its own weight). */
export function lineWidth(widthOf: WidthOf, run: WrappedRun, i: number): number {
  const font = run.mono ? 'mono' : 'sans';
  return run.lineSpans
    ? must(run.lineSpans[i]).reduce((w, sp) => w + textWidth(widthOf, sp.text, run.size, sp.bold ? 700 : run.weight, font), 0)
    : textWidth(widthOf, must(run.lines[i]), run.size, run.weight, font);
}

// Wraps a box-like band's text runs at `wrapWidth` (content width, i.e.
// already excluding BOX_PAD_X*2) and returns {wrappedRuns, textHeight}.
export function layoutBoxContent(band: Band, wrapWidth: number, widthOf: WidthOf, roles: Roles): {wrappedRuns: WrappedRun[]; textHeight: number} {
  let relY = 0;
  const wrappedRuns = textRuns(band, roles).map((run): WrappedRun => {
    const font = run.mono ? 'mono' : 'sans';
    const indent = run.indent ?? 0;
    const atomLines = run.nowrap ? null : wrapStyledAtoms(styledAtoms(run), {maxWidth: wrapWidth - indent, atomWidth: a => widthOf(a.text, run.size, a.weight, font)});
    const lines = atomLines ? atomLines.map(l => l.map(a => a.text).join('')) : [run.text];
    const lineYs = lines.map(() => {
      relY += run.size;
      const y = relY;
      relY += run.size * (LINE_HEIGHT_EM - 1);
      return y;
    });
    relY += BOX_INNER_GAP;
    return {...run, lines, lineYs, ...(run.spans && atomLines ? {lineSpans: atomLines.map(l => lineSpans(run, l))} : {})};
  });
  const textHeight = Math.max(0, relY - BOX_INNER_GAP);
  return {wrappedRuns, textHeight};
}
