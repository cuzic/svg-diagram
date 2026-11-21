# Review round 3: agent guides (cuzic/svg-diagram#403, cuzic/svg-diagram-vscode#2)

Targets: `chore/agent-guides` @ a95d016 (core; fixes in 2bf2bb7; worktree /home/cuzic/svg-diagram-agents) and @ da2ab1f (vscode; worktree /home/cuzic/svg-diagram-vscode-agents). Both heads match origin (`git ls-remote`).
`run-codex.sh` and `report.schema.json` are still byte-identical in the two PRs (diffed), so a finding on them applies to both PRs. Line numbers below are for `run-codex.sh` at these heads.
"Ran" means I executed it on this host (codex-cli 0.167.0, git 2.43.0). "Read" means I only read the text.
Probes are in the scratch dir `review-agents-r3/`:
- `t/`: a local bare origin and a "shared" clone holding a copy of the runner, driven by a fake `codex` on PATH. The fake records argv and env, writes the `-o` report, and in some tests does what a sandboxed Codex can do (edit the clone's `.git/config`).
- `sbx.sh`: `codex sandbox -P :workspace -C <clone>`, which is the same bubblewrap workspace-write sandbox. Note: with `-P`, the `-c sandbox_workspace_write.*` overrides are ignored, so the extra `--add-dir` roots (`.git`, the lock dirs) are **not** granted in this harness. For those roots I rely on the header of the real run `codex/codex-smoke7.log:7`, which lists the effective roots: `[workdir, /tmp, $TMPDIR, <clone>/.git, <two lock dirs>]`.
- `f1/core`: a `--reference` clone of core for strace and pnpm probes.

No Codex model run was made. Nothing in the two PR worktrees was changed, and nothing was pushed. One real file outside the scratch dir was touched: a probe file I created and deleted at `~/.cache/r3-probe-target`. An empty `.codex/config.toml` probe was put in the stale `codex/cx-smoke7` clone and removed.

## Conclusion

**Not converged.** The round-2 fix does what it says: the pnpm stores are no longer granted, and the pinned pnpm cannot be written. But two paths still let the sandbox change or run code outside the sandbox:
- **M1.** The sandbox still allows writes to all of `/tmp`. `/tmp` holds files that are hard-linked into `~/.local/share/pnpm/store` and from there into `/home/cuzic/svg-diagram-vscode/node_modules`. One example is in `$CODEX_WORK` itself.
- **M2.** The new uncommitted-work guard runs `git status` (and the old one ran `git fetch`) **outside** the sandbox, in a clone whose `.git/config` the sandbox could write. I ran both through the runner: `core.fsmonitor` executes, and so does an `ext::` remote.

Both are the same class of issue as round-2 M1, so they are Major under the same bar.

---

## Previous rounds: status

| ID (round 2) | Status | How checked |
| --- | --- | --- |
| M1 pnpm store / pinned pnpm | **Resolved as scoped → new M1** | Ran. Fake-codex argv: `--add-dir <clone>/.git --add-dir /run/user/1002/pnpm-store-operation-locks-1002 --add-dir /run/user/1002/pnpm-dir-locks-1002`. The store grants are gone (:57-64). The env has `pnpm_config_store_dir=<work>/pnpm-store`, `npm_config_cache=<work>/npm-cache-<label>` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (:53,66,68).<br>In the sandbox, `~/.local/share/pnpm/store/v11/*` and `package-manager-store/*` are both EROFS.<br>strace of the warm-up (:54) with the env set: it execs `~/.local/share/pnpm/package-manager-store/v11/links/@pnpm/exe/11.2.2/…/pnpm`, and it never touches `$work/pnpm-store` (0 references). So the private store does not move the package-manager store into `$work`, and nothing from `$work/pnpm-store` runs outside.<br>New hard links out of the sandbox are refused: `ln ~/.bashrc <scratch>/newlink` gives `Invalid cross-device link`.<br>But **pre-existing** hard links under `/tmp` remain writable (M1). |
| m1 discard / collide | **Resolved → introduces M2; stale lock n6** | Ran (t/). A dirty file is refused with exit 2 and kept. A commit on another branch is refused with exit 2 (`--branches`, :36). An existing `cx-lab.lock` is refused with exit 2 (:29-30). After `kill -TERM` the lock stays (n6). |
| m2 stacked base | **Resolved** (nit n8) | Read. implement-task: `--base <仕様のブランチの元。積み上げなら下のブランチ…>` (core implement-task:41, vscode :40). merge-pr requires base `main` and handles a stacked PR only after the lower PR is merged and the base is changed (core merge-pr:15, vscode :14). |
| m3 PPTX golden commit | **Resolved** | Read. core codex-task:82-83 (`gh run download <run-id> -n pptx-golden`, replace and commit after reading the diff). AGENTS.md:41. merge-pr:33 allows "golden の作り直し". |
| m4 refetch before main-moved check | **Resolved in core; vscode pathspec not widened → m2** | Read. core merge-pr:54 `git fetch -q origin`, vscode merge-pr:48 the same. vscode still diffs only `src test package.json`, and the repo has `e2e/`, `scripts/build.ts` and `pnpm-lock.yaml`. |
| m5 vscode integration-only mutations | **Partially resolved → m3** | Read. vscode implement-task:32 adds `NOT RUN (integration)`, plus "レビューで確かめる". |
| m6 main unprotected | **Not resolved** (outside the PRs) → m4 | Ran. Both repos: "Branch not protected", rulesets `[]`. |
| n1–n5 | **Not changed** → n1–n5 | Read. vscode AGENTS.md:54,56; core AGENTS.md:65; run-codex.sh:47 (`checkout -b "$br" "origin/$base"` with no `--no-track`); vscode codex-task:25; run-codex.sh:66. |

---

## Blocker

None.

## Major

### M1 (both): the sandbox can still write into the shared pnpm store and other checkouts, through hard links that already exist under `/tmp`
- Location: `run-codex.sh:55-58` and `:71`. workspace-write keeps its default `/tmp` and `$TMPDIR` roots. The script's comment at :55 even counts on "$work's /tmp".
- Evidence (ran):
  - The effective roots of a real run are `[workdir, /tmp, $TMPDIR, …]` (`codex/codex-smoke7.log:7`). In `sbx.sh`, `/tmp/r3probe`, `/tmp/claude-1002/r3`, other scratch dirs and `/dev/shm/r3` are all writable.
  - `tsc.js` with inode 71048803 has 25 links. These include `/home/cuzic/svg-diagram-vscode/node_modules/.pnpm/typescript@7.0.2/…/tsc.js` and these paths under `/tmp`:
    - `$CODEX_WORK/cx-smoke2/…/tsc.js`: the codex-task default work dir, from an earlier runner version;
    - another session's `scratchpad/pr35/core/…`;
    - with inode 71069707 / 12 links, `scratchpad/plugin-hero/…` and `pr35/base/…`.

    Any `pnpm install` that runs outside the sandbox with the default store into a `/tmp` clone creates more such links, for example a review-pr clone made per review-pr:171.
  - In the sandbox, opening that `$CODEX_WORK/cx-smoke2/…/tsc.js` for writing succeeds. I used an append open with no write, and the md5 and mtime are unchanged afterwards.
    Direct proof of the effect: I made `~/.cache/r3-probe-target` and hard-linked it into the scratch dir. From the sandbox, `echo changed > <scratch>/hl` changed the file in `$HOME`, while writing the target directly was EROFS.
  - So a dependency lifecycle script or a prompt-injected Codex can still rewrite `tsc.js`, `biome` and similar files that Claude and the owner run **unsandboxed** in `/home/cuzic/svg-diagram*`. This is round-2 M1's second half. The private store fixed the clone's own `node_modules`, but `/tmp` as a whole is still a root.
  - The same `/tmp` root also lets one run write Claude's scratch scripts (`scratchpad/dl.mjs` is writable from the sandbox) and other labels' clones (M2).
- Fix (not verified: in this harness `-P :workspace` ignores `-c sandbox_workspace_write.*`; check the roots in the next real run's log header):
  - Add `-c sandbox_workspace_write.exclude_slash_tmp=true -c sandbox_workspace_write.exclude_tmpdir_env_var=true`.
  - Export `TMPDIR="$work/tmp-$label"`.
  - Grant only the run's own places explicitly: `--add-dir "$work/pnpm-store" --add-dir "$work/npm-cache-$label" --add-dir "$TMPDIR"`, with no grant for all of `$work`.
  - Then delete the case at :58, and say in codex-task that nothing in `$CODEX_WORK` may be `pnpm install`ed outside the sandbox.

### M2 (both): the runner runs git outside the sandbox in a clone whose `.git/config` the sandbox could write, so an injected Codex gets code execution on the next run with that label
- Location: `run-codex.sh:33-36`. `git fetch` is at :34 (present since round 1). `git status --porcelain` at :35 is new in 2bf2bb7 (the round-2 m1 fix). These run on the **old** `cx-<label>`, outside the sandbox, before `rm -rf`.
- Who can write that `.git/config`:
  - Codex in that clone: `.git` is a writable root (:57; real-run header). In the emulation `codex sandbox -C <clone>/.git`, `.git/config` and `.git/hooks/*` are writable.
  - Any other run: `cx-<other>/.git/config` is writable through the `/tmp` root (ran with `sbx.sh`).
- Evidence (ran, t/):
  - **fsmonitor.** A fake `codex` runs `git -C "$dir" config core.fsmonitor 'echo PWNED-by-fsmonitor > …/pwned; false'`. Run 1 ends normally. Run 2 with the same label writes `pwned` from the runner's `git status`, unsandboxed, and then goes on as if nothing happened (exit 0).
  - **fetch.** In the same clone I set `protocol.ext.allow=always` and `remote.origin.url="ext::sh -c echo% PWNED-by-fetch% >% …/pwned2"`. A plain `git -C <clone> fetch -q origin` (the command at :34) wrote `pwned2`.
  - Other repo-config hooks give the same result: `core.sshCommand`, `credential.helper=!…`, `uploadpack`, `include.path`. The config is not committed, so no review ever sees it.
- Fix: do not run git in an old clone outside the sandbox. If `$d` exists, refuse with "inspect or remove `$d`", or `mv "$d" "$d.prev-$(date +%s)"` and leave the decision to Claude. Either way keeps the work and runs no git. Hardening single keys (`-c core.fsmonitor=`, `-c protocol.allow=never` …) is a deny-list, so prefer not to inspect at all.

## Minor

### m1 (both): branch content executes outside the sandbox before any review
- `run-codex.sh:54`: the new warm-up `(cd "$d" && pnpm --version)` runs in the fresh checkout of `$br`, which is a branch that Codex pushed on an earlier run. Ran: with a `.pnpmfile.cjs` in `f1/core` that writes a file, `pnpm --version` wrote it. So a pnpmfile committed by an injected Codex runs unsandboxed on the next run for that PR, before review.
- Codex marks every runner clone path as trusted: `~/.codex/config.toml` has `trust_level = "trusted"` for `codex/cx-smoke`…`cx-smoke7`, and only the runner made those. A trusted path loads the repo's `.codex/config.toml`. Ran: putting `model = 123` there makes `codex sandbox -C cx-smoke7` fail parsing it, while the same file in an untrusted clone is ignored.
  The sandbox masks `<clone>/.codex` (mkdir → "File exists"), but a commit made with git plumbing can still carry `.codex/config.toml`. On the next run with that label it is checked out and loaded. It can declare `mcp_servers` / `notify` commands, which Codex launches outside the sandbox (read; not run).
- Why only Minor: reviewers already run PR code unsandboxed (review-pr:171-182), so this is the same trust boundary, just earlier and without review. If the owner wants "nothing a sandboxed run pushes executes before review", this is Major.
- Fix:
  - Warm up in a directory that holds only `{"packageManager": …}` copied from the clone's `package.json`.
  - Pass `-c projects.<d>.trust_level="untrusted"` (or the exec flag that skips project config), or refuse when `$d/.codex` exists after the checkout.
  - Have review-pr flag `.codex/`, `.pnpmfile.cjs` and `.npmrc` / `pnpm-workspace.yaml` changes as Major-by-default.

### m2 (vscode): the "main moved" check misses `e2e/`, `scripts/` and `pnpm-lock.yaml` (round-2 m4 residual)
- vscode merge-pr:48 diffs only `src test package.json`. `e2e/extension.spec.ts`, `e2e/vscode.ts` and `scripts/build.ts` exist, and a lockfile-only bump on main is also missed. Read.
- Fix: drop the pathspec, so that any change on main since the merge base triggers a re-merge, or add `e2e scripts pnpm-lock.yaml .github`.

### m3 (vscode): `NOT RUN (integration)` is not wired through the rest of the guides (round-2 m5 residual)
- implement-task:32 introduces it, but:
  - `report.schema.json:36` describes `caught_by` as "the failing test, or 'NOT CAUGHT'";
  - codex-task:72 handles only `NOT CAUGHT`;
  - review-pr:26 tells the reviewer to use CI results and apply mutations "only when needed", with no step to check integration mutations, and CI does not apply mutations;
  - AGENTS.md:35 still says every new code needs a mutation that a test is seen to catch.

  So "レビューで確かめる" has no owner. Read.
- Fix: add `NOT RUN (integration)` to the schema description and to codex-task:72 ("send to review"). In vscode review-pr add "apply the listed mutation and run `pnpm test:integration` in the review clone". Qualify AGENTS.md:35.

### m4 (both, carried): `main` is unprotected
- Ran: both repos return "Branch not protected" and rulesets `[]`. Not in the diff. Add a ruleset that blocks force-push and deletion.

## Nit

- n1 (both, carried): core AGENTS.md:65 and vscode AGENTS.md:54 "1 つの作業に 1 つの `git worktree`" is unqualified next to "別の clone や worktree は作らない" (core :21, vscode :18).
- n2 (vscode, carried): AGENTS.md:56 "日本語でも英語でもよい" vs implement-task "メッセージは日本語".
- n3 (both, carried): `run-codex.sh:47` `checkout -b "$br" "origin/$base"` sets upstream to `origin/<base>`. Add `--no-track`.
- n4 (vscode, carried): codex-task:25 template cites `docs/adr/NNNN-....md`, which does not exist in the vscode repo.
- n5 (both, carried; now part of M1's fix): `npm_config_cache` (:66) and the new `pnpm_config_store_dir` (:53) are writable only because `/tmp` is a root.
- n6 (both, new): the lock is removed only by `trap … EXIT` (:31). Ran: after `kill -TERM` of the runner, `cx-<label>.lock` stays, and the next run says "a run with label … is in progress". Use `trap 'rmdir "$lock"' EXIT; trap 'exit 143' TERM INT HUP`, or mention the stale lock in the message.
- n7 (both, new): codex-task:59 (core) / :60 (vscode) still describes the guard as "origin に無いコミットがあれば断る". It now also refuses uncommitted changes and a same-label run in progress.
- n8 (both, new): implement-task asks for `--base <仕様のブランチの元>`, but the spec template (codex-task:28-30) has no field that names the base branch. "積み上げなら下のブランチから" is only a note about the runner. Add `- base: <branch>(積み上げのとき)`.

---

## Facts checked (no finding)

- The pnpm lock dirs are safe to grant. strace of an outside `pnpm install` shows the locks opened with `O_RDWR|O_CREAT|O_NOFOLLOW`, with no truncate. So a symlink planted in `/run/user/1002/pnpm-*-locks-1002` cannot redirect a write. The worst a sandbox can do is hold `all-stores.lock` while it runs.
- `/run/user/1002` itself, `/var/tmp`, `$HOME`, the PR worktrees' `.git` and the runner script are EROFS in the sandbox (ran).
- `.agents/` in the clone is read-only and `.codex/` is masked inside the sandbox (ran), so Codex cannot edit its own skill there.
- In the real run log (`codex-smoke7`), `pnpm install --frozen-lockfile`, a Chromium test and `pnpm typecheck` passed. The private-store install in the sandbox copies instead of hard-linking (`tsc.js` link count 1 in cx-smoke3..7), because `/tmp` and the workdir are separate bind mounts.
- The guide changes since round 2 introduce no new contradictions besides n7/n8. CLAUDE.md:13 ("`pptx-golden.yml` の起動") is consistent with the new download-and-commit step.

## Verdict

Counts:
- core #403: Blocker 0 / Major 2 / Minor 2 / Nit 6
- vscode #2: Blocker 0 / Major 2 / Minor 4 / Nit 8
- combined (unique): Blocker 0 / Major 2 / Minor 4 / Nit 8

converged: **no** (M1, M2 in both PRs).
