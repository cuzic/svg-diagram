import {diagram, gantt} from 'svg-diagram';

// ガントチャート: 日付だけを書く。軸・目盛り・今日の線・依存の矢印・進捗は自動。`today` は必ず書く(ビルドは時計を読まない)。
export default function define() {
  return diagram({theme: 'blue', title: '在庫管理アプリ 開発計画', sourceLine: '出典: プロジェクト計画(例)'}).add(
    gantt([
      {section: '設計'},
      {id: 'req', label: '要件定義', start: '2026-10-05', end: '2026-10-16', progress: 1},
      {id: 'ui', label: '画面設計', start: '2026-10-12', end: '2026-10-30', progress: 0.5, after: 'req'},
      {section: '開発'},
      {id: 'api', label: 'API 実装', start: '2026-10-26', end: '2026-11-20', after: 'req'},
      {id: 'app', label: 'アプリ実装', start: '2026-11-02', end: '2026-11-27', after: ['ui']},
      {label: '結合テスト', start: '2026-11-23', end: '2026-12-04', after: ['api', 'app'], tone: 'danger'},
      {section: 'リリース'},
      {label: '本番リリース', start: '2026-12-11', milestone: true, after: 'req'},
    ], {today: '2026-10-19'}),
  );
}
