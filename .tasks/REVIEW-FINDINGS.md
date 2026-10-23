# gpt-6.1-sol review of the heroes+maps+towers merge (commit 432fee7)
Unverified by Opus yet; fix with a failing test first, then re-run the gate. Each line: file:line - bug - fix.

- src/sim.ts:916 - Collected bananas and bank withdrawals bypass incomeMult, allowing income in Deflation - apply incomeMult once when income is generated, before credit/debt repayment.
- src/sim.ts:1363 - roundHero income falls outside the incomeMult calculation - scale hero income and route it through credit().
- src/sim.ts:154 - heroDestroy awards cash despite cashMult=0 and bypasses bloon cash bonuses and loan repayment - use a shared whole-bloon payout helper.
- src/sim.ts:259 - Hook payouts bypass rules.cashMult, bloon cashMult and credit() - route hooked-bloon rewards through the shared payout pipeline.
- src/sim.ts:516 - Trojan bonus bypasses rules.cashMult, awarding cash in Deflation - apply the mode multiplier once before credit().
- src/sim.ts:1124 - Road items hit bloons on other lanes solely because their distances match - store each item's lane and require matching lanes.
- src/sim.ts:1173 - Undead spawned from lane-1 targets attack lane 0 - preserve the target lane on undead and pass it to posAt().
- src/sim.ts:1371 - Clearing all bloons before auto-start takes the preceding completion branch, stopping Apopalypse - also start the next round after completion when auto is enabled and winRound is unmet.
- src/sim.ts:1249 - magicBuffs reapplies ordinary buffs to paragons despite effectiveStats rejecting them - skip hero and magic buffs for paragons.
- src/sim.ts:829 - shopPrice excludes a lone village's own discount and misses Rosalia discounts without villages, disabling affordable purchases - calculate quotes at eligible placement points with the same pricing pipeline.
