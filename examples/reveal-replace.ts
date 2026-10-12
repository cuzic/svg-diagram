import {banner, bars, box, diagram, row} from 'svg-diagram';

// A bar that vanishes at a click (`until`) and a bar that takes its place (`replaces`), plus a box that goes away.
export default function define() {
  const gate = box({id: 'gate', title: '号令を待つ', until: 2});
  const next = box({id: 'next', title: '許可を待つ', reveal: 2});
  return diagram({theme: 'blue', title: '号令から許可へ', spotlight: {ids: 'chart', mutedOk: true}}).add(
    banner({headline: '号令では動けない。許可で動く'}),
    row([gate, next], {id: 'flow'}),
    bars([
      {id: 'order', label: '号令', value: 76, until: 2},
      {id: 'allow', label: '許可', value: 31, series: 'b', reveal: 2, replaces: 'order'},
      {label: '自分で判断', value: 12, series: 'c', reveal: 3},
    ], {id: 'chart', max: 100, unit: '%'}),
  );
}
