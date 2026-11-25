import { withParts } from '../parts.js';
import { prepareBands } from '../core.js';
import { visibleAt } from '../reveal-visibility.js';
import { drawBandFallback } from './band-fallback.js';
import { bandPicture } from './image-band-core.js';
import { packageEntries } from './package.js';
import { fontsOf, planSlideWith } from './slide-core.js';
import { zipEntries } from './zip.js';
export function planPreparedPptx({ placed, stage, emit }, opts) {
    const fallbacks = [];
    const visible = placed.laidOut.map(item => visibleAt(item, stage));
    const laidOut = placed.laidOut.flatMap((item, index) => {
        if (!visible[index])
            return [];
        if (item.type !== 'group' && item.type !== 'swimlane' || !item.span)
            return [item];
        const span = visible.slice(index + 1, index + 1 + item.span).filter(Boolean).length;
        return [{ ...item, span }];
    });
    const ld = { ...placed, laidOut, connects: placed.connects.filter(item => visibleAt(item, stage)) };
    const plan = planSlideWith(ld, fontsOf(opts.font), (item, ctx, index) => {
        // The table key selects an adapter expecting this exact band type.
        const adapter = opts.bands?.[item.type];
        const native = adapter?.(item, ctx, index);
        if (native !== undefined)
            return native;
        const id = 'id' in item ? item.id : undefined;
        return drawBandFallback(item, ctx, index, () => bandPicture(ld, item, index, figure => emit(opts.svgShapes ? withParts(figure) : figure, true)), opts.svgShapes, () => {
            fallbacks.push({ type: item.type, ...(id ? { id } : {}) });
            if (opts.strict)
                throw new Error(`renderBandsPptx: picture fallback for ${item.type}${id ? ` "${id}"` : ''}`);
        });
    }, { title: opts.title, stage, spans: opts.spans });
    return { plan, fallbacks, width: ld.width, height: ld.canvasHeight, native: laidOut.length - plan.pictures.length };
}
/** Render selected bands as an editable slide, reporting the bands embedded as pictures. */
export async function renderBandsPptx(bands, opts) {
    const prepared = await prepareBands(bands, opts);
    const pngScale = opts.pngScale ?? 2;
    if (!(Number.isFinite(pngScale) && pngScale > 0))
        throw new Error('renderBandsPptx: pngScale must be a positive number');
    const { plan, width, height, fallbacks } = planPreparedPptx(prepared, opts);
    const pngs = [];
    for (const picture of plan.pictures) {
        if (!opts.rasterize)
            throw new Error('renderBandsPptx: pass rasterize to embed picture fallbacks');
        if (opts.outline) {
            picture.svg = opts.outline(picture.svg);
            picture.pngSvg = opts.outline(picture.pngSvg);
        }
        pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
    }
    return { pptx: zipEntries(packageEntries(plan, pngs)), width, height, fallbacks, verdict: prepared.verdict };
}
