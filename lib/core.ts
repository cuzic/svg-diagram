import {splitAtoms} from './atoms.ts';
import {band, defOf, DEF, EXTERNAL} from './band-def.ts';
import {withSourceLine, withTitleLine} from './layout-util.ts';
import {cloneData} from './clone-data.ts';
import {emitSvgWith} from './emit-svg-core.ts';
import {createLayoutWith} from './layout-core.ts';
import {addScoped, emptyScopes} from './scope-table.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {scopedRect} from './verify-rects.ts';
import {verifyWithServices} from './verify-core.ts';
import type {BandDef} from './band-def.ts';
import type {CaptionBand, LaidOutCaption} from './types/text-bands.ts';
import type {ConnectBand, LaidOutConnect} from './types/containers.ts';
import {must} from './must.ts';
import {checked} from './reveal-visibility.ts';
import {checkToday} from './today-auto.ts';
import {canvasFontScale, checkMinText, checkTones, colorOf, rolesAt, SLIDE_CANVAS, THEMES, toneEnv} from './tokens.ts';
import type {Appearance, FontFamily, Measured, MeasureRequest, DiagramData, RevealOpts, SlideCanvas, Theme, WidthOf, WrapMode} from './types/core.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Finding, Issue} from './types/verdicts.ts';
import {xmlProblems} from './xml-check.ts';

export type {BandDef} from './band-def.ts';

type DefinedBand = {type: string; id?: string; readonly [DEF]: object} & RevealOpts;
type Options = {
  measure: (request: Required<MeasureRequest>) => Measured | Promise<Measured>;
  width?: number;
  pad?: number;
  gap?: number;
  theme?: Theme;
  tones?: Parameters<typeof toneEnv>[0];
  wrap?: Exclude<WrapMode, 'bunsetsu-soft'>;
  title?: string;
  desc?: string;
  appearance?: Appearance;
  density?: DiagramData['density'];
  showTitle?: boolean;
  sourceLine?: string;
  captions?: BandDef<CaptionBand, LaidOutCaption>;
  canvas?: Partial<SlideCanvas>;
  today?: string;
  stage?: number;
  connectors?: BandDef<ConnectBand, LaidOutConnect>;
};

function size(name: string, value: number, min: number): number {
  if (!Number.isFinite(value) || value < min) throw new Error(`renderBands: ${name} must be finite and at least ${min}`);
  return value;
}

const keyOf = (text: string, size: number, weight: number, font: string): string => JSON.stringify([text, size, weight, font]);

const definitionKey = (band: Band | LaidOutBand): string => band.type === 'chart' ? `chart:${band.kind}` : band.type;

/** @internal Shared layout and SVG emission for selective output formats. */
export async function prepareBands(bands: readonly DefinedBand[], opts: Options) {
  const canvas = opts.canvas === undefined ? undefined : {...SLIDE_CANVAS, ...opts.canvas};
  if (canvas) {
    if (opts.width !== undefined) throw new Error('renderBands: use canvas.width when canvas is set');
    checkMinText(canvas.minText, 'renderBands({canvas})');
    size('canvas height', canvas.height, 1);
  }
  const scale = canvas ? canvasFontScale(canvas.minText) : 1;
  const width = size('width', opts.width ?? canvas?.width ?? 940, 1);
  const pad = size('pad', opts.pad ?? 20, 0) * scale;
  const gap = size('gap', opts.gap ?? 16, 0) * scale;
  const contentWidth = width - 2 * pad;
  size('content width', contentWidth, 1);
  const theme = opts.theme ?? 'blue';
  if (!THEMES.includes(String(theme))) throw new Error(`renderBands: unknown theme "${theme}"`);
  const tones = opts.tones === undefined ? undefined : checkTones(opts.tones, 'renderBands');
  const today = opts.today === undefined ? undefined : checkToday(opts.today, 'renderBands({today})');
  if (opts.stage !== undefined && (!Number.isInteger(opts.stage) || opts.stage < 0)) throw new Error('renderBands: stage must be a nonnegative integer');

  const roles = rolesAt(!!canvas, scale);
  const requests = new Map<string, Required<MeasureRequest>>();
  const measureEnv = {roles, today, atoms(text: string, size: number, weight: number, font: FontFamily = 'sans') {
    for (const atom of splitAtoms(text)) requests.set(keyOf(atom, size, weight, font), {text: atom, size, weight, font});
  }};
  const ids = new Map<string, {start: number; end?: number}>();
  const definitions = new Map<string, BandDef>();
  const syntheticOutputs = new Map<string, BandDef>();
  const scopeTable = emptyScopes();
  let last = 0;
  const revealWarnings: string[] = [];
  const bandFindings: Finding[] = [];
  let source = cloneData(bands) as unknown as Band[];
  const data: DiagramData = {
    day: theme, medium: 'doc', width, pad: canvas ? Math.round(pad) : pad, gap: canvas ? Math.round(gap) : gap,
    fill: false, bands: source, title: opts.title, desc: opts.desc, wrap: opts.wrap, tones, canvas,
    appearance: opts.appearance, density: opts.density,
  };
  if (opts.showTitle && opts.title || opts.sourceLine !== undefined) {
    const captions = opts.captions;
    if (!captions) throw new Error('renderBands: pass captionDefinition as captions for showTitle or sourceLine');
    const {bands} = withSourceLine(withTitleLine({...data, showTitle: opts.showTitle, sourceLine: opts.sourceLine}));
    source = bands.map(item => item.type === 'caption' && !defOf(item) && (item.titleLine || item.sourceLine)
      ? band(captions, item) : item);
  }
  const hasLoopBack = (data: Band): boolean =>
    (data.type === 'row' || data.type === 'chevron') && !!data.loopBack || (defOf(data)?.children?.(data) ?? []).some(hasLoopBack);
  if (source.some(hasLoopBack)) {
    const connector = opts.connectors;
    if (!connector?.internal || !connector.expandLoopBacks) {
      throw new Error('renderBands: loopBack には bands/connect の connectDefinition を connectors に指定してください');
    }
    const attach = (data: Band): Band => {
      if (data.type === 'connect' && data.loopBack && !defOf(data)) return band(connector, data);
      if (data.type === 'group') data.children = data.children.map(attach);
      return data;
    };
    source = connector.expandLoopBacks(source).map(attach);
  }
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
    if (def.internal) for (const type of def.outputTypes ?? []) syntheticOutputs.set(type, def);
    const reveal = data as RevealOpts & {id?: string};
    const start = Math.max(checked(reveal.reveal, data.type) ?? 0, inheritedStart);
    const stop = Math.min(checked(reveal.until, `${data.type} (until)`) ?? Infinity, inheritedEnd);
    const end = Number.isFinite(stop) ? stop : undefined;
    if (end !== undefined && end <= start) throw new Error(`renderBands: ${data.type} until must be later than its reveal`);
    if (start) reveal.reveal = start;
    if (end !== undefined) reveal.until = end;
    last = Math.max(last, end ?? start);
    if (reveal.id) {
      if (ids.has(reveal.id)) throw new Error(`renderBands: duplicate band id "${reveal.id}"`);
      ids.set(reveal.id, {start, end});
    }
    const scope = scopeOf(data);
    for (const id of def.ids?.(data) ?? []) {
      if (scope) addScoped(scopeTable, scope, id);
      ids.set(qualify(scope, id), {start, end});
    }
    const elements = def.revealElements?.(data, start, end);
    if (elements) {
      last = Math.max(last, elements.last);
      revealWarnings.push(...elements.warnings);
      for (const item of elements.items ?? []) {
        if (!item.id) continue;
        if (scope) addScoped(scopeTable, scope, item.id);
        ids.set(qualify(scope, item.id), {start: item.reveal ?? start, end: item.until ?? end});
      }
    }
    if (def.verify?.findings) bandFindings.push(...def.verify.findings(data));
    def.measure?.(data, measureEnv);
    for (const generated of def.generated?.(data) ?? []) collect(generated, start, stop);
    for (const child of def.children?.(data) ?? []) collect(child, start, stop);
  }
  for (const data of source) collect(data);
  const measured = new Map(await Promise.all([...requests].map(async ([key, request]) => {
    const {w} = await opts.measure(request);
    return [key, size('measured width', w, 0)] as const;
  })));
  const widthOf: WidthOf = (text, size, weight, font) => {
    return must(measured.get(keyOf(text, size, weight, font)), `renderBands: width was not measured for "${text}"`);
  };
  const layout = createLayoutWith({
    resolveConnect: (...args) => {
      const def = defOf(args[0]);
      return must(def?.internal ? def.resolveConnect : undefined)(...args);
    },
    resolve: input => {
      const def = must(defOf(input));
      if (def.internal) return def.layout;
      const place = def.layout;
      return (_band, ctx, x, w) => {
        const {laid, h, anchors} = place(input, {x, y: ctx.y, w, widthOf: ctx.widthOf, roles, theme, tones: ctx.tones, wrap: ctx.wrap, today, canvas, geometryScale: scale});
        if ('id' in input && input.id) ctx.register(input.id, laid, 'each band needs a unique id');
        for (const anchor of anchors ?? []) {
          if (anchor.id) ctx.register(anchor.id, anchor, 'each anchor needs a unique id', scopeOf(input));
        }
        ctx.laidOut.push(laid as LaidOutBand);
        ctx.y += size('band height', h, 0) + ctx.d.gap;
      };
    },
    hasChildrenHandler: input => definitions.has(definitionKey(input)),
    childrenOf: input => defOf(input)?.children?.(input) ?? [],
    stackWidthOf: (input, width) => defOf(input)?.stackWidth?.(input, width) ?? null,
    scopesOf: () => scopeTable,
    buildInventory: () => ({items: []}),
  });
  const placed = layout({...data, bands: source}, roles, widthOf);
  placed.canvasHeight = Math.max(1, placed.canvasHeight);
  // A link follows its endpoints unless it has an explicit end stage.
  placed.connects = placed.connects.map(connector => {
    const from = ids.get(connector.fromId), to = ids.get(connector.toId);
    const reveal = Math.max(connector.reveal ?? 0, from?.start ?? 0, to?.start ?? 0);
    const end = connector.until ?? Math.min(from?.end ?? Infinity, to?.end ?? Infinity);
    if (end <= reveal) throw new Error(`renderBands: connector "${connector.fromId}" → "${connector.toId}" is never visible`);
    return {...connector, ...(reveal ? {reveal} : {}), ...(Number.isFinite(end) ? {until: end} : {})};
  });
  const stage = opts.stage ?? last;
  const ink = toneEnv(tones);
  const ctx = {theme, tones: ink, connects: placed.connects.map(c => ({fromId: c.fromId, toId: c.toId, segments: c.pathSegments}))};
  const leaves = (figure: LaidOutDiagram) => figure.laidOut.flatMap(band => band.type === 'row' || band.type === 'grid' ? band.children : band.type === 'group' ? [] : [band]);
  const verdict = verifyWithServices({
    collectRects: figure => leaves(figure).flatMap(band => {
      const def = definitions.get(definitionKey(band)) ?? syntheticOutputs.get(band.type);
      const rects = def?.verify?.rects?.(band);
      if (!rects) return [{...band, label: band.type, id: 'id' in band ? band.id ?? null : null}];
      const scope = scopeOf(band);
      return scope && !def?.rectsQualified ? rects.map(rect => scopedRect(band, scope, rect)) : rects;
    }),
    contrastProblems: () => [],
    lintDiagram: figure => figure.canvas && figure.contentHeight !== undefined && figure.contentHeight > figure.canvas.height
      ? [...bandFindings, {rule: 'slide-canvas-overflow', severity: 'warn',
        message: `内容の高さ ${figure.contentHeight}px が、キャンバスの高さ ${figure.canvas.height}px を超える。行・文字を減らすか、図を分ける`}]
      : bandFindings,
    acceptHint: () => undefined,
    mergeFindingSides: () => [],
    hasMutedBox: () => false,
    checkFigures: figure => {
      const issues: Issue[] = [], warnings: string[] = [];
      for (const band of leaves(figure)) {
        for (const finding of (definitions.get(definitionKey(band)) ?? syntheticOutputs.get(band.type))?.verify?.check?.(band, {...ctx, appearance: figure.appearance}) ?? []) {
          if (finding.severity === 'problem') issues.push({message: finding.message});
          else warnings.push(finding.message);
        }
      }
      return {issues, warnings: [...revealWarnings, ...warnings]};
    },
  }, placed);
  const emitEnv = {theme, roles, tones: ink, color: (key: Parameters<typeof colorOf>[0]) => colorOf(key, theme), stage};
  const emit = (figure: LaidOutDiagram, noRecolor = false) => emitSvgWith({
    defsNeeded: band => ({
      arrow: band.type === 'row' && band.arrows.length > 0,
      mono: (band.type === 'row' || band.type === 'grid' ? band.children.flatMap(b => b.wrappedRuns)
        : 'wrappedRuns' in band ? band.wrappedRuns : []).some(run => run.mono),
      ...definitions.get(definitionKey(band))?.svgDefs?.(band as never),
    }),
    renderBand: band => must(definitions.get(definitionKey(band)) ?? syntheticOutputs.get(band.type)).emit(band as never, emitEnv),
    renderConnect: connector => must(definitions.get('connect')).emit(connector as never, emitEnv),
    diagramTitle: () => opts.title ?? '',
    diagramDesc: () => opts.desc ?? '',
    spotlightDim: () => 'outline',
  }, figure, {reveal: stage, noRecolor});
  return {placed, stage, verdict, emit};
}

/** Render a vertical stack of bands whose definitions are carried by their values. */
export async function renderBands(bands: readonly DefinedBand[], opts: Options) {
  const {placed, verdict, emit} = await prepareBands(bands, opts);
  const svg = emit(placed);
  return {svg, width: placed.width, height: placed.canvasHeight, xml: xmlProblems(svg), verdict};
}
