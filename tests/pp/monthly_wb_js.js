// Runs the prototype's own monthlyWorkbook (sliced from src/app.js) for every state and national on a fixture from stdin; prints the sheet models as JSON.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker not found: ' + a + ' / ' + b); return src.slice(i, j); };
const code = [cut('const DEFAULT_REF = {', 'const ROLE_LABEL'), 'const ROLE_LABEL = {};', cut('const DAY =', 'function locationStatus'),
  cut('const leadsFor', 'const instState'), cut('const pct0 =', 'const fileSafe') + "const fileSafe = t => String(t).replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\\s+/g, ' ').trim();",
  cut('function monthStats', 'function summaryMonths'), cut('/** Share of Red Bull SKUs ranged', 'const deltaTxt'), cut('const ECA =', 'function knownMonths'),
  cut('const compDetailText', 'const compSum'), cut('const compTotal', 'const okPhone'), cut('const XLSX_MINI', 'const boldRow'), 'const boldRow = arr => Object.assign(arr, { __bold: true });',
  cut('function monthlyWorkbook', 'function downloadMonthly'),
  'this.monthlyWorkbook = monthlyWorkbook; this.stateMonthly = stateMonthly; this.nationalMonthly = nationalMonthly; this.DEFAULT_REF = DEFAULT_REF;'].join('\n');
const ctx = { console, TextEncoder, document: { getElementById: () => ({ textContent: '{}' }) } };
vm.createContext(ctx); vm.runInContext(code.replace('const todayISO = () => isoOf(new Date());', ''), ctx);
if (process.argv[2] === 'products') { console.log(JSON.stringify(ctx.DEFAULT_REF.products)); process.exit(0); }
const fx = JSON.parse(fs.readFileSync(0, 'utf8')); ctx.todayISO = () => fx.today;
const s = { ref: { products: ctx.DEFAULT_REF.products, scoring: fx.rules, storeTypes: [] }, locations: fx.locations, people: fx.people, unis: fx.unis, states: fx.states,
  leads: fx.leads, snapshots: [], demo: [], visits: fx.visits.map(v => ({ ...v, response: { ...(v.response || {}), ranging: v.ranging } })) };
const uniBy = Object.fromEntries(s.unis.map(u => [u.code, u]));
const locs = s.locations.map(l => { const u = uniBy[l.uni]; return { ...l, locStatus: l.status, uniName: u?.name || l.uni, state: u?.state, kind: u?.kind }; });
const D = { today: fx.today, liveUnis: s.unis.filter(u => u.status !== 'Removed'), locs, locBy: Object.fromEntries(locs.map(l => [l.id, l])), meP: { name: 'Test User' } };
if (fx.snapshot) s.snapshots = [{ month: fx.month, status: 'Final', rows: fx.snapshot, finalisedAt: '2026-10-02T00:00:00Z' }];
const ser = wb => ({ filename: wb.filename, sheets: wb.sheets.map(sh => ({ ...sh, rows: sh.rows ? sh.rows.map(r => ({ cells: [...r], bold: !!r.__bold })) : undefined })) });
const out = { state: {}, national: null };
for (const st of fx.states.map(z => z.code)) out.state[st] = ser(ctx.monthlyWorkbook(s, D, ctx.stateMonthly(s, D, fx.month, st)));
out.national = ser(ctx.monthlyWorkbook(s, D, ctx.nationalMonthly(s, D, fx.month)));
console.log(JSON.stringify(out, (k, v) => (v === undefined ? null : v)));
