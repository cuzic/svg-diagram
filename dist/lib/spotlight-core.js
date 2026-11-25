import { applySpotlightWith, dimBandSvg, spotlightDim } from './emit-spotlight.js';
export { dimmedBands } from './spotlight-legend.js';
/** Supply as `spotlighter` when focusing selected bands. */
export const spotlighter = {
    apply(placed, definitionOf, scopes) {
        applySpotlightWith(placed, band => definitionOf(band)?.spotlight, scopes);
    },
    dim: spotlightDim,
    renderBand(band, svg, def) {
        return band.dim && !def?.selfDimming ? dimBandSvg(svg) : svg;
    },
};
