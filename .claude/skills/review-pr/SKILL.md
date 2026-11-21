---
name: review-pr
description: svg-diagram の PR(Codex の実装)または ADR を敵対的にレビューし、docs/reviews/prNN-roundK.md(ADR は docs/adr/NNNN-opus-review-roundK.md)を PR ブランチにコミットする。PR のレビュー、レビューのラウンド、収束の判定を頼まれたとき、codex-task の報告が done になったときに使う。
argument-hint: "<PR 番号> <ラウンド K>"
---

# PR / ADR の敵対的レビュー

目的は **Blocker と Major を見つけること**。体裁や好みの指摘を増やすことではない。
Claude 本体はレビューしない。**Opus のサブエージェント(Agent ツール、`model: opus`)に、下の「レビュアーへの指示」を渡す。**
著者(Codex)と別の目で見るため、本体の結論や推測は渡さない(PR 番号・ラウンド・前ラウンドのファイルだけ)。

## レビュアーへの指示(そのまま渡す)

1. **独立したコピーで作業する**: スクラッチ領域に `git clone --reference <共有の checkout の .git> https://github.com/cuzic/svg-diagram <dir>`、
   `gh pr checkout NN`。レビューする head の SHA(`git rev-parse HEAD`)を控える。共有の checkout や他の worktree を触らない。
2. **前ラウンドの解消を確かめる**: 指摘ごとに、説明文ではなく挙動で判定する。
3. **壊しにいく**: ADR の決定ごとに、決定を破る入力を作る。svg-diagram での重点:
   - 黙って違う図を描く(部品が消える・重なる・はみ出す、のに `check` が通る)
   - 規則・検査が誤りを見逃す、または正しい図を誤りにする
   - CLI の出力(`--format json|github|sarif|text`)の形が ADR と違う、既存の利用者(VS Code 拡張、MCP)を壊す
   - 例外が利用者に生のスタックで出る、メッセージが直し方を言わない
   - ブラウザの入口・純粋な core に `node:*` や副作用が入る
   - golden が理由なく変わる
4. **機械的な検証は結果を読む**: CI の結果を使う。足りないときだけ手で変異を数個当て、テストが落ちるかを見る。
   長く回して待たない。試しや変異はコミットしない。
5. **他の open PR との干渉**: 同じファイル・公開名に触る PR を `gh pr list` で確かめる。

### 重大度

| 等級 | 基準 |
| --- | --- |
| Blocker | 正しい入力で壊れた図・誤った出力を黙って出す、データを失う、安全の穴 |
| Major | 特定の入力で誤った図・誤った位置/メッセージ、ADR の決定に反する、公開の出力の互換を壊す、要の経路にテストが無い(変異が落ちない) |
| Minor | 安全側の過剰な拒否、文書の不一致、テストの穴(振る舞いは正しい) |
| nit | 表現・コメント |

### 出力

`docs/reviews/prNN-roundK.md`(ADR は `docs/adr/NNNN-opus-review-roundK.md`)を英語で書く:

```markdown
# PR #NN review (Opus, round K)

Target: <branch> @ <reviewed head SHA>

## Conclusion
<2-4 sentences. converged: yes/no and why>

## Previous round
<one line per finding: resolved / not resolved, how checked>

## Findings
### M1 (Major): <one sentence>
- Evidence: <repro, file:line, read or ran>
- Fix: <one sentence>

## Verdict
converged: yes/no (Blocker n / Major n / Minor n / nit n)
```

**converged: yes** は Blocker と Major が 0 のとき。

### 届け方

レビューファイルだけを PR ブランチにコミットして push する(メッセージ `docs: PR #NN review round K`)。
push が拒否されたら `git pull --no-rebase origin <branch>` してから push し直す。force-push しない。
最後の応答: 結論、判定、指摘を 1 行ずつ、push したコミットの SHA。

## レビューのあと(Claude 本体)

- converged: no → 指摘 ID を挙げた修正の仕様を PR コメントに書き、`codex-task` で Codex に渡す。直ったら次のラウンド。
- converged: yes で Minor/nit が残る → 直すなら同じく Codex に渡す(再レビューは要らず、CI 通過で可)。そのあと `merge-pr`。
