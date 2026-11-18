import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { readDataImage } from '../image-sniff.js';
import { texToSvg } from '../math-tex.js';
import { emitRevealStage } from '../pipeline.js';
import { LABEL_ROLES, ROLES } from '../tokens.js';
import { renderDiagram } from './render.js';
import { assertNoReveal, assertTextRole, revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
const IMAGE_TONES = ['plain', 'accent', 'danger', 'muted', 'new', 'changed', 'removed', 'solid', 'solid-danger'];
export function image(src, opts = {}) {
    if (opts.pad !== undefined && !(opts.pad >= 0 && Number.isFinite(opts.pad)))
        throw new Error(`image(): pad must be a finite number >= 0 (got ${opts.pad})`);
    const over = opts.over === undefined ? [] : [opts.over].flat();
    for (const [i, c] of over.entries())
        if (c?.type === 'connect')
            throw new Error(`image(): over[${i}] is a connect() — add connectors at the top level of the diagram (they may point at ids inside the picture)`);
    if (!opts.alt?.trim() && !opts.decorative)
        throw new Error('image(): alt is required (what the picture shows) — or pass decorative: true when it adds nothing');
    if (opts.alt && opts.decorative)
        throw new Error('image(): alt and decorative: true contradict each other');
    for (const k of ['width', 'height']) {
        const v = opts[k];
        if (v !== undefined && (!(v > 0) || !Number.isFinite(v)))
            throw new Error(`image(): ${k} must be a finite number > 0 (got ${opts[k]})`);
    }
    if (opts.width !== undefined && opts.height !== undefined)
        throw new Error('image(): give width or height, not both (the other follows the picture\'s aspect ratio)');
    assertTextRole(opts.labelRole, LABEL_ROLES, 'image() labelRole');
    if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align))
        throw new Error(`image(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
    const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
    const tone = (t, where) => { if (t !== undefined && !IMAGE_TONES.includes(t))
        throw new Error(`image(): ${where} tone "${t}" is not one of ${IMAGE_TONES.join(', ')}`); };
    (opts.marks ?? []).forEach((m, i) => {
        const [x, y, w, h] = m.rect ?? [];
        if (![x, y, w, h].every(n => typeof n === 'number' && unit(n)) || !(w > 0 && h > 0) || x + w > 1.0001 || y + h > 1.0001)
            throw new Error(`image(): mark ${i + 1} rect must be [x, y, w, h] as fractions of the picture, inside it (got ${JSON.stringify(m.rect)})`);
        tone(m.tone, `mark ${i + 1}`);
        assertTextRole(m.role, LABEL_ROLES, `image() mark ${i + 1} role`);
        if (m.label !== undefined && !m.label.trim())
            throw new Error(`image(): mark ${i + 1} label is empty`);
    });
    (opts.labels ?? []).forEach((l, i) => {
        if (!l.text?.trim())
            throw new Error(`image(): label ${i + 1} has no text`);
        if (!Array.isArray(l.at) || l.at.length !== 2 || !l.at.every(unit))
            throw new Error(`image(): label ${i + 1} "at" must be [x, y] as fractions of the picture (0 to 1) (got ${JSON.stringify(l.at)})`);
        if (l.anchor !== undefined && !['start', 'middle', 'end'].includes(l.anchor))
            throw new Error(`image(): label ${i + 1} anchor must be 'start', 'middle' or 'end' (got ${l.anchor})`);
        tone(l.tone, `label ${i + 1}`);
        assertTextRole(l.role, LABEL_ROLES, `image() label ${i + 1} role`);
    });
    const ids = (opts.marks ?? []).map(m => m.id).filter((id) => !!id);
    if (new Set(ids).size !== ids.length)
        throw new Error('image(): each mark id must be unique');
    if (opts.id !== undefined && ids.includes(opts.id))
        throw new Error(`image(): the band's id "${opts.id}" is also a mark's id — each id must be unique`);
    // a data URI is read at once; a file waits for the diagram to be drawn (its relative path means "next to the source", which only the loader knows)
    const text = src instanceof URL ? src.href : src;
    const file = text.startsWith('data:') ? readDataImage(text) : undefined;
    const band = {
        type: 'image', src: text, ...(file ? {} : { unresolved: true }), href: file?.href ?? '', naturalW: file?.w ?? 0, naturalH: file?.h ?? 0, bytes: file?.bytes ?? 0, alt: opts.alt?.trim() ?? '',
        ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'image()'), ...revealOf(opts),
        ...(opts.width === undefined ? {} : { width: opts.width }), ...(opts.height === undefined ? {} : { height: opts.height }), ...(opts.align === undefined ? {} : { align: opts.align }), ...(opts.labelRole === undefined ? {} : { labelRole: opts.labelRole }),
        ...(opts.marks?.length ? { marks: opts.marks.map(m => ({ ...m, rect: [...m.rect] })) } : {}),
        ...(opts.labels?.length ? { labels: opts.labels.map(l => ({ ...l })) } : {}),
        ...(over.length ? { children: over } : {}), ...(opts.pad === undefined ? {} : { pad: opts.pad }),
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
export async function build(d, outPath, opts = {}) {
    const r = await renderDiagram(d, { name: opts.name ?? path.basename(outPath), budget: 'measure', html: opts.html });
    return finishBuild(r, outPath, opts.lint ?? true);
}
async function finishBuild(r, outPath, lint) {
    const { verdict } = r;
    if (!verdict.ok) {
        throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
    }
    if (r.xml.length)
        throw new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${r.xml.join('\n  ')}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, r.svg);
    let htmlPath;
    if (r.html !== undefined) {
        htmlPath = outPath.replace(/\.svg$/, '') + '.html';
        fs.writeFileSync(htmlPath, r.html);
    }
    const revealPaths = [];
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
        if (m && (!r.laidOut.maxReveal || Number(m[1]) > r.laidOut.maxReveal))
            fs.rmSync(path.join(path.dirname(outPath), name));
    }
    const lintScript = path.resolve(import.meta.dirname, '..', '..', import.meta.url.endsWith('.ts') ? 'lint-svg.ts' : 'lint-svg.js');
    if (lint)
        try {
            execFileSync('node', [lintScript, outPath, '--strict'], { encoding: 'utf8' });
        }
        catch (err) {
            const e = err;
            const out = (e.stdout || '') + (e.stderr || '');
            throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
        }
    return { outPath, ...(htmlPath ? { htmlPath } : {}), revealPaths, width: r.width, height: r.height, fit: r.fit, budget: r.budget, fontScale: r.fontScale, warnings: verdict.warnings, findings: verdict.findings };
}
export function math(tex, opts = {}) {
    assertNoReveal(opts, 'math()');
    if (typeof tex !== 'string' || !tex.trim())
        throw new Error('math(tex) needs the TeX source of the formula (a non-empty string)');
    if (opts.align !== undefined && !['left', 'center', 'right'].includes(opts.align))
        throw new Error(`math(): align must be 'left', 'center' or 'right' (got ${opts.align})`);
    if (opts.tone !== undefined && !['text', 'accent', 'muted', 'danger'].includes(opts.tone))
        throw new Error(`math(): tone must be 'text', 'accent', 'muted' or 'danger' (got ${opts.tone})`);
    if (opts.role !== undefined && !(opts.role in ROLES))
        throw new Error(`math(): role must be one of ${Object.keys(ROLES).join(', ')} (got ${opts.role})`);
    return withHandle({ type: 'math', tex, drawing: texToSvg(tex, !opts.inline), role: opts.role ?? 'body', align: opts.align ?? 'center', tone: opts.tone ?? 'text', alt: opts.alt?.trim() || tex, ...(opts.id === undefined ? {} : { id: opts.id }) }, opts.id);
}
