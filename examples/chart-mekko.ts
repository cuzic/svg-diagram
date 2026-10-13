import {diagram, mekko} from 'svg-diagram';

// マリメッコ図（バリアブル幅の 100% 積み上げ）: 列の幅が市場規模、高さが各社の中の構成比。面積が全体に占める割合になる。
// 小さすぎて数字が入らない部分は描かず、説明（<desc>）に残る。
export default function define() {
  return diagram({theme: 'blue', title: '地域別の市場規模とメーカー別シェア', sourceLine: '出典: 説明用の例'}).add(
    mekko(
      [
        {label: '北米', parts: [{label: 'A 社', value: 520}, {label: 'B 社', value: 310}, {label: 'C 社', value: 190}, {label: 'その他', value: 180}]},
        {label: '欧州', parts: [{label: 'A 社', value: 240}, {label: 'B 社', value: 280}, {label: 'C 社', value: 90}, {label: 'その他', value: 140}]},
        {label: '日本', parts: [{label: 'A 社', value: 100}, {label: 'B 社', value: 60}, {label: 'C 社', value: 220}, {label: 'その他', value: 70}]},
        {label: '東南アジア', parts: [{label: 'A 社', value: 40}, {label: 'B 社', value: 20}, {label: 'C 社', value: 12}, {label: 'その他', value: 60}]},
      ],
      {unit: '億円', height: 380},
    ),
  );
}
