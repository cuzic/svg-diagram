---
name: implement-task
description: svg-diagram の [codex] タスク仕様(Issue、または PR の「## [codex] タスク仕様」コメント)を実装して PR を出す手順。タスク仕様を渡されたとき、レビュー指摘(docs/reviews/prNN-roundK.md)を直すとき、PR に main を取り込むときに使う。
---

# タスク仕様を実装する

AGENTS.md の規則(完了の定義・コードの約束・Git の約束)が前提。ここはその順番だけを書く。

## 1. 読む

- 仕様: Issue なら `gh issue view NN`、PR コメントなら `gh pr view NN --comments`(いちばん新しい `## [codex] タスク仕様`)。
- 仕様が指す ADR の節と、その ADR の `*-opus-review-round*.md`。修正のときは `docs/reviews/prNN-roundK.md` の指摘。
- 触るコードと、その周りのテスト(`test/` で関数名を grep する)。

仕様と ADR とコードが食い違うとき、仕様に無い判断が要るときは、**決めずに止める**(手順 5 の blocked)。

## 2. ブランチ

- いまの checkout が仕様のブランチになっている(`git branch --show-current` で確かめる)。違えば止める。別の clone や worktree は作らない。
- 既存 PR のブランチなら、始める前に `git pull --no-rebase origin <branch>`。
- main の取り込み: `git merge origin/main`。手で衝突を解いたら、マージコミットのメッセージに「どのファイルを、どう解いたか」を書く。
  生成物(`schema/`)の衝突は `pnpm schema` で作り直す。

## 3. 実装する

1. `pnpm install --frozen-lockfile`(`node_modules` が無ければ)。
2. **再現テストを先に書き、落ちることを確かめる**(落ちなければ、テストか理解が違う)。
3. 実装する。仕様の「やらないこと」と「触ってよいファイル」を守る。周りの書き方に合わせる。
4. 完了の定義を回す(`pnpm typecheck` / `pnpm lint` / `pnpm test` / `node check-diagram.ts --strict examples/*.ts`)。
   `pnpm test` は全体で数分かかる。途中は `node --test test/<file>.test.ts` で絞る。
5. 変異を当てる: 新しいコードの要の 1〜3 か所を手で壊し、テストが落ちることを確かめて、元に戻す(変異はコミットしない)。
6. 描画(レイアウト・emit・文字幅)や PPTX の出力に触ったなら、PR 本文に「golden の作り直しが要る(理由)」と書く。
   手元の `--drift --rebuild` はフォントが違って clean な main でも差が出るので、判定には使わない。作り直しは Claude がする。

## 4. コミットと PR

- 小さなコミットに分ける。メッセージは日本語、`feat(area): …(ADR NNNN U1)`。指摘を直すコミットには指摘 ID。
  末尾に `Co-Authored-By: Codex <noreply@openai.com>`。
- push: 新しいブランチは `git push -u origin <branch>`、既存は `git push origin <branch>`。force-push しない。
- PR: 新しければ `gh pr create --base <仕様のブランチの元。積み上げなら下のブランチ、ほかは main> --title … --body-file …`、既存なら本文を `gh pr edit` で更新。
  本文: 目的と ADR の節、変更の要点、テスト、変異(変えた所 → 落ちたテスト)、golden、指摘 → 修正の表(修正のとき)、Open questions。
- **マージしない。** レビューとマージは Claude が行う。

## 5. 最後の報告

最後の応答は、求められた JSON の形(status・summary・branch・head_sha・pr_url・checks・mutations・open_questions)で返す。

- `done`: push して PR があり、完了の定義を回した(落ちたものがあれば `checks` に正直に書く)。
- `blocked`: 仕様に無い判断で止めた。`open_questions` に、選択肢とそれぞれの影響を書く。途中までの作業は push しておく。
- `failed`: 環境などで進めなかった。`summary` に何が起きたかを書く。
