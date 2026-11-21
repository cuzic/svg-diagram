---
name: codex-task
description: svg-diagram の実装・レビュー指摘の修正・main の取り込みを Codex に渡す。タスク仕様(Issue か PR コメント)を書き、scripts/run-codex.sh で codex exec を走らせ、報告を読む。「実装して」「Codex に直させて」「Codex に任せて」と言われたとき、実装してよい状態の ADR の段階(U1 など)に着手するとき、レビュー指摘の修正を渡すときに使う。
argument-hint: "[ADR の段階 | PR 番号]"
---

# Codex に実装を渡す

Codex は AGENTS.md と `.agents/skills/implement-task` を読むが、この会話の文脈は知らない。
**仕様だけで作業が閉じるように書く。** 判断が要る点は先に決めて書くか、「決めずに Open questions に書いて止める」と書く。

## 1. 仕様を書く

- 新しい作業: `gh issue create --title "[codex] <要約>" --body-file <file>`。
- 既存 PR への修正・main の取り込み: その PR へのコメント(見出し `## [codex] タスク仕様`)。
  根拠のレビューファイルは PR ブランチにコミット済みのもの(`docs/reviews/prNN-roundK.md`)を指す。

```markdown
## [codex] タスク仕様

### 目的
<1〜2 文。何ができるようになるか>

### 根拠
- ADR: docs/adr/NNNN-....md の D3・D4、実装の順の U1(状態: 決定)
- レビュー: docs/reviews/prNN-roundK.md の M1, m2(修正のとき)

### ブランチ
- 新規: `<prefix>/<name>`(run-codex.sh が origin/main から作って切り替えてある。積み上げなら下のブランチから)。PR のタイトル: `<…>(ADR NNNN U1)`、積み上げなら `stacked on #NN` を足す
- 既存 PR: `<branch>` に追加コミット。merge で追従し、force-push しない

### スコープ
- やること: <箇条書き。指摘 ID ごとに 1 行。関数名・ファイル・出力の形まで具体的に>
- やらないこと: <範囲外。次の段階に回すもの>
- 触ってよいファイル: <ファイルかディレクトリ>

### 受け入れ条件
- AGENTS.md の完了の定義
- 足すテスト: <再現テスト。直す前に落ちるもの。入力と期待値まで書く>
- 当てる変異: <落ちるべき変異の例>
- golden: <変わらない / 変わる(理由)>

### 報告
PR 本文に、ADR のどの決定を実装したか、テスト、変異、Open questions。マージはしない。
```

仕様は 1 PR = レビュー 1 回で見られる量(数百行まで)にする。大きければ段階を分ける。

## 2. 走らせる

仕様をファイルにし(Issue / コメントなら 1 行の指示でよい: `Issue #NN の [codex] タスク仕様をやって。.agents/skills/implement-task の手順で`)、
**バックグラウンドで**走らせる(Bash の `run_in_background: true`。数十分かかる):

```sh
CODEX_WORK=<scratchpad>/codex sh .claude/skills/codex-task/scripts/run-codex.sh <label> <branch> <spec-file> [base]
```

- `base` は新しいブランチの元(既定 main)。積み上げの PR は下のブランチを渡す。ローカルにしかないブランチは断る(先に push する)。
- 同じ label の前の clone に、origin に無いコミットがあれば断る(消さない)。
- 終了コードが 0 でも報告が無ければ失敗として扱う(スクリプトが 1 を返す)。

- Codex はスクラッチの clone(`cx-<label>`)で動き、push と `gh pr create` まで自分で行う。
- 同時に走らせるのは 2 つまで。同じブランチに 2 つ走らせない。
- 走っている間は待つ。途中経過は `codex-<label>.log` にあるが、ポーリングしない(終われば通知が来る)。

## 3. 報告を読む

`codex-<label>.report.json`(`scripts/report.schema.json` の形)を読む。

- `status: done`: `pr_url` の PR があり、head が `head_sha` であることを `gh pr view` で確かめる。
  `checks` に `fail` / `not-run` があれば理由を見る。`mutations` に `NOT CAUGHT` があれば、テストを足す修正の仕様を出す。
  そのあと `review-pr` に回す。
- `status: blocked`: `open_questions` を読む。設計で決められるなら決めて ADR か仕様に書き足し、もう一度走らせる。
  owner が決めることなら AskUserQuestion でまとめて聞く。
- `status: failed` / 報告がない: `codex-<label>.log` の最後を読む。環境の問題(ネットワーク・Docker)なら Claude が片付けるか、仕様を直す。

## golden と PPTX の golden

Codex の sandbox では Docker が使えない。描画が変わる PR で CI の `golden (examples/out)` が落ちたら、
Claude がその PR の worktree で作り直してコミットする(機械的な作業なので Claude がしてよい):
`sg docker -c 'scripts/golden-docker.sh --write'`。差分が仕様どおりの変化だけかを `git diff --stat` と数枚の SVG で確かめる。
PPTX の出力が変わる PR では `gh workflow run pptx-golden.yml --ref <branch> -f update=true` を回す。この workflow は結果を artifact に上げるだけなので、
`gh run download <run-id> -n pptx-golden` で取り、`examples/out/pptx-golden.json` を差し替えて PR ブランチにコミットする(差分が仕様どおりかを見てから)。
