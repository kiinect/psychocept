# Handoff (BTD6-style web clone, working title "Monkey Pop TD")

Latest change: the owner requested username/password accounts without email.
`.tasks/17-username-accounts.md` defines case-insensitive 3–24 ASCII names,
mapped to Supabase internal identities. Supabase retains password handling,
rate limits and save RLS. No email recovery; no existing identity is changed.
Version 1.2.0 is prepared on `lane/supabase`; production still serves 1.1.0.
Local tests/build/browser checks pass. Publishing is pending the owner disabling
Confirm email in Auth → Sign In / Providers; MCP has no Auth settings mutation,
and the separate dashboard session is signed out. Verify public Auth settings
show `mailer_autoconfirm: true` before any real username signup or deployment.
No real username signup has been attempted yet. Keep source PR #1 draft until
independent review; the owner has already authorized pushing and publishing.

2026-10-23: `lane/supabase` adds optional email/password accounts, local-first autosave, account caches, conflict choices, strict save decoding, and an owner-only SQL migration; see `supabase/README.md`. Verified: 1,015 Vitest tests, tsc, Vite build, isolated Playwright flows, and PostgreSQL RLS assertions. Auth sessions are memory-only (refresh requires sign-in).

Live backend: project `eqkujaglstzcmhwezvmq`, migration `20261023044858_bloons_cloud_saves` applied. Owner CRUD, cross-user isolation, nullable payloads, tombstones, and stale-upsert assertions passed on the live database with test fixtures rolled back. The active public publishable key and API URL are in this worktree's ignored `.env.local`; the configured build passes, and a real anonymous API request is denied (`401`, PostgreSQL code `42501`). Existing `public.UserData` was left untouched. Pending: Auth URL configuration verification (Site URL `https://psychocept.org`, redirects `https://psychocept.org/`, `http://localhost:5199/`, `http://127.0.0.1:5199/`) and source peer review. MCP cannot inspect Auth URL configuration; the browser dashboard requires its own sign-in. No vault changes.

Published 2026-10-23 at the owner's request: `https://psychocept.org` version 1.1.0, source/tag `v1.1.0` = `ee98a7027d3d1c8f3b39248dfea2ecd9fb5fc0d5`, Pages commit `b417be831f4eeb309623125a6e5163e42d518c91`. `/version.json`, the live bundle, menu, and account form were verified; no JavaScript page errors. Email signup is enabled and confirmation required, but real email confirmation has not been exercised. Source pushed to `lane/supabase`, draft PR `https://github.com/kiinect/psychocept/pull/1`; GitHub `main` remains the old source pending review. Rollback target is previous `gh-pages` commit `34ee98fcaf43fe08272a5f32bbed0294d88b51dc` (restore its tree in a new Pages commit; do not force-push). The unused scaffolded Actions workflow was omitted after GitHub rejected it for missing token `workflow` scope; branch-based Pages publishing stays in use.
Repo: /mnt/windows_d/projects/BTD6 CLONE (git, branch `main`). Stack: TS + Vite + PixiJS, Vitest. Hosted on the owner's own site (no single-file requirement; `npm run build:single` optional). Art/audio must stay original (owner's prompt: `~/Documents/btd6-web-prompt.md`). Vault note: `~/Documents/Obsidian Vault/Claude/Projects/BTD6 Web Clone/BTD6 Web Clone Overview.md`.

## State
Merged on main: scaffold, wiki data tables (data/wiki/*.json), sim with real bloons + rounds 1-140 + endless, 13 Primary/Military towers (195 tiers), heroes (18), maps+modes (12 maps, 14 modes, screens), audio (synth sfx + music), meta lib (src/meta: XP/ranks/powers/saves, not wired into the game), painterly map art (src/maps), original sprite atlas (src/art, not wired into the game), stress/sweep tools (tools/), README, Pages workflow.
Magic + Support towers + paragons are merged too (24 towers total).

## Team
Opus and gpt-6.1-sol (via Codex CLI; the model `codex exec` already uses, seen as `gpt-6.1-sol` in ~/.codex/sessions rollouts) work SIDE BY SIDE as peers, not lead/workhorse. Both are strong, so quality comes from combining them:
- Each owns its own lanes (separate worktrees/branches, disjoint files where possible) and works in parallel.
- Cross-review before merge: whoever did NOT write a branch reviews its diff (correctness, tests that actually test, look in the browser) before it merges to main. Use `codex exec --sandbox read-only ... < /dev/null` to ask gpt-6.1-sol for a review, or the agent-watch panel chat; Opus reviews Codex branches.
- Design/architecture decisions (screen flow, data shapes, shared APIs) are agreed in a short spec in `.tasks/` BEFORE either side builds; either side can propose, the other signs off.
- Nobody force-pushes or edits the other's active worktree; merge to main one at a time, gate after each (`npx tsc && npx vitest run && npx vite build`), then a real-browser check.
Claude Sonnet subagents were used for art/maps/merge lanes and remain optional extra hands.
## Status at pause (2026-10-22)
main = all lanes merged (432fee7): 915 tests pass (4 skipped), tools/sweep: 384/384 tower tiers purchasable and active, RBE rounds 1-80 match. :5200 serves this build. Peer review by gpt-6.1-sol found real merge bugs: see `.tasks/REVIEW-FINDINGS.md` (cash/income rules bypassed by hero/Trojan/hook/banana payouts, lane-blind road items and undead, Apopalypse auto-start stops, paragon buffs, shopPrice quotes). Fix these FIRST.

## Next (in order)
1. Fix `.tasks/REVIEW-FINDINGS.md` (tests first). (The towers merge itself is landed.)
2. UI lane per `.tasks/UI-PLAN.md`: splash -> main menu -> map -> difficulty -> mode -> hero pick -> game -> pause -> victory/defeat, BTD6-style HUD + right sidebar + upgrade panel; hook src/art sprites into the Pixi scene (rotating towers, pooled bloon sprites, pop fx). Biggest visible gap vs the real game right now: the in-game UI is a plain placeholder side panel and entities are still flat shapes.
3. Wire src/meta into the game (profile, ranks, powers, saves, round skip/autoplay).
4. Polish spec `.tasks/11-polish-perf.md`: make rounds 81-140 RBE match `rbe_scaled` (currently 0/60, MOAB ramp numbers are estimates), 60fps stress, mobile, README line "fan project, not affiliated", GitHub Pages.
5. Known gaps: 4 skipped tests = stubbed Military abilities (Chinook, Marine, Rocket Storm); group spacing estimated; Monkey Money amounts estimated; several paragons uncertain; water foam static.

## How the parallel workflow works
- Lanes = git worktrees. Codex: `.tasks/lane.sh <lane> <spec...>` (worktree /mnt/windows_d/projects/BTD6-lanes/<lane>, branch lane/<lane>, gate-then-commit). Claude: Agent tool with isolation worktree. Specs live in `.tasks/NN-*.md`. Merge into main one at a time, gate after each, check the browser.
- Codex CLI 0.163 is logged in (ChatGPT). ALWAYS run `codex exec ... < /dev/null` (open stdin hangs it). Chat/usage pane: the `agent-watch` Claude Code mod (~/.claude/dev-mods/<session>/agent-watch).
- Browser checks: claude-in-chrome and chrome-devtools MCP are unavailable on this box; use playwright-core (install outside the repo) with `~/.cache/ms-playwright` chromium. Dev server: `setsid nohup npx vite --port 5199 --strictPort < /dev/null &`. Stable build: `git archive HEAD | tar -x -C <dir>`, symlink node_modules, `vite build`, serve dist on :5200.
- Wiki fetching: WebFetch is blocked (402/403); `curl -A "Mozilla/5.0"` on the fandom `api.php` raw wikitext works.

## Pitfalls hit
- `.gitignore` must say `node_modules` (not `node_modules/`) or a worktree symlink gets committed and a merge deletes the real node_modules (fix: `npm install`).
- `pkill -f`/`pgrep -f` match your own shell if the pattern is in the command line.
- tsc does not typecheck tools/ (run via tsx/vitest).
