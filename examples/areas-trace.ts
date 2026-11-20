import {areas, box, caption, connect, diagram} from 'svg-diagram';

// areas() で行をまたいで列をそろえる(nov27 s33 の書き直し): 見出し・変わる系列・変わらない系列の 3 行が同じ列に乗る。
// 2 行目の先頭の空きは . 1 つで書き、span / col の足し算をしない。
export default function define() {
  const head = (text: string) => caption(text, {bold: true, tone: 'text'});
  return diagram({theme: 'blue', title: '番号でたどって直す範囲を絞る', showTitle: false, legend: false, accept: {'graph-disconnected': '変わらない系列は別のかたまりとして見せる'}}).add(
    areas(`
      hm  hr  hs  ht
      m   r2  s3  t3
      .   r1  s1  t1
    `, {
      hm: head('決定メモ'), hr: head('要件'), hs: head('シナリオ'), ht: head('テスト'),
      m: box({title: 'M2 有効期限', body: '3か月 → 6か月に変更', tone: 'solid'}),
      r2: box({title: 'R2 有効期限を確かめる', tone: 'accent'}),
      s3: box({title: 'S3 境界: ちょうど6か月', tone: 'accent'}),
      t3: box({title: 'T3 先に直す', tone: 'accent'}),
      r1: box({title: 'R1 添付書類と照合', tone: 'muted'}),
      s1: box({title: 'S1・S2', tone: 'muted'}),
      t1: box({title: 'T1・T2 そのまま', body: '全部流して、壊れていないか確かめる', tone: 'muted'}),
    }, {gap: 56, rowGap: 24}),
    connect('m:right', 'r2:left'),
    connect('r2:right', 's3:left'),
    connect('s3:right', 't3:left'),
    connect('r1:right', 's1:left', {tone: 'muted'}),
    connect('s1:right', 't1:left', {tone: 'muted'}),
  );
}
