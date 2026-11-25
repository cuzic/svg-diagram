// Browser worksheet rendering (ADR 0074 D5): use the diagram pipeline for placement, then fill the slots of that SVG.
import { comic } from '../dsl/comic.js';
import { diagram } from '../dsl/diagram.js';
import { FONT_STACKS } from '../tokens.js';
import { renderInBrowser } from '../web.js';
import { BADGE_OVERHANG, bandWidth } from './constants.js';
import { renderComicBand } from './emit.js';
import { comicGeometry } from './geometry.js';
import { LAYOUT_GRID, panelSize } from './layout.js';
import { valueAtoms, valueFindings } from './slot-values.js';
export function replaceComicFragment(svg, original, filled) {
    const start = svg.indexOf(original);
    if (start < 0 || svg.indexOf(original, start + original.length) >= 0) {
        throw new Error('renderComic: 元のマンガの断片が SVG に 1 つだけあることを確認してください');
    }
    return svg.slice(0, start) + filled + svg.slice(start + original.length);
}
function thumbnailOf(laid, panelId, { width }) {
    const panel = laid.panels.find(p => p.id === panelId);
    if (!panel)
        throw new Error(`renderComic.thumbnail: コマ "${panelId ?? ''}" がありません。ワークシートにあるコマの id を指定してください`);
    if (!Number.isFinite(width) || width <= 0)
        throw new Error('renderComic.thumbnail: width に正の有限数を指定してください');
    const { x, y, w, h } = panel;
    const margin = BADGE_OVERHANG, cropW = w + 2 * margin, cropH = h + 2 * margin;
    const fragment = renderComicBand({ ...laid, panels: [panel], bubbles: laid.bubbles.filter(b => b.panel === panel.id), blank: 'line' });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - margin} ${y - margin} ${cropW} ${cropH}" width="${width}" height="${cropH * width / cropW}"><style>text { font-family: ${FONT_STACKS.sans}; }</style>${fragment}</svg>`;
}
export async function renderComic(sheet, opts) {
    if (typeof opts?.measure !== 'function')
        throw new Error('renderComic: opts.measure に文字幅の測定関数を渡してください');
    const { measure, characters, aspect, nodeIds } = opts;
    const values = { ...opts.values };
    const band = comic(sheet, { ...(characters === undefined ? {} : { characters }), ...(aspect === undefined ? {} : { aspect }) });
    // The comic band fills diagram()'s content width, inside the default 20px padding on each side.
    const pad = 20;
    const width = bandWidth(LAYOUT_GRID[band.sheet.layout].cols, panelSize(band.sheet.layout, aspect).w) + 2 * pad;
    const base = await renderInBrowser(diagram({ theme: 'blue', title: band.sheet.title, legend: false, width, pad }).add(band), { measure, ...(nodeIds === undefined ? {} : { nodeIds }) });
    const laid = base.laidOut.laidOut.find(b => b.type === 'comic');
    if (!laid)
        throw new Error('renderComic: 配置したマンガの帯が見つかりません。ワークシートのコマを確認してください');
    const emitted = nodeIds ? { ...laid, nodeIds: true } : laid;
    const memo = new Map();
    const key = (text, size, weight, font) => JSON.stringify([text, size, weight, font]);
    for (const req of valueAtoms(laid, values)) {
        const k = key(req.text, req.size, req.weight, req.font);
        if (!memo.has(k))
            memo.set(k, Promise.resolve().then(() => measure(req)));
    }
    const measured = new Map(await Promise.all([...memo].map(async ([k, answer]) => [k, await answer])));
    const widthOf = (text, size, weight, font) => {
        const answer = measured.get(key(text, size, weight, font));
        if (!answer)
            throw new Error(`renderComic: "${text}" (${size}px) の幅がありません。測定関数を確認してください`);
        return answer.w;
    };
    const svg = replaceComicFragment(base.svg, renderComicBand(emitted), renderComicBand(emitted, values, widthOf));
    const defaultPanel = band.sheet.panels.find(p => p.thumb)?.id ?? emitted.panels[0]?.id;
    return {
        ...base,
        svg,
        findings: valueFindings(band.sheet, laid, values, widthOf),
        geometry: comicGeometry(laid),
        thumbnail: (panelId, opts) => thumbnailOf(emitted, panelId ?? defaultPanel, opts),
    };
}
