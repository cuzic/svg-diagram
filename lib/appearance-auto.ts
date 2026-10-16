// `appearance: 'auto'` (ADR 0023 F2): the figure is drawn with the LIGHT tokens, and its <style> gets one @media block that
// recolours the colours the figure actually uses when the viewer prefers a dark scheme. No CSS variables: an attribute selector
// beats the presentation attribute, and a renderer that cannot read the block shows the light figure.
import {mapOf} from './tokens.ts';

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'] as const;
const OPEN = '@media (prefers-color-scheme: dark) {';
const ROOT = 'svg[data-appearance="auto"]';

/** The @media block (indented for a <style> whose rules are at 4 spaces), or '' when the figure uses no token colour. */
export function autoBlock(svgText: string): string {
  const dark = mapOf('dark') as Record<string, string>;
  const used = new Map<string, Set<string>>(COLOR_ATTRS.map(a => [a, new Set<string>()]));
  for (const tag of svgText.match(/<[^!?\/][^>]*>/g) ?? []) {
    for (const m of tag.matchAll(/\s(fill|stroke|stop-color|flood-color|color)="(#[0-9a-fA-F]{6})"/g)) {
      const hex = m[2].toLowerCase();
      if (dark[hex] !== undefined) used.get(m[1])!.add(hex);
    }
  }
  const rules: string[] = [];
  for (const attr of COLOR_ATTRS) for (const hex of [...used.get(attr)!].sort()) rules.push(`      ${ROOT} [${attr}="${hex}" i] { ${attr}: ${dark[hex]} }`);
  return rules.length ? `\n    ${OPEN}\n${rules.join('\n')}\n    }` : '';
}

/** Where the @media block of an `auto` figure is: [from the line break before it, past its closing brace], or null. */
function blockRange(svg: string): [number, number] | null {
  const start = svg.indexOf(OPEN);
  if (start === -1) return null;
  let depth = 0, i = start;
  for (; i < svg.length; i++) {
    if (svg[i] === '{') depth++;
    else if (svg[i] === '}' && --depth === 0) break;
  }
  return [svg.lastIndexOf('\n', start), i + 1];
}

/** The figure with its @media block taken out: the light side of an `auto` figure (the root still says data-appearance="auto"). */
export function stripAutoBlock(svg: string): string {
  const r = blockRange(svg);
  return r ? svg.slice(0, r[0]) + svg.slice(r[1]) : svg;
}

/** What marks a finding as the dark side's. */
export const DARK_NOTE = '暗い配色';
export const isAuto = (svg: string): boolean => /^<svg\b[^>]*\sdata-appearance="auto"/.test(svg.trimStart());

/**
 * The two SVG strings an `auto` figure is checked as (ADR 0023 D4). light: the figure with its @media block taken out. dark: the same with
 * every (attribute, colour) the block names replaced by the colour the block gives it, i.e. what a browser in the dark scheme paints, so the
 * checks need no media query. (Read from the block, not from the token table: a tone override's dark colour is in the block and not in the table.)
 */
export function autoSides(svg: string): {light: string; dark: string} {
  const light = stripAutoBlock(svg);
  const r = blockRange(svg);
  const to = new Map<string, string>();
  for (const m of (r ? svg.slice(r[0], r[1]) : '').matchAll(/\[([a-z-]+)="(#[0-9a-f]{6})" i\] \{ [a-z-]+: (#[0-9a-f]{6}) \}/g)) to.set(`${m[1]}:${m[2]}`, m[3]);
  const page = mapOf('dark') as Record<string, string>;
  const dark = light.replace(/<[^!?/][^>]*>/g, tag => tag.replace(/\s(fill|stroke|stop-color|flood-color|color|data-assumed-bg)="(#[0-9a-fA-F]{6})"/g, (all, attr: string, hex: string) => {
    const h = hex.toLowerCase();
    const mapped = attr === 'data-assumed-bg' ? (to.get(`fill:${h}`) ?? page[h]) : to.get(`${attr}:${h}`);
    return mapped === undefined ? all : all.replace(hex, mapped);
  }));
  return {light, dark};
}

/** One figure drawn light and dark, as one list: what both sides say once; what only the dark side says, marked. */
export function mergeSides<T>(light: readonly T[], dark: readonly T[], key: (x: T) => string, mark: (x: T) => T): T[] {
  const seen = new Set(light.map(key));
  const out = [...light];
  for (const x of dark) if (!seen.has(key(x))) { seen.add(key(x)); out.push(mark(x)); }
  return out;
}
