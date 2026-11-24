
import {resolveIcon} from '../icon-registry.ts';
import type {SequenceActor, SequenceBand, SequenceOpts, SequenceStep} from '../types/sequence-table-swimlane.ts';
import type {ActorIn, Declares, HandleOf, SeqStepIn} from '../strict.ts';
import {assertBoxTone, revealOf, withHandle} from './shared.ts';

// UML-style sequence diagram. actors: [{id, label, tone?}]. steps (in time order):
//   {from, to, label, line?: 'solid'|'dashed'|'dotted'|'double', arrow?, tone?, number?: false}
//   {self: id, label}                      — a call to the same participant
//   {note: text, over: id | [id, id]}      — a note box over one or more participants
//   {divider: text}                        — a phase separator across the whole width
// Messages are auto-numbered 1, 2, ... (sequence(..., {numbered: false}) to turn off) so
// the picture lines up with a numbered list in the surrounding text.
// Types: every `from` / `to` / `self` / `over` must be a declared actor id, and `from` may not equal `to`
// (runtime: "unknown actor" / "use {self: id}"); an `id` in opts becomes a connect() anchor.
export function sequence<const A extends string, const Id extends string = never>(actors: ActorIn<A>[], steps: SeqStepIn<NoInfer<A>>[], opts?: SequenceOpts & {id?: Id}): SequenceBand & Declares<Id> & HandleOf<Id>;
export function sequence(actors: SequenceActor[], steps: SequenceStep[], opts: SequenceOpts = {}): SequenceBand {
  for (const a of actors) assertBoxTone(a.tone, `sequence() actor "${a.id}"`);
  // an icon is resolved here (the shell) and carried on the actor, so layout and emit stay free of I/O
  if (actors.some(a => a.iconTone !== undefined && a.icon === undefined)) throw new Error('sequence(): an actor has iconTone but no icon');
  actors = actors.map(a => a.icon === undefined ? a : {...a, iconGlyph: resolveIcon(a.icon, `sequence() actor "${a.id}" icon`)});
  for (const st of steps) if ('note' in st) assertBoxTone((st as {tone?: string}).tone, 'sequence() note');
  return withHandle({type: 'sequence', actors, steps, numbered: opts.numbered, id: opts.id, ...revealOf(opts)}, opts.id);
}
