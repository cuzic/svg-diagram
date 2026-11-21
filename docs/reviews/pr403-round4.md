# Review round 4: agent guides (cuzic/svg-diagram#403, cuzic/svg-diagram-vscode#2)

Targets: `chore/agent-guides` @ fc31cd1 (core; fixes in 6a97836; worktree /home/cuzic/svg-diagram-agents) and @ a03e11f (vscode; fixes in af7ca2d + a03e11f; worktree /home/cuzic/svg-diagram-vscode-agents).
`run-codex.sh` and `report.schema.json` are still byte-identical in the two PRs (diffed), so findings on them apply to both. Line numbers are for `run-codex.sh` at these heads unless a file is named.
"Ran" = executed on this host (codex-cli 0.167.0, pnpm 12.18.0 global / 11.2.2 pinned in core). "Read" = text only.

Probes (scratch `review-agents-r4/`):
- `t/`: local bare origin + "shared" clone holding a copy of the runner, driven by a fake `codex` on PATH that records argv/env/cwd and writes the `-o` report.
- `sbx.sh`: `codex sandbox -c sandbox_mode="workspace-write" -c …exclude_slash_tmp=true -c …exclude_tmpdir_env_var=true -c sandbox_workspace_write.writable_roots=[<clone>/.git, <run TMPDIR>, <work>/pnpm-store, <work>/npm-cache-<label>, <two lock dirs>]`, cwd = the clone. Unlike round 3 (`-P :workspace`), these `-c` overrides do take effect, so the extra roots are granted in the harness.
- Real-run cross-check: header of `scratchpad/codex/codex-smoke11.log:7` (read).

No Codex model run. Nothing in the PR worktrees changed, nothing pushed. Side effect outside scratch: probing the warm-up installed pnpm 11.28.13 into `~/.local/share/pnpm/package-manager-store` (benign; same as what the runner does for a bumped pin).

## Conclusion

**Not converged, but close.** Both round-3 Majors are fixed in the runner, and I verified that by behaviour: `/tmp` is no longer writable, the only writable roots are the ones listed, the runner no longer runs git in the previous clone, the warm-up never touches the shared `$work/pnpm-store`, and nothing outside the sandbox runs from that store, the lock dirs or the warm dir.
One Major remains, and it is round-3 M2 moved from the script to the guide: the runner and codex-task now tell Claude to "look into" the moved-aside clone for unpushed work, and the first natural `git log` / `git status` there runs sandbox-planted config outside the sandbox (ran). The fix is a few lines of text.

---

## Previous rounds: status

| ID (round 3) | Status | How checked |
| --- | --- | --- |
| M1 `/tmp` writable → hard links into user store / checkouts | **Resolved** | Ran. Fake-codex argv: `-c sandbox_workspace_write.exclude_slash_tmp=true -c …exclude_tmpdir_env_var=true -c shell_environment_policy.set.TMPDIR="/tmp/cx-lab.XXXXXX"` and `--add-dir` for exactly `<clone>/.git`, the run TMPDIR, `<work>/pnpm-store`, `<work>/npm-cache-lab`, `/run/user/1002/pnpm-{store-operation,dir}-locks-1002` (:68-76, :83-89); env `TMPDIR`, `pnpm_config_store_dir`, `npm_config_cache`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` set; TMPDIR removed at exit and on SIGTERM. In `sbx.sh`: writable = clone, `.git`, run TMPDIR, `pnpm-store`, own `npm-cache-lab`, lock dir; **not** writable = `/tmp/r4probe`, `$work` itself, another label's clone and npm cache, `cx-lab.old-*`, `pm-warm`, `/run/user/1002`, other scratch files, `~/.cache`. (`/dev/shm` is writable but is a private tmpfs inside bwrap: a file written there did not appear on the host.) The real run header (`codex-smoke11.log:7`) lists the same roots and `pnpm install --frozen-lockfile` + `test/cdp-browser.test.ts` passed there (read). |
| M2 git run outside the sandbox in the previous clone | **Resolved in the runner → moved into the guide (new M1)** | Ran. Planted `core.fsmonitor`, `log.showSignature=true`, `gpg.program=<marker script>` in `cx-lab/.git/config` **from inside the sandbox**, re-ran the runner with the same label: the clone went to `cx-lab.old-<time>` (:36-40), no marker written, exit 0. Then the inspection the guide asks for fired both markers (M1 below). |
| m1 branch content executes before review | **Resolved** | Ran. Warm dir holds only `{"packageManager":"pnpm@11.2.2"}` (:61-63). A branch with `.codex/config.toml` is refused with exit 2 before `codex` is invoked (:52-54; fake codex never ran). Non-registry `packageManager` values (`pnpm@file:…tgz`, `pnpm@https://…`) are ignored by `pnpm --version`; an unknown version only warns. With a not-yet-installed pin (11.28.13) and `pnpm_config_store_dir=<scratch store>`, the scratch store stayed empty: the pinned pnpm is fetched into `~/.local/share/pnpm/package-manager-store`, never from `$work/pnpm-store`. |
| m2 (vscode) main-moved pathspec | **Resolved** | Read. vscode merge-pr:48 and core merge-pr:54 now diff `. ':!docs' ':!*.md'`. |
| m3 (vscode) `NOT RUN (integration)` not wired | **Resolved** | Read. report.schema.json:36, vscode codex-task:84, vscode review-pr step 4, vscode AGENTS.md:36, implement-task:32 (asks for the mutation and test in the PR body, which review-pr step 4 reads). The `done` branch of codex-task:75 still mentions only `NOT CAUGHT`, but :84 covers the other value. |
| m4 main unprotected | **Not resolved** (outside the PRs) → m1 | Ran. Both repos: "Branch not protected", rulesets 0. |
| n1 worktree wording | Not changed → n1 | Read. core AGENTS.md:66 vs :21; vscode AGENTS.md:56 vs :18. |
| n2 (vscode) commit language | Not changed → n2 | Read. vscode AGENTS.md:58 vs implement-task:37. |
| n3 `--no-track` | Not changed → n3 | Read. :48. |
| n4 (vscode) `docs/adr/NNNN` template | Not changed → n4 | Read. vscode codex-task:25; vscode `docs/` holds only `reviews/`. |
| n5 npm cache / store writable only via `/tmp` | **Resolved** | Explicit grants (:70). |
| n6 stale lock after SIGTERM | **Resolved** | Ran. `kill -TERM` the runner: it waits for codex to exit, then exits 130 with the lock and TMPDIR removed (:32-33). |
| n7 codex-task guard description | **Resolved** | Read. core codex-task:60-62, vscode :61-63. |
| n8 no base field | **Resolved** | Read. codex-task:29 (both). |

---

## Blocker

None.

## Major

### M1 (both): the guides tell Claude to inspect the moved-aside clone, and the obvious inspection runs sandbox-written git config outside the sandbox
- Location: core codex-task/SKILL.md:60, vscode :61 ("中を見て、要らなければ手で消す"); `run-codex.sh:35` ("Look into it, then delete it by hand") and :39, whose stderr message Claude sees: "it may hold unpushed work; delete it when done".
- Why it matters: "may hold unpushed work" is a git question, so Claude will answer it with git (`git -C <old> log`, `git status`). But `<old>/.git` was a writable root for the previous run (:70), and its `.git/config` and `.git/info/attributes` are not committed, so no review ever sees them. This is the round-3 M2 vector; the script comment at :34-35 already states it, but the actor (Claude, reading SKILL.md and the stderr line) is not told.
- Evidence (ran, `t/`):
  1. From inside the sandbox (`sbx.sh`, cwd = `cx-lab`): `git config core.fsmonitor '<write marker>; false'`, `git config log.showSignature true`, `git config gpg.program <marker script>` → succeeded.
  2. Runner again with label `lab`: clone moved to `cx-lab.old-20261121063903`, no marker (the runner itself is clean).
  3. `git -C <old> log --oneline -2` → `pwned-gpg` written. `git -C <old> status --short` → `pwned-fsmon` written. Both outside the sandbox, as the user.
- Fix (text only): in codex-task (both) and the runner's comment and stderr line, say "do not run git, gh or pnpm in `cx-<label>` or `cx-<label>.old-*` outside the sandbox". To check for unpushed work, read refs as files and compare with origin from your own checkout, e.g. `cat <old>/.git/refs/heads/<br>` (or `grep <br> <old>/.git/packed-refs`) against `git ls-remote origin <br>`; or run git inside the sandbox. Since implement-task pushes even `blocked` work (core implement-task:50, vscode :49), the usual action is simply to delete it. Also make codex-task:83 (core, "その PR の worktree で作り直してコミットする") say "Claude's own worktree of the PR branch, not `cx-<label>`": a `git commit` there would also run `.git/hooks/*` written by the sandbox.

## Minor

### m1 (both, carried): `main` is unprotected
- Ran: both repos return "Branch not protected", rulesets 0. Not in the diff. A ruleset blocking force-push and deletion is still advised, because Codex holds push credentials.

## Nit

- n1 (both, carried): "1 つの作業に 1 つの `git worktree`" (core AGENTS.md:66, vscode :56) is unqualified next to "別の clone や worktree は作らない" (core :21, vscode :18).
- n2 (vscode, carried): AGENTS.md:58 "日本語でも英語でもよい" vs implement-task:37 "メッセージは日本語".
- n3 (both, carried): :48 `checkout -b "$br" "origin/$base"` sets upstream to `origin/<base>`; add `--no-track`.
- n4 (vscode, carried): codex-task:25 cites `docs/adr/NNNN-....md`; the repo has no `docs/adr/`.
- n5 (both, new): the stated reason for refusing `.pnpmfile.cjs` (codex-task:61 core / :62 vscode "sandbox の外で走るため", AGENTS.md safety rule, :51) is no longer true: since the warm-up moved to `pm-warm`, the runner runs no pnpm in the clone outside the sandbox. The refusal is harmless defence in depth; reword the reason (e.g. "reviewers run `pnpm install` outside the sandbox"), or drop it.
- n6 (both, new): :62 `printf '{"packageManager":"%s"}'` embeds a branch-controlled string unescaped. I found no effect on `pnpm --version` (non-registry specs are ignored), but validate it first, e.g. `case $pm in pnpm@[0-9]*) ;; *) pm= ;; esac` plus rejecting `"`.
- n7 (both, new): the label length is unbounded (:18), and TMPDIR is `/tmp/cx-<label>.XXXXXX` (:68), which the comment at :67 says must stay short for Chromium sockets. Cap the label (e.g. 24 chars) at :18.

---

## Facts checked (no finding)

- **Shared `$work/pnpm-store`.** It is writable by every run, so one run can poison what another label's run installs. But that only reaches code that runs inside a later sandbox, and a hostile run already holds the same push rights. Nothing outside the sandbox reads it:
  - the warm-up does not use it (ran, including a fresh pinned version);
  - review-pr reviewers clone elsewhere and use the default store (review-pr:15);
  - files installed in the sandbox are copies, not hard links, because the clone and the store are separate bind mounts (round 3).
- **XDG lock dirs.** pnpm 12.18.0 also opens `all-stores.lock` and the per-store locks with `O_RDWR|O_CREAT|O_NOFOLLOW` (ran, strace), the same as 11.x in round 3, so a planted symlink cannot redirect a write. What remains is availability only (holding the lock, or replacing a lock file with a directory, would block the user's own pnpm). That is inferred, not run, and not counted.
- **The warm dir and `.old` clones.** Both are under `$work`, which is not a root, and neither is writable from the sandbox (ran). Neither is an ancestor of a writable root, so the sandbox cannot plant a `pnpm-workspace.yaml` or `.npmrc` that the warm-up would pick up.
- **The run's `-o` report and log paths** are under `$work` and fixed by the runner. The sandbox cannot pre-plant them.
- **Codex's own harness git calls** in the clone (whose `.git` is writable mid-run) are hardened. The binary's strings show `-c core.fsmonitor=false`, `core.hooksPath=`, `safe.bareRepository=explicit`, `--no-textconv --no-ext-diff` and `GIT_OPTIONAL_LOCKS=0`. "ghost_snapshot" appears only as "legacy". Read, not run.
- **The clone's origin is an SSH GitHub URL** in both worktrees, so `git clone --reference` creates no hard links into the user's object store. A local-path origin would; that does not apply here.
- **No new contradictions between the guides** besides n5. The codex-task writable-roots line (core :62, vscode :63) matches the run header exactly.

## Verdict

Counts:
- core #403: Blocker 0 / Major 1 / Minor 1 / Nit 5 (n1, n3, n5, n6, n7)
- vscode #2: Blocker 0 / Major 1 / Minor 1 / Nit 7 (n1–n7)
- combined (unique): Blocker 0 / Major 1 / Minor 1 / Nit 7

converged: **no** (M1, both PRs; text-only fix).
