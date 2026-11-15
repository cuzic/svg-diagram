#!/usr/bin/env node
// svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]
// A deck (lib/deck-spec.ts, ADR 0055) as one PowerPoint file of 16:9 slides. A slide's `figure` is a JSON spec, or the path of a diagram
// source (.ts) or of a spec file (.json), relative to the deck file. Measured and drawn as `svg-diagram pptx` does (the project's fonts,
// resvg for the PNG fallbacks); ./lib/pptx-deck-edge.ts is the same writer for a Worker.
import fs from 'node:fs';
import path from 'node:path';
import {installResolveHook} from './lib/resolve-hook.ts';
import {loadConfig} from './lib/config.ts';
import {closeMeasurer, configureMeasure, measureAll, splitAtoms, textWidth} from './lib/measure.ts';
import {figurePath} from './lib/deck-spec.ts';
import {loadDeck, renderDeckFigure} from './lib/deck-load.ts';
import {deckEntries, deckTexts, planDeckSlide, roomMessage, smallTextWarning, type DeckFigure, type TextWidth} from './lib/pptx/deck.ts';
import {planSlide, fontsOf} from './lib/pptx/slide.ts';
import {fontFilesOf, rasterize} from './lib/pptx/emit.ts';
import {zipStore} from './lib/pptx/zip-node.ts';
import type {MeasureRequest} from './lib/types/core.ts';

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
  const figures: (DeckFigure | undefined)[] = [], errors: string[] = [];
  for (const [i, s] of deck.slides.entries()) {
    const source = sources.get(i);
    if (s.figure === undefined && !source) { figures.push(undefined); continue; }
    const r = await renderDeckFigure(i, s, source, cfg);
    if (!r.ok) { errors.push(...r.errors); figures.push(undefined); continue; }
    for (const warning of r.result.verdict.warnings) console.error(`⚠ ${figurePath(i, '')}: ${warning}`);
    figures.push({plan: planSlide(r.result.laidOut, fonts), w: Math.max(96, r.result.laidOut.width), h: Math.max(96, r.result.laidOut.canvasHeight)});
  }
  if (errors.length) fail(errors);
  // the slide's own text is measured as the figures are: in one batch, by atoms (lib/atoms.ts)
  const requests = new Map<string, MeasureRequest>();
  const key = (atom: string, size: number, weight: number) => `${size}|${weight}|${atom}`;
  for (const s of deck.slides) for (const t of deckTexts(s)) for (const atom of splitAtoms(t.text)) requests.set(key(atom, t.size, t.bold ? 700 : 400), {text: atom, size: t.size, weight: t.bold ? 700 : 400});
  const measured = await measureAll(requests);
  const widthOf = (atom: string, size: number, weight: number): number => measured.get(key(atom, size, weight))?.w ?? atom.length * size;
  const width: TextWidth = (text, size, bold) => textWidth(widthOf, text, size, bold ? 700 : 400);
  const planned = deck.slides.map(({figure: _f, ...s}, i) => { const f = figures[i]; return planDeckSlide(f ? {...s, figure: f} : s, fonts, width); });
  const noRoom = planned.flatMap((p, i) => p.noRoom ? [`slides[${i}]: ${roomMessage(figures[i] !== undefined)}`] : []);
  if (noRoom.length) fail(noRoom);
  planned.forEach((p, i) => {
    const w = smallTextWarning(p);
    if (w) console.error(`⚠ ${figurePath(i, '')}: ${w}`);
  });
  const pngs = planned.map(p => p.pictures.map(pic => rasterize(pic.pngSvg, rasterFonts, pngScale)));
  const out = value('--out') ?? path.join(dir, path.basename(deckFile, '.json') + '.pptx');
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  fs.writeFileSync(out, zipStore(deckEntries(planned, pngs, deck.title)));
  console.log(`wrote ${out} (${planned.length} slides)`);
} finally { await closeMeasurer(); }
