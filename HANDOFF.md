# Handoff (BTD6-style web clone, working title "Monkey Pop TD")
Repo: /mnt/windows_d/projects/BTD6 CLONE (git, branch `main`). Stack: TS + Vite + PixiJS, Vitest. Hosted on the owner's own site (no single-file requirement; `npm run build:single` optional). Art/audio must stay original (owner's prompt: `~/Documents/btd6-web-prompt.md`). Vault note: `~/Documents/Obsidian Vault/Claude/Projects/BTD6 Web Clone/BTD6 Web Clone Overview.md`.

## State
Merged on main: scaffold, wiki data tables (data/wiki/*.json), sim with real bloons + rounds 1-140 + endless, 13 Primary/Military towers (195 tiers), heroes (18), maps+modes (12 maps, 14 modes, screens), audio (synth sfx + music), meta lib (src/meta: XP/ranks/powers/saves, not wired into the game), painterly map art (src/maps), original sprite atlas (src/art, not wired into the game), stress/sweep tools (tools/), README, Pages workflow.
In flight: Magic + Support towers + paragons are on branch `lane/towers` (Codex). It conflicts with main in sim.ts/main.ts; a Sonnet agent is merging it in its own worktree (branch `worktree-agent-a39a5cda10c60332f`). Check whether it landed before redoing: `git log --oneline main | head`, `git branch --contains lane/towers`.

## Team
Opus (lead, reviews/merges/browser checks) + gpt-6.1-sol via Codex CLI (workhorse; it is the model `codex exec` already uses, seen as `gpt-6.1-sol` in ~/.codex/sessions rollouts). Claude Sonnet subagents were used for art/maps/merge lanes and can still be used.

## Next (in order)
1. Land the towers merge (gate: `npx tsc && npx vitest run && npx vite build`, then browser check with playwright-core).
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
