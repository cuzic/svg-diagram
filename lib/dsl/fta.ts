import {ftaIds, ftaResolve, ftaSinglePoints, ftaQuant} from '../fta.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import type {FtaBand, FtaEvent, FtaOpts} from '../types/diagrams.ts';
import {revealOf, scopeOpt, withAnchors, withHandle} from './shared.ts';

/** The ids of a fault tree's events: its own, and those of every input and every inhibit condition below it. */
type FtaIds<T> = (T extends {readonly id: infer I extends string} ? I : never) | (T extends {readonly children: readonly (infer C)[]} ? FtaIds<C> : never) | (T extends {readonly condition: infer C} ? FtaIds<C> : never);
/**
 * A fault tree (FTA): the top event, a gate under it (and / or / vote with k / inhibit) and the events that cause it, down to basic events (circle),
 * undeveloped events (diamond) and house events. Each event's text is a rectangle with the symbol of its kind under it; `{ref: id}` draws a
 * basic / undeveloped / house / condition event again. The lines have no arrowheads (they join a gate to its inputs: the tree reads downward).
 *   faultTree({label: 'サービス停止', gate: 'or', children: [
 *     {label: 'DB 全体停止', gate: 'and', children: [{label: '主系停止', kind: 'basic'}, {id: 'sw', label: '待機系へ切替不能', kind: 'basic'}]},
 *     {label: 'アプリ全台停止', kind: 'undeveloped'}]})
 */
export function faultTree<const T extends FtaEvent, const Id extends string = never>(top: T, opts?: FtaOpts & {id?: Id}): FtaBand & Declares<Id | FtaIds<T>> & HandleOf<Id> & AnchorsOf<FtaIds<T>>;
export function faultTree(top: FtaEvent, opts: FtaOpts = {}): FtaBand {
  if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80)) throw new Error(`faultTree(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
  if (opts.cutSets !== undefined && typeof opts.cutSets !== 'boolean') throw new Error(`faultTree(): cutSets is true or false (got ${String(opts.cutSets)})`);
  const {root} = ftaResolve(top); // every mistake in the tree throws here, naming the event
  if (opts.cutSets) ftaSinglePoints(root); // throws when the tree has too many cut sets to find them
  if (opts.quant !== undefined && typeof opts.quant !== 'boolean') throw new Error(`faultTree(): quant is true or false (got ${String(opts.quant)})`);
  if (opts.quantPeriod !== undefined && (typeof opts.quantPeriod !== 'string' || !opts.quantPeriod.trim() || !opts.quant)) throw new Error('faultTree(): quantPeriod is a non-empty string, and goes with quant: true');
  if (opts.quant) ftaQuant(root, opts.quantPeriod, opts.words); // throws for an event without p
  const band: FtaBand = {type: 'fta', root: top, ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.cutSets === undefined ? {} : {cutSets: opts.cutSets}), ...(opts.quant === undefined ? {} : {quant: opts.quant}), ...(opts.quantPeriod === undefined ? {} : {quantPeriod: opts.quantPeriod}), ...(opts.words === undefined ? {} : {words: {...opts.words}}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'faultTree()'), ...revealOf(opts)};
  return withAnchors(withHandle(band, opts.id), ftaIds(top));
}
