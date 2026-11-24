import type {PyramidLayers} from '../strict.ts';
import type {PyramidBand, PyramidOpts, PyramidLayer} from '../types/figures.ts';
import {assertNoReveal} from './shared.ts';

// Stacked trapezoid layers, bottom (widest) to top (narrowest) — a test
// pyramid, a maturity model, anything shaped like "few at the top, many at
// the bottom". `layers`: strings or {text}, bottom-to-top. Opacity and each
// layer's text color are derived (see tokens.ts's SHADES/bestTextColor),
// not chosen per diagram, so contrast is provably fine for any 2-6 layers.
// Types: a tuple of at least 2 layers.
export function pyramid(layers: PyramidLayers, opts?: PyramidOpts): PyramidBand;
export function pyramid(layers: (string | PyramidLayer)[], opts: PyramidOpts = {}): PyramidBand {
  assertNoReveal(opts, 'pyramid()');
  if (!Array.isArray(layers) || layers.length < 2) throw new Error('pyramid(layers) needs at least 2 layers, bottom to top');
  return {
    type: 'pyramid',
    layers: layers.map(l => typeof l === 'string' ? {text: l} : l),
    width: opts.width,
    layerHeight: opts.layerHeight ?? 76,
    apexRatio: opts.apexRatio ?? 0.3,
  };
}
