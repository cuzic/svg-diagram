// diagram() and the pure preparation the renderers share.
// Split from render.ts (which reads files and the slide budget) so the browser entry (lib/web.ts) draws a figure without any of that.
import { mapOf, checkTones, NO_TONES, THEMES, SLIDE_CANVAS, checkMinText } from '../tokens.js';
import { applyConnectDefaults, connectBand } from './defaults.js';
import { applyWireframeDefaults } from './wireframe-numbering.js';
import { fillAutoToday } from '../today-auto.js';
import { walkAnyBands as walkBands } from '../full-definitions.js';
import { rewrite } from './rewrite.js';
import { captureHere, sourceOf, withSource } from '../source-ref.js';
import { cloneData } from '../clone-data.js';
import { sourceCaptureEnabled } from '../source-capture.js';
export { layoutFitted } from '../layout-fit-width.js';
export function diagram(opts = {}) {
    // `theme` (name from tokens.ts PALETTE) is the general form; `day` (1|2) is the
    // training deck's legacy spelling of the same thing. Stored as d.day internally.
    const theme = opts.theme ?? opts.day;
    if (!THEMES.map(String).includes(String(theme)))
        throw new Error(`diagram({theme}) must be one of ${THEMES.join(', ')} (or legacy day: 1|2)`);
    if (typeof opts.spotlight === 'object' && opts.spotlight.mutedOk !== undefined && typeof opts.spotlight.mutedOk !== 'boolean')
        throw new Error(`diagram({spotlight: {mutedOk}}) must be true or false (got ${String(opts.spotlight.mutedOk)})`);
    if (typeof opts.spotlight === 'object' && opts.spotlight.dim !== undefined && !['outline', 'fill'].includes(opts.spotlight.dim))
        throw new Error(`diagram({spotlight: {dim}}) must be 'outline' or 'fill' (got ${String(opts.spotlight.dim)})`);
    if (opts.appearance !== undefined && !['light', 'dark', 'auto'].includes(opts.appearance) && !(typeof opts.appearance === 'object' && opts.appearance && typeof opts.appearance.dark === 'object'))
        throw new Error(`diagram({appearance}) must be 'light', 'dark', 'auto' or {dark: {bg, text, ...}} (got ${JSON.stringify(opts.appearance)})`);
    if (opts.keepWords !== undefined && typeof opts.keepWords !== 'boolean')
        throw new Error(`diagram({keepWords}) must be true or false (got ${JSON.stringify(opts.keepWords)})`);
    if (opts.density !== undefined && opts.density !== 'normal' && opts.density !== 'compact')
        throw new Error(`diagram({density}) must be 'normal' or 'compact' (got ${JSON.stringify(opts.density)})`);
    if (opts.wrap !== undefined && opts.wrap !== 'phrase' && opts.wrap !== 'char' && opts.wrap !== 'bunsetsu' && opts.wrap !== 'bunsetsu-soft')
        throw new Error(`diagram({wrap}) must be 'phrase', 'char', 'bunsetsu' or 'bunsetsu-soft' (got ${JSON.stringify(opts.wrap)})`);
    mapOf(NO_TONES, opts.appearance); // a custom dark set is validated here
    if (opts.sourceLine !== undefined && (typeof opts.sourceLine !== 'string' || !opts.sourceLine.trim() || /[\r\n]/.test(opts.sourceLine)))
        throw new Error('diagram({sourceLine}) must be a non-empty single-line string (e.g. "出典: 総務省 2025")');
    if (opts.showTitle !== undefined && typeof opts.showTitle !== 'boolean')
        throw new Error(`diagram({showTitle}) must be true or false (got ${JSON.stringify(opts.showTitle)})`);
    if (opts.showTitle && (typeof opts.title !== 'string' || !opts.title.trim()))
        throw new Error('diagram({showTitle: true}) needs a title: diagram({title: "...", showTitle: true})');
    if (opts.status !== undefined && opts.status !== 'draft')
        throw new Error(`diagram({status}) must be 'draft' (got ${JSON.stringify(opts.status)})`);
    if (opts.statusLabel !== undefined && (opts.status === undefined || typeof opts.statusLabel !== 'string' || !opts.statusLabel.trim() || /[\r\n]/.test(opts.statusLabel)))
        throw new Error('diagram({statusLabel}) must be a non-empty single-line string and goes with diagram({status}) (e.g. "仮説")');
    if (opts.layoutCheck === 'strict' && (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')) === 'slide')
        throw new Error("diagram({layoutCheck: 'strict'}) needs a document figure (theme: ...): slide figures (day: ...) are not given the layout-* checks, so it would never warn");
    if (opts.layoutCheck !== undefined && opts.layoutCheck !== 'info' && opts.layoutCheck !== 'strict')
        throw new Error(`diagram({layoutCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.layoutCheck)})`);
    if (opts.tocCheck !== undefined && opts.tocCheck !== 'info' && opts.tocCheck !== 'strict')
        throw new Error(`diagram({tocCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.tocCheck)})`);
    if (opts.rcaCheck !== undefined && opts.rcaCheck !== 'info' && opts.rcaCheck !== 'strict')
        throw new Error(`diagram({rcaCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.rcaCheck)})`);
    if (opts.evidenceCheck !== undefined && opts.evidenceCheck !== 'info' && opts.evidenceCheck !== 'strict')
        throw new Error(`diagram({evidenceCheck}) must be 'info' or 'strict' (got ${JSON.stringify(opts.evidenceCheck)})`);
    if (opts.maxWidth !== undefined && !(typeof opts.maxWidth === 'number' && Number.isFinite(opts.maxWidth) && opts.maxWidth > 0))
        throw new Error(`diagram({maxWidth}) must be a positive number (got ${JSON.stringify(opts.maxWidth)})`);
    if (opts.legend !== undefined && opts.legend !== 'auto' && opts.legend !== false)
        throw new Error(`diagram({legend}) must be 'auto' or false (got ${JSON.stringify(opts.legend)})`);
    if (opts.canvas !== undefined && (opts.slide || opts.fill))
        throw new Error('diagram({canvas}) is a whole slide drawn 1:1; it cannot be combined with `slide` / `fill` (those fit a figure into a measured slot of a Slidev slide)');
    if (opts.width !== undefined && opts.width !== 'fit' && !(typeof opts.width === 'number' && Number.isFinite(opts.width) && opts.width > 0))
        throw new Error(`diagram({width}) must be a positive number or 'fit' (got ${JSON.stringify(opts.width)})`);
    if (opts.width === 'fit' && (opts.canvas !== undefined || opts.fill || opts.slide))
        throw new Error("diagram({width: 'fit'}) is for a document figure: a `canvas` is drawn 1:1, and `fill` / `slide` fit a measured slot");
    if (opts.canvas !== undefined && opts.canvas !== 'slide' && opts.canvas.minText !== undefined)
        checkMinText(opts.canvas.minText, 'diagram({canvas: {minText}})');
    if (opts.canvas !== undefined && opts.canvas !== 'slide' && opts.canvas.fit !== undefined && opts.canvas.fit !== 'content')
        throw new Error(`diagram({canvas: {fit}}) must be 'content' (the canvas shrinks to its content, up to height) or left out (got ${JSON.stringify(opts.canvas.fit)})`);
    const canvas = opts.canvas === undefined ? undefined : { ...SLIDE_CANVAS, ...(opts.canvas === 'slide' ? {} : opts.canvas) };
    const d = {
        day: theme,
        appearance: opts.appearance, transparent: opts.transparent,
        // 'slide' (legacy day: 1|2 diagrams) gets slide-fit warnings; 'doc' (theme: ...) does not.
        medium: (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')),
        title: opts.title, desc: opts.desc, // exposed as the SVG's <title> / <desc> (doc medium)
        terms: opts.terms,
        accept: opts.accept, // {'rule-id': 'why this finding is fine'} — shown as info instead of a warning
        wrap: opts.wrap,
        keepWords: opts.keepWords,
        ...(opts.density === undefined ? {} : { density: opts.density }),
        tones: opts.tones === undefined ? undefined : checkTones(opts.tones, 'diagram({tones})'),
        legend: opts.legend, legendLabels: opts.legendLabels, // legend: 'auto' adds entries for every notation used but not listed
        width: opts.width === 'fit' ? 940 : opts.width ?? canvas?.width ?? 940,
        ...(opts.width === 'fit' ? { fitWidth: true } : {}),
        ...(opts.maxWidth === undefined ? {} : { maxWidth: opts.maxWidth }), // the doc-width threshold (not the layout width), the project's maxWidth is used only when this is left out
        canvas,
        pad: opts.pad ?? 20,
        gap: opts.gap ?? 16,
        maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
        minEffectiveFont: opts.minEffectiveFont,
        slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
        connectDefaults: opts.connectDefaults, wireframeDefaults: opts.wireframeDefaults,
        spotlight: opts.spotlight,
        sourceLine: opts.sourceLine,
        ...(opts.showTitle ? { showTitle: true } : {}), // a figure without it is unchanged
        ...(opts.status === undefined ? {} : { status: opts.status, ...(opts.statusLabel === undefined ? {} : { statusLabel: opts.statusLabel }) }), // a figure without a status is unchanged
        layoutCheck: opts.layoutCheck, // check only: the severity of the layout-* findings; never reaches the drawing
        tocCheck: opts.tocCheck, // check only: the severity of the toc-* findings; never reaches the drawing
        rcaCheck: opts.rcaCheck, // check only: the severity of the cause-analysis findings (fta-* etc.); never reaches the drawing
        evidenceCheck: opts.evidenceCheck, // check only: turns on stat-no-source; never reaches the drawing
        fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
        bands: [],
    };
    return withSource({
        ...d,
        add: function add(...bands) {
            let flat = bands.flat();
            if (d.connectDefaults)
                flat = applyConnectDefaults(flat, d.connectDefaults);
            if (d.wireframeDefaults)
                flat = applyWireframeDefaults(flat, d.wireframeDefaults);
            for (const rule of [opts.transform ?? []].flat())
                flat = rewrite(flat, rule);
            if (sourceCaptureEnabled()) {
                let source;
                for (const band of walkBands(flat)) {
                    if (sourceOf(band) === undefined)
                        withSource(band, source ??= captureHere(add));
                }
            }
            d.bands.push(...flat);
            return this;
        },
        connect: function connect(from, to, opts = {}) {
            return this.add(withSource(connectBand(from, to, opts), captureHere(connect)));
        },
        get bands() { return d.bands; },
    }, captureHere(diagram));
}
/** What the passes may write into: the bands are copied, so a band shared by two diagrams (or drawn twice) is never changed by a render. */
export function detachData(d) {
    const out = { ...d, bands: cloneData(d.bands) };
    // gantt({today: 'auto'}) takes the day the caller gave (never the clock); only then does the day go in the metadata
    if (fillAutoToday(walkBands(out.bands), out.today) && out.source)
        out.source = { ...out.source, today: out.today };
    return out;
}
