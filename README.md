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

`.github/workflows/pages.yml` runs type check, tests and `vite build` on every push to `main` and publishes `dist/`.
Enable it once under Settings > Pages > Source: GitHub Actions. For a custom domain, add a `public/CNAME` file containing
the domain (Vite copies `public/` into `dist/`); the workflow serves whatever ends up in `dist/`. The build uses relative
asset paths (`base: './'`), so it works under `user.github.io/repo/` or a custom domain alike, and makes no network
requests at runtime.

## License

Code: ISC. See provenance note above for data and assets.
