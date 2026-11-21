// Keep the V8 hook and filesystem reads on the CLI side of ADR 0072 D3.
import fs from 'node:fs';
import {findSourceMap} from 'node:module';
import path from 'node:path';
import {resolveErrorLocation} from './source-location.ts';
import type {SourceLoc} from './source-location.ts';

const CALL_SITES = Symbol('svg-diagram.call-sites');
type CapturedError = Error & {[CALL_SITES]?: NodeJS.CallSite[]; code?: unknown};

const libDir = import.meta.dirname;
const extension = path.extname(import.meta.filename);
const cliFiles = [
  'build-diagram', 'check-diagram', 'contact-sheet', 'deck-diagram', 'diff-svg', 'init-project',
  'lint-svg', 'manage-icons', 'markdown-diagram', 'notes-diagram', 'pptx-deck-diagram', 'pptx-diagram',
  'preview-svg', 'serve-diagram', 'show-diagram', 'site-diagram', 'typecheck',
].map(name => path.join(libDir, '..', name + extension));

export function installStackCapture(): void {
  Error.stackTraceLimit = 50;
  Error.prepareStackTrace = (err: CapturedError, frames) => {
    if (Object.isExtensible(err)) Object.defineProperty(err, CALL_SITES, {value: frames, configurable: true});
    return [String(err), ...frames.map(frame => `    at ${frame}`)].join('\n');
  };
}

function callSiteLocation(frame: NodeJS.CallSite): SourceLoc[] {
  const file = frame.getFileName(), line = frame.getLineNumber(), column = frame.getColumnNumber();
  if (!file || !line || !column) return [];
  if (process.sourceMapsEnabled) {
    const origin = findSourceMap(file)?.findOrigin(line, column);
    if (origin && 'fileName' in origin && origin.fileName && origin.lineNumber && origin.columnNumber) {
      return [{file: origin.fileName, line: origin.lineNumber, column: origin.columnNumber}];
    }
  }
  return [{file, line, column}];
}

const realpath = (file: string): string => {
  try { return fs.realpathSync(file); } catch { return file; }
};
const readSource = (file: string): string | undefined => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return undefined; }
};

export function locateError(thrown: unknown, source: string): ReturnType<typeof resolveErrorLocation> {
  const err: CapturedError = thrown instanceof Error ? thrown : new Error(String(thrown), {cause: thrown});
  // V8 calls prepareStackTrace on the first stack read.
  let stack: string | undefined;
  try { stack = err.stack; } catch { /* a user-defined stack getter can throw */ }
  const frames = err[CALL_SITES]?.flatMap(callSiteLocation);
  return resolveErrorLocation(
    {stack: typeof stack === 'string' ? stack : undefined, frames, code: err.code, message: err.message},
    {source, cwd: process.cwd(), libDir, cliFiles, realpath, readSource},
  );
}
