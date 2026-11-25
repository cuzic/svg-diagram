import {DARK_NOTE, mergeSides} from './appearance-auto.ts';
import {nestedBandsOf} from './band-children.ts';
import {band, DEF, defOf, walkDefinedBands} from './band-def.ts';
import {captionDefinition} from './bands/caption.ts';
import {connectDefinition} from './bands/connect.ts';
import {autoLegend} from './bands/legend.ts';
import {draftStatusFinding} from './bands/status.ts';
import {cloneData} from './clone-data.ts';
import {prepareBands} from './core.ts';
import type {BatchMeasurement} from './core.ts';
import {oneLine} from './diagram-description.ts';
import {documentAcceptHint, documentFindings} from './document-findings.ts';
import {at, findingAcceptanceHint, fromSources} from './finding-rules.ts';
import {resolveBoxStyle, resolveTextColor} from './emit-common.ts';
import {withNodeIds} from './emit-node-ids.ts';
import {applySpotlightWith} from './emit-spotlight.ts';
import {definitionFor, UNDEFINED_BANDS} from './full-definitions.ts';
import {withTitleLine} from './layout-caption-lines.ts';
import {legendFindings} from './legend-notation.ts';
import {midWordFindings} from './mid-word-findings.ts';
import {must} from './must.ts';
import {rowSlotStages} from './reveal-row.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {slideFitter, UNMEASURED_FILL_NOTE} from './slide-fill.ts';
import {dimmedBands, spotlighter} from './spotlight-core.ts';
import {atBand, sourceOf, withSource} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {statusText, withStatus} from './status.ts';
import {termFindings} from './term-rules.ts';
import {colorOf, paintOf, PALETTE, rolesAt, runColorOf, toneEnv, toneStyle, wcagRatio} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {DiagramData, EmphasisTone} from './types/core.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {BoxBand, CaptionBand} from './types/text-bands.ts';
import type {Finding} from './types/verdicts.ts';
import {fullWidthUnits} from './verify-caption.ts';
import {grayToneFindings} from './verify-gray-tones.ts';
import {xmlProblems} from './xml-check.ts';

type DefinedBand = Band & {readonly [DEF]: object};

/** @internal Copy legacy bands and add the missing definitions throughout the band tree. */
export function attachDefinitions(d: DiagramData): DefinedBand[] {
  const exclusions: Partial<Record<Band['type'], string>> = UNDEFINED_BANDS;
  function attach(data: Band): DefinedBand {
    if (!defOf(data)) {
      const definition = definitionFor(data);
      if (!definition) {
        const reason = exclusions[data.type] ?? '対応する種類の帯を使ってください';
        throw new Error(`帯「${data.type}」の定義がありません（${reason}）`);
      }
      Object.defineProperty(data, DEF, {value: definition, enumerable: true, writable: true, configurable: true});
    }
    for (const child of nestedBandsOf(data)) attach(child);
    return data as DefinedBand;
  }
  return cloneData(d.bands).map(data => atBand(data, () => attach(data)));
}

/** @internal Used by the parity report. The full adapter now handles all diagram settings. */
export function unsupportedCoreOptions(_diagram: DiagramData): string[] {
  return [];
}

type DrawOptions = Parameters<typeof prepareBands>[1];
type LegacyOptions = (Pick<Extract<DrawOptions, {measure: unknown}>, 'measure'> | BatchMeasurement) & {
  budget?: DrawOptions['slide'] | null;
  nodeIds?: boolean;
  html?: boolean;
};
type CoreFindings = NonNullable<DrawOptions['diagramFindings']>;
type LegacyServices = {
  spotlighter?: typeof spotlighter;
  fitter: typeof slideFitter;
  connectors: typeof connectDefinition;
  captions: typeof captionDefinition;
  autoLegend: typeof autoLegend;
};

export const legacySpotlighter: typeof spotlighter = {
  ...spotlighter,
  apply(diagram, definitionOf, scopes) {
    applySpotlightWith(diagram, laid => {
      const def = definitionOf(laid);
      return (def?.internal ? def.spotlightOutputs?.[laid.type] ?? def : def)?.spotlight;
    }, scopes, missing => {
      const inFigure = missing.find(id => diagram.laidOut.some(band =>
        'anchors' in band && band.anchors.some(anchor => qualify(scopeOf(band), anchor.id) === id)));
      if (inFigure) throw new Error(`diagram({spotlight}): "${inFigure}" is a node inside a figure; spotlight lights a whole figure, so give the figure an {id} and spotlight that (to light one branch of a tree or mindmap, write its focus: '${inFigure}')`);
      throw new Error(`diagram({spotlight}): unknown anchor id${missing.length > 1 ? 's' : ''} "${missing.join('", "')}"`);
    });
  },
};

const fullServices: LegacyServices = {
  spotlighter: legacySpotlighter, fitter: slideFitter, connectors: connectDefinition, captions: captionDefinition, autoLegend,
};

const placedLeaves = (d: LaidOutDiagram): LaidOutBand[] =>
  d.laidOut.flatMap(b => b.type === 'row' || b.type === 'grid' ? b.children : [b]);
const ratioText = (ratio: number): string => ratio.toFixed(1);

// The full entries also check document-wide rules that aggregate multiple bands.
function textContrast(d: LaidOutDiagram, tones: ToneEnv, out: Finding[]): void {
  const paint = paintOf(tones, d.appearance);
  const pairs = new Map<string, {finding: Finding; refs: Set<SourceRef>}>();
  const check = (band: LaidOutBand, fg: string | undefined, bg: string | undefined, what: string): void => {
    if (!fg || !bg) return;
    fg = paint(fg); bg = paint(bg);
    const need = 4.5, r = wcagRatio(fg, bg), key = `${fg}|${bg}`;
    if (r < need) {
      let pair = pairs.get(key);
      if (!pair) {
        pair = {refs: new Set(), finding: {rule: 'a11y-text-contrast', severity: 'warn', message: `${what} の文字 ${fg} と背景 ${bg} のコントラスト比が ${ratioText(r)}:1（4.5:1 以上が目安）`}};
        pairs.set(key, pair);
      }
      const ref = sourceOf(band);
      if (ref) pair.refs.add(ref);
    }
  };
  const boxes = placedLeaves(d);
  for (const b of boxes) {
    if (b.type === 'box' || b.type === 'banner') {
      const boxTone = b.tone ?? 'plain';
      const bg = b.dim ? PALETTE.bg : resolveBoxStyle(tones, boxTone, d.day).fill;
      for (const run of b.wrappedRuns ?? []) check(b, b.dim ? PALETTE.muted : runColorOf(tones, run.tone, boxTone, d.day), bg, `「${String(run.text).slice(0, 14)}」`);
      if (!b.dim) for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(b, resolveTextColor(tones, sp.tone, d.day), bg, `「${sp.text.slice(0, 14)}」`);
      if (b.tag) check(b, PALETTE.bg, colorOf(toneStyle(tones, b.tagTone === 'danger' || b.tagTone === 'muted' ? b.tagTone : 'accent').ink, d.day), `タグ「${b.tag}」`);
    } else if (b.type === 'caption') {
      for (const run of b.wrappedRuns ?? []) check(b, resolveTextColor(tones, run.tone, d.day), PALETTE.bg, `「${String(run.text).slice(0, 14)}」`);
      for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if (sp.tone) check(b, resolveTextColor(tones, sp.tone, d.day), PALETTE.bg, `「${sp.text.slice(0, 14)}」`);
    } else if (b.type === 'table') {
      if (b.titleBar) check(b, PALETTE.bg, PALETTE[d.day].accent, 'テーブルの題名帯');
      for (const row of b.rows) for (const c of row.cells) {
        const bg = row.header || (b.rowHeader && c === row.cells[0]) ? PALETTE[d.day].soft : row.tone ? resolveBoxStyle(tones, row.tone, d.day).fill : PALETTE.bg;
        if (c.lines.length) check(b, resolveTextColor(tones, c.tone, d.day), bg, `表のセル「${must(c.lines[0]).slice(0, 12)}」`);
      }
    }
  }
  for (const {finding, refs} of pairs.values()) out.push({...finding, ...fromSources(refs)});
}

// em.danger() / em.accent() without em.b(): the emphasis is the colour alone (WCAG 1.4.1). em.muted() softens, so it is not one.
function colourOnlyEmphasis(d: LaidOutDiagram, out: Finding[]): void {
  if (d.medium !== 'doc') return;
  const words: string[] = [], parts = new Set<LaidOutBand>();
  const boxes = placedLeaves(d);
  for (const b of boxes) {
    if (b.type !== 'box' && b.type !== 'banner' && b.type !== 'caption') continue;
    if (b.dim) continue;
    for (const run of b.wrappedRuns ?? []) for (const sp of run.spans ?? []) if ((sp.tone === 'danger' || sp.tone === 'accent') && !sp.bold) { words.push(`「${sp.text.slice(0, 14)}」`); parts.add(b); }
  }
  if (words.length) out.push({...fromSources([...parts].map(b => sourceOf(b))), rule: 'a11y-color-only-emphasis', severity: 'warn', message: `色だけで強調した語: ${words.slice(0, 6).join('')}${words.length > 6 ? ` ほか ${words.length - 6} 件` : ''}。em.b() も併用する`});
}

function nonTextContrast(d: LaidOutDiagram, tones: ToneEnv, out: Finding[]): void {
  const paint = paintOf(tones, d.appearance);
  const contrastRatio = (a: string, b: string) => wcagRatio(paint(a), paint(b));
  const used = new Map<EmphasisTone, BoxBand[]>();
  const dimmed = dimmedBands(d);
  for (const b of walkDefinedBands(d.bands)) if (b.type === 'box' && !dimmed.has(b)) {
    const tone = b.tone ?? 'plain', parts = used.get(tone) ?? [];
    parts.push(b);
    used.set(tone, parts);
  }
  for (const [t, parts] of used) {
    const st = resolveBoxStyle(tones, t, d.day);
    // a tone with no border of its own (solid) is drawn with its fill as the stroke: the fill against the page is what delimits it
    const ts = toneStyle(tones, t), own = typeof d.day === 'string' ? ts.stroke : ts.slideStroke ?? ts.stroke;
    const r = own == null ? contrastRatio(st.fill, PALETTE.bg) : Math.min(contrastRatio(st.stroke, st.fill), contrastRatio(st.stroke, PALETTE.bg));
    if (r < 3) out.push({...at(parts[0], ...parts.slice(1)), rule: 'a11y-nontext-contrast', severity: 'warn', message: `トーン「${t}」の枠線 ${st.stroke} が、背景に対して ${ratioText(r)}:1（3:1 以上が目安）。タグや文言など、色以外の手がかりを必ず併用する`});
  }
  let firstArrow: {col: string; r: number} | undefined;
  const arrowRefs: SourceRef[] = [];
  for (const c of d.connects ?? []) {
    // connector colours are resolved the same way emit does
    const col = c.dim ? PALETTE.muted : c.tone === 'muted' || c.tone === 'danger' || c.tone === 'accent' ? colorOf(toneStyle(tones, c.tone).ink, d.day) : PALETTE.text;
    const r = contrastRatio(col, PALETTE.bg);
    if (r < 3) {
      firstArrow ??= {col, r};
      if (col !== firstArrow.col) continue;
      const ref = sourceOf(c);
      if (ref) arrowRefs.push(ref);
    }
  }
  if (firstArrow) out.push({...fromSources(arrowRefs), rule: 'a11y-nontext-contrast', severity: 'warn', message: `矢印の色 ${firstArrow.col} のコントラスト比が ${ratioText(firstArrow.r)}:1`});
}

const HEADLINE_BUDGET_PX = 600;
// a headline line over the budget (a guide in full-width characters: what fits a 600px text column), or one the layout had to wrap
function headlineLength(d: LaidOutDiagram, out: Finding[]): void {
  // The guide uses document sizes at 1x, regardless of the laid-out scale.
  const {title, banner, stat, display} = rolesAt(false, 1);
  const sizes = {title, banner, stat, display};
  const isHeadlineRole = (r: string | undefined): r is keyof typeof sizes => r != null && Object.hasOwn(sizes, r);
  const seen = new Map<SourceRef | undefined, Set<string>>();
  const seenFor = (band: Band | LaidOutBand): Set<string> => {
    const loc = sourceOf(band);
    let lines = seen.get(loc);
    if (!lines) { lines = new Set(); seen.set(loc, lines); }
    return lines;
  };
  const flag = (band: Band | LaidOutBand, line: string, message: string): void => {
    const lines = seenFor(band);
    if (!lines.has(line)) { lines.add(line); out.push({...at(band), rule: 'cjk-line-long', severity: 'warn', message}); }
  };
  const quote = (line: string): string => { const t = line.trim(); return [...t].length > 16 ? `${[...t].slice(0, 16).join('')}…` : t; };
  const check = (band: Band, text: string, role: keyof typeof sizes): void => {
    const budget = Math.floor(HEADLINE_BUDGET_PX / sizes[role]);
    for (const line of text.split('\n')) {
      const u = fullWidthUnits(line.trim());
      if (u > budget) flag(band, line, `見出しの 1 行が全角 ${Math.ceil(u)} 字ぶんで、${budget} 字の目安（${role}。本文幅 ${HEADLINE_BUDGET_PX}px に収まる字数）を超える: 「${quote(line)}」。短くするか、改行して分ける`);
    }
  };
  for (const b of walkDefinedBands(d.bands)) {
    if (b.type === 'caption' && !b.sourceLine && !b.titleLine && isHeadlineRole(b.role)) check(b, b.text, b.role);
    else if (b.type === 'banner') check(b, b.headline, b.headlineRole ?? 'banner');
  }
  // under the budget but still wrapped by the layout (a narrow diagram, a banner in a row): the break falls anywhere, even inside a word
  const laid = placedLeaves(d);
  for (const b of laid) {
    const head = b.type === 'caption' && !b.sourceLine && isHeadlineRole(b.role) ? b.text : b.type === 'banner' ? b.headline : null;
    const run = head != null ? (b as {wrappedRuns: {text: string; lines: string[]}[]}).wrappedRuns[0] : undefined;
    if (head == null || !run) continue;
    const given = head.split('\n');
    if (run.lines.length > given.length && !given.some(l => seenFor(b).has(l))) flag(b, head, `見出しが幅に収まらず、${run.lines.length} 行に自動で折り返している: 「${quote(must(given[0]))}」。短くするか、区切りのよいところで改行する`);
  }
}

const legacyDiagramFindings: CoreFindings = (diagram, _stage, definitionOf) => {
  const bands = walkDefinedBands(diagram.bands);
  const worded = new Set(bands.flatMap(data => defOf(data)?.verify?.wordedChildren?.(data) ?? []));
  const samples = [
    ...bands.filter(data => !worded.has(data)).map(data => [data, defOf(data)?.verify?.tones?.(data) ?? []] as const),
    ...diagram.laidOut.map(laid => [laid, definitionOf(laid)?.verify?.layoutTones?.(laid as never) ?? []] as const),
  ];
  const tones = toneEnv(diagram.tones);
  const colorFindings = (side: LaidOutDiagram) => {
    const out: Finding[] = [];
    textContrast(side, tones, out);
    colourOnlyEmphasis(side, out);
    nonTextContrast(side, tones, out);
    return [...out, ...grayToneFindings(side, tones, samples)];
  };
  const colors = diagram.appearance === 'auto'
    ? mergeSides(
      colorFindings({...diagram, appearance: 'light'}),
      colorFindings({...diagram, appearance: 'dark'}),
      finding => finding.message, finding => ({...finding, message: `${finding.message} (${DARK_NOTE})`}),
    )
    : colorFindings(diagram);
  const notation = diagram.legend === false ? [] : bands.flatMap(data => defOf(data)?.verify?.legendNotation?.(data) ?? []);
  const evidence = diagram.evidenceCheck === undefined ? [] : bands.flatMap(b =>
    b.type === 'box' && b.statValue !== undefined && !b.evidence
      ? [{...at(b), rule: 'stat-no-source', severity: diagram.evidenceCheck === 'strict' ? 'warn' as const : 'info' as const, message: `数字 ${b.statValue} に出典がない(stat の source を足す)`}]
      : []);
  const length: Finding[] = [];
  headlineLength(diagram, length);
  return [...colors, ...legendFindings(notation, worded, diagram.legendLabels, dimmedBands(diagram)),
    ...termFindings(diagram.bands, diagram.terms), ...documentFindings(diagram), ...evidence, ...midWordFindings(diagram), ...length,
    ...(diagram.status && diagram.accept?.['draft-status'] ? [draftStatusFinding(diagram.status)] : [])];
};

function legacyDiagramAcceptHint(rule: string): string | undefined {
  if (rule === 'gray-tone-collision' || rule === 'legend-missing' || rule === 'legend-incomplete' || rule === 'concentric-label-crossing'
    || rule === 'stat-no-source' || rule === 'term-variant' || rule === 'term-avoid'
    || rule === 'cjk-line-long' || rule === 'text-mid-word-break'
    || /^(?:a11y-|toc-|fta-|isisnot-|whywhy-|bowtie-|layout-|edge-)/.test(rule)) return findingAcceptanceHint(rule);
  return documentAcceptHint(rule);
}

function generatedBands(data: Band): DefinedBand[] {
  if (data.type !== 'grid' || !data.canvas?.title) return [];
  // Recreate the heading that layoutCanvasGrid places ahead of its region boxes.
  const heading: CaptionBand = {type: 'caption', text: data.canvas.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false};
  return [band(captionDefinition, heading)];
}

/** @internal Lay out and check a full-entry diagram using the band definitions. */
export async function prepareLegacyDiagramWithCore(d: DiagramData, options: LegacyOptions, services: LegacyServices = fullServices) {
  // Core normally prepends the visible title. A draft badge must come before it.
  const bands = attachDefinitions(d.status === undefined ? d : withStatus(withTitleLine(d)));
  // A legacy diagram can override the canvas width. Core takes the width from the canvas itself.
  const canvas = d.canvas && {...d.canvas, width: d.width};
  const slide = options.budget ?? undefined;
  const prepared = await prepareBands(bands, {
    ...options, diagramData: d, generatedBands, theme: d.day, width: canvas ? undefined : d.fitWidth ? 'fit' : d.width, maxWidth: d.maxWidth,
    slide, fill: d.fill && slide !== undefined, fitter: services.fitter, minEffectiveFont: d.minEffectiveFont,
    pad: d.pad, gap: d.gap, legend: d.legend, spotlight: d.spotlight, spotlighter: services.spotlighter, legendLabels: d.legendLabels, accept: d.accept, canvas, appearance: d.appearance,
    transparent: d.transparent, tocCheck: d.tocCheck, rcaCheck: d.rcaCheck, layoutCheck: d.layoutCheck,
    diagramFindings: legacyDiagramFindings, diagramAcceptHint: legacyDiagramAcceptHint,
    addAutoLegend(diagram) {
      const source = diagram.bands;
      const automatic = services.autoLegend(source, diagram.legendLabels, dimmedBands(diagram));
      if (!automatic) return;
      const existing = source.find(data => data.type === 'legend');
      if (existing) existing.items.push(...automatic.items);
      else source.push(withSource(automatic, sourceOf(d)));
    },
    density: d.density, tones: d.tones, wrap: d.wrap, keepWords: d.keepWords, today: d.today,
    title: d.title, desc: d.desc ? oneLine(d.desc) : undefined,
    formatDescription: d.status === undefined ? undefined : text => `(${statusText(d)})${text ? ` ${text}` : ''}`,
    revealAnchorSlots: data => data.type === 'row' || data.type === 'grouprow' ? rowSlotStages(data) : [],
    showTitle: d.status === undefined && d.showTitle, sourceLine: d.sourceLine,
    captions: services.captions,
    // Also enables connectors generated by loopBack, even when the source has no connect bands.
    connectors: services.connectors,
  });
  const loc = sourceOf(d);
  if (loc) prepared.verdict.findings = prepared.verdict.findings.map(finding => finding.loc ? finding : {...finding, loc});
  return prepared;
}

/** @internal Draw a full-entry diagram using the band definitions. */
export async function renderLegacyDiagramWithCore(d: DiagramData, options: LegacyOptions, services?: LegacyServices) {
  const {placed: laidOut, stage, verdict, emit, fit, fontScale} = await prepareLegacyDiagramWithCore(d, options, services);
  if (options.html && d.appearance === 'auto') throw new Error("diagram({appearance: 'auto'}) is SVG only: the HTML form paints with style attributes, which a media rule cannot override (drop html / --html, or use 'dark')");
  const svg = emit(options.nodeIds ? withNodeIds(laidOut) : laidOut);
  const notes = d.fill && options.budget == null ? [UNMEASURED_FILL_NOTE] : [];
  return {svg, width: laidOut.width, height: laidOut.canvasHeight, xml: xmlProblems(svg), laidOut, verdict, fit, fontScale,
    stage, emit, unsupported: unsupportedCoreOptions(d), notes};
}
