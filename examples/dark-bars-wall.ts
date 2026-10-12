import {bars, caption, diagram} from 'svg-diagram';

// 濃い背景の資料に透明で重ねる棒グラフ。資料の色（背景 #0b1220、白い文字）と、濃い赤の danger（#dc2626）で「赤い壁」を描く。
// danger は文字にも使われるので、4.5:1 に届かない色（#dc2626 は暗い背景で約 3.9:1）を文字に使うと a11y-text-contrast が出る。
// 棒の塗りは 3:1 で足りるので、ここでは棒だけに使い、文字の danger は使わない。
export default function define() {
  return diagram({
    theme: 'blue', title: '要求が壁になる様子', transparent: true,
    appearance: {dark: {bg: '#0b1220', text: '#ffffff', muted: '#94a3b8', accent: '#60a5fa', soft: '#1e3a8a', danger: '#dc2626'}},
  }).add(
    caption('必要な電力と、使える電力', {bold: true, tone: 'text'}),
    bars([
      {label: '使える', value: 40, series: 'a'},
      {label: '必要', value: 100, tone: 'danger'},
    ], {max: 100, unit: '%'}),
  );
}
