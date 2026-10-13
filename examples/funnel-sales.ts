// 値に比例した幅の営業ファネル（scale: 'value'）。showRate で前段からの率を出す。狭い段の文字は右へ出る。
// ビルド: svg-diagram build examples/funnel-sales.ts --out examples/out/funnel-sales.svg
import {diagram, funnel} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '営業ファネル'}).add(funnel([
    {id: 'visit', label: '訪問', value: 1200},
    {label: '問い合わせ', value: 420},
    {label: '商談', value: 160},
    {id: 'win', label: '成約', value: 52},
  ], {scale: 'value', showRate: true}));
}
