# Support towers and paragons

`src/towers/support.ts` hand-transcribes all 75 support upgrade names, medium prices, and resulting weapon stats from the supplied local wiki files. `src/towers/paragons.ts` registers all 14 non-null paragons in those files. No external assets or data were used.

The shop exposes all five support towers. Select a farm to collect its bananas or bank; clicking near bananas also collects them. Marketplace income is automatic. Bank interest, caps, Central's facility bonus, Central Market's Merchantmen bonus, Wall Street lives and collection, and IMF debt are handled in the simulation. Unproduced or uncollected farm earnings settle once at round end, as requested by this task.

Village range, drums, camo, MIB, primary training, free upgrades, discounts, pop income, production income, and active buffs use shared policies. Purchased tower stats remain unchanged. Shop prices show the lowest available village discount; actual placement charges the price at the selected coordinates. Monkey City awards a free Dart purchase each round. Monkeyopolis requires and absorbs eligible farms, and charges $5,000 per farm without difficulty scaling.

Spike piles, foam and traps are visible road items. Spike lifetime and round carryover are tracked independently. Select upgraded Spike Factories or Engineers to set a track target. Select an Engineer and another tower to choose its buff target; otherwise it buffs the first eligible ally. Select a Beast Handler, a donor and a beast path to merge power. Water beasts require water within 60 units. Each tier-five beast requires three merged tier-four donors of that path.

A paragon requires all three distinct tier-five paths of its own tower kind. Its button absorbs every tower of that kind, charges its wiki price plus optional investment, and creates one degree 1–100 paragon. No second paragon of that kind can be created. Ordinary tier upgrades are disabled afterward.

## Explicit approximations

Code marks uncertain values with `// uncertain:`. The local wiki omits substantial detail:

- Farm collectible timing is spread over 60 seconds, with the remainder settled at round end. Banana Central follows the numeric $6,000 table. Monkeyopolis uses the provided formula despite its ambiguity. Half of subsequent income repays IMF debt; the fraction is absent from the local prose. Monkey Knowledge and co-op variants are excluded.
- Spike Storm deploys its seeded 204 piles immediately instead of scheduling four-pile clusters over two seconds. Mine blasts and round carry use the captured table values; track targeting uses a four-unit grid.
- Engineer sentries resolve their shots as timed impacts, without separate projectile travel. Expert sentry values and the missing Overclock cooldown use original estimates. Trap cash uses captured RBE and round cash tax.
- Beast merge scaling linearly interpolates the supplied ranges. Beast movement, water dragging, bird carrying, and crosspath companion attacks are simplified into timed splash attacks and track displacement. Stomp uses the supplied minimum-power damage and stun values.
- Paragon numbers and degree power are original estimates because most exact stats are absent. Each has a distinct weapon profile and an executable ability; multiple named abilities are represented by a combined ability action. Detailed Magus mana, submarine stance changes, boss-specific interactions, aircraft attack patterns, and full sentry hierarchies are not simulated. Spike paragon mine fragmentation is bounded to one generation. Paragons reject ordinary village buffs, except Ascended Shadow grants global camo detection.

The simulation remains deterministic and DOM-free. `src/support.test.ts` checks all support tiers in headless runs, all paragon purchases and abilities, registry coverage against the wiki, shared buffs, collection and income accounting, prerequisites, persistence and deterministic replay. Existing skipped tests are unchanged. Browser visual verification requires a browser surface, unavailable in this environment.
