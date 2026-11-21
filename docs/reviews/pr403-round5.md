# PR #403 (svg-diagram) / PR #2 (svg-diagram-vscode) — review round 5 (narrow)

- Target: cuzic/svg-diagram `chore/agent-guides` @ 6b331d1 (diff reviewed: fc31cd1..6b331d1; code change is 9ae0dc5)
- Target: cuzic/svg-diagram-vscode `chore/agent-guides` @ 52a0897 (diff reviewed: a03e11f..52a0897)

The two `run-codex.sh` files are byte-identical (`diff`). Both `SKILL.md` hunks match, apart from line offsets (+1 in vscode).

## Previous rounds: status

| ID | Round | Status |
| --- | --- | --- |
| M1: guide told Claude to "look into" `cx-<label>.old-*`, whose sandbox-written `.git/config` git would run | 4 | **Resolved** in the guide text. codex-task core :61–63 / vscode :62–64 now says: never run git, gh, pnpm or node in `cx-*` or `cx-*.old-*`; read results from origin and the PR; `rm -rf` `.old` clones unread. Golden regeneration now happens in "Claude's own worktree (`git worktree add`), not the Codex clone" (core :86). I searched all three skills, CLAUDE.md and AGENTS.md in both repos for `cx-`, `.old`, `clone`, `worktree`, `checkout`, `report`, `.log`, `報告` and `中を見`. Nothing tells Claude or a reviewer to run a command inside a Codex clone. The only remaining uses: `codex-<label>.report.json` and `codex-<label>.log` live in `$work`, not in the clone, and the runner fixes their paths. review-pr makes its own `git clone --reference <shared checkout .git>`. merge-pr touches no clone. The runner's own comment still says "Look into it" (see m2 below). It is not an instruction in a guide. |
| m1: `main` unprotected | 2–4 | Carried (not in the diff). |
| n1–n4 | 3–4 | Carried (not touched). |
| n5: reason for refusing `.pnpmfile.cjs` | 4 | **Half fixed**. The runner comment (:53–54) now gives the correct reason. codex-task core :64 / vscode :65 still say "(sandbox の外で走るため)". Carried. |
| n6: unescaped `packageManager` in `printf` | 4 | **Resolved** (:63). See below. |
| n7: unbounded label length | 4 | **Resolved** (:20). See below. |

## Checks run

- `sh -n` and `dash -n` on both `run-codex.sh`: OK.
- I made a harness in scratch: a local bare origin with the runner copied in, a fake `codex` that writes the `-o` report, and a fake `pnpm` that logs `$PWD` and `package.json`. I ran the real runner on branches with these `packageManager` values:
  - `pnpm@10.5.2+sha512.abcDEF0123`: warmed (the only `pnpm` call; cwd `$work/pm-warm`, content as expected).
  - `pnpm@1.2.3","x":"y`, `npm@10.0.0`, `pnpm@https://evil/x.tgz`, `pnpm@1.2.3 $(id)`, `pnpm@1.2`, `pnpm@1.2.3\nfoo`, and an object: `pm` emptied, no `pnpm` call, and the run still proceeds (rc 0).
- Label cap: a 24-char label runs (rc 0). A 25-char label gives `label too long (24 at most)` and rc 2. `a b` gives `bad label` and rc 2. The worst-case TMPDIR is `/tmp/cx-<24>.XXXXXX`, which is 39 bytes. No `/tmp/cx-*` dirs from these runs were left behind (the trap cleans them).
- `node -e 'require(<clone>/package.json)'` runs outside the sandbox, but only on a fresh clone of a pushed branch, before Codex runs. `require` of `.json` is a plain `JSON.parse`. No new exposure.
- Neither worktree has local changes. Both are still on `chore/agent-guides`.

## Blocker

None.

## Major

None.

## Minor

### m1 (both, carried): `main` is unprotected
Unchanged. A ruleset that blocks force-push and deletion is still advised, because Codex holds push credentials.

### m2 (both, new): the runner's comment and stderr still invite inspecting the old clone
- `run-codex.sh:36–37` says "...which git would run outside the sandbox. **Look into it, then delete it by hand.**"
- `:41` prints "it may hold unpushed work; delete it when done". Claude sees this line at run time, and it suggests checking first.
- These contradict the new SKILL.md rule ("delete unread"). The comment itself warns against git, so this is Minor, not Major. Still, the round-4 fix asked for both lines to change.
- Suggested text for :37: "Do not run git/gh/pnpm/node in it; delete it unread (see SKILL.md)". Suggested text for :41: "moved the previous clone to $old (do not run git in it; results are on origin; rm -rf it)".

## Nit

- n1 (both, carried): "1 つの作業に 1 つの `git worktree`" (core AGENTS.md:66, vscode :56) is unqualified next to "別の clone や worktree は作らない" (core :21, vscode :18).
- n2 (vscode, carried): AGENTS.md:58 "日本語でも英語でもよい" vs implement-task:37 "メッセージは日本語".
- n3 (both, carried): `run-codex.sh:50` `checkout -b "$br" "origin/$base"` sets upstream to `origin/<base>`; add `--no-track`.
- n4 (vscode, carried): codex-task:25 cites `docs/adr/NNNN-....md`; the repo has no `docs/adr/`.
- n5 (both, carried, half fixed): codex-task core :64 / vscode :65 "(sandbox の外で走るため)". Align it with the runner comment at :53–54.
- n8 (both, new): `run-codex.sh:63` glob `pnpm@[0-9]*.[0-9]*.[0-9]*` also accepts e.g. `pnpm@1x.2.3`. That is harmless, because the second `case` limits the characters to `[A-Za-z0-9@.+-]`. The comment ("plain pnpm@x.y.z") overstates it slightly.

## Counts

- core #403: Blocker 0 / Major 0 / Minor 2 (m1, m2) / Nit 4 (n1, n3, n5, n8)
- vscode #2: Blocker 0 / Major 0 / Minor 2 (m1, m2) / Nit 6 (n1–n5, n8)
- combined (unique): Blocker 0 / Major 0 / Minor 2 / Nit 6

## Verdict

converged: **yes**. No Blocker or Major remains. m2 and n5 are one-line text fixes that need no further review (CLAUDE.md: Minor/nit-only fixes pass on CI).
