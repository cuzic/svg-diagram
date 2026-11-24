import {splitAtoms} from './atoms.ts';
import {band, defOf, DEF, EXTERNAL} from './band-def.ts';
import {cloneData} from './clone-data.ts';
import {emitSvgWith} from './emit-svg-core.ts';
import {createLayoutWith} from './layout-core.ts';
import {addScoped, emptyScopes} from './scope-table.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {scopedRect} from './verify-rects.ts';
import {verifyWithServices} from './verify-core.ts';
import type {BandDef} from './band-def.ts';
import type {ConnectBand, LaidOutConnect} from './types/containers.ts';
import {must} from './must.ts';
import {checked} from './reveal-visibility.ts';
import {checkToday} from './today-auto.ts';
import {checkTones, colorOf, rolesAt, THEMES, toneEnv} from './tokens.ts';
import type {FontFamily, Measured, MeasureRequest, DiagramData, RevealOpts, Theme, WidthOf, WrapMode} from './types/core.ts';
import type {Band, LaidOutBand, LaidOutDiagram} from './types/index.ts';
import type {Issue} from './types/verdicts.ts';
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
  today?: string;
  stage?: number;
  connectors?: BandDef<ConnectBand, LaidOutConnect>;
};

function size(name: string, value: number, min: number): number {
  if (!Number.isFinite(value) || value < min) throw new Error(`renderBands: ${name} must be finite and at least ${min}`);
  return value;
}

const keyOf = (text: string, size: number, weight: number, font: string): string => JSON.stringify([text, size, weight, font]);

/** Render a vertical stack of bands whose definitions are carried by their values. */
export async function renderBands(bands: readonly DefinedBand[], opts: Options) {
  const width = size('width', opts.width ?? 940, 1);
  const pad = size('pad', opts.pad ?? 20, 0);
  const gap = size('gap', opts.gap ?? 16, 0);
  const contentWidth = width - 2 * pad;
  size('content width', contentWidth, 1);
  const theme = opts.theme ?? 'blue';
  if (!THEMES.includes(String(theme))) throw new Error(`renderBands: unknown theme "${theme}"`);
  const tones = opts.tones === undefined ? undefined : checkTones(opts.tones, 'renderBands');
  const today = opts.today === undefined ? undefined : checkToday(opts.today, 'renderBands({today})');
  if (opts.stage !== undefined && (!Number.isInteger(opts.stage) || opts.stage < 0)) throw new Error('renderBands: stage must be a nonnegative integer');

  const roles = rolesAt(false, 1);
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
  let source = cloneData(bands) as unknown as Band[];
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
    if (definitions.has(data.type) && definitions.get(data.type) !== def) {
      throw new Error(`renderBands: mixed definitions for "${data.type}"`);
    }
    definitions.set(data.type, def);
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
        const {laid, h, anchors} = place(input, {x, y: ctx.y, w, widthOf: ctx.widthOf, roles, theme, tones: ctx.tones, wrap: ctx.wrap, today});
        if ('id' in input && input.id) ctx.register(input.id, laid, 'each band needs a unique id');
        for (const anchor of anchors ?? []) {
          if (anchor.id) ctx.register(anchor.id, anchor, 'each anchor needs a unique id', scopeOf(input));
        }
        ctx.laidOut.push(laid as LaidOutBand);
        ctx.y += size('band height', h, 0) + gap;
      };
    },
    hasChildrenHandler: input => definitions.has(input.type),
    childrenOf: input => defOf(input)?.children?.(input) ?? [],
    stackWidthOf: (input, width) => defOf(input)?.stackWidth?.(input, width) ?? null,
    scopesOf: () => scopeTable,
    buildInventory: () => ({items: []}),
  });
  const data: DiagramData = {day: theme, medium: 'doc', width, pad, gap, fill: false, bands: source, title: opts.title, wrap: opts.wrap, tones};
  const placed = layout(data, roles, widthOf);
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
      const def = definitions.get(band.type);
      const rects = def?.verify?.rects?.(band);
      if (!rects) return [{...band, label: band.type, id: 'id' in band ? band.id ?? null : null}];
      const scope = scopeOf(band);
      return scope && !def?.rectsQualified ? rects.map(rect => scopedRect(band, scope, rect)) : rects;
    }),
    contrastProblems: () => [],
    lintDiagram: () => [],
    acceptHint: () => undefined,
    mergeFindingSides: () => [],
    hasMutedBox: () => false,
    checkFigures: figure => {
      const issues: Issue[] = [], warnings: string[] = [];
      for (const band of leaves(figure)) {
        for (const finding of definitions.get(band.type)?.verify?.check?.(band, ctx) ?? []) {
          if (finding.severity === 'problem') issues.push({message: finding.message});
          else warnings.push(finding.message);
        }
      }
      return {issues, warnings: [...revealWarnings, ...warnings]};
    },
  }, placed);
  const emitEnv = {theme, roles, tones: ink, color: (key: Parameters<typeof colorOf>[0]) => colorOf(key, theme), stage};
  const svg = emitSvgWith({
    defsNeeded: band => ({
      arrow: band.type === 'row' && band.arrows.length > 0,
      ...definitions.get(band.type)?.svgDefs?.(band as never),
      mono: (band.type === 'row' || band.type === 'grid' ? band.children.flatMap(b => b.wrappedRuns)
        : 'wrappedRuns' in band ? band.wrappedRuns : []).some(run => run.mono),
    }),
    renderBand: band => must(definitions.get(band.type) ?? syntheticOutputs.get(band.type)).emit(band as never, emitEnv),
    renderConnect: connector => must(definitions.get('connect')).emit(connector as never, emitEnv),
    diagramTitle: () => opts.title ?? '',
    diagramDesc: () => '',
    spotlightDim: () => 'outline',
  }, placed, {reveal: stage});
  return {svg, width, height: placed.canvasHeight, xml: xmlProblems(svg), verdict};
}
