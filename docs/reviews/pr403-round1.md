# Review round 1: agent guides (cuzic/svg-diagram#403, cuzic/svg-diagram-vscode#2)

Targets: `chore/agent-guides` @ 5682aa7 (core, worktree /home/cuzic/svg-diagram-agents) and @ 25019fd (vscode, worktree /home/cuzic/svg-diagram-vscode-agents).
`run-codex.sh` and `report.schema.json` are byte-identical in the two PRs. The skills differ only in the repo-specific lines (diffed). So a finding on a shared file applies to both PRs.
"Ran" means I executed it on this host (codex-cli 0.167.0, gh logged in, origin = SSH). "Read" means I only read the code.
All probes ran in scratch clones under `review-agents/sbx/` or in the existing smoke clone `scratchpad/codex/cx-smoke3`. Nothing in the two PR worktrees was changed.

## Conclusion

**Not converged.** One Blocker affects both PRs: in the clone that `run-codex.sh` makes, Codex cannot write to `.git`. So `git commit` / `fetch` / `pull` / `merge` fail, and the core of the workflow (Codex commits, pushes and opens the PR) cannot work as written. The three smoke tests did not catch this because none of them wrote to git. The fix is one `--add-dir` (verified below).
Two Majors are in the shared script: a stale report can be read as the new result, and the sandbox gets write access to the directory that holds the `codex` binary itself. One more Major is core-only: merge-pr dropped ooxml-rs's "is main newer than the CI run" step, and core's goldens and schema make that step matter.
Most factual claims in AGENTS.md check out (details at the end).

---

## Blocker

### B1 (both): `.git` in the clone is read-only inside Codex's sandbox, so Codex cannot commit, fetch, pull or merge
- Location: `.claude/skills/codex-task/scripts/run-codex.sh:2` (the premise "in its own clone ... Codex's sandbox keeps .git read-only in a shared worktree") and `:44-50` (no writable root for `$d/.git`). The skill depends on it at `codex-task/SKILL.md:58` ("push と gh pr create まで自分で行う").
- Evidence (ran):
  - `codex sandbox -c sandbox_mode="workspace-write" -c sandbox_workspace_write.network_access=true` in a fresh `git clone --reference` (cwd = clone): writing a work-tree file succeeds, but `git commit` fails with `Unable to create '<clone>/.git/index.lock': Read-only file system`. Codex makes `.git` under a writable root read-only whether it is a worktree's file or a clone's directory.
  - The same thing happened in practice: in the ooxml-rs runs from session 21ae987c, `codex-i78.log:100` shows `error: cannot open '.git/FETCH_HEAD': Read-only file system` in `cx-i78`. Codex worked around it by improvising a worktree or clone in `/tmp/ooxml-*` (`codex-i83.log:9317`, `codex-i88.log:9067`, `--command-cwd /tmp/ooxml-i78`). Here that improvisation would contradict implement-task step 2 ("いまの checkout が仕様のブランチ … 違えば止める"), so the likely results are `blocked`, or work that lands outside `$d`.
  - The smoke tests (`scratchpad/codex/smoke*.md`) all said "コミットも push もしない", so they never exercised this.
  - Fix verified (ran): adding `<clone>/.git` as a writable root (`-c sandbox_workspace_write.writable_roots=["<clone>/.git"]`, the same as `--add-dir`) makes `git checkout -b`, `git commit`, `git fetch origin main` and `git push --dry-run origin HEAD:refs/heads/probe-never` (SSH through the gpg-agent socket) all succeed inside the sandbox. `gh pr list` / `gh pr view 2 --json headRefOid` / `gh auth status` also work in the sandbox with network on, even though `$HOME` is read-only (`touch ~/.probe` → EROFS). Nothing was pushed.
- Fix: add `--add-dir "$d/.git"` to the `codex exec` call. Correct the header comment (a fresh clone does not lift the protection; the explicit writable root does). Then run one smoke test that commits and pushes to a throwaway branch and opens and closes a draft PR, before the first real task.

## Major

### M1 (both): a previous run's report can be read as the current one
- Location: `run-codex.sh:23-25,49,53`.
- Evidence (read): the script deletes the clone (`rm -rf "$d"`) but never deletes `$work/codex-$label.report.json`. `-o` writes the file only when Codex emits a final message. If Codex dies early (auth, network, quota, crash, or the B1 failure mode), line 53 `cat`s the old report and prints, say, `status: done` with an old `pr_url`/`head_sha`. Re-running a label is the normal flow (fix rounds, and the "もう一度走らせる" in `codex-task/SKILL.md:69`). Claude is told to read that file (`SKILL.md:64`). The `exit=$rc` line is the only signal, and the skill never says to check it.
- Fix: `rm -f "$work/codex-$label.report.json" "$work/codex-$label.log"` before `codex exec`. In SKILL.md §3, add "rc ≠ 0 or the report is missing → treat it as failed". Optionally write a run id into the spec and have the report echo it back.

### M2 (both): the sandbox gets write access to all of `~/.local/share/pnpm`, which includes the `codex` binary
- Location: `run-codex.sh:33-34,47`.
- Evidence (ran): `pnpm store path` → `~/.local/share/pnpm/store/v11`, so `pnpm_home` = `~/.local/share/pnpm`. That directory holds `bin/{codex,pnpm,pnpx,vercel,vc,…}` and `global/`.
  Inside the sandbox, `pnpm install` runs dependency lifecycle scripts. With this grant, any such script (or a confused Codex) can overwrite `~/.local/share/pnpm/bin/codex` or pnpm itself. Those then run **unsandboxed** on the next `run-codex.sh` or in any shell, which defeats the sandbox.
- Fix: grant only what pnpm writes: `--add-dir "$pnpm_home/store" --add-dir "$pnpm_home/package-manager-store"`. Re-run the install smoke test on both repos (core pins pnpm 11.2.2 and vscode pins 12.18.0; both resolve to the same `store/v11`). I ran install, lint, typecheck and test in the vscode clone with the current wide grant and they passed, so only the narrowed grant needs re-checking.

### M3 (core): merge-pr dropped ooxml-rs's "main has moved since CI ran" step, and core has generated outputs that make it matter
- Location: `svg-diagram .claude/skills/merge-pr/SKILL.md:34-46` (step 2). Compare ooxml-rs `merge-pr/SKILL.md` step 2 ("main との関係を確認する … 前回の取り込み以降に main で同じ crate や生成物が変わっているなら、Codex に main の取り込みを依頼").
- Evidence (read): GitHub runs `pull_request` CI on the merge ref as of the last push, and a re-run reuses that ref. The gate checks only "green + MERGEABLE". So PR B can merge with a green CI computed against a main that predates PR A. Core has three outputs that depend on the combination: `examples/out` goldens (CI job `golden (examples/out)`), `schema/*.schema.json` (`test/schema-files.test.ts`) and the rule and verify interplay. A layout change in A plus a change in B that does not touch the same SVG file merges cleanly with no conflict and then turns main's golden job red. Every later PR then fails CI until someone fixes main. Concurrent rendering PRs are the normal case here (ADR 0070 U-steps, ADR 0072 U-steps).
- Fix: restore the step. Before the CI gate, `git diff --name-only "$(git merge-base origin/main "$SHA")" origin/main -- lib examples schema '*.ts'`. If it is non-empty, have Codex merge main (codex-task), push, and restart from step 1. (For vscode the same risk is lower; see m12.)

## Minor

### m1 (both): AGENTS.md's "one worktree per task" conflicts with how Codex is actually run
- Location: core `AGENTS.md:60-61`, vscode `AGENTS.md:52`. Compare `implement-task/SKILL.md:20` and `run-codex.sh` (the clone *is* the task checkout).
- Evidence (read + ooxml logs): with the ooxml-rs specs, Codex followed a worktree instruction and created `/tmp/ooxml-*` worktrees (`codex-i78.log:95`, `codex-i88.log:9067`). Here AGENTS.md is the instruction that applies, and `codex-task/SKILL.md:29` ("新規: `<prefix>/<name>` を origin/main から") does not say "already checked out".
- Fix: add one line to AGENTS.md: "Codex run by `run-codex.sh` starts in a clone already on the task branch; it does not create worktrees." Make the template say "ブランチは用意済み".

### m2 (core): contradiction over whether Codex stops when the golden changes
- Location: `AGENTS.md:35-36` ("PR 本文に「golden の再生成が要る」と書いて**止める**"), compared with `implement-task/SKILL.md:33-34` ("PR 本文に書く") and `codex-task/SKILL.md:73-77` (Claude regenerates after CI's golden job fails).
- Evidence (read): Docker is never available in the sandbox, so every rendering task hits this. Under AGENTS.md, Codex may return `blocked` (stop) instead of `done`, and the intended path (push, then Claude regenerates) is not what it is told.
- Fix: in AGENTS.md: "Docker が無ければ作り直さず PR 本文に書き、作業は続けて done で返す(作り直しは Claude)".

### m3 (core): the local drift check in implement-task gives a false positive on clean main
- Location: `implement-task/SKILL.md:33`.
- Evidence (ran, smoke clone on main): `node check-diagram.ts --drift --rebuild --svg-dir examples/out examples/*.ts` exits 1, and `examples/icons.ts` fails with `再生成した SVG が … 一致しない` (host fonts, emoji). AGENTS.md:36 already says local fonts are not authoritative.
- Fix: "結果を origin/main で同じコマンドを回した結果と比べ、増えた所だけを報告する". Alternatively, drop the step and rely on CI's golden job.

### m4 (both): the report schema's `done` description contradicts implement-task
- Location: `report.schema.json:8` ("done: PR pushed and the definition of done passed"), compared with `implement-task/SKILL.md:49` (done even when a check failed, recorded in `checks`).
- Fix: change the schema text to "PR pushed; checks lists each result (a fail is allowed and must be explained)". Alternatively, require `failed` when a check fails.

### m5 (both): run-codex.sh edge cases
- `:25` `rm -rf "$d"` discards unpushed commits from an earlier run with the same label (a `failed` run, for example), and it clobbers a concurrent run with the same label. Fix: refuse when `$d` has commits that are not on its upstream, or use a fresh name per run.
- `:27` `git ls-remote --heads origin "$br"` matches by tail, so `fix/x` also matches `refs/heads/foo/fix/x`. The checkout then fails under `set -e`. Fix: use `refs/heads/$br`.
- `:27-31` a branch that exists only in the local shared repo (not pushed) is silently recreated from `origin/$base`. Fix: say so in the usage text, or fail when `git -C "$here" rev-parse --verify -q "refs/heads/$br"` succeeds and the branch is not on origin.
- `:40` `$locks` is unquoted (word-splitting). It is safe today (`/run/user/1002`, no spaces; tested under dash), but it breaks if `XDG_RUNTIME_DIR` ever contains spaces. Unset `XDG_RUNTIME_DIR` is handled: pnpm then uses tmp, which is writable.
- `codex-task/SKILL.md:55` does not document the 4th `[base]` argument, and nothing describes stacked PRs (ooxml-rs had "stacked on #NN" in titles and a retarget step).

### m6 (both): main is unprotected, so "Codex does not merge / force-push" is enforced only by prose
- Evidence (ran): `gh api repos/cuzic/{svg-diagram,svg-diagram-vscode}/branches/main/protection` → 404 "Branch not protected", and rulesets are `[]`. Inside the sandbox Codex has working SSH push and the owner's `gho_` token (verified `gh` works).
- Fix: add a ruleset on `main` that blocks force-push and deletion, with no bypass. Optionally require a PR; Claude's `gh pr merge` still satisfies that.

### m7 (both): ooxml-rs safeguards that were dropped
- merge-pr lost the "レビュアーが『マージ前に直して』と書いた項目" prerequisite, step 6 (a CI failure unrelated to the PR or a flaky test → don't merge, fix separately), and the note that 0 checks, pending or UNKNOWN all fail closed. The code still fails closed, but the reason is gone.
- review-pr lost "作業中の worktree を `cp -a` しない" and "他のエージェントのプロセスを `pkill` で止めない". Both came from incidents.
- Fix: put these lines back. They are short.

### m8 (core): ADR status words do not match the repo
- Location: `AGENTS.md:6` ("状態が「決定」か「実装済み」"), `AGENTS.md:13` ("決定済みの ADR"), `codex-task/SKILL.md:25` ("状態: 決定").
- Evidence (ran): first status lines across `docs/adr`: 実装済み 53, 提案 5, 決定 3, plus 承認, 採用, 実装中, 一部実装済み, "U0・U1 実装済み", 起草, 起票. ADR 0070, which is being implemented now (U5), is `状態: 承認`. A literal-minded Codex may refuse ADR 0070 work.
- Fix: "状態が 決定・承認・採用・実装中・一部実装済み・実装済み のいずれか(提案・起草は不可)".

### m9 (core): wrong ADR citations
- `AGENTS.md:49` attributes the one-line "what is wrong + how to fix" error style to ADR 0013. ADR 0013 is `0013-stale-output-after-failed-build.md`, about stale output after a failed build (it does mention "理由と直し方" for its own message, but it is not the general rule).
- `AGENTS.md:31` attributes the repro-test-first rule to ADR 0031. In ADR 0031 it is §0 of the FCIS ADR's own plan, not a project rule.
- Fix: drop the citations or point them at the right source. Read.

### m10 (core): Claude's own writes are listed inconsistently
- `CLAUDE.md:12` says Claude writes only "数行の変更と、ADR・レビュー記録・このガイド". But `codex-task/SKILL.md:75-77` has Claude regenerate and commit goldens, and `merge-pr/SKILL.md:32` allows golden commits after convergence.
- Fix: add "golden の作り直し" to CLAUDE.md:12. Read.

### m11 (core): the PPTX golden is not mentioned
- `examples/out/pptx-golden.json` is checked only by the manual `pptx-golden.yml` workflow (`workflow_dispatch`; README:1565, ADR 0027). Neither the definition of done nor CI catches a PPTX output change, so a Codex PR that changes `lib/pptx*.ts` goes stale silently.
- Fix: one line in AGENTS.md: "PPTX の出力を変えたら PR 本文に書く。Claude が `gh workflow run pptx-golden.yml --ref <branch> -f update=true` を回す". Read.

### m12 (vscode): integration tests cannot run in the sandbox, and the prerequisite is not stated
- Location: vscode `AGENTS.md:29-30`, `implement-task/SKILL.md:30`.
- Evidence (ran): `test:integration` needs `npm install --no-package-lock` in `test/fixtures/workspace` first (README:84,95; ci.yml). In the sandbox that fails with `EROFS … mkdtemp '/home/cuzic/.npm/_cacache/tmp/…'` because `$HOME` is read-only. `xvfb-run` is also not installed on this host (`which xvfb-run` returns nothing). The current text tells Codex to try `xvfb-run -a pnpm test:integration` "if xvfb exists", which would fail confusingly on a machine that has xvfb.
- Fix: state the fixture install step, and say "sandbox では npm のキャッシュに書けないので not-run とする" (or pass `--cache <clone>/.npm-cache`). The main-staleness risk from M3 also applies here at lower severity (no generated outputs). Add the same diff check, scoped to `src/ package.json`.

## Nit

- n1 (both): `docs/reviews/` appears in the repo maps (core `AGENTS.md:82`, vscode `AGENTS.md:16`) and as the review destination, but it is not tracked in either repo (`git ls-files docs/reviews` is empty; the directories exist only as untracked empty dirs). This is fine because the first review creates it, but "(初回のレビューで作る)" would avoid confusion.
- n2 (vscode): `merge-pr/SKILL.md:55` refers to README's 「core の版」の説明, but there is no such heading. The relevant text is under 「対応する環境」 / 「JSON の補完と検査」 (README:7,35-45).
- n3 (both): `codex-task` description triggers on 「直して」, which is very broad. It will fire for one-line fixes Claude is allowed to make (guides, reviews). Consider 「Codex に直させて」 or "実装・修正のタスクを".
- n4 (both): `run-codex.sh:12` says the CLI's default reasoning effort is "none". I could not verify this and it is irrelevant to correctness. Drop it or cite it.
- (not counted) skill frontmatter is valid. Claude Code: `name`, `description`, `argument-hint` are all strings, and the names match the directories. Codex: `name` + `description` only, each description is about 150 characters (well under limits), and the name matches the directory. No issue.

---

## Facts checked (no finding)

- Core definition of done (ran/read): `pnpm typecheck` = `tsc -p .`, `pnpm lint` = `biome lint .`, `pnpm test` = `node --test "test/*.test.ts"` (matches the AGENTS.md:26 comment), `check-diagram.ts` exists, `--strict` is valid, and CI runs the same on shard 1. `engines.node >=22.18`. biome `style.useImportType: error`. `pnpm schema` = `node scripts/schema.ts`. Present: `test/schema-files.test.ts`, `test/core-purity.test.ts`, `test/pure-entries.test.ts`, `test/pure-exports.test.ts`, `test/web-entry.test.ts`, `lib/web.ts`, `lib/rules.ts`, `lib/verify*.ts`, `lib/dsl/render.ts`, `lib/spec-parts/`, `lib/site.ts`, `bin/svg-diagram`, root `*-diagram.ts`, `skills/svg-diagram/`, and `scripts/golden-docker.sh` (accepts `--write`). The CI job name is `golden (examples/out)`. `pnpm golden` is a compare, not a write. `--drift` writes nothing (check-diagram.ts:2).
- Core CI count (ran): `gh pr checks` on #398–#402 = 4 each (`test (1/3)`, `(2/3)`, `(3/3)`, `golden (examples/out)`). #403 also has 4. `n -ge 4` is correct. `pptx-golden.yml` is `workflow_dispatch` only; if it ever appears on a PR head it fails closed.
- vscode (ran/read): scripts `typecheck`, `lint`, `test` (= `node --test "test/unit/*.test.ts"`), `build` (`scripts/build.ts`, so `pnpm build --production` passes the flag), `test:integration`, `test:e2e`. `engines.vscode ^1.100.0`, node `>=22.18`. CI = `test` + e2e {ubuntu, macos} × {1.100.0, stable} = 5. `gh pr checks` on #1 = 5 and #2 = 5, so `n -ge 5` is correct. `vscode` is imported only by `extension.ts`, `tasks.ts`, `preview.ts`, `diagnostics.ts`, `schema-provider.ts`, `status.ts`, which matches "extension.ts とその周りの薄い層"; `check.ts`, `cli.ts`, `schemas.ts`, `runs.ts`, `setup.ts` are vscode-free. `exec.ts` uses `execFile` (no shell). The Windows stop matches `extension.ts:18,73,159`. `.vscode-test` is gitignored. `test/unit/manifest.test.ts` and `CHANGELOG.md` exist. useImportType is on.
- Sandbox (ran): pnpm install, lint, typecheck and unit tests pass in the vscode clone with the script's grants. Core's Chromium tests (`cdp-browser`, `svg-lint-browser`, 10/10) pass inside the sandbox, so `pnpm test` in the sandbox is not silently skipping browser tests. gh API works in the sandbox. SSH push auth works in the sandbox once `.git` is writable (B1).
- Output schema (read): `additionalProperties: false` and every property in `required` at all three object levels, and enums are strings. This is compatible with strict structured outputs, and the three smoke reports validated against it.
- Shell (ran): `${pnpm_home:+--add-dir "$pnpm_home"}` keeps a path with spaces as one field under dash. `set -eu` is safe: the `mkdir && …` in the loop does not trip `-e`, `set +e` comes before `codex`, and `$1`..`$3` missing aborts with "parameter not set". `--reference` with a worktree's `--git-common-dir` works (the clones succeeded).
- Language and attribution: commit messages on both mains are Japanese `type(area): …`, which matches AGENTS.md. CLAUDE.md imports `@AGENTS.md` in both repos.

Counts: core #403 — Blocker 1 / Major 3 / Minor 11 / Nit 3; vscode #2 — Blocker 1 / Major 2 / Minor 6 / Nit 4; combined (unique) — Blocker 1 / Major 3 / Minor 12 / Nit 4
