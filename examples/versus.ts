import {box, caption, diagram, versus} from 'svg-diagram';

export default function define() {
  return diagram({theme: 'blue', title: 'よくある見立てと実際の原因'}).add(
    caption('よくある見立てと実際の原因', {bold: true, tone: 'text'}),
    versus(
      {id: 'usual', title: 'よくある見立て', tone: 'muted', children: box({id: 'surface', title: '利用者が慣れていない'})},
      {id: 'actual', title: '実際の原因', tone: 'accent', children: box({id: 'cause', title: '判断材料が画面にない'})},
      {
        shared: {id: 'evidence', title: '共通して観察するもの', tone: 'plain', children: box({id: 'facts', title: '操作ログと聞き取り'})},
        connectLabels: {left: '照合', right: '裏づけ'},
      },
    ),
  );
}
