// Invented sample: theme "leave early once a week". Dummy data for the spike only.
import type {Worksheet} from './proto.ts';
export const sample: Worksheet = {panels: [
  {id: 'p1', chars: [{id: 'me', side: 'left', face: 'neutral', hue: 210}, {id: 'col', side: 'right', face: 'smile', hue: 20}],
    lines: [{speaker: 'me', kind: 'say', tpl: '今週から、毎週{day}は定時で上がります。', slots: {day: {max: 3, prompt: '曜日'}}}]},
  {id: 'p2', chars: [{id: 'me', side: 'left', face: 'smile', hue: 210}, {id: 'col', side: 'right', face: 'surprise', hue: 20}],
    lines: [{speaker: 'col', kind: 'say', tpl: 'えっ、{what}は大丈夫なの？', slots: {what: {max: 6, prompt: '心配'}}}, {speaker: 'me', kind: 'say', tpl: '先に{prep}しておきます。', slots: {prep: {max: 6, prompt: '準備'}}}]},
  {id: 'p3', chars: [{id: 'me', side: 'left', face: 'think', hue: 210}, {id: 'col', side: 'right', face: 'worry', hue: 20}],
    lines: [{speaker: 'col', kind: 'say', tpl: '最近、{change}ね。', slots: {change: {max: 8, prompt: '変化'}}}, {speaker: 'me', kind: 'think', tpl: '見られているのかも…'}]},
  {id: 'p4', chars: [{id: 'me', side: 'left', face: 'laugh', hue: 210}, {id: 'col', side: 'right', face: 'laugh', hue: 20}],
    lines: [{speaker: 'col', kind: 'say', tpl: '{wish}、いいと思う！', slots: {wish: {max: 8, prompt: 'ひとこと'}}}]},
]};
