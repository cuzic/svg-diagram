import {CHILD_BANDS, nestedBandsOf} from './band-children.ts';
import {sourceCaptureEnabled} from './source-capture.ts';
import {captureHere, withSource} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import type {Band} from './types/index.ts';

function markPart(value: unknown, ref: SourceRef, seen: Set<object>): void {
  if (typeof value !== 'object' || value === null || !('type' in value) || typeof value.type !== 'string' || seen.has(value)) return;
  seen.add(value);
  withSource(value, ref);
  if (Object.hasOwn(CHILD_BANDS, value.type)) {
    for (const child of nestedBandsOf(value as Band)) markPart(child, ref, seen);
  }
}

/** Capture the call to a public builder while preserving its overloads and properties. */
export function located<F>(fn: F): F {
  if (typeof fn !== 'function') return fn;
  const wrapped = {
    call(this: unknown, ...args: unknown[]): unknown {
      if (!sourceCaptureEnabled()) return Reflect.apply(fn, this, args);
      const ref = captureHere(wrapped);
      const result: unknown = Reflect.apply(fn, this, args);
      if (ref) {
        const seen = new Set<object>();
        if (Array.isArray(result)) {
          for (const part of result) markPart(part, ref, seen);
        } else markPart(result, ref, seen);
      }
      return result;
    },
  }.call;
  for (const key of Reflect.ownKeys(fn)) {
    const descriptor = Object.getOwnPropertyDescriptor(fn, key);
    if (!descriptor) continue;
    if (typeof descriptor.value === 'function') descriptor.value = located(descriptor.value);
    Object.defineProperty(wrapped, key, descriptor);
  }
  return wrapped as F;
}
