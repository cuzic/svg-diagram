import {diagram, gantt} from 'svg-diagram';

// 予実のガントチャート(ADR 0068 D4b): `actual: true` で、どのタスクも上の段に予定、下の段に実績を描く。
// 実績の終わりを書かないタスクは進行中で、`today` まで伸びる。マイルストーンの実績は start だけを書く。
export default function define() {
  return diagram({theme: 'blue', title: '在庫管理アプリ 開発計画(予実)', sourceLine: '出典: プロジェクト計画(例)'}).add(
    gantt([
      {section: '設計'},
      {id: 'req', label: '要件定義', start: '2026-10-05', end: '2026-10-16', actual: {start: '2026-10-05', end: '2026-10-20'}},
      {id: 'ui', label: '画面設計', start: '2026-10-19', end: '2026-10-30', after: 'req', actual: {start: '2026-10-21'}},
      {section: '開発'},
      {id: 'app', label: 'アプリ実装', start: '2026-11-02', end: '2026-11-27', after: 'ui'},
      {id: 'api', label: 'API 実装', start: '2026-11-02', end: '2026-11-20', after: 'ui'},
      {id: 'test', label: '結合テスト', start: '2026-11-30', end: '2026-12-11', after: ['api', 'app'], tone: 'danger'},
      {section: 'リリース'},
      {id: 'kick', label: 'キックオフ', start: '2026-10-02', milestone: true, actual: {start: '2026-10-02'}},
      {label: '本番リリース', start: '2026-12-14', milestone: true, after: 'test'},
    ], {today: '2026-10-28', actual: true}),
  );
}
