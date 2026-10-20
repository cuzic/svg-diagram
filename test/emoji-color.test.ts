// lib/emoji-color.ts: the emoji of a figure are drawn in color by resvg (pictures from the emoji font laid over the text).
import test from 'node:test';
import assert from 'node:assert/strict';
import {withColorEmoji} from '../lib/emoji-color.ts';
import {rasterizeWithResvg} from '../lib/raster.ts';
import {emojiFontFace} from '../lib/font-metrics.ts';

const ef = emojiFontFace();
const color = !!ef && (ef.face.hasColorPng() || ef.face.hasColorLayers());
const skip = color ? false : 'needs a color emoji font (Noto Color Emoji, Segoe UI Emoji)';
const STYLE = `<style>.emoji{font-family:'Noto Color Emoji','Segoe UI Emoji',sans-serif}</style>`;
const svgOf = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80">${STYLE}<rect width="200" height="80" fill="#ffffff"/>${body}</svg>`;
const key = svgOf('<text x="10" y="50" font-size="40" fill="#000000">a<tspan class="emoji">🔑</tspan>b</text>');

/** pixels that are neither grey nor white: color */
const colored = (r: {rgba: Buffer}) => { let n = 0; for (let i = 0; i < r.rgba.length; i += 4) if (Math.max(r.rgba[i]!, r.rgba[i + 1]!, r.rgba[i + 2]!) - Math.min(r.rgba[i]!, r.rgba[i + 1]!, r.rgba[i + 2]!) > 40) n++; return n; };

test('a figure without emoji comes back as it is', () => {
  const plain = svgOf('<text x="10" y="50" font-size="40">abc</text>');
  assert.equal(withColorEmoji(plain), plain);
});

test('an emoji span is hidden and followed by its picture', {skip}, () => {
  const out = withColorEmoji(key);
  assert.match(out, /<tspan class="emoji" fill-opacity="0"[^>]*>🔑<\/tspan>/);
  assert.match(out, /<\/text>(<image\b[^>]*href="data:image\/png;base64,|<g transform="translate)/);
  assert.equal(out.replace(/<image[^>]*\/>|<g transform="translate[\s\S]*?<\/g>/g, '').replace(/ fill-opacity="0" stroke="none"/, ''), key);
});

test('the picture of an emoji is in the text\'s own transform, and a centred text keeps its centre', {skip}, () => {
  const out = withColorEmoji(svgOf('<text x="100" y="50" font-size="30" text-anchor="middle" transform="translate(0 5)">ab<tspan class="emoji">🔑</tspan>ab</text>'));
  assert.match(out, /<\/text><g transform="translate\(0 5\)">/);
});

test('resvg draws the emoji in color (and, without the pictures, in none)', {skip}, async () => {
  const r = await rasterizeWithResvg(key);
  assert.ok(colored(r) > 200, `color pixels: ${colored(r)}`);
});

test('the glyphs of a sequence (a skin tone) are each drawn, and a space or Latin run is not touched', {skip}, () => {
  const out = withColorEmoji(svgOf('<text x="10" y="50" font-size="30" fill="#000">x <tspan class="emoji">🔑🌐</tspan> y</text>'));
  assert.equal(out.split('<image').length - 1 + out.split('<g transform="translate(').length - 1, 2);
});

test('markup whose <text> elements this cannot pair with the parse (a commented-out one) is left alone', {skip}, () => {
  const odd = svgOf('<text x="1" y="2"><tspan class="emoji">🔑</tspan></text><!-- <text>x</text> -->');
  assert.equal(withColorEmoji(odd), odd);
});
