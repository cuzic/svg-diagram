// ドラマの三角形と TED*(説明用の架空の例)。頂点(役割)は固定し、人だけが入れ替わる。変わらない土台は外枠の見出しと表で見せる。
// 帯は作らず、既存の部品(group / row / box / connect / table)で描く(ADR 0033)。人は記号 Ⓐ Ⓑ Ⓒ で追い、役割は線とラベルでも区別する(白黒でも読める)。
// TED* の三角形の向きは作図上の配置で、出典の図ではない。
// ビルド: svg-diagram build examples/drama-triangle.ts --out examples/out/drama-triangle.svg
import {box, connect, diagram, group, row, spacer, table} from 'svg-diagram';

const D = {per: 'danger', res: 'new', vic: 'plain'} as const;
const dd = (id: string, n: string, title: string, per: string, res: string, vic: string, said: string) => group([
  row([box({title: '迫害者', body: per, tone: D.per}), box({title: '救済者', body: res, tone: D.res})], {justify: 'center', width: 112, gap: 12}),
  spacer(14),
  row([box({title: '犠牲者', body: vic, tone: D.vic})], {justify: 'center', width: 112}),
  spacer(4),
  box({body: said, tone: 'muted'}),
], {id, title: `${n} ${title}`, titleAlign: 'center', pad: 10});
const te = (id: string, n: string, title: string, ch: string, co: string, cr: string, said: string) => group([
  row([box({title: '挑戦者', body: ch, tone: 'plain', dashed: true}), box({title: 'コーチ', body: co, tone: 'accent'})], {justify: 'center', width: 112, gap: 12}),
  spacer(14),
  row([box({title: '創造者', body: cr, tone: 'new'})], {justify: 'center', width: 112}),
  spacer(4),
  box({body: said, tone: 'muted'}),
], {id, title: `${n} ${title}`, titleAlign: 'center', pad: 10});

export default function define() {
  return diagram({
    theme: 'blue', title: '同じ 3 人、同じ場面。構えが替わると、役割の回り方が変わる', legend: false,
    sourceLine: '出典: 説明用の例。Ⓐ が本人(クライアント)。TED* の三角形の向きは作図上の配置',
    accept: {'graph-disconnected': '以前と以後は、構えの移行(太い矢印)でつなぎ、場面どうしは ①→②→③ でつないでいる', 'gray-tone-collision': '役割は線(破線・赤の破線)とラベルの文字でも区別している。人は記号 Ⓐ Ⓑ Ⓒ で追う'},
  }).add(
    group([row([
      dd('a1', '①', '締切を詰められた', 'Ⓑ 上司', 'Ⓒ 同僚', 'Ⓐ 私', 'Ⓐ「どうせ私には無理」'),
      dd('a2', '②', '後輩を助ける', 'Ⓑ 上司', 'Ⓐ 私', 'Ⓒ 同僚', 'Ⓐ「私がやっておくよ」'),
      dd('a3', '③', '同僚に当たる', 'Ⓐ 私', 'Ⓑ 上司', 'Ⓒ 同僚', 'Ⓐ「なぜ自分で考えないの」'),
    ], {gap: 30})], {id: 'ddt', title: '以前: ドラマの三角形。構えは「自分には力がない」「悪いのは相手・状況」', titleAlign: 'center', tone: 'accent', pad: 12}),
    spacer(56),
    group([row([
      te('b1', '①', '締切を詰められた', 'Ⓑ 上司', 'Ⓒ 同僚', 'Ⓐ 私', 'Ⓐ「何を実現したい?」'),
      te('b2', '②', '後輩を助ける', 'Ⓑ 上司', 'Ⓐ 私', 'Ⓒ 同僚', 'Ⓐ「どう進められそう?」'),
      te('b3', '③', '同僚と期待を合わせる', 'Ⓐ 私', 'Ⓑ 上司', 'Ⓒ 同僚', 'Ⓐ「ここまでをお願いしたい」'),
    ], {gap: 30})], {id: 'ted', title: '以後: TED*。構えは「何を実現したいか、自分で選べる」', titleAlign: 'center', tone: 'new', pad: 12}),
    connect('ddt:bottom', 'ted:top', {label: '構えが替わる', chip: true, weight: 'strong'}),
    connect('a1:right', 'a2:left'), connect('a2:right', 'a3:left'),
    connect('b1:right', 'b2:left'), connect('b2:right', 'b3:left'),
    spacer(8),
    table([{label: '人', bold: true}, {label: '①'}, {label: '②'}, {label: '③'}], [
      ['Ⓐ 私(本人)', '犠牲者 → 創造者', '救済者 → コーチ', '迫害者 → 挑戦者'],
      ['Ⓑ 上司', '迫害者 → 挑戦者', '迫害者 → 挑戦者', '救済者 → コーチ'],
      ['Ⓒ 同僚', '救済者 → コーチ', '犠牲者 → 創造者', '犠牲者 → 創造者'],
    ]),
  );
}
