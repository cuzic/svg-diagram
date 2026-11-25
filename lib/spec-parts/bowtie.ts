import {MAX_NODE_WIDTH, list, object, text} from '../spec-kit.ts';
import {optionsOf} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineBowtiePart<Result>(builder: (input: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'bowtie',
    description: 'A bow-tie diagram for a risk: the top event (the moment control is lost) in the middle under its hazard, the threats that cause it on the left with the preventive barriers between them and it, and the consequences on the right with the barriers that limit them. The figure is one row of boxes across: keep every label short (about 10 characters), and give at most two barriers per threat or consequence; one fits best.',
    schema: object({
      type: {const: 'bowtie'},
      hazard: text('What is kept under control, drawn above the top event.', 40),
      top: text('The top event: the loss of control.', 40),
      threats: list(object({label: text('A cause of the top event.', 40), barriers: list(text('A preventive barrier, in the order the threat meets it.', 20), 2)}, ['label']), 6, 1),
      consequences: list(object({label: text('A result of the top event.', 40), barriers: list(text('A barrier that limits it, in the order it is met.', 20), 2)}, ['label']), 6, 1),
      maxNodeW: MAX_NODE_WIDTH,
    }, ['type', 'top', 'threats', 'consequences']),
    example: {type: 'bowtie', hazard: '顧客の個人情報', top: '個人情報が漏えいする', threats: [{label: '不正アクセス', barriers: ['多要素認証']}, {label: '誤送信', barriers: ['宛先の確認']}], consequences: [{label: '信用の低下', barriers: ['速やかな公表']}]},
    check() {},
    build(part) {
      const {hazard, top, threats, consequences, ...opts} = optionsOf(part);
      return builder({...(hazard === undefined ? {} : {hazard}), top, threats, consequences} as never, opts as never);
    },
  };
}
