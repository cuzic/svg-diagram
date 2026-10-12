import {box, connect, diagram} from 'svg-diagram';

// diagram({canvas: 'slide'}): a whole 16:9 slide (1280x720) drawn 1:1; the fonts are scaled so nothing is under 24px.
export default function define() {
  return diagram({theme: 'blue', canvas: 'slide', gap: 36, title: 'リクエストの流れ'}).add(
    box({id: 'user', title: '利用者', body: 'ブラウザから送る'}),
    box({id: 'api', title: 'API', body: '検証して処理する'}),
    box({id: 'db', title: 'DB', body: '結果を保存する'}),
    connect('user', 'api', {label: '要求'}),
    connect('api', 'db', {label: '保存'}),
  );
}
