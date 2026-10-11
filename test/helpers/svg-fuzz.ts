// Seeded random SVG scenes for comparing two implementations of the checks on a rendering. The same seed gives the same scenes.
export const STYLE = `<style>text { font-family: 'Hiragino Sans','Hiragino Kaku Gothic ProN','Yu Gothic','YuGothic',Meiryo,'Noto Sans JP',sans-serif; }</style>`;
const COLORS = ['#ffffff', '#000000', '#22201b', '#1f5fa8', '#e0e0e0', '#cccccc', '#f4efe6', '#b71c1c', '#666666', '#fefefe', 'none'];
const WORDS = ['在庫', 'Inventory', 'ダッシュボード', 'AV', 'Total: 1,240', '発注する', 'Yo Tao', 'ほぼ長めのラベルです', 'x', 'M8', 'ナット'];

export function scenes(seed: number, count: number): string[] {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ri = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
  const pick = <T,>(xs: T[]) => xs[ri(0, xs.length - 1)];
  const scene = () => {
    const W = pick([300, 400, 600]), H = pick([160, 240, 320]);
    const els: string[] = [];
    for (let i = 0, n = ri(6, 16); i < n; i++) {
      const k = rnd();
      const x = ri(0, W - 20), y = ri(10, H - 10);
      const common = `fill="${pick(COLORS)}" stroke="${pick(['none', '#000000', '#1f5fa8'])}" stroke-width="${pick([1, 2, 4])}" fill-opacity="${pick([1, 1, 1, 0.9, 0.7, 0.3])}" opacity="${pick([1, 1, 1, 0.8])}"`;
      let el: string;
      if (k < 0.3) el = `<rect x="${x}" y="${y}" width="${ri(10, 220)}" height="${ri(8, 90)}" ${common}/>`;
      else if (k < 0.65) {
        const txt = pick(WORDS);
        el = `<text x="${x}" y="${y}" font-size="${pick([14, 16, 18, 20, 24])}" ${rnd() < 0.3 ? 'font-weight="700"' : ''} text-anchor="${pick(['start', 'middle', 'end'])}" fill="${pick(COLORS.filter(c => c !== 'none'))}">${rnd() < 0.2 ? `${txt} <tspan font-weight="700">${pick(WORDS)}</tspan>` : txt}</text>`;
      } else if (k < 0.75) el = `<circle cx="${x}" cy="${y}" r="${ri(4, 40)}" ${common}/>`;
      else if (k < 0.88) el = `<path d="M${x} ${y} L${x + ri(-150, 150)} ${y + ri(-30, 30)}" fill="none" stroke="${pick(['#000000', '#b71c1c'])}" stroke-width="${pick([1, 2])}"/>`;
      else if (k < 0.94) el = `<line x1="${x}" y1="${y}" x2="${x + ri(20, 200)}" y2="${y}" stroke="#000" fill="none"/>`;
      else el = `<path d="M${x} ${y} C ${x + 40} ${y - 50}, ${x + 90} ${y + 50}, ${x + 130} ${y}" fill="none" stroke="#000"/>`;
      if (rnd() < 0.08) el = `<g transform="translate(${ri(-20, 20)} ${ri(-10, 10)}) rotate(${ri(-30, 30)} ${x} ${y})">${el}</g>`;
      if (rnd() < 0.08) el = `<g data-allow-cover="1">${el}</g>`;
      els.push(el);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${STYLE}${els.join('')}</svg>`;
  };
  return Array.from({length: count}, scene);
}
