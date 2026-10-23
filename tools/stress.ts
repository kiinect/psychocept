// Usage: npx tsx tools/stress.ts [seconds=20] [bloons=1500] [chromebookSlowdown=4]
import { stress } from './checks';

const [sec = 20, n = 1500, slow = 4] = process.argv.slice(2).map(Number);
const r = stress(sec, n);
const BUDGET = 16.67; // ms per frame at 60 fps
// uncertain: Chromebook slowdown vs this machine is a guess (4x = low-end ARM/Celeron class). Pass your own factor.
const proj = r.meanMs * slow, projP95 = r.p95Ms * slow;
console.log(`sim stress: ${n} bloons, ${sec}s (${r.ticks} ticks)`);
console.log(`ms/tick  mean ${r.meanMs.toFixed(3)}  p95 ${r.p95Ms.toFixed(3)}  max ${r.maxMs.toFixed(3)}`);
console.log(`Chromebook projection (x${slow}): mean ${proj.toFixed(2)} ms, p95 ${projP95.toFixed(2)} ms vs ${BUDGET} ms frame budget (sim only; 3x fast-forward needs 3 ticks/frame -> ${(projP95 * 3).toFixed(2)} ms)`);
const ok = projP95 < BUDGET * 0.5;
console.log(ok ? 'PASS: sim p95 uses < 50% of a 60fps frame (leaves room for render)' : 'WARN: sim p95 exceeds 50% of frame budget; consider spatial hash / worker');
process.exitCode = ok ? 0 : 1;
