---
name: merge-pr
description: レビューが収束した svg-diagram の PR を安全にマージする(head の固定、収束した SHA 以降の全コミットと衝突解消の確認、CI 全緑の確認)。「マージして」「収束したので入れて」と頼まれたとき、review-pr が converged: yes を返したときに使う。
argument-hint: "<PR 番号>"
---

# 収束した PR のマージ

Claude(または owner)が行う。main の取り込みや衝突解消は自分でせず、Codex に戻す(`codex-task`)。

## 前提(1 つでも欠けたら止める)

- 最新ラウンドのレビュー(PR ブランチにコミット済みの `docs/reviews/prNN-roundK.md`)が converged: yes で、`Target: <branch> @ <sha>` がある。
  ADR だけの PR は `docs/adr/NNNN-opus-review-roundK.md`。
- PR の base が main(`gh pr view NN --json baseRefName --jq .baseRefName`)。積み上げ PR は、下の PR がマージされて付け替わってから扱う。
- レビュアーが「マージ前に直して」と書いた項目があれば、直っている。

## 手順

シェルの変数は Bash の呼び出しをまたいで残らない。各ブロックは 1 回で実行し、`PR` `R` `SHA` には**値を書く**。

1. **head を固定し、収束後のコミットをすべて見る**(`R` はレビューファイルの対象 SHA):

   ```sh
   PR=NN; R=<reviewed sha>
   SHA=$(gh pr view "$PR" --json headRefOid --jq .headRefOid) || exit 1; echo "SHA=$SHA"
   git fetch -q origin || exit 1
   git merge-base --is-ancestor "$R" "$SHA" || { echo "レビューした SHA が head の祖先でない"; exit 1; }
   git log --no-merges --stat --format="%h %s" "$R..$SHA" --not origin/main
   for m in $(git log --merges --format=%H "$R..$SHA" --not origin/main); do git show --remerge-diff --stat "$m"; done
   ```

   - 許されるのは、レビューファイルのコミット、指摘 ID を挙げた Minor/nit の修正、golden の作り直し、衝突のない main の取り込みだけ。
   - それ以外(新しい機能、説明のないコミット、手で解いた衝突、指摘より明らかに大きい修正)があれば、マージせずに `$R..$SHA` だけを短く再レビューする。
2. **CI 全緑を確かめる**(`gh pr merge` は CI が赤でも通るので、必ずここを通す)。バックグラウンドで待ってよい:

   ```sh
   PR=NN; SHA=<手順 1 の SHA>; : "${PR:?}" "${SHA:?}"
   gh pr checks "$PR" --watch --interval 30 >/dev/null 2>&1
   n=$(gh pr checks "$PR" --json bucket --jq 'length') || exit 1
   bad=$(gh pr checks "$PR" --json bucket --jq '[.[] | select(.bucket != "pass")] | length') || exit 1
   [ "$n" -ge 4 ] && [ "$bad" -eq 0 ] || { echo "CI が全緑でない(pass 以外 $bad / 全 $n)"; exit 1; }
   [ "$(gh pr view "$PR" --json mergeable --jq .mergeable)" = MERGEABLE ] || { echo "MERGEABLE でない"; exit 1; }
   ```

   `n -ge 4` は今の CI のジョブ数(test 3 分割と golden)。ジョブを増減したらここも直す。
   checks が 0 件(push の直後)・取れない・pending・`UNKNOWN` は、どれも止まる側に倒れる。少し置いてやり直す。
   CONFLICTING なら Codex に main の取り込みを頼み、手順 1 からやり直す。
   **main が動いていないかも見る**: CI はブランチを最後に push した時点の main と合わせて回っている。衝突が無くても、その後に main が
   同じ所を変えていれば、マージ後の main で golden や schema が落ちうる。

   ```sh
   PR=NN; SHA=<手順 1 の SHA>
   git fetch -q origin   # CI を待つ間に main が進んでいるかもしれない
   mb=$(git merge-base origin/main "$SHA"); git diff --stat "$mb" origin/main -- . ':!docs' ':!*.md' | tail -3
   ```

   何か出たら、Codex に main の取り込みを頼み(`codex-task`)、CI が回り直してから手順 1 からやり直す。
   CI が PR と関係ない理由(flaky など)で落ちたら、マージせずに、その原因を直す PR を別に作る。
3. **固定した head でマージする**:

   ```sh
   PR=NN; SHA=<手順 1 の SHA>; : "${PR:?}" "${SHA:?}"
   gh pr merge "$PR" --merge --match-head-commit "$SHA"
   ```

   head が動いていれば拒否されるので、手順 1 からやり直す。
4. ブランチを消す前に、それを base にしている PR を main に向ける(`gh pr list --base <branch>` → `gh pr edit N --base main`)。
5. ADR の段階を実装した PR なら、ADR の状態の行(どの段階まで実装済みか)が更新されているかを見る。無ければ follow-up の仕様に入れる。

## 報告

マージした PR、付け替えた PR、残った follow-up を 1 行ずつ。
