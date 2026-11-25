import { rasterizeWithResvg } from './raster.js';
/** The most pixels svgToPng() allocates: resvg's buffer is outside the JS heap, so a limit on the heap would not catch it. */
export const MAX_PNG_PIXELS = 64_000_000;
/** The root's width and height, when both are plain numbers of pixels. Any other way of writing them ("3e4", "300in", a root hidden behind a decoy) could mean more pixels than it seems to, so it is refused. */
function plainRootSize(svg) {
    const root = /^\s*(?:<\?[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*)*<svg\b([^>]*)>/.exec(svg)?.[1] ?? '';
    const read = (name) => {
        const v = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(root);
        const text = v?.[1] ?? v?.[2] ?? '';
        if (!/^\d{1,6}(?:\.\d+)?(?:px)?$/.test(text))
            throw new RangeError(`svgToPng: the root ${name} must be a plain number of pixels (got ${JSON.stringify(text)})`);
        return Number.parseFloat(text);
    };
    return { w: read('width'), h: read('height') };
}
/** `svg` as a PNG, drawn by resvg with the given fonts. `scale` is above 0 and at most 4; a picture over MAX_PNG_PIXELS is refused before it is allocated. */
export async function svgToPng(svg, opts = {}) {
    const scale = opts.scale ?? 1;
    if (!(scale > 0 && scale <= 4))
        throw new RangeError(`svgToPng: scale must be above 0 and at most 4 (got ${scale})`);
    const { w, h } = plainRootSize(svg);
    if (w * h * scale * scale > MAX_PNG_PIXELS)
        throw new RangeError(`svgToPng: ${w}x${h} at scale ${scale} is over ${MAX_PNG_PIXELS} pixels`);
    const r = await rasterizeWithResvg(svg, { ...opts, scale, png: true });
    return { png: r.png, width: r.width, height: r.height };
}
