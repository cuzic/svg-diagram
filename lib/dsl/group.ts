import {richField} from '../rich.ts';
import type {Declares, HandleOf, IdsOf, Refers, RefsOf} from '../strict.ts';
import type {GroupBand, GroupOpts} from '../types/containers.ts';
import type {BandInput} from '../types/core.ts';
import type {Band} from '../types/index.ts';
import {assertBoxTone, revealOf, withHandle} from './shared.ts';

export function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {id?: Id}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
export function group(children: BandInput, opts: GroupOpts = {}): GroupBand {
  assertBoxTone(opts.tone, 'group()');
  if ('gap' in opts && (opts as {gap?: unknown}).gap !== undefined) throw new Error('group(): there is no gap option — the space between boxes is the gap of the row() they sit in (row([...], {gap})), or diagram({gap}) between bands');
  if (opts.valign !== undefined && !['top', 'center', 'stretch'].includes(opts.valign)) throw new Error(`group(): valign must be 'top', 'center' or 'stretch', got ${JSON.stringify(opts.valign)}`);
  const title = richField(opts.title, {field: 'group() title', bold: true, tone: opts.titleTone ?? (opts.tone === 'accent' ? 'accent' : 'text')});
  if (opts.frame === false && (title.text || opts.dashed || opts.tone)) throw new Error('group({frame: false}) draws no frame, so it takes no title, tone or dashed');
  return withHandle({type: 'group', children: [children].flat(), title: title.text, ...(title.spans ? {spans: {title: title.spans}} : {}), titleTone: opts.titleTone, titleAlign: opts.titleAlign, tone: opts.tone ?? 'muted', dashed: opts.dashed ?? (opts.tone === 'plain' ? true : undefined), pad: opts.pad ?? (opts.frame === false ? 0 : undefined), frame: opts.frame, stamp: opts.stamp, ...(opts.valign ? {valign: opts.valign} : {}), id: opts.id, flex: opts.flex, width: opts.width, span: opts.span, col: opts.col, ...revealOf(opts)}, opts.id);
}
