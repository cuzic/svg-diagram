import {banner, box, caption, diagram, row, stat} from 'svg-diagram';

// 暗い背景の資料用。appearance: 'dark' で暗いトークン一式に（ここでは {dark: {...}} で資料の色に差し替えている）、transparent: true で背景の矩形なしになる
// （透明のときのコントラスト検査は、暗いトークンの背景色の上に置いたものとして行う）。
export default function define() {
  return diagram({theme: 'teal', appearance: {dark: {bg: '#0b1220', text: '#ffffff', muted: '#94a3b8', accent: '#60a5fa', soft: '#1a3070'}}, transparent: true, title: '導入前後の離脱率（暗い背景）', legend: 'auto'}).add(
    caption('導入前後の離脱率', {bold: true}),
    banner({headline: '離脱率は半分以下になった', tone: 'solid'}),
    row([
      stat('76%', '導入前', {tone: 'danger', size: 'display'}),
      stat('31%', '導入後', {tone: 'accent', size: 'display'}),
    ]),
    box({title: '次の一手', body: '残りの 31% を新規ユーザーの初回画面で減らす', tone: 'accent'}),
  );
}
