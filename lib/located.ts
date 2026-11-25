import {nestedBandsOf} from './band-children.ts';
import type {DefinitionOf} from './band-children.ts';
import {defOf} from './band-def.ts';
import type {BandDef} from './band-def.ts';
import {sourceCaptureEnabled} from './source-capture.ts';
import {captureHere, sourceOf, withSource} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {Band} from './types/index.ts';

function markPart(value: unknown, ref: SourceRef, seen: Set<object>, definitionOf: DefinitionOf): void {
  if (typeof value !== 'object' || value === null || !('type' in value) || typeof value.type !== 'string' || seen.has(value)) return;
  if (sourceOf(value) !== undefined) return;
  seen.add(value);
  withSource(value, ref);
  if (definitionOf(value as Band)) {
    for (const child of nestedBandsOf(value as Band, definitionOf)) markPart(child, ref, seen, definitionOf);
  }
}

/**
 * Capture the call to a public builder while preserving its overloads and properties. `definitionOf` (default: the definition a band carries) finds the definition of a part that
 * carries none yet (the all-in-one builders make plain data: located-full.ts), so the parts nested in it are marked too.
 */
export function located<F>(fn: F, definitionOf: DefinitionOf = defOf): F {
  if (typeof fn !== 'function') return fn;
  const wrapped = {
    call(this: unknown, ...args: unknown[]): unknown {
      if (!sourceCaptureEnabled()) return Reflect.apply(fn, this, args);
      const ref = captureHere(wrapped);
      const result: unknown = Reflect.apply(fn, this, args);
      if (ref) {
        const seen = new Set<object>();
        if (Array.isArray(result)) {
          for (const part of result) markPart(part, ref, seen, definitionOf);
        } else markPart(result, ref, seen, definitionOf);
      }
      return result;
    },
  }.call;
  for (const key of Reflect.ownKeys(fn)) {
    const descriptor = Object.getOwnPropertyDescriptor(fn, key);
    if (!descriptor) continue;
    if (typeof descriptor.value === 'function') descriptor.value = located(descriptor.value, definitionOf);
    Object.defineProperty(wrapped, key, descriptor);
  }
  return wrapped as F;
}

/** For a composer that builds plain data (no definitions): a band that holds bands in `children` is walked through them. */
export const holdsChildren: DefinitionOf = band =>
  Array.isArray((band as {children?: unknown}).children) ? {type: band.type, children: (held: Band) => (held as {children: Band[]}).children} as unknown as BandDef : undefined;
