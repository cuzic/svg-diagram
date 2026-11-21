# Review round 2: agent guides (cuzic/svg-diagram#403, cuzic/svg-diagram-vscode#2)

Targets: `chore/agent-guides` @ 44ddec1 (core, fixes in 4ea3bf2; worktree /home/cuzic/svg-diagram-agents) and @ c24d7a1 (vscode; worktree /home/cuzic/svg-diagram-vscode-agents).
`run-codex.sh` and `report.schema.json` are still byte-identical in the two PRs (diffed), so a finding on them applies to both PRs.
"Ran" means I executed it on this host (codex-cli 0.167.0). "Read" means I only read the text.
Probes ran in the scratch dir `review-agents-r2/`. There are two kinds:
- `t/`: a local bare "origin" plus a "shared" clone that holds a copy of the runner, driven by a fake `codex` that records its argv and env and writes the `-o` report or leaves it out, then exits with a chosen code.
- `sbx/`: `codex sandbox` with the runner's writable roots. No model run.

No Codex model run was made. Nothing in the two PR worktrees was changed, and nothing was pushed.

## Conclusion

**Not converged, but close.** B1, M1 and M3 are resolved, checked by behaviour where possible. All Minor and Nit items are resolved except m6 (outside the PRs) and parts of m5/m11.
One Major remains in both PRs, and it is what is left of round-1 M2. `bin/` is no longer writable. But the sandbox can still change code that later runs **unsandboxed**, in two ways:
- the pinned pnpm 11.2.2 in `package-manager-store`, which every `pnpm` call in core executes;
- the shared pnpm store, whose files are hard-linked into every other checkout's `node_modules`.

A private store per run fixes this. I verified that fix in the sandbox (details below).

---

## Round-1 findings: status

| ID | Status | How checked |
| --- | --- | --- |
| B1 | **Resolved** | Ran. Fake-codex argv contains `--add-dir <clone>/.git` (run-codex.sh:48). `codex sandbox` with the runner's roots: `git commit` in the clone succeeds. Fetch and `push --dry-run` inside the sandbox are from the caller's real run (not repeated). Header comment fixed (:2, :45). |
| M1 | **Resolved** | Ran. A seeded stale `codex-t2.report.json` and log are deleted before `codex` starts (:35); the fake saw no file at the `-o` path. Exit codes: rc 0 + report → 0 and prints the report; rc 0, no report → 1 with "no report"; rc 1 + report → 1; rc 3, no report → 3 (:75-78; `$(( ?: ))` works under `sh`). Documented in codex-task/SKILL.md:60 (both). |
| M2 | **Partially resolved → new M1 below** | Ran. argv now grants `store/v11` and `package-manager-store` only, not `~/.local/share/pnpm` (:49-54). Inside the sandbox `touch ~/.local/share/pnpm/bin/x` → EROFS. But `package-manager-store` holds an executable that runs unsandboxed, and the store is hard-linked into other checkouts (see M1). |
| M3 | **Resolved** | Read. core merge-pr/SKILL.md:49-57 restores the "main moved since CI" check (diff over `lib examples schema '*.ts'`, then Codex merges main and the run restarts from step 1). vscode merge-pr:48-49 does the same over `src test package.json`. Follow-up in m4. |
| m1 | **Resolved** (nit left) | Read. core AGENTS.md:20-21, vscode AGENTS.md:18, implement-task:20 (both): "starts in the clone on the spec's branch; makes no other clone or worktree". The general rule "1 作業 1 worktree" is still unqualified (n1). |
| m2 | **Resolved** | Read. core AGENTS.md:37-38 "作業は続けて完了とする", which agrees with implement-task:33-34 and codex-task:79-81. |
| m3 | **Resolved** | Read. The local `--drift --rebuild` step is gone. implement-task:33-34 and AGENTS.md:39 say why. |
| m4 | **Resolved** | Read. report.schema.json:8 "a fail is allowed only with its reason in note" agrees with implement-task:49 (core) / :47 (vscode). |
| m5 | **Mostly resolved → m1 below** | Ran. Each case was checked:<br>- Unpushed commit in the previous clone → refused, exit 2, clone kept (T5).<br>- Local-only branch → refused, exit 2 (T6).<br>- `fix/x` with only `foo/fix/x` on origin → `fix/x` is created from main instead of checking out the wrong branch (T7).<br>- An existing `foo/fix/x` is checked out with upstream `origin/foo/fix/x` (T8).<br>- Writable roots are built with `set --`, so there is no word splitting (:48-59).<br>- `[base]` and stacking are documented (codex-task:29,58).<br>Gaps: uncommitted work, commits on other branches, and a concurrent run with the same label are still discarded (m1). |
| m6 | **Not resolved** (outside the PRs) | Ran. `gh api repos/cuzic/{svg-diagram,svg-diagram-vscode}/branches/main/protection` → 404; rulesets `[]`. Carried as Minor. |
| m7 | **Resolved** | Read. merge-pr:16 (reviewer's "fix before merge"), :47 (0 checks / pending / UNKNOWN fail closed), :58 (flaky → separate PR). review-pr:17 (no `cp -a`, no `pkill`). Same lines in vscode (:15,46,50; review-pr:17). |
| m8 | **Resolved** | Read. AGENTS.md:6 lists 決定・承認・採用・実装中・一部実装済み・実装済み and excludes 提案・起草・起票. |
| m9 | **Resolved** | Read. The ADR 0013 and 0031 citations are removed (AGENTS.md:33,54). |
| m10 | **Resolved** | Read. CLAUDE.md:12-13 adds golden regeneration and `pptx-golden.yml`. |
| m11 | **Partially resolved → m3 below** | Read. AGENTS.md:40-41 and codex-task:82 say to run `pptx-golden.yml -f update=true`. But that workflow only uploads an artifact ("commit it yourself", pptx-golden.yml:4,41-44), and no guide says to download and commit it. |
| m12 | **Resolved** | Read and ran. vscode AGENTS.md:30-32 names the fixture install and says not-run in the sandbox; implement-task:30 agrees. `npm_config_cache` is exported (:62; the fake saw `<work>/npm-cache-<label>`). It is writable only because CODEX_WORK is under /tmp (n5). |
| n1 | **Resolved** | Read. core AGENTS.md:87, vscode AGENTS.md:66. |
| n2 | **Resolved** | Read. vscode merge-pr:60 says 「対応する環境」, which is README.md:7. |
| n3 | **Resolved** | Read. Trigger is now 「Codex に直させて」 (codex-task:3, both). |
| n4 | **Resolved** | Read. Comment now cites the log header. Earlier Codex logs on this host contain `reasoning effort: none` twice and `high` 8 times. |

---

## Blocker

None.

## Major

### M1 (both): the sandbox can still change code that runs unsandboxed, through `package-manager-store` and the shared pnpm store
- Location: `run-codex.sh:49-54` (grants `$store` = `~/.local/share/pnpm/store/v11` and `~/.local/share/pnpm/package-manager-store`).
- Evidence (ran):
  - **Pinned pnpm.** `strace -e execve pnpm --version` in the core worktree shows the global pnpm 12.18.0 exec'ing `~/.local/share/pnpm/package-manager-store/v11/links/@pnpm/exe/11.2.2/<hash>/node_modules/@pnpm/exe/pnpm`. That is core's pinned `pnpm@11.2.2`, a regular file with 1 link and mode `-rwxr-xr-x`.
    Inside `codex sandbox` with the runner's roots, creating a file under `package-manager-store/v11/` succeeds. So a dependency lifecycle script, or a prompt-injected Codex, can replace the pnpm that Claude, the owner and CI-like local runs execute **unsandboxed** in core. This is round-1 M2's threat, moved from `bin/` to here.
    The vscode run gets the same grant, so a vscode task can poison core's pnpm. vscode pins 12.18.0, which is the global pnpm, so it does not even need the grant.
  - **Shared store via hard links.** `node_modules/.pnpm/typescript@7.0.2/.../tsc.js` in `/home/cuzic/svg-diagram-vscode` has 25 links, one of them `~/.local/share/pnpm/store/v11/files/77/…`. The file is mode `rw-rw-r--`. /tmp and /home are the same ext4 filesystem, and the earlier sandbox clone `scratchpad/codex/cx-smoke2` also has `tsc.js` at 25 links.
    In the sandbox, writing through a hard link in the clone changed the outside file. Probe: a file under `~/.cache` hard-linked into the clone was overwritten from inside, while `touch ~/.cache/...` directly was EROFS.
    So writing to the store, or to the clone's own `node_modules`, edits `tsc.js`, `biome` and similar files in every checkout that Claude runs unsandboxed. Even without the store grant, the clone's `node_modules` would be hard-linked to the shared store.
- Fix (verified, ran):
  1. Give each run a private store: `export pnpm_config_store_dir="$work/pnpm-store"`. `npm_config_store_dir` is **ignored** by pnpm 11/12 (`pnpm store path` still printed the shared store). Then drop the `--add-dir "$store"` grant.
     In the sandbox, with only `.git` and the lock dirs granted, `pnpm install --frozen-lockfile` in a vscode clone took 7.5 s and `pnpm test` (7/7) and `pnpm typecheck` passed. The resulting `tsc.js` has 1 link.
  2. Drop the `package-manager-store` grant and warm the pinned pnpm before the sandbox starts: `(cd "$d" && pnpm --version >/dev/null)`. In the sandbox, with `package-manager-store` **not** granted, a project pinned to `pnpm@11.2.2` ran `pnpm --version` → `11.2.2`, rc 0.

## Minor

### m1 (both): run-codex.sh still discards some work, and same-label runs can collide (m5 residual)
- `:29-35`: the guard looks only at `HEAD --not --remotes=origin`. These are still deleted silently:
  - uncommitted changes, ran T9: a dirty file in the old clone was gone after the re-run. A `failed` run often leaves uncommitted work.
  - commits on a branch other than HEAD, ran T10: a commit on branch `side` was gone.
  - a concurrent run with the same label: it has no commits yet, so the guard passes and `rm -rf` removes the live clone. Read. codex-task:63 forbids two runs per *branch*, not per label.
- Fix: refuse when `git -C "$d" status --porcelain` is non-empty, use `log --branches --not --remotes=origin`, and either take a lock (`mkdir "$d.lock"`) or say "label ごとに 1 つだけ" in codex-task:63.

### m2 (both): stacked PRs: the spec says stack on the lower branch, but implement-task hardcodes `--base main`
- Location: codex-task:29 and :58 (both PRs) say stacked PRs are created from the lower branch. implement-task:41 (core) and :39 (vscode) say `gh pr create --base main`.
- Effect (read): Codex opens a stacked PR against main, so its diff includes the lower PR's commits. merge-pr's prerequisite "base が main" (core :15, vscode :14) is then satisfied for the upper PR, and merging it lands the lower PR's commits before the lower PR converges.
- Fix: implement-task: "`--base` は仕様のブランチ欄の base(積み上げなら下のブランチ)". merge-pr: refuse when the title says `stacked on #NN` and #NN is still open.

### m3 (core): the PPTX golden is never committed (m11 residual)
- `pptx-golden.yml:4,36-44`: `update=true` rewrites the manifest in the runner and uploads it as the artifact `pptx-golden`; "commit it yourself". AGENTS.md:41, CLAUDE.md:13 and codex-task:82 stop at "回す". Read.
- Fix: add "`gh run download <run> -n pptx-golden -D examples/out`, read the diff, and commit it in the PR worktree" to codex-task §golden, and list it in merge-pr:33's allowed commits.

### m4 (both): the "main moved" check uses an `origin/main` fetched before the CI wait
- core merge-pr:53-54 and vscode :48 run `git merge-base origin/main "$SHA"` / `git diff … origin/main` with the ref from step 1's `git fetch` (:27/:26). The `--watch` in step 2 can take tens of minutes, and main can move during it. Read.
- vscode's pathspec `src test package.json` misses `e2e/`, `scripts/` (build) and `pnpm-lock.yaml`.
- Fix: start the block with `git fetch -q origin || exit 1`, and widen the vscode pathspec (or drop it and check any change on main).

### m5 (vscode): the mutation rule cannot be met for VS Code-layer code
- AGENTS.md:33 asks for integration tests for VS Code API behaviour, and :35 says every new code needs a mutation that a test catches. But :30-32 and implement-task:30 say integration tests are `not-run` in the sandbox. For code in `extension.ts`, `diagnostics.ts`, `preview.ts` and similar, Codex can only report `NOT CAUGHT` or guess, and codex-task:72 then asks for a "add tests" follow-up spec that cannot be satisfied. Read.
- Fix: allow `caught_by: "<integration test> (CI)"` for vscode-layer mutations, and have review-pr check them via CI or a scratch `vscode-test` run.

### m6 (both, carried from round 1): main is unprotected
- Ran: protection 404 and rulesets `[]` on both repos. Not in the PRs' diff. Add a ruleset that blocks force-push and deletion on `main`.

## Nit

- n1 (both): core AGENTS.md:65 and vscode AGENTS.md:54 still say "1 つの作業に 1 つの `git worktree`" with no qualifier, next to core :20-21 / vscode :18 "別の clone や worktree は作らない". Prefix it with "(Claude・人が手で作業するとき)".
- n2 (vscode): vscode AGENTS.md:56 says commit messages may be "日本語でも英語でもよい", but implement-task:36 says "メッセージは日本語". This was already present in round 1 (25019fd).
- n3 (both): a new branch is created with `checkout -b "$br" origin/$base` (:42). Its upstream is then `origin/main`, ran T7: `@{u}` = `origin/main`. A bare `git pull` merges main, and `git status` reports against main. `push.default` is unset (simple), so a bare `git push` refuses rather than pushing to main. Use `--no-track`.
- n4 (vscode): codex-task:25's template cites `docs/adr/NNNN-....md`, but the vscode clone has no `docs/adr/`; the ADRs live in cuzic/svg-diagram. Write "cuzic/svg-diagram の docs/adr/…(`gh api repos/cuzic/svg-diagram/contents/docs/adr/…` で読む)".
- n5 (both): `npm_config_cache="$work/npm-cache-$label"` (:62) is outside the clone, so it is writable only because Claude's scratchpad is under /tmp, which workspace-write allows by default (ran: `mkdir` under /tmp OK; under `$HOME` → EROFS). The vscode guides also say the fixture install is not run in the sandbox. Put it in `$d/.npm-cache` (gitignored or `.git/info/exclude`) or drop it.

---

## Facts checked (no finding)

- `run-codex.sh` and `report.schema.json` are identical across the two PRs. The only changes after round 1 are in 4ea3bf2 and c24d7a1 (diffed).
- Fake-codex argv (ran, T1), in order:
  - `exec -s workspace-write -c sandbox_workspace_write.network_access=true -c model_reasoning_effort=high`
  - `--add-dir <clone>/.git --add-dir ~/.local/share/pnpm/store/v11 --add-dir ~/.local/share/pnpm/package-manager-store --add-dir /run/user/1002/pnpm-store-operation-locks-1002 --add-dir /run/user/1002/pnpm-dir-locks-1002`
  - `--output-schema <scripts>/report.schema.json -o <work>/codex-<label>.report.json -C <clone> -`

  The whole pnpm data dir is not granted. The spec arrives on stdin.
- A local-only branch is refused before `codex` starts. The partial clone `cx-<label>` is left behind, which is harmless because the next run replaces it.
- The new merge-pr wording does not contradict CLAUDE.md:16-17 ("main の取り込みは Codex"). The step 1 allowed list (core :33) includes "golden の作り直し", which matches CLAUDE.md:12-13.
- The pinned pnpm already present runs with `package-manager-store` read-only (ran). Only a first-time download of a new pinned version needs write access, which the warm-up step in M1's fix covers.

Counts:
- core #403: Blocker 0 / Major 1 / Minor 5 / Nit 3
- vscode #2: Blocker 0 / Major 1 / Minor 5 / Nit 5
- combined (unique): Blocker 0 / Major 1 / Minor 6 / Nit 5
