import { prepareBands } from './core.js';
import { htmlDocument, stripSvg } from './html-document.js';
import { htmlAdapterFor } from './html-adapter.js';
import { visibleAt } from './reveal-visibility.js';
import { toneEnv } from './tokens.js';
/** Render selected bands to HTML, reporting the parts embedded as SVG. */
export async function renderBandsHtml(bands, opts) {
    if (opts.id !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(opts.id))
        throw new Error('renderBandsHtml: id must be a CSS identifier (letters, digits, underscores or hyphens, starting with a letter)');
    const adapters = opts.adapters ?? {};
    const { placed, stage, verdict, emit } = await prepareBands(bands, opts);
    const tones = toneEnv(placed.tones);
    const fallbacks = [];
    const visible = placed.laidOut.filter(band => visibleAt(band, stage));
    const parts = [];
    let svgRun = [];
    let rawRun = false;
    const addSvg = (bands, connects = [], raw = false) => {
        const svg = emit({ ...placed, laidOut: bands, connects }, true);
        parts.push(opts.overlay && !raw ? opts.overlay(svg, opts.fontBox) : stripSvg(svg, 'sd-ov sd-raw'));
    };
    const flush = () => {
        if (svgRun.length)
            addSvg(svgRun, [], rawRun);
        svgRun = [];
    };
    for (const band of visible) {
        const adapter = htmlAdapterFor(adapters, band);
        if (adapter?.accepts(band)) {
            flush();
            parts.push(adapter.render(band, placed.day, tones, opts.fontBox, placed.roles, stage));
        }
        else {
            fallbacks.push({ type: band.type, ...('id' in band && band.id ? { id: band.id } : {}) });
            const raw = band.type === 'raw' || band.type === 'wordart';
            if (opts.overlay && raw !== rawRun)
                flush();
            rawRun = raw;
            svgRun.push(band);
        }
    }
    flush();
    const connects = placed.connects.filter(connect => visibleAt(connect, stage));
    if (connects.length) {
        fallbacks.push(...connects.map(() => ({ type: 'connect' })));
        addSvg([], connects);
    }
    if (opts.strict && fallbacks.length) {
        throw new Error(`renderBandsHtml: SVG fallback for ${fallbacks.map(item => item.id ? `${item.type} "${item.id}"` : item.type).join(', ')}`);
    }
    return { html: htmlDocument(placed, tones, parts.join(''), opts.id), width: placed.width, height: placed.canvasHeight, fallbacks, verdict };
}
