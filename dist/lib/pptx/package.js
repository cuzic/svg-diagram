// The files of the .pptx package, as data: the fixed template with the one slide and its pictures added. Reading the template, drawing
// the PNGs and zipping are the shell's (emit.ts).
import { must } from '../must.js';
const IMAGE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
/** Relationship ids of picture i in the slide's rels (the template uses the ids below 12). */
export const imageRids = (i) => ({ png: `rId${12 + i * 2}`, svg: `rId${13 + i * 2}` });
const slideRels = (count) => Array.from({ length: count }, (_, i) => {
    const { png, svg } = imageRids(i);
    return `<Relationship Id="${png}" Type="${IMAGE_REL}" Target="../media/image${i + 1}.png"/><Relationship Id="${svg}" Type="${IMAGE_REL}" Target="../media/image${i + 1}.svg"/>`;
}).join('');
/** The template with the slide size and rels filled in, plus the slide and its media; `[Content_Types].xml` first, the rest sorted by name. The template already declares png and svg. */
export function packageEntries(template, plan, pngs) {
    if (pngs.length !== plan.pictures.length)
        throw new Error(`${plan.pictures.length} pictures but ${pngs.length} PNGs`);
    const entries = template.map(({ name, data }) => {
        if (name === 'ppt/presentation.xml')
            return { name, data: Buffer.from(data.toString().replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${plan.cx}" cy="${plan.cy}"/>`)) };
        if (name === 'ppt/slides/_rels/slide1.xml.rels')
            return { name, data: Buffer.from(data.toString().replace('</Relationships>', slideRels(plan.pictures.length) + '</Relationships>')) };
        return { name, data };
    });
    entries.push({ name: 'ppt/slides/slide1.xml', data: Buffer.from(plan.xml) });
    plan.pictures.forEach((p, i) => {
        entries.push({ name: `ppt/media/image${i + 1}.png`, data: must(pngs[i]) }, { name: `ppt/media/image${i + 1}.svg`, data: Buffer.from(p.svg) });
    });
    return entries.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
