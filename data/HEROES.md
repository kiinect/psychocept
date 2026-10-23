# Hero implementation notes

`src/heroes.ts` hand-transcribes numeric level changes and ability definitions from
`data/wiki/heroes.json`. Source prose is used for the level descriptions in the UI;
it is never interpreted as executable balance data. No game images were used.
`hero-runtime.ts` and `hero-extras.ts` are deterministic, DOM-free simulation code.

All 18 heroes can be selected and purchased at their supplied difficulty-specific
base prices. A game permits one placement. Brickell requires water, Pat accepts
land or water, and footprints cannot overlap towers or the track. The hero panel
shows level, carried XP, targeting, unlocks, ability cooldowns, and target inputs.
Geraldo's shop and Corvus's spellbook have separate resource and unlock checks.

XP is awarded once when a round completes, independently of pops, using the
piecewise formula in `meta.json`. The documented r21=460 and r51=1710 resolve the
piecewise boundaries. Level costs are individually rounded from the base table
and meta's hero multiplier groups. Rosalia and Dan are absent from those groups;
their source unlock tables imply 1.425. Difficulty here means game mode, not map
difficulty: the supplied original map has no map-difficulty XP bonus metadata.

## Assumptions and fidelity differences

This implementation is playable but is not an exact reproduction of every wiki
mechanic. Missing numbers are marked `// uncertain:` in code, including Corvus's
spell balance, many cooldowns, shop prices/stock, several footprints and attacks,
and qualitative late-level changes. These values are explicit local defaults.

Hero attacks resolve directly against headless targets through the existing
immunity, damage, status, child-spawning and income machinery. Projectile travel,
melee arcs, shell explosion spacing, drone flight/formation, ricochets and pursuit
are simplified. Sword Charge resolves its passes instantly; Leaping Sword has a
persistent damage zone. Churchill's repeated shell explosions resolve together.
Obyn's totem uses periodic slowing instead of a separately rendered timed totem;
Trees pay cash when absorbing rather than dropping collectible bananas. Mine and
shop placement use coordinates and simplified collision zones. Rosalia's aircraft
movement and Dan's transformations use explicit local movement/combat defaults.
Silas's orbitals and walls use simplified collision and timing. Striker/Silas's
50% immunity bypass uses deterministic alternating eligibility, not independent
per-hit random rolls. These are behavior deviations, not claims of exact fidelity.

The tower catalog has no Druids, Skywardens, Banks, Farms, Necromancers, Super
Monkeys, True Sun God, or Paragons. Hero bonuses that require those units have no
recipient. Fertilizer requires an existing income-producing tower. Worn Hero's
Cape applies a persistent Super-like stat modifier to a low-tier Dart instead of
creating an unavailable Super Monkey type. Paragon totems retain their 2000 power
as state; there is no Paragon purchase system to consume it. Boss-specific and
multi-lane effects cannot be exercised by this repository's single-lane simulator.
No new `stub` abilities or skipped tests were introduced.

## Verification

`src/heroes.test.ts` exercises all 360 hero/level combinations, every ability at
its unlock, all shop items and spells, and specific outcomes for XP boundaries,
round completion, targeting, ability buffs, mines, Hex, sacrifice, Kinetic Charge,
Biohack recovery, fragments/walls, stock, figures, barriers and deterministic replay.
Run `npx tsc && npx vitest run && npx vite build`.
The four skipped military ability tests predate this task. Browser verification
was unavailable: the computer-use inventory returned no browsers or apps.
