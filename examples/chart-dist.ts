import {diagram, displot, kdeplot, row} from 'svg-diagram';

// seaborn の histplot / kdeplot / ecdfplot / rugplot: 生の値を渡すと、階級・密度・累積は計算される（乱数なし）。
// 複数グループは色と線の種類（実線・破線…）の両方で見分ける。
const men = [62, 65, 67, 68, 69, 70, 70, 71, 72, 72, 73, 74, 74, 75, 76, 77, 78, 80, 82, 85];
const women = [48, 50, 52, 53, 54, 55, 56, 57, 57, 58, 59, 60, 61, 62, 63, 64, 66, 68, 70];
export default function define() {
  return diagram({theme: 'blue', title: '体重の分布（ヒストグラム・KDE・ECDF）', sourceLine: '出典: 説明用の例'}).add(
    row([
      displot(men, {kind: ['hist', 'kde', 'rug'], label: '体重（kg）', binWidth: 5}),
      kdeplot({男性: men, 女性: women}, {label: '体重（kg）'}),
    ]),
    row([
      displot({男性: men, 女性: women}, {label: '体重（kg）', stat: 'probability', element: 'step', binWidth: 5}),
      displot({男性: men, 女性: women}, {kind: ['ecdf', 'rug'], label: '体重（kg）'}),
    ]),
  );
}
