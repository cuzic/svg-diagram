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

/** The figure with its @media block taken out: the light side of an `auto` figure (the root still says data-appearance="auto"). */
export function stripAutoBlock(svg: string): string {
  const start = svg.indexOf(OPEN);
  if (start === -1) return svg;
  let depth = 0, i = start;
  for (; i < svg.length; i++) {
    if (svg[i] === '{') depth++;
    else if (svg[i] === '}' && --depth === 0) break;
  }
  const from = svg.lastIndexOf('\n', start);
  return svg.slice(0, from) + svg.slice(i + 1);
}
