// CBT の 5 領域モデル（架空の記入例）: 状況・環境の枠の中で、思考・感情・行動・身体がたがいに影響し合う。cycle の links: 'all' で、
// 4 つを正方形に置いて全部の組を両向きの矢印で結ぶ（ADR 0065）。
// ビルド: svg-diagram build examples/cycle-cbt-five-areas.ts --out examples/out/cycle-cbt-five-areas.svg
import {cycle, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', width: 940, title: '5 領域モデルで見る、ある朝のできごと'}).add(cycle(
    [
      {label: '思考', sub: 'また失敗した'},
      {label: '感情', sub: '不安・恥ずかしさ'},
      {label: '行動', sub: '返事を先延ばし'},
      {label: '身体', sub: '肩がこわばる'},
    ],
    {links: 'all', frame: '状況・環境：上司に資料の修正を頼まれた'},
  ));
}
