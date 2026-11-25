import {buildInventoryWith, whole} from './inventory-core.ts';
import {joinBandDescriptions} from './diagram-description.ts';
import {definedDiagramTitle} from './diagram-title.ts';
import {applyFindingAcceptance, at} from './finding-rules.ts';
import {canvasFindings} from './canvas-findings.ts';
import {splitAtoms} from './atoms.ts';
import {band, defOf, DEF, EXTERNAL, walkDefinedBands} from './band-def.ts';
import {cloneData} from './clone-data.ts';
import {emitSvgWith} from './emit-svg-core.ts';
import {analyzeDocumentFit} from './fit.ts';
import type {layoutBoxLike} from './layout-box-like.ts';
import type {fitLineScale} from './layout-cause-fit.ts';
import {createLayoutWith} from './layout-core.ts';
import {layoutFitted} from './layout-fit-width.ts';
import {basicExtentOf, figureMetricsForExtent, unionOf} from './figure-metrics.ts';
import {addScoped, emptyScopes} from './scope-table.ts';
import {qualify, scopeOf} from './scope-name.ts';
import type {slideFitter} from './slide-fill.ts';
import {atBand, sourceOf} from './source-ref.ts';
import type {spotlighter} from './spotlight-core.ts';
import {ownRect, scopedRect} from './verify-rects.ts';
import {verifyWithServices} from './verify-core.ts';
import type {BandDef, VerifyCtx} from './band-def.ts';
import type {CaptionBand, LaidOutCaption} from './types/text-bands.ts';
import type {ConnectBand, LaidOutConnect} from './types/containers.ts';
import {must} from './must.ts';
import {checked, visibleAt} from './reveal-visibility.ts';
import type {RevealAnchor, RevealElements, RevealWarningCheck} from './reveal-warnings.ts';
import {checkToday} from './today-auto.ts';
import {canvasFontScale, checkMinText, checkTones, colorOf, rolesAt, SLIDE_CANVAS, THEMES, toneEnv} from './tokens.ts';
import type {Appearance, FontFamily, Measured, MeasureRequest, DiagramData, RevealOpts, SlideCanvas, Theme, WidthOf} from './types/core.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Finding, Issue} from './types/verdicts.ts';
import {xmlProblems} from './xml-check.ts';

export type {BandDef} from './band-def.ts';

type DefinedBand = {type: string; id?: string; readonly [DEF]: object} & RevealOpts;
type Measure = (request: Required<MeasureRequest>) => Measured | Promise<Measured>;
/** @internal Measure the complete set of text atoms with a project backend. */
export type BatchMeasurement = {measureBatch: (requests: Map<string, Required<MeasureRequest>>) => Promise<ReadonlyMap<string, Measured>>};
type Options = {measure: Measure} & DrawOptions;
type DrawOptions = {
  width?: number | 'fit';
  slide?: {maxHeight: number; contentWidth: number};
  fill?: boolean;
  fitter?: typeof slideFitter;
  /** @internal Effective slide text floor from a legacy diagram. */
  minEffectiveFont?: number;
  maxWidth?: number;
  legend?: DiagramData['legend'];
  spotlight?: DiagramData['spotlight'];
  spotlighter?: typeof spotlighter;
  accept?: DiagramData['accept'];
  diagramFindings?: (diagram: LaidOutDiagram, stage: number, definitionOf: (band: LaidOutBand) => BandDef | undefined) => Finding[];
  diagramAcceptHint?: (rule: string) => string | undefined;
  pad?: number;
  gap?: number;
  theme?: Theme;
  tones?: Parameters<typeof toneEnv>[0];
  wrap?: DiagramData['wrap'];
  keepWords?: boolean;
  title?: string;
  desc?: string;
  appearance?: Appearance;
  transparent?: boolean;
  tocCheck?: DiagramData['tocCheck'];
  rcaCheck?: DiagramData['rcaCheck'];
  layoutCheck?: DiagramData['layoutCheck'];
  legendLabels?: DiagramData['legendLabels'];
  /** @internal Append or extend a legend after generated connectors are present. */
  addAutoLegend?: (diagram: DiagramData) => void;
  density?: DiagramData['density'];
  showTitle?: boolean;
  sourceLine?: string;
  captions?: BandDef<CaptionBand, LaidOutCaption>;
  /** @internal Layout-generated children supplied by the full renderer. */
  generatedBands?: (data: Band) => readonly Band[];
  canvas?: Partial<SlideCanvas>;
  today?: string;
  stage?: number;
  connectors?: BandDef<ConnectBand, LaidOutConnect>;
};

type PreparationOptions = DrawOptions & ({measure: Measure} | BatchMeasurement) & {
  /** Diagram fields that travel with a full entry's laid-out result. */
  diagramData?: Omit<DiagramData, 'bands'>;
  /** Format the description after the defined bands supply it. */
  formatDescription?: (description: string) => string;
  /** Add reveal timing for synthetic anchors after visiting the band's children. */
  revealAnchorSlots?: (band: Band) => Iterable<readonly [string, RevealAnchor]>;
};

function size(name: string, value: number, min: number): number {
  if (!Number.isFinite(value) || value < min) throw new Error(`renderBands: ${name} must be finite and at least ${min}`);
  return value;
}

const keyOf = (text: string, size: number, weight: number, font: string): string => JSON.stringify([text, size, weight, font]);

function definitionKey(band: Band | LaidOutBand): string {
  if (band.type === 'chart') return `chart:${band.kind}`;
  if (band.type === 'screens' && (('matrix' in band && band.matrix) || ('layoutKind' in band && band.layoutKind === 'matrix'))) return 'screens:matrix';
  return band.type;
}

/** @internal Shared layout and SVG emission for selective output formats. */
export async function prepareBands(bands: readonly DefinedBand[], opts: PreparationOptions) {
  const canvas = opts.canvas === undefined ? undefined : {...SLIDE_CANVAS, ...opts.canvas};
  const {slide, fill, fitter, spotlighter} = opts;
  if (opts.spotlight !== undefined && !spotlighter) {
    throw new Error('renderBands: spotlight には svg-diagram/spotlight の spotlighter を spotlighter に指定してください');
  }
  if ((slide || fill) && !fitter) {
    throw new Error('renderBands: slide または fill には svg-diagram/slide-fill の slideFitter を fitter に指定してください');
  }
  if (fill && !slide) throw new Error('renderBands: fill には slide: {maxHeight, contentWidth} を指定してください');
  if (slide) {
    if (canvas || opts.width === 'fit') throw new Error("renderBands: slide を使う場合は canvas と width: 'fit' を外してください");
    size('slide.maxHeight', slide.maxHeight, 0);
    size('slide.contentWidth', slide.contentWidth, 1);
  }
  if (canvas) {
    if (opts.width !== undefined) throw new Error('renderBands: use canvas.width when canvas is set');
    checkMinText(canvas.minText, 'renderBands({canvas})');
    size('canvas height', canvas.height, 1);
  }
  const geometryScale = canvas ? canvasFontScale(canvas.minText) : 1;
  const requestedWidth = opts.width;
  const fitWidth = requestedWidth === 'fit';
  const width = size('width', fill && slide ? slide.contentWidth : fitWidth ? opts.diagramData?.width ?? 940 : requestedWidth ?? canvas?.width ?? 940, 1);
  const pad = size('pad', opts.pad ?? 20, 0);
  const gap = size('gap', opts.gap ?? 16, 0);
  const contentWidth = width - 2 * pad * geometryScale;
  size('content width', contentWidth, 1);
  const theme = opts.theme ?? 'blue';
  if (!THEMES.includes(String(theme))) throw new Error(`renderBands: unknown theme "${theme}"`);
  const tones = opts.tones === undefined ? undefined : checkTones(opts.tones, 'renderBands');
  const today = opts.today === undefined ? undefined : checkToday(opts.today, 'renderBands({today})');
  if (opts.stage !== undefined && (!Number.isInteger(opts.stage) || opts.stage < 0)) throw new Error('renderBands: stage must be a nonnegative integer');

  const measureBands: Band[] = [];
  const unscaledRoles = fill ? rolesAt(false, 1) : undefined;
  let largestFillText = 0;
  const ids = new Map<string, RevealAnchor>();
  const endpointChecks: RevealWarningCheck[] = [];
  const definitions = new Map<string, BandDef>();
  const syntheticOutputs = new Map<string, BandDef>();
  const scopeTable = emptyScopes();
  let last = 0;
  const revealWarnings: string[] = [];
  const diagramChecks = new Set<NonNullable<DrawOptions['diagramFindings']>>();
  const inputChecks: ((ctx: VerifyCtx) => Finding[])[] = [];
  const source = cloneData(bands) as unknown as Band[];
  const authored = opts.diagramData;
  const data: DiagramData = {
    ...authored,
    day: theme, medium: authored?.medium ?? (slide ? 'slide' : 'doc'), width, maxWidth: opts.maxWidth, accept: opts.accept, legend: opts.legend, pad, gap,
    maxDisplayHeight: slide?.maxHeight ?? authored?.maxDisplayHeight, usableWidth: slide?.contentWidth ?? authored?.usableWidth, minEffectiveFont: opts.minEffectiveFont,
    fill: authored?.fill ?? (fill === true), spotlight: opts.spotlight, bands: source, title: opts.title, desc: opts.desc, wrap: opts.wrap, keepWords: opts.keepWords, tones, canvas,
    appearance: opts.appearance, transparent: opts.transparent, density: opts.density, ...(fitWidth ? {fitWidth: true} : {}),
    tocCheck: opts.tocCheck, rcaCheck: opts.rcaCheck, layoutCheck: opts.layoutCheck, legendLabels: opts.legendLabels,
  };
  let nextLoopId = 0;
  const expandLoopBacks = (bands: Band[]): Band[] => bands.flatMap(data => {
    const def = defOf(data);
    if (def?.internal) def.mapLoopBackChildren?.(data, expandLoopBacks);
    const loop = def?.loopBackSource?.(data);
    if (!loop) return [data];
    const connector = opts.connectors;
    if (!connector?.internal || !connector.loopBackConnectors) {
      throw new Error('renderBands: loopBack には bands/connect の connectDefinition を connectors に指定してください');
    }
    return [data, ...connector.loopBackConnectors(data as Band & {id?: string}, loop, () => `__loopback${nextLoopId++}`)
      .map(link => band(connector, link))];
  });
  data.bands = expandLoopBacks(source);
  if (opts.legend === 'auto') opts.addAutoLegend?.(data);
  if (opts.showTitle && opts.title || opts.sourceLine !== undefined) {
    const captions = opts.captions;
    if (!captions?.internal || !captions.decorateCaptions) {
      throw new Error('renderBands: pass captionDefinition as captions for showTitle or sourceLine');
    }
    data.bands = captions.decorateCaptions({...data, showTitle: opts.showTitle, sourceLine: opts.sourceLine});
  }
  let placeBox: typeof layoutBoxLike | undefined;
  let fitLayout: typeof fitLineScale | undefined;
  function collect(data: Band, inheritedStart = 0, inheritedEnd = Infinity): void {
    const def = defOf(data);
    if (!def || def.type !== data.type || def[EXTERNAL] || data.type.includes(':')) {
      throw new Error(`renderBands: import the supported band "${data.type}" from its svg-diagram/bands entry`);
    }
    const key = definitionKey(data);
    if (definitions.has(key) && definitions.get(key) !== def) {
      throw new Error(`renderBands: mixed definitions for "${data.type}"`);
    }
    definitions.set(key, def);
    if (def.internal) {
      placeBox ??= def.layoutBoxLike;
      fitLayout ??= def.fitLineScale;
      for (const type of def.outputTypes ?? []) syntheticOutputs.set(type, def);
    }
    const reveal = data as RevealOpts & {id?: string};
    const connector = authored && data.type === 'connect';
    const start = Math.max(checked(reveal.reveal, data.type) ?? 0, connector ? 0 : inheritedStart);
    const stop = Math.min(checked(reveal.until, `${data.type} (until)`) ?? Infinity, connector ? Infinity : inheritedEnd);
    const end = Number.isFinite(stop) ? stop : undefined;
    if (end !== undefined && end <= start) {
      throw new Error(authored ? `${data.type}(): until ${end} must be later than its reveal ${start || '(shown from the start)'}`
        : `renderBands: ${data.type} until must be later than its reveal`);
    }
    // Endpoint checks compare authored connector stages with the resolved stages of their anchors.
    const elements: RevealElements | undefined = def.revealElements?.(data, start, end);
    if (start) reveal.reveal = start;
    if (end !== undefined) reveal.until = end;
    last = Math.max(last, end ?? start);
    if (reveal.id) {
      if (ids.has(reveal.id)) throw new Error(authored ? `duplicate anchor id "${reveal.id}": every band needs a unique id` : `renderBands: duplicate band id "${reveal.id}"`);
      ids.set(reveal.id, {start, end, band: data});
    }
    const scope = scopeOf(data);
    for (const id of def.ids?.(data) ?? []) {
      if (scope) addScoped(scopeTable, scope, id);
      ids.set(qualify(scope, id), {start, end});
    }
    if (elements) {
      last = Math.max(last, elements.last);
      revealWarnings.push(...elements.warnings);
      if (elements.checkEndpoints) endpointChecks.push(elements.checkEndpoints);
      for (const item of elements.items ?? []) {
        if (!item.id) continue;
        if (scope) addScoped(scopeTable, scope, item.id);
        ids.set(qualify(scope, item.id), {start: item.reveal ?? start, end: item.until ?? end});
      }
    }
    const diagramFindings = def.verify?.diagramFindings;
    if (typeof diagramFindings === 'function') diagramChecks.add(diagramFindings);
    else if (diagramFindings) for (const check of diagramFindings) diagramChecks.add(check);
    const findings = def.verify?.findings;
    if (findings) inputChecks.push(ctx => findings(data, ctx));
    if (def.measure) measureBands.push(data);
    if (unscaledRoles && def.fillTextSize) largestFillText = Math.max(largestFillText, def.fillTextSize(data, unscaledRoles));
    for (const generated of def.generated?.(data) ?? []) collect(generated, start, stop);
    for (const generated of opts.generatedBands?.(data) ?? []) collect(generated, start, stop);
    for (const child of def.children?.(data) ?? []) atBand(child, () => collect(child, start, stop));
    for (const [id, timing] of opts.revealAnchorSlots?.(data) ?? []) ids.set(id, timing);
  }
  for (const input of data.bands) atBand(input, () => collect(input));
  const placedDefinition = (band: LaidOutBand) => definitions.get(definitionKey(band)) ?? syntheticOutputs.get(band.type);
  const connection = definitions.get('connect');
  const layout = createLayoutWith({
    offGrid: data => defOf(data)?.offGrid === true,
    layoutBoxLike: placeBox,
    fitLineScale: fitLayout,
    connectorGaps: connection?.internal ? connection.connectorGaps : undefined,
    resolveConnect: (...args) => {
      const def = defOf(args[0]);
      return must(def?.internal ? def.resolveConnect : undefined)(...args);
    },
    resolve: input => {
      const def = must(defOf(input));
      if (def.internal) return def.layout;
      const place = def.layout;
      return (_band, ctx, x, w) => {
        const {laid, h, anchors} = place(input, {x, y: ctx.y, w, widthOf: ctx.widthOf, roles: ctx.roles, theme, tones: ctx.tones, wrap: ctx.wrap, keepWords: ctx.keepWords, space: ctx.space, today, canvas, geometryScale});
        const scope = scopeOf(input);
        if ('id' in input && input.id) ctx.register(input.id, laid, 'each band needs a unique id');
        for (const anchor of anchors ?? []) {
          if (anchor.id) {
            const owner = input.type === 'chart' ? 'a chart mark' : input.type === 'gantt' ? 'a gantt task' : 'a figure item';
            ctx.register(anchor.id, anchor, authored ? `${owner} takes an id that another anchor already has` : 'each anchor needs a unique id', scope);
          }
        }
        ctx.laidOut.push((authored && scope ? {...laid, scope} : laid) as LaidOutBand);
        ctx.y += size('band height', h, 0) + ctx.d.gap;
      };
    },
    hasChildrenHandler: input => definitions.has(definitionKey(input)),
    childrenOf: input => defOf(input)?.children?.(input) ?? [],
    stackWidthOf: (input, width) => defOf(input)?.stackWidth?.(input, width) ?? null,
    areasPrelayoutFor: data => {
      const def = defOf(data);
      return def?.internal ? def.areasPrelayout : undefined;
    },
    scopesOf: () => scopeTable,
    buildInventory: (laidOut, connects, widthOf, labelSize) => {
      const items = buildInventoryWith((band, ctx) =>
        placedDefinition(band)?.inventory?.(band as never, ctx) ?? whole(band, ctx), laidOut, widthOf);
      const connector = definitions.get('connect');
      const links = connector?.internal ? connector.connectorInventory?.(connects, labelSize) : undefined;
      return {items: links ? items.concat(links) : items};
    },
  });
  async function prepareLayoutAt(scale: number): Promise<() => LaidOutDiagram> {
    const roles = rolesAt(!!canvas, scale);
    const requests = new Map<string, Required<MeasureRequest>>();
    const measureEnv = {roles, today, atoms(text: string, size: number, weight: number, font: FontFamily = 'sans') {
      for (const atom of splitAtoms(text)) requests.set(keyOf(atom, size, weight, font), {text: atom, size, weight, font});
    }};
    for (const band of measureBands) defOf(band)?.measure?.(band, measureEnv);
    const measured = 'measureBatch' in opts ? await opts.measureBatch(requests) : new Map(
      await Promise.all([...requests].map(async ([key, request]) => [key, await opts.measure(request)] as const)),
    );
    for (const {w} of measured.values()) size('measured width', w, 0);
    const widthOf: WidthOf = (text, size, weight, font) =>
      must(measured.get(keyOf(text, size, weight, font))?.w, `renderBands: width was not measured for "${text}"`);
    const spacing = canvas || slide ? {pad: Math.round(pad * scale), gap: Math.round(gap * scale)} : {pad, gap};
    return () => layout({...data, ...spacing}, roles, widthOf);
  }
  const fontScale = fill && slide && fitter
    ? await fitter.fontScale(slide.maxHeight, largestFillText, async s => {
      const place = await prepareLayoutAt(s);
      return place().canvasHeight;
    })
    : geometryScale;
  const placed = await layoutFitted(data, await prepareLayoutAt(fontScale));
  const {roles} = placed;
  placed.fontScale = fontScale;
  placed.canvasHeight = Math.max(1, placed.canvasHeight);
  const revealConnector = connection?.internal ? connection.revealConnector : undefined;
  if (revealConnector) placed.connects = placed.connects.map(connector => atBand(connector, () => {
    if (!authored) return revealConnector(connector, ids);
    const from = ids.get(connector.fromId), to = ids.get(connector.toId);
    const start = connector.reveal ?? Math.max(from?.start ?? 0, to?.start ?? 0);
    const stop = connector.until ?? Math.min(from?.end ?? Infinity, to?.end ?? Infinity);
    if (stop <= start) {
      throw new Error(`connect(${connector.fromLabel} -> ${connector.toLabel}): until ${stop} must be later than its reveal ${start || '(shown from the start)'} (an arrow between two things that are never on screen together has nothing to show)`);
    }
    return {...connector, ...(start ? {reveal: start} : {}), ...(Number.isFinite(stop) ? {until: stop} : {})};
  }));
  for (const check of endpointChecks) check(ids, scopeTable, revealWarnings);
  if (authored) {
    placed.maxReveal = last;
    placed.revealWarnings = revealWarnings;
  }
  if (placed.spotlight) spotlighter?.apply(placed, placedDefinition, scopeTable);
  const stage = opts.stage ?? last;
  const reveal = authored && opts.stage === undefined && stage === 0 ? undefined : stage;
  const ink = toneEnv(tones);
  const ctx = {theme, tones: ink, dimFill: spotlighter?.dim(placed) === 'fill', appearance: placed.appearance, rcaCheck: placed.rcaCheck, connects: placed.connects.map(c => ({fromId: c.fromId, toId: c.toId, segments: c.pathSegments}))};
  const leaves = (figure: LaidOutDiagram) => figure.laidOut.flatMap(band => placedDefinition(band)?.verify?.targets?.(band as never) ?? ('h' in band ? [band] : []));
  const bandFindings = inputChecks.flatMap(check => check(ctx));
  if (!canvas) {
    const extents = placed.laidOut.flatMap(band => {
      const extentOf = placedDefinition(band)?.verify?.figureExtent;
      const extent = extentOf ? extentOf(band as never) : basicExtentOf(band);
      return extent ? [extent] : [];
    });
    for (const metric of figureMetricsForExtent(unionOf(extents), placed.width)) {
      bandFindings.push({...metric, severity: placed.layoutCheck === 'strict' ? 'warn' : 'info'});
    }
  }
  for (const check of diagramChecks) bandFindings.push(...check(placed, stage, placedDefinition));
  for (const laid of placed.laidOut) {
    const def = placedDefinition(laid);
    bandFindings.push(...(def?.verify?.layoutFindings?.(laid as never, ctx) ?? []));
  }
  const fit = (fitter?.analyzeFit ?? analyzeDocumentFit)(
    placed, laid => placedDefinition(laid)?.textSizes?.(laid as never) ?? [],
  );
  if (canvas) {
    bandFindings.push(...canvasFindings(canvas, fit.effectiveFont, placed.contentHeight));
  }
  if (opts.diagramFindings && !diagramChecks.has(opts.diagramFindings)) bandFindings.push(...opts.diagramFindings(placed, stage, placedDefinition));
  const verdict = verifyWithServices({
    checkConnectionGeometry: connection?.internal ? connection.checkConnectionGeometry : undefined,
    collectRects: figure => figure.laidOut.flatMap(band => {
      const def = placedDefinition(band);
      const rects = def?.verify?.rects?.(band as never) ?? ('h' in band ? ownRect(band) : []);
      const scope = def?.rectsQualified ? undefined : scopeOf(band), loc = sourceOf(band);
      return rects.map(rect => {
        const located = loc && !rect.loc ? {...rect, loc} : rect;
        return scope ? scopedRect(band, scope, located) : located;
      });
    }),
    contrastProblems: (figure, tones) => leaves(figure).flatMap(band => {
      const def = placedDefinition(band);
      const messages = def?.verify?.contrast?.(band, {...ctx, tones, appearance: figure.appearance}) ?? [];
      return messages.map(message => ({...at(band), message}));
    }),
    lintDiagram: () => opts.accept ? bandFindings.map(finding => applyFindingAcceptance(finding, opts.accept)) : bandFindings,
    acceptHint(rule) {
      for (const def of definitions.values()) {
        const hint = def.verify?.acceptHint?.(rule);
        if (hint) return hint;
      }
      return opts.diagramAcceptHint?.(rule);
    },
    // Layout findings are computed once and shared by both colour schemes.
    mergeFindingSides: light => [...light],
    hasMutedBox: figure => walkDefinedBands(figure.bands).some(band => band.type === 'box' && band.tone === 'muted'),
    checkFigures: figure => {
      const issues: Issue[] = [], warnings: string[] = [];
      for (const band of leaves(figure)) {
        for (const finding of placedDefinition(band)?.verify?.check?.(band, ctx) ?? []) {
          if (finding.severity === 'problem') issues.push({...at(band), message: finding.message});
          else warnings.push(finding.message);
        }
      }
      return {issues, warnings: authored ? warnings : [...revealWarnings, ...warnings]};
    },
  }, placed);
  const emitEnv = {theme, roles, tones: ink, color: (key: Parameters<typeof colorOf>[0]) => colorOf(key, theme), stage, dimFill: ctx.dimFill};
  const emit = (figure: LaidOutDiagram, noRecolor = false, description = opts.desc) => emitSvgWith({
    connectorDefs: connection?.internal ? connection.connectorDefs : undefined,
    defsNeeded: band => placedDefinition(band)?.svgDefs?.(band as never) ?? {},
    renderBand: band => {
      const def = must(placedDefinition(band));
      const svg = def.emit(band as never, emitEnv);
      return spotlighter?.renderBand(band, svg, def) ?? svg;
    },
    renderConnect: connector => must(definitions.get('connect')).emit(connector as never, emitEnv),
    diagramTitle: diagram => definedDiagramTitle(diagram, authored ? undefined : stage),
    diagramDesc: diagram => {
      const text = description ?? joinBandDescriptions(walkDefinedBands(diagram.bands).flatMap(band => {
        const part = visibleAt(band, reveal) ? defOf(band)?.describe?.(band, reveal) : undefined;
        return part ? [part] : [];
      }));
      return opts.formatDescription?.(text) ?? text;
    },
    spotlightDim: spotlighter?.dim ?? (() => 'outline'),
  }, figure, {reveal, noRecolor});
  return {placed, stage, verdict, emit, fit, fontScale};
}

/** Render a vertical stack of bands whose definitions are carried by their values. */
export async function renderBands(bands: readonly DefinedBand[], opts: Options) {
  const {placed, verdict, emit, fit, fontScale} = await prepareBands(bands, opts);
  const svg = emit(placed);
  return {svg, width: placed.width, height: placed.canvasHeight, xml: xmlProblems(svg), verdict, fit, fontScale, laidOut: placed};
}
