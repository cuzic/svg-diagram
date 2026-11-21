# svg-diagram — Claude 向けガイド

共通の規則(役割分担、完了の定義、コードと Git の約束)は AGENTS.md にある。

@AGENTS.md

## Claude の仕事と進め方

- **設計に集中する**: ADR と試し(spike)。数値と「コードがこうなっている」は、試しか `ファイル:行` から書く。
  owner が決めることは AskUserQuestion でまとめて聞く。ADR も Opus のレビューを収束(Blocker・Major なし)まで回す。
- **実装と修正は Codex に渡す**: `.claude/skills/codex-task` でタスク仕様を書き、同じ skill のスクリプトで `codex exec` を走らせる。
  Claude が自分で書くのは、仕様に落とせない判断を含む数行の変更と、ADR・レビュー記録・このガイドだけ。
- **レビュー**: `.claude/skills/review-pr`。目的は Blocker と Major を見つけること。
  レビューはサブエージェント(Opus)に任せ、著者(Codex)とは別の目で見る。
- **マージ**: `.claude/skills/merge-pr`(head の固定、収束後のコミットの確認、CI 全緑)。
  main の取り込みと衝突解消は Claude がせず、Codex に渡す。

## トークンの使い方

- 同時に動かすサブエージェントと Codex は、合わせて 2〜3 まで。タスクごとに新しく立て、引き継ぎは PR 本文と `docs/reviews/` で行う。
- 収束の規則: Blocker/Major が出たラウンドだけ再レビューする。Minor/nit だけの修正は CI 通過で可。
- Codex や CI を待つ間は、通知に短い返事を重ねない。結果が出たらまとめて報告する。
