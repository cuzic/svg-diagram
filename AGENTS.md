# svg-diagram — エージェント共通ガイド(Codex・Claude 共通)

TypeScript の DSL(と JSON の spec)で図を書き、SVG・PPTX・HTML に描くライブラリと CLI
(`build` / `check` / `show` / `serve` / `deck` / `site` …)。読みやすさの規則(`lib/rules.ts`)と
重なりの検査(`lib/verify*.ts`)が、図を「通る/通らない」で判定する。設計は `docs/adr/` にある。
作業の前に、担当する ADR と、その `*-opus-review-round*.md` を読む。実装してよい ADR は、状態が 決定・承認・採用・実装中・一部実装済み・実装済み のもの(提案・起草・起票は、まだ実装しない)。

## 役割分担

| 担当 | 仕事 |
| --- | --- |
| Claude | ADR の設計と試し(spike)、owner への質問の整理、タスク仕様を書く、PR の敵対的レビュー、マージ |
| Codex | 実装してよい状態の ADR に沿った実装、レビュー指摘の修正、main の取り込みと衝突解消、テストの追加 |
| CI | typecheck・lint・テスト(3 分割)・`examples` の検査・golden の再生成の一致 |

- 仕事は「タスク仕様」(目的・根拠・スコープ・触ってよいファイル・受け入れ条件)で渡す。
  新しい作業は `[codex] …` の Issue、既存 PR への修正や main の取り込みはその PR の `## [codex] タスク仕様` コメント。
- レビュー指摘の根拠は、PR ブランチにコミットされた `docs/reviews/prNN-roundK.md`(ADR は `docs/adr/NNNN-opus-review-roundK.md`)。
- **仕様に無い判断が要るときは、実装で決めない。** PR 本文の「Open questions」に書いて、そこで止める。
- Codex は `run-codex.sh`(`.claude/skills/codex-task/scripts/`)が作った clone の中で、仕様のブランチに切り替わった状態で始まる。
  別の clone や worktree は作らない。

## 完了の定義(どの PR も)

```sh
pnpm typecheck
pnpm lint
pnpm test                                   # node --test "test/*.test.ts"(遅いときは --test-name-pattern で絞って回し、最後に全部)
node check-diagram.ts --strict examples/*.ts
```

- 4 つとも通ること。CI(`.github/workflows/test.yml`)も同じことをする。
- **先に再現テストを書く**。直す前の main で落ちることを確かめてから直す。
- 新しいコードには、それを壊す変異(手書きでよい)を最低 1 つ当て、テストが落ちることを確かめる。PR 本文に書く。
- 部品・spec・設定の形を変えたら `pnpm schema` で `schema/*.schema.json` を作り直す(忘れると `test/schema-files.test.ts` が落ちる)。
- 描画(レイアウト・emit・文字幅)を変えたら golden が変わる。CI の `golden (examples/out)` が比べる。
  作り直しは固定したフォントの Docker で行う: `scripts/golden-docker.sh --write`。Docker が無い環境(Codex の sandbox)では
  作り直さず、PR 本文に「golden の再生成が要る(理由)」と書き、**作業は続けて**完了とする(作り直しは Claude がする)。
  手元の `pnpm golden` や `--drift --rebuild` はフォントが違うので正にしない(clean な main でも `examples/icons.ts` が違って出る)。
- PPTX の出力(`lib/pptx*.ts`)を変えたら、PR 本文に書く。PPTX の golden(`examples/out/pptx-golden.json`)は手で起動する
  workflow(`pptx-golden.yml`)だけが見るので、Claude が `gh workflow run pptx-golden.yml --ref <branch> -f update=true` を回し、artifact の `pptx-golden.json` をコミットする。
- 公開の振る舞い(CLI の出力・オプション・公開 API・メッセージ)を変えたら README と、該当 ADR の状態の行を直す。

## コードの約束

- **Node が `.ts` を型の取り除き(type stripping)でそのまま動かす**(`engines` は `>=22.18`。ビルドなしで CLI もテストも動く)。
  そのため次は書かない: `enum`、`namespace`、コンストラクタの引数プロパティ(`constructor(readonly x)`)、`import x = require()`。
  import は拡張子つき(`./foo.ts`)。型だけの import は `import type`(lint が見る)。
- **`lib/` は純粋な core**(ADR 0031、FCIS)。`fs`・`child_process` などを使ってよいのは決まったモジュールだけで、
  `test/core-purity.test.ts`・`test/pure-entries.test.ts`・`test/pure-exports.test.ts` が見張る。
  ブラウザの入口(`lib/web.ts` から届く所)は `node:*` を使わない(`test/web-entry.test.ts`)。
- 帯の種類で分岐する `.type === '<リテラル>'`(`!==`・`switch (….type)` の `case` も)を `lib/bands/` の外に増やさない。帯ごとの処理は帯の定義の hook に置く。`test/band-type-literals.test.ts` が、許可したファイルごとの上限(ラチェット。減らすだけ)を見張る(ADR 0080 D2b)。
- CLI の入口はリポジトリの直下(`build-diagram.ts`、`check-diagram.ts` …)。`--help` の文と、ファイル先頭のコメントの使い方を合わせる。
- 利用者に見せる文(CLI のメッセージ・エラー・README・ADR)は日本語。コードのコメントは英語。
  エラーは「何が悪いか」と「どう直すか」を 1 行で言う。
- 既存の文体と書き方に合わせる。周りに無い抽象化・依存を足さない。

## 安全の約束

- 試しのファイルや一時ファイルはリポジトリの外に置く。コミットに残さない。
- コミット・コメント・PR に、マシン固有の情報(ユーザー名・絶対パス・トークン)を書かない。
- `.codex/` と `.pnpmfile.cjs` をコミットしない(Codex の実行スクリプトが、それらを持つブランチを断る)。
- `examples/out/` は golden。手で直さない。`schema/` は `pnpm schema` の生成物。手で直さない。

## Git の約束

- 1 つの作業に 1 つの `git worktree` とブランチ(`feat/… fix/… docs/… chore/… test/… refactor/… perf/…`)。
  **共有の checkout でブランチを切り替えない**(別のセッションが同じリポジトリで動いている)。
- **merge で追従し、rebase と force-push はしない。** 既存 PR で始める前と push が拒否されたときは
  `git pull --no-rebase origin <branch>`(ブランチ名を必ず書く)。最初の push は `git push -u origin <branch>`。
- コミットメッセージは日本語で `feat(area): …` / `fix(area): …` の形。ADR の段階があれば `(ADR 0072 U1)` のように書く。
  レビュー指摘を直すコミットには指摘 ID(`M1` `m2` など)を書く。
- コミット末尾に、使っているツールの `Co-Authored-By:` トレーラーを付ける。
- **Codex は PR を作って更新するが、マージしない。** マージは Claude が `.claude/skills/merge-pr` の手順で行う(owner でもよい)。
- PR 本文: 何を・なぜ(ADR と節)、テスト、当てた変異、指摘 → 修正の表(修正のとき)、Open questions。

## リポジトリの地図

| 場所 | 中身 |
| --- | --- |
| `lib/dsl.ts`, `lib/dsl-pure.ts`, `lib/dsl/` | 公開の DSL(部品を作る関数、`diagram()`)。`lib/dsl/render.ts` が `renderDiagram` / `checkDiagram` |
| `lib/layout*.ts`, `lib/emit*.ts` | レイアウトと SVG の出力 |
| `lib/rules.ts`, `lib/*-rules.ts`, `lib/verify*.ts` | 読みやすさの規則(警告)と、重なり・はみ出しの検査(誤り) |
| `lib/spec*.ts`, `lib/spec-parts/` | JSON の spec(MCP・デッキの図)。`schema/` はここから作る |
| `lib/pptx*.ts`, `lib/deck*.ts`, `lib/site.ts` | PPTX・デッキ・静的サイト |
| `*-diagram.ts`(直下) | CLI の入口。`bin/` が振り分ける |
| `test/` | `node --test`。`test/helpers/` に共通の道具 |
| `examples/`, `examples/out/` | 例と、その golden |
| `docs/adr/`, `docs/reviews/` | 設計とそのレビュー記録(`docs/reviews/` は最初のレビューで作られる) |
| `skills/svg-diagram/` | **利用者向け**の skill(図を書く AI 向けの説明)。開発用ではない |
