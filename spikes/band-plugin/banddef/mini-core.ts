// The pipeline of the prototype (stands in for `svg-diagram/core`): measure -> layout -> verify -> emit, all through band.def. It imports NO band.
// Reduced on purpose: a vertical stack, no connect(), no reveal, no title / legend. It uses the real tokens (roles, palette) and the real atom splitter.
import {splitAtoms} from '../../../lib/atoms.ts';
import {ROLES, PALETTE} from '../../../lib/tokens.ts';
import type {FontFamily, MeasureRequest, Measured, WidthOf} from '../../../lib/types/core.ts';
import type {BandValue} from './band-def.ts';

export type Measure = (req: Required<MeasureRequest>) => Measured | Promise<Measured>;
export interface MiniResult {svg: string; findings: {rule: string; severity: string; message: string}[]; height: number}

export async function renderMini(bands: readonly BandValue<any, any>[], opts: {measure: Measure; width?: number; pad?: number; gap?: number}): Promise<MiniResult> {
  const roles = ROLES, W = opts.width ?? 940, pad = opts.pad ?? 20, gap = opts.gap ?? 16;
  // pass 1: every atom a band asks for, in one batch
  const requests = new Map<string, Required<MeasureRequest>>();
  const m = {roles, atoms(text: string, size: number, weight: number, font: FontFamily = 'sans') {
    for (const atom of splitAtoms(text)) requests.set(`${atom} ${size} ${weight} ${font}`, {text: atom, size, weight, font});
  }};
  for (const b of bands) b.def.measure?.(b.data, m);
  const got = new Map<string, number>();
  for (const [k, r] of requests) got.set(k, (await opts.measure(r)).w);
  // a text nobody asked to measure is an ERROR here, never a silent 0 (ADR 0080: plugin-text-unmeasured)
  const widthOf: WidthOf = (atom, size, weight, font) => { const w = got.get(`${atom} ${size} ${weight} ${font}`); if (w === undefined) throw new Error(`plugin-text-unmeasured: "${atom}" at ${size}/${weight}/${font} was not requested by measure()`); return w; };
  // pass 2: layout, then emit, then verify
  let y = pad, body = '';
  const findings: MiniResult['findings'] = [];
  for (const b of bands) {
    const {laid, h} = b.def.layout(b.data, {x: pad, y, w: W - 2 * pad, roles, widthOf});
    findings.push(...(b.def.verify?.(laid) ?? []));
    body += b.def.emit(laid, {roles});
    y += h + gap;
  }
  const height = y - gap + pad;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}"><rect width="${W}" height="${height}" fill="${PALETTE.bg}"/>${body}</svg>`;
  return {svg, findings, height};
}
