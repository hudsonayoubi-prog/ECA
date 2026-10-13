// Runs the prototype's own scoreMonth (sliced out of src/app.js) on a fixture read from stdin; prints the result as JSON.
// No browser needed. Used by test_scoring.py to prove the Python port gives the same answers.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker not found: ' + a + ' / ' + b); return src.slice(i, j); };
const code = cut('const DEFAULT_REF = {', 'const ROLE_LABEL') + 'const ROLE_LABEL = {};\n' + cut('const ECA =', 'const snapRows') +
  '\nthis.scoreMonth = scoreMonth; this.DEFAULT_REF = DEFAULT_REF;';
const ctx = { todayISO: () => '2026-10-13', pad: n => String(n).padStart(2, '0'), console };
vm.createContext(ctx); vm.runInContext(code, ctx);
if (process.argv[2] === 'products') { console.log(JSON.stringify(ctx.DEFAULT_REF.products)); process.exit(0); }
const fx = JSON.parse(fs.readFileSync(0, 'utf8'));
const s = { ref: { products: ctx.DEFAULT_REF.products, scoring: fx.rules, storeTypes: [] }, locations: fx.locations,
  people: fx.people, visits: fx.visits.map(v => ({ ...v, response: { ranging: v.ranging } })), demo: [] };
const r = ctx.scoreMonth(s, fx.month);
console.log(JSON.stringify({ rows: r.rows, counted: r.counted.length, pending: r.pending.length, excluded: r.excluded.length, lastUpdated: r.lastUpdated }));
