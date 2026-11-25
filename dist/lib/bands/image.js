import { oneLine } from '../diagram-description.js';
import { sizesOf } from '../band-text-sizes.js';
import { band, DEF } from '../band-def.js';
import { image as build } from '../dsl/image.js';
import { imageSpotlight, renderImage } from '../emit-image.js';
import { IMAGE_PAD, imageSize, imageTexts } from '../image.js';
import { layoutImageBand } from '../layout-image.js';
import { checked } from '../reveal-visibility.js';
import { imageFillTextSize } from '../slide-fill-text.js';
import { imageContrast, imageProblems, imageRects, imageSizeFindings } from '../verify-image.js';
export const imageDefinition = {
    type: 'image',
    selfDimming: true,
    spotlight: imageSpotlight,
    describe: data => data.alt ? ['image', `画像: ${oneLine(data.alt)}`] : undefined,
    textSizes: band => sizesOf(band.plates),
    fillTextSize: imageFillTextSize,
    internal: true,
    layout: layoutImageBand,
    children: data => data.children ?? [],
    stackWidth: (data, width) => imageSize(data, width).w - 2 * (data.pad ?? IMAGE_PAD),
    measure(data, { atoms, roles }) {
        for (const [text, size, weight, font] of imageTexts(data, roles))
            atoms(text, size, weight, font);
    },
    revealElements(data, start, stop) {
        let last = start;
        const items = [data.marks ?? [], data.labels ?? []].flatMap((elements, group) => elements.map((item, i) => {
            const where = `image() ${group === 0 ? 'mark' : 'label'} ${i + 1}`;
            const reveal = Math.max(start, checked(item.reveal, where) ?? 0);
            const end = Math.min(stop ?? Infinity, checked(item.until, `${where} (until)`) ?? Infinity);
            if (end <= reveal)
                throw new Error(`${where}: until must be later than reveal`);
            last = Math.max(last, Number.isFinite(end) ? end : reveal);
            return { ...('id' in item ? { id: item.id } : {}), reveal, ...(Number.isFinite(end) ? { until: end } : {}) };
        }));
        return { last, warnings: [], items };
    },
    emit: (laid, { theme, tones, stage }) => renderImage(laid, theme, tones, stage),
    verify: {
        rects: imageRects,
        findings: imageSizeFindings,
        check: laid => imageProblems(laid).map(message => ({ rule: 'image', severity: 'problem', message })),
        contrast: (laid, { theme, tones, appearance }) => imageContrast(laid, theme, appearance, tones),
    },
};
/** Embed a raster data URI without a file loader. */
export function image(src, opts) {
    if (!src.startsWith('data:'))
        throw new Error('image(): pass a PNG, JPEG, GIF or WebP data URI to svg-diagram/bands/image');
    const data = build(src, opts);
    return band(imageDefinition, data);
}
