// The files of the .pptx package, as data: the fixed template with the one slide and its pictures added. Reading the template, drawing
// the PNGs and zipping are the shell's (emit.ts).
import type {Picture} from './image-band.ts';

export interface Entry {name: string; data: Buffer}
/** The one slide: its XML, its size (EMU) and the pictures it places (picture i is media/image{i+1}.png / .svg). */
export interface SlidePlan {xml: string; cx: number; cy: number; pictures: Picture[]}

const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
/** Relationship ids of picture i in the slide's rels (the template uses the ids below 12). */
export const imageRids = (i: number): {png: string; svg: string} => ({png: `rId${12 + i * 2}`, svg: `rId${13 + i * 2}`});

const slideRels = (count: number): string => Array.from({length: count}, (_, i) => {
  const {png, svg} = imageRids(i);
  return `<Relationship Id="${png}" Type="${IMAGE_REL}" Target="../media/image${i + 1}.png"/><Relationship Id="${svg}" Type="${IMAGE_REL}" Target="../media/image${i + 1}.svg"/>`;
}).join('');

/** The template with the slide size and rels filled in, plus the slide and its media; `[Content_Types].xml` first, the rest sorted by name. The template already declares png and svg. */
export function packageEntries(template: readonly Entry[], plan: SlidePlan, pngs: readonly Buffer[]): Entry[] {
  const entries = template.map(({name, data}) => {
    if (name === 'ppt/presentation.xml') return {name, data: Buffer.from(data.toString().replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${plan.cx}" cy="${plan.cy}"/>`))};
    if (name === 'ppt/slides/_rels/slide1.xml.rels') return {name, data: Buffer.from(data.toString().replace('</Relationships>', slideRels(plan.pictures.length) + '</Relationships>'))};
    return {name, data};
  });
  entries.push({name: 'ppt/slides/slide1.xml', data: Buffer.from(plan.xml)});
  plan.pictures.forEach((p, i) => {
    entries.push({name: `ppt/media/image${i + 1}.png`, data: pngs[i]!}, {name: `ppt/media/image${i + 1}.svg`, data: Buffer.from(p.svg)});
  });
  return entries.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
