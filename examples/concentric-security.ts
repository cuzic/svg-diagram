// 多層防御を同心円で描く。外側の層から順に書き（既定の order: 'outer-first'）、ラベルは各層の上部に入る。
// ビルド: svg-diagram build examples/concentric-security.ts --out examples/out/concentric-security.svg
import {concentric, diagram} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: '多層防御'}).add(concentric([
    {id: 'edge', label: '境界', description: '入口を守る'},
    {label: 'アプリ', description: '権限を絞る'},
    {id: 'data', label: 'データ', description: '暗号化'},
  ], {centre: '重要情報'}));
}
