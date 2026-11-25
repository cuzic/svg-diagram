import {bowtieCheck} from '../bowtie.ts';
import type {Declares, HandleOf} from '../strict.ts';
import type {BowtieBand, BowtieInput, BowtieOpts, BowtieSide} from '../types/diagrams.ts';
import {revealOf, scopeOpt, withHandle} from './shared.ts';

/**
 * A bow-tie diagram (ボウタイ図): the top event (the loss of control) in the middle under its hazard; threats on the left, each through the
 * preventive barriers that stand between it and the top event; consequences on the right, each through the mitigating barriers. The flow
 * runs left to right. `maxNodeW` as for faultTree(): left out, a figure wider than the diagram is narrowed with a warning.
 *   bowtie({hazard: '顧客データ', top: '個人情報の漏えい',
 *           threats: [{label: '不正アクセス', barriers: ['多要素認証', 'アクセス制限']}, {label: '誤送信', barriers: ['送信前の確認']}],
 *           consequences: [{label: '信用の低下', barriers: ['広報対応']}, {label: '賠償', barriers: ['保険']}]})
 */
export function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {id?: Id}): BowtieBand & Declares<Id> & HandleOf<Id>;
export function bowtie(input: BowtieInput, opts: BowtieOpts = {}): BowtieBand {
  bowtieCheck(input);
  if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80)) throw new Error(`bowtie(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
  const side = (s: BowtieSide): BowtieSide => ({label: s.label, ...(s.barriers === undefined ? {} : {barriers: [...s.barriers]})});
  const band: BowtieBand = {type: 'bowtie', ...(input.hazard === undefined ? {} : {hazard: input.hazard}), event: input.top, threats: input.threats.map(side), consequences: input.consequences.map(side), ...(opts.maxNodeW === undefined ? {} : {maxNodeW: opts.maxNodeW}), ...(opts.id === undefined ? {} : {id: opts.id}), ...scopeOpt(opts, 'bowtie()'), ...revealOf(opts)};
  return withHandle(band, opts.id);
}
