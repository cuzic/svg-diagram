// Keep the V8 hook and filesystem reads on the CLI side of ADR 0072 D3.
import fs from 'node:fs';
import {findPackageJSON, findSourceMap} from 'node:module';
import path from 'node:path';
import {resolveErrorLocation} from './source-location.ts';
import type {SourceLoc} from './source-location.ts';
import {DIAGRAM_SOURCE, sourceOf} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';

const CALL_SITES = Symbol('svg-diagram.call-sites');
type StackHolder = {stack?: unknown; [CALL_SITES]?: NodeJS.CallSite[]};
type CapturedError = Error & StackHolder & {code?: unknown};

const packageJson = findPackageJSON(import.meta.url);
const packageDir = path.dirname(packageJson ?? import.meta.dirname);

export function installStackCapture(): void {
  Error.stackTraceLimit = 50;
  Error.prepareStackTrace = (err: CapturedError, frames) => {
    if (Object.isExtensible(err)) Object.defineProperty(err, CALL_SITES, {value: frames, configurable: true});
    let head = 'Error';
    try { head = Error.prototype.toString.call(err); } catch { /* a custom name or message can throw */ }
    return [head, ...frames.map(frame => `    at ${frame}`)].join('\n');
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
const sourceContext = (source: string) => ({source, cwd: process.cwd(), packageDir, realpath, readSource});

function resolveStack(holder: StackHolder, context: Parameters<typeof resolveErrorLocation>[1], details?: {code?: unknown; message?: string}): ReturnType<typeof resolveErrorLocation> {
  // V8 calls prepareStackTrace on the first stack read.
  let stack: unknown;
  try { stack = holder.stack; } catch { /* a user-defined stack getter can throw */ }
  const frames = holder[CALL_SITES]?.flatMap(callSiteLocation);
  return resolveErrorLocation({...details, stack: typeof stack === 'string' ? stack : undefined, frames}, context);
}

export function locateSource(ref: SourceRef | undefined, source: string): ReturnType<typeof resolveErrorLocation> {
  return ref?.stackHolder ? resolveStack(ref.stackHolder, sourceContext(source)) : {via: []};
}

export function locateError(thrown: unknown, source: string): ReturnType<typeof resolveErrorLocation> {
  const holder = Object(thrown) as StackHolder;
  const context = sourceContext(source);
  const part = sourceOf(holder);
  if (part?.specPath !== undefined && !part.stackHolder) return {via: []};
  const atPart = part?.stackHolder && resolveStack(part.stackHolder, context);
  if (atPart?.loc) return atPart;

  const err: CapturedError = thrown instanceof Error ? thrown : new Error(String(thrown), {cause: thrown});
  const atError = resolveStack(holder, context, {code: err.code, message: err.message});
  if (atError.loc) return atError;

  const diagram = sourceOf(holder, DIAGRAM_SOURCE)?.stackHolder;
  return diagram ? resolveStack(diagram, context) : atError;
}
