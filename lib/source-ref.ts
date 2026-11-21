import {sourceCaptureEnabled} from './source-capture.ts';

export {captureSourceLocations} from './source-capture.ts';

export const SOURCE = Symbol.for('svg-diagram.source');
export const DIAGRAM_SOURCE = Symbol.for('svg-diagram.diagram-source');

/** A lazy V8 stack, or the path of a spec part. Copies of a part share this reference. */
export class SourceRef {
  readonly stackHolder?: {stack?: string};
  readonly specPath?: string;

  constructor(stackHolder?: {stack?: string}, specPath?: string) {
    this.stackHolder = stackHolder;
    this.specPath = specPath;
  }
}

export function captureHere(skip: Parameters<ErrorConstructor['captureStackTrace']>[1] = captureHere): SourceRef | undefined {
  if (!sourceCaptureEnabled()) return undefined;
  const holder = {};
  Error.captureStackTrace(holder, skip);
  return new SourceRef(holder);
}

type SourceKey = typeof SOURCE | typeof DIAGRAM_SOURCE;
type SourceMarks = Partial<Record<SourceKey, SourceRef>>;

export function sourceOf(target: object, key: SourceKey = SOURCE): SourceRef | undefined {
  return (target as SourceMarks)[key];
}

/** Preserve a more specific source already assigned by an inner operation. */
export function withSource<T extends object>(target: T, ref: SourceRef | undefined, key: SourceKey = SOURCE): T {
  if (ref !== undefined && sourceOf(target, key) === undefined && Object.isExtensible(target)) (target as SourceMarks)[key] = ref;
  return target;
}

function asError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e), {cause: e});
}

export function atBand<T>(band: object, fn: () => T): T {
  try { return fn(); } catch (e) { throw withSource(asError(e), sourceOf(band)); }
}

export function throwAtDiagram(e: unknown, diagram: object): never {
  const error = asError(e);
  if (sourceOf(error) === undefined) withSource(error, sourceOf(diagram), DIAGRAM_SOURCE);
  throw error;
}
