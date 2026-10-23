# Task 14-meta-wiring (split: Opus = sim powers, gpt-6.1-sol = UI wiring). Agreed API first.
Shared API (Opus builds in src/sim.ts on lane/powers, merged before sol starts 14b):
- `sim.canUsePower(id: string, point?: Pt): boolean` and `sim.usePower(id: string, point?: Pt, upgraded = false): boolean` (id = POWER_BY_ID key from src/meta/powers.ts). Point needed for traps and tower-kind powers; instant/timed ignore it.
- `sim.powerNeedsPoint(id): boolean` so the UI knows whether to enter placement mode.
- Active timed effects visible as `sim.activePowers: { id: string; until: number }[]` (ticks) for HUD badges.
- Powers whose effect is not implemented return false from canUsePower; the UI greys them out.
The sim never touches the profile; the UI decrements inventory via meta `usePower(profile, id)` only when `sim.usePower` returned true.

## 14b (gpt-6.1-sol, lane `ui`, after 12c and after lane/powers merges)
Same rules/ownership as 12a. Wire src/meta into the game:
1. Profile: load `profileSlot()` at boot; main-menu pill shows live rank, XP bar (rankProgress), Monkey Money.
2. End of game: `recordGame` + `grantXp` (xpForRound summed over rounds played, mapDifficulty from map tier index, hero multiplier); Victory/Defeat screens show XP gained, MM gained, rank-up toast with levelUpMM; save the profile.
3. Settings screen (gear on menu and in game): volume/music sliders (wire to src/audio), fast-forward default, autoplay default, show range, reduced motion; persisted via `settingsSlot()`.
4. Powers: menu "Powers" screen to buy with MM (`purchasePower`, show owned counts, grey unimplemented); in-game sidebar "Powers" tab listing owned powers; click -> if `sim.powerNeedsPoint` placement mode else immediate; on success decrement via `usePower` and save.
5. Run save: snapshot with `snapshotSim` into `runSlot()` at each round end; main menu shows "Continue" when a run exists (restoreSim); clear on victory/defeat.
Tests: pure helpers for reward calculation and power-button state.
