# Meta wiring (task 14b)

`main.ts` owns the loaded profile and settings. Screens receive these values and
callbacks; purchases and successfully applied sim powers save the profile.
Settings reuse the existing audio fieldset: its input handlers update the synth,
and UI handlers mirror volume/music into `settingsSlot()`.

`ui/meta.ts` calculates rewards for completed rounds, starting at the mode's first
round. Map tier and hero name go through `xpForRound`. Win rewards and rank MM
come from `recordGame` and `grantXp`. Endless play tracks the last rewarded round
and does not record the same game twice. Power support is probed using the public
sim API on an empty fixture with track, ground, and water placement points.

At each round boundary, `snapshotSim` saves into `runSlot`. A companion versioned
`mpt.run.ui` slot saves mode, selected hero, and reward bookkeeping, matched by
snapshot timestamp. Continue constructs the same mode and calls `restoreSim` on
a fresh sim; failed restoration leaves the current sim untouched. Terminal results
clear both slots. Apopalypse's automatically started next round is replayed from
the completed round number.

## Existing API limits / requested follow-up

The supplied snapshot/restore API only preserves base towers (kind, position,
tiers, targeting), cash, lives, and round. It does not preserve a placed hero or
hero XP, active powers/traps/units, tower runtime state (banks, cooldowns,
paragons, merges, etc.), or Apopalypse bloons still alive at a round boundary.
Full-fidelity Continue needs a richer snapshot/restore contract from the owning
sim/meta lanes. No sim/meta changes or placeholder effects are introduced here.
A direct supported-power capability query would also replace the placement probe.

Verification: `npx tsc && npx vitest run && npx vite build`.
Browser verification in this sandbox is blocked: dev cache writes return EROFS;
production preview socket binding returns EPERM. Vite also reports its existing
CommonJS configuration warning and a bundle-size warning.
