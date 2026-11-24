import type {ConnectBand} from '../types/containers.ts';
import type {TextTone} from '../types/core.ts';
import type {Ok, Refers} from '../strict.ts';
import type {RevealOpts} from '../types/core.ts';
import {connectBand} from './defaults.ts';

export interface CalloutOpts extends RevealOpts {
  /** The text of the bubble (one line). */
  text: string;
  /** Which side of the target the bubble is on (default 'above'). */
  side?: 'above' | 'below' | 'left' | 'right';
  tone?: TextTone;
}
/** A bubble with a leader line pointing at a box: `callout('slow', {text: '344ms かかる', side: 'below'})`. Put the target's id or 'id:side'. */
export function callout<const T extends string>(target: Ok<T>, opts: CalloutOpts): ConnectBand & Refers<T>;
export function callout(target: string, opts: CalloutOpts): ConnectBand {
  const side = opts?.side ?? 'above';
  if (!['above', 'below', 'left', 'right'].includes(side)) throw new Error(`callout(): side must be above | below | left | right (got ${JSON.stringify(side)})`);
  if (typeof opts?.text !== 'string' || !opts.text.trim()) throw new Error('callout(): text is required');
  return {...connectBand(target, target, {arrow: 'end', tone: opts.tone, label: opts.text, chip: true, reveal: opts.reveal, until: opts.until}, false), annot: {kind: 'callout', side}};
}
