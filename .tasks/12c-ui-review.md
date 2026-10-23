# Task 12c-ui-review (gpt-6.1-sol lane `ui`, after 12b): fix Opus's browser review of 12a
Same rules and file ownership as .tasks/12a-ui-shell.md. Final message: 5 lines max.
Opus drove the 12a build in headless Chromium at 1280x720 (splash, menu, maps, difficulty, mode, hero, game, place, select, start). Flow works; fix these:
1. Upgrade panel is ~390px wide and covers half the map incl. the track. Make it a narrow column (~260px) like BTD6: portrait+name+pops row, targeting arrows (< First >) on one line, 3 path rows stacked vertically (each: 5 pips, next upgrade name + cost button), Sell at the bottom. It must not cover the selected tower; dock on the side away from it.
2. Paragon controls (investment input + Create button) show for a 0-0-0 Dart Monkey. Show them only when `sim.canMakeParagon(idx)` is true (or a compact "Paragon: needs 5-x-x, x-5-x, x-x-5" hint when the tower has any tier 5).
3. Same rule for every other conditional control (aim, support target, merge, collect): hidden unless the sim says it applies.
4. Splash "Tap to start": the whole screen should accept click/tap/Enter/Space, not only the button.
5. Hero pick: Enter while focus is on Back goes back (fine), but the first hero card should get focus on open so Enter picks it.
6. Add a tiny inline SVG favicon in index.html (two 404 favicon requests in console).
7. Road items must render on their lane: wherever main.ts or src/render draws road items use `sim.posAt(item.dist, item.lane)` (RoadItem has `lane` now).
Keep src/ui/flow.test.ts green; add a test for the panel's control-visibility helper (pure function deciding which controls show for a tower).
