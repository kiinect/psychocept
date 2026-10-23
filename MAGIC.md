# Magic towers

The tower registry adds Wizard Monkey, Super Monkey, Ninja Monkey, Alchemist,
Druid and Mermonkey to the existing shop. All 90 upgrade names and prices are
hand-transcribed from the six local wiki tables, with tests checking them against
the source JSON. Simulation code does not parse tower wiki data at runtime.
Mermonkey requires water, as explicitly requested in task 04, and gets its water
range multiplier. Lord of the Abyss permits other water towers on nearby land.

The existing target-coordinate controls also select Darkshift destinations and
place Symphonic Resonance / Final Harmonic totems. Darkshift validates placement
before consuming its cooldown; tier 3 is limited to tower range. Totems have a
six-second placement cooldown; tier 4 placement is limited to tower range.

Implemented abilities: Phoenix / Lava Phoenix, Annihilation, Sabotage,
Transformation (including five nearby allies), Vine Crush, Ice Jet and Darkshift.
No new ability stubs or skipped tests remain. The four pre-existing military
ability skips remain unchanged. Monkey Knowledge and paragons are outside this
batch, including the knowledge-only Vine Rupture ability.

## Explicit approximations

Unspecified numbers and simplified behavior are marked `// uncertain:` in code.

- Temple purchases sacrifice nearby towers, but category-specific sacrifice
  bonuses are unavailable in the supplied wiki and are not modeled.
- Phoenix attacks resolve at target impacts rather than from an orbiting sprite;
  Lava Phoenix meteors use deterministic target selection. No game art is used.
- Lightning balls use periodic target-area pulses; trance uses a stationary hold
  at existing track progress instead of rendering circular movement. Abyss
  tentacles resolve as a range burst instead of eight separate cone animations.
- Fireball explosions resolve immediately. Acid pools use a deterministic path
  location when there is no target, and consume a total five-target budget.
- Concoction uses 10% of unmodified layer HP because the supplied table omits the
  explosion fraction. Darkshift uses a 20-second cooldown where none is supplied.
- Shuriken distraction uses a seeded 30% chance and midpoint blowback distances.
  Critical shot intervals likewise use midpoints of the supplied ranges.
- The supplied Ninja base stats explicitly say `camo: false`; Counter-Espionage
  provides detection in this implementation. Detection and camo removal are
  tested separately, including removal from DDTs without stripping regrow.

## Verification

`npx tsc && npx vitest run && npx vite build` checks all tiers headlessly and
exercises auxiliary attacks, abilities, cooldowns, buffs, placement and determinism.
Browser verification could not run: the sandbox denied binding the preview server
port, and the shared node_modules Vite cache is read-only.
