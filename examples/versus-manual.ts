import {box, caption, connect, diagram, group, row, spacer} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'よくある見立てと実際の原因'}).add(
    caption('よくある見立てと実際の原因', {bold: true, tone: 'text'}),
    row([
      group([box({id: 'surface', title: '利用者が慣れていない'})], {id: 'usual', title: 'よくある見立て', tone: 'muted'}),
      group([box({id: 'cause', title: '判断材料が画面にない'})], {id: 'actual', title: '実際の原因', tone: 'accent'}),
    ], {cols: [6, 6]}),
    spacer(48),
    group([box({id: 'facts', title: '操作ログと聞き取り'})], {id: 'evidence', title: '共通して観察するもの', tone: 'plain'}),
    connect('usual:bottom', 'evidence:top@0.25', {label: '照合'}),
    connect('actual:bottom', 'evidence:top@0.75', {label: '裏づけ'}),
  );
}
