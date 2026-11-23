import type {ComicWorksheet} from '../../../lib/types/comic.ts';
// neutral made-up worksheet
export const sheet: ComicWorksheet = {version: 1, title: '確認の流れ', layout: '2x2', cast: {me: {name: '私'}, col: {name: '同僚'}}, panels: [
  {id: 'p1', stage: [{who: 'me', at: 'left', expression: 'neutral'}], dialogue: [{id: 'd1', who: 'me', kind: 'say', tpl: 'ここが変更点です。'}]},
  {id: 'p2', stage: [{who: 'col', at: 'right', expression: 'smile'}], dialogue: [{id: 'd2', who: 'col', kind: 'say', tpl: '要確認ですね。'}]},
  {id: 'p3', stage: [{who: 'me', at: 'left', expression: 'think'}], dialogue: [{id: 'd3', who: 'me', kind: 'say', tpl: '内容を見直します。'}]},
  {id: 'p4', stage: [{who: 'col', at: 'center', expression: 'laugh'}], dialogue: [{id: 'd4', who: 'col', kind: 'say', tpl: 'お願いします。'}]},
], blank: 'prompt'} as ComicWorksheet;
