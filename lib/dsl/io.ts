import fs from 'fs';
import path from 'path';
import {execFileSync} from 'child_process';
import {readImage} from '../image-file.ts';
import {emitRevealStage} from '../pipeline.ts';
import {LABEL_ROLES} from '../tokens.ts';
import type {Diagram} from '../types/core.ts';
import type {ImageBand, ImageMark, ImageOpts, ImageRect} from '../types/image.ts';
import type {Band} from '../types/index.ts';
import type {BuildResult, RenderResult} from '../types/verdicts.ts';
import type {AnchorsOf, Declares, IdsOf, HandleOf, Refers, RefsOf} from '../strict.ts';
import {renderDiagram} from './render.ts';
import {assertTextRole, revealOf, withAnchors, withHandle} from './shared.ts';

type MarkIds<M extends readonly ImageMark[]> = Extract<M[number]['id'], string>;
const IMAGE_TONES = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed', 'solid', 'solid-danger'];
/**
 * A picture (PNG / JPEG / GIF / WebP) as a part, read now and embedded as a data URI so the SVG stays one file. `marks` outline regions
 * (spotlight and connect() can point at their ids); `labels` put words on opaque plates. Positions are fractions of the picture.
 * `src`: a path (relative: next to the diagram source), `new URL('./a.png', import.meta.url)`, or a data URI.
 */
export function image<const M extends readonly ImageMark[] = [], const Id extends string = never, C extends Band | Band[] = []>(src: string | URL, opts: Omit<ImageOpts, 'over'> & {id?: Id; marks?: M; over?: C}): ImageBand & Declares<Id | MarkIds<M> | IdsOf<C>> & Refers<RefsOf<C>> & HandleOf<Id> & AnchorsOf<MarkIds<M>>;
export function image(src: string | URL, opts: ImageOpts = {}): ImageBand {
  if (opts.pad !== undefined && !(opts.pad >= 0 && Number.isFinite(opts.pad))) throw new Error(`image(): pad must be a finite number >= 0 (got ${opts.pad})`);
  const over = opts.over === undefined ? [] : [opts.over].flat() as Band[];
  for (const [i, c] of over.entries()) if (c?.type === 'connect') throw new Error(`image(): over[${i}] is a connect() — add connectors at the top level of the diagram (they may point at ids inside the picture)`);
  if (!opts.alt?.trim() && !opts.decorative) throw new Error('image(): alt is required (what the picture shows) — or pass decorative: true when it adds nothing');
  if (opts.alt && opts.decorative) throw new Error('image(): alt and decorative: true contradict each other');
  for (const k of ['width', 'height'] as const) if (opts[k] !== undefined && (!(opts[k]! > 0) || !Number.isFinite(opts[k]))) throw new Error(`image(): ${k} must be a finite number > 0 (got ${opts[k]})`);
  if (opts.width !== undefined && opts.height !== undefined) throw new Error('image(): give width or height, not both (the other follows the picture\'s aspect ratio)');
  assertTextRole(opts.labelRole, LABEL_ROLES, 'image() labelRole');
  if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align)) throw new Error(`image(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
  const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  const tone = (t: string | undefined, where: string) => { if (t !== undefined && !IMAGE_TONES.includes(t)) throw new Error(`image(): ${where} tone "${t}" is not one of ${IMAGE_TONES.join(', ')}`); };
  (opts.marks ?? []).forEach((m, i) => {
    const [x, y, w, h] = m.rect ?? [];
    if (![x, y, w, h].every(n => typeof n === 'number' && unit(n)) || !(w > 0 && h > 0) || x + w > 1.0001 || y + h > 1.0001) throw new Error(`image(): mark ${i + 1} rect must be [x, y, w, h] as fractions of the picture, inside it (got ${JSON.stringify(m.rect)})`);
    tone(m.tone, `mark ${i + 1}`);
    assertTextRole(m.role, LABEL_ROLES, `image() mark ${i + 1} role`);
    if (m.label !== undefined && !m.label.trim()) throw new Error(`image(): mark ${i + 1} label is empty`);
  });
  (opts.labels ?? []).forEach((l, i) => {
    if (!l.text?.trim()) throw new Error(`image(): label ${i + 1} has no text`);
    if (!Array.isArray(l.at) || l.at.length !== 2 || !l.at.every(unit)) throw new Error(`image(): label ${i + 1} "at" must be [x, y] as fractions of the picture (0 to 1) (got ${JSON.stringify(l.at)})`);
    if (l.anchor !== undefined && !['start', 'middle', 'end'].includes(l.anchor)) throw new Error(`image(): label ${i + 1} anchor must be 'start', 'middle' or 'end' (got ${l.anchor})`);
    tone(l.tone, `label ${i + 1}`);
    assertTextRole(l.role, LABEL_ROLES, `image() label ${i + 1} role`);
  });
  const ids = (opts.marks ?? []).map(m => m.id).filter((id): id is string => !!id);
  if (new Set(ids).size !== ids.length) throw new Error('image(): each mark id must be unique');
  if (opts.id !== undefined && ids.includes(opts.id)) throw new Error(`image(): the band's id "${opts.id}" is also a mark's id — each id must be unique`);
  const file = readImage(src);
  const band: ImageBand = {
    type: 'image', href: file.href, naturalW: file.w, naturalH: file.h, bytes: file.bytes, alt: opts.alt?.trim() ?? '',
    ...(opts.id === undefined ? {} : {id: opts.id}), ...revealOf(opts),
    ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.height === undefined ? {} : {height: opts.height}), ...(opts.align === undefined ? {} : {align: opts.align}), ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}),
    ...(opts.marks?.length ? {marks: opts.marks.map(m => ({...m, rect: [...m.rect] as unknown as ImageRect}))} : {}),
    ...(opts.labels?.length ? {labels: opts.labels.map(l => ({...l}))} : {}),
    ...(over.length ? {children: over} : {}), ...(opts.pad === undefined ? {} : {pad: opts.pad}),
  };
  return withHandle(withAnchors(band, (opts.marks ?? []).map(m => m.id)), opts.id);
}
// Lays out, verifies, renders, writes, and lints a diagram in one call.
// build(d, 'public/svg/day2-11-example.svg')
//
// Two verification layers, in order:
//   1. verifyDiagram() — pure-geometry checks on the laid-out tree, before
//      any SVG exists. Catches sibling/neighbor overlap, canvas-bounds
//      overflow, and low-contrast tone pairs in milliseconds, with no
//      Chromium render involved. This is the primary check.
//   2. lint-svg.ts --strict — a real Playwright render of the finished
//      file. Slower, but it's the only thing that can see what raw()
//      actually drew (verifyDiagram only checks raw()'s self-reported
//      x/y/w/h against its neighbors) and catches real-font-rendering
//      discrepancies verifyDiagram's measured-atom approximation can't.
// opts.name: the SVG's published name when outPath is a scratch file (it keys the slide-budget cache). opts.lint: false skips the per-file lint-svg.ts run (it starts its own Chromium), for callers that lint many
// files in one go afterwards (build-diagram.ts). Default true.
export async function build(d: Diagram, outPath: string, opts: {lint?: boolean; name?: string; html?: boolean} = {}): Promise<BuildResult> {
  const r = await renderDiagram(d, {name: opts.name ?? path.basename(outPath), budget: 'measure', html: opts.html});
  return finishBuild(r, outPath, opts.lint ?? true);
}
async function finishBuild(r: RenderResult, outPath: string, lint: boolean): Promise<BuildResult> {
  const {verdict} = r;
  if (!verdict.ok) {
    throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
  }
  if (r.xml.length) throw new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${r.xml.join('\n  ')}`);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, r.svg);
  let htmlPath: string | undefined;
  if (r.html !== undefined) {
    htmlPath = outPath.replace(/\.svg$/, '') + '.html';
    fs.writeFileSync(htmlPath, r.html);
  }
  const revealPaths: string[] = [];
  if (r.laidOut.maxReveal) {
    const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
    for (let stage = 0; stage <= r.laidOut.maxReveal; stage++) {
      const revealPath = `${stem}.reveal${stage}${ext}`;
      fs.writeFileSync(revealPath, emitRevealStage(r.laidOut, stage));
      revealPaths.push(revealPath);
    }
  }
  const ext = path.extname(outPath), stem = outPath.slice(0, -ext.length);
  for (const name of fs.readdirSync(path.dirname(outPath))) {
    const m = new RegExp(`^${path.basename(stem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.reveal(\\d+)${ext.replace('.', '\\.')}$$`).exec(name);
    if (m && (!r.laidOut.maxReveal || Number(m[1]) > r.laidOut.maxReveal)) fs.rmSync(path.join(path.dirname(outPath), name));
  }

  const lintScript = path.resolve(import.meta.dirname, '..', '..', import.meta.url.endsWith('.ts') ? 'lint-svg.ts' : 'lint-svg.js');
  if (lint) try {
    execFileSync('node', [lintScript, outPath, '--strict'], {encoding: 'utf8'});
  } catch (err) {
    const e = err as {stdout?: string; stderr?: string};
    const out = (e.stdout || '') + (e.stderr || '');
    throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
  }
  return {outPath, ...(htmlPath ? {htmlPath} : {}), revealPaths, width: r.width, height: r.height, fit: r.fit, budget: r.budget, fontScale: r.fontScale, warnings: verdict.warnings, findings: verdict.findings};
}
