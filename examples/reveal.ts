import {banner, bars, box, connect, diagram, group, row, table} from 'svg-diagram';

export default function define() {
  const overview = box({id: 'overview', title: '全体像', body: '最初から表示'});
  const detail = box({id: 'detail', title: '詳細', body: '1 回目で表示', reveal: 1});
  return diagram({theme: 'blue', title: '段階表示'}).add(
    banner({headline: 'クリックで説明を積み上げる', reveal: 1}),
    row([overview, detail], {id: 'flow'}),
    connect(overview.right, detail.left),
    group([
      table([{label: '指標'}, {label: '値'}], [['完了率', '76%']], {reveal: 1}),
      bars([
        {label: '導入前', value: 76, reveal: 2},
        {label: '導入後', value: 31, series: 'b', reveal: 3},
      ], {max: 100, unit: '%'}),
    ], {title: '根拠', reveal: 2}),
  );
}
