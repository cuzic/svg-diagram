import {caption, diagram, math} from 'svg-diagram';

// TeX の数式を MathJax で輪郭に変換して置く（Web フォント不要の自己完結 SVG）。バックスラッシュが残るよう String.raw で書く。
export default function define() {
  return diagram({theme: 'blue', title: '数式'}).add(
    caption('ガウス積分', {bold: true, tone: 'text'}),
    math(String.raw`\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}`, {role: 'stat', alt: 'e の -x 二乗乗を全実数で積分すると √π'}),
    caption('二次方程式の解の公式', {bold: true, tone: 'text'}),
    math(String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`, {role: 'banner', tone: 'accent'}),
    math(String.raw`\mathbf{A}\mathbf{v} = \lambda \mathbf{v}, \quad \sum_{k=1}^{n} k = \frac{n(n+1)}{2}`, {align: 'left'}),
  );
}
