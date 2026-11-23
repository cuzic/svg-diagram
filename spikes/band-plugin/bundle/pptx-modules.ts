// node spikes/band-plugin/bundle/pptx-modules.ts: bytes per module of the PPTX exporter alone (what is PPTX-own and what is shared core).
import {build} from 'esbuild'; import fs from 'node:fs';
const R=new URL('../../../', import.meta.url).pathname;
const e=R+'spikes/band-plugin/out/.e.ts'; fs.writeFileSync(e,`export * from '${R}lib/pptx/emit.ts';`);
const r=await build({entryPoints:[e],bundle:true,write:false,minify:true,format:'esm',platform:'node',metafile:true,logLevel:'silent',outdir:R+'spikes/band-plugin/out',external:['node:*','@resvg/resvg-js']});
fs.rmSync(e); const o=Object.values(r.metafile.outputs)[0]!;
const rows=Object.entries(o.inputs).map(([f,v])=>[f.replace(/^.*lib\//,'lib/'),v.bytesInOutput] as const).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
let pp=0,oth=0; for(const [f,b] of rows) (f.startsWith('lib/pptx/')?pp+=b:oth+=b);
console.log('pptx own', (pp/1024).toFixed(1), 'other shared', (oth/1024).toFixed(1)); console.log(rows.slice(0,14).map(([f,b])=>f+':'+(b/1024).toFixed(1)).join('\n'));
