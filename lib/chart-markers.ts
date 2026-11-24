export type Shape = 'disc' | 'diamond' | 'square' | 'triangle' | 'ring';
export const SHAPES: Shape[] = ['disc', 'diamond', 'square', 'triangle'];
const r1 = (v: number): number => Math.round(v * 10) / 10;
export function markerPath(shape: Shape, x: number, y: number, r: number): string {
  const [a, b, c, d] = [x - r, x + r, y - r, y + r].map(r1);
  switch (shape) {
    case 'diamond': return `M${r1(x)},${c} L${b},${r1(y)} L${r1(x)},${d} L${a},${r1(y)} Z`;
    case 'square': return `M${a},${c} H${b} V${d} H${a} Z`;
    case 'triangle': return `M${r1(x)},${c} L${b},${d} L${a},${d} Z`;
    default: return `M${a},${r1(y)} a${r},${r} 0 1,0 ${r1(2 * r)},0 a${r},${r} 0 1,0 ${r1(-2 * r)},0 Z`;
  }
}
