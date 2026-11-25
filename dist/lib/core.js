import { buildInventoryWith, whole } from './inventory-core.js';
import { joinBandDescriptions } from './diagram-description.js';
import { definedDiagramTitle } from './diagram-title.js';
import { applyFindingAcceptance, at } from './finding-rules.js';
import { canvasFindings } from './canvas-findings.js';
import { splitAtoms } from './atoms.js';
import { band, defOf, DEF, EXTERNAL, walkDefinedBands } from './band-def.js';
import { cloneData } from './clone-data.js';
import { emitSvgWith } from './emit-svg-core.js';
import { analyzeDocumentFit } from './fit.js';
import { createLayoutWith } from './layout-core.js';
import { layoutFitted } from './layout-fit-width.js';
import { basicExtentOf, figureMetricsForExtent, layoutFinding, unionOf } from './figure-metrics.js';
import { addScoped, emptyScopes } from './scope-table.js';
import { qualify, scopeOf } from './scope-name.js';
import { atBand } from './source-ref.js';
import { definitionKey } from './figure-definitions.js';
import { collectRectsWith } from './verify-rects.js';
import { verifyWithServices } from './verify-core.js';
import { must } from './must.js';
import { checked, visibleAt } from './reveal-visibility.js';
import { checkToday } from './today-auto.js';
import { canvasFontScale, checkMinText, checkTones, colorOf, rolesAt, SLIDE_CANVAS, THEMES, toneEnv } from './tokens.js';
import { xmlProblems } from './xml-check.js';
function size(name, value, min) {
    if (!Number.isFinite(value) || value < min)
        throw new Error(`renderBands: ${name} must be finite and at least ${min}`);
    return value;
}
const keyOf = (text, size, weight, font) => JSON.stringify([text, size, weight, font]);
/** @internal Shared layout and SVG emission for selective output formats. */
export async function prepareBands(bands, opts) {
    const canvas = opts.canvas === undefined ? undefined : { ...SLIDE_CANVAS, ...opts.canvas };
    const { slide, fill, fitter, spotlighter } = opts;
    if (opts.spotlight !== undefined && !spotlighter) {
        throw new Error('renderBands: spotlight には svg-diagram/spotlight の spotlighter を spotlighter に指定してください');
    }
    if ((slide || fill) && !fitter) {
        throw new Error('renderBands: slide または fill には svg-diagram/slide-fill の slideFitter を fitter に指定してください');
    }
    if (fill && !slide)
        throw new Error('renderBands: fill には slide: {maxHeight, contentWidth} を指定してください');
    if (slide) {
        if (canvas || opts.width === 'fit')
            throw new Error("renderBands: slide を使う場合は canvas と width: 'fit' を外してください");
        size('slide.maxHeight', slide.maxHeight, 0);
        size('slide.contentWidth', slide.contentWidth, 1);
    }
    if (canvas) {
        if (opts.width !== undefined)
            throw new Error('renderBands: use canvas.width when canvas is set');
        checkMinText(canvas.minText, 'renderBands({canvas})');
        size('canvas height', canvas.height, 1);
    }
    const geometryScale = canvas ? canvasFontScale(canvas.minText) : 1;
    const requestedWidth = opts.width;
    const fitWidth = requestedWidth === 'fit';
    const width = size('width', fill && slide ? slide.contentWidth : fitWidth ? opts.diagramData?.width ?? 940 : requestedWidth ?? canvas?.width ?? 940, 1);
    const pad = size('pad', opts.pad ?? 20, 0);
    const gap = size('gap', opts.gap ?? 16, 0);
    const contentWidth = width - 2 * pad * geometryScale;
    size('content width', contentWidth, 1);
    const theme = opts.theme ?? 'blue';
    if (!THEMES.includes(String(theme)))
        throw new Error(`renderBands: unknown theme "${theme}"`);
    const tones = opts.tones === undefined ? undefined : checkTones(opts.tones, 'renderBands');
    const today = opts.today === undefined ? undefined : checkToday(opts.today, 'renderBands({today})');
    if (opts.stage !== undefined && (!Number.isInteger(opts.stage) || opts.stage < 0))
        throw new Error('renderBands: stage must be a nonnegative integer');
    const measureBands = [];
    const unscaledRoles = fill ? rolesAt(false, 1) : undefined;
    let largestFillText = 0;
    const ids = new Map();
    const endpointChecks = [];
    const definitions = new Map();
    const syntheticOutputs = new Map();
    const scopeTable = emptyScopes();
    let last = 0;
    const revealWarnings = [];
    const diagramChecks = new Set();
    const inputChecks = [];
    const source = cloneData(bands);
    const authored = opts.diagramData;
    const data = {
        ...authored,
        day: theme, medium: authored?.medium ?? (slide ? 'slide' : 'doc'), width, maxWidth: opts.maxWidth, accept: opts.accept, legend: opts.legend, pad, gap,
        maxDisplayHeight: slide?.maxHeight ?? authored?.maxDisplayHeight, usableWidth: slide?.contentWidth ?? authored?.usableWidth, minEffectiveFont: opts.minEffectiveFont,
        fill: authored?.fill ?? (fill === true), spotlight: opts.spotlight, bands: source, title: opts.title, desc: opts.desc, wrap: opts.wrap, keepWords: opts.keepWords, tones, canvas,
        appearance: opts.appearance, transparent: opts.transparent, density: opts.density, ...(fitWidth ? { fitWidth: true } : {}),
        tocCheck: opts.tocCheck, rcaCheck: opts.rcaCheck, layoutCheck: opts.layoutCheck, legendLabels: opts.legendLabels,
    };
    let nextLoopId = 0;
    const expandLoopBacks = (bands) => bands.flatMap(data => {
        const def = defOf(data);
        if (def?.internal)
            def.mapLoopBackChildren?.(data, expandLoopBacks);
        const loop = def?.loopBackSource?.(data);
        if (!loop)
            return [data];
        const connector = opts.connectors;
        if (!connector?.internal || !connector.loopBackConnectors) {
            throw new Error('renderBands: loopBack には bands/connect の connectDefinition を connectors に指定してください');
        }
        return [data, ...connector.loopBackConnectors(data, loop, () => `__loopback${nextLoopId++}`)
                .map(link => band(connector, link))];
    });
    data.bands = expandLoopBacks(source);
    if (opts.legend === 'auto')
        opts.addAutoLegend?.(data);
    if (opts.showTitle && opts.title || opts.sourceLine !== undefined) {
        const captions = opts.captions;
        if (!captions?.internal || !captions.decorateCaptions) {
            throw new Error('renderBands: pass captionDefinition as captions for showTitle or sourceLine');
        }
        data.bands = captions.decorateCaptions({ ...data, showTitle: opts.showTitle, sourceLine: opts.sourceLine });
    }
    let placeBox;
    let fitLayout;
    function collect(data, inheritedStart = 0, inheritedEnd = Infinity) {
        const def = defOf(data);
        if (!def || def.type !== data.type || def[EXTERNAL] || data.type.includes(':')) {
            throw new Error(`renderBands: import the supported band "${data.type}" from its svg-diagram/bands entry`);
        }
        const key = definitionKey(data);
        if (definitions.has(key) && definitions.get(key) !== def) {
            throw new Error(`renderBands: mixed definitions for "${data.type}"`);
        }
        definitions.set(key, def);
        if (def.internal) {
            placeBox ??= def.layoutBoxLike;
            fitLayout ??= def.fitLineScale;
            for (const [type, output] of Object.entries(def.outputDefinitions ?? {}))
                syntheticOutputs.set(type, output);
        }
        const reveal = data;
        const connector = authored && data.type === 'connect';
        const start = Math.max(checked(reveal.reveal, data.type) ?? 0, connector ? 0 : inheritedStart);
        const stop = Math.min(checked(reveal.until, `${data.type} (until)`) ?? Infinity, connector ? Infinity : inheritedEnd);
        const end = Number.isFinite(stop) ? stop : undefined;
        if (end !== undefined && end <= start) {
            throw new Error(authored ? `${data.type}(): until ${end} must be later than its reveal ${start || '(shown from the start)'}`
                : `renderBands: ${data.type} until must be later than its reveal`);
        }
        // Endpoint checks compare authored connector stages with the resolved stages of their anchors.
        const elements = def.revealElements?.(data, start, end);
        if (start)
            reveal.reveal = start;
        if (end !== undefined)
            reveal.until = end;
        last = Math.max(last, end ?? start);
        if (reveal.id) {
            if (ids.has(reveal.id))
                throw new Error(authored ? `duplicate anchor id "${reveal.id}": every band needs a unique id` : `renderBands: duplicate band id "${reveal.id}"`);
            ids.set(reveal.id, { start, end, band: data });
        }
        const scope = scopeOf(data);
        for (const id of def.ids?.(data) ?? []) {
            if (scope)
                addScoped(scopeTable, scope, id);
            ids.set(qualify(scope, id), { start, end });
        }
        if (elements) {
            last = Math.max(last, elements.last);
            revealWarnings.push(...elements.warnings);
            if (elements.checkEndpoints)
                endpointChecks.push(elements.checkEndpoints);
            for (const item of elements.items ?? []) {
                if (!item.id)
                    continue;
                if (scope)
                    addScoped(scopeTable, scope, item.id);
                ids.set(qualify(scope, item.id), { start: item.reveal ?? start, end: item.until ?? end });
            }
        }
        const diagramFindings = def.verify?.diagramFindings;
        if (typeof diagramFindings === 'function')
            diagramChecks.add(diagramFindings);
        else if (diagramFindings)
            for (const check of diagramFindings)
                diagramChecks.add(check);
        const findings = def.verify?.findings;
        if (findings)
            inputChecks.push(ctx => findings(data, ctx));
        if (def.measure)
            measureBands.push(data);
        if (unscaledRoles && def.fillTextSize)
            largestFillText = Math.max(largestFillText, def.fillTextSize(data, unscaledRoles));
        for (const generated of def.generated?.(data) ?? [])
            collect(generated, start, stop);
        for (const generated of opts.generatedBands?.(data) ?? [])
            collect(generated, start, stop);
        for (const child of def.children?.(data) ?? [])
            atBand(child, () => collect(child, start, stop));
        for (const [id, timing] of opts.revealAnchorSlots?.(data) ?? [])
            ids.set(id, timing);
    }
    for (const input of data.bands)
        atBand(input, () => collect(input));
    const placedDefinition = (band) => definitions.get(definitionKey(band)) ?? syntheticOutputs.get(band.type);
    const connection = definitions.get('connect');
    const layout = createLayoutWith({
        offGrid: data => defOf(data)?.offGrid === true,
        layoutBoxLike: placeBox,
        fitLineScale: fitLayout,
        connectorGaps: connection?.internal ? connection.connectorGaps : undefined,
        resolveConnect: (...args) => {
            const def = defOf(args[0]);
            return must(def?.internal ? def.resolveConnect : undefined)(...args);
        },
        resolve: input => {
            const def = must(defOf(input));
            if (def.internal)
                return def.layout;
            const place = def.layout;
            return (_band, ctx, x, w) => {
                const { laid, h, anchors } = place(input, { x, y: ctx.y, w, widthOf: ctx.widthOf, roles: ctx.roles, theme, tones: ctx.tones, wrap: ctx.wrap, keepWords: ctx.keepWords, space: ctx.space, today, canvas, geometryScale });
                const scope = scopeOf(input);
                if ('id' in input && input.id)
                    ctx.register(input.id, laid, 'each band needs a unique id');
                for (const anchor of anchors ?? []) {
                    if (anchor.id) {
                        const owner = input.type === 'chart' ? 'a chart mark' : input.type === 'gantt' ? 'a gantt task' : 'a figure item';
                        ctx.register(anchor.id, anchor, authored ? `${owner} takes an id that another anchor already has` : 'each anchor needs a unique id', scope);
                    }
                }
                ctx.laidOut.push((authored && scope ? { ...laid, scope } : laid));
                ctx.y += size('band height', h, 0) + ctx.d.gap;
            };
        },
        hasChildrenHandler: input => definitions.has(definitionKey(input)),
        childrenOf: input => defOf(input)?.children?.(input) ?? [],
        stackWidthOf: (input, width) => defOf(input)?.stackWidth?.(input, width) ?? null,
        areasPrelayoutFor: data => {
            const def = defOf(data);
            return def?.internal ? def.areasPrelayout : undefined;
        },
        scopesOf: () => scopeTable,
        buildInventory: (laidOut, connects, widthOf, labelSize) => {
            const items = buildInventoryWith((band, ctx) => placedDefinition(band)?.inventory?.(band, ctx) ?? whole(band, ctx), laidOut, widthOf);
            const connector = definitions.get('connect');
            const links = connector?.internal ? connector.connectorInventory?.(connects, labelSize) : undefined;
            return { items: links ? items.concat(links) : items };
        },
    });
    async function prepareLayoutAt(scale) {
        const roles = rolesAt(!!canvas, scale);
        const requests = new Map();
        const measureEnv = { roles, today, atoms(text, size, weight, font = 'sans') {
                for (const atom of splitAtoms(text))
                    requests.set(keyOf(atom, size, weight, font), { text: atom, size, weight, font });
            } };
        for (const band of measureBands)
            defOf(band)?.measure?.(band, measureEnv);
        const measured = 'measureBatch' in opts ? await opts.measureBatch(requests) : new Map(await Promise.all([...requests].map(async ([key, request]) => [key, await opts.measure(request)])));
        for (const { w } of measured.values())
            size('measured width', w, 0);
        const widthOf = (text, size, weight, font) => must(measured.get(keyOf(text, size, weight, font))?.w, `renderBands: width was not measured for "${text}"`);
        const spacing = canvas || slide ? { pad: Math.round(pad * scale), gap: Math.round(gap * scale) } : { pad, gap };
        return () => layout({ ...data, ...spacing }, roles, widthOf);
    }
    const fontScale = fill && slide && fitter
        ? await fitter.fontScale(slide.maxHeight, largestFillText, async (s) => {
            const place = await prepareLayoutAt(s);
            return place().canvasHeight;
        })
        : geometryScale;
    const placed = await layoutFitted(data, await prepareLayoutAt(fontScale));
    const { roles } = placed;
    placed.fontScale = fontScale;
    placed.canvasHeight = Math.max(1, placed.canvasHeight);
    const revealConnector = connection?.internal ? connection.revealConnector : undefined;
    if (revealConnector)
        placed.connects = placed.connects.map(connector => atBand(connector, () => {
            if (!authored)
                return revealConnector(connector, ids);
            const from = ids.get(connector.fromId), to = ids.get(connector.toId);
            const start = connector.reveal ?? Math.max(from?.start ?? 0, to?.start ?? 0);
            const stop = connector.until ?? Math.min(from?.end ?? Infinity, to?.end ?? Infinity);
            if (stop <= start) {
                throw new Error(`connect(${connector.fromLabel} -> ${connector.toLabel}): until ${stop} must be later than its reveal ${start || '(shown from the start)'} (an arrow between two things that are never on screen together has nothing to show)`);
            }
            return { ...connector, ...(start ? { reveal: start } : {}), ...(Number.isFinite(stop) ? { until: stop } : {}) };
        }));
    for (const check of endpointChecks)
        check(ids, scopeTable, revealWarnings);
    if (authored) {
        placed.maxReveal = last;
        placed.revealWarnings = revealWarnings;
    }
    if (placed.spotlight)
        spotlighter?.apply(placed, placedDefinition, scopeTable);
    const stage = opts.stage ?? last;
    const reveal = authored && opts.stage === undefined && stage === 0 ? undefined : stage;
    const ink = toneEnv(tones);
    const ctx = { theme, tones: ink, dimFill: spotlighter?.dim(placed) === 'fill', appearance: placed.appearance, rcaCheck: placed.rcaCheck, connects: placed.connects.map(c => ({ fromId: c.fromId, toId: c.toId, segments: c.pathSegments })) };
    const leaves = (figure) => figure.laidOut.flatMap(band => placedDefinition(band)?.verify?.targets?.(band) ?? ('h' in band ? [band] : []));
    const bandFindings = inputChecks.flatMap(check => check(ctx));
    if (!canvas) {
        const extents = placed.laidOut.flatMap(band => {
            const extentOf = placedDefinition(band)?.verify?.figureExtent;
            const extent = extentOf ? extentOf(band) : basicExtentOf(band);
            return extent ? [extent] : [];
        });
        for (const metric of figureMetricsForExtent(unionOf(extents), placed.width)) {
            bandFindings.push(layoutFinding(metric, placed.layoutCheck));
        }
    }
    for (const check of diagramChecks)
        bandFindings.push(...check(placed, stage, placedDefinition));
    for (const laid of placed.laidOut) {
        const def = placedDefinition(laid);
        bandFindings.push(...(def?.verify?.layoutFindings?.(laid, ctx) ?? []));
    }
    const fit = (fitter?.analyzeFit ?? analyzeDocumentFit)(placed, laid => placedDefinition(laid)?.textSizes?.(laid) ?? []);
    if (canvas) {
        bandFindings.push(...canvasFindings(canvas, fit.effectiveFont, placed.contentHeight));
    }
    if (opts.diagramFindings && !diagramChecks.has(opts.diagramFindings))
        bandFindings.push(...opts.diagramFindings(placed, stage, placedDefinition));
    const verdict = verifyWithServices({
        checkConnectionGeometry: connection?.internal ? connection.checkConnectionGeometry : undefined,
        collectRects: figure => collectRectsWith(figure, placedDefinition),
        contrastProblems: (figure, tones) => leaves(figure).flatMap(band => {
            const def = placedDefinition(band);
            const messages = def?.verify?.contrast?.(band, { ...ctx, tones, appearance: figure.appearance }) ?? [];
            return messages.map(message => ({ ...at(band), message }));
        }),
        lintDiagram: () => opts.accept ? bandFindings.map(finding => applyFindingAcceptance(finding, opts.accept)) : bandFindings,
        acceptHint(rule) {
            for (const def of definitions.values()) {
                const hint = def.verify?.acceptHint?.(rule);
                if (hint)
                    return hint;
            }
            return opts.diagramAcceptHint?.(rule);
        },
        // Layout findings are computed once and shared by both colour schemes.
        mergeFindingSides: light => [...light],
        hasMutedBox: figure => walkDefinedBands(figure.bands).some(band => band.type === 'box' && band.tone === 'muted'),
        checkFigures: figure => {
            const issues = [], warnings = [];
            for (const band of leaves(figure)) {
                for (const finding of placedDefinition(band)?.verify?.check?.(band, ctx) ?? []) {
                    if (finding.severity === 'problem')
                        issues.push({ ...at(band), message: finding.message });
                    else
                        warnings.push(finding.message);
                }
            }
            return { issues, warnings: authored ? warnings : [...revealWarnings, ...warnings] };
        },
    }, placed);
    const emitEnv = { theme, roles, tones: ink, color: (key) => colorOf(key, theme), dimFill: ctx.dimFill };
    const emit = (figure, noRecolor = false, description = opts.desc, revealStage = reveal) => {
        const env = { ...emitEnv, stage: revealStage ?? stage };
        return emitSvgWith({
            connectorDefs: connection?.internal ? connection.connectorDefs : undefined,
            defsNeeded: band => placedDefinition(band)?.svgDefs?.(band) ?? {},
            renderBand: band => {
                const def = must(placedDefinition(band));
                const svg = def.emit(band, env);
                return spotlighter?.renderBand(band, svg, def) ?? svg;
            },
            renderConnect: connector => must(definitions.get('connect')).emit(connector, env),
            diagramTitle: diagram => definedDiagramTitle(diagram, authored ? undefined : stage),
            diagramDesc: diagram => {
                const text = description ?? joinBandDescriptions(walkDefinedBands(diagram.bands).flatMap(band => {
                    const part = visibleAt(band, revealStage) ? defOf(band)?.describe?.(band, revealStage) : undefined;
                    return part ? [part] : [];
                }));
                return opts.formatDescription?.(text) ?? text;
            },
            spotlightDim: spotlighter?.dim ?? (() => 'outline'),
        }, figure, { reveal: revealStage, noRecolor });
    };
    return { placed, stage, verdict, emit, fit, fontScale };
}
/** Render a vertical stack of bands whose definitions are carried by their values. */
export async function renderBands(bands, opts) {
    const { placed, verdict, emit, fit, fontScale } = await prepareBands(bands, opts);
    const svg = emit(placed);
    return { svg, width: placed.width, height: placed.canvasHeight, xml: xmlProblems(svg), verdict, fit, fontScale, laidOut: placed };
}
