// フロー理論（チクセントミハイ）の図。スキルと挑戦度の釣り合う斜めの帯が「フロー」で、帯の外が不安・退屈・無関心。
// ビルド: svg-diagram build examples/quadrant-flow.ts --out examples/out/quadrant-flow.svg
import {diagram, quadrant} from 'svg-diagram';

export default function define() {
  const d = diagram({theme: 'blue', width: 940, gap: 20, title: 'フロー理論：スキルと挑戦度のバランス'});
  d.add(quadrant.preset('positioning', {
    x: {title: 'スキル', low: '低い', high: '高い'}, y: {title: '挑戦度', low: '易しい', high: '難しい'},
    height: 420,
    regions: [
      {title: '不安', note: '挑戦がスキルを上回る', tone: 'changed', points: [[0, 0.25], [0, 1], [0.75, 1]], at: [0.17, 0.82]},
      {title: '退屈', note: 'スキルが挑戦を上回る', tone: 'muted', points: [[0.25, 0], [1, 0], [1, 0.75]], at: [0.83, 0.18]},
      {title: 'フロー', note: '挑戦とスキルが釣り合う', tone: 'accent', points: [[0, 0], [0.25, 0], [1, 0.75], [1, 1], [0.75, 1], [0, 0.25]], at: [0.62, 0.38]},
      {title: '無関心', tone: 'plain', points: [[0, 0], [0.22, 0], [0, 0.22]], at: [0.06, 0.06]},
    ],
    groups: ['学習の経過'],
    items: [
      {id: 'a', label: '入門', at: [0.3, 0.32], group: '学習の経過'},
      {id: 'b', label: '慣れてきた', at: [0.55, 0.6], group: '学習の経過'},
      {id: 'c', label: '熟達', at: [0.85, 0.9], group: '学習の経過'},
    ],
    arrows: [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}],
  }));
  return d;
}
