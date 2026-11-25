import type { Declares, HandleOf } from '../strict.ts';
import type { BowtieBand, BowtieInput, BowtieOpts } from '../types/diagrams.ts';
/**
 * A bow-tie diagram (ボウタイ図): the top event (the loss of control) in the middle under its hazard; threats on the left, each through the
 * preventive barriers that stand between it and the top event; consequences on the right, each through the mitigating barriers. The flow
 * runs left to right. `maxNodeW` as for faultTree(): left out, a figure wider than the diagram is narrowed with a warning.
 *   bowtie({hazard: '顧客データ', top: '個人情報の漏えい',
 *           threats: [{label: '不正アクセス', barriers: ['多要素認証', 'アクセス制限']}, {label: '誤送信', barriers: ['送信前の確認']}],
 *           consequences: [{label: '信用の低下', barriers: ['広報対応']}, {label: '賠償', barriers: ['保険']}]})
 */
export declare function bowtie<const Id extends string = never>(input: BowtieInput, opts?: BowtieOpts & {
    id?: Id;
}): BowtieBand & Declares<Id> & HandleOf<Id>;
