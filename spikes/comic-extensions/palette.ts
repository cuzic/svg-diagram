// ADR 0076 spike: is a small avatar palette readable? Contrast of every fill against the ink outline (#222) and the paper (#fffdf6),
// and hair against skin. WCAG 1.4.11 asks 3:1 for the parts of a graphic that are needed to understand it.
import {contrast} from '../comic-worksheet/proto.ts';

export const INK = '#222222', PAPER = '#fffdf6';
export const SKIN = {fair: '#ffe3c8', light: '#f6d0a8', medium: '#e2ab7c', tan: '#c98c5c', brown: '#9c6341', dark: '#6e4430'} as const;
export const HAIR = {black: '#1f1f24', brown: '#4a3322', chestnut: '#7d4a2b', blond: '#d2a640', gray: '#9097a3', navy: '#2d3f66'} as const;
export const TOP = {navy: '#3b5b92', blue: '#5b8ed6', teal: '#2f8f8a', green: '#5a9a52', yellow: '#e0b43a', orange: '#e0833a', red: '#c8473f', purple: '#7a58b0', gray: '#7b8290'} as const;

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = (name: string, p: Record<string, string>) => Object.entries(p).map(([k, v]) => ({set: name, key: k, vsInk: +contrast(v, INK).toFixed(2), vsPaper: +contrast(v, PAPER).toFixed(2)}));
  const all = [...rows('skin', SKIN), ...rows('hair', HAIR), ...rows('top', TOP)];
  console.log('min fill vs ink:', Math.min(...all.map(r => r.vsInk)), ' worst:', all.filter(r => r.vsInk < 3).map(r => `${r.set}.${r.key}=${r.vsInk}`).join(' ') || 'none under 3');
  console.log('min vs paper (a body must stand out from the page):', all.map(r => `${r.set}.${r.key}=${r.vsPaper}`).join(' '));
  const pairs = Object.entries(HAIR).flatMap(([h, hv]) => Object.entries(SKIN).map(([s, sv]) => ({h, s, c: +contrast(hv, sv).toFixed(2)})));
  console.log('hair vs skin: min', Math.min(...pairs.map(p => p.c)), 'pairs under 3:', pairs.filter(p => p.c < 3).map(p => `${p.h}/${p.s}=${p.c}`).join(' '), '(', pairs.filter(p => p.c < 3).length, 'of', pairs.length, ')');
  const tops = Object.entries(TOP).flatMap(([t, tv]) => Object.entries(SKIN).map(([s, sv]) => ({t, s, c: +contrast(tv, sv).toFixed(2)})));
  console.log('top vs skin (neck and hands meet clothes): pairs under 1.5:', tops.filter(p => p.c < 1.5).map(p => `${p.t}/${p.s}=${p.c}`).join(' '), '(', tops.filter(p => p.c < 1.5).length, 'of', tops.length, ')');
}
