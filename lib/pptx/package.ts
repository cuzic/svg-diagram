import fs from 'node:fs';
import {zipStore} from './zip.ts';

const TEMPLATE = new URL('./template/', import.meta.url);

function templateFiles(dir = TEMPLATE, prefix = ''): {name: string; data: Buffer}[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? templateFiles(new URL(e.name + '/', dir), prefix + e.name + '/') : [{name: prefix + e.name, data: fs.readFileSync(new URL(e.name, dir))}]);
}

export interface Extra {files: Record<string, Buffer>; slideRels: string; defaults: {ext: string; type: string}[]}

/** One slide on the fixed package template; only the slide, its relationships, size and content types change. */
export function packPptx(slideXml: string, widthEmu: number, heightEmu: number, extra?: Extra): Buffer {
  const entries = templateFiles().map(({name, data}) => {
    let d = data;
    if (name === 'ppt/presentation.xml') d = Buffer.from(data.toString().replace(/<p:sldSz[^>]*\/>/, `<p:sldSz cx="${widthEmu}" cy="${heightEmu}"/>`));
    else if (name === 'ppt/slides/_rels/slide1.xml.rels' && extra) d = Buffer.from(data.toString().replace('</Relationships>', extra.slideRels + '</Relationships>'));
    else if (name === '[Content_Types].xml' && extra) d = Buffer.from(data.toString().replace(/<Types[^>]*>/, m => m + extra.defaults.filter(x => !data.toString().includes(`Extension="${x.ext}"`)).map(x => `<Default Extension="${x.ext}" ContentType="${x.type}"/>`).join('')));
    return {name, data: d};
  });
  entries.push({name: 'ppt/slides/slide1.xml', data: Buffer.from(slideXml)});
  for (const [name, data] of Object.entries(extra?.files ?? {})) entries.push({name, data});
  // [Content_Types].xml first (the convention), then sorted by name
  entries.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return zipStore(entries);
}
