import assert from 'node:assert/strict';
import test from 'node:test';
import {chevron, concentric, cycle, funnel, venn} from '../lib/dsl.ts';
import {layoutFlowShape} from '../lib/flow-shapes.ts';
import {renderFlowShape} from '../lib/emit.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutFlowShape} from '../lib/flow-shapes.ts';

async function figure(band: ReturnType<typeof chevron> | ReturnType<typeof funnel> | ReturnType<typeof cycle> | ReturnType<typeof venn> | ReturnType<typeof concentric>): Promise<LaidOutFlowShape> {
  return layoutFlowShape(band,24,24,892,(atom,size)=>Array.from(atom).length*size*.58,ROLES);
}
test('all flow shapes lay out labels inside their bounds and expose item anchors', async()=>{
  const bands=[chevron([{id:'a',label:'長い工程名を折り返す',sub:'補足説明'},{id:'b',label:'次'}]),funnel([{id:'a',label:'入口',value:100},{id:'b',label:'成約',value:20}],{scale:'value',showRate:true}),cycle([{id:'a',label:'計画'},{id:'b',label:'実行'},{id:'c',label:'確認'}]),venn([{name:'A',id:'a'},{name:'B',id:'b'}],{overlaps:[{sets:['A','B'],label:'共通'}]}),concentric([{label:'外',id:'a'},{label:'内',id:'b'}])];
  for(const b of bands){const f=await figure(b as never); assert.ok(f.anchors.length>=2); for(const t of f.labelBoxes){assert.ok(t.x>=f.x-.5&&t.y>=f.y-.5&&t.x+t.w<=f.x+f.w+.5&&t.y+t.h<=f.y+f.h+.5,`${f.type}: ${t.label}`);} if(f.type!=='venn'&&f.type!=='concentric')for(let i=0;i<f.anchors.length;i++)for(let j=i+1;j<f.anchors.length;j++){const a=f.anchors[i],c=f.anchors[j];assert.ok(Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x)<=.5||Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y)<=.5,`${f.type}: anchors overlap`);}}
});
test('validation errors are helpful',()=>{assert.throws(()=>cycle([{label:'a'},{label:'b'}]),/3\.\.8/);assert.throws(()=>venn([{name:'A'}]),/2 or 3/);assert.throws(()=>funnel([{label:'A',value:2},{label:'B'}],{scale:'value'}),/requires a value/);assert.throws(()=>chevron([{label:'A'}],{current:2}),/zero-based/);});
test('emission contains geometry and escaped labels',async()=>{const bands=[chevron([{label:'矢羽根'}]),funnel([{label:'漏斗'}]),cycle([{label:'循環1'},{label:'循環2'},{label:'循環3'}]),venn([{name:'集合&A'},{name:'集合B'}]),concentric([{label:'同心円'}])];for(const b of bands){const svg=renderFlowShape(await figure(b as never),'blue');assert.match(svg,/<(polygon|circle|path)/);assert.ok(!svg.includes('集合&A'));}});
