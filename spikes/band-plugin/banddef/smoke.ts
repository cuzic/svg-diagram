// node spikes/band-plugin/banddef/smoke.ts — renders a comic and a box stack through the prototype pipeline and checks the comic against the real one.
import {renderMini} from './mini-core.ts';
import {comic} from './comic.ts';
import {box} from './box.ts';
import {renderInBrowser} from '../../../lib/web.ts';
import {diagram} from '../../../lib/dsl/diagram.ts';
import {comic as realComic} from '../../../lib/dsl/comic.ts';
import {sheet} from './sheet.ts';

const guess = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size * 0.9, h: Math.round(size * 1.2)});
const mini = await renderMini([comic(sheet), box({id: 'b1', title: '新しい画面', body: '確認のメモ'})], {measure: guess});
const real = await renderInBrowser(diagram({theme: 'blue', title: 't', legend: false}).add(realComic(sheet)), {measure: guess});
const frag = (s: string): string => s.slice(s.indexOf('<g'), s.lastIndexOf('</g>')); // the band's own markup
const comicOnly = (await renderMini([comic(sheet)], {measure: guess})).svg;
const pick = (s: string, n: number) => (s.match(/<g data-bubble/g) ?? []).length === n;
console.log(`mini render: ${mini.svg.length} chars, findings=${JSON.stringify(mini.findings.map(f => f.rule))}`);
console.log(`bubbles drawn: mini=${(comicOnly.match(/data-bubble/g) ?? []).length} real=${(real.svg.match(/data-bubble/g) ?? []).length}; panels mini=${(comicOnly.match(/<clipPath/g) ?? []).length} real=${(real.svg.match(/<clipPath/g) ?? []).length}`);
console.log(`unrequested text is an error: ${await renderMini([{def: {type: 'x', layout: (_d: unknown, e: any) => { e.widthOf('字', 18, 400, 'sans'); return {laid: {x: 0, y: 0, w: 1, h: 1}, h: 1}; }, emit: () => ''} as never, data: {}}], {measure: guess}).then(() => 'NO', e => (e as Error).message.slice(0, 60))}`);
void frag; void pick;
