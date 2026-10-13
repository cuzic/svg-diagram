import {canvas, diagram} from 'svg-diagram';

// マッキンゼーの 7S: 中心に共通の価値観、まわりにハードの S（戦略・組織構造・制度）とソフトの S（経営スタイル・人材・スキル）。
// 「ハード／ソフト」はタグの言葉で分かる（色だけに頼らない）。
export default function define() {
  return diagram({theme: 'blue', title: '地方スーパーの 7S 診断', sourceLine: '出典: 説明用の例'}).add(
    canvas('sevenS', {
      strategy: ['惣菜と地元産の鮮度で勝つ', '郊外への出店は止める'],
      structure: ['店長に仕入れの裁量がある', '本部は 12 人と小さい'],
      systems: ['発注は店ごとの手書き台帳', '売れ筋の集計が週 1 回'],
      values: ['地元の食卓を守る', '顔の見える商売'],
      style: ['社長が毎朝売り場に立つ'],
      staff: ['パートが主力（平均勤続 9 年）', '若手が定着しない'],
      skills: ['鮮魚のさばき', '惣菜の開発', 'データ活用は弱い'],
    }, {title: '7S の現状', emphasis: ['systems']}),
  );
}
