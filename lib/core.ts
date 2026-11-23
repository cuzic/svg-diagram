import {splitAtoms} from './atoms.ts';
import {defOf, DEF, EXTERNAL} from './band-def.ts';
import {cloneData} from './clone-data.ts';
import {escapeXml} from './emit-common.ts';
import {must} from './must.ts';
import {checked, visibleAt} from './reveal-visibility.ts';
import {checkToday} from './today-auto.ts';
import {checkTones, colorOf, FONT_STACKS, PALETTE, rolesAt, THEMES, toneEnv} from './tokens.ts';
import type {FontFamily, Measured, MeasureRequest, Rect, RevealOpts, Theme, WidthOf, WrapMode} from './types/core.ts';
import {outsideBox} from './verify-base.ts';
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
  const tones = toneEnv(opts.tones === undefined ? undefined : checkTones(opts.tones, 'renderBands'));
  const today = opts.today === undefined ? undefined : checkToday(opts.today, 'renderBands({today})');
  if (opts.stage !== undefined && (!Number.isInteger(opts.stage) || opts.stage < 0)) throw new Error('renderBands: stage must be a nonnegative integer');

  const roles = rolesAt(false, 1);
  const requests = new Map<string, Required<MeasureRequest>>();
  const measureEnv = {roles, today, atoms(text: string, size: number, weight: number, font: FontFamily = 'sans') {
    for (const atom of splitAtoms(text)) requests.set(keyOf(atom, size, weight, font), {text: atom, size, weight, font});
  }};
  const ids = new Set<string>();
  const items = cloneData(bands).map(data => {
    const def = defOf(data);
    if (!def || def.type !== data.type || def.internal || def[EXTERNAL]) {
      throw new Error(`renderBands: import the supported band "${data.type}" from its svg-diagram/bands entry`);
    }
    const start = checked(data.reveal, data.type) ?? 0;
    const end = checked(data.until, `${data.type} (until)`);
    if (end !== undefined && end <= start) throw new Error(`renderBands: ${data.type} until must be later than its reveal`);
    if (data.id) {
      if (ids.has(data.id)) throw new Error(`renderBands: duplicate band id "${data.id}"`);
      ids.add(data.id);
    }
    def.measure?.(data, measureEnv);
    return {data, layout: def.layout, emit: def.emit, verify: def.verify, last: end ?? start};
  });
  const measured = new Map(await Promise.all([...requests].map(async ([key, request]) => {
    const {w} = await opts.measure(request);
    return [key, size('measured width', w, 0)] as const;
  })));
  const widthOf: WidthOf = (text, size, weight, font) => {
    return must(measured.get(keyOf(text, size, weight, font)), `renderBands: width was not measured for "${text}"`);
  };
  const emitEnv = {theme, roles, tones, color: (key: Parameters<typeof colorOf>[0]) => colorOf(key, theme)};
  const verifyEnv = {theme, tones, connects: []};
  const stage = opts.stage ?? items.reduce((last, item) => Math.max(last, item.last), 0);
  const body: string[] = [];
  const problems: string[] = [];
  const warnings: string[] = [];
  const placed: {type: string; rect: Rect}[] = [];
  let y = pad;
  for (const {data, layout, emit, verify} of items) {
    const {laid, h} = layout(data, {x: pad, y, w: contentWidth, widthOf, roles, theme, tones, wrap: opts.wrap ?? 'phrase', today});
    y += size('band height', h, 0) + gap;
    placed.push({type: data.type, rect: laid});
    for (const finding of verify?.check?.(laid, verifyEnv) ?? []) {
      if (finding.severity === 'problem') problems.push(finding.message);
      else warnings.push(finding.message);
    }
    if (visibleAt(data, stage)) body.push(emit(laid, emitEnv));
  }
  const height = Math.max(1, Math.round(y + pad - (items.length ? gap : 0)));
  const bounds = {x: 0, y: 0, w: width, h: height};
  for (const {type, rect} of placed) if (outsideBox(rect, bounds)) problems.push(`${type}: band runs outside the figure`);
  const title = opts.title === undefined ? '' : `<title>${escapeXml(opts.title)}</title>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${title}`
    + `<style>text{font-family:${FONT_STACKS.sans}}.mono{font-family:${FONT_STACKS.mono}}.emoji{font-family:${FONT_STACKS.emoji}}</style>`
    + `<rect width="${width}" height="${height}" fill="${PALETTE.bg}"/>${body.join('\n')}</svg>`;
  const xml = xmlProblems(svg);
  return {svg, width, height, xml, verdict: {ok: problems.length === 0, problems, warnings}};
}
