// Usage: npx tsx tools/sweep.ts   (exit 1 if any tower/tier fails to fire or any round RBE mismatches)
import { sweepTowers, roundRbe, RBE_STRICT_TO } from './checks';

const rows = sweepTowers();
const bad = rows.filter(r => !r.fired);
console.log(`tower sweep: ${rows.length - bad.length}/${rows.length} tower/tier combos purchasable and active`);
for (const r of bad) console.log(`  FAIL ${r.tower} path ${r.path} tier ${r.tier}`);
const strict = roundRbe(RBE_STRICT_TO), badR = strict.filter(r => !r.ok);
console.log(`round RBE 1-${RBE_STRICT_TO}: ${strict.length - badR.length}/${strict.length} match data/wiki/rounds.json`);
for (const r of badR) console.log(`  MISMATCH round ${r.round}: sim ${r.sim} vs wiki ${r.wiki}`);
process.exitCode = bad.length || badR.length ? 1 : 0;
