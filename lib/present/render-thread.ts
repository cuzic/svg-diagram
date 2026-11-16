// The thread `serve` draws a deck in (ADR 0056 D5). A watcher re-reads edited .ts figures as new modules, and Node never frees a module, so
// the drawing runs here and the server starts a new thread every so often. Each message draws the whole deck once and answers with the
// slides, the problems, and every file the drawing read (what to watch).
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parentPort} from 'node:worker_threads';
import {installResolveHook, recordResolved} from '../resolve-hook.ts';
import {recordImageReads} from '../image-file.ts';
import {loadConfig} from '../config.ts';
import {configureMeasure} from '../measure.ts';
import {loadDeck} from '../deck-load.ts';
import {outlineFontCheck} from '../font-metrics.ts';
import fs from 'node:fs';
import {renderDeck, type RenderedDeck, type SlideCache} from './render-deck.ts';

export interface RenderRequest {deckFile: string; fresh: boolean}
export interface RenderReply {deck: RenderedDeck | null; errors: string[]; files: string[]}

installResolveHook();
const port = parentPort;
/** The slides drawn in this thread, by their input (a new thread starts empty). */
const cache: SlideCache = new Map();
if (!port) throw new Error('render-thread: run as a worker thread');

port.on('message', async (req: RenderRequest) => {
  const files = new Set<string>();
  recordResolved(url => files.add(fileURLToPath(url)));
  recordImageReads(f => files.add(f));
  try {
    const dir = path.dirname(path.resolve(req.deckFile));
    const cfg = loadConfig(dir);
    configureMeasure(cfg);
    const fonts = outlineFontCheck(cfg.fonts);
    if (fonts.ok) for (const f of fonts.files) files.add(f);
    for (let d = dir; ; d = path.dirname(d)) { files.add(path.join(d, '.svg-diagram.json')); if (path.dirname(d) === d) break; }
    const got = loadDeck(req.deckFile);
    if (!got.ok) { port.postMessage({deck: null, errors: got.errors, files: [path.resolve(req.deckFile), ...files]} satisfies RenderReply); return; }
    for (const f of got.loaded.files) files.add(f);
    for (const f of got.loaded.sources.values()) files.add(f);
    // a font file replaced in place changes the outlines: its size and time are part of every slide's key
    const fontStamp = fonts.ok ? fonts.files.map(f => { try { const st = fs.statSync(f); return `${f}:${st.size}:${st.mtimeMs}`; } catch { return f; } }).join('|') : '';
    const deck = await renderDeck(got.loaded, cfg, {fresh: req.fresh, cache, fontStamp});
    port.postMessage({deck, errors: [], files: [...files]} satisfies RenderReply);
  } catch (e) {
    port.postMessage({deck: null, errors: [e instanceof Error ? e.stack ?? e.message : String(e)], files: [path.resolve(req.deckFile), ...files]} satisfies RenderReply);
  } finally {
    recordResolved(null);
    recordImageReads(null);
  }
});
