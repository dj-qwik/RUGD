// Engine checks for RUGD. Pulls the pure engine out of public/index.html and runs it in Node.
//   node tools/sim.js            # rug odds, chart stats, bot tournament
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const src = html.split('/* ===== ENGINE START ===== */')[1].split('/* ===== ENGINE END ===== */')[0];
const ctx = vm.createContext({ Math, Float64Array });
vm.runInContext(src + '\nthis.RUGD = RUGD;', ctx);
const R = ctx.RUGD;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
const rand = R.rng(12345);

// 1. rug plan odds over a million games
console.log('\nRug plan, 1,000,000 games');
const n = 1e6, byCount = [0, 0, 0, 0], byRound = [0, 0, 0];
for (let i = 0; i < n; i++) { const p = R.rugPlan(rand); const c = p.filter(Boolean).length; byCount[c]++; p.forEach((v, j) => v && byRound[j]++); }
console.log(`  0 rugs ${(byCount[0] / n * 100).toFixed(2)}%  1 rug ${(byCount[1] / n * 100).toFixed(2)}%  2 rugs ${(byCount[2] / n * 100).toFixed(2)}%  3 rugs ${byCount[3]}`);
console.log(`  chance a given round is rugged: ${byRound.map(v => (v / n * 100).toFixed(1) + '%').join(' / ')}`);
check(byCount[3] === 0, 'never rugged all three rounds');
check(byCount[2] / n > 0.03 && byCount[2] / n < 0.05, 'two rugs is rare (~4%)');
check(byCount[1] / n > 0.48 && byCount[1] / n < 0.54, 'one rug is the most common outcome (~51%)');

// 2. chart behaviour
console.log('\nPrice paths, 5,000 rounds');
const ranges = [], finals = [], rugSecs = [];
let bad = 0;
for (let s = 1; s <= 5000; s++) {
  const p = R.pricePath(s * 7919);
  let mn = Infinity, mx = 0; for (const v of p) { if (!(v > 0) || !isFinite(v)) bad++; mn = Math.min(mn, v); mx = Math.max(mx, v); }
  ranges.push(mx / mn); finals.push(p[R.ROUND_TICKS]);
  rugSecs.push(R.pickRugTick(p, rand) / 20);
}
const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
const q = (a, f) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)];
console.log(`  high/low ratio per round: median ${med(ranges).toFixed(2)}x, 10th pct ${q(ranges, 0.1).toFixed(2)}x, 90th pct ${q(ranges, 0.9).toFixed(2)}x`);
console.log(`  closing price vs launch: median ${med(finals).toFixed(2)}x, ${(finals.filter(v => v > 1).length / 50).toFixed(1)}% close above launch`);
const hist = [0, 0, 0, 0, 0]; rugSecs.forEach(s => hist[Math.min(4, Math.floor((s - 7) / 4.4))]++);
console.log(`  rug time (s): 7-11 ${hist[0]}  11-16 ${hist[1]}  16-20 ${hist[2]}  20-24 ${hist[3]}  24-28.5 ${hist[4]}`);
check(bad === 0, 'no NaN / zero / negative prices');
check(Math.min(...rugSecs) >= 7 && Math.max(...rugSecs) <= 28.5, 'rugs land between 7 s and 28.5 s');
check(med(ranges) > 2 && med(ranges) < 12, 'charts swing hard but not absurdly');

// 3. bot tournament with real rug plans
console.log('\nBot tournament, 3,000 games x 10 bots');
const stats = {};
R.STYLES.forEach(s => { stats[s] = { pnl: 0, n: 0, rugged: 0, trades: 0 }; });
let nan = 0;
for (let g = 0; g < 3000; g++) {
  const plan = R.rugPlan(rand);
  const ps = Array.from({ length: 10 }, (_, i) => R.player('b' + i, 'b' + i, '#fff', R.makeBot(rand, R.STYLES[i % R.STYLES.length])));
  for (let rn = 0; rn < 3; rn++) {
    const path = R.pricePath((rand() * 2 ** 32) >>> 0), rug = plan[rn] ? R.pickRugTick(path, rand) : -1;
    ps.forEach(p => { R.resetRound(p); R.resetBot(p.bot, rand); });
    let end = R.ROUND_TICKS;
    for (let k = 1; k <= R.ROUND_TICKS; k++) {
      if (rug >= 0 && k >= rug) { end = k; break; }
      for (const p of ps) { const d = R.botStep(p, path, k, rand); if (d === 'b') R.buy(p, path[k], k); else if (d === 's') R.sell(p, path[k], k); }
    }
    for (const p of ps) {
      if (p.coins > 0) { if (rug >= 0) { p.coins = 0; p.rugged = true; } else R.sell(p, path[end], end); }
      const r = p.cash - R.START_CASH; if (!isFinite(r)) nan++;
      const s = stats[p.bot.style]; s.pnl += r; s.n++; s.rugged += p.rugged ? 1 : 0; s.trades += p.trades.length;
    }
  }
}
for (const [k, s] of Object.entries(stats)) console.log(`  ${k.padEnd(9)} avg round P&L ${(s.pnl / s.n).toFixed(1).padStart(7)}  rugged in ${(s.rugged / s.n * 100).toFixed(1).padStart(5)}% of rounds  ${(s.trades / s.n).toFixed(1)} trades/round`);
check(nan === 0, 'no NaN scores');

// 4. a do-nothing player and a buy-at-launch-hold player, for reference
let hold = 0, holdN = 0;
for (let g = 0; g < 20000; g++) { const plan = R.rugPlan(rand); for (let rn = 0; rn < 3; rn++) { const p = R.pricePath((rand() * 2 ** 32) >>> 0); hold += plan[rn] ? -1000 : 1000 * (1 - R.FEE) ** 2 * p[R.ROUND_TICKS] - 1000; holdN++; } }
console.log(`\nReference: buying at launch and holding averages ${(hold / holdN).toFixed(1)} per round (sitting in cash = 0)`);

console.log(fails ? `\n${fails} check(s) FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
