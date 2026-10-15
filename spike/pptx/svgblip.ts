// Spike S4: an SVG band as a picture with svgBlip + a PNG fallback made by resvg.
import fs from 'node:fs';
import {register} from 'node:module';
import {Resvg} from '@resvg/resvg-js';
import {closeMeasurer} from '../../lib/measure.ts';
import {packPptx, loadLaidOut} from './run.ts';
import {EMU} from './geom.ts';
register(new URL('../../lib/resolve-hook.ts', import.meta.url));
const [src, out, scale = '2'] = process.argv.slice(2) as [string, string, string?];
const {laidOut, svg} = await loadLaidOut(src!);
const w = laidOut.width, h = laidOut.canvasHeight;
const png = Buffer.from(new Resvg(svg, {font: {loadSystemFonts: true}, fitTo: {mode: 'zoom', value: Number(scale)}}).render().asPng());
const pic = `<p:pic><p:nvPicPr><p:cNvPr id="2" name="diagram-svg" descr="svg band"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId10"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId11"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(w * EMU)}" cy="${Math.round(h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${pic}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
const buf = packPptx(slide, Math.round(w * EMU), Math.round(h * EMU), {
  files: {'ppt/media/image1.png': png, 'ppt/media/image1.svg': Buffer.from(svg)},
  slideRels: '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/><Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.svg"/>',
  defaults: [{ext: 'png', type: 'image/png'}, {ext: 'svg', type: 'image/svg+xml'}],
});
fs.writeFileSync(out!, buf);
console.log('own writer:', {svgBytes: svg.length, pngBytes: png.length, pptxBytes: buf.length});

closeMeasurer();
