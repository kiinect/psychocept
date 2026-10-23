# Monkey Pop TD

A browser tower-defense game (TypeScript + Vite + PixiJS), static and Chromebook-friendly.

> **Fan project. Not affiliated with, endorsed by, or sponsored by Ninja Kiwi or the Bloons franchise.**
> "Bloons" and related names are trademarks of their owners and are used here only to describe what this project is inspired by.

## Build, run, test

```bash
npm install
npx vite              # dev server
npx tsc                # type check
npx vitest run         # unit + headless sim tests (src/**, tools/**)
npx vite build         # production build into dist/
npx vite preview       # serve dist/ locally
```

Headless tools (no browser needed):

```bash
npx tsx tools/stress.ts [seconds=20] [bloons=1500] [slowdown=4]   # ms/tick with ~1500 bloons + Chromebook projection
npx tsx tools/sweep.ts                                            # buys every tower/tier and checks it fires; round RBE vs wiki table
```

`stress.ts` projects the 60 fps budget (16.7 ms/frame) by multiplying the measured sim cost by a Chromebook slowdown
factor (default 4x, a guess; pass your own). It passes when sim p95 stays under half a frame. `sweep.ts` exits non-zero
on any inactive tower/tier or any RBE mismatch in rounds 1-80 (rounds 81-140 are informational: the wiki table is
HP-scaled and the sim data does not model that yet). Both are also covered by `vitest` (`tools/tools.test.ts`).

## Meta layer (`src/meta`)

Optional account creation and cloud autosave: setup, migration, conflict behavior,
and verification are documented in [supabase/README.md](supabase/README.md).

Pure, deterministic TypeScript with a single entry point, `src/meta/index.ts`: rank/XP table and level-up logic, round XP,
Monkey Money, the 44-row powers table with typed effects, profile / settings / mid-game save in versioned `localStorage`
slots (with migration; falls back to memory if storage is blocked).

## Data provenance

- Numeric tables (`data/wiki/*.json`) were transcribed from public community wiki pages as prose and hand-coded; ambiguous
  values are marked `uncertain` in the data and in code comments.
- Maps (`data/maps.json`) are original layouts.
- All art and audio are original and generated/authored for this project. No game files were extracted, decompiled,
  copied, or traced.

## Deploy (GitHub Pages)

`psychocept.org` serves the built files from the `gh-pages` branch using GitHub Pages' branch source.
Build from a clean source checkout with the local public Supabase configuration and `VITE_RELAY_URL` set.
Run `npm ci --ignore-scripts`, `npx tsc --noEmit`, `npx vitest run`, and `npx vite build` before publishing.
Copy `dist/` into a checkout of `gh-pages`, retain `CNAME` (`psychocept.org`) and `.nojekyll`, then commit and push
that branch normally. Keep a record of the previous Pages commit for rollback. Never force-push the deployment branch.
The previously scaffolded Actions workflow is omitted because the saved GitHub token cannot create workflows;
these validation gates run locally before publication. The build uses relative asset paths (`base: './'`).
Account and co-op features contact their configured Supabase and relay services at runtime.

## License

Code: ISC. See provenance note above for data and assets.

## Co-op (2–4 players)
Main menu → Co-op → Create match (share the 6-letter code) or Join match. The host's browser runs the clock; every player runs the same deterministic simulation and actions are scheduled on the same tick (`src/net/`). Each player has their own cash, can only change their own monkeys, and (with map split) builds in their own zone. Lives are shared.

Players find each other through a tiny Cloudflare Worker relay in `relay/` (one Durable Object per room; free plan is enough):
```
cd relay && npm install
npx wrangler login      # once, opens the browser
npx wrangler deploy     # prints https://mpt-relay.<account>.workers.dev
```
Then set the GitHub repo variable `VITE_RELAY_URL` to `wss://mpt-relay.<account>.workers.dev` (Settings → Secrets and variables → Actions → Variables) and re-run the Pages workflow. Local dev: `cd relay && npx wrangler dev` (the game defaults to `ws://localhost:8787` in dev).
