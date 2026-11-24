#!/usr/bin/env node
// svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]
// A deck (lib/deck-spec.ts, ADR 0055) as one PowerPoint file of 16:9 slides. A slide's `figure` is a JSON spec, or the path of a diagram
// source (.ts) or of a spec file (.json), relative to the deck file. Measured and drawn as `svg-diagram pptx` does (the project's fonts,
// resvg for the PNG fallbacks); ./lib/pptx-deck-edge.ts is the same writer for a Worker.
import fs from 'node:fs';
import path from 'node:path';
import {installResolveHook} from './lib/resolve-hook.ts';
import {loadConfig} from './lib/config.ts';
import {chooseColumns, columnWidths, figureRooms, maxScale, type FigureFit} from './lib/deck-layout.ts';
import {closeMeasurer, configureMeasure, measureAll, splitAtoms, textWidth} from './lib/measure.ts';
import {autoColumns, columnFigurePath, figurePath, fitOf, sharedColumns} from './lib/deck-spec-core.ts';
import {drawColumnFigure, figureKey, loadDeck, renderDeckFigure} from './lib/deck-load.ts';
import {figureMinPt} from './lib/pptx/deck-figure.ts';
import {deckEntries, deckTexts, planDeckSlide, slideIssues, type DeckFigure, type TextWidth} from './lib/pptx/deck.ts';
import {planSlide, fontsOf} from './lib/pptx/slide.ts';
import {fontFilesOf, rasterize} from './lib/pptx/emit.ts';
import {zipStore} from './lib/pptx/zip-node.ts';
import type {MeasureRequest} from './lib/types/core.ts';
import type {RenderResult} from './lib/types/verdicts.ts';

installResolveHook();
const USAGE = 'Usage: svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]';
const args = process.argv.slice(2), values = ['--out', '--png-scale', '--font'];
const usage = (message?: string): never => { console.error(message ? `✗ ${message}\n${USAGE}` : USAGE); process.exit(2); };
for (const [i, arg] of args.entries()) {
  if (arg.startsWith('--') && !values.includes(arg)) usage(`unknown option ${arg}`);
  if (values.includes(arg) && (args[i + 1] === undefined || args[i + 1]?.startsWith('--'))) usage(`${arg} needs a value`);
}
const value = (name: string): string | undefined => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const files = args.filter((arg, i) => !arg.startsWith('--') && !values.includes(args[i - 1] ?? ''));
if (files.length !== 1 || !files[0]?.endsWith('.json')) usage('pptx-deck takes one deck .json file');
const scaleText = value('--png-scale'), pngScale = scaleText === undefined ? 2 : Number(scaleText);
if (!(Number.isFinite(pngScale) && pngScale > 0)) usage(`--png-scale needs a positive number (got ${scaleText})`);
const font = value('--font');

const deckFile = path.resolve(files[0] as string), dir = path.dirname(deckFile);
const fail = (lines: string[]): never => { for (const l of lines) console.error(`✗ ${l}`); process.exit(1); };

try {
  const got = loadDeck(deckFile);
  if (!got.ok) fail(got.errors);
  const {deck, sources} = (got as Extract<typeof got, {ok: true}>).loaded;
  const cfg = loadConfig(dir);
  configureMeasure(cfg);
  const fonts = fontsOf(font), rasterFonts = fontFilesOf(cfg.fonts);
  const errors: string[] = [];
  // the slide's own text is measured as the figures are: in one batch, by atoms (lib/atoms.ts); first, as it decides each figure's room
  const requests = new Map<string, MeasureRequest>();
  const key = (atom: string, size: number, weight: number) => `${size}|${weight}|${atom}`;
  for (const s of deck.slides) for (const t of deckTexts(s)) for (const atom of splitAtoms(t.text)) requests.set(key(atom, t.size, t.bold ? 700 : 400), {text: atom, size: t.size, weight: t.bold ? 700 : 400});
  const measured = await measureAll(requests);
  const widthOf = (atom: string, size: number, weight: number): number => measured.get(key(atom, size, weight))?.w ?? atom.length * size;
  const width: TextWidth = (text, size, bold) => textWidth(widthOf, text, size, bold ? 700 : 400);
  /** A figure drawn and planned as PowerPoint shapes: slide i's own, or its column j's (ADR 0058), fitted to its room (ADR 0059, 0060). */
  const drawFigure = async (i: number, spec: unknown, fit: FigureFit, room: {w: number; h: number} | null, j?: number, columnPx?: number): Promise<DeckFigure | undefined> => {
    const source = sources.get(figureKey(i, j));
    if (spec === undefined && !source) return undefined;
    const r = await renderDeckFigure(i, spec, source, cfg, fit === 'fill' && room ? {column: j, fill: {box: room, cap: maxScale(fit)}} : {column: j, columnPx});
    if (!r.ok) { errors.push(...r.errors); return undefined; }
    const place = j === undefined ? figurePath(i, '') : columnFigurePath(i, j, '');
    for (const warning of [...(r.fallback ? [r.fallback] : []), ...r.result.verdict.warnings]) console.error(`⚠ ${place}: ${warning}`);
    return {plan: planSlide(r.result.laidOut, fonts), w: Math.max(96, r.result.laidOut.width), h: Math.max(96, r.result.laidOut.canvasHeight)};
  };
  const figures: (DeckFigure | undefined)[] = [], columnFigures: (DeckFigure | undefined)[][] = [], shares: (number[] | undefined)[] = [];
  const asDeckFigure = (r: RenderResult): DeckFigure => ({plan: planSlide(r.laidOut, fonts), w: Math.max(96, r.laidOut.width), h: Math.max(96, r.laidOut.canvasHeight)});
  for (const [i, s] of deck.slides.entries()) {
    const fit = fitOf(deck, s);
    if (s.columns && autoColumns(deck, s)) {
      // the columns' shares chosen from what they hold (ADR 0061)
      const columns = s.columns, failures: string[][] = [];
      const chosen = await chooseColumns({...s, columns}, width, maxScale(fit), async (j, w) => {
        const c = columns[j];
        const d = await drawColumnFigure(i, j, c?.figure, sources.get(figureKey(i, j)), cfg, w, figureMinPt);
        if (!d.ok && w === null && d.errors) failures[j] = d.errors;
        return d;
      });
      if (!chosen.ok) { errors.push(...failures.flat(), ...(failures.length ? [] : [`slides[${i}].columns: ${chosen.why}`])); figures.push(undefined); columnFigures.push([]); shares.push(undefined); continue; }
      chosen.figures.forEach((f, j) => { if (f) for (const warning of f.value.verdict.warnings) console.error(`⚠ ${columnFigurePath(i, j, '')}: ${warning}`); });
      figures.push(undefined);
      columnFigures.push(chosen.figures.map(f => f ? asDeckFigure(f.value) : undefined));
      shares.push(chosen.shares);
      continue;
    }
    const cols0 = s.columns ? sharedColumns(s.columns) : undefined, rooms = figureRooms({...s, columns: cols0}, width);
    figures.push(await drawFigure(i, s.figure, fit, rooms.figure));
    const cols: (DeckFigure | undefined)[] = [];
    const px = columnWidths(cols0 ?? []);
    for (const [j, c] of (s.columns ?? []).entries()) cols.push(c.text === undefined ? await drawFigure(i, c.figure, fit, rooms.columns[j] ?? null, j, px[j]) : undefined);
    columnFigures.push(cols);
    shares.push(undefined);
  }
  if (errors.length) fail(errors);
  const planned = deck.slides.map(({figure: _f, columns, ...s}, i) => {
    const f = figures[i];
    const cols = columns && sharedColumns(columns, shares[i]).map((c, j) => ({caption: c.caption, text: c.text, width: c.width, figure: columnFigures[i]?.[j]}));
    return planDeckSlide({...s, fit: fitOf(deck, deck.slides[i] ?? {}), ...(f ? {figure: f} : {}), ...(cols ? {columns: cols} : {})}, fonts, width);
  });
  const reports = planned.map((p, i) => slideIssues(p, i, figures[i] !== undefined, (deck.slides[i]?.columns ?? []).map(c => c.text === undefined ? 'figure' : 'text')));
  const noRoom = reports.flatMap(r => r.errors.map(e => `${e.path}: ${e.message}`));
  if (noRoom.length) fail(noRoom);
  for (const r of reports) for (const w of r.warnings) console.error(`⚠ ${w.path}: ${w.message}`);
  const pngs = planned.map(p => p.pictures.map(pic => rasterize(pic.pngSvg, rasterFonts, pngScale)));
  const out = value('--out') ?? path.join(dir, path.basename(deckFile, '.json') + '.pptx');
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  fs.writeFileSync(out, zipStore(deckEntries(planned, pngs, deck.title)));
  console.log(`wrote ${out} (${planned.length} slides)`);
} finally { await closeMeasurer(); }
