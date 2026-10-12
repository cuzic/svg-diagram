import {cloud, diagram} from 'svg-diagram';

// クラウド(対立解消図): 共通の目的 A、それを満たす2つの必要条件 B・C、対立する要望 D・D'。
// 矢印の上の番号が、下の一覧にある前提。注入(injection)は前提を崩す変更。
export default function define() {
  return diagram({theme: 'blue', title: '品質とスピードのクラウド', sourceLine: '出典: 説明用の例'}).add(
    cloud(
      {a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
      {
        assumptions: [
          {on: 'bd', text: '品質確保には長い検証期間が必須だ', injection: '自動テストで検証を短くする'},
          {on: 'cd', text: '早いリリースとは全機能の一括公開だ', injection: '主要機能から段階的に公開する'},
          {on: 'dd', text: '検証を終えてからでないと公開できない'},
        ],
      },
    ),
  );
}
