// Runs the prototype's own stateMonthly / nationalMonthly (sliced from src/app.js) on a fixture from stdin; prints JSON.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/app.js'), 'utf8');
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker not found: ' + a + ' / ' + b); return src.slice(i, j); };
const code = [cut('const DEFAULT_REF = {', 'const ROLE_LABEL'), 'const ROLE_LABEL = {};', cut('const DAY =', 'function locationStatus'),
  cut('const leadsFor', 'const instState'), cut('const pct0 =', 'const fileSafe'), cut('function monthStats', 'function summaryMonths'),
  cut('/** Share of Red Bull SKUs ranged', 'const deltaTxt'), cut('const ECA =', 'function knownMonths'),
  'this.stateMonthly = stateMonthly; this.nationalMonthly = nationalMonthly; this.DEFAULT_REF = DEFAULT_REF;'].join('\n');
const ctx = { console, document: { getElementById: () => ({ textContent: '{}' }) } };
let today = '2026-10-13';
ctx.todayISO = () => today;
vm.createContext(ctx); vm.runInContext(code.replace('const todayISO = () => isoOf(new Date());', ''), ctx);
const fx = JSON.parse(fs.readFileSync(0, 'utf8')); today = fx.today;
ctx.todayISO = () => today; // curMonth() reads this
const s = { ref: { products: ctx.DEFAULT_REF.products, scoring: fx.rules, storeTypes: [] }, locations: fx.locations, people: fx.people, unis: fx.unis, states: fx.states,
  leads: fx.leads, snapshots: [], demo: [], visits: fx.visits.map(v => ({ ...v, response: { ranging: v.ranging } })) };
const uniBy = Object.fromEntries(s.unis.map(u => [u.code, u]));
const D = { today, liveUnis: s.unis.filter(u => u.status !== 'Removed'),
  locs: s.locations.map(l => { const u = uniBy[l.uni]; return { ...l, locStatus: l.status, uniName: u?.name || l.uni, state: u?.state, kind: u?.kind }; }) };
const slim = x => ({ audits: x.audits, pending: x.pending, excluded: x.excluded, active: x.active, visited: x.visited, coverage: x.coverage, dpAdded: x.dpAdded, dpLost: x.dpLost,
  net: x.net, editions: x.editions, pos: x.pos, coolersIn: x.coolersIn, coolersOut: x.coolersOut, issues: x.issues, auditors: x.auditors, share: x.share, rbFacings: x.rbFacings,
  compFacings: x.compFacings, shelfLocs: x.shelfLocs, ranging: x.ranging, compPos: x.compPos, compCoolers: x.compCoolers, brands: x.ex.brands, present: x.ex.present, locs: x.locs.length });
const top = t => t.map(r => ({ id: r.id, rank: r.rank, total: r.total }));
const out = { state: {}, national: null };
if (fx.mode !== 'national') for (const st of fx.states.map(z => z.code)) {
  const r = ctx.stateMonthly(s, D, fx.month, st);
  out.state[st] = { x: slim(r.x), insts: r.insts.map(i => ({ code: i.u.code, active: i.active, visited: i.visited, coverage: i.coverage, audits: i.audits, net: i.net, editions: i.editions, pos: i.pos })),
    sms: r.sms.map(m => ({ id: m.p.id, audits: m.audits, locations: m.locations, net: m.net, editions: m.editions, pos: m.pos, coolers: m.coolers, last: m.last })),
    top: top(r.top), highlights: r.highlights, to: r.to };
}
const n = ctx.nationalMonthly(s, D, fx.month);
out.national = { x: slim(n.x), states: n.states.map(r => ({ code: r.st.code, audits: r.y.audits, coverage: r.y.coverage, share: r.y.share, sms: r.sms, activeSms: r.activeSms, insts: r.insts, managers: r.managers })),
  top: top(n.top), highlights: n.highlights, to: n.to };
console.log(JSON.stringify(out));
