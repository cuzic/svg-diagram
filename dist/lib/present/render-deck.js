// A deck's slides as outlined SVGs, for `serve` (ADR 0056 D2, D5): the figures drawn as `pptx-deck` draws them, the slide's text wrapped
// with the same measuring, everything placed by lib/deck-layout.ts and outlined with the project's font files (lib/font-metrics.ts).
import { createHash } from 'node:crypto';
import { chooseColumns, columnWidths, deckTexts, figureRooms, maxScale, planDeckLayout, roomMessage, smallTextWarning } from '../deck-layout.js';
import { autoColumns, fitOf, sharedColumns } from '../deck-spec-core.js';
import { figureKey, hasSource } from '../deck-file.js';
import { drawColumnFigure, renderDeckFigure } from '../deck-render-figure.js';
import { figureMinPt } from '../pptx/deck-figure.js';
import { measureAll, splitAtoms, textWidth } from '../measure.js';
import { outlineFontFromFiles, textBox } from '../font-metrics.js';
import { minTextPt, placeShapes } from '../pptx/deck.js';
import { fontsOf, planSlide } from '../pptx/slide.js';
import { slideSvg, slideText } from './slide-svg.js';
import { checkSlideSvg } from './svg-allow.js';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const key = (atom, size, weight) => `${size}|${weight}|${atom}`;
/**
 * Every slide of `loaded` drawn. `fresh`: re-read the .ts figures (a watcher). `cache`: slides drawn before, by their input; a slide without
 * a .ts figure is taken from it when its input (all but the notes), the project's settings and `fontStamp` are the same. A slide with a .ts
 * figure (its own or a column's) is always drawn (what it imports is not in the key). The cache keeps only this deck's slides afterwards.
 */
export async function renderDeck(loaded, cfg, opts = {}) {
    const { deck, sources } = loaded;
    const errors = [], warnings = [];
    const cache = opts.cache, settings = JSON.stringify([cfg, opts.fontStamp ?? '']);
    const keys = deck.slides.map((s, i) => {
        if (!cache || hasSource(sources, i))
            return null;
        const { notes: _n, ...drawn } = s;
        return sha256(JSON.stringify([drawn, fitOf(deck, s), settings]));
    });
    const hit = keys.map(k => (k && cache?.get(k)) || null);
    // the slide's own text is measured as `pptx-deck` measures it: in one batch, by atoms (only the slides to draw)
    const requests = new Map();
    deck.slides.forEach((s, i) => { if (!hit[i])
        for (const t of deckTexts(s))
            for (const atom of splitAtoms(t.text))
                requests.set(key(atom, t.size, t.bold ? 700 : 400), { text: atom, size: t.size, weight: t.bold ? 700 : 400 }); });
    const measured = await measureAll(requests);
    const widthOf = (atom, size, weight) => measured.get(key(atom, size, weight))?.w ?? atom.length * size;
    const width = (text, size, bold) => textWidth(widthOf, text, size, bold ? 700 : 400);
    /** A figure drawn: slide i's own, or its column j's (ADR 0058); undefined when there is none, null when it failed. */
    const draw = async (i, spec, fit, room, j, columnPx) => {
        const source = sources.get(figureKey(i, j));
        if (spec === undefined && !source)
            return undefined;
        const r = await renderDeckFigure(i, spec, source, cfg, fit === 'fill' && room ? { fresh: opts.fresh, column: j, fill: { box: room, cap: maxScale(fit) } } : { fresh: opts.fresh, column: j, columnPx });
        if (!r.ok) {
            errors.push(...r.errors);
            return null;
        }
        const lo = r.result.laidOut;
        return { svg: r.result.svg, w: Math.max(96, lo.width), h: Math.max(96, lo.canvasHeight), title: lo.title ?? '', laidOut: lo, warnings: [...(r.fallback ? [r.fallback] : []), ...r.result.verdict.warnings] };
    };
    // the columns' shares chosen from what they hold where they are left to choice (ADR 0061)
    const shares = deck.slides.map(() => undefined);
    const chosenFigures = await Promise.all(deck.slides.map(async (s, i) => {
        if (hit[i] || !s.columns || !autoColumns(deck, s))
            return undefined;
        const columns = s.columns, failures = [];
        const chosen = await chooseColumns({ ...s, columns }, width, maxScale(fitOf(deck, s)), async (j, w) => {
            const d = await drawColumnFigure(i, j, columns[j]?.figure, sources.get(figureKey(i, j)), cfg, w, figureMinPt, opts.fresh);
            if (!d.ok && w === null && d.errors)
                failures[j] = d.errors;
            return d;
        });
        if (!chosen.ok) {
            errors.push(...failures.flat(), ...(failures.length ? [] : [`slides[${i}].columns: ${chosen.why}`]));
            return null;
        }
        shares[i] = chosen.shares;
        return chosen.figures.map(f => {
            if (!f)
                return undefined;
            const lo = f.value.laidOut;
            return { svg: f.value.svg, w: Math.max(96, lo.width), h: Math.max(96, lo.canvasHeight), title: lo.title ?? '', laidOut: lo, warnings: f.value.verdict.warnings };
        });
    }));
    const shared = deck.slides.map((s, i) => ({ ...s, columns: s.columns && sharedColumns(s.columns, shares[i]) }));
    const rooms = shared.map(s => figureRooms(s, width));
    const figures = await Promise.all(deck.slides.map((s, i) => hit[i] || chosenFigures[i] !== undefined ? undefined : draw(i, s.figure, fitOf(deck, s), rooms[i]?.figure ?? null)));
    const columnFigures = await Promise.all(shared.map((s, i) => {
        const chosen = chosenFigures[i];
        if (chosen === null)
            return [null];
        if (chosen)
            return chosen;
        return hit[i] ? [] : Promise.all((s.columns ?? []).map((c, j, all) => c.text === undefined ? draw(i, c.figure, fitOf(deck, s), rooms[i]?.columns[j] ?? null, j, columnWidths(all)[j]) : undefined));
    }));
    const font = outlineFontFromFiles(cfg.fonts);
    const box = (t, family, size, weight) => textBox(t, family, size, weight, cfg.fonts);
    const pptxFonts = fontsOf(undefined);
    /** The smallest text of a figure scaled by k, counted as the .pptx counts it (ADR 0056 D2: the same warning on both). */
    const smallText = (f, k) => {
        const plan = planSlide(f.laidOut, pptxFonts), inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(plan.xml)?.[1] ?? '';
        return smallTextWarning({ scale: k, minTextPt: minTextPt(placeShapes(inner, k, 0, 0)) });
    };
    const slides = shared.map((s, i) => {
        const here = `slides[${i}]`;
        const cached = hit[i];
        if (cached) {
            for (const w of cached.warnings)
                warnings.push(`${here}${w.at}: ${w.text}`);
            return { ...cached.slide, notes: s.notes ?? '' };
        }
        const f = figures[i], cols = columnFigures[i] ?? [];
        if (f === null || cols.some(c => c === null))
            return null;
        const said = [...(f?.warnings ?? []).map(text => ({ at: '.figure', text })),
            ...cols.flatMap((c, j) => (c?.warnings ?? []).map(text => ({ at: `.columns[${j}].figure`, text })))];
        const layout = planDeckLayout(s, f, width, s.columns?.map((c, j) => ({ caption: c.caption, text: c.text, width: c.width, figure: cols[j] ?? undefined })), s.columnScale, fitOf(deck, s));
        if (layout.noRoom) {
            errors.push(`${here}: ${roomMessage(f !== undefined || cols.some(Boolean), s.layout === 'cover')}`);
            return null;
        }
        const crowded = layout.columns.flatMap((c, j) => c.noRoom ? [s.columns?.[j]?.text !== undefined
                ? `${here}.columns[${j}].text: the text does not fit the column: shorten it, or give the column a larger width`
                : `${here}.columns[${j}]: the heading, lead, callouts and source leave the column's figure no room: shorten them, or split the slide`] : []);
        if (crowded.length) {
            errors.push(...crowded);
            return null;
        }
        if (f && layout.figure) {
            const w = smallText(f, layout.figure.k);
            if (w)
                said.push({ at: '.figure', text: w });
        }
        layout.columns.forEach((c, j) => { const cf = cols[j]; if (cf && c.figure) {
            const w = smallText(cf, c.figure.k);
            if (w)
                said.push({ at: `.columns[${j}].figure`, text: w });
        } });
        const out = slideSvg(layout, f ? { svg: f.svg } : undefined, font, box, cols.map(c => c ? { svg: c.svg } : undefined));
        for (const m of out.missing)
            errors.push(`${here}: no font has a glyph for 「${m.char}」 (in 「${m.text}」): name a font that has it in .svg-diagram.json "fonts"`);
        for (const u of out.unsupported)
            errors.push(`${here}: text drawn with ${u} cannot be outlined, so the slide would lose it: take it out of the figure`);
        if (out.liveEmoji.length)
            said.push({ at: '', text: `emoji ${[...new Set(out.liveEmoji)].join(' ')} are left to the viewer's emoji font (no outline for them), so their width may differ from the measured one` });
        const allowed = checkSlideSvg(out.svg);
        if (!allowed.ok)
            for (const p of allowed.problems)
                errors.push(`${here}: the slide SVG has ${p.what} (${p.where})`);
        if (out.missing.length || out.unsupported.length || !allowed.ok)
            return null;
        for (const w of said)
            warnings.push(`${here}${w.at}: ${w.text}`);
        const firstTitle = f?.title ?? cols.find(c => c)?.title;
        const slide = { svg: out.svg, hash: sha256(out.svg), text: slideText(s, f?.title, cols.map(c => c?.title)), title: s.title ?? firstTitle ?? '' };
        const k = keys[i];
        if (k && cache)
            cache.set(k, { slide, warnings: said });
        return { ...slide, notes: s.notes ?? '' };
    });
    if (cache) {
        const live = new Set(keys.filter((k) => k !== null));
        for (const k of cache.keys())
            if (!live.has(k))
                cache.delete(k);
    }
    return { title: deck.title ?? '', slides, errors, warnings };
}
