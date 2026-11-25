
import type {SpacerBand} from '../types/containers.ts';
import {assertNoReveal} from './shared.ts';

export function spacer(h: number, opts?: {reveal?: number}): SpacerBand {
  assertNoReveal(opts, 'spacer()');
  return {type: 'spacer', h};
}
