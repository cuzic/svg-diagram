import {DARK_NOTE, mergeSides} from './appearance-auto.ts';
import {nestedBandsOf} from './band-children.ts';
import {band, DEF, defOf, walkDefinedBands} from './band-def.ts';
import {captionDefinition} from './bands/caption.ts';
import {connectDefinition} from './bands/connect.ts';
import {autoLegend} from './bands/legend.ts';
import {cloneData} from './clone-data.ts';
import {renderBands} from './core.ts';
import {documentAcceptHint, documentFindings} from './document-findings.ts';
import {findingAcceptanceHint} from './finding-rules.ts';
import {definitionFor, UNDEFINED_BANDS} from './full-definitions.ts';
import {withTitleLine} from './layout-caption-lines.ts';
import {legendFindings} from './legend-notation.ts';
import {sourceOf, withSource} from './source-ref.ts';
import {withStatus} from './status.ts';
import {toneEnv} from './tokens.ts';
import type {DiagramData} from './types/core.ts';
import type {Band} from './types/index.ts';
import type {CaptionBand} from './types/text-bands.ts';
import {grayToneFindings} from './verify-gray-tones.ts';

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
  return cloneData(d.bands).map(attach);
}

/** @internal Identify drawing and checking settings the core cannot receive. */
export function unsupportedCoreOptions(d: DiagramData): string[] {
  const unsupported: string[] = [];
  if (d.medium !== 'doc') unsupported.push('medium');
  if (d.fill) unsupported.push('fill');
  for (const key of [
    'slide', 'spotlight', 'maxDisplayHeight', 'minEffectiveFont', 'usableWidth', 'source',
    'terms', 'evidenceCheck',
  ] as const) {
    if (d[key] !== undefined) unsupported.push(key);
  }
  return unsupported;
}

type MeasureOptions = Pick<Parameters<typeof renderBands>[1], 'measure'>;
type CoreFindings = NonNullable<Parameters<typeof renderBands>[1]['diagramFindings']>;

const legacyDiagramFindings: CoreFindings = (diagram, stage, definitionOf) => {
  const bands = walkDefinedBands(diagram.bands);
  const worded = new Set(bands.flatMap(data => defOf(data)?.verify?.wordedChildren?.(data) ?? []));
  const samples = [
    ...bands.filter(data => !worded.has(data)).map(data => [data, defOf(data)?.verify?.tones?.(data) ?? []] as const),
    ...diagram.laidOut.map(laid => [laid, definitionOf(laid)?.verify?.layoutTones?.(laid as never) ?? []] as const),
  ];
  const tones = toneEnv(diagram.tones);
  const gray = diagram.appearance === 'auto'
    ? mergeSides(
      grayToneFindings({...diagram, appearance: 'light'}, tones, samples),
      grayToneFindings({...diagram, appearance: 'dark'}, tones, samples),
      finding => finding.message, finding => ({...finding, message: `${finding.message} (${DARK_NOTE})`}),
    )
    : grayToneFindings(diagram, tones, samples);
  const notation = diagram.legend === false ? [] : bands.flatMap(data => defOf(data)?.verify?.legendNotation?.(data) ?? []);
  return [...documentFindings(diagram, stage), ...gray, ...legendFindings(notation, worded, diagram.legendLabels)];
};

function legacyDiagramAcceptHint(rule: string): string | undefined {
  if (rule === 'gray-tone-collision' || rule === 'legend-missing' || rule === 'legend-incomplete' || rule === 'concentric-label-crossing'
    || /^(?:toc-|fta-|isisnot-|whywhy-|bowtie-|layout-|edge-)/.test(rule)) return findingAcceptanceHint(rule);
  return documentAcceptHint(rule);
}

function generatedBands(data: Band): DefinedBand[] {
  if (data.type !== 'grid' || !data.canvas?.title) return [];
  // Recreate the heading that layoutCanvasGrid places ahead of its region boxes.
  const heading: CaptionBand = {type: 'caption', text: data.canvas.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false};
  return [band(captionDefinition, heading)];
}

/** @internal Try the definition-based SVG path with the settings it currently supports. */
export async function renderLegacyDiagramWithCore(d: DiagramData, {measure}: MeasureOptions) {
  const unsupported = unsupportedCoreOptions(d);
  // Core normally prepends the visible title. A draft badge must come before it.
  const bands = attachDefinitions(d.status === undefined ? d : withStatus(withTitleLine(d)));
  // A legacy diagram can override the canvas width. Core takes the width from the canvas itself.
  const canvas = d.canvas && {...d.canvas, width: d.width};
  const result = await renderBands(bands, {
    measure, generatedBands, theme: d.day, width: canvas ? undefined : d.fitWidth ? 'fit' : d.width, maxWidth: d.maxWidth,
    pad: d.pad, gap: d.gap, legend: d.legend, legendLabels: d.legendLabels, accept: d.accept, canvas, appearance: d.appearance,
    transparent: d.transparent, tocCheck: d.tocCheck, rcaCheck: d.rcaCheck, layoutCheck: d.layoutCheck,
    diagramFindings: legacyDiagramFindings, diagramAcceptHint: legacyDiagramAcceptHint,
    addAutoLegend(source, labels) {
      const automatic = autoLegend(source, labels);
      if (!automatic) return;
      const existing = source.find(data => data.type === 'legend');
      if (existing) existing.items.push(...automatic.items);
      else source.push(withSource(automatic, sourceOf(d)));
    },
    density: d.density, tones: d.tones, wrap: d.wrap, keepWords: d.keepWords, today: d.today,
    title: d.title, desc: d.desc, showTitle: d.status === undefined && d.showTitle, sourceLine: d.sourceLine,
    captions: d.title !== undefined || d.sourceLine !== undefined ? captionDefinition : undefined,
    // Also enables connectors generated by loopBack, even when the source has no connect bands.
    connectors: connectDefinition,
  });
  return {...result, unsupported};
}
