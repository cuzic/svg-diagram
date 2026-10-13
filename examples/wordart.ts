import {banner, diagram, wordart} from 'svg-diagram';

// ワードアート: 太字・縁取り・影・光彩・立体・反射・グラデーション・弧・回転と、縦書き。色は token の鍵だけ(生の色は使えない)。
export default function define() {
  return diagram({theme: 'blue', title: 'ワードアート'}).add(
    banner({headline: '飾り文字と縦書き', tone: 'accent'}),
    wordart('新製品発表会', {style: 'sticker', size: 64}),
    wordart('SALE 50% OFF', {style: 'outline', size: 52}),
    wordart('グラデーション', {style: 'gradient', size: 48}),
    wordart('光る文字', {style: 'glow', size: 48}),
    wordart('立体文字', {style: '3d', size: 48}),
    wordart('エンボス', {style: 'emboss', size: 48}),
    wordart('リフレクション', {style: 'reflect', size: 44}),
    wordart('虹形に曲げた見出し', {style: 'shadow', size: 40, arc: 120}),
    wordart('笑顔の形に曲げる', {style: 'bold', size: 40, arc: -60, tone: 'danger'}),
    wordart('少し傾ける', {style: 'sticker', size: 44, rotate: -6}),
    wordart('中抜き', {style: 'plain', size: 52, tone: 'none', outline: {tone: 'accent', width: 2}}),
    wordart('縦書きの見出し、句読点や「括弧」もそろえる。\n令和8年10月13日 第3回 SVG 勉強会', {writing: 'vertical', style: 'sticker', size: 32}),
  );
}
