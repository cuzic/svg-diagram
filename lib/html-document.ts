import {PALETTE, FONT_STACKS, recolor} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {LaidOutDiagram} from './types/index.ts';
import {sha1Hex} from './sha1.ts';

export const px = (n: number): string => `${+n.toFixed(2)}px`;

export function stripSvg(svg: string, cls: string): string {
  return svg
    .replace(/<rect x="0" y="0" width="\d+(?:\.\d+)?" height="\d+(?:\.\d+)?" fill="#[0-9a-f]{6}"\/>\s*/i, '')
    .replace(/<svg /, `<svg class="${cls}" `)
    .replace(/<style>[\s\S]*?<\/style>\s*/, '')
    .replace(/<metadata[\s\S]*?<\/metadata>\s*/, '').trim();
}

const CSS = (id: string, transparent = false) => `
#${id} { position: relative; overflow: hidden; background: ${transparent ? 'transparent' : PALETTE.bg}; font-family: ${FONT_STACKS.sans}; }
#${id} .sd-b { position: absolute; box-sizing: border-box; border-radius: 9.25px; }
#${id} .sd-t { position: absolute; white-space: pre; }
#${id} .sd-m { font-family: ${FONT_STACKS.mono}; }
#${id} .sd-tbl { position: absolute; overflow: hidden; border-radius: 8px; }
#${id} .sd-tbl table { border-collapse: collapse; table-layout: fixed; }
#${id} .sd-tbl th, #${id} .sd-tbl td { position: relative; padding: 0; margin: 0; font-weight: 400; text-align: left; vertical-align: top; }
#${id} .sd-tb { position: absolute; border-radius: 8px 8px 0 0; }
#${id} .sd-s { position: absolute; box-sizing: border-box; }
#${id} .sd-g { position: absolute; left: 0; top: 0; width: 0; height: 0; overflow: visible; }
#${id} .sd-ov { position: absolute; left: 0; top: 0; pointer-events: none; }
#${id} .sd-am { transform: translateX(-50%); }
#${id} .sd-ae { transform: translateX(-100%); }
#${id} .sd-e { font-family: ${FONT_STACKS.emoji}; }
#${id} .sd-ov text { font-family: ${FONT_STACKS.sans}; }
#${id} .sd-ov .mono { font-family: ${FONT_STACKS.mono}; }
#${id} .sd-ov .emoji { font-family: ${FONT_STACKS.emoji}; }`;

export function htmlDocument(d: LaidOutDiagram, tones: ToneEnv, body: string, id?: string): string {
  const {width, canvasHeight} = d;
  const cssId = id ?? `sd-${sha1Hex(JSON.stringify([width, canvasHeight, d.transparent ?? false, d.appearance ?? null, body])).slice(0, 8)}`;
  return recolor(tones, `<style>${CSS(cssId, d.transparent)}
</style>
<div id="${cssId}" class="sd" style="width:${px(width)};height:${px(canvasHeight)}">${body}</div>
`, d.appearance);
}
