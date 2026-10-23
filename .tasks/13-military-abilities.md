# Task 13-military-abilities (gpt-6.1-sol lane `mil`; Opus reviews before merge)
Repo: this dir. Read first: src/sim.ts (activate(), ability kinds, roadItems/sentries/darts), src/towers/military.ts, src/towers/types.ts, src/military.test.ts, data/wiki/towers/heli_pilot.json and dartling_gunner.json. Hand-code numbers from the wiki prose, mark ambiguity `// uncertain:`. Sim stays deterministic (use this.rng) and DOM-free. `npx tsc && npx vitest run && npx vite build` must stay clean and `npx tsx tools/sweep.ts` must still print 384/384. Final message: 5 lines max.

Ownership: Opus is editing makeBloon / round HP ramp in src/sim.ts and tools/checks.ts; do not touch those. UI lane owns src/main.ts and src/ui/*; do not touch. You own src/towers/military.ts, the ability code paths in src/sim.ts, src/towers/types.ts (new ability kinds only), src/military.test.ts.

Replace the four `ability('stub',...)` entries and un-skip their tests (src/military.test.ts:44-47), each test must fail on the stub:
1. Support Chinook (heli 2-4? check the path): Reposition picks up a tower and drops it at a target point (new public API `relocate(heliIdx, towerIdx, point)` validated with canPlace(..., ignore)), and Supply Crate drops cash + lives per wiki; cash goes through `earnIncome` (mode incomeMult), lives as wiki says.
2. Special Poperations: deploys a temporary Monkey Marine (a timed tower/sentry-like unit with wiki stats) at the target point for its wiki duration, then removes it; cash from Special Poperations crate also via earnIncome.
3. Rocket Storm: timed waves of missiles at the strongest/first bloons per wiki (count, damage, waves, duration) via the existing darts/burst pipeline.
4. M.A.D Rocket Storm: enhanced waves (wiki numbers, MOAB bonus).
Abilities must respect cooldown, gameOver, and camo/lead rules like the existing abilities. Keep tests headless and deterministic.
