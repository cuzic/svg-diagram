// A deck (lib/deck-spec.ts) as one PowerPoint file of 16:9 slides, where there is no file system and no native code, such as a Cloudflare
// Worker ("svg-diagram/pptx/deck/edge", ADR 0055). Each figure is drawn as renderPptxEdge draws one (native shapes, pictures with a PNG
// fallback) and scaled onto its slide with the heading, lead, callouts, source and notes (lib/pptx/deck.ts).
import { capped } from './spec.js';
import { autoColumns, columnFallbackWarning, columnFigurePath, columnSpec, figurePath, fitOf, sharedColumns, validateDeck } from './deck-spec.js';
import { chooseColumns, columnWidths, figureRooms, fillSearch, maxScale, ruleIds } from './deck-layout.js';
import { guardedEngine } from './spec-edge.js';
import { planFigureEdge, zipPackage } from './pptx-edge.js';
import { deckEntries, minTextPt, placeShapes, planDeckSlide, slideIssues } from './pptx/deck.js';
import { fontsOf } from './pptx/slide.js';
export { TextEngineError } from './spec-edge.js';
export { deckSchema, validateDeck, MAX_SLIDES } from './deck-spec.js';
const none = (issues) => ({ pptx: null, issues: capped(issues), warnings: [], slides: [] });
/**
 * The deck as a .pptx. A bad deck, a figure that cannot be laid out or a slide with no room for its figure comes back as issues; a failure of
 * the engine throws TextEngineError, and one of `rasterize` throws as it is. Each figure's own checks are renderSpecEdge's: run that first.
 */
export async function renderDeckPptxEdge(input, givenEngine, opts) {
    const pngScale = opts.pngScale ?? 2;
    if (!(Number.isFinite(pngScale) && pngScale > 0))
        throw new Error(`pngScale must be a positive number (got ${String(pngScale)})`);
    const invalid = validateDeck(input);
    if (invalid.length)
        return none(invalid);
    const deck = input, engine = guardedEngine(givenEngine), fonts = fontsOf(opts.font);
    const issues = [];
    /** A figure planned as PowerPoint shapes: slide i's own, or its column j's (ADR 0058). */
    const fallbacks = [];
    const width = (text, size, bold) => engine.textBox(text, 'sans', size, bold ? 700 : 400).w;
    const plan = async (i, spec, fit, room, j, columnPx) => {
        if (spec === undefined)
            return undefined;
        const place = (p) => j === undefined ? figurePath(i, p) : columnFigurePath(i, j, p);
        // 'fill' (ADR 0060): a spec that gives no width of its own is laid out at the width that draws it largest in its room
        if (fit === 'fill' && room && typeof spec === 'object' && spec !== null && !Array.isArray(spec) && spec.width === undefined) {
            let firstIssues = [];
            const found = await fillSearch(room, maxScale(fit), async (w) => {
                const f = await planFigureEdge(w === null ? spec : { ...spec, width: w }, engine, opts);
                if ('issues' in f) {
                    if (w === null)
                        firstIssues = f.issues;
                    return { ok: false, why: f.issues[0]?.message ?? '' };
                }
                return { ok: true, w: f.width, h: f.height, value: f, flags: ruleIds(f.findings) };
            });
            if (!found.ok) {
                issues.push(...firstIssues.map(x => ({ path: place(x.path), message: x.message })));
                return undefined;
            }
            if (j !== undefined && found.width === null && found.narrower)
                fallbacks.push({ path: place(''), message: columnFallbackWarning(found.narrower.width, found.narrower.why) });
            const f = found.value;
            return { plan: f.plan, w: f.width, h: f.height, native: f.native };
        }
        // a column's figure is laid out at the column's width when it gives none; when it does not fit there, at the document's (ADR 0059)
        const narrow = j !== undefined && columnPx !== undefined ? columnSpec(spec, columnPx) : { spec, auto: null };
        let f = await planFigureEdge(narrow.spec, engine, opts);
        if ('issues' in f && narrow.auto !== null) {
            const why = f.issues[0]?.message ?? '', wide = await planFigureEdge(spec, engine, opts);
            if (!('issues' in wide))
                fallbacks.push({ path: columnFigurePath(i, j, ''), message: columnFallbackWarning(narrow.auto, why) });
            f = wide;
        }
        if ('issues' in f) {
            issues.push(...f.issues.map(x => ({ path: j === undefined ? figurePath(i, x.path) : columnFigurePath(i, j, x.path), message: x.message })));
            return undefined;
        }
        return { plan: f.plan, w: f.width, h: f.height, native: f.native };
    };
    const figures = [], columnFigures = [], shares = [];
    for (const [i, s] of deck.slides.entries()) {
        const fit = fitOf(deck, s);
        if (s.columns && autoColumns(deck, s)) {
            // the columns' shares chosen from what they hold (ADR 0061)
            const columns = s.columns;
            const chosen = await chooseColumns({ ...s, columns }, width, maxScale(fit), async (j, w) => {
                const spec = columns[j]?.figure;
                const searchable = typeof spec === 'object' && spec !== null && !Array.isArray(spec) && spec.width === undefined;
                if (w !== null && !searchable)
                    return { ok: false, why: 'the figure has a width of its own' };
                const f = await planFigureEdge(w === null ? spec : { ...spec, width: w }, engine, opts);
                if ('issues' in f) {
                    if (w === null)
                        issues.push(...f.issues.map(x => ({ path: columnFigurePath(i, j, x.path), message: x.message })));
                    return { ok: false, why: f.issues[0]?.message ?? '' };
                }
                const inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(f.plan.xml)?.[1] ?? '';
                return { ok: true, w: f.width, h: f.height, value: f, flags: ruleIds(f.findings), minPt: minTextPt(placeShapes(inner, 1, 0, 0)) };
            });
            if (!chosen.ok) {
                if (!issues.length)
                    issues.push({ path: `slides[${i}].columns`, message: chosen.why });
                figures.push(undefined);
                columnFigures.push([]);
                shares.push(undefined);
                continue;
            }
            figures.push(undefined);
            columnFigures.push(chosen.figures.map(f => f ? { plan: f.value.plan, w: f.value.width, h: f.value.height, native: f.value.native } : undefined));
            shares.push(chosen.shares);
            continue;
        }
        const cols0 = s.columns ? sharedColumns(s.columns) : undefined, rooms = figureRooms({ ...s, columns: cols0 }, width);
        figures.push(await plan(i, s.figure, fit, rooms.figure));
        const cols = [];
        const px = columnWidths(cols0 ?? []);
        for (const [j, c] of (s.columns ?? []).entries())
            cols.push(await plan(i, c.figure, fit, rooms.columns[j] ?? null, j, px[j]));
        columnFigures.push(cols);
        shares.push(undefined);
    }
    if (issues.length)
        return none(issues);
    const planned = deck.slides.map(({ figure: _spec, columns, ...s }, i) => {
        const f = figures[i];
        const cols = columns && sharedColumns(columns, shares[i]).map((c, j) => ({ caption: c.caption, text: c.text, width: c.width, figure: columnFigures[i]?.[j] }));
        return planDeckSlide({ ...s, fit: fitOf(deck, deck.slides[i] ?? {}), ...(f ? { figure: f } : {}), ...(cols ? { columns: cols } : {}) }, fonts, width);
    });
    const warnings = [...fallbacks];
    planned.forEach((p, i) => {
        const r = slideIssues(p, i, figures[i] !== undefined, (deck.slides[i]?.columns ?? []).map(c => c.text === undefined ? 'figure' : 'text'));
        issues.push(...r.errors);
        warnings.push(...r.warnings);
    });
    if (issues.length)
        return none(issues);
    const pngs = [];
    for (const p of planned) {
        const list = [];
        for (const pic of p.pictures)
            list.push(await opts.rasterize(pic.pngSvg, pngScale));
        pngs.push(list);
    }
    const pptx = await zipPackage(deckEntries(planned, pngs, deck.title));
    return { pptx, issues: [], warnings: capped(warnings), slides: planned.map((p, i) => ({ scale: p.scale, minTextPt: p.minTextPt, native: (figures[i]?.native ?? 0) + (columnFigures[i] ?? []).reduce((n, f) => n + (f?.native ?? 0), 0), pictures: p.pictures.length, columns: (p.columns ?? []).map(c => ({ scale: c.scale, minTextPt: c.minTextPt })) })) };
}
