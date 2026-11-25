import {object, text} from '../spec-kit.ts';
import type {Json} from '../spec-kit.ts';
import {MAX_FTA_EVENTS, MAX_FTA_DEPTH, optionsOf, ftaEvent, checkFta, FTA_EN} from './r4-common.ts';
import type {PartDef} from '../spec-kit.ts';

export function defineFaultTreePart<Result>(builder: (top: never, opts: never) => Result): PartDef<Result> {
  return {
    type: 'faultTree',
    description: 'A fault tree (FTA): the top event (the failure to prevent) at the top, a logic gate under each event (and, or, vote, inhibit) and its inputs below, down to basic events (circles) and undeveloped events (diamonds). An event with no gate needs a kind. `{ref: id}` repeats a basic event that feeds two gates. cutSets marks the events that alone cause the top event; quant works out its probability from every basic event\'s p.',
    schema: object({
      type: {const: 'faultTree'},
      top: ftaEvent(MAX_FTA_DEPTH),
      cutSets: {type: 'boolean', description: 'true: mark the single points of failure (events that alone cause the top event).'},
      quant: {type: 'boolean', description: 'true: work out the probability of the top event (every basic and undeveloped event needs p).'},
      quantPeriod: text('The period p is over, such as 1 年間 (with quant).', 20),
      maxNodeW: {type: 'integer', minimum: 80, maximum: 400, description: 'The widest an event box may grow, in px (default 200, narrowed when the tree is too wide).'},
    }, ['type', 'top']),
    example: {type: 'faultTree', top: {label: 'サービスが止まる', gate: 'or', children: [{label: 'DB が止まる', gate: 'and', children: [{label: '主系の故障', kind: 'basic'}, {label: '切り替えの失敗', kind: 'basic'}]}, {label: 'アプリの全台停止', kind: 'undeveloped'}]}},
    en: {words: FTA_EN},
    check(part, at, issues) {
      const ids = new Map<string, string>(), refs: [string, string][] = [], count = {n: 0};
      const top = part['top'] as Json;
      if (top['ref'] !== undefined) { issues.push({path: `${at}.top.ref`, message: 'the top event cannot be a ref'}); return; }
      if (top['gate'] === undefined) issues.push({path: `${at}.top.gate`, message: 'the top event needs a gate and the events under it'});
      checkFta(top, `${at}.top`, ids, refs, count, 0, issues);
      if (count.n > MAX_FTA_EVENTS) issues.push({path: `${at}.top`, message: `holds ${count.n} events; the limit is ${MAX_FTA_EVENTS}`});
      for (const [r, path] of refs) {
        const kind = ids.get(r);
        if (kind === undefined) issues.push({path, message: `"${r}" is not the id of an event (known: ${[...ids.keys()].join(', ')})`});
        else if (kind === 'event') issues.push({path, message: `"${r}" has a gate under it; only a basic, undeveloped, house or condition event can be drawn again`});
      }
      if (part['quantPeriod'] !== undefined && part['quant'] !== true) issues.push({path: `${at}.quantPeriod`, message: 'goes with quant: true'});
    },
    build(part) {
      const {top, ...opts} = optionsOf(part);
      return builder(top as never, opts as never);
    },
  };
}
