import { outlineText } from './svg-outline.js';
import { missingIssues } from './spec-edge-core.js';
import { zipEntries } from './pptx/zip.js';
export const noPptx = (issues) => ({ pptx: null, issues, native: 0, pictures: 0 });
/** Raw deflate where the runtime has CompressionStream (Workers, browsers, Node 18+); stored otherwise. */
async function deflateRaw(data) {
    if (typeof CompressionStream === 'undefined')
        return undefined;
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** The entries zipped, the XML deflated where the runtime can (PNGs are stored: they are compressed already). */
export async function zipPackage(files) {
    const entries = [];
    for (const e of files)
        entries.push({ ...e, deflated: e.name.endsWith('.png') ? undefined : await deflateRaw(e.data) });
    return zipEntries(entries);
}
export function outlinePptxPictures(spec, plan, engine) {
    // a picture's text as outlines, an emoji as text the viewer's emoji font draws; a character the font lacks is the spec's to fix, as in drawing
    const missing = [];
    const outline = (svg) => { const o = outlineText(svg, engine.font, engine.textBox, { liveEmoji: true }); missing.push(...o.missing); return o.svg; };
    plan.pictures = plan.pictures.map(p => ({ svg: outline(p.svg), pngSvg: outline(p.pngSvg) }));
    return missing.length ? missingIssues(spec, missing) : [];
}
