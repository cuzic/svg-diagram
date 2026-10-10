#!/usr/bin/env node
// Shared primitive: export a single Slidev slide to PNG and run it through
// check-slide-overflow.ts, in a throwaway temp dir. Used by both
// verify-slide.ts (one-shot check) and fit-image-height.ts (repeated
// checks during a binary search) so the export/check/cleanup logic exists
// in exactly one place.
//
// Usage (module):
//   import { exportAndCheck } from './export-and-check.ts'
//   const { ok, suspects, raw } = await exportAndCheck(200, { timeoutMs: 150000 })
//
// Usage (CLI): prints the result for one slide index.
//   node scripts/svg-diagram/lib/export-and-check.ts 200

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// exportAndCheck(index, opts) -> { ok, suspects: string[], raw }
// ok is true iff check-slide-overflow.ts exited 0 (no *-SUSPECT of any kind).
// suspects is the list of non-blank lines under any "*-SUSPECT:" heading, for
// callers that want to report specifics without re-parsing `raw` themselves.
// Throws if `slidev export` itself fails (distinct from "exported but flagged").
export interface ExportAndCheckOpts {
  slidesMd?: string;
  timeoutMs?: number;
  renderTimeoutMs?: number;
  excludeLeft?: number | string;
  checkerArgs?: string[];
  exportAttempts?: number;
}
export interface ExportAndCheckResult {ok: boolean; suspects: string[]; raw: string}

export async function exportAndCheck(index: number, opts: ExportAndCheckOpts = {}): Promise<ExportAndCheckResult> {
  const {
    slidesMd = 'slides.md',
    timeoutMs = 180000,
    // slidev's own print-page render timeout. Its 30s default is not enough
    // for this deck when the host is under load (several concurrent exports,
    // each booting a dev server + Chromium) — see token-economy.md.
    renderTimeoutMs = 120000,
    excludeLeft, // omit to use check-slide-overflow.ts's own default
    checkerArgs = [],
    exportAttempts = 4,
  } = opts;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-verify-'));
  try {
    // Concurrent `slidev export` runs on this host collide (they race for the
    // same print-server port, and Playwright's 30s networkidle wait loses
    // under load), so a single failure says nothing about the slide itself.
    // Retry before believing it.
    let lastErr: unknown;
    let pngs: string[] = [];
    for (let attempt = 1; attempt <= exportAttempts; attempt++) {
      try {
        execFileSync('npx', ['slidev', 'export', slidesMd, '--format', 'png', '--range', String(index), '--output', tmpDir, '--timeout', String(renderTimeoutMs)], {
          timeout: timeoutMs,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        pngs = fs.readdirSync(tmpDir).filter(f => f.toLowerCase().endsWith('.png'));
        if (pngs.length > 0) break;
        lastErr = new Error('slidev export exited 0 but wrote no PNG');
      } catch (err) {
        lastErr = err;
      }
    }
    if (pngs.length === 0) {
      throw new Error(`slidev export produced no PNG for slide ${index} after ${exportAttempts} attempts (possible host-load timeout — see token-economy.md's retry guidance)\n${(lastErr as Error | undefined)?.message ?? ''}`);
    }

    const args = [path.resolve('scripts/check-slide-overflow.ts'), tmpDir];
    if (excludeLeft !== undefined) args.push(`--exclude-left=${excludeLeft}`);
    args.push(...checkerArgs);

    let raw: string, ok: boolean;
    try {
      raw = execFileSync('node', args, { encoding: 'utf8' });
      ok = true;
    } catch (err) {
      const e = err as {stdout?: string; stderr?: string}; // execFileSync failure carries the child's output
      raw = (e.stdout || '') + (e.stderr || '');
      ok = false;
    }

    const suspects: string[] = [];
    let inSuspectSection = false;
    for (const line of raw.split('\n')) {
      if (/-SUSPECT:|DECODE-FAIL:/.test(line)) { inSuspectSection = true; continue; }
      if (/^\S/.test(line) || line.trim() === '') { inSuspectSection = false; continue; }
      if (inSuspectSection) suspects.push(line.trim());
    }

    return { ok, suspects, raw };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const index = parseInt(process.argv[2], 10);
  if (!Number.isFinite(index)) {
    console.error('Usage: node scripts/svg-diagram/lib/export-and-check.ts <slide-index>');
    process.exit(2);
  }
  const result = await exportAndCheck(index);
  console.log(result.raw);
  process.exit(result.ok ? 0 : 1);
}
