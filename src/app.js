/* Education Channel Audit Tool (ECA) — prototype. UI, business logic and data access are separated below. */
const { useState, useMemo, useEffect, useReducer, useRef, createContext, useContext } = React;
/* htm → React adapter: lets markup use plain HTML/SVG attribute names and style strings */
const ATTR = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', inputmode: 'inputMode', crossorigin: 'crossOrigin', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', novalidate: 'noValidate' };
const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const styleObj = str => Object.fromEntries(String(str).split(';').map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf(':'); const k = x.slice(0, i).trim(); return [k.startsWith('--') ? k : camel(k), x.slice(i + 1).trim()]; }));
function h(type, props, ...children) {
  if (props) {
    const out = {};
    for (const k in props) {
      let v = props[k], key = ATTR[k] || k;
      if (k === 'style' && typeof v === 'string') v = styleObj(v);
      else if (!k.startsWith('data-') && !k.startsWith('aria-') && k.includes('-')) key = camel(k);
      out[key] = v;
    }
    props = out;
  }
  return React.createElement(type, props, ...children);
}
const html = htm.bind(h);

/* ======================= CONFIG / REFERENCE VALUES (no hard-coded lists in UI) ======================= */
const DEFAULT_REF = {
  products: [
    { key: 'ed', label: 'Energy Drink', short: 'ED', qsr: true, vending: true },
    { key: 'sf', label: 'Sugarfree', short: 'SF', qsr: true, vending: true },
    { key: 'zero', label: 'Zero', short: 'Zero', qsr: true, vending: true },
    { key: 'editions', label: 'Editions', short: 'Editions', qsr: true, vending: true },
    { key: 'monster', label: 'Monster', short: 'Monster', qsr: true, vending: true, competitor: true },
    { key: 'monsterUltra', label: 'Monster Ultra', short: 'M. Ultra', qsr: true, vending: false, competitor: true },
    { key: 'v', label: 'V', short: 'V', qsr: true, vending: true, competitor: true },
    { key: 'vsf', label: 'V Sugarfree', short: 'V SF', qsr: true, vending: false, competitor: true },
    { key: 'vblue', label: 'V Blue', short: 'V Blue', qsr: true, vending: false, competitor: true },
    { key: 'solo', label: 'Solo Energy', short: 'Solo', qsr: true, vending: false, competitor: true },
  ],
  visitStatuses: ['Completed', 'Scheduled', 'Cancelled'],
  posTypes: ['Price tag', 'Wobbler', 'Poster', 'Shelf strip', 'Fridge decal', 'Counter unit', 'Menu board', 'Vending decal', 'Other'],
  competitors: ['Monster', 'V', 'Solo Energy', 'Rockstar', 'Celsius', 'None'],
  contactRoles: ['Owner', 'Manager', 'Assistant manager', 'Supervisor', 'Buyer / purchasing', 'Staff member', 'Other'],
  channels: ['OnP', 'OffP'], classifications: ['A', 'B', 'C', 'D'], bull: ['EYE', 'RING'], indNka: ['IND', 'NKA', 'Vending'],
  vendingCompanies: ['AltaVend', 'Coke Vending', 'M&M', 'Melbourne Vending Co.', 'Provender', 'Snack Savy', 'Vendy', 'Other'],
  removalReasons: ['Closed permanently', 'No longer stocks Red Bull', 'Duplicate entry', 'Moved or renamed', 'Not accessible to staff', 'Other'],
  defaultCycle: 14, dueSoonDays: 3, reminderLeadDays: 3, notifyOverdue: true, dailySummaryTime: '18:00',
  storeTypes: ['QSR', 'Vending', 'Student Bar', 'Convenience', 'NKA'].map(name => ({ name, active: true })),
  scoring: { weights: { ranging: 30, tdp: 25, editions: 20, pos: 15, coolers: 10 }, method: 'relative', targets: { tdp: 12, editions: 8, pos: 10, coolers: 2 }, minAudits: 3 },
  approvalMode: 'manager', adminPin: '2468',
  results: { groups: { leads: true, admins: true, sms: true }, extra: [], method: 'Email and in-app', businessDay: 3,
    template: 'Congratulations to {first}, {second} and {third}, the {month} podium. Thanks to all {ranked} ranked Student Marketeers for the work on campus this month.' },
};
const ROLE_LABEL = { admin: 'Administrator', manager: 'Manager', marketeer: 'Student Marketeer' };
const DEFAULT_STATES = [
  { code: 'VIC', name: 'Victoria' }, { code: 'NSW', name: 'New South Wales' }, { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' }, { code: 'WA', name: 'Western Australia' },
];
// People named in the requirements brief. Student Marketeers outside VIC are waiting on the supplied lists.
const ADMINS = ['Keane Vivas', 'Sarah Stirling', 'Holiday Chen', 'Zane Hudson', 'Hudson Ayoubi', 'Jarrod Smith', 'Jon McCarthy', 'Lyndon Hutton', 'Lee Imperatrice', 'Connor Mahon', 'Sophie Ness', 'Eilish Hargen', 'Nicholas Perman', 'Rachel Sullivan', 'Georgia Merret', 'Makenzie Grant'];
const MANAGERS = { VIC: ['Phillip Petinella', 'Abi James', 'Patrick Blew', 'Josh Blew', 'Hannah Perry'], NSW: ['Jonathan Chalouhi', 'Anthony Alam', 'Charlotte Terrell', 'Alex Kinloch'], QLD: ['Molly Kenworthy', 'Georgia Bakagiannis', 'Bronte Stock'], SA: ['Teneisha Clarisse', 'Adam Mizzi'], WA: ['Justin Majeks', 'Anna Minissale'] };
// Student Marketeer rosters supplied by state (reportsTo = their Manager)
const SM_ROSTERS = [
  { state: 'NSW', reportsTo: 'Charlotte Terrell', names: ['Brooke Kildey', 'Christopher Salem', 'Dana Farfan', 'Eliza La Greca', 'Eva Charles', 'Grace Dawson', 'Harry Hadley', 'Hugo Paddon-Row', 'Jack Montague', 'James Whiteing', 'Kalipso Nathanael', 'Katya Slavin', 'Lucinda Whybrow', 'Oliver Boyd', 'Renee Christison', 'Shelley Morton', 'Talia Rossi', 'Thomas Kuminek'] },
  { state: 'NSW', reportsTo: 'Jonathan Chalouhi', names: ['Charlotte Bagnall', 'Georgia McQuillan', 'Jonathan Shabaya', 'Sachman Maini', 'Sarah Bartolo', 'Tamsyn Rose', 'Xanthe Tamayo', 'Yashmin Bucao', 'Zoe Smith'] },
  { state: 'QLD', reportsTo: 'Molly Kenworthy', names: ['Celina Squire', 'Jadene de Lima', 'Joshua Lai', 'Kaitlyn Knowles', 'Lachlan McBain', 'Liam Crispe', 'Summer Toole', 'Violet Fahy'] },
  { state: 'QLD', reportsTo: 'Georgia Bakagiannis', names: ['Caytlan Stephensen', 'Ella Lancini', 'Lachlan Gomersall', 'Lily Lattanzi', 'Pieter Swart', 'Sydney Elder', 'Tyler Dimock', 'William Horton'] },
  { state: 'SA', reportsTo: 'Teneisha Clarisse', names: ['Alex Holt', 'Caydence Bussenschutt', 'Chloe Salvemini', 'Hugh Black', 'Isabella Drew', 'Jacob Mackenzie', 'Lan Pham-Ellickson', 'Olivia Thompson', 'Sophie Wigg', 'William Torode'] },
  { state: 'WA', reportsTo: 'Anna Minissale', names: ['Amy Ward', 'Anna Pedersen', 'Cameron Cassie', 'Claudia Biddeloo', 'Keira Clements', 'Lachlan Lamb', 'Meg Kimpton', 'Mitch Miller', 'Ruthie Ong'] },
];
// Universities added by state beyond the VIC workbook (added to saved data on load if missing)
const EXTRA_UNIS = [
  { code: 'UWA', name: 'The University of Western Australia', short: 'UWA', campuses: ['Crawley'], state: 'WA' },
  { code: 'CUR', name: 'Curtin University', short: 'Curtin', campuses: ['Bentley'], state: 'WA' },
  { code: 'ECU', name: 'Edith Cowan University', short: 'ECU', campuses: ['Joondalup', 'Mount Lawley'], state: 'WA' },
  { code: 'MUR', name: 'Murdoch University', short: 'Murdoch', campuses: ['Perth (Murdoch)'], state: 'WA' },
  { code: 'UNDA', name: 'The University of Notre Dame Australia', short: 'Notre Dame', campuses: ['Fremantle'], state: 'WA' },
  // NSW
  { code: 'USYD', name: 'The University of Sydney', short: 'USYD', campuses: ['Camperdown/Darlington'], state: 'NSW' },
  { code: 'UNSW', name: 'UNSW Sydney', short: 'UNSW', campuses: ['Kensington', 'Paddington'], state: 'NSW' },
  { code: 'UTS', name: 'University of Technology Sydney', short: 'UTS', campuses: ['City (Broadway)'], state: 'NSW' },
  { code: 'MQ', name: 'Macquarie University', short: 'Macquarie', campuses: ['Macquarie Park'], state: 'NSW' },
  { code: 'WSU', name: 'Western Sydney University', short: 'WSU', campuses: ['Parramatta', 'Penrith', 'Campbelltown', 'Bankstown', 'Liverpool', 'Hawkesbury'], state: 'NSW' },
  { code: 'ACUN', name: 'Australian Catholic University (NSW)', short: 'ACU NSW', campuses: ['North Sydney', 'Strathfield', 'Blacktown'], state: 'NSW' },
  { code: 'UNDS', name: 'The University of Notre Dame Australia (Sydney)', short: 'Notre Dame Sydney', campuses: ['Broadway', 'Darlinghurst'], state: 'NSW' },
  { code: 'UOW', name: 'University of Wollongong', short: 'UOW', campuses: ['Wollongong'], state: 'NSW' },
  { code: 'UON', name: 'University of Newcastle', short: 'Newcastle', campuses: ['Callaghan', 'Newcastle City'], state: 'NSW' },
  { code: 'CSU', name: 'Charles Sturt University', short: 'CSU', campuses: ['Bathurst', 'Wagga Wagga', 'Albury-Wodonga', 'Port Macquarie'], state: 'NSW' },
  { code: 'SCU', name: 'Southern Cross University', short: 'SCU', campuses: ['Lismore', 'Coffs Harbour'], state: 'NSW' },
  { code: 'UNE', name: 'University of New England', short: 'UNE', campuses: ['Armidale'], state: 'NSW' },
  // QLD
  { code: 'UQ', name: 'The University of Queensland', short: 'UQ', campuses: ['St Lucia', 'Herston', 'Gatton'], state: 'QLD' },
  { code: 'QUT', name: 'Queensland University of Technology', short: 'QUT', campuses: ['Gardens Point', 'Kelvin Grove'], state: 'QLD' },
  { code: 'GU', name: 'Griffith University', short: 'Griffith', campuses: ['Gold Coast', 'Nathan', 'Mt Gravatt', 'South Bank', 'Logan'], state: 'QLD' },
  { code: 'BOND', name: 'Bond University', short: 'Bond', campuses: ['Robina'], state: 'QLD' },
  { code: 'ACUQ', name: 'Australian Catholic University (QLD)', short: 'ACU Brisbane', campuses: ['Banyo'], state: 'QLD' },
  { code: 'UNISC', name: 'University of the Sunshine Coast', short: 'UniSC', campuses: ['Sippy Downs', 'Moreton Bay'], state: 'QLD' },
  { code: 'UNISQ', name: 'University of Southern Queensland', short: 'UniSQ', campuses: ['Toowoomba', 'Springfield', 'Ipswich'], state: 'QLD' },
  { code: 'JCU', name: 'James Cook University', short: 'JCU', campuses: ['Townsville', 'Cairns'], state: 'QLD' },
  { code: 'CQU', name: 'CQUniversity', short: 'CQU', campuses: ['Rockhampton', 'Brisbane', 'Mackay'], state: 'QLD' },
  { code: 'SCUG', name: 'Southern Cross University (Gold Coast)', short: 'SCU Gold Coast', campuses: ['Gold Coast (Coolangatta)'], state: 'QLD' },
  // SA (Adelaide University = University of Adelaide + UniSA merged, from 2026)
  { code: 'ADU', name: 'Adelaide University', short: 'Adelaide Uni', campuses: ['City (North Terrace)', 'City East', 'City West', 'Magill', 'Mawson Lakes', 'Waite', 'Roseworthy', 'Whyalla', 'Mount Gambier'], state: 'SA' },
  { code: 'FLI', name: 'Flinders University', short: 'Flinders', campuses: ['Bedford Park', 'Tonsley', 'Victoria Square (City)'], state: 'SA' },
  { code: 'TUA', name: 'Torrens University Australia (Adelaide)', short: 'Torrens Adelaide', campuses: ['Adelaide City'], state: 'SA' },
  // TAFEs
  ...[
    // VIC
    { code: 'MPOLY', name: 'Melbourne Polytechnic', short: 'Melbourne Polytechnic', campuses: ['Preston', 'Collingwood', 'Heidelberg', 'Epping', 'Fairfield', 'Prahran'], state: 'VIC' },
    { code: 'BHI', name: 'Box Hill Institute', short: 'Box Hill Institute', campuses: ['Box Hill (Elgar)', 'Box Hill (Nelson)', 'Lilydale', 'Melbourne City'], state: 'VIC' },
    { code: 'HOLM', name: 'Holmesglen Institute', short: 'Holmesglen', campuses: ['Chadstone', 'Glen Waverley', 'Moorabbin'], state: 'VIC' },
    { code: 'KANG', name: 'Kangan Institute', short: 'Kangan', campuses: ['Broadmeadows', 'Docklands', 'Richmond', 'Moonee Ponds', 'Cremorne'], state: 'VIC' },
    { code: 'BTAFE', name: 'Bendigo TAFE', short: 'Bendigo TAFE', campuses: ['Bendigo City', 'Charles Street', 'Castlemaine', 'Echuca'], state: 'VIC' },
    { code: 'CHIS', name: 'Chisholm Institute', short: 'Chisholm', campuses: ['Dandenong', 'Frankston', 'Berwick', 'Cranbourne', 'Mornington Peninsula'], state: 'VIC' },
    { code: 'WAI', name: 'William Angliss Institute', short: 'William Angliss', campuses: ['Melbourne City'], state: 'VIC' },
    { code: 'GORD', name: 'The Gordon', short: 'The Gordon', campuses: ['Geelong City', 'East Geelong', 'Werribee'], state: 'VIC' },
    { code: 'SWTAFE', name: 'South West TAFE', short: 'South West TAFE', campuses: ['Warrnambool', 'Hamilton', 'Portland'], state: 'VIC' },
    { code: 'TGIPP', name: 'TAFE Gippsland', short: 'TAFE Gippsland', campuses: ['Morwell', 'Sale', 'Bairnsdale', 'Leongatha'], state: 'VIC' },
    { code: 'GOTAFE', name: 'GOTAFE', short: 'GOTAFE', campuses: ['Shepparton', 'Wangaratta', 'Benalla', 'Seymour'], state: 'VIC' },
    { code: 'WODT', name: 'Wodonga TAFE', short: 'Wodonga TAFE', campuses: ['Wodonga'], state: 'VIC' },
    { code: 'SUNI', name: 'SuniTAFE', short: 'SuniTAFE', campuses: ['Mildura', 'Swan Hill'], state: 'VIC' },
    // NSW
    { code: 'TNSW', name: 'TAFE NSW', short: 'TAFE NSW', campuses: ['Ultimo', 'Randwick', 'Meadowbank', 'Ryde', 'Hornsby', 'Northern Beaches', 'St Leonards', 'Granville', 'Bankstown', 'Liverpool', 'Campbelltown', 'Kingswood', 'Blacktown', 'Newcastle', 'Hamilton', 'Wollongong', 'Gosford'], state: 'NSW' },
    // QLD
    { code: 'TQLD', name: 'TAFE Queensland', short: 'TAFE Queensland', campuses: ['South Bank', 'Eagle Farm', 'Mount Gravatt', 'Loganlea', 'Redcliffe', 'Acacia Ridge (SkillsTech)', 'Southport', 'Coomera', 'Ashmore', 'Mooloolaba', 'Ipswich', 'Toowoomba', 'Townsville (Pimlico)', 'Cairns'], state: 'QLD' },
    // SA
    { code: 'TSA', name: 'TAFE SA', short: 'TAFE SA', campuses: ['Adelaide City', 'Regency Park', 'Tonsley', 'Elizabeth', 'Salisbury', 'Noarlunga', 'Mount Barker', 'Mount Gambier', 'Whyalla', 'Port Augusta'], state: 'SA' },
    // WA
    { code: 'NMT', name: 'North Metropolitan TAFE', short: 'North Metro TAFE', campuses: ['Perth', 'East Perth', 'Leederville', 'Joondalup', 'Midland', 'Balga', 'Clarkson'], state: 'WA' },
    { code: 'SMT', name: 'South Metropolitan TAFE', short: 'South Metro TAFE', campuses: ['Bentley', 'Fremantle', 'Murdoch', 'Rockingham', 'Thornlie', 'Carlisle', 'Jandakot'], state: 'WA' },
    { code: 'SRT', name: 'South Regional TAFE', short: 'South Regional TAFE', campuses: ['Bunbury', 'Albany', 'Busselton'], state: 'WA' },
    { code: 'CRT', name: 'Central Regional TAFE', short: 'Central Regional TAFE', campuses: ['Geraldton', 'Northam', 'Kalgoorlie'], state: 'WA' },
    { code: 'NRT', name: 'North Regional TAFE', short: 'North Regional TAFE', campuses: ['Broome', 'Karratha', 'Port Hedland'], state: 'WA' },
  ].map(t => ({ ...t, kind: 'TAFE' })),
].map(u => ({ kind: 'University', ...u, status: 'Active', note: null }));
const LEADS = { VIC: ['Keane Vivas'], QLD: ['Holiday Chen'], WA: ['Rachel Sullivan', 'Georgia Merret'], NSW: ['Makenzie Grant', 'Sophie Ness'], SA: ['Connor Mahon'] };
const STATUS = {
  'On Track': { tone: 'good', icon: 'check', order: 4 },
  'Due Soon': { tone: 'warn', icon: 'clock', order: 2 },
  'Overdue': { tone: 'bad', icon: 'alert', order: 1 },
  'No Visit Recorded': { tone: 'none', icon: 'circle', order: 3 },
  'Inactive': { tone: 'muted', icon: 'minus', order: 5 },
};
const STATUS_KEYS = ['On Track', 'Due Soon', 'Overdue', 'No Visit Recorded'];
const SEED = JSON.parse(document.getElementById('seed').textContent);
const STORE_KEY = 'edu-audit-national-v2';
const NAME_FIXES = { 'Mill Burgess': 'Milla Burgess' };
const ROSTER_REV = 5; // bump when a supplied roster changes who someone reports to

/* ======================= DATE + STATUS LOGIC (pure) ======================= */
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseISO = s => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d); };
const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / DAY);
const fmtDate = s => (s ? parseISO(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtShort = s => (s ? parseISO(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—');
const money = v => (v === null || v === undefined || v === '' || isNaN(+v) ? '—' : '$' + (+v).toFixed(2));
const signed = n => (n > 0 ? '+' + n : String(n));

/** Status rules exactly as the workbook: Completed visits only; due = (last completed || date added) + cycle. */
function locationStatus(loc, completedDates, ref, today) {
  const last = completedDates.length ? completedDates.reduce((a, b) => (a > b ? a : b)) : null;
  const base = last || loc.added;
  const cycle = +loc.cycle || ref.defaultCycle;
  const due = base ? addDays(base, cycle) : null;
  const days = due ? diffDays(due, today) : null;
  let status;
  if (loc.status !== 'Active') status = 'Inactive';
  else if (!last) status = 'No Visit Recorded';
  else if (due < today) status = 'Overdue';
  else if (days <= ref.dueSoonDays) status = 'Due Soon';
  else status = 'On Track';
  return { last, due, days, status };
}
function rangeStart(range, today) {
  if (range === 'all') return '0000-01-01';
  if (range === 'month') return today.slice(0, 8) + '01';
  return addDays(today, -({ '14': 13, '30': 29, '90': 89 }[range] ?? 13));
}
const RANGES = [['14', 'Last 14 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['90', 'Last 90 days'], ['all', 'All time']];

/* ======================= DATA ACCESS (prototype: browser storage; production: Dataverse) ======================= */
const DataService = {
  load() { try { const raw = localStorage.getItem(STORE_KEY); if (raw) return JSON.parse(raw); } catch (e) { } return null; },
  save(state) { try { const { toast, notifOpen, modal, sync, sharedLoaded, ...persist } = state; localStorage.setItem(STORE_KEY, JSON.stringify(persist)); } catch (e) { } },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch (e) { } },
};
function seedPeople() {
  const p = []; let i = 1;
  const add = (name, role, state, reportsTo) => p.push({ id: 'p-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, role, state, status: 'Active', reportsTo: reportsTo || null });
  ADMINS.forEach(n => add(n, 'admin', null));
  Object.entries(MANAGERS).forEach(([st, ns]) => ns.forEach(n => add(n, 'manager', st)));
  // Workbook staff become VIC Student Marketeers (Abi James is a VIC Manager per the brief).
  [...new Set(SEED.allocations.map(a => a.staff))].filter(n => !p.some(x => x.name === n)).sort().forEach(n => add(n, 'marketeer', 'VIC'));
  SM_ROSTERS.forEach(r => r.names.filter(n => !p.some(x => x.name === n)).forEach(n => add(n, 'marketeer', r.state, r.reportsTo)));
  return p;
}
function seedState() {
  const st = {
    states: DEFAULT_STATES,
    unis: SEED.unis.map(u => ({ ...u, state: 'VIC', kind: 'University', status: 'Active', note: u.code === 'UTAS' ? 'Placed under VIC until Tasmania is set up' : null })).concat(EXTRA_UNIS),
    locations: SEED.locations.map(l => ({ ...l })), visits: SEED.visits.map(v => ({ ...v })),
    people: seedPeople(), leads: LEADS, ref: DEFAULT_REF,
    rosterRev: ROSTER_REV, me: 'Hudson Ayoubi', meId: null, authed: false, elevatedUntil: 0, drafts: [], log: [], requests: [], notifications: [], readKeys: {},
    demo: [], snapshots: [], logins: [], lastMonth: curMonth(), ecaRev: 3,
    route: { page: 'dashboard' }, toast: null, notifOpen: false, modal: null,
  };
  { const lb = Object.fromEntries(st.locations.map(l => [l.id, l])); st.demo = seedDemo(st.locations).map(v => demoFacings(v, lb[v.loc])); } st.snapshots = seedSnapshots(st);
  return st;
}

/* ======================= STATE ======================= */
const leadsFor = (s, st) => (s.leads[st] || []).filter(n => s.people.some(p => p.name === n && p.status === 'Active'));
const managersFor = (s, st) => s.people.filter(p => p.role === 'manager' && p.state === st && p.status === 'Active').map(p => p.name);
const instState = (s, code) => s.unis.find(u => u.code === code)?.state;
function notify(s, n) { return [{ id: 'N' + Date.now() + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), ...n }, ...s.notifications].slice(0, 400); }
function reducer(s, a) {
  const stamp = (action, target, detail, extra = {}) => [{ ts: new Date().toISOString(), user: s.me, action, target, detail, ...extra }, ...s.log].slice(0, 3000);
  switch (a.type) {
    case 'nav': return { ...s, route: a.route, notifOpen: false };
    case 'toast': return { ...s, toast: a.msg };
    case 'modal': return { ...s, modal: a.modal };
    case 'notifOpen': return { ...s, notifOpen: a.open };
    case 'me': return { ...s, me: a.name, route: { page: 'dashboard' } };
    case 'ref': return { ...s, ref: { ...s.ref, ...a.ref }, log: stamp('Changed settings', 'Settings', Object.keys(a.ref).join(', '), { cat: 'Settings', from: Object.keys(a.ref).map(k => `${k}: ${JSON.stringify(s.ref[k])}`).join('; ').slice(0, 200), to: Object.keys(a.ref).map(k => `${k}: ${JSON.stringify(a.ref[k])}`).join('; ').slice(0, 200) }) };
    case 'read': return { ...s, readKeys: { ...s.readKeys, ...Object.fromEntries(a.keys.map(k => [k + '|' + s.me, 1])) } };
    case 'saveDraft': return { ...s, drafts: [{ ...a.draft, owner: s.me, savedAt: new Date().toISOString() }, ...s.drafts.filter(d => d.draftId !== a.draft.draftId)] };
    case 'deleteDraft': return { ...s, drafts: s.drafts.filter(d => d.draftId !== a.draftId) };
    case 'submitVisit': {
      const f = a.form; const isEdit = !!f.editingId;
      const nextNum = s.visits.filter(v => v.uni === f.uni).reduce((m, v) => Math.max(m, +(String(v.id).split('-V')[1] || 0)), 0) + 1;
      const id = isEdit ? f.editingId : `${f.uni}-V${String(nextNum).padStart(4, '0')}-${Math.random().toString(36).slice(2, 6)}`;
      const visit = {
        id, uni: f.uni, loc: f.loc, date: f.date.slice(0, 10), time: f.date.slice(11, 16), staff: f.staff, status: f.status,
        notes: f.notes, nextStep: f.nextStep, followUp: f.followUp || null, issue: f.issue ? f.issueNote || 'Issue flagged' : null,
        dpAdded: +f.dpAdded || 0, dpLost: +f.dpLost || 0, editions: +f.editions || 0, flavours: f.flavours, posPlaced: +f.posPlaced || 0,
        posType: f.posType, coolersIn: +f.coolersIn || 0, coolersOut: +f.coolersOut || 0, photos: (f.photos || []).length,
        rbFacings: f.status === 'Completed' ? +f.rbFacings || 0 : null, compFacings: f.status === 'Completed' ? Object.fromEntries(Object.entries(f.compFacings || {}).map(([c, n]) => [c, +n || 0])) : null,
        compDetail: f.status === 'Completed' ? normCompDetail(f) : null, compPos: f.status === 'Completed' ? compSum(normCompDetail(f), 'pos') : null, compCoolers: f.status === 'Completed' ? compSum(normCompDetail(f), 'coolers') : null,
        contactName: (f.contactName || '').trim() || null, contactRole: f.contactRole || null,
        response: f.status === 'Completed' ? { ranging: f.ranging, price: f.price, comp: f.comp, compPrice: f.compPrice, pos: f.pos, cooler: f.cooler, bull: f.bull, channel: f.channel, classification: f.classification, vendCo: f.vendCo, machineId: f.machineId, vSku: f.vSku, vPrice: f.vPrice, mSku: f.mSku, mPrice: f.mPrice } : null,
        submittedAt: new Date().toISOString(), submittedBy: s.me,
        staffId: (s.people.find(p => p.id === s.meId && p.name === f.staff) || s.people.find(p => p.name === f.staff))?.id || null,
      };
      const prevV = isEdit ? s.visits.find(v => v.id === id) : null;
      const byMgr = s.people.find(p => p.name === s.me)?.role !== 'marketeer';
      visit.approval = f.status !== 'Completed' ? null : s.ref.approvalMode === 'auto' ? 'Approved' : (isEdit && byMgr && prevV ? approvalOf(prevV) : 'Pending');
      if (visit.approval === 'Approved' && !(isEdit && prevV?.approvedAt)) { visit.approvedBy = 'Counted on submit'; visit.approvedAt = visit.submittedAt; }
      if (visit.approval === 'Pending') { visit.approvedBy = null; visit.approvedAt = null; }
      const visits = isEdit ? s.visits.map(v => (v.id === id ? { ...v, ...visit } : v)) : [...s.visits, visit];
      let locations = s.locations;
      if (f.status === 'Completed') {
        locations = s.locations.map(l => l.id !== f.loc ? l : {
          ...l, ranging: { ...l.ranging, ...f.ranging }, price: f.price === '' ? l.price : +f.price, topComp: f.comp || l.topComp,
          compPrice: f.compPrice === '' ? l.compPrice : +f.compPrice, pos: f.pos ?? l.pos, cooler: f.cooler ?? l.cooler, bull: f.bull || l.bull,
          channel: f.channel || l.channel, classification: f.classification || l.classification, vendCo: f.vendCo || l.vendCo, machineId: f.machineId || l.machineId,
          vSku: f.vSku || l.vSku, vPrice: f.vPrice || l.vPrice, mSku: f.mSku || l.mSku, mPrice: f.mPrice || l.mPrice, notes: f.nextStep || l.notes,
          rbFacings: +f.rbFacings || 0, compFacings: Object.fromEntries(Object.entries(f.compFacings || {}).map(([c, n]) => [c, +n || 0])), facingComps: Object.keys(f.compFacings || {}), compDetail: normCompDetail(f), facingsAt: f.date.slice(0, 10),
        });
      }
      if ((f.contactName || '').trim()) {
        locations = locations.map(l => l.id !== f.loc ? l : { ...l, contactName: f.contactName.trim(), contactRole: f.contactRole || l.contactRole || null,
          contactPhone: (f.contactPhone || '').trim() || l.contactPhone || null, contactEmail: (f.contactEmail || '').trim() || l.contactEmail || null, contactAt: f.date.slice(0, 10), contactBy: f.staff });
      }
      let notifications = s.notifications;
      if (!isEdit && f.status === 'Completed') {
        const st = instState(s, f.uni); const loc = s.locations.find(l => l.id === f.loc); const inst = s.unis.find(u => u.code === f.uni);
        notifications = notify({ notifications }, { kind: 'audit', to: managersFor(s, st), state: st, title: `${f.staff} completed an audit`, body: `${loc?.name} · ${inst?.name}${visit.dpAdded || visit.dpLost ? ` · net DPs ${visit.dpAdded - visit.dpLost >= 0 ? '+' : ''}${visit.dpAdded - visit.dpLost}` : ''}${visit.issue ? ' · issue flagged' : ''}`, ref: { page: 'loc', id: f.loc }, email: true });
      }
      const corr = isEdit && monthStatus(s, visit.date.slice(0, 7)) === 'Final';
      const sumOut = v => v ? `TDP +${v.dpAdded} · Editions ${v.editions} · POS ${v.posPlaced} · Coolers +${v.coolersIn}` : null;
      return { ...s, visits, locations, notifications, drafts: s.drafts.filter(d => d.draftId !== f.draftId),
        log: stamp(corr ? 'Correction after finalisation' : isEdit ? 'Edited visit' : `Submitted ${f.status.toLowerCase()} visit`, id, `${f.loc}${f.reason ? ' · ' + f.reason : ''}`, { cat: corr ? 'Correction' : 'Activity', from: sumOut(prevV), to: isEdit ? sumOut(visit) : null }) };
    }
    case 'saveLocation': {
      const exists = s.locations.some(l => l.id === a.loc.id);
      return { ...s, locations: exists ? s.locations.map(l => (l.id === a.loc.id ? { ...l, ...a.loc } : l)) : [...s.locations, a.loc], log: stamp(exists ? 'Edited location' : 'Added location', a.loc.id, a.loc.name) };
    }
    case 'setLocStatus': return { ...s, locations: s.locations.map(l => (l.id === a.id ? { ...l, status: a.status, removedNote: a.note || null } : l)), log: stamp({ Active: 'Restored location', Inactive: 'Paused location', Removed: 'Removed location' }[a.status], a.id, a.note) };
    case 'deleteLocation': return { ...s, locations: s.locations.filter(l => l.id !== a.id), log: stamp('Deleted location (no visit history)', a.id) };
    case 'saveInst': {
      const exists = s.unis.some(u => u.code === a.inst.code);
      return { ...s, unis: exists ? s.unis.map(u => (u.code === a.inst.code ? { ...u, ...a.inst } : u)) : [...s.unis, a.inst], log: stamp(exists ? `Edited ${a.inst.kind}` : `Added ${a.inst.kind}`, a.inst.code, a.inst.name) };
    }
    case 'setInstStatus': {
      const locations = a.status === 'Removed' ? s.locations.map(l => (l.uni === a.code && l.status !== 'Removed' ? { ...l, status: 'Removed', removedNote: 'Institution removed' } : l)) : s.locations;
      return { ...s, unis: s.unis.map(u => (u.code === a.code ? { ...u, status: a.status } : u)), locations, log: stamp(a.status === 'Removed' ? 'Removed institution' : 'Restored institution', a.code, a.note) };
    }
    case 'savePerson': {
      const exists = s.people.some(p => p.id === a.person.id);
      const old = s.people.find(p => p.id === a.person.id); const desc = p => p ? `${ROLE_LABEL[p.role]} · ${p.state || 'National'} · ${p.status}${p.reportsTo ? ' · reports to ' + p.reportsTo : ''}` : null;
      const roleChg = old && old.role !== a.person.role;
      return { ...s, people: exists ? s.people.map(p => (p.id === a.person.id ? a.person : p)) : [...s.people, a.person], log: stamp(roleChg ? 'Changed role' : exists ? 'Edited person' : 'Added person to approved user list', a.person.name, a.person.disambig || null, { cat: 'People', from: desc(old), to: desc(a.person) }) };
    }
    case 'setPersonStatus': { const old = s.people.find(p => p.id === a.id); return { ...s, people: s.people.map(p => (p.id === a.id ? { ...p, status: a.status } : p)), log: stamp(`${a.status === 'Active' ? 'Reactivated' : a.status === 'Removed' ? 'Removed' : 'Deactivated'} user`, old?.name, null, { cat: 'People', from: old?.status, to: a.status }) }; }
    case 'saveState': return { ...s, states: [...s.states, a.state], leads: { ...s.leads, [a.state.code]: [] }, log: stamp('Added state', a.state.code, a.state.name) };
    case 'setLeads': return { ...s, leads: { ...s.leads, [a.state]: a.names }, log: stamp('Changed channel leads', a.state, a.names.join(', ')) };
    case 'submitRequest': {
      const r = { id: 'RR-' + String(s.requests.length + 1).padStart(4, '0') + '-' + Math.random().toString(36).slice(2, 5), status: 'Pending', submittedAt: new Date().toISOString(), requester: s.me, ...a.req };
      const leads = leadsFor(s, r.state);
      let notifications = notify(s, { kind: 'request', to: leads, state: r.state, title: `Removal request: ${r.targetName}`, body: `${r.requester} asked to remove a ${r.targetType.toLowerCase()} · ${r.reason}`, ref: { page: 'notifications', tab: 'Requests' }, email: true, reqId: r.id });
      return { ...s, requests: [r, ...s.requests], notifications, log: stamp('Requested removal', r.targetId, r.reason) };
    }
    case 'decideRequest': {
      const r = s.requests.find(x => x.id === a.id); if (!r || r.status !== 'Pending') return s;
      const done = { ...r, status: a.approve ? 'Approved' : 'Rejected', decidedBy: s.me, decidedAt: new Date().toISOString(), decisionNote: a.note };
      let next = { ...s, requests: s.requests.map(x => (x.id === a.id ? done : x)) };
      if (a.approve) {
        if (r.targetType === 'University' || r.targetType === 'TAFE') next = reducer(next, { type: 'setInstStatus', code: r.targetId, status: 'Removed', note: `Approved request ${r.id}` });
        else next = reducer(next, { type: 'setLocStatus', id: r.targetId, status: 'Removed', note: `Approved request ${r.id}` });
      }
      next.notifications = notify(next, { kind: 'decision', to: [r.requester], state: r.state, title: `Request ${a.approve ? 'approved' : 'rejected'}: ${r.targetName}`, body: `${s.me}${a.note ? ': ' + a.note : ''}`, ref: { page: 'notifications', tab: 'Requests' }, email: true, reqId: r.id });
      next.log = [{ ts: new Date().toISOString(), user: s.me, action: a.approve ? 'Approved removal' : 'Rejected removal', target: r.targetId, detail: r.id }, ...next.log];
      return next;
    }
    case 'reset': return { ...seedState(), me: s.me, meId: s.meId, authed: true, route: { page: 'dashboard' } };
    default: return ecaReducer(s, a, stamp);
  }
}
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ======================= DERIVED DATA + PERMISSIONS ======================= */
function useDerived(s) {
  return useMemo(() => {
    const today = todayISO();
    const meP = s.people.find(p => p.id === s.meId) || s.people.find(p => p.name === s.me) || s.people[0];
    const role = meP.role;
    const leadOf = Object.entries(s.leads).filter(([, ns]) => ns.includes(meP.name)).map(([st]) => st);
    const stateCodes = s.states.map(x => x.code);
    const scopeStates = role === 'admin' ? stateCodes : [meP.state];
    const uniBy = Object.fromEntries(s.unis.map(u => [u.code, u]));
    const liveUnis = s.unis.filter(u => u.status !== 'Removed');
    const scopeUnis = liveUnis.filter(u => scopeStates.includes(u.state)).map(u => u.code);
    const visitsByLoc = {};
    for (const v of s.visits) (visitsByLoc[v.loc] = visitsByLoc[v.loc] || []).push(v);
    const locs = s.locations.map(l => {
      const vs = visitsByLoc[l.id] || [];
      const st = locationStatus({ ...l, status: l.status === 'Active' ? 'Active' : 'Inactive' }, vs.filter(v => v.status === 'Completed').map(v => v.date), s.ref, today);
      const lastV = vs.filter(v => v.status === 'Completed' && v.staff).sort((a, b) => b.date.localeCompare(a.date))[0];
      const u = uniBy[l.uni];
      return { ...l, locStatus: l.status, ...st, visits: vs, uniName: u?.name || l.uni, state: u?.state, kind: u?.kind, lastBy: lastV?.staff || null };
    });
    const locBy = Object.fromEntries(locs.map(l => [l.id, l]));
    const auditorsFor = st => s.people.filter(p => p.status === 'Active' && p.state === st && (p.role === 'marketeer' || p.role === 'manager')).map(p => p.name).sort();
    const isAdmin = role === 'admin', isMgr = role === 'manager', isSM = role === 'marketeer';
    const can = {
      manageLocations: isAdmin || isMgr, addLocation: true, manageInstitutions: isAdmin || isMgr, requestRemoval: isSM,
      managePeople: isAdmin || isMgr, managePerson: p => isAdmin || (isMgr && p.state === meP.state && p.role !== 'admin'),
      roleOptions: isAdmin ? ['marketeer', 'manager', 'admin'] : ['marketeer', 'manager'],
      approve: r => leadOf.includes(r.state), export: isAdmin || isMgr, seeContacts: isAdmin || isMgr, admin: isAdmin,
      editVisit: v => !v.demo && (monthStatus(s, v.date.slice(0, 7)) === 'Final' ? isAdmin : (isAdmin || isMgr || (v.staff === meP.name && !v.imported && (Date.now() - Date.parse(v.submittedAt || 0)) < 48 * 3600e3))),
      approveVisits: isAdmin || isMgr, finalise: isAdmin,
    };
    const elevated = isAdmin && Date.now() < (s.elevatedUntil || 0);
    return { today, meP, role, leadOf, scopeStates, uniBy, liveUnis, scopeUnis, locs, locBy, auditorsFor, can, isAdmin, isMgr, isSM, elevated };
  }, [s.locations, s.visits, s.people, s.unis, s.ref, s.me, s.meId, s.leads, s.states, s.elevatedUntil, s.snapshots]);
}
function filterLocs(locs, f, D) {
  const q = (f.q || '').trim().toLowerCase();
  return locs.filter(l => D.scopeUnis.includes(l.uni) && (f.removed || l.locStatus !== 'Removed')
    && (!f.state || f.state === 'all' || l.state === f.state)
    && (!f.kind || f.kind === 'All' || l.kind === f.kind)
    && (!f.uni || f.uni === 'all' || l.uni === f.uni)
    && (!f.type || f.type === 'All' || l.type === f.type)
    && (!f.storeType || f.storeType === 'All' || (f.storeType === '__confirm' ? !l.storeType : storeTypeOf(l) === f.storeType))
    && (!f.campus || f.campus === 'all' || l.campus === f.campus)
    && (!q || [l.name, l.id, l.campus, l.uniName, l.landmark, l.address].some(x => x && String(x).toLowerCase().includes(q))));
}
function summarise(locs, visits, start, today) {
  const act = locs.filter(l => l.locStatus === 'Active');
  const ids = new Set(locs.map(l => l.id));
  const vIn = visits.filter(v => v.status === 'Completed' && ids.has(v.loc) && v.date >= start && v.date <= today);
  const doneIds = new Set(vIn.map(v => v.loc));
  const c = k => act.filter(l => l.status === k).length;
  const sum = k => vIn.reduce((t, v) => t + (+v[k] || 0), 0);
  const completed = act.filter(l => doneIds.has(l.id)).length;
  return {
    active: act.length, required: act.length, completed, pct: act.length ? completed / act.length : 0,
    onTrack: c('On Track'), dueSoon: c('Due Soon'), overdue: c('Overdue'), noVisit: c('No Visit Recorded'),
    visits: vIn.length, dpAdded: sum('dpAdded'), dpLost: sum('dpLost'), editions: sum('editions'), posPlaced: sum('posPlaced'),
    coolersIn: sum('coolersIn'), coolersOut: sum('coolersOut'), qsr: act.filter(l => l.type === 'QSR').length, vending: act.filter(l => l.type === 'Vending').length, vIn,
  };
}
/** Daily activity summaries: one per Student Marketeer per day with 2+ completed audits (production: 6 pm flow). */
function dailySummaries(s, D) {
  const groups = {};
  for (const v of s.visits) {
    if (v.status !== 'Completed' || !v.staff || v.imported) continue;
    const p = s.people.find(x => x.name === v.staff);
    if (!p || p.role !== 'marketeer') continue;
    (groups[v.staff + '|' + v.date] = groups[v.staff + '|' + v.date] || []).push(v);
  }
  return Object.entries(groups).filter(([, vs]) => vs.length >= 2).map(([k, vs]) => {
    const [staff, date] = k.split('|'); const p = s.people.find(x => x.name === staff);
    const ls = vs.map(v => D.locBy[v.loc]).filter(Boolean);
    const inst = kind => [...new Set(ls.filter(l => l.kind === kind).map(l => l.uniName))];
    const sum = f => vs.reduce((t, v) => t + (+v[f] || 0), 0);
    const findings = [];
    const net = sum('dpAdded') - sum('dpLost');
    if (sum('dpAdded') || sum('dpLost')) findings.push(`Distribution points ${net >= 0 ? '+' : ''}${net} (+${sum('dpAdded')} / −${sum('dpLost')})`);
    if (sum('editions')) findings.push(`${sum('editions')} Editions sold in`);
    if (sum('posPlaced')) findings.push(`${sum('posPlaced')} POS placed`);
    if (sum('coolersIn') || sum('coolersOut')) findings.push(`Coolers +${sum('coolersIn')} / −${sum('coolersOut')}`);
    vs.filter(v => v.issue).forEach(v => findings.push(`Issue at ${D.locBy[v.loc]?.name}: ${v.issue}`));
    if (!findings.length) findings.push('No outcome changes recorded');
    return { key: 'DS|' + k, staff, date, state: p.state, visits: vs, universities: inst('University'), tafes: inst('TAFE'),
      stores: ls.filter(l => l.type === 'QSR').map(l => l.name), vending: ls.filter(l => l.type === 'Vending').map(l => l.name), total: vs.length, findings,
      to: [...leadsFor(s, p.state), ...managersFor(s, p.state)] };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

/* ======================= ICONS ======================= */
const P = {
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  visits: 'M8 3h8M9 3v3h6V3M6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12l2.5 2.5L16 9',
  uni: 'M3 9l9-5 9 5-9 5zM6 11v5c3 2.5 9 2.5 12 0v-5M21 9v6',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  play: 'M7 4v16l13-8z', plus: 'M12 5v14M5 12h14', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4', chev: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6', x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7', alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', circle: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', minus: 'M6 12h12',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14', more: 'M5 12h.01M12 12h.01M19 12h.01',
  copy: 'M9 9h10v10H9zM5 15V5h10', camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', vend: 'M6 3h12v18H6zM9 7h6M9 11h6M9 17h2', store: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 4 2.8M10 20v-5h4v5',
};
const Icon = ({ n, s = 20, w = 1.8 }) => html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[n]} /></svg>`;

/* ======================= SMALL COMPONENTS ======================= */
const StatusChip = ({ status }) => { const m = STATUS[status] || STATUS['Inactive']; return html`<span class=${'chip ' + m.tone}><${Icon} n=${m.icon} s=${13} w=${2.4} />${status}</span>`; };
const TypeChip = ({ type, l }) => html`<span class="chip type"><${Icon} n=${type === 'Vending' ? 'vend' : 'store'} s=${13} />${l ? storeTypeOf(l) : type === 'Vending' ? 'Vending' : 'QSR'}</span>`;
const storeTypeOpts = (s, allLabel = 'All store location types') => [['All', allLabel], ...s.ref.storeTypes.map(t => [t.name, t.active ? t.name : t.name + ' (retired)'])];
const ActiveChip = ({ status }) => html`<span class=${'chip ' + (status === 'Active' ? 'plain' : 'muted')}>${status === 'Active' ? 'Active' : 'Inactive'}</span>`;
function dueText(l) {
  if (l.status === 'Inactive') return { t: 'Not planned', tone: '' };
  if (l.days === null) return { t: '—', tone: '' };
  if (l.days < 0) return { t: `${-l.days} day${l.days === -1 ? '' : 's'} overdue`, tone: 'bad' };
  if (l.days === 0) return { t: 'Due today', tone: 'warn' };
  return { t: `${l.days} day${l.days === 1 ? '' : 's'} left`, tone: l.days <= 3 ? 'warn' : 'good' };
}
const Seg = ({ value, options, onChange, label, big }) => html`<div class=${'seg' + (big ? ' big' : '')} role="group" aria-label=${label}>${options.map(o => {
  const [v, t, cls] = Array.isArray(o) ? o : [o, o];
  return html`<button key=${String(v)} type="button" class=${cls || ''} aria-pressed=${String(value === v)} onClick=${() => onChange(v)}>${t}</button>`;
})}</div>`;
const Select = ({ id, label, value, onChange, options, hint, err, disabled }) => html`<div class="field"><label for=${id}>${label}</label>
  <select id=${id} class="input" value=${value ?? ''} onChange=${e => onChange(e.target.value)} aria-invalid=${err ? 'true' : 'false'} disabled=${disabled}>
    ${options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return html`<option key=${String(v)} value=${v}>${t}</option>`; })}
  </select>${err ? html`<span class="err">${err}</span>` : hint ? html`<span class="hint">${hint}</span>` : null}</div>`;
const Text = ({ id, label, value, onChange, type = 'text', hint, err, placeholder, inputMode, multiline, step, min }) => html`<div class="field"><label for=${id}>${label}</label>
  ${multiline ? html`<textarea id=${id} class="input" value=${value ?? ''} placeholder=${placeholder} onInput=${e => onChange(e.target.value)} aria-invalid=${err ? 'true' : 'false'}></textarea>`
    : html`<input id=${id} class="input" type=${type} step=${step} min=${min} inputmode=${inputMode} value=${value ?? ''} placeholder=${placeholder} onInput=${e => onChange(e.target.value)} aria-invalid=${err ? 'true' : 'false'} />`}
  ${err ? html`<span class="err" role="alert">${err}</span>` : hint ? html`<span class="hint">${hint}</span>` : null}</div>`;
const Search = ({ id, value, onChange, placeholder }) => html`<div class="search"><${Icon} n="search" s=${16} /><label class="sr" for=${id}>Search</label><input id=${id} class="input" type="search" placeholder=${placeholder || 'Search'} value=${value} onInput=${e => onChange(e.target.value)} /></div>`;
const Kpi = ({ label, value, sub, tone, icon }) => html`<div class=${'kpi ' + (tone || '')}><span class="l">${icon ? html`<${Icon} n=${icon} s=${14} w=${2.2} />` : null}${label}</span><span class="v num">${value}</span>${sub ? html`<span class="s">${sub}</span>` : null}</div>`;
const Empty = ({ title, body, action }) => html`<div class="empty"><${Icon} n="visits" s=${36} w=${1.4} /><b>${title}</b><span>${body}</span>${action || null}</div>`;
const Stepper = ({ id, label, value, onChange }) => html`<div class="field"><label for=${id}>${label}</label><div class="stepper-num">
  <button type="button" aria-label=${'Decrease ' + label} onClick=${() => onChange(Math.max(0, (+value || 0) - 1))}>−</button>
  <input id=${id} class="num" inputmode="numeric" value=${value} onInput=${e => onChange(e.target.value.replace(/\D/g, ''))} />
  <button type="button" aria-label=${'Increase ' + label} onClick=${() => onChange((+value || 0) + 1)}>+</button></div></div>`;

/* ======================= CHARTS (hand-drawn SVG, values printed, table alternative) ======================= */
function ClusterBars({ rows, a, b, aLabel, bLabel, caption }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r[a], r[b])));
  const W = 520, L = 150, R = 36, rowH = 46, H = rows.length * rowH + 8;
  const x = v => (v / max) * (W - L - R);
  return html`<figure style="margin:0"><div class="legend" style="margin-bottom:8px"><span><i class="sw" style="background:var(--line-strong)"></i>${aLabel}</span><span><i class="sw" style="background:var(--brand)"></i>${bLabel}</span></div>
  <div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${caption}>
    ${rows.map((r, i) => { const y = i * rowH + 6; return html`<g key=${r.label}>
      <text x=${L - 10} y=${y + 21} text-anchor="end" font-size="13" fill="var(--ink-2)" font-weight="600">${r.label}</text>
      <rect x=${L} y=${y + 4} width=${Math.max(1, x(r[a]))} height="14" rx="3" fill="var(--line-strong)"><title>${r.label} ${aLabel}: ${r[a]}</title></rect>
      <text x=${L + x(r[a]) + 6} y=${y + 15} font-size="11" fill="var(--ink-3)" class="num">${r[a]}</text>
      <rect x=${L} y=${y + 20} width=${Math.max(1, x(r[b]))} height="14" rx="3" fill="var(--brand)"><title>${r.label} ${bLabel}: ${r[b]}</title></rect>
      <text x=${L + x(r[b]) + 6} y=${y + 31} font-size="11" fill="var(--ink)" font-weight="700" class="num">${r[b]}</text></g>`; })}
  </svg></div><figcaption class="sr">${caption}</figcaption></figure>`;
}
const STATUS_FILL = { 'On Track': 'var(--good)', 'Due Soon': 'var(--accent)', 'Overdue': 'var(--danger)', 'No Visit Recorded': 'var(--line-strong)' };
function StackBars({ rows, caption }) {
  const W = 520, L = 150, R = 8, rowH = 36, H = rows.length * rowH + 8;
  return html`<figure style="margin:0"><div class="legend" style="margin-bottom:8px">${STATUS_KEYS.map(k => html`<span key=${k}><${StatusChip} status=${k} /></span>`)}</div>
  <div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${caption}>
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--none-tint)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-strong)" stroke-width="2" /></pattern></defs>
    ${rows.map((r, i) => { const tot = STATUS_KEYS.reduce((t, k) => t + r[k], 0); let x = L; const y = i * rowH + 4; const span = W - L - R;
      return html`<g key=${r.label}><text x=${L - 10} y=${y + 17} text-anchor="end" font-size="13" fill="var(--ink-2)" font-weight="600">${r.label}</text>
      ${tot === 0 ? html`<text x=${L} y=${y + 17} font-size="12" fill="var(--ink-3)">No active locations</text>` : STATUS_KEYS.map(k => { const w = (r[k] / tot) * span; const x0 = x; x += w; if (!r[k]) return null;
        return html`<g key=${k}><rect x=${x0} y=${y + 3} width=${w} height="20" fill=${k === 'No Visit Recorded' ? 'url(#hatch)' : STATUS_FILL[k]} stroke="var(--surface)" stroke-width="1"><title>${r.label} ${k}: ${r[k]}</title></rect>
        ${w > 22 ? html`<text x=${x0 + w / 2} y=${y + 17} text-anchor="middle" font-size="11" font-weight="700" fill=${k === 'Due Soon' ? '#1D1600' : k === 'No Visit Recorded' ? 'var(--ink)' : '#fff'}>${r[k]}</text>` : null}</g>`; })}</g>`; })}
  </svg></div><figcaption class="sr">${caption}</figcaption></figure>`;
}
function MonthTrend({ months, caption }) {
  const W = 560, H = 220, L = 34, B = 28, T = 18, R = 8;
  const max = Math.max(1, ...months.map(m => m.visits));
  const step = (W - L - R) / months.length, bw = Math.min(30, step * .6);
  const y = v => T + (H - T - B) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  return html`<div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${caption}>
    ${ticks.map(t => html`<g key=${t}><line x1=${L} x2=${W - R} y1=${y(t)} y2=${y(t)} stroke="var(--line)" /><text x=${L - 6} y=${y(t) + 4} text-anchor="end" font-size="11" fill="var(--ink-3)">${t}</text></g>`)}
    ${months.map((m, i) => { const cx = L + step * i + step / 2; return html`<g key=${m.key}>
      <rect x=${cx - bw / 2} y=${y(m.visits)} width=${bw} height=${H - B - y(m.visits)} rx="3" fill=${i === months.length - 1 ? 'var(--brand)' : 'var(--brand-tint)'} stroke="var(--brand)" stroke-width=${i === months.length - 1 ? 0 : 1}><title>${m.label}: ${m.visits} completed visits, ${m.locs} locations</title></rect>
      ${m.visits ? html`<text x=${cx} y=${y(m.visits) - 4} text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${m.visits}</text>` : null}
      <text x=${cx} y=${H - 9} text-anchor="middle" font-size="11" fill="var(--ink-3)">${m.label}</text></g>`; })}
  </svg></div>`;
}
function monthsSeries(visits, ids, n = 12) {
  const now = new Date(); const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const vs = visits.filter(v => v.status === 'Completed' && ids.has(v.loc) && v.date.startsWith(key));
    out.push({ key, label: d.toLocaleDateString('en-AU', { month: 'short' }), visits: vs.length, locs: new Set(vs.map(v => v.loc)).size,
      dpNet: vs.reduce((t, v) => t + v.dpAdded - v.dpLost, 0) });
  }
  return out;
}

/* ======================= AUDIT FORM ======================= */
const facingComps = s => [...new Set(s.ref.competitors.filter(c => c && c !== 'None'))];
const compDetailText = (cf, cd, isV) => Object.keys(cf || {}).map(c => { const x = (cd || {})[c] || {};
  return `${c}: ${+cf[c] || 0} facing${+cf[c] === 1 ? '' : 's'}${x.price !== undefined && x.price !== '' && x.price !== null ? ' · ' + money(x.price) : ''}${!isV && +x.pos ? ` · ${x.pos} POS` : ''}${!isV && +x.coolers ? ` · ${x.coolers} cooler${+x.coolers === 1 ? '' : 's'}` : ''}`; });
const compSum = (cd, k) => Object.values(cd || {}).reduce((t, x) => t + (+x?.[k] || 0), 0);
/** Top competitor (most facings) and its price, kept for older reports. */
function withTopComp(f) { const cs = Object.entries(f.compFacings || {}); if (!cs.length) return f.status === 'Completed' ? { ...f, comp: 'None', compPrice: '' } : f;
  const [top] = cs.sort((a, b) => (+b[1] || 0) - (+a[1] || 0)); const pr = f.compDetail?.[top[0]]?.price; return { ...f, comp: top[0], compPrice: pr === undefined || pr === null ? '' : pr }; }
const normCompDetail = f => Object.fromEntries(Object.keys(f.compFacings || {}).map(c => { const x = (f.compDetail || {})[c] || {}; const pr = x.price;
  return [c, { price: pr === undefined || pr === null || pr === '' ? null : +pr, pos: +x.pos || 0, coolers: +x.coolers || 0 }]; }));
const compTotal = cf => Object.values(cf || {}).reduce((t, n) => t + (+n || 0), 0);
const shelfShare = (rb, cf) => { const t = (+rb || 0) + compTotal(cf); return t ? (+rb || 0) / t : null; };
const okPhone = v => /^[0-9 +()-]{8,20}$/.test(String(v).trim()) && String(v).replace(/\D/g, '').length >= 8;
const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
const STEPS = ['Visit details', 'Ranging', 'Pricing & execution', 'Outcomes', 'Notes & follow-up', 'Review & submit'];
function nowLocal() { const n = new Date(); return `${isoOf(n)}T${pad(n.getHours())}:${pad(n.getMinutes())}`; }
function blankForm(s, D, route) {
  const loc = route.loc ? D.locBy[route.loc] : null;
  const uni = loc?.uni || route.uni || (D.scopeUnis.length === 1 ? D.scopeUnis[0] : '') || '';
  const f = { draftId: 'D' + Date.now(), uni, campus: loc?.campus || '', loc: loc?.id || '', date: nowLocal(), staff: D.isAdmin ? '' : D.meP.name, status: 'Completed',
    ranging: {}, price: '', comp: '', compPrice: '', pos: null, cooler: null, posType: '', bull: '', channel: '', classification: '', vendCo: '', machineId: '', vSku: '', vPrice: '', mSku: '', mPrice: '',
    dpAdded: 0, dpLost: 0, editions: 0, flavours: '', posPlaced: 0, coolersIn: 0, coolersOut: 0, notes: '', nextStep: '', followUp: '', photos: [], issue: false, issueNote: '',
    rbFacings: 0, compFacings: {}, compDetail: {}, contactName: '', contactRole: '', contactPhone: '', contactEmail: '' };
  return loc ? prefill(f, loc, D) : f;
}
function prefill(f, l, D) {
  const seeAll = !D || D.can.seeContacts;
  const comps = l.facingComps || (l.compFacings ? Object.keys(l.compFacings) : (l.topComp && l.topComp !== 'None' ? [l.topComp] : []));
  return { ...f, contactName: l.contactName || '', contactRole: l.contactRole || '', contactPhone: seeAll ? l.contactPhone || '' : '', contactEmail: seeAll ? l.contactEmail || '' : '',
    _onFile: { phone: !!l.contactPhone, email: !!l.contactEmail }, rbFacings: 0, compFacings: Object.fromEntries(comps.map(c => [c, 0])),
    compDetail: Object.fromEntries(comps.map(c => { const x = (l.compDetail || {})[c] || {}; return [c, { price: x.price ?? (c === l.topComp && l.compPrice ? l.compPrice : ''), pos: +x.pos || 0, coolers: +x.coolers || 0 }]; })), uni: l.uni, campus: l.campus, loc: l.id, ranging: { ...(l.ranging || {}) }, price: l.price ?? '', comp: l.topComp || '', compPrice: l.compPrice ?? '', pos: l.pos ?? null, cooler: l.cooler ?? null,
    bull: l.bull || '', channel: l.channel || '', classification: l.classification || '', vendCo: l.vendCo || '', machineId: l.machineId || '', vSku: l.vSku ?? '', vPrice: l.vPrice ?? '', mSku: l.mSku ?? '', mPrice: l.mPrice ?? '', _prefilled: true };
}
function validate(f, s, D) {
  const loc = D.locBy[f.loc]; const e = {};
  if (!f.uni) e.uni = [0, 'Choose a university or TAFE.'];
  if (!f.loc) e.loc = [0, 'Choose a location.'];
  else if (loc && loc.locStatus !== 'Active' && !f.editingId) e.loc = [0, 'This location is inactive. Choose an active location.'];
  if (!f.date) e.date = [0, 'Enter the visit date and time.'];
  else if (f.status === 'Completed' && f.date.slice(0, 10) > D.today) e.date = [0, 'A completed visit can’t be in the future.'];
  if (!f.staff) e.staff = [0, 'Choose who did the visit.'];
  if (f.status === 'Completed' && !(f.contactName || '').trim()) e.contactName = [0, 'Enter the name of the store contact you spoke to.'];
  if ((f.contactPhone || '').trim() && !okPhone(f.contactPhone)) e.contactPhone = [0, 'Enter a phone number with at least 8 digits, e.g. 0412 345 678.'];
  if ((f.contactEmail || '').trim() && !okEmail(f.contactEmail)) e.contactEmail = [0, 'Enter a valid email address.'];
  if (f.status === 'Completed' && loc) {
    const prods = s.ref.products.filter(p => (loc.type === 'Vending' ? p.vending : p.qsr));
    const missing = prods.filter(p => f.ranging[p.key] !== 0 && f.ranging[p.key] !== 1);
    if (missing.length) e.ranging = [1, `Answer Yes or No for ${missing.map(p => p.label).join(', ')}.`];
    if (f.price !== '' && !(+f.price > 0 && +f.price < 20)) e.price = [2, 'Enter a price between $0.01 and $20, or leave it blank.'];
    const badComp = Object.keys(f.compFacings || {}).filter(c => { const pr = f.compDetail?.[c]?.price; return pr !== undefined && pr !== null && pr !== '' && !(+pr > 0 && +pr < 20); });
    if (badComp.length) e.compPrice = [2, `Check the price for ${badComp.join(', ')}: between $0.01 and $20, or leave it blank.`];
    if (loc.type === 'QSR' && (f.pos !== 0 && f.pos !== 1)) e.pos = [2, 'Is POS present?'];
    if (loc.type === 'QSR' && (f.cooler !== 0 && f.cooler !== 1)) e.cooler = [2, 'Is a cooler present?'];
    if (+f.posPlaced > 0 && !f.posType) e.posType = [3, 'Choose the POS type you placed.'];
  }
  if (f.followUp && f.followUp < f.date.slice(0, 10)) e.followUp = [4, 'Follow-up must be on or after the visit date.'];
  if (f.issue && !f.issueNote.trim()) e.issueNote = [4, 'Describe the issue.'];
  return e;
}
function Audit() {
  const { s, d, D } = useApp();
  const r = s.route;
  const [f, setF] = useState(() => {
    if (r.draft) { const x = s.drafts.find(dd => dd.draftId === r.draft); if (x) return { ...x, photos: [] }; }
    if (r.edit) { const v = s.visits.find(x => x.id === r.edit); if (v) { const l = D.locBy[v.loc]; const base = prefill(blankForm(s, D, {}), l, D);
      return { ...base, ...(v.response || {}), ranging: { ...base.ranging, ...(v.response?.ranging || {}) }, comp: v.response?.comp ?? base.comp, editingId: v.id, date: `${v.date}T${v.time || '09:00'}`, staff: v.staff || '', status: v.status, notes: v.notes || '', nextStep: v.nextStep || '', followUp: v.followUp || '',
        dpAdded: v.dpAdded, dpLost: v.dpLost, editions: v.editions, flavours: v.flavours || '', posPlaced: v.posPlaced, posType: v.posType || '', coolersIn: v.coolersIn, coolersOut: v.coolersOut, issue: !!v.issue, issueNote: v.issue || '', rbFacings: v.rbFacings ?? 0, compFacings: { ...(v.compFacings || base.compFacings) }, compDetail: { ...base.compDetail, ...(v.compDetail || {}) }, contactName: v.contactName || base.contactName, contactRole: v.contactRole || base.contactRole }; } }
    return blankForm(s, D, r);
  });
  const [step, setStep] = useState(r.loc || r.draft || r.edit ? (r.edit ? 5 : 0) : 0);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tried, setTried] = useState(false);
  const [newComp, setNewComp] = useState('');
  const [pState, setPState] = useState(() => D.uniBy[f.uni]?.state || (D.isAdmin ? '' : D.meP.state));
  const [pKind, setPKind] = useState(() => D.uniBy[f.uni]?.kind || 'University');
  const set = (k, v) => { setDirty(true); setF(x => ({ ...x, [k]: v })); };
  const loc = D.locBy[f.loc]; const isV = loc?.type === 'Vending';
  const errs = validate(f, s, D);
  const stepErr = i => Object.values(errs).some(([st]) => st === i);
  const E = k => (tried || step === 5 ? errs[k]?.[1] : null);
  const scopeInsts = D.liveUnis.filter(u => D.scopeUnis.includes(u.code));
  const stateInsts = scopeInsts.filter(u => !pState || u.state === pState);
  const uniOpts = stateInsts.filter(u => u.kind === pKind).sort((a, b) => a.name.localeCompare(b.name));
  const activeAt = code => D.locs.filter(l => l.uni === code && l.locStatus === 'Active').length;
  const pickState = st => { setPState(st); if (f.uni && D.uniBy[f.uni]?.state !== st) setF(x => ({ ...x, uni: '', campus: '', loc: '' })); };
  const pickKind = k => { setPKind(k); if (f.uni && D.uniBy[f.uni]?.kind !== k) setF(x => ({ ...x, uni: '', campus: '', loc: '' })); };
  const campusOpts = f.uni ? [...new Set(D.locs.filter(l => l.uni === f.uni && l.locStatus === 'Active').map(l => l.campus))].sort() : [];
  const locOpts = D.locs.filter(l => l.uni === f.uni && (l.locStatus === 'Active' || l.id === f.loc) && (!f.campus || l.campus === f.campus)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const staffOpts = f.uni ? [...D.auditorsFor(D.uniBy[f.uni]?.state), ...(D.isAdmin ? [D.meP.name] : [])] : [];
  const staffList = f.staff && !staffOpts.includes(f.staff) ? [...staffOpts, f.staff] : staffOpts;
  const prods = s.ref.products.filter(p => (isV ? p.vending : p.qsr));
  const needsAudit = f.status === 'Completed';
  const saveDraft = () => { const { photos, ...rest } = f; d({ type: 'saveDraft', draft: rest }); setDirty(false); d({ type: 'toast', msg: 'Draft saved' }); };
  const submit = () => {
    setTried(true);
    if (Object.keys(errs).length) { setStep(5); return; }
    const finalMonth = f.editingId && monthStatus(s, f.date.slice(0, 7)) === 'Final';
    if (finalMonth && !(f.reason || '').trim()) { setStep(5); return; }
    const act = [{ type: 'submitVisit', form: withTopComp(f) }, { type: 'toast', msg: finalMonth ? 'Correction saved and logged. The finalised leaderboard is unchanged.' : f.status === 'Completed' ? `Audit submitted${s.ref.approvalMode === 'auto' ? '' : ' for approval'}. Next visit due ${fmtDate(addDays(f.date.slice(0, 10), +loc.cycle || 14))}` : `Visit saved as ${f.status.toLowerCase()}` }, { type: 'nav', route: { page: 'loc', id: f.loc } }];
    if (finalMonth) { requireAdmin(D, d, act, 'This audit is in a finalised month, so changing it is a data correction.'); return; }
    act.forEach(x => d(x)); return;
    d({ type: 'nav', route: { page: 'loc', id: f.loc } });
  };
  const leave = () => (dirty ? setConfirmLeave(true) : d({ type: 'nav', route: { page: 'visits' } }));
  const onPhotos = e => { const files = [...e.target.files].slice(0, 6); Promise.all(files.map(file => new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(file); }))).then(urls => set('photos', [...f.photos, ...urls].slice(0, 6))); };
  const YN = ({ k, label, comp }) => html`<div class="field" key=${k}><span class="label" id=${'yn-' + k}>${label}${comp ? html`<span class="xs muted"> · competitor</span>` : null}</span>
    <${Seg} big label=${label} value=${f.ranging[k]} onChange=${v => set('ranging', { ...f.ranging, [k]: v })} options=${[[1, 'Yes', 'yes'], [0, 'No', 'no']]} /></div>`;
  const YNField = ({ k, label }) => html`<div class="field"><span class="label">${label}</span><${Seg} big label=${label} value=${f[k]} onChange=${v => set(k, v)} options=${[[1, 'Yes', 'yes'], [0, 'No', 'no']]} />${E(k) ? html`<span class="err">${E(k)}</span>` : null}</div>`;

  const body = [
    html`<div class="form-grid">
      ${D.isAdmin ? html`<div class="field span2"><span class="label" id="a-st-l">State</span><${Seg} label="State" value=${pState} onChange=${v => !f.editingId && pickState(v)} options=${s.states.filter(x => D.scopeStates.includes(x.code)).map(x => [x.code, x.code])} />${!pState ? html`<span class="hint">Choose a state to see its universities and TAFEs.</span>` : null}</div>`
        : html`<div class="field"><span class="label">State</span><span class="chip type" style="min-height:40px;padding:0 14px;font-size:14px;align-self:flex-start">${D.meP.state}</span></div>`}
      <div class=${'field' + (D.isAdmin ? ' span2' : '')}><span class="label">Institution type</span><${Seg} label="Institution type" value=${pKind} onChange=${v => !f.editingId && pickKind(v)} options=${['University', 'TAFE'].map(k => [k, `${k === 'University' ? 'Universities' : 'TAFEs'} · ${stateInsts.filter(u => u.kind === k).length}`])} /></div>
      <div class="span2"><${Select} id="a-uni" label=${pKind === 'TAFE' ? 'TAFE' : 'University'} value=${f.uni} onChange=${v => setF(x => ({ ...x, uni: v, campus: '', loc: '' }))}
        options=${[['', D.isAdmin && !pState ? 'Choose a state first' : uniOpts.length ? `Choose from ${uniOpts.length} ${pKind === 'TAFE' ? 'TAFE' : 'universit'}${uniOpts.length === 1 ? (pKind === 'TAFE' ? '' : 'y') : (pKind === 'TAFE' ? 's' : 'ies')}…` : `No ${pKind === 'TAFE' ? 'TAFEs' : 'universities'} set up${pState ? ' in ' + pState : ''}`], ...uniOpts.map(u => [u.code, `${u.name} · ${activeAt(u.code) ? activeAt(u.code) + ' location' + (activeAt(u.code) === 1 ? '' : 's') : 'no locations yet'}`])]}
        err=${E('uni')} disabled=${!!f.editingId || (D.isAdmin && !pState)} /></div>
      <${Select} id="a-campus" label="Campus" value=${f.campus} onChange=${v => setF(x => ({ ...x, campus: v, loc: '' }))} options=${[['', 'All campuses'], ...campusOpts.map(c => [c, c])]} disabled=${!f.uni || !!f.editingId} />
      <div class="span2"><${Select} id="a-loc" label="Location" value=${f.loc} onChange=${v => { setDirty(true); const l = D.locBy[v]; setF(x => (l ? { ...prefill(x, l, D), staff: x.staff } : { ...x, loc: '' })); }}
        options=${[['', f.uni ? `Choose from ${locOpts.length} active locations…` : 'Choose a university or TAFE first'], ...locOpts.map(l => [l.id, `${l.type === 'Vending' ? '[Vending] ' : ''}${l.name} · ${l.id}`])]} err=${E('loc')} disabled=${!f.uni || !!f.editingId} hint=${loc ? `${loc.campus} · ${loc.status}${loc.last ? ' · last visit ' + fmtDate(loc.last) : ''}` : 'Only active locations are listed.'} /></div>
      <div class="field fit"><span class="label">Location type</span><div class="chips">${loc ? html`<${TypeChip} type=${loc.type} l=${loc} />` : html`<span class="muted small">Set by the location</span>`}</div></div>
      <${Text} id="a-date" label="Visit date and time" type="datetime-local" value=${f.date} onChange=${v => set('date', v)} err=${E('date')} />
      <${Select} id="a-staff" label="Staff member" value=${f.staff} onChange=${v => set('staff', v)} options=${[['', staffList.length ? 'Choose…' : 'No active staff allocated'], ...staffList.map(x => [x, x])]} err=${E('staff')} hint="Active Student Marketeers and Managers in this state" />
      <div class="field"><span class="label">Visit status</span><${Seg} label="Visit status" value=${f.status} onChange=${v => set('status', v)} options=${s.ref.visitStatuses} />
        <span class="hint">${f.status === 'Completed' ? 'Completed visits reset the visit cycle.' : 'Scheduled and cancelled visits don’t reset the visit cycle.'}</span></div>
      <div class="span2" style="border-top:1px solid var(--line);padding-top:12px;margin-top:2px"><h3>${isV ? 'Site contact' : 'Store contact'}</h3><p class="xs muted" style="margin:2px 0 0">Who you spoke to today. ${f._prefilled && f.contactName ? 'Filled from the last audit; update anything that’s changed.' : 'Saved to this location for next time.'}</p></div>
      <${Text} id="a-cn" label="Contact name" value=${f.contactName} onChange=${v => set('contactName', v)} err=${E('contactName')} placeholder="First and last name" autoComplete="off" />
      <${Select} id="a-cr" label="Role" value=${f.contactRole} onChange=${v => set('contactRole', v)} options=${[['', 'Choose…'], ...[...new Set([...(s.ref.contactRoles || []), f.contactRole].filter(Boolean))].map(x => [x, x])]} />
      <${Text} id="a-cph" label="Phone" type="tel" inputMode="tel" value=${f.contactPhone} onChange=${v => set('contactPhone', v)} err=${E('contactPhone')} placeholder="0412 345 678" hint=${!D.can.seeContacts && f._onFile?.phone ? 'A number is on file. Leave blank to keep it.' : 'Business number preferred'} autoComplete="off" />
      <${Text} id="a-cem" label="Email" type="email" inputMode="email" value=${f.contactEmail} onChange=${v => set('contactEmail', v)} err=${E('contactEmail')} placeholder="name@business.com.au" hint=${!D.can.seeContacts && f._onFile?.email ? 'An email is on file. Leave blank to keep it.' : 'Optional'} autoComplete="off" />
    </div>`,
    !needsAudit ? html`<div class="banner info"><${Icon} n="clock" s=${18} /><div>Ranging isn’t recorded for ${f.status.toLowerCase()} visits. Skip to notes.</div></div>` : !loc ? html`<div class="banner warn">Choose a location in step 1 first.</div>` : html`
      ${f._prefilled ? html`<div class="banner info"><${Icon} n="copy" s=${18} /><div>Answers start from the last audit. Change anything that’s different today.</div></div>` : null}
      ${E('ranging') ? html`<div class="banner bad" role="alert"><${Icon} n="alert" s=${18} /><div>${E('ranging')}</div></div>` : null}
      <h3>Red Bull</h3><div class="form-grid">${prods.filter(p => !p.competitor).map(p => YN({ k: p.key, label: p.label }))}</div>
      <h3>Competitors</h3><div class="form-grid">${prods.filter(p => p.competitor).map(p => YN({ k: p.key, label: p.label, comp: true }))}</div>`,
    !needsAudit ? html`<div class="banner info"><${Icon} n="clock" s=${18} /><div>Not needed for ${f.status.toLowerCase()} visits.</div></div>` : !loc ? html`<div class="banner warn">Choose a location in step 1 first.</div>` : html`<div class="form-grid">
      <div class="span2" style="display:flex;flex-direction:column;gap:12px"><div><h3>Front facings</h3><p class="xs muted" style="margin:2px 0 0">Count the cans facing out on the shelf or in the fridge${isV ? ' (columns or spirals for vending)' : ''}.</p></div>
        <div class="form-grid"><${Stepper} id="a-rbf" label="Red Bull front facings (DPs)" value=${f.rbFacings} onChange=${v => set('rbFacings', v)} />
          <div class="card flat" style="padding:12px 14px;display:flex;flex-direction:column;justify-content:center;gap:2px"><span class="label">Red Bull share of shelf</span><span class="net num">${shelfShare(f.rbFacings, f.compFacings) === null ? '—' : pct0(shelfShare(f.rbFacings, f.compFacings))}</span><span class="xs muted">${+f.rbFacings || 0} Red Bull · ${compTotal(f.compFacings)} competitor</span></div></div>
        <div class="field"><span class="label" id="a-cf-l">Competitors in ${isV ? 'the machine' : 'store'}</span><div class="chips" role="group" aria-labelledby="a-cf-l">${[...new Set([...facingComps(s), ...Object.keys(f.compFacings || {})])].map(c => { const on = c in (f.compFacings || {});
          return html`<button type="button" key=${c} class="fchip" aria-pressed=${String(on)} onClick=${() => { const n = { ...(f.compFacings || {}) }; const dt = { ...(f.compDetail || {}) }; if (on) { delete n[c]; delete dt[c]; } else { n[c] = 0; dt[c] = dt[c] || { price: '', pos: 0, coolers: 0 }; } setDirty(true); setF(x => ({ ...x, compFacings: n, compDetail: dt })); }}>${on ? '✓ ' : '+ '}${c}</button>`; })}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px"><input class="input" id="a-newc" style="flex:1 1 180px;max-width:280px" placeholder="Another brand, e.g. Prime" value=${newComp} onInput=${e => setNewComp(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.nextSibling.click(); } }} />
            <button type="button" class="btn sm" onClick=${() => { const c = newComp.trim().replace(/\s+/g, ' '); if (!c) return; const hit = Object.keys(f.compFacings || {}).find(x => x.toLowerCase() === c.toLowerCase()) || facingComps(s).find(x => x.toLowerCase() === c.toLowerCase()) || c; setDirty(true); setF(x => ({ ...x, compFacings: { ...(x.compFacings || {}), [hit]: x.compFacings?.[hit] ?? 0 }, compDetail: { ...(x.compDetail || {}), [hit]: x.compDetail?.[hit] || { price: '', pos: 0, coolers: 0 } } })); setNewComp(''); }}><${Icon} n="plus" s=${14} />Add competitor</button></div>
          <span class="hint">${Object.keys(f.compFacings || {}).length ? `${Object.keys(f.compFacings).length} competitor${Object.keys(f.compFacings).length === 1 ? '' : 's'} recorded. Untick any that aren’t there today.` : 'Tap every competitor you can see. Add any brand that isn’t listed.'}</span></div>
        ${Object.keys(f.compFacings || {}).map(c => { const dt = (f.compDetail || {})[c] || {}; const id = c.replace(/\W+/g, ''); const setD = (k, v) => { setDirty(true); setF(x => ({ ...x, compDetail: { ...(x.compDetail || {}), [c]: { ...((x.compDetail || {})[c] || {}), [k]: v } } })); };
          return html`<div key=${c} class="card flat" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>${c}</h3><button type="button" class="btn ghost sm" aria-label=${'Remove ' + c} onClick=${() => { const n = { ...f.compFacings }; const d2 = { ...(f.compDetail || {}) }; delete n[c]; delete d2[c]; setDirty(true); setF(x => ({ ...x, compFacings: n, compDetail: d2 })); }}><${Icon} n="x" s=${14} />Remove</button></div>
            <div class="form-grid"><${Stepper} id=${'a-cf-' + id} label="Front facings" value=${f.compFacings[c]} onChange=${v => set('compFacings', { ...f.compFacings, [c]: v })} />
              <${Text} id=${'a-cfp-' + id} label="Price ($)" type="number" step="0.01" min="0" inputMode="decimal" value=${dt.price ?? ''} onChange=${v => setD('price', v)} hint="Optional" />
              ${isV ? null : html`<${Stepper} id=${'a-cfpos-' + id} label="POS pieces in store" value=${dt.pos || 0} onChange=${v => setD('pos', v)} /><${Stepper} id=${'a-cfcool-' + id} label="Coolers / fridges in store" value=${dt.coolers || 0} onChange=${v => setD('coolers', v)} />`}</div></div>`; })}
        ${E('compPrice') ? html`<span class="err">${E('compPrice')}</span>` : null}
      </div>
      <div class="span2" style="border-top:1px solid var(--line);padding-top:12px"><h3>Pricing${isV ? ' & machine' : ' & execution'}</h3></div>
      <${Text} id="a-price" label="Red Bull price ($)" type="number" step="0.01" min="0" inputMode="decimal" value=${f.price} onChange=${v => set('price', v)} err=${E('price')} hint="250 ml can shelf price. Competitor prices are with each competitor above." />
      ${isV ? html`
        <${Select} id="a-vco" label="Vending company" value=${f.vendCo} onChange=${v => set('vendCo', v)} options=${[['', 'Choose…'], ...[...new Set([...s.ref.vendingCompanies, f.vendCo].filter(Boolean))].map(x => [x, x])]} />
        <${Text} id="a-mid" label="Machine ID" value=${f.machineId} onChange=${v => set('machineId', v)} />
        <${Text} id="a-vsku" label="V SKU count" inputMode="numeric" value=${f.vSku} onChange=${v => set('vSku', v)} /><${Text} id="a-vp" label="V price ($)" type="number" step="0.01" value=${f.vPrice} onChange=${v => set('vPrice', v)} />
        <${Text} id="a-msku" label="Monster SKU count" inputMode="numeric" value=${f.mSku} onChange=${v => set('mSku', v)} /><${Text} id="a-mp" label="Monster price ($)" type="number" step="0.01" value=${f.mPrice} onChange=${v => set('mPrice', v)} />`
      : html`
        ${YNField({ k: 'pos', label: 'Red Bull POS present' })}${YNField({ k: 'cooler', label: 'Red Bull cooler present' })}
        <${Select} id="a-bull" label="Bullring or Bull’s Eye" value=${f.bull} onChange=${v => set('bull', v)} options=${[['', 'Choose…'], ...s.ref.bull.map(x => [x, x === 'EYE' ? 'Bull’s Eye (EYE)' : 'Bullring (RING)'])]} />
        <${Select} id="a-ch" label="Channel" value=${f.channel} onChange=${v => set('channel', v)} options=${[['', 'Choose…'], ...s.ref.channels.map(x => [x, x === 'OnP' ? 'On-premise (OnP)' : 'Off-premise (OffP)'])]} />
        <${Select} id="a-cl" label="Classification" value=${f.classification} onChange=${v => set('classification', v)} options=${[['', 'Choose…'], ...s.ref.classifications.map(x => [x, x])]} />`}
    </div>`,
    !needsAudit ? html`<div class="banner info"><${Icon} n="clock" s=${18} /><div>Outcomes are recorded on completed visits only.</div></div>` : html`<div class="form-grid">
      <${Stepper} id="a-dpa" label="Distribution points added" value=${f.dpAdded} onChange=${v => set('dpAdded', v)} /><${Stepper} id="a-dpl" label="Distribution points lost" value=${f.dpLost} onChange=${v => set('dpLost', v)} />
      <div class="span2 card flat" style="padding:12px 14px;display:flex;align-items:center;justify-content:space-between"><span class="label">Net distribution points</span><span class=${'net num'} style=${{ color: (+f.dpAdded - +f.dpLost) < 0 ? 'var(--danger-ink)' : 'var(--ink)' }}>${signed((+f.dpAdded || 0) - (+f.dpLost || 0))}</span></div>
      <${Stepper} id="a-ed" label="Editions sold in" value=${f.editions} onChange=${v => set('editions', v)} /><${Text} id="a-fl" label="Edition flavours" value=${f.flavours} onChange=${v => set('flavours', v)} placeholder="e.g. Red, Blue, Summer" />
      <${Stepper} id="a-pp" label="POS placed" value=${f.posPlaced} onChange=${v => set('posPlaced', v)} />
      <${Select} id="a-pt" label="POS type" value=${f.posType} onChange=${v => set('posType', v)} options=${[['', +f.posPlaced ? 'Choose…' : 'None placed'], ...s.ref.posTypes.map(x => [x, x])]} err=${E('posType')} />
      ${!isV ? html`<${Stepper} id="a-ci" label="Coolers installed" value=${f.coolersIn} onChange=${v => set('coolersIn', v)} /><${Stepper} id="a-co" label="Coolers removed" value=${f.coolersOut} onChange=${v => set('coolersOut', v)} />
      <div class="span2 card flat" style="padding:12px 14px;display:flex;align-items:center;justify-content:space-between"><span class="label">Net coolers</span><span class="net num">${signed((+f.coolersIn || 0) - (+f.coolersOut || 0))}</span></div>` : null}
      <p class="span2 xs muted" style="margin:0">A distribution point is one SKU ranged at one location. Adding ED and Zero to a new fridge counts as 2 added.</p></div>`,
    html`<div class="form-grid">
      <div class="span2"><${Text} id="a-notes" label="Visit notes" multiline value=${f.notes} onChange=${v => set('notes', v)} placeholder="What happened on this visit" hint="Contact details go in step 1, not here." /></div>
      <div class="span2"><${Text} id="a-ns" label="Next step" value=${f.nextStep} onChange=${v => set('nextStep', v)} placeholder="e.g. Check sell-through and top up POS" /></div>
      <${Text} id="a-fu" label="Follow-up date" type="date" value=${f.followUp} onChange=${v => set('followUp', v)} err=${E('followUp')} />
      <div class="field"><label for="a-ph">Photos (optional)</label><input id="a-ph" type="file" accept="image/*" multiple class="input" onChange=${onPhotos} /><span class="hint">Up to 6. Prototype keeps them for this session only.</span></div>
      ${f.photos.length ? html`<div class="span2 thumbs">${f.photos.map((p, i) => html`<img key=${i} src=${p} alt=${'Photo ' + (i + 1)} />`)}</div>` : null}
      <div class="span2 field"><span class="label">Flag an issue</span><${Seg} label="Flag an issue" value=${f.issue} onChange=${v => set('issue', v)} options=${[[false, 'No issue'], [true, 'Flag issue']]} /></div>
      ${f.issue ? html`<div class="span2"><${Text} id="a-in" label="Issue" value=${f.issueNote} onChange=${v => set('issueNote', v)} err=${E('issueNote')} placeholder="e.g. Cooler not cold, competitor took the fridge" /></div>` : null}
    </div>`,
    html`${Object.keys(errs).length ? html`<div class="banner bad" role="alert"><${Icon} n="alert" s=${18} /><div><b>${Object.keys(errs).length} thing${Object.keys(errs).length > 1 ? 's' : ''} to fix before submitting.</b><ul style="margin:6px 0 0;padding-left:18px">${Object.entries(errs).map(([k, [st, m]]) => html`<li key=${k}><button class="btn ghost sm" style="padding:0;min-height:0;color:inherit;text-decoration:underline" onClick=${() => setStep(st)}>${STEPS[st]}</button>: ${m}</li>`)}</ul></div></div>`
      : html`<div class="banner good"><${Icon} n="check" s=${18} /><div>Ready to submit.${f.status === 'Completed' && loc ? ` The next visit will be due ${fmtDate(addDays(f.date.slice(0, 10), +loc.cycle || 14))}.` : ''}</div></div>`}
      ${f.editingId && monthStatus(s, f.date.slice(0, 7)) === 'Final' ? html`<div class="banner warn"><${Icon} n="lock" s=${18} /><div style="flex:1"><b>${monthLabel(f.date.slice(0, 7))} is finalised.</b> Saving is a logged data correction and needs an administrator step-up. The locked leaderboard doesn’t change.
        <div style="margin-top:8px"><${Text} id="a-reason" label="Reason for correction" value=${f.reason || ''} onChange=${v => set('reason', v)} err=${tried && !(f.reason || '').trim() ? 'Give a reason for the correction.' : null} /></div></div></div>` : null}
      <div class="grid g2">
        <div class="card flat"><h3 style="margin-bottom:8px">Visit</h3><dl class="kv"><dt>Location</dt><dd>${loc ? `${loc.name} (${loc.id})` : '—'}</dd><dt>University</dt><dd>${D.uniBy[f.uni]?.name || '—'}</dd><dt>When</dt><dd>${f.date ? fmtDate(f.date.slice(0, 10)) + ' ' + f.date.slice(11) : '—'}</dd><dt>Staff</dt><dd>${f.staff || '—'}</dd><dt>Status</dt><dd>${f.status}</dd><dt>Contact</dt><dd>${f.contactName ? `${f.contactName}${f.contactRole ? ' · ' + f.contactRole : ''}` : '—'}${f.contactPhone ? html`<br />${f.contactPhone}` : null}${f.contactEmail ? html`<br />${f.contactEmail}` : null}</dd></dl></div>
        ${needsAudit && loc ? html`<div class="card flat"><h3 style="margin-bottom:8px">Ranging</h3><div class="chips">${prods.map(p => html`<span key=${p.key} class=${'chip ' + (f.ranging[p.key] === 1 ? 'good' : f.ranging[p.key] === 0 ? 'plain' : 'bad')}>${p.short}: ${f.ranging[p.key] === 1 ? 'Yes' : f.ranging[p.key] === 0 ? 'No' : 'Missing'}</span>`)}</div></div>
        <div class="card flat"><h3 style="margin-bottom:8px">Pricing & execution</h3><dl class="kv"><dt>Red Bull facings</dt><dd>${+f.rbFacings || 0}</dd><dt>Competitors</dt><dd>${Object.keys(f.compFacings || {}).length ? compDetailText(f.compFacings, f.compDetail, isV).map((t, i) => html`<div key=${i}>${t}</div>`) : 'None recorded'}</dd><dt>Share of shelf</dt><dd>${shelfShare(f.rbFacings, f.compFacings) === null ? '—' : pct0(shelfShare(f.rbFacings, f.compFacings))}</dd><dt>Red Bull price</dt><dd>${money(f.price)}</dd>${isV ? html`<dt>Machine</dt><dd>${f.vendCo || '—'} · ${f.machineId || '—'}</dd><dt>V / Monster SKUs</dt><dd>${f.vSku || '—'} / ${f.mSku || '—'}</dd>` : html`<dt>Red Bull POS / cooler</dt><dd>${f.pos === 1 ? 'Yes' : f.pos === 0 ? 'No' : '—'} / ${f.cooler === 1 ? 'Yes' : f.cooler === 0 ? 'No' : '—'}</dd>`}</dl></div>
        <div class="card flat"><h3 style="margin-bottom:8px">Outcomes</h3><dl class="kv"><dt>Net DPs</dt><dd class="num">${signed((+f.dpAdded || 0) - (+f.dpLost || 0))} (+${+f.dpAdded || 0} / −${+f.dpLost || 0})</dd><dt>Editions sold in</dt><dd>${+f.editions || 0}${f.flavours ? ' · ' + f.flavours : ''}</dd><dt>POS placed</dt><dd>${+f.posPlaced || 0}${f.posType ? ' · ' + f.posType : ''}</dd>${!isV ? html`<dt>Net coolers</dt><dd>${signed((+f.coolersIn || 0) - (+f.coolersOut || 0))}</dd>` : null}</dl></div>` : null}
        <div class="card flat"><h3 style="margin-bottom:8px">Follow-up</h3><dl class="kv"><dt>Next step</dt><dd>${f.nextStep || '—'}</dd><dt>Follow-up</dt><dd>${fmtDate(f.followUp)}</dd><dt>Photos</dt><dd>${f.photos.length}</dd><dt>Issue</dt><dd>${f.issue ? f.issueNote || 'Flagged' : 'None'}</dd></dl></div>
      </div>`,
  ];
  return html`<div class="audit-wrap">
    <div class="page-h"><div><div class="eyebrow">${f.editingId ? 'Editing ' + f.editingId : 'Step ' + (step + 1) + ' of 6'}</div><h1>${loc ? loc.name : 'Start Audit'}</h1>${loc ? html`<div class="chips" style="margin-top:6px"><${TypeChip} type=${loc.type} l=${loc} /><span class="chip plain">${loc.id}</span><${StatusChip} status=${loc.status} /></div>` : null}</div></div>
    <nav class="stepper" aria-label="Audit steps">${STEPS.map((t, i) => html`<button key=${t} class=${'step ' + ((tried || step === 5) && stepErr(i) ? 'miss' : i < step ? 'done' : '')} aria-current=${step === i ? 'step' : undefined} onClick=${() => setStep(i)}><i>${(tried || step === 5) && stepErr(i) ? '!' : i < step ? '✓' : i + 1}</i>${t}</button>`)}</nav>
    <section class="card" aria-labelledby="step-h"><h2 id="step-h" style="margin-bottom:14px">${STEPS[step]}</h2><div style="display:flex;flex-direction:column;gap:14px">${body[step]}</div></section>
    ${confirmLeave ? html`<div class="inline-confirm"><span>Leave without saving? ${s.drafts.some(x => x.draftId === f.draftId) ? 'Your last saved draft is kept.' : 'Unsaved answers will be lost.'}</span><span class="chips"><button class="btn sm" onClick=${() => setConfirmLeave(false)}>Keep editing</button><button class="btn sm" onClick=${() => { saveDraft(); d({ type: 'nav', route: { page: 'visits' } }); }}>Save draft and leave</button><button class="btn sm danger" onClick=${() => d({ type: 'nav', route: { page: 'visits' } })}>Leave</button></span></div>` : null}
    <div class="audit-foot"><div class="chips"><button class="btn ghost" onClick=${leave}>Cancel</button>${!f.editingId ? html`<button class="btn" onClick=${saveDraft}>Save as Draft</button>` : null}</div>
      <div class="chips">${step > 0 ? html`<button class="btn" onClick=${() => setStep(step - 1)}>Back</button>` : null}
        ${step < 5 ? html`<button class="btn primary" onClick=${() => setStep(!needsAudit && step === 0 ? 4 : step + 1)}>Next</button>` : html`<button class="btn primary" onClick=${submit} disabled=${tried && Object.keys(errs).length > 0}>${f.editingId ? 'Save changes' : f.status === 'Completed' ? 'Submit Completed Audit' : `Save ${f.status} Visit`}</button>`}</div></div>
  </div>`;
}

function VisitView({ id, onClose }) {
  const { s, d, D } = useApp();
  const v = s.visits.find(x => x.id === id); if (!v) return null; const l = D.locBy[v.loc];
  const canEdit = D.can.editVisit(v);
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="vv-h"><div class="sheet-h"><div><div class="xs muted">${v.id}</div><h2 id="vv-h">${l?.name || v.loc}</h2></div><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><div class="chips"><${VisitChip} status=${v.status} />${v.status === 'Completed' && v.staff && !v.imported ? html`<${ApprovalChip} v=${v} />` : null}${l ? html`<${TypeChip} type=${l.type} l=${l} />` : null}<span class="chip plain">${fmtDate(v.date)}${v.time ? ' · ' + v.time : ''}</span></div>
      ${v.issue ? html`<div class="banner bad"><${Icon} n="flag" s=${18} /><div><b>Issue flagged.</b> ${v.issue}</div></div>` : null}
      ${v.rejectReason ? html`<div class="banner bad"><${Icon} n="x" s=${18} /><div><b>Not counted.</b> ${v.rejectReason} (${v.approvedBy})</div></div>` : null}
      <dl class="dl"><div><dt>Staff</dt><dd>${v.staff || 'Not recorded'}</dd></div><div><dt>DPs added / lost</dt><dd class="num">+${v.dpAdded} / −${v.dpLost}</dd></div><div><dt>Net DPs</dt><dd class="num">${signed(v.dpAdded - v.dpLost)}</dd></div>
        <div><dt>Editions sold in</dt><dd class="num">${v.editions}${v.flavours ? ' · ' + v.flavours : ''}</dd></div><div><dt>POS placed</dt><dd class="num">${v.posPlaced}${v.posType ? ' · ' + v.posType : ''}</dd></div><div><dt>Coolers in / out</dt><dd class="num">${v.coolersIn} / ${v.coolersOut} (net ${signed(v.coolersIn - v.coolersOut)})</dd></div>
        ${v.rbFacings !== null && v.rbFacings !== undefined ? html`<div><dt>Red Bull facings</dt><dd class="num">${v.rbFacings}</dd></div><div><dt>Competitors</dt><dd>${v.compFacings && Object.keys(v.compFacings).length ? compDetailText(v.compFacings, v.compDetail, l?.type === 'Vending').map((t, i) => html`<div key=${i}>${t}</div>`) : 'None recorded'}</dd></div><div><dt>Share of shelf</dt><dd class="num">${shelfShare(v.rbFacings, v.compFacings) === null ? '—' : pct0(shelfShare(v.rbFacings, v.compFacings))}</dd></div>` : null}
        ${v.contactName ? html`<div><dt>Spoke to</dt><dd>${v.contactName}${v.contactRole ? ' · ' + v.contactRole : ''}</dd></div>` : null}
        <div><dt>Follow-up</dt><dd>${fmtDate(v.followUp)}</dd></div><div><dt>Photos</dt><dd>${v.photos ? v.photos + ' attached (prototype: not stored)' : 'None'}</dd></div></dl>
      <div><div class="label">Notes</div><p style="margin:4px 0 0">${v.notes || '—'}</p></div><div><div class="label">Next step</div><p style="margin:4px 0 0">${v.nextStep || '—'}</p></div>
      ${v.imported ? html`<div class="banner info"><${Icon} n="copy" s=${18} /><div>Imported from the workbook's last-visit date. Outcomes weren't recorded at the time.</div></div>` : null}</div>
    <div class="sheet-f">${l ? html`<button class="btn" onClick=${() => { onClose(); d({ type: 'nav', route: { page: 'loc', id: l.id } }); }}>Open location</button>` : null}
      ${canEdit && !v.imported ? html`<button class="btn primary" onClick=${() => { onClose(); d({ type: 'nav', route: { page: 'audit', edit: v.id } }); }}><${Icon} n="edit" s=${16} />Edit visit</button>` : null}</div></div>`;
}
function Performance({ uni, ls }) {
  const { s, D } = useApp();
  const [type, setType] = useState('All');
  const L = ls.filter(l => type === 'All' || storeTypeOf(l) === type);
  const x = summarise(L, s.visits, rangeStart('14', D.today), D.today); const all = summarise(L, s.visits, '0000-01-01', D.today);
  const months = monthsSeries(s.visits, new Set(L.map(l => l.id)));
  return html`<div class="toolbar"><${Select} id="pf-stt" label="Store location type" value=${type} onChange=${setType} options=${storeTypeOpts(s)} /></div>
  <div class="kpis"><${Kpi} label="Required (fortnight)" value=${x.required} /><${Kpi} label="Completed (fortnight)" value=${x.completed} tone="good" icon="check" /><${Kpi} label="Completion" value=${Math.round(x.pct * 100) + '%'} />
    <${Kpi} label="Net DPs" value=${signed(all.dpAdded - all.dpLost)} sub=${`+${all.dpAdded} / −${all.dpLost}`} /><${Kpi} label="Editions sold in" value=${all.editions} /><${Kpi} label="POS placed" value=${all.posPlaced} />
    <${Kpi} label="Coolers in / out" value=${`${all.coolersIn} / ${all.coolersOut}`} /><${Kpi} label="Net coolers" value=${signed(all.coolersIn - all.coolersOut)} /></div>
  <section class="card"><div class="card-h"><h2>Completed visits by month</h2><span class="xs muted">Last 12 months</span></div><${MonthTrend} months=${months} caption="Completed visits by month" /></section>`;
}

Object.assign(P, {
  inbox: 'M3 13h5l2 3h4l2-3h5M5 4h14l2 9v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', tafe: 'M4 21V9l8-5 8 5v12M9 21v-6h6v6M4 21h16',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
});
const InstBadge = ({ u, size = 44 }) => u.logo
  ? html`<span class="ulogo" style=${{ width: Math.round(size * 1.6) + 'px', height: size + 'px' }}><img src=${u.logo} alt=${u.name + ' logo'} /></span>`
  : html`<span class="ulogo mono" aria-hidden="true" style=${{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * (u.code.length > 4 ? 0.28 : u.code.length > 3 ? 0.32 : 0.38)) + 'px' }}>${u.code}</span>`;
const shrinkLogo = file => new Promise((res, rej) => { const rd = new FileReader(); rd.onerror = rej; rd.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => {
  const k = Math.min(1, 160 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); let out = c.toDataURL('image/webp', 0.9); if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/png'); res(out); }; img.src = rd.result; }; rd.readAsDataURL(file); });
const KindChip = ({ kind }) => html`<span class=${kind === 'TAFE' ? 'chip tafe' : 'chip unitag'}><${Icon} n=${kind === 'TAFE' ? 'tafe' : 'uni'} s=${13} />${kind}</span>`;
const LocStateChip = ({ s }) => (s === 'Active' ? html`<span class="chip plain">Active</span>` : s === 'Removed' ? html`<span class="chip muted"><${Icon} n="trash" s=${12} />Removed</span>` : html`<span class="chip muted">Paused</span>`);
const RoleChip = ({ role }) => html`<span class=${'chip ' + (role === 'admin' ? 'type' : 'plain')}>${role === 'admin' ? html`<${Icon} n="shield" s=${12} />` : null}${ROLE_LABEL[role]}</span>`;
const StatePick = ({ value, onChange, D, s, allLabel = 'National' }) => D.isAdmin
  ? html`<div class="field fit"><span class="label">State</span><${Seg} label="State" value=${value} onChange=${onChange} options=${[['all', allLabel], ...s.states.map(x => [x.code, x.code])]} /></div>`
  : html`<div class="field"><span class="label">State</span><span class="chip type" style="min-height:40px;padding:0 14px;font-size:14px">${D.meP.state}</span></div>`;

/* ======================= SHELL ======================= */
const NAV = [['dashboard', 'Dashboard', 'home'], ['leaderboard', 'National Leaderboard', 'trophy'], ['visits', 'My Visits', 'visits'], ['universities', 'Universities & TAFEs', 'uni'], ['locations', 'Audit Locations', 'pin'], ['progress', 'Progress', 'chart'], ['notifications', 'Notifications', 'inbox'], ['people', 'People', 'people'], ['settings', 'Settings', 'gear']];
function useInbox(s, D) {
  return useMemo(() => {
    const me = D.meP.name; const items = [];
    for (const n of s.notifications) if (n.to.includes(me)) items.push({ key: n.id, ts: n.ts, kind: n.kind, title: n.title, body: n.body, ref: n.ref });
    for (const ds of dailySummaries(s, D)) if (ds.to.includes(me) || ds.staff === me) items.push({ key: ds.key, ts: ds.date + 'T18:00:00', kind: 'summary', title: `Daily summary: ${ds.staff}, ${fmtDate(ds.date)}`, body: `${ds.total} audits · ${[...ds.universities, ...ds.tafes].join(', ')}`, ref: { page: 'notifications', tab: 'Daily summaries', key: ds.key } });
    // Monthly summaries: state summary to its Managers and Education Channel Lead, national breakdown to Administrators (on the 1st)
    // Monthly audit export: ready on the last calendar day of each month (Administrators: all states; Managers: their state)
    { const xs = exportStates(s, D); if (xs.length) for (const m of exportMonths(D).filter(x => x.ready).slice(0, 6))
      items.push({ key: `AX|${D.isAdmin ? 'ALL' : xs[0]}|${m.month}`, ts: m.last + 'T18:00:00', kind: 'export', title: `Audit export ready: ${monthLabel(m.month)}${D.isAdmin ? ' · all states' : ' · ' + xs[0]}`,
        body: `Excel with every audit${D.isAdmin ? ', one sheet per state' : ''} · ${xs.reduce((t, st) => t + auditsFor(s, D, m.month, st).length, 0)} records`, ref: { page: 'notifications', tab: 'Audit exports' } }); }
    if (!D.isSM) for (const sm of monthlyFor(s, D)) if (sm.closed && (sm.kind === 'national' || sm.to.includes(me)))
      items.push({ key: sm.key, ts: summaryTs(sm.month), kind: 'monthly', title: sm.kind === 'national' ? `National breakdown: ${monthLabel(sm.month)}` : `Monthly summary: ${sm.st}, ${monthLabel(sm.month)}`,
        body: `${sm.x.audits} audits · ${sm.x.editions} Editions · ${sm.x.pos} POS · ${sm.x.coolersIn} coolers · share of shelf ${pctOr(sm.x.share)} · ranging ${pctOr(sm.x.ranging)}`, ref: { page: 'notifications', tab: 'Monthly summaries', key: sm.key } });
    // Visit reminders for Student Marketeers: locations they last audited
    if (D.isSM) for (const l of D.locs) if (l.locStatus === 'Active' && l.lastBy === me && (l.status === 'Overdue' || (l.days !== null && l.days >= 0 && l.days <= s.ref.reminderLeadDays)))
      items.push({ key: `R|${l.id}|${l.due}`, ts: l.due + 'T07:00:00', kind: l.status === 'Overdue' ? 'overdue' : 'due', title: `${l.status === 'Overdue' ? 'Overdue' : 'Due soon'}: ${l.name}`, body: `${l.uniName} · ${dueText(l).t}`, ref: { page: 'loc', id: l.id } });
    return items.sort((a, b) => b.ts.localeCompare(a.ts)).map(i => ({ ...i, read: !!s.readKeys[i.key + '|' + me] }));
  }, [s.notifications, s.visits, s.demo, s.snapshots, s.readKeys, D]);
}
function Shell({ children }) {
  const { s, d, D } = useApp();
  const page = s.route.page;
  const inbox = useInbox(s, D);
  const unread = inbox.filter(i => !i.read).length;
  const pending = s.requests.filter(r => r.status === 'Pending' && D.can.approve(r)).length;
  const go = p => d({ type: 'nav', route: { page: p } });
  const active = p => page === p || (p === 'universities' && page === 'uni') || (p === 'locations' && page === 'loc');
  const title = { dashboard: 'Dashboard', visits: 'My Visits', universities: 'Universities & TAFEs', uni: D.uniBy[s.route.code]?.name, locations: 'Audit Locations', loc: s.route.id, progress: 'Progress', people: 'People', settings: 'Settings', audit: 'Start Audit', notifications: 'Notifications', leaderboard: 'National Leaderboard' }[page];
  const where = D.isAdmin ? 'National' : D.meP.state;
  return html`<div class="shell">
    <nav class="rail" aria-label="Main">
      <div class="wordmark">ECA<span>Education Channel Audit Tool</span></div>
      <div class="start"><button class="btn start-cta" onClick=${() => go('audit')}><${Icon} n="play" s=${16} />Start Audit</button></div>
      ${NAV.map(([p, t, i]) => html`<button key=${p} class="navbtn" aria-current=${active(p) ? 'page' : undefined} onClick=${() => go(p)}><${Icon} n=${i} /><span style="flex:1">${t}</span>${p === 'notifications' && unread + pending ? html`<span class="chip bad" style="padding:0 7px">${unread + pending}</span>` : null}</button>`)}
      <div class="grow"></div>
      <div class="who"><b>${D.meP.name}</b>${ROLE_LABEL[D.role]} · ${where}${D.leadOf.length ? html`<br />Channel lead · ${D.leadOf.join(', ')}` : null}<br /><span class="xs">Prototype · saved in this browser</span>
        <button class="navbtn" style="margin-top:8px;padding:8px 10px" onClick=${() => d({ type: 'logout' })}><${Icon} n="logout" s=${16} />Sign out</button></div>
    </nav>
    <div class="main">
      <header class="topbar">
        ${page === 'uni' || page === 'loc' ? html`<button class="iconbtn" aria-label="Back" onClick=${() => go(page === 'uni' ? 'universities' : 'locations')}><${Icon} n="back" /></button>` : null}
        <div class="crumb"><span class="page-title">${title || 'ECA'}</span></div>
        <${SyncChip} /><span class="chip plain hide-m">${ROLE_LABEL[D.role]} · ${where}</span>
        <button class="iconbtn" aria-label=${`Notifications, ${unread} unread`} aria-expanded=${String(s.notifOpen)} onClick=${() => d({ type: 'notifOpen', open: !s.notifOpen })}><${Icon} n="bell" />${unread + pending ? html`<span class="dot num">${unread + pending > 99 ? '99+' : unread + pending}</span>` : null}</button>
        ${s.notifOpen ? html`<${NotifPanel} inbox=${inbox} pending=${pending} />` : null}
      </header>
      <main class="content" id="main">${s.sync?.mode === 'shared' && !s.sharedLoaded ? html`<${Empty} title="Loading shared data…" body="Getting the latest audits, people and locations." />` : children}</main>
    </div>
    <nav class="bottombar" aria-label="Main">
      ${[['dashboard', 'Home', 'home'], ['visits', 'Visits', 'visits'], ['audit', 'Audit', 'play'], ['leaderboard', 'Leaders', 'trophy'], ['more', 'More', 'more']].map(([p, t, i]) => html`<button key=${p} class=${p === 'audit' ? 'fab' : ''}
        aria-current=${(p === 'more' ? ['universities', 'uni', 'locations', 'loc', 'progress', 'people', 'settings', 'notifications'].includes(page) : active(p) || (p === 'audit' && page === 'audit')) ? 'page' : undefined}
        onClick=${() => (p === 'more' ? d({ type: 'modal', modal: { kind: 'more' } }) : go(p))}><${Icon} n=${i} />${t}</button>`)}
    </nav>
    ${s.toast ? html`<div class="toast" role="status"><${Icon} n="check" s=${16} />${s.toast}</div>` : null}
    ${s.modal ? html`<${Modal} />` : null}
  </div>`;
}
const KIND_ICON = { audit: 'check', request: 'flag', decision: 'shield', summary: 'mail', overdue: 'alert', due: 'clock', results: 'trophy', monthly: 'chart', export: 'download' };
function InboxRow({ i }) {
  const { d } = useApp();
  return html`<button class="rowbtn" style="padding:12px 14px" onClick=${() => { d({ type: 'read', keys: [i.key] }); if (i.ref) d({ type: 'nav', route: i.ref }); }}>
    <span class=${'chip ' + (i.kind === 'overdue' ? 'bad' : i.kind === 'due' ? 'warn' : i.kind === 'request' ? 'warn' : 'plain')} style="padding:4px"><${Icon} n=${KIND_ICON[i.kind] || 'bell'} s=${14} /></span>
    <div class="main-c" style="flex:1;min-width:0"><div class="t" style="font-weight:${i.read ? 500 : 700}">${i.title}</div><div class="m">${i.body}</div></div>
    <span class="xs muted num" style="white-space:nowrap">${fmtShort(i.ts.slice(0, 10))}</span></button>`;
}
function NotifPanel({ inbox, pending }) {
  const { d } = useApp();
  return html`<div class="notif" role="dialog" aria-label="Notifications">
    <div class="card-h" style="padding:12px 14px 0"><h3>Notifications</h3><button class="btn sm ghost" onClick=${() => d({ type: 'nav', route: { page: 'notifications' } })}>Open centre</button></div>
    ${pending ? html`<button class="rowbtn" style="padding:10px 14px;background:var(--accent-tint)" onClick=${() => d({ type: 'nav', route: { page: 'notifications', tab: 'Requests' } })}><${Icon} n="flag" s=${16} /><b style="flex:1">${pending} removal request${pending > 1 ? 's' : ''} waiting for you</b><${Icon} n="chev" s=${14} /></button>` : null}
    ${inbox.length ? html`<div class="list">${inbox.slice(0, 12).map(i => html`<${InboxRow} key=${i.key} i=${i} />`)}</div>` : html`<${Empty} title="Nothing new" body="Audit alerts, removal requests and daily summaries show up here." />`}
  </div>`;
}
function Modal() {
  const { s, d } = useApp();
  const m = s.modal; const close = () => d({ type: 'modal', modal: null });
  useEffect(() => { const k = e => e.key === 'Escape' && close(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  let body = null;
  if (m.kind === 'more') body = html`<div class="sheet"><div class="sheet-h"><h2>More</h2><button class="iconbtn" aria-label="Close" onClick=${close}><${Icon} n="x" /></button></div>
    <div class="sheet-b" style="gap:4px">${NAV.filter(n => !['dashboard', 'visits', 'leaderboard'].includes(n[0])).map(([p, t, i]) => html`<button key=${p} class="rowbtn" onClick=${() => { close(); d({ type: 'nav', route: { page: p } }); }}><${Icon} n=${i} /><span style="flex:1">${t}</span><${Icon} n="chev" s=${16} /></button>`)}</div></div>`;
  if (m.kind === 'location') body = html`<${LocationForm} loc=${m.loc} uni=${m.uni} onClose=${close} />`;
  if (m.kind === 'inst') body = html`<${InstForm} inst=${m.inst} state=${m.state} onClose=${close} />`;
  if (m.kind === 'person') body = html`<${PersonForm} person=${m.person} onClose=${close} />`;
  if (m.kind === 'removal') body = html`<${RemovalForm} target=${m.target} onClose=${close} />`;
  if (m.kind === 'visit') body = html`<${VisitView} id=${m.id} onClose=${close} />`;
  if (m.kind === 'summary') body = html`<${SummaryView} k=${m.key} onClose=${close} />`;
  if (m.kind === 'monthly') body = html`<${MonthlyView} k=${m.key} onClose=${close} />`;
  if (m.kind === 'syncHelp') body = html`<${SyncHelp} onClose=${close} />`;
  if (m.kind === 'drill') body = html`<${DrillSheet} month=${m.month} name=${m.name} onClose=${close} />`;
  if (m.kind === 'elevate') body = html`<${ElevateSheet} m=${m} onClose=${close} />`;
  if (m.kind === 'finalise') body = html`<${FinaliseSheet} month=${m.month} onClose=${close} />`;
  if (m.kind === 'distribute') body = html`<${DistributeSheet} month=${m.month} onClose=${close} />`;
  return html`<div class="scrim" onClick=${e => e.target === e.currentTarget && close()}>${body}</div>`;
}

/* ======================= FILTERS ======================= */
function useFilters(init) {
  const { D } = useApp();
  return useState(() => ({ state: D.isAdmin ? 'all' : D.meP.state, kind: 'All', uni: 'all', type: 'All', range: '14', q: '', campus: 'all', ...init }));
}
function Filters({ f, setF, showSearch = true, showRange = true, showUni = true }) {
  const { s, D } = useApp();
  const unis = D.liveUnis.filter(u => D.scopeUnis.includes(u.code) && (f.state === 'all' || u.state === f.state) && (f.kind === 'All' || u.kind === f.kind));
  return html`<div class="toolbar">
    <${StatePick} value=${f.state} onChange=${v => setF({ ...f, state: v, uni: 'all' })} D=${D} s=${s} />
    <div class="field fit"><span class="label">Institution</span><${Seg} label="Institution type" value=${f.kind} onChange=${v => setF({ ...f, kind: v, uni: 'all' })} options=${['All', 'University', 'TAFE']} /></div>
    ${showUni ? html`<${Select} id="f-uni" label="University or TAFE" value=${f.uni} onChange=${v => setF({ ...f, uni: v })} options=${[['all', 'All'], ...unis.map(u => [u.code, u.name])]} />` : null}
    <${Select} id="f-st" label="Store location type" value=${f.storeType || 'All'} onChange=${v => setF({ ...f, storeType: v })} options=${storeTypeOpts(s)} />
    ${showRange ? html`<${Select} id="f-range" label="Date range" value=${f.range} onChange=${v => setF({ ...f, range: v })} options=${RANGES} />` : null}
    ${showSearch ? html`<div class="field wide" style="flex:1 1 200px"><span class="label">Search</span><${Search} id="f-q" value=${f.q} onChange=${v => setF({ ...f, q: v })} placeholder="Store, machine, ID, campus" /></div>` : null}
  </div>`;
}
const instRows = (s, D, f, locs, start) => D.liveUnis.filter(u => D.scopeUnis.includes(u.code) && (f.state === 'all' || u.state === f.state) && (f.kind === 'All' || u.kind === f.kind) && (f.uni === 'all' || f.uni === u.code))
  .map(u => { const ls = locs.filter(l => l.uni === u.code); const x = summarise(ls, s.visits, start, D.today); return { u, ls, x, label: u.short || u.name }; });
const stateRows = (s, D, f, locs, start) => s.states.filter(st => D.scopeStates.includes(st.code)).map(st => { const ls = locs.filter(l => l.state === st.code); const x = summarise(ls, s.visits, start, D.today); return { st, ls, x, label: st.code, insts: D.liveUnis.filter(u => u.state === st.code).length }; });
const statusRow = (label, ls) => ({ label, ...Object.fromEntries(STATUS_KEYS.map(k => [k, ls.filter(l => l.locStatus === 'Active' && l.status === k).length])) });

/* ======================= DASHBOARD ======================= */
function Dashboard() {
  const { s, d, D } = useApp();
  const [f, setF] = useFilters();
  const locs = filterLocs(D.locs, f, D);
  const start = rangeStart(f.range, D.today);
  const sm = summarise(locs, s.visits, start, D.today);
  const national = f.state === 'all';
  const rows = national ? stateRows(s, D, f, locs, start) : instRows(s, D, f, locs, start);
  const overdue = locs.filter(l => l.locStatus === 'Active' && l.status === 'Overdue').sort((a, b) => a.days - b.days).slice(0, 8);
  const recent = sm.vIn.slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 8);
  const pend = s.requests.filter(r => r.status === 'Pending' && D.scopeStates.includes(r.state));
  const greet = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();
  return html`<div class="page-h"><div><div class="eyebrow">ECA · reporting date ${fmtDate(D.today)} · ${national ? 'National' : f.state}</div><h1>${greet}, ${D.meP.name.split(' ')[0]}</h1>
    <p>${ROLE_LABEL[D.role]}${D.isAdmin ? ', all states' : `, ${D.meP.state}`}${D.leadOf.length ? ` · Education Channel Lead for ${D.leadOf.join(', ')}` : ''}</p></div>
    <div class="chips"><button class="btn primary" onClick=${() => d({ type: 'nav', route: { page: 'audit' } })}><${Icon} n="play" s=${16} />Start Audit</button>
      <button class="btn" onClick=${() => d({ type: 'modal', modal: { kind: 'location' } })}><${Icon} n="plus" s=${16} />Add Location</button>
      ${D.can.managePeople ? html`<button class="btn" onClick=${() => d({ type: 'modal', modal: { kind: 'person' } })}><${Icon} n="people" s=${16} />Add Person</button>` : null}
      <button class="btn" onClick=${() => d({ type: 'nav', route: { page: 'progress' } })}><${Icon} n="chart" s=${16} />View Progress</button></div></div>
  <${Filters} f=${f} setF=${setF} />
  ${pend.length ? html`<div class="banner warn"><${Icon} n="flag" s=${18} /><div style="flex:1"><b>${pend.length} removal request${pend.length > 1 ? 's' : ''} pending</b> ${pend.some(r => D.can.approve(r)) ? 'waiting for your approval.' : 'with the Education Channel Lead.'}</div><button class="btn sm" onClick=${() => d({ type: 'nav', route: { page: 'notifications', tab: 'Requests' } })}>Review</button></div>` : null}
  <div class="kpis">
    <${Kpi} label="Active locations" value=${sm.active} sub=${`${sm.qsr} QSR · ${sm.vending} vending`} />
    <${Kpi} label="Visits required" value=${sm.required} sub="One per active location per cycle" />
    <${Kpi} label="Visits completed" value=${sm.completed} sub=${RANGES.find(r => r[0] === f.range)[1]} tone="good" icon="check" />
    <${Kpi} label="Completion" value=${Math.round(sm.pct * 100) + '%'} sub=${`${sm.completed} of ${sm.required}`} />
    <${Kpi} label="Overdue" value=${sm.overdue} sub="Past next due date" tone="bad" icon="alert" />
    <${Kpi} label="Due soon" value=${sm.dueSoon} sub=${`Within ${s.ref.dueSoonDays} days`} tone="warn" icon="clock" />
    <${Kpi} label="No visit recorded" value=${sm.noVisit} sub="No completed visit yet" tone="none" icon="circle" />
    <${Kpi} label="Net distribution points" value=${signed(sm.dpAdded - sm.dpLost)} sub=${`+${sm.dpAdded} added · −${sm.dpLost} lost`} />
  </div>
  <div class="grid g2">
    <section class="card"><div class="card-h"><h2>Required vs completed</h2><span class="xs muted">${national ? 'By state' : 'By university and TAFE'}</span></div>
      ${rows.length ? html`<${ClusterBars} rows=${rows.map(r => ({ label: r.label, required: r.x.required, completed: r.x.completed }))} a="required" b="completed" aLabel="Required" bLabel="Completed" caption="Required versus completed visits" />` : html`<${Empty} title="No institutions yet" body=${`Add the first university or TAFE for ${f.state}.`} />`}</section>
    <section class="card"><div class="card-h"><h2>Location status</h2><span class="xs muted">Active locations today</span></div>
      ${rows.length ? html`<${StackBars} rows=${rows.map(r => statusRow(r.label, r.ls))} caption="Location visit status" />` : null}</section>
  </div>
  <div class="grid g2">
    <section class="card"><div class="card-h"><h2>Overdue priorities</h2><span class="chip bad"><${Icon} n="alert" s=${13} w=${2.4} />${sm.overdue} overdue</span></div>
      ${overdue.length ? html`<div class="list">${overdue.map(l => html`<div class="row" key=${l.id}>
        <button class="rowbtn" style="flex:1;border:0;padding:0" onClick=${() => d({ type: 'nav', route: { page: 'loc', id: l.id } })}><div class="main-c"><div class="t">${l.name}</div><div class="m">${l.state} · ${l.uniName} · ${l.id}</div></div></button>
        <span class="due-big bad num" style="font-size:16px">${-l.days}d</span><button class="btn sm" onClick=${() => d({ type: 'nav', route: { page: 'audit', loc: l.id } })}>Audit</button></div>`)}</div>`
        : html`<${Empty} title="Nothing overdue" body="Every active location in this view is on track or due soon." />`}</section>
    <section class="card"><div class="card-h"><h2>Recently completed audits</h2></div>
      ${recent.length ? html`<div class="list">${recent.map(v => { const l = D.locBy[v.loc]; return html`<button key=${v.id} class="rowbtn" onClick=${() => d({ type: 'modal', modal: { kind: 'visit', id: v.id } })}>
        <div class="main-c" style="flex:1;min-width:0"><div class="t">${l?.name || v.loc}</div><div class="m">${fmtDate(v.date)} · ${v.staff || 'Staff not recorded'}${v.dpAdded || v.dpLost ? ` · DPs ${signed(v.dpAdded - v.dpLost)}` : ''}</div></div><${VisitChip} status="Completed" /></button>`; })}</div>`
        : html`<${Empty} title="No audits in this range" body="Completed audits will appear here." />`}</section>
  </div>`;
}

/* ======================= MY VISITS ======================= */
function VisitCard({ l }) {
  const { d } = useApp(); const dt = dueText(l); const tone = STATUS[l.status].tone;
  const dir = l.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.address, l.postcode, l.state].filter(Boolean).join(' '))}` : null;
  return html`<article class=${'vcard ' + tone}>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><div class="xs muted" style="font-weight:600">${l.uniName} · ${l.campus}</div><div class="name">${l.name}</div></div><${StatusChip} status=${l.status} /></div>
    <div class="chips"><${TypeChip} type=${l.type} l=${l} /><span class="chip plain">${l.id}</span>${l.kind === 'TAFE' ? html`<${KindChip} kind="TAFE" />` : null}</div>
    <span class=${'due-big num ' + dt.tone}>${dt.t}</span>
    <dl class="kv"><dt>Last completed</dt><dd>${fmtDate(l.last)}</dd><dt>Next due</dt><dd>${fmtDate(l.due)}</dd><dt>Last visited by</dt><dd>${l.lastBy || 'Not recorded'}</dd>
      ${l.notes ? html`<dt>Next step</dt><dd style="font-weight:500">${l.notes.length > 120 ? l.notes.slice(0, 117) + '…' : l.notes}</dd>` : null}</dl>
    <div class="chips" style="margin-top:auto"><button class="btn primary sm" onClick=${() => d({ type: 'nav', route: { page: 'audit', loc: l.id } })}><${Icon} n="play" s=${14} />Start Audit</button>
      <button class="btn sm" onClick=${() => d({ type: 'nav', route: { page: 'loc', id: l.id } })}>Details</button>
      ${dir ? html`<a class="btn sm ghost" href=${dir} target="_blank" rel="noopener"><${Icon} n="map" s=${14} />Directions</a>` : null}</div></article>`;
}
function MyVisits() {
  const { s, d, D } = useApp();
  const [tab, setTab] = useState('To visit');
  const [f, setF] = useFilters({ range: 'all' });
  const [chip, setChip] = useState('All'); const [sort, setSort] = useState('urgency'); const [shown, setShown] = useState(24);
  const base = filterLocs(D.locs, f, D).filter(l => l.locStatus === 'Active');
  const t = D.today;
  const pass = l => chip === 'All' ? true : chip === 'Today' ? l.due <= t : chip === 'This Week' ? l.due <= addDays(t, 7) : chip === 'Overdue' ? l.status === 'Overdue' : chip === 'Due Soon' ? l.status === 'Due Soon' : chip === 'Completed' ? l.last && diffDays(t, l.last) < (+l.cycle || 14) : true;
  const list = base.filter(pass).sort(sort === 'urgency' ? (a, b) => (STATUS[a.status].order - STATUS[b.status].order) || ((a.days ?? 99) - (b.days ?? 99)) : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.uniName.localeCompare(b.uniName) || a.name.localeCompare(b.name));
  const unis = D.liveUnis.filter(u => D.scopeUnis.includes(u.code) && (f.state === 'all' || u.state === f.state));
  const campuses = f.uni !== 'all' ? D.uniBy[f.uni].campuses : [...new Set(base.map(l => l.campus))].sort();
  const mine = s.visits.filter(v => v.staff === D.meP.name).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const myDrafts = s.drafts.filter(x => x.owner === D.meP.name);
  return html`<div class="page-h"><div><h1>My Visits</h1><p>${D.isSM ? `Any university or TAFE in ${D.meP.state}. You're not locked to a campus.` : 'Every active location in your scope, most urgent first.'}</p></div>
    <button class="btn primary" onClick=${() => d({ type: 'nav', route: { page: 'audit' } })}><${Icon} n="play" s=${16} />Start Audit</button></div>
  <div class="tabs" role="tablist">${['To visit', 'My submissions'].map(x => html`<button key=${x} role="tab" aria-selected=${String(tab === x)} onClick=${() => setTab(x)}>${x}${x === 'My submissions' ? ` (${mine.length})` : ''}</button>`)}</div>
  ${myDrafts.length ? html`<section class="card flat"><div class="card-h"><h3>Saved drafts</h3></div><div class="list">${myDrafts.map(x => html`<div class="row" key=${x.draftId}><div class="main-c"><div class="t">${D.locBy[x.loc]?.name || 'No location chosen yet'}</div><div class="m">Saved ${new Date(x.savedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
    <button class="btn sm primary" onClick=${() => d({ type: 'nav', route: { page: 'audit', draft: x.draftId } })}>Resume</button><button class="btn sm danger" onClick=${() => { d({ type: 'deleteDraft', draftId: x.draftId }); d({ type: 'toast', msg: 'Draft deleted' }); }}>Delete</button></div>`)}</div></section>` : null}
  ${tab === 'My submissions' ? (mine.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Location</th><th class="hide-m">Institution</th><th>Status</th><th class="n hide-m">Net DPs</th></tr></thead><tbody>${mine.map(v => html`<tr key=${v.id} class="click" tabindex="0" onClick=${() => d({ type: 'modal', modal: { kind: 'visit', id: v.id } })}><td class="num">${fmtDate(v.date)}</td><td>${D.locBy[v.loc]?.name || v.loc}</td><td class="hide-m">${D.uniBy[v.uni]?.name}</td><td><${VisitChip} status=${v.status} /></td><td class="n hide-m">${signed(v.dpAdded - v.dpLost)}</td></tr>`)}</tbody></table></div>`
    : html`<${Empty} title="No submissions yet" body="Audits you submit appear here with their outcomes." />`) : html`
  <div class="chips" role="group" aria-label="Quick filters">${['All', 'Today', 'This Week', 'Overdue', 'Due Soon', 'Completed'].map(c => html`<button key=${c} class="fchip" aria-pressed=${String(chip === c)} onClick=${() => setChip(c)}>${c}</button>`)}</div>
  <div class="toolbar">
    ${D.isAdmin ? html`<${StatePick} value=${f.state} onChange=${v => setF({ ...f, state: v, uni: 'all', campus: 'all' })} D=${D} s=${s} />` : null}
    <${Select} id="v-uni" label="University or TAFE" value=${f.uni} onChange=${v => setF({ ...f, uni: v, campus: 'all' })} options=${[['all', 'All'], ...unis.map(u => [u.code, u.name])]} />
    <${Select} id="v-campus" label="Campus" value=${f.campus} onChange=${v => setF({ ...f, campus: v })} options=${[['all', 'All campuses'], ...campuses.map(c => [c, c])]} />
    <${Select} id="v-stt" label="Store location type" value=${f.storeType || 'All'} onChange=${v => setF({ ...f, storeType: v })} options=${storeTypeOpts(s)} />
    <${Select} id="v-sort" label="Sort" value=${sort} onChange=${setSort} options=${[['urgency', 'Most urgent first'], ['name', 'Name A–Z'], ['uni', 'Institution']]} />
    <div class="field wide" style="flex:1 1 200px"><span class="label">Search</span><${Search} id="v-q" value=${f.q} onChange=${v => setF({ ...f, q: v })} placeholder="Store, machine, ID" /></div></div>
  <div class="small muted num" aria-live="polite">${list.length} location${list.length === 1 ? '' : 's'}</div>
  ${list.length ? html`<div class="vcards">${list.slice(0, shown).map(l => html`<${VisitCard} key=${l.id} l=${l} />`)}</div>${list.length > shown ? html`<div style="text-align:center"><button class="btn" onClick=${() => setShown(shown + 24)}>Show more</button></div>` : null}`
    : D.scopeUnis.length === 0 ? html`<${Empty} title=${`No universities or TAFEs set up for ${D.meP.state} yet`} body="A manager or administrator can add them in Universities & TAFEs." />`
    : html`<${Empty} title="No visits match" body="Try another quick filter or clear the search." action=${html`<button class="btn" onClick=${() => { setChip('All'); setF({ ...f, q: '', campus: 'all', type: 'All' }); }}>Clear filters</button>`} />`}`}`;
}

/* ======================= UNIVERSITIES & TAFEs ======================= */
function Universities() {
  const { s, d, D } = useApp();
  const [kind, setKind] = useState('All'); const [stF, setStF] = useState(D.isAdmin ? 'all' : D.meP.state);
  const start = rangeStart('14', D.today);
  const states = s.states.filter(x => D.scopeStates.includes(x.code) && (stF === 'all' || x.code === stF));
  return html`<div class="page-h"><div><h1>Universities & TAFEs</h1><p>Fortnightly completion, last 14 days.</p></div>
    ${D.can.manageInstitutions ? html`<button class="btn primary" onClick=${() => d({ type: 'modal', modal: { kind: 'inst', state: stF === 'all' ? null : stF } })}><${Icon} n="plus" s=${16} />Add university or TAFE</button>` : null}</div>
  <div class="toolbar"><${StatePick} value=${stF} onChange=${setStF} D=${D} s=${s} allLabel="All states" /><div class="field"><span class="label">Type</span><${Seg} label="Institution type" value=${kind} onChange=${setKind} options=${['All', 'University', 'TAFE']} /></div></div>
  ${states.map(st => { const us = D.liveUnis.filter(u => u.state === st.code && (kind === 'All' || u.kind === kind));
    return html`<section key=${st.code} style="display:flex;flex-direction:column;gap:12px"><div class="card-h" style="margin:0"><h2>${st.name} <span class="muted" style="font-size:16px">· ${us.length}</span></h2></div>
    ${us.length ? html`<div class="ucards">${us.map(u => { const ls = D.locs.filter(l => l.uni === u.code); const x = summarise(ls, s.visits, start, D.today);
      return html`<button key=${u.code} class="ucard" onClick=${() => d({ type: 'nav', route: { page: 'uni', code: u.code, tab: 'Overview' } })} aria-label=${`${u.name}: ${x.active} active locations, ${Math.round(x.pct * 100)}% complete`}>
        <div style="display:flex;gap:12px;align-items:center"><${InstBadge} u=${u} /><div style="min-width:0;flex:1;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h2 style="font-size:20px">${u.name}</h2><${KindChip} kind=${u.kind} /></div></div>
        <div class="stats"><div><b class="num">${x.active}</b><span>Active</span></div><div><b class="num">${x.qsr}</b><span>QSR</span></div><div><b class="num">${x.vending}</b><span>Vending</span></div></div>
        <div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:6px"><span>${x.completed} of ${x.required} visited</span><span class="num">${Math.round(x.pct * 100)}%</span></div>
          <div class="bar" role="progressbar" aria-valuenow=${Math.round(x.pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style=${{ width: Math.round(x.pct * 100) + '%' }}></i></div></div>
        <div class="chips">${x.overdue ? html`<span class="chip bad"><${Icon} n="alert" s=${13} w=${2.4} />${x.overdue} overdue</span>` : null}${x.noVisit ? html`<span class="chip none"><${Icon} n="circle" s=${13} w=${2.4} />${x.noVisit} no visit</span>` : null}${!x.active ? html`<span class="chip muted">No locations yet</span>` : null}</div>
        ${u.note ? html`<div class="xs muted">${u.note}</div>` : null}</button>`; })}</div>`
      : html`<div class="card flat"><${Empty} title=${`No ${kind === 'All' ? 'universities or TAFEs' : kind === 'TAFE' ? 'TAFEs' : 'universities'} in ${st.code} yet`} body="Add one to start planning audits in this state." action=${D.can.manageInstitutions && (D.isAdmin || D.meP.state === st.code) ? html`<button class="btn" onClick=${() => d({ type: 'modal', modal: { kind: 'inst', state: st.code } })}>Add university or TAFE</button>` : null} /></div>`}</section>`; })}`;
}
function InstForm({ inst, state, onClose }) {
  const { s, d, D } = useApp(); const isNew = !inst;
  const [f, setF] = useState(() => inst ? { ...inst, campusText: inst.campuses.join(', ') } : { code: '', name: '', short: '', kind: 'University', state: state || (D.isAdmin ? 'VIC' : D.meP.state), campusText: '', status: 'Active' });
  const [tried, setTried] = useState(false);
  const errs = {};
  if (!f.name.trim()) errs.name = 'Enter the institution name.';
  if (isNew && !/^[A-Z]{2,6}$/.test(f.code)) errs.code = 'Use 2 to 6 capital letters, e.g. UNSW or TAFEQ.';
  else if (isNew && s.unis.some(u => u.code === f.code)) errs.code = `${f.code} is already used by ${s.unis.find(u => u.code === f.code).name}.`;
  const save = () => { setTried(true); if (Object.keys(errs).length) return; const { campusText, ...rest } = f; d({ type: 'saveInst', inst: { ...rest, short: f.short || f.name, campuses: campusText.split(',').map(x => x.trim()).filter(Boolean) } }); onClose(); d({ type: 'toast', msg: `${f.name} saved` }); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="if-h" style="width:min(560px,100%)"><div class="sheet-h"><h2 id="if-h">${isNew ? 'Add university or TAFE' : 'Edit ' + inst.name}</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><div class="form-grid">
      <div class="field"><span class="label">Type</span><${Seg} label="Type" value=${f.kind} onChange=${v => setF({ ...f, kind: v })} options=${['University', 'TAFE']} /></div>
      <${Select} id="if-st" label="State" value=${f.state} onChange=${v => setF({ ...f, state: v })} options=${s.states.filter(x => D.scopeStates.includes(x.code)).map(x => [x.code, x.name])} disabled=${!D.isAdmin} />
      <div class="span2"><${Text} id="if-n" label="Name" value=${f.name} onChange=${v => setF({ ...f, name: v })} err=${tried ? errs.name : null} placeholder="e.g. TAFE NSW Ultimo" /></div>
      <${Text} id="if-c" label="Code (ID prefix)" value=${f.code} onChange=${v => setF({ ...f, code: v.toUpperCase().replace(/[^A-Z]/g, '') })} err=${isNew && tried ? errs.code : null} hint=${isNew ? 'Locations will be numbered CODE-001, CODE-VM-001' : 'Can’t change once created'} />
      <${Text} id="if-s" label="Short name" value=${f.short} onChange=${v => setF({ ...f, short: v })} placeholder="Shown on charts" />
      <div class="span2"><${Text} id="if-cp" label="Campuses" value=${f.campusText} onChange=${v => setF({ ...f, campusText: v })} hint="Separate with commas" /></div>
      <div class="span2 field"><label for="if-logo">Logo (optional)</label>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><${InstBadge} u=${{ ...f, code: f.code || '?' }} size=${56} />
          <input id="if-logo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="input" style="flex:1 1 200px" onChange=${e => { const file = e.target.files[0]; if (!file) return; shrinkLogo(file).then(url => setF(x => ({ ...x, logo: url }))).catch(() => d({ type: 'toast', msg: 'That image couldn’t be read. Try a PNG or JPG.' })); }} />
          ${f.logo ? html`<button type="button" class="btn sm" onClick=${() => setF(x => ({ ...x, logo: null }))}>Remove logo</button>` : null}</div>
        <span class="hint">Use the institution’s official logo file. It’s resized automatically and everyone sees it on the tiles. Without one, the code is shown.</span></div></div></div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save}>${isNew ? 'Add' : 'Save'}</button></div></div>`;
}
function UniDetail() {
  const { s, d, D } = useApp();
  const u = D.uniBy[s.route.code]; const tab = s.route.tab || 'Overview';
  const [confirm, setConfirm] = useState(false);
  if (!u) return html`<${Empty} title="Not found" body="It may have been removed." />`;
  const ls = D.locs.filter(l => l.uni === u.code);
  const setTab = t => d({ type: 'nav', route: { ...s.route, tab: t } });
  const pendingReq = s.requests.find(r => r.targetId === u.code && r.status === 'Pending');
  const canManage = D.can.manageInstitutions && (D.isAdmin || D.meP.state === u.state);
  return html`<div class="page-h"><div style="display:flex;gap:14px;align-items:center;min-width:0"><${InstBadge} u=${u} size=${64} /><div style="min-width:0"><div class="eyebrow">${u.state} · ${u.code} · ${u.campuses.join(', ') || 'No campuses yet'}</div><h1>${u.name}</h1><div class="chips" style="margin-top:6px"><${KindChip} kind=${u.kind} />${u.status === 'Removed' ? html`<${LocStateChip} s="Removed" />` : null}</div></div></div>
    <div class="chips">${u.status !== 'Removed' ? html`<button class="btn primary" onClick=${() => d({ type: 'nav', route: { page: 'audit', uni: u.code } })}><${Icon} n="play" s=${16} />Start Audit</button>` : null}
      ${canManage ? html`<button class="btn" onClick=${() => d({ type: 'modal', modal: { kind: 'inst', inst: u } })}><${Icon} n="edit" s=${16} />Edit</button>
        ${u.status === 'Removed' ? html`<button class="btn" onClick=${() => d({ type: 'setInstStatus', code: u.code, status: 'Active' })}><${Icon} n="undo" s=${16} />Restore</button>` : html`<button class="btn danger" onClick=${() => setConfirm(true)}><${Icon} n="trash" s=${16} />Remove</button>`}` : null}
      ${D.can.requestRemoval && u.status !== 'Removed' ? html`<button class="btn" disabled=${!!pendingReq} onClick=${() => d({ type: 'modal', modal: { kind: 'removal', target: { type: u.kind, id: u.code, name: u.name, state: u.state } } })}><${Icon} n="flag" s=${16} />${pendingReq ? 'Removal requested' : 'Request removal'}</button>` : null}</div></div>
  ${confirm ? html`<div class="inline-confirm"><span>Remove ${u.name}? Its ${ls.length} locations are removed from planning. Visit history is kept and an admin or manager can restore it.</span><span class="chips"><button class="btn sm" onClick=${() => setConfirm(false)}>Keep</button><button class="btn sm danger" onClick=${() => { d({ type: 'setInstStatus', code: u.code, status: 'Removed' }); setConfirm(false); d({ type: 'toast', msg: `${u.name} removed` }); }}>Remove</button></span></div>` : null}
  ${pendingReq ? html`<div class="banner warn"><${Icon} n="flag" s=${18} /><div>Removal requested by ${pendingReq.requester} on ${fmtDate(pendingReq.submittedAt.slice(0, 10))}. Waiting for ${leadsFor(s, u.state).join(' or ') || 'the Education Channel Lead'}.</div></div>` : null}
  <div class="tabs" role="tablist">${['Overview', 'Locations', 'Visits', 'People', 'Performance'].map(t => html`<button key=${t} role="tab" aria-selected=${String(tab === t)} onClick=${() => setTab(t)}>${t}</button>`)}</div>
  ${tab === 'Overview' ? html`<${UniOverview} u=${u} ls=${ls} />` : tab === 'Locations' ? html`<${LocationList} fixedUni=${u.code} />`
    : tab === 'Visits' ? html`<${VisitHistory} uni=${u.code} />` : tab === 'People' ? html`<${PeopleTable} fixedState=${u.state} note=${`Student Marketeers and Managers in ${u.state} can audit any location at ${u.short || u.name}.`} /> ` : html`<${Performance} uni=${u.code} ls=${ls} />`}`;
}
function UniOverview({ u, ls }) {
  const { s, d, D } = useApp();
  const x = summarise(ls, s.visits, rangeStart('14', D.today), D.today); const all = summarise(ls, s.visits, '0000-01-01', D.today);
  const overdue = ls.filter(l => l.locStatus === 'Active' && l.status === 'Overdue').sort((a, b) => a.days - b.days).slice(0, 6);
  const recent = s.visits.filter(v => v.uni === u.code).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  return html`<div class="kpis"><${Kpi} label="Active locations" value=${x.active} sub=${`${x.qsr} QSR · ${x.vending} vending`} /><${Kpi} label="Completed (14 days)" value=${x.completed} tone="good" icon="check" sub=${`${Math.round(x.pct * 100)}% of ${x.required}`} /><${Kpi} label="Overdue" value=${x.overdue} tone="bad" icon="alert" /><${Kpi} label="No visit recorded" value=${x.noVisit} tone="none" icon="circle" /></div>
  <div class="grid g2"><section class="card"><div class="card-h"><h2>Completion</h2></div><${StackBars} rows=${[statusRow(u.short || u.name, ls)]} caption=${'Status mix for ' + u.name} />
      <div style="margin-top:14px"><div class="bar"><i style=${{ width: Math.round(x.pct * 100) + '%' }}></i></div><div class="small muted" style="margin-top:6px">${x.completed} of ${x.required} active locations visited in the last 14 days</div></div></section>
    <section class="card"><div class="card-h"><h2>Outcome summary</h2><span class="xs muted">All completed visits</span></div>
      <dl class="dl"><div><dt>DPs added</dt><dd class="num">${all.dpAdded}</dd></div><div><dt>DPs lost</dt><dd class="num">${all.dpLost}</dd></div><div><dt>Net DPs</dt><dd class="num">${signed(all.dpAdded - all.dpLost)}</dd></div><div><dt>Editions sold in</dt><dd class="num">${all.editions}</dd></div><div><dt>POS placed</dt><dd class="num">${all.posPlaced}</dd></div><div><dt>Net coolers</dt><dd class="num">${signed(all.coolersIn - all.coolersOut)}</dd></div></dl></section></div>
  <div class="grid g2"><section class="card"><div class="card-h"><h2>Overdue locations</h2></div>${overdue.length ? html`<div class="list">${overdue.map(l => html`<button key=${l.id} class="rowbtn" onClick=${() => d({ type: 'nav', route: { page: 'loc', id: l.id } })}><div class="main-c" style="flex:1;min-width:0"><div class="t">${l.name}</div><div class="m">${l.campus} · last ${fmtDate(l.last)}</div></div><span class="due-big bad num" style="font-size:16px">${-l.days}d</span></button>`)}</div>` : html`<${Empty} title="Nothing overdue" body="All active locations are on track." />`}</section>
    <section class="card"><div class="card-h"><h2>Recent activity</h2></div>${recent.length ? html`<div class="list">${recent.map(v => html`<button key=${v.id} class="rowbtn" onClick=${() => d({ type: 'modal', modal: { kind: 'visit', id: v.id } })}><div class="main-c" style="flex:1;min-width:0"><div class="t">${D.locBy[v.loc]?.name || v.loc}</div><div class="m">${fmtDate(v.date)} · ${v.status} · ${v.staff || 'Staff not recorded'}</div></div></button>`)}</div>` : html`<${Empty} title="No visits yet" body="Start an audit to record the first visit." />`}</section></div>`;
}
function VisitHistory({ uni, loc }) {
  const { s, d, D } = useApp(); const [st, setSt] = useState('All');
  const vs = s.visits.filter(v => (!uni || v.uni === uni) && (!loc || v.loc === loc) && (st === 'All' || v.status === st)).sort((a, b) => b.date.localeCompare(a.date));
  return html`<div class="toolbar" style="justify-content:space-between"><${Seg} label="Visit status" value=${st} onChange=${setSt} options=${['All', ...s.ref.visitStatuses]} />
    <button class="btn primary" onClick=${() => d({ type: 'nav', route: { page: 'audit', uni, loc } })}><${Icon} n="plus" s=${16} />Add Visit</button></div>
  ${vs.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Location</th><th>Status</th><th class="hide-m">Staff</th><th class="n hide-m">Net DPs</th><th class="n hide-m">Editions</th><th class="hide-m">Next step</th></tr></thead><tbody>
    ${vs.slice(0, 200).map(v => html`<tr key=${v.id} class="click" tabindex="0" onClick=${() => d({ type: 'modal', modal: { kind: 'visit', id: v.id } })} onKeyDown=${e => e.key === 'Enter' && d({ type: 'modal', modal: { kind: 'visit', id: v.id } })}>
      <td class="num">${fmtDate(v.date)}</td><td>${D.locBy[v.loc]?.name || v.loc}<div class="xs muted">${v.loc}</div></td><td><${VisitChip} status=${v.status} /></td><td class="hide-m">${v.staff || html`<span class="muted">Not recorded</span>`}</td>
      <td class="n hide-m">${signed(v.dpAdded - v.dpLost)}</td><td class="n hide-m">${v.editions}</td><td class="hide-m" style="min-width:200px">${v.nextStep || html`<span class="muted">—</span>`}</td></tr>`)}</tbody></table></div>`
    : html`<${Empty} title="No visits here yet" body="Visits you record appear in this history." />`}`;
}
const VisitChip = ({ status }) => html`<span class=${'chip ' + (status === 'Completed' ? 'good' : status === 'Scheduled' ? 'plain' : 'muted')}><${Icon} n=${status === 'Completed' ? 'check' : status === 'Scheduled' ? 'clock' : 'x'} s=${13} w=${2.4} />${status}</span>`;

/* ======================= LOCATIONS ======================= */
function LocationList({ fixedUni }) {
  const { s, d, D } = useApp();
  const [f, setF] = useFilters({ uni: fixedUni || 'all', range: 'all', state: fixedUni ? 'all' : (D.isAdmin ? 'all' : D.meP.state) });
  const [st, setSt] = useState('Active'); const [shown, setShown] = useState(60);
  const base = filterLocs(D.locs, { ...f, removed: st === 'Removed' || st === 'All' }, D).filter(l => st === 'All' || (st === 'Active' ? l.locStatus === 'Active' : st === 'Removed' ? l.locStatus === 'Removed' : st === 'Paused' ? l.locStatus === 'Inactive' : l.locStatus === 'Active' && l.status === st));
  const unis = D.liveUnis.filter(u => D.scopeUnis.includes(u.code) && (f.state === 'all' || u.state === f.state));
  const campuses = f.uni !== 'all' ? D.uniBy[f.uni].campuses : [...new Set(base.map(l => l.campus))].sort();
  return html`<div class="toolbar">
    ${fixedUni ? null : html`${D.isAdmin ? html`<${StatePick} value=${f.state} onChange=${v => setF({ ...f, state: v, uni: 'all' })} D=${D} s=${s} />` : null}<${Select} id="l-uni" label="University or TAFE" value=${f.uni} onChange=${v => setF({ ...f, uni: v, campus: 'all' })} options=${[['all', 'All'], ...unis.map(u => [u.code, u.name])]} />`}
    <${Select} id="l-campus" label="Campus" value=${f.campus} onChange=${v => setF({ ...f, campus: v })} options=${[['all', 'All campuses'], ...campuses.map(c => [c, c])]} />
    <${Select} id="l-stt" label="Store location type" value=${f.storeType || 'All'} onChange=${v => setF({ ...f, storeType: v })} options=${[...storeTypeOpts(s), ['__confirm', 'To confirm (auto-classified)']]} />
    <${Select} id="l-st" label="Status" value=${st} onChange=${setSt} options=${[['Active', 'Active'], ...STATUS_KEYS.map(k => [k, k]), ['Paused', 'Paused'], ['Removed', 'Removed'], ['All', 'Everything']]} />
    <div class="field wide" style="flex:1 1 200px"><span class="label">Search</span><${Search} id="l-q" value=${f.q} onChange=${v => setF({ ...f, q: v })} placeholder="Name, ID, landmark" /></div>
    <div class="field"><span class="label"> </span><button class="btn primary" onClick=${() => d({ type: 'modal', modal: { kind: 'location', uni: fixedUni } })}><${Icon} n="plus" s=${16} />Add Location</button></div></div>
  <div class="small muted num">${base.length} location${base.length === 1 ? '' : 's'}</div>
  ${base.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Location</th><th class="hide-m">Type</th>${fixedUni ? null : html`<th class="hide-m">Institution</th>`}<th class="hide-m">Campus</th><th>Visit status</th><th class="hide-m">Next due</th><th class="hide-m">Last visit</th>${D.can.manageLocations ? html`<th><span class="sr">Actions</span></th>` : null}</tr></thead><tbody>
    ${base.slice(0, shown).map(l => html`<tr key=${l.id} class="click" tabindex="0" onClick=${() => d({ type: 'nav', route: { page: 'loc', id: l.id } })} onKeyDown=${e => e.key === 'Enter' && d({ type: 'nav', route: { page: 'loc', id: l.id } })}>
      <td style="min-width:160px"><b>${l.name}</b><div class="xs muted">${l.id}${l.locStatus === 'Active' ? ' · ' + dueText(l).t : ''}</div></td><td class="hide-m"><${TypeChip} type=${l.type} l=${l} />${l.storeType ? null : html`<div class="xs muted" style="margin-top:3px">To confirm</div>`}</td>${fixedUni ? null : html`<td class="hide-m">${l.uniName}<div class="xs muted">${l.state}</div></td>`}<td class="hide-m">${l.campus}</td>
      <td>${l.locStatus === 'Active' ? html`<${StatusChip} status=${l.status} />` : html`<${LocStateChip} s=${l.locStatus} />`}</td><td class="num hide-m" style="white-space:nowrap">${l.locStatus === 'Active' ? fmtDate(l.due) : '—'}</td><td class="num hide-m" style="white-space:nowrap">${fmtDate(l.last)}</td>
      ${D.can.manageLocations ? html`<td onClick=${e => e.stopPropagation()}><button class="btn sm" onClick=${() => d({ type: 'modal', modal: { kind: 'location', loc: s.locations.find(x => x.id === l.id) } })} aria-label=${'Edit ' + l.name}><${Icon} n="edit" s=${14} /></button></td>` : null}</tr>`)}
  </tbody></table></div>${base.length > shown ? html`<div style="text-align:center"><button class="btn" onClick=${() => setShown(shown + 60)}>Show more</button></div>` : null}`
    : html`<${Empty} title="No locations match" body="Try clearing a filter, or add the first store or vending machine." action=${html`<button class="btn primary" onClick=${() => d({ type: 'modal', modal: { kind: 'location', uni: fixedUni } })}>Add Location</button>`} />`}`;
}
function Locations() { return html`<div class="page-h"><div><h1>Audit Locations</h1><p>QSR stores and vending machines across your universities and TAFEs.</p></div></div><${LocationList} />`; }
function nextId(locs, uni, type) {
  const re = type === 'Vending' ? new RegExp(`^${uni}-VM-(\\d+)$`) : new RegExp(`^${uni}-(\\d+)$`);
  const n = locs.reduce((m, l) => { const x = String(l.id).match(re); return x ? Math.max(m, +x[1]) : m; }, 0) + 1;
  return type === 'Vending' ? `${uni}-VM-${String(n).padStart(3, '0')}` : `${uni}-${String(n).padStart(3, '0')}`;
}
function LocationForm({ loc, uni, onClose }) {
  const { s, d, D } = useApp(); const isNew = !loc;
  const myUnis = D.liveUnis.filter(u => D.scopeUnis.includes(u.code));
  const firstUni = uni || myUnis[0]?.code;
  const [f, setF] = useState(() => loc ? { ...loc, ranging: { ...loc.ranging }, newCampus: '', storeType: storeTypeOf(loc) || '' } : { id: firstUni ? nextId(s.locations, firstUni, 'QSR') : '', uni: firstUni, type: 'QSR', name: '', storeType: 'QSR', campus: D.uniBy[firstUni]?.campuses[0] || '__new', newCampus: '', address: '', landmark: '', building: '', level: '', postcode: '', status: 'Active', added: D.today, cycle: s.ref.defaultCycle, ranging: {}, idTouched: false });
  const [tried, setTried] = useState(false); const [confirm, setConfirm] = useState(null);
  if (!firstUni && isNew) return html`<div class="sheet"><div class="sheet-h"><h2>Add location</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div><div class="sheet-b"><${Empty} title="No universities or TAFEs in your state yet" body="Ask a manager to add one first." /></div></div>`;
  const set = (k, v) => setF(x => { const n = { ...x, [k]: v }; if (isNew && !x.idTouched && (k === 'uni' || k === 'type')) n.id = nextId(s.locations, k === 'uni' ? v : x.uni, k === 'type' ? v : x.type); if (k === 'uni') n.campus = D.uniBy[v]?.campuses[0] || '__new'; if (k === 'id') n.idTouched = true; return n; });
  const campus = f.campus === '__new' ? f.newCampus.trim() : f.campus;
  const errs = {}; const idU = String(f.id).trim().toUpperCase();
  if (!f.name.trim()) errs.name = 'Enter the store or machine name.';
  if (!idU) errs.id = 'Enter a Location ID.';
  else if (isNew && s.locations.some(l => l.id.toUpperCase() === idU)) errs.id = `${idU} is already used by ${s.locations.find(l => l.id.toUpperCase() === idU).name}. IDs are never reused.`;
  else if (!/^[A-Z]{2,6}-(VM-)?\d{3,}$/.test(idU)) errs.id = 'Use the pattern MON-012 for QSR or MON-VM-012 for vending.';
  if (isNew && s.locations.some(l => l.uni === f.uni && l.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errs.name = 'A location with this name already exists here. Add a distinguishing detail.';
  if (!campus) errs.campus = 'Choose or add a campus.';
  if (!(+f.cycle >= 1 && +f.cycle <= 365)) errs.cycle = 'Enter 1 to 365 days.';
  if (!f.storeType) errs.storeType = 'Choose the store location type.';
  else if (!activeStoreTypes(s).includes(f.storeType) && (isNew || f.storeType !== loc?.storeType)) errs.storeType = `${f.storeType} is no longer available for new records. Choose another type.`;
  const hasVisits = loc && s.visits.some(v => v.loc === loc.id);
  const save = () => { setTried(true); if (Object.keys(errs).length) return; const { newCampus, idTouched, ...rest } = f;
    d({ type: 'saveLocation', loc: { ...rest, id: idU, name: f.name.trim(), campus, cycle: +f.cycle, storeType: f.storeType, type: f.storeType === 'Vending' ? 'Vending' : 'QSR', status: isNew ? 'Active' : loc.status, addedBy: isNew ? D.meP.name : loc.addedBy } });
    if (campus && !D.uniBy[f.uni].campuses.includes(campus)) d({ type: 'saveInst', inst: { ...D.uniBy[f.uni], campuses: [...D.uniBy[f.uni].campuses, campus] } });
    onClose(); d({ type: 'toast', msg: isNew ? `${f.name.trim()} added` : 'Location saved' }); };
  const E = k => (tried ? errs[k] : null);
  const canEdit = isNew || D.can.manageLocations;
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lf-h"><div class="sheet-h"><h2 id="lf-h">${isNew ? 'Add location' : 'Edit location'}</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><div class="form-grid">
      <${Select} id="lf-uni" label="University or TAFE" value=${f.uni} onChange=${v => set('uni', v)} options=${myUnis.map(u => [u.code, `${u.name} (${u.state})`])} disabled=${!isNew} />
      <${Select} id="lf-stype" label="Store location type" value=${f.storeType} onChange=${v => { set('storeType', v); if (v) set('type', v === 'Vending' ? 'Vending' : 'QSR'); }} err=${E('storeType')} options=${[['', 'Choose…'], ...activeStoreTypes(s).map(x => [x, x]), ...(f.storeType && !activeStoreTypes(s).includes(f.storeType) ? [[f.storeType, f.storeType + ' (retired, kept on this record)']] : [])]} hint=${!isNew && !loc.storeType ? 'Classified automatically from the workbook. Confirm it.' : 'Vending gives the vending machine fields.'} />
      <${Text} id="lf-id" label="Location ID" value=${f.id} onChange=${v => set('id', v.toUpperCase())} err=${isNew ? E('id') : null} hint=${isNew ? 'Suggested next ID. An ID is never reused.' : 'IDs can’t be changed once created.'} />
      <${Text} id="lf-name" label=${f.type === 'Vending' ? 'Machine name' : 'Store name'} value=${f.name} onChange=${v => set('name', v)} err=${E('name')} />
      <${Select} id="lf-campus" label="Campus" value=${f.campus} onChange=${v => set('campus', v)} options=${[...(D.uniBy[f.uni]?.campuses || []).map(c => [c, c]), ['__new', '+ Add a campus']]} err=${f.campus !== '__new' ? E('campus') : null} />
      ${f.campus === '__new' ? html`<${Text} id="lf-newc" label="New campus name" value=${f.newCampus} onChange=${v => set('newCampus', v)} err=${E('campus')} />` : null}
      <${Text} id="lf-cycle" label="Visit cycle (days)" type="number" value=${f.cycle} onChange=${v => set('cycle', v)} err=${E('cycle')} hint="Default 14" />
      ${f.type === 'QSR' ? html`<${Text} id="lf-addr" label="Address" value=${f.address} onChange=${v => set('address', v)} /><${Text} id="lf-pc" label="Postcode" inputMode="numeric" value=${f.postcode} onChange=${v => set('postcode', v)} />`
        : html`<${Text} id="lf-bld" label="Building" value=${f.building} onChange=${v => set('building', v)} /><${Text} id="lf-lvl" label="Level" value=${f.level} onChange=${v => set('level', v)} />`}
      <div class="span2"><${Text} id="lf-lm" label="Landmark / spot" value=${f.landmark} onChange=${v => set('landmark', v)} placeholder="Where staff will find it" /></div></div>
    ${!isNew && D.can.manageLocations ? html`<div class="card flat" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div class="label">Status: ${{ Active: 'Active', Inactive: 'Paused', Removed: 'Removed' }[loc.status]}</div>
      <div class="chips">${loc.status !== 'Active' ? html`<button class="btn sm" onClick=${() => { d({ type: 'setLocStatus', id: loc.id, status: 'Active' }); onClose(); d({ type: 'toast', msg: 'Location restored' }); }}><${Icon} n="undo" s=${14} />Restore</button>` : html`
        <button class="btn sm" onClick=${() => { d({ type: 'setLocStatus', id: loc.id, status: 'Inactive' }); onClose(); d({ type: 'toast', msg: 'Location paused' }); }}>Pause visits</button>
        <button class="btn sm danger" onClick=${() => setConfirm(hasVisits ? 'remove' : 'delete')}><${Icon} n="trash" s=${14} />Remove</button>`}</div>
      ${confirm ? html`<div class="inline-confirm"><span>${confirm === 'delete' ? `Delete ${loc.name}? It has no visits, so it will be deleted for good.` : `Remove ${loc.name}? It has visit history, so it's kept as Removed and can be restored.`}</span><span class="chips"><button class="btn sm" onClick=${() => setConfirm(null)}>Keep</button><button class="btn sm danger" onClick=${() => { d(confirm === 'delete' ? { type: 'deleteLocation', id: loc.id } : { type: 'setLocStatus', id: loc.id, status: 'Removed' }); onClose(); d({ type: 'toast', msg: confirm === 'delete' ? 'Location deleted' : 'Location removed' }); }}>${confirm === 'delete' ? 'Delete' : 'Remove'}</button></span></div>` : null}</div>` : null}
    ${tried && Object.keys(errs).length ? html`<div class="banner bad" role="alert"><${Icon} n="alert" s=${18} /><div>Fix ${Object.keys(errs).length} field${Object.keys(errs).length > 1 ? 's' : ''} to save.</div></div>` : null}</div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Cancel</button>${canEdit ? html`<button class="btn primary" onClick=${save}>${isNew ? 'Add location' : 'Save changes'}</button>` : null}</div></div>`;
}
function RemovalForm({ target, onClose }) {
  const { s, d, D } = useApp();
  const [f, setF] = useState({ reason: '', comments: '' }); const [tried, setTried] = useState(false);
  const leads = leadsFor(s, target.state);
  const errs = {}; if (!f.reason) errs.reason = 'Choose a reason.'; if (f.reason === 'Other' && !f.comments.trim()) errs.comments = 'Explain the reason.';
  const submit = () => { setTried(true); if (Object.keys(errs).length) return; d({ type: 'submitRequest', req: { state: target.state, targetType: target.type, targetId: target.id, targetName: target.name, reason: f.reason, comments: f.comments.trim() } }); onClose(); d({ type: 'toast', msg: `Request sent to ${leads.join(' and ') || 'the Education Channel Lead'}` }); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rf-h" style="width:min(560px,100%)"><div class="sheet-h"><h2 id="rf-h">Request removal</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><div class="banner info"><${Icon} n="shield" s=${18} /><div>Student Marketeers can't remove locations directly. ${leads.length ? leads.join(' or ') : 'Your Education Channel Lead'} will approve or reject this, and you'll be notified.</div></div>
      <dl class="dl"><div><dt>Requested by</dt><dd>${D.meP.name}</dd></div><div><dt>State</dt><dd>${target.state}</dd></div><div><dt>Location type</dt><dd>${target.type}</dd></div><div><dt>Location</dt><dd>${target.name}</dd></div><div><dt>Date submitted</dt><dd>${fmtDate(D.today)}</dd></div></dl>
      <${Select} id="rf-r" label="Reason for removal" value=${f.reason} onChange=${v => setF({ ...f, reason: v })} options=${[['', 'Choose…'], ...s.ref.removalReasons.map(x => [x, x])]} err=${tried ? errs.reason : null} />
      <${Text} id="rf-c" label="Supporting comments" multiline value=${f.comments} onChange=${v => setF({ ...f, comments: v })} err=${tried ? errs.comments : null} placeholder="e.g. Store closed at end of semester, now a pop-up" /></div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${submit}>Send request</button></div></div>`;
}
function LocationDetail() {
  const { s, d, D } = useApp();
  const l = D.locBy[s.route.id];
  if (!l) return html`<${Empty} title="Location not found" body="It may have been deleted." />`;
  const dt = dueText(l); const isV = l.type === 'Vending';
  const prods = s.ref.products.filter(p => (isV ? p.vending : p.qsr));
  const yn = v => (v === 1 || v === '1' ? 'Yes' : v === 0 || v === '0' ? 'No' : '—');
  const pendingReq = s.requests.find(r => r.targetId === l.id && r.status === 'Pending');
  const reqs = s.requests.filter(r => r.targetId === l.id);
  const timeline = [...l.visits.map(v => ({ date: v.date, kind: 'visit', v })), ...s.log.filter(e => e.target === l.id && !String(e.action).includes('visit')).map(e => ({ date: e.ts.slice(0, 10), kind: 'log', e }))].sort((a, b) => b.date.localeCompare(a.date));
  const dl = rows => html`<dl class="dl">${rows.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v === null || v === '' || v === undefined ? '—' : v}</dd></div>`)}</dl>`;
  return html`<div class="page-h"><div style="min-width:0"><div class="eyebrow">${l.id} · ${l.state} · ${l.uniName} · ${l.campus}</div><h1 style="overflow-wrap:anywhere">${l.name}</h1>
      <div class="chips" style="margin-top:8px"><${TypeChip} type=${l.type} l=${l} /><${LocStateChip} s=${l.locStatus} />${l.kind === 'TAFE' ? html`<${KindChip} kind="TAFE" />` : null}</div></div>
    <div class="chips">${l.locStatus === 'Active' ? html`<button class="btn primary" onClick=${() => d({ type: 'nav', route: { page: 'audit', loc: l.id } })}><${Icon} n="play" s=${16} />Start Audit</button>` : null}
      ${D.can.manageLocations ? html`<button class="btn" onClick=${() => d({ type: 'modal', modal: { kind: 'location', loc: s.locations.find(x => x.id === l.id) } })}><${Icon} n="edit" s=${16} />Edit or remove</button>` : null}
      ${D.can.requestRemoval && l.locStatus !== 'Removed' ? html`<button class="btn" disabled=${!!pendingReq} onClick=${() => d({ type: 'modal', modal: { kind: 'removal', target: { type: l.type === 'Vending' ? 'Vending machine' : 'Store', id: l.id, name: l.name, state: l.state } } })}><${Icon} n="flag" s=${16} />${pendingReq ? 'Removal requested' : 'Request removal'}</button>` : null}</div></div>
  ${pendingReq ? html`<div class="banner warn"><${Icon} n="flag" s=${18} /><div>Removal requested by ${pendingReq.requester} (${pendingReq.reason}). Waiting for ${leadsFor(s, l.state).join(' or ') || 'the Education Channel Lead'}.</div></div>` : null}
  ${l.locStatus === 'Removed' ? html`<div class="banner bad"><${Icon} n="trash" s=${18} /><div>Removed${l.removedNote ? ` (${l.removedNote})` : ''}. It's out of visit planning; history is kept.</div></div>` : null}
  <section class="card" aria-label="Visit status"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;align-items:center">
    <div><div class="label">Status</div><div style="margin-top:6px"><${StatusChip} status=${l.status} /></div></div>
    <div><div class="label">Last completed visit</div><div class="due-big num" style="font-size:20px;margin-top:4px;color:var(--ink)">${fmtDate(l.last)}</div></div>
    <div><div class="label">Next visit due</div><div class="due-big num" style="font-size:20px;margin-top:4px;color:var(--ink)">${l.locStatus === 'Active' ? fmtDate(l.due) : '—'}</div></div>
    <div><div class="label">Days until due</div><div class=${'due-big num ' + dt.tone} style="font-size:20px;margin-top:4px">${dt.t}</div></div>
    <div><div class="label">Visit cycle</div><div class="due-big num" style="font-size:20px;margin-top:4px;color:var(--ink)">${l.cycle} days</div></div></div></section>
  <div class="grid g2">
    <section class="card"><h2 class="section-t">Location details</h2>${dl(isV ? [['Store location type', storeTypeOf(l) + (l.storeType ? '' : ' (auto, to confirm)')], ['Landmark / spot', l.landmark], ['Building', l.building], ['Level', l.level], ['Campus', l.campus], ['Date added', fmtDate(l.added)], ['Last visited by', l.lastBy]]
      : [['Address', l.address], ['Landmark / spot', l.landmark], ['Postcode', l.postcode], ['Store location type', storeTypeOf(l) + (l.storeType ? '' : ' (auto, to confirm)')], ['Channel', l.channel], ['Classification', l.classification], ['Red Bull owner', l.pic], ['Last visited by', l.lastBy]])}
      ${!isV ? html`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="label" style="margin-bottom:6px">Store contact</div>${l.contactName ? html`${dl([['Name', l.contactName], ['Role', l.contactRole], ...(D.can.seeContacts ? [['Phone', l.contactPhone], ['Email', l.contactEmail]] : []), ['Recorded', l.contactAt ? `${fmtDate(l.contactAt)}${l.contactBy ? ' by ' + l.contactBy : ''}` : null]])}${D.can.seeContacts ? null : html`<p class="xs muted" style="margin:8px 0 0">Phone and email are visible to managers and administrators.</p>`}`
        : D.can.seeContacts && l.contact ? html`${dl([['Contact', l.contact]])}<p class="xs muted" style="margin:8px 0 0">From the workbook (masked). Updated at the next audit.</p>` : html`<p class="small muted" style="margin:0">Not recorded yet. Added at the next audit.</p>`}</div>` : null}</section>
    <section class="card"><h2 class="section-t">Product ranging</h2><div class="rgrid">${prods.map(p => { const v = l.ranging?.[p.key]; return html`<div class="rg" key=${p.key}><span>${p.label}</span>
      ${v === 1 ? html`<span class="chip good"><${Icon} n="check" s=${12} w=${2.6} />Yes</span>` : v === 0 ? html`<span class="chip plain">No</span>` : html`<span class="chip muted">Not checked</span>`}</div>`; })}</div></section></div>
  <div class="grid g2">
    ${!isV ? html`<section class="card"><h2 class="section-t">Execution</h2>${dl([['Red Bull front facings', l.rbFacings ?? null], ['Competitors', l.compFacings && Object.keys(l.compFacings).length ? html`${compDetailText(l.compFacings, l.compDetail, l.type === 'Vending').map((t, i) => html`<div key=${i}>${t}</div>`)}` : null], ['Share of shelf', l.rbFacings !== undefined && shelfShare(l.rbFacings, l.compFacings) !== null ? pct0(shelfShare(l.rbFacings, l.compFacings)) + (l.facingsAt ? ` (${fmtShort(l.facingsAt)})` : '') : null], ['POS present', yn(l.pos)], ['Cooler present', yn(l.cooler)], ['Red Bull price', money(l.price)], ['Bullring / Bull’s Eye', l.bull]])}</section>`
      : html`<section class="card"><h2 class="section-t">Vending details</h2>${dl([['Red Bull front facings', l.rbFacings ?? null], ['Competitors', l.compFacings && Object.keys(l.compFacings).length ? html`${compDetailText(l.compFacings, l.compDetail, l.type === 'Vending').map((t, i) => html`<div key=${i}>${t}</div>`)}` : null], ['Vending company', l.vendCo], ['Machine ID', l.machineId], ['Red Bull price', money(l.price)], ['V SKUs', l.vSku], ['V price', money(l.vPrice)], ['Monster SKUs', l.mSku], ['Monster price', money(l.mPrice)]])}</section>`}
    <section class="card"><h2 class="section-t">Latest note / next step</h2><p style="margin:0">${l.notes || html`<span class="muted">No notes yet.</span>`}</p>
      ${reqs.length ? html`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="label" style="margin-bottom:6px">Removal requests</div>${reqs.map(r => html`<div key=${r.id} class="small">${r.id} · ${r.status} · ${r.requester}${r.decidedBy ? ` → ${r.decidedBy}` : ''}</div>`)}</div>` : null}</section></div>
  <section class="card"><div class="card-h"><h2>History</h2><span class="xs muted">${l.visits.filter(v => v.status === 'Completed').length} completed visits</span></div>
    ${timeline.length ? html`<ol class="timeline">${timeline.map((t, i) => t.kind === 'visit' ? html`<li key=${'v' + t.v.id}><span class=${'dotc ' + (t.v.status === 'Completed' ? 'good' : 'muted')}></span><div>
        <button class="btn ghost sm" style="padding:0;min-height:0;font-size:15px" onClick=${() => d({ type: 'modal', modal: { kind: 'visit', id: t.v.id } })}><b>${fmtDate(t.v.date)}</b>&nbsp;· ${t.v.status} visit</button>
        <div class="small muted">${t.v.staff || 'Staff not recorded'}${t.v.dpAdded || t.v.dpLost ? ` · DPs ${signed(t.v.dpAdded - t.v.dpLost)}` : ''}</div>${t.v.nextStep ? html`<div class="small" style="margin-top:2px">${t.v.nextStep}</div>` : null}</div></li>`
      : html`<li key=${'l' + i}><span class="dotc muted"></span><div><b class="small">${t.e.action}</b><div class="xs muted">${new Date(t.e.ts).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} · ${t.e.user}</div></div></li>`)}</ol>`
      : html`<${Empty} title="No history yet" body="Completed audits and changes to this location appear here." />`}</section>`;
}

/* ======================= NOTIFICATION CENTRE ======================= */
function Notifications() {
  const { s, d, D } = useApp();
  const tab = s.route.tab || 'Inbox'; const setTab = t => d({ type: 'nav', route: { page: 'notifications', tab: t } });
  const inbox = useInbox(s, D);
  const reqs = s.requests.filter(r => D.scopeStates.includes(r.state) && (!D.isSM || r.requester === D.meP.name));
  const summaries = dailySummaries(s, D).filter(x => D.scopeStates.includes(x.state) && (!D.isSM || x.staff === D.meP.name));
  const emails = [...s.notifications.filter(n => n.email && n.to.length && (D.isAdmin || D.scopeStates.includes(n.state))).map(n => ({ ts: n.ts, to: n.to, subject: n.title.startsWith('ECA') ? n.title : 'ECA · ' + n.title, status: 'Sent' })),
    ...summaries.map(x => ({ ts: x.date + 'T18:00:00', to: x.to, subject: `ECA daily activity summary: ${x.staff}, ${fmtDate(x.date)}`, status: x.date < D.today ? 'Sent' : `Scheduled ${s.ref.dailySummaryTime}` }))].sort((a, b) => b.ts.localeCompare(a.ts));
  const [notes, setNotes] = useState({});
  return html`<div class="page-h"><div><h1>Notifications</h1><p>Audit alerts, approvals, removal requests, daily and monthly summaries, and monthly results from ECA. Everything arrives here in the app.</p></div>
    ${inbox.some(i => !i.read) ? html`<button class="btn" onClick=${() => d({ type: 'read', keys: inbox.map(i => i.key) })}>Mark all read</button>` : null}</div>
  <div class="tabs" role="tablist">${['Inbox', 'Requests', 'Daily summaries', ...(D.isSM ? [] : ['Monthly summaries', 'Audit exports']), 'Email log'].map(t => html`<button key=${t} role="tab" aria-selected=${String(tab === t)} onClick=${() => setTab(t)}>${t}${t === 'Requests' && reqs.filter(r => r.status === 'Pending').length ? ` (${reqs.filter(r => r.status === 'Pending').length})` : ''}</button>`)}</div>
  ${tab === 'Inbox' ? (inbox.length ? html`<section class="card" style="padding:4px 8px"><div class="list">${inbox.map(i => html`<${InboxRow} key=${i.key} i=${i} />`)}</div></section>`
      : html`<${Empty} title="Nothing here yet" body=${D.isMgr ? 'You’ll be notified here and by email each time a Student Marketeer in your state completes an audit.' : D.leadOf.length ? 'Removal requests and daily summaries for your state arrive here.' : 'Updates on your requests and visit reminders arrive here.'} />`)
  : tab === 'Requests' ? (reqs.length ? html`<div class="list" style="gap:12px">${reqs.map(r => html`<section key=${r.id} class="card">
      <div class="card-h"><div><div class="xs muted">${r.id} · ${r.state} · ${new Date(r.submittedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</div><h3>${r.targetName}</h3></div>
        <span class=${'chip ' + (r.status === 'Pending' ? 'warn' : r.status === 'Approved' ? 'good' : 'muted')}><${Icon} n=${r.status === 'Pending' ? 'clock' : r.status === 'Approved' ? 'check' : 'x'} s=${13} w=${2.4} />${r.status}</span></div>
      <dl class="dl"><div><dt>Requested by</dt><dd>${r.requester}</dd></div><div><dt>Location type</dt><dd>${r.targetType}</dd></div><div><dt>Reason</dt><dd>${r.reason}</dd></div><div><dt>Routed to</dt><dd>${leadsFor(s, r.state).join(', ') || 'No lead set'}</dd></div>
        ${r.decidedBy ? html`<div><dt>Decision</dt><dd>${r.status} by ${r.decidedBy}, ${fmtDate(r.decidedAt.slice(0, 10))}</dd></div>` : null}</dl>
      ${r.comments ? html`<p class="small" style="margin:10px 0 0">“${r.comments}”</p>` : null}${r.decisionNote ? html`<p class="small muted" style="margin:6px 0 0">Note: ${r.decisionNote}</p>` : null}
      ${r.status === 'Pending' && D.can.approve(r) ? html`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;align-items:flex-end"><div style="flex:1 1 220px"><${Text} id=${'dn-' + r.id} label="Note to requester (optional)" value=${notes[r.id] || ''} onChange=${v => setNotes({ ...notes, [r.id]: v })} /></div>
        <button class="btn danger" onClick=${() => { d({ type: 'decideRequest', id: r.id, approve: false, note: notes[r.id] }); d({ type: 'toast', msg: 'Request rejected' }); }}>Reject</button><button class="btn primary" onClick=${() => { d({ type: 'decideRequest', id: r.id, approve: true, note: notes[r.id] }); d({ type: 'toast', msg: `${r.targetName} removed` }); }}>Approve and remove</button></div>`
        : r.status === 'Pending' ? html`<p class="xs muted" style="margin:10px 0 0">Only the ${r.state} Education Channel Lead can decide this.</p>` : null}</section>`)}</div>`
      : html`<${Empty} title="No removal requests" body=${D.isSM ? 'Use “Request removal” on a location, university or TAFE when it should come off the list.' : 'Requests from Student Marketeers appear here for the Education Channel Lead.'} />`)
  : tab === 'Monthly summaries' && !D.isSM ? html`<${MonthlySummaries} />`
  : tab === 'Audit exports' && !D.isSM ? html`<${AuditExports} />`
  : tab === 'Daily summaries' ? (summaries.length ? html`<div class="vcards">${summaries.map(x => html`<button key=${x.key} class="ucard" onClick=${() => d({ type: 'modal', modal: { kind: 'summary', key: x.key } })}>
      <div class="xs muted" style="font-weight:600">${x.state} · ${fmtDate(x.date)}</div><h3>${x.staff}</h3><div class="stats"><div><b class="num">${x.total}</b><span>Audits</span></div><div><b class="num">${x.stores.length}</b><span>Stores</span></div><div><b class="num">${x.vending.length}</b><span>Vending</span></div></div>
      <div class="small">${[...x.universities, ...x.tafes].join(', ')}</div><div class="xs muted">To ${x.to.join(', ')}</div></button>`)}</div>`
      : html`<${Empty} title="No daily summaries yet" body="When a Student Marketeer completes 2 or more audits in a day, a summary is built automatically and emailed to the state’s Education Channel Lead and managers at 6 pm." />`)
  : (emails.length ? html`<div class="tbl-wrap"><table><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>${emails.map((e, i) => html`<tr key=${i}><td class="num" style="white-space:nowrap">${new Date(e.ts).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}</td><td style="min-width:160px">${e.to.join(', ')}</td><td style="min-width:220px">${e.subject}</td><td><span class=${'chip ' + (e.status === 'Sent' ? 'good' : 'plain')}>${e.status}</span></td></tr>`)}</tbody></table></div>
      <p class="xs muted" style="margin:0">Prototype: emails are logged here, not actually sent. In production Power Automate sends them through Outlook.</p>`
      : html`<${Empty} title="No emails yet" body="Every notification is also emailed; the log shows what went to whom." />`)}`;
}
function SummaryView({ k, onClose }) {
  const { s, D } = useApp();
  const x = dailySummaries(s, D).find(y => y.key === k); if (!x) return null;
  const list = (t, xs) => html`<div><dt>${t}</dt><dd>${xs.length ? xs.join(', ') : 'None'}</dd></div>`;
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sv-h"><div class="sheet-h"><div><div class="xs muted">Daily activity summary · ${x.state}</div><h2 id="sv-h">${x.staff}, ${fmtDate(x.date)}</h2></div><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))"><${Kpi} label="Audits" value=${x.total} /><${Kpi} label="Stores" value=${x.stores.length} /><${Kpi} label="Vending" value=${x.vending.length} /></div>
      <dl class="dl" style="grid-template-columns:1fr">${list('Universities visited', x.universities)}${list('TAFEs visited', x.tafes)}${list('Stores visited', x.stores)}${list('Vending machines visited', x.vending)}</dl>
      <div><div class="label">Key findings</div><ul style="margin:6px 0 0;padding-left:18px">${x.findings.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul></div>
      <div class="banner info"><${Icon} n="mail" s=${18} /><div>${x.date < D.today ? 'Emailed' : 'Will be emailed'} to ${x.to.join(', ')} at ${s.ref.dailySummaryTime}${x.date < D.today ? ' on ' + fmtDate(x.date) : ' today'}.</div></div></div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Close</button></div></div>`;
}

/* ======================= EXCEL EXPORT (no library: minimal .xlsx writer) ======================= */
const XLSX_MINI = (() => {
  const enc = new TextEncoder();
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function zip(files) {
    const parts = []; const central = []; let off = 0;
    for (const [name, text] of files) {
      const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nb, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((t, b) => t + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)]; const out = new Uint8Array(all.reduce((t, b) => t + b.length, 0));
    let p = 0; for (const b of all) { out.set(b, p); p += b.length; } return out;
  }
  // styles: 0 normal · 1 header · 2 percent · 3 title · 4 note · 5 bold · 6 bold percent · 7 KPI label · 8 KPI value · 9 KPI value % · 10 section heading · 11 KPI note
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="8"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF0B2A5B"/><name val="Arial"/></font><font><i/><sz val="10"/><color rgb="FF6B7385"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="22"/><color rgb="FF0B2A5B"/><name val="Arial"/></font><font><b/><sz val="9"/><color rgb="FF6B7385"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FF0B2A5B"/><name val="Arial"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2A5B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F7"/></patternFill></fill></fills>
<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="12"><xf fontId="0"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fontId="0" numFmtId="9" applyNumberFormat="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" applyFont="1"/><xf fontId="4" applyFont="1"/><xf fontId="4" numFmtId="9" applyFont="1" applyNumberFormat="1"/>
<xf fontId="6" fillId="3" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="bottom" wrapText="1"/></xf><xf fontId="5" fillId="3" numFmtId="3" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf fontId="5" fillId="3" numFmtId="9" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf fontId="7" applyFont="1"/><xf fontId="3" fillId="3" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const cellXml = (ref, v, st) => { if (v === null || v === undefined || v === '') return st ? `<c r="${ref}" s="${st}"/>` : '';
    return typeof v === 'number' && isFinite(v) ? `<c r="${ref}" s="${st || 0}"><v>${v}</v></c>` : `<c r="${ref}" s="${st || 0}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`; };
  function sheetXml(sh) {
    const draw = sh.charts && sh.charts.length ? '<drawing r:id="rId1"/>' : '';
    const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    if (sh.raw) {
      const rows = (sh.cells || []).map((row, r) => { const ht = sh.heights?.[r]; return `<row r="${r + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${(row || []).map((x, c) => { const o = x && typeof x === 'object' ? x : { v: x }; return cellXml(col(c) + (r + 1), o.v, o.s); }).join('')}</row>`; });
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${ns}><sheetViews><sheetView workbookViewId="0"${sh.noGrid ? ' showGridLines="0"' : ''}${sh.selected ? ' tabSelected="1"' : ''}/></sheetViews>`
        + `<cols>${(sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>`
        + ((sh.merges || []).length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') + draw + `</worksheet>`;
    }
    const rows = []; let r = 0;
    const cell = (c, v, st) => cellXml(col(c) + (r + 1), v, st);
    const push = (vals, styleOf) => { rows.push(`<row r="${r + 1}">${vals.map((v, c) => cell(c, v, styleOf(c))).join('')}</row>`); r++; };
    if (sh.title) push([sh.title], () => 3);
    (sh.notes || []).forEach(n => push([n], () => 4));
    if (sh.title || (sh.notes || []).length) r++;
    const headRow = r; push(sh.header, () => 1);
    const pct = new Set(sh.pct || []);
    sh.rows.forEach(row => { const bold = row.__bold; push(row, c => (pct.has(c) ? (bold ? 6 : 2) : bold ? 5 : 0)); });
    const widths = sh.header.map((h, i) => sh.widths?.[i] || Math.min(48, Math.max(10, String(h).length + 2, ...sh.rows.map(x => String(x[i] ?? '').length + 2))));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${ns}><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headRow + 1}" topLeftCell="A${headRow + 2}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      + `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData>`
      + (sh.rows.length ? `<autoFilter ref="A${headRow + 1}:${col(sh.header.length - 1)}${headRow + 1 + sh.rows.length}"/>` : '') + draw + `</worksheet>`;
  }
  /* ---- native bar charts ---- */
  const C_NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const txt = (sz, b, color) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"${b ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Arial"/></a:defRPr></a:pPr><a:endParaRPr lang="en-AU"/></a:p></c:txPr>`;
  const fill = c => `<c:spPr><a:solidFill><a:srgbClr val="${c}"/></a:solidFill></c:spPr>`;
  function chartXml(ch) {
    const fmt = ch.pct ? '0%' : '#,##0';
    const strCache = vals => `<c:strCache><c:ptCount val="${vals.length}"/>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
    const numCache = vals => `<c:numCache><c:formatCode>${ch.pct ? '0%' : 'General'}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => (v === null || v === undefined || v === '' ? '' : `<c:pt idx="${i}"><c:v>${+v}</c:v></c:pt>`)).join('')}</c:numCache>`;
    const ser = ch.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${fill(s.color || '0B2A5B')}<c:invertIfNegative val="0"/>`
      + (s.pointColors || []).map((pc, j) => (pc ? `<c:dPt><c:idx val="${j}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>${fill(pc)}</c:dPt>` : '')).join('')
      + `<c:dLbls><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txt(900, true, '374151')}<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
      + `<c:cat><c:strRef><c:f>${ch.cats.ref}</c:f>${strCache(ch.cats.vals)}</c:strRef></c:cat><c:val><c:numRef><c:f>${s.ref}</c:f>${numCache(s.vals)}</c:numRef></c:val></c:ser>`).join('');
    const bar = ch.dir === 'bar';
    const maxAll = Math.max(0, ...ch.series.flatMap(s => s.vals.map(v => +v || 0)));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${C_NS}><c:roundedCorners val="0"/><c:chart>`
      + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:solidFill><a:srgbClr val="0B2A5B"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="en-AU" sz="1200" b="1"><a:solidFill><a:srgbClr val="0B2A5B"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${esc(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
      + `<c:plotArea><c:layout/><c:barChart><c:barDir val="${bar ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}<c:gapWidth val="${ch.series.length > 1 ? 80 : 55}"/>${ch.series.length > 1 ? '<c:overlap val="-5"/>' : ''}<c:axId val="10"/><c:axId val="20"/></c:barChart>`
      + `<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="${bar ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${bar ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="C9CED9"/></a:solidFill></a:ln></c:spPr>${txt(900, false, '374151')}<c:crossAx val="20"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/>${ch.pct ? '<c:max val="1"/>' : maxAll === 0 ? '<c:max val="1"/>' : ''}<c:min val="0"/></c:scaling><c:delete val="${bar ? 1 : 0}"/><c:axPos val="${bar ? 'b' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E8EE"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txt(800, false, '6B7385')}<c:crossAx val="10"/><c:crosses val="${bar ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`
      + `<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>`
      + (ch.series.length > 1 ? `<c:legend><c:legendPos val="t"/><c:overlay val="0"/>${txt(900, false, '374151')}</c:legend>` : '')
      + `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E5EC"/></a:solidFill></a:ln></c:spPr>${txt(900, false, '374151')}</c:chartSpace>`;
  }
  const drawingXml = (charts, first) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
    + charts.map((ch, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${ch.from.c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.from.r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${ch.to.c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.to.r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${esc(ch.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('') + `</xdr:wsDr>`;
  const REL = t => `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}`;
  const rels = list => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL(type)}" Target="${target}"/>`).join('')}</Relationships>`;
  function build(sheets) {
    const names = []; sheets.forEach(sh => { let n = String(sh.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet'; let k = 2; while (names.includes(n)) n = n.slice(0, 28) + ' ' + k++; names.push(n); });
    const filterRef = (sh, i) => { const top = (sh.title ? 1 : 0) + (sh.notes || []).length + (sh.title || (sh.notes || []).length ? 1 : 0) + 1;
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i]).replace(/'/g, "''")}'!$A$${top}:$${col(sh.header.length - 1)}$${top + sh.rows.length}</definedName>`; };
    const extra = []; const over = []; let chartNo = 0, drawNo = 0;
    sheets.forEach((sh, i) => { if (!sh.charts || !sh.charts.length) return; drawNo++;
      extra.push([`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, rels([['rId1', 'drawing', `../drawings/drawing${drawNo}.xml`]])]);
      extra.push([`xl/drawings/drawing${drawNo}.xml`, drawingXml(sh.charts)]); over.push(`<Override PartName="/xl/drawings/drawing${drawNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      const ids = sh.charts.map(ch => { chartNo++; extra.push([`xl/charts/chart${chartNo}.xml`, chartXml(ch)]); over.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`); return chartNo; });
      extra.push([`xl/drawings/_rels/drawing${drawNo}.xml.rels`, rels(ids.map((n, k) => [`rId${k + 1}`, 'chart', `../charts/chart${n}.xml`]))]); });
    const files = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${over.join('')}</Types>`],
      ['_rels/.rels', rels([['rId1', 'officeDocument', 'xl/workbook.xml']])],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((sh, i) => (!sh.raw && sh.rows.length ? filterRef(sh, i) : '')).join('')}</definedNames></workbook>`],
      ['xl/_rels/workbook.xml.rels', rels([...sheets.map((_, i) => [`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`]), [`rId${sheets.length + 1}`, 'styles', 'styles.xml']])],
      ['xl/styles.xml', STYLES],
      ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)]),
      ...extra,
    ];
    return zip(files);
  }
  /** Quote a sheet name for a formula reference. */
  const ref = (sheet, c1, r1, c2, r2) => `'${String(sheet).replace(/'/g, "''")}'!$${col(c1)}$${r1}:$${col(c2 ?? c1)}$${r2}`;
  return { build, ref, col };
})();
const boldRow = arr => Object.assign(arr, { __bold: true });
/** Offer a file through the viewer's download prompt (published page), or a plain browser download (offline copy). */
async function offerDownload(d, filename, bytes) {
  let dl = null; try { dl = window.claude?.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: new Blob([bytes]) }); d({ type: 'toast', msg: `${filename} downloaded` }); }
    catch (e) { d({ type: 'toast', msg: e?.code === 'declined' ? 'Download cancelled' : e?.code === 'rate_limited' ? 'A download is already waiting for you to confirm' : 'Downloads aren’t available here' }); }
    return;
  }
  try { const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    d({ type: 'toast', msg: `${filename} downloaded` });
  } catch (e) { d({ type: 'toast', msg: 'Downloads aren’t available here' }); }
}
const pct0 = x => Math.round(x * 100) + '%';
const fileSafe = t => String(t).replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim();

/* ======================= MONTHLY SUMMARIES ======================= */
/** Month activity for one state (or national when st is null). Rejected and duplicate audits never count. */
function monthStats(s, D, month, st) {
  const locs = D.locs.filter(l => l.state && (!st || l.state === st));
  const ids = new Set(locs.map(l => l.id));
  const all = activityAll(s).filter(v => v.status === 'Completed' && v.date.startsWith(month) && ids.has(v.loc));
  const vs = all.filter(v => !['Rejected', 'Duplicate'].includes(approvalOf(v)));
  const active = locs.filter(l => l.locStatus === 'Active');
  const seen = new Set(vs.map(v => v.loc)); const visited = active.filter(l => seen.has(l.id)).length;
  const sum = k => vs.reduce((t, v) => t + (+v[k] || 0), 0);
  const mEnd = month === curMonth() ? D.today : addDays(shiftMonth(month, 1) + '-01', -1);
  const ex = execStats(s, locs, month + '-01', mEnd);
  return { ex, share: ex.share, rbFacings: ex.rbFacings, compFacings: ex.compFacings, shelfLocs: ex.shelfLocs, ranging: ex.rangingAudited, compPos: ex.compPos, compCoolers: ex.compCoolers, vs, locs, audits: vs.length, pending: vs.filter(v => approvalOf(v) === 'Pending').length, excluded: all.length - vs.length,
    active: active.length, visited, coverage: active.length ? visited / active.length : 0, dpAdded: sum('dpAdded'), dpLost: sum('dpLost'), net: sum('dpAdded') - sum('dpLost'),
    editions: sum('editions'), pos: sum('posPlaced'), coolersIn: sum('coolersIn'), coolersOut: sum('coolersOut'), issues: vs.filter(v => v.issue).length,
    auditors: new Set(vs.map(v => v.staff).filter(Boolean)).size };
}
const monthRecipients = (s, st) => [...new Set([...managersFor(s, st), ...leadsFor(s, st)])];
const adminNames = s => s.people.filter(p => p.role === 'admin' && p.status === 'Active').map(p => p.name);
function stateMonthly(s, D, month, st) {
  const x = monthStats(s, D, month, st);
  const insts = D.liveUnis.filter(u => u.state === st).map(u => {
    const ls = x.locs.filter(l => l.uni === u.code); const act = ls.filter(l => l.locStatus === 'Active'); const vs = x.vs.filter(v => ls.some(l => l.id === v.loc));
    const seen = new Set(vs.map(v => v.loc));
    return { u, active: act.length, visited: act.filter(l => seen.has(l.id)).length, coverage: act.length ? act.filter(l => seen.has(l.id)).length / act.length : 0, audits: vs.length,
      net: vs.reduce((t, v) => t + (+v.dpAdded || 0) - (+v.dpLost || 0), 0), editions: vs.reduce((t, v) => t + (+v.editions || 0), 0), pos: vs.reduce((t, v) => t + (+v.posPlaced || 0), 0) };
  }).sort((a, b) => b.audits - a.audits || b.active - a.active || a.u.name.localeCompare(b.u.name));
  const sms = s.people.filter(p => p.role === 'marketeer' && p.state === st && (p.status === 'Active' || x.vs.some(v => v.staff === p.name))).map(p => {
    const vs = x.vs.filter(v => v.staff === p.name);
    return { p, audits: vs.length, locations: new Set(vs.map(v => v.loc)).size, net: vs.reduce((t, v) => t + (+v.dpAdded || 0) - (+v.dpLost || 0), 0), editions: vs.reduce((t, v) => t + (+v.editions || 0), 0),
      pos: vs.reduce((t, v) => t + (+v.posPlaced || 0), 0), coolers: vs.reduce((t, v) => t + (+v.coolersIn || 0), 0), last: vs.map(v => v.date).sort().at(-1) || null };
  }).sort((a, b) => b.audits - a.audits || a.p.name.localeCompare(b.p.name));
  const board = boardFor(s, month); const top = board.rows.filter(r => r.state === st && r.rank).slice(0, 3);
  const highlights = [];
  if (insts.some(i => i.audits)) highlights.push(`Most active: ${insts[0].u.name} (${insts[0].audits} audit${insts[0].audits === 1 ? '' : 's'})`);
  const idleInst = insts.filter(i => i.active && !i.audits); if (idleInst.length) highlights.push(`No audits at ${idleInst.length} institution${idleInst.length === 1 ? '' : 's'} with active locations: ${idleInst.slice(0, 4).map(i => i.u.short || i.u.name).join(', ')}${idleInst.length > 4 ? '…' : ''}`);
  const idle = sms.filter(r => r.p.status === 'Active' && !r.audits).length; if (sms.length) highlights.push(`${sms.length - idle} of ${sms.length} Student Marketeers completed audits${idle ? ` · ${idle} with none` : ''}`);
  if (x.share !== null) highlights.push(`Share of shelf ${pct0(x.share)} (Red Bull ${x.rbFacings} vs competitors ${x.compFacings} facings at ${x.shelfLocs} location${x.shelfLocs === 1 ? '' : 's'})`);
  if (x.ranging !== null) highlights.push(`Red Bull ranging ${pct0(x.ranging)} of SKUs at audited locations`);
  if (x.issues) highlights.push(`${x.issues} issue${x.issues === 1 ? '' : 's'} flagged at stores`);
  if (x.pending) highlights.push(`${x.pending} audit${x.pending === 1 ? '' : 's'} still awaiting approval`);
  if (!x.locs.length) highlights.push('No audit locations set up in this state yet');
  return { kind: 'state', key: `MS|${st}|${month}`, month, st, stName: s.states.find(z => z.code === st)?.name || st, x, insts, sms, top, highlights, to: monthRecipients(s, st), final: board.final };
}
function nationalMonthly(s, D, month) {
  const x = monthStats(s, D, month, null);
  const states = s.states.map(st => { const y = monthStats(s, D, month, st.code); const sm = s.people.filter(p => p.role === 'marketeer' && p.state === st.code && p.status === 'Active');
    return { st, y, sms: sm.length, activeSms: sm.filter(p => y.vs.some(v => v.staff === p.name)).length, insts: D.liveUnis.filter(u => u.state === st.code).length, managers: managersFor(s, st.code) }; });
  const board = boardFor(s, month); const top = board.rows.filter(r => r.rank).slice(0, 3);
  const ranked = [...states].filter(r => r.y.active).sort((a, b) => b.y.coverage - a.y.coverage);
  const highlights = [];
  const byAud = [...states].sort((a, b) => b.y.audits - a.y.audits);
  if (byAud[0]?.y.audits) highlights.push(`Most audits: ${byAud[0].st.code} (${byAud[0].y.audits})`);
  if (ranked.length) highlights.push(`Best coverage: ${ranked[0].st.code} (${pct0(ranked[0].y.coverage)} of active locations visited)`);
  const none = states.filter(r => !r.y.locs.length).map(r => r.st.code); if (none.length) highlights.push(`No audit locations yet: ${none.join(', ')}`);
  const quiet = states.filter(r => r.y.locs.length && !r.y.audits).map(r => r.st.code); if (quiet.length) highlights.push(`No audits this month: ${quiet.join(', ')}`);
  if (x.share !== null) highlights.push(`National share of shelf ${pct0(x.share)} · Red Bull ranging ${pctOr(x.ranging)} · ${x.editions} Editions, ${x.pos} POS, ${x.coolersIn} coolers`);
  const bestShare = states.filter(r => r.y.share !== null).sort((a, b) => b.y.share - a.y.share)[0]; if (bestShare) highlights.push(`Best share of shelf: ${bestShare.st.code} (${pct0(bestShare.y.share)})`);
  if (x.pending) highlights.push(`${x.pending} audit${x.pending === 1 ? '' : 's'} awaiting approval nationally`);
  return { kind: 'national', key: `MN|${month}`, month, x, states, top, highlights, to: adminNames(s), final: board.final };
}
/** Closed months get a summary on the 1st of the next month; the current month shows as month to date. Last 6 months. */
function summaryMonths(s) { const cur = curMonth(); const ms = [cur]; for (let i = 1; i <= 5; i++) ms.push(shiftMonth(cur, -i)); return ms; }
const summaryTs = m => `${shiftMonth(m, 1)}-01T08:00:00`;
function monthlyFor(s, D) {
  const out = []; const me = D.meP.name; const cur = curMonth();
  const myStates = s.states.map(x => x.code).filter(st => monthRecipients(s, st).includes(me) || (D.isMgr && D.meP.state === st));
  for (const m of summaryMonths(s)) {
    if (D.isAdmin) out.push(nationalMonthly(s, D, m));
    for (const st of (D.isAdmin ? s.states.map(x => x.code) : myStates)) out.push(stateMonthly(s, D, m, st));
  }
  return out.map(x => ({ ...x, closed: x.month < cur, mine: x.kind === 'national' ? D.isAdmin : myStates.includes(x.st) }));
}
function monthlyWorkbook(s, D, sm) {
  const ml = monthLabel(sm.month); const status = sm.month < curMonth() ? (sm.final ? 'Month closed · leaderboard final' : 'Month closed · leaderboard in review') : `Month to date at ${fmtDate(D.today)}`;
  const notes = [`${status}. Generated ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} by ${D.meP.name}.`, 'Counts Completed audits; rejected and duplicate audits are excluded. Coverage = active locations visited at least once in the month.'];
  const kpi = x => [['Audits completed', x.audits], ['Active locations', x.active], ['Locations visited', x.visited], ['Coverage', x.coverage], ['Student Marketeers auditing', x.auditors], ['Distribution points added', x.dpAdded], ['Distribution points lost', x.dpLost], ['Net distribution points', x.net], ['Editions sold in', x.editions], ['POS placed', x.pos], ['Coolers in', x.coolersIn], ['Coolers out', x.coolersOut], ['Share of shelf', pctOr(x.share)], ['Red Bull front facings', x.rbFacings], ['Competitor front facings', x.compFacings], ['Red Bull ranging (audited locations)', pctOr(x.ranging)], ['Competitor POS seen', x.compPos], ['Competitor coolers seen', x.compCoolers], ['Issues flagged', x.issues], ['Awaiting approval', x.pending]];
  const kpiSheet = (title, x, extra) => ({ name: 'Summary', title, notes, header: ['Measure', 'Value'], rows: [...kpi(x).map(([k, v]) => [k, k === 'Coverage' ? (x.active ? pct0(v) : '—') : v]), ...extra], widths: [34, 40] });
  const auditRows = vs => vs.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map(v => { const l = D.locBy[v.loc];
    return [v.date, v.staff || '', l?.state || '', l?.uniName || v.uni, l?.campus || '', l?.name || v.loc, l ? storeTypeOf(l) : '', approvalOf(v), +v.dpAdded || 0, +v.dpLost || 0, +v.editions || 0, +v.posPlaced || 0, +v.coolersIn || 0, +v.coolersOut || 0, v.rbFacings ?? '', v.compFacings ? compTotal(v.compFacings) : '', v.rbFacings !== null && v.rbFacings !== undefined && shelfShare(v.rbFacings, v.compFacings) !== null ? pct0(shelfShare(v.rbFacings, v.compFacings)) : '', v.compPos ?? '', v.compCoolers ?? '', v.compFacings ? compDetailText(v.compFacings, v.compDetail, l?.type === 'Vending').join('; ') : '', v.contactName || '', v.issue || '', v.demo ? 'Demo' : 'Live']; });
  const auditSheet = vs => ({ name: 'Audits', header: ['Date', 'Student Marketeer', 'State', 'University or TAFE', 'Campus', 'Location', 'Store type', 'Approval', 'DPs added', 'DPs lost', 'Editions', 'POS', 'Coolers in', 'Coolers out', 'Red Bull facings', 'Competitor facings', 'Share of shelf', 'Competitor POS', 'Competitor coolers', 'Competitor detail', 'Spoke to', 'Issue', 'Source'], rows: auditRows(vs) });
  const instSheet = insts => ({ name: 'Institutions', header: ['University or TAFE', 'Type', 'State', 'Active locations', 'Visited', 'Coverage', 'Audits', 'Net DPs', 'Editions', 'POS'], pct: [5],
    rows: insts.map(i => [i.u.name, i.u.kind, i.u.state, i.active, i.visited, i.active ? i.coverage : null, i.audits, i.net, i.editions, i.pos]) });
  const smSheet = sms => ({ name: 'Student Marketeers', header: ['Student Marketeer', 'State', 'Reports to', 'Audits', 'Locations', 'Net DPs', 'Editions', 'POS', 'Coolers in', 'Last audit'],
    rows: sms.map(r => [r.p.name, r.p.state, r.p.reportsTo || 'Not set', r.audits, r.locations, r.net, r.editions, r.pos, r.coolers, r.last || '']) });
  const brandSheet = { name: 'Share of shelf', header: ['Brand', 'Front facings', 'Share', 'Locations seen at'], rows: Object.entries(sm.x.ex.brands).sort((a, b) => (a[0] === 'Red Bull' ? -1 : b[0] === 'Red Bull' ? 1 : b[1] - a[1])).map(([b, n]) => [b, n, sm.x.rbFacings + sm.x.compFacings ? pct0(n / (sm.x.rbFacings + sm.x.compFacings)) : '', b === 'Red Bull' ? sm.x.shelfLocs : (sm.x.ex.present[b] || 0)]) };
  const topRows = sm.top.map(r => [`Leaderboard #${r.rank}`, `${r.name} (${one(r.total)})`]);
  if (sm.kind === 'state') {
    const sum = kpiSheet(`${sm.stName} · monthly summary · ${ml}`, sm.x, [...topRows, ['Sent to', sm.to.join(', ') || 'No managers set']]);
    return { filename: fileSafe(`ECA ${sm.st} monthly summary ${ml}.xlsx`), sheets: [sum, brandSheet, instSheet(sm.insts), smSheet(sm.sms), auditSheet(sm.x.vs)] };
  }
  const sum = kpiSheet(`National breakdown · ${ml}`, sm.x, topRows);
  const byState = { name: 'By state', header: ['State', 'Universities & TAFEs', 'Active locations', 'Visited', 'Coverage', 'Audits', 'Student Marketeers', 'SMs auditing', 'Net DPs', 'Editions', 'POS', 'Coolers in', 'Share of shelf', 'Ranging', 'Issues', 'Awaiting approval', 'Managers'], pct: [4],
    rows: [...sm.states.map(r => [r.st.name, r.insts, r.y.active, r.y.visited, r.y.active ? r.y.coverage : null, r.y.audits, r.sms, r.activeSms, r.y.net, r.y.editions, r.y.pos, r.y.coolersIn, pctOr(r.y.share, ''), pctOr(r.y.ranging, ''), r.y.issues, r.y.pending, r.managers.join(', ')]),
      boldRow(['National', sm.states.reduce((t, r) => t + r.insts, 0), sm.x.active, sm.x.visited, sm.x.active ? sm.x.coverage : null, sm.x.audits, sm.states.reduce((t, r) => t + r.sms, 0), sm.states.reduce((t, r) => t + r.activeSms, 0), sm.x.net, sm.x.editions, sm.x.pos, sm.x.coolersIn, pctOr(sm.x.share, ''), pctOr(sm.x.ranging, ''), sm.x.issues, sm.x.pending, ''])] };
  const allInsts = s.states.flatMap(st => stateMonthly(s, D, sm.month, st.code).insts);
  const allSms = s.states.flatMap(st => stateMonthly(s, D, sm.month, st.code).sms);
  return { filename: fileSafe(`ECA national breakdown ${ml}.xlsx`), sheets: [sum, byState, brandSheet, instSheet(allInsts), smSheet(allSms), auditSheet(sm.x.vs)] };
}
function downloadMonthly(s, D, d, sm) { const wb = monthlyWorkbook(s, D, sm); offerDownload(d, wb.filename, XLSX_MINI.build(wb.sheets)); }

function MonthlyCard({ sm }) {
  const { d } = useApp();
  const x = sm.x; const title = sm.kind === 'national' ? 'National breakdown' : `${sm.stName}`;
  return html`<button class="ucard" onClick=${() => d({ type: 'modal', modal: { kind: 'monthly', key: sm.key } })}>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><div class="xs muted" style="font-weight:600">${monthLabel(sm.month)}${sm.closed ? '' : ' · month to date'}</div>
      ${sm.kind === 'national' ? html`<span class="chip unitag">All states</span>` : html`<span class="chip plain">${sm.st}</span>`}</div>
    <h3 style="font-size:18px">${title}</h3>
    <div class="stats"><div><b class="num">${x.audits}</b><span>Audits</span></div><div><b class="num">${x.active ? pct0(x.coverage) : '—'}</b><span>Coverage</span></div><div><b class="num">${signed(x.net)}</b><span>Net DPs</span></div></div>
    <div class="small" style="color:var(--ink-2)">${sm.highlights[0] || 'No activity recorded'}</div>
    <div class="xs muted">${sm.kind === 'national' ? 'For Administrators' : `For ${sm.to.join(', ') || 'no managers set'}`}</div></button>`;
}
function MonthlySummaries() {
  const { s, D } = useApp();
  const all = useMemo(() => monthlyFor(s, D), [s.visits, s.demo, s.people, s.locations, s.unis, s.snapshots, s.leads, D]);
  const months = summaryMonths(s);
  const [m, setM] = useState(() => months[1]);
  const rows = all.filter(x => x.month === m);
  const nat = rows.filter(x => x.kind === 'national'); const sts = rows.filter(x => x.kind === 'state');
  return html`<div class="banner info"><${Icon} n="inbox" s=${18} /><div>${D.isAdmin ? 'A national breakdown of every state’s performance' : `A ${D.meP.state} summary`} lands in your inbox on the 1st of each month. Open one to see the detail or download it to Excel.</div></div>
    <div class="toolbar"><${Select} id="ms-m" label="Month" value=${m} onChange=${setM} options=${months.map(x => [x, monthLabel(x) + (x === curMonth() ? ' · month to date' : '')])} /></div>
    ${nat.length ? html`<section style="display:flex;flex-direction:column;gap:10px"><h2>National</h2><div class="vcards">${nat.map(x => html`<${MonthlyCard} key=${x.key} sm=${x} />`)}</div></section>` : null}
    ${sts.length ? html`<section style="display:flex;flex-direction:column;gap:10px">${D.isAdmin ? html`<h2>By state</h2>` : null}<div class="vcards">${sts.map(x => html`<${MonthlyCard} key=${x.key} sm=${x} />`)}</div></section>`
      : nat.length ? null : html`<${Empty} title="No monthly summaries for you" body="Monthly summaries go to each state’s Managers and Education Channel Lead, and the national breakdown to Administrators." />`}`;
}
function MonthlyView({ k, onClose }) {
  const { s, d, D } = useApp();
  const sm = useMemo(() => monthlyFor(s, D).find(x => x.key === k), [k, s, D]);
  if (!sm) return null;
  const x = sm.x; const ml = monthLabel(sm.month);
  const kpis = html`<div class="kpis"><${Kpi} label="Audits" value=${x.audits} sub=${x.pending ? `${x.pending} awaiting approval` : null} /><${Kpi} label="Coverage" value=${x.active ? pct0(x.coverage) : '—'} sub=${`${x.visited} of ${x.active} active locations`} /><${Kpi} label="Net DPs" value=${signed(x.net)} sub=${`+${x.dpAdded} / −${x.dpLost}`} tone=${x.net > 0 ? 'good' : x.net < 0 ? 'bad' : ''} /><${Kpi} label="Editions · POS" value=${`${x.editions} · ${x.pos}`} sub=${`Coolers +${x.coolersIn} / −${x.coolersOut}`} /></div>
    <div class="kpis"><${Kpi} label="Coolers placed" value=${x.coolersIn} sub=${x.coolersOut ? `${x.coolersOut} removed` : null} /><${Kpi} label="Share of shelf" value=${pctOr(x.share)} sub=${x.shelfLocs ? `Red Bull ${x.rbFacings} vs competitors ${x.compFacings}` : 'No facings recorded'} tone=${x.share === null ? '' : x.share >= 0.5 ? 'good' : 'warn'} /><${Kpi} label="Red Bull ranging" value=${pctOr(x.ranging)} sub="Of SKUs, at audited locations" /><${Kpi} label="Competitor execution" value=${`${x.compPos} · ${x.compCoolers}`} sub="POS pieces · coolers seen" /></div>
    ${x.shelfLocs ? html`<div><div class="label" style="margin-bottom:6px">Share of shelf vs competitors</div><${ShareBar} brands=${x.ex.brands} /></div>` : null}`;
  const top = sm.top.length ? html`<div><div class="label" style="margin-bottom:6px">Leaderboard${sm.final ? '' : ' (provisional)'}</div><div class="chips">${sm.top.map(r => html`<span key=${r.id} class="chip plain"><span class=${'medal m' + r.rank}>${r.rank}</span>${r.name} · ${one(r.total)}</span>`)}</div></div>` : null;
  const body = sm.kind === 'national'
    ? html`<div class="tbl-wrap"><table><thead><tr><th>State</th><th class="n">Audits</th><th class="n">Coverage</th><th class="n hide-m">Active locations</th><th class="n hide-m">SMs auditing</th><th class="n">Net DPs</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th><th class="n hide-m">Issues</th><th class="n">Share</th><th class="n hide-m">Ranging</th></tr></thead><tbody>
        ${sm.states.map(r => html`<tr key=${r.st.code}><td><b>${r.st.code}</b> <span class="muted small">${r.st.name}</span></td><td class="n">${r.y.audits}</td><td class="n">${r.y.active ? pct0(r.y.coverage) : '—'}</td><td class="n hide-m">${r.y.active}</td><td class="n hide-m">${r.activeSms} of ${r.sms}</td><td class="n">${signed(r.y.net)}</td><td class="n hide-m">${r.y.editions}</td><td class="n hide-m">${r.y.pos}</td><td class="n hide-m">${r.y.issues}</td><td class="n">${pctOr(r.y.share)}</td><td class="n hide-m">${pctOr(r.y.ranging)}</td></tr>`)}
        <tr><td><b>National</b></td><td class="n"><b>${x.audits}</b></td><td class="n"><b>${x.active ? pct0(x.coverage) : '—'}</b></td><td class="n hide-m"><b>${x.active}</b></td><td class="n hide-m"><b>${sm.states.reduce((t, r) => t + r.activeSms, 0)} of ${sm.states.reduce((t, r) => t + r.sms, 0)}</b></td><td class="n"><b>${signed(x.net)}</b></td><td class="n hide-m"><b>${x.editions}</b></td><td class="n hide-m"><b>${x.pos}</b></td><td class="n hide-m"><b>${x.issues}</b></td><td class="n"><b>${pctOr(x.share)}</b></td><td class="n hide-m"><b>${pctOr(x.ranging)}</b></td></tr></tbody></table></div>`
    : html`<div class="tbl-wrap"><table><thead><tr><th>University or TAFE</th><th class="n">Audits</th><th class="n">Coverage</th><th class="n hide-m">Net DPs</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th></tr></thead><tbody>
        ${sm.insts.map(i => html`<tr key=${i.u.code}><td><b>${i.u.name}</b><div class="xs muted">${i.u.kind} · ${i.active} active location${i.active === 1 ? '' : 's'}</div></td><td class="n">${i.audits}</td><td class="n">${i.active ? pct0(i.coverage) : '—'}</td><td class="n hide-m">${signed(i.net)}</td><td class="n hide-m">${i.editions}</td><td class="n hide-m">${i.pos}</td></tr>`)}</tbody></table></div>
      <div class="tbl-wrap"><table><thead><tr><th>Student Marketeer</th><th class="n">Audits</th><th class="n hide-m">Locations</th><th class="n">Net DPs</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th></tr></thead><tbody>
        ${sm.sms.map(r => html`<tr key=${r.p.id}><td><b>${r.p.name}</b><div class="xs muted">Reports to ${r.p.reportsTo || 'not set'}</div></td><td class="n">${r.audits}</td><td class="n hide-m">${r.locations}</td><td class="n">${signed(r.net)}</td><td class="n hide-m">${r.editions}</td><td class="n hide-m">${r.pos}</td></tr>`)}</tbody></table></div>`;
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mv-h" style="width:min(860px,100%)"><div class="sheet-h"><div><div class="xs muted">${sm.kind === 'national' ? 'National breakdown · for Administrators' : `Monthly state summary · for ${sm.to.join(', ') || 'no managers set'}`}</div><h2 id="mv-h">${sm.kind === 'national' ? 'All states' : sm.stName} · ${ml}${sm.closed ? '' : ' (month to date)'}</h2></div><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b">${kpis}
      ${sm.highlights.length ? html`<div><div class="label">Highlights</div><ul style="margin:6px 0 0;padding-left:18px">${sm.highlights.map((t, i) => html`<li key=${i}>${t}</li>`)}</ul></div>` : null}
      ${top}${body}
      <p class="xs muted" style="margin:0">Counts Completed audits in ${ml}; rejected and duplicate audits are left out. Coverage is the share of active locations visited at least once in the month.</p></div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Close</button><button class="btn primary" onClick=${() => downloadMonthly(s, D, d, sm)}><${Icon} n="download" s=${16} />Download Excel</button></div></div>`;
}

/* ======================= EXECUTION METRICS (POS, coolers, Editions, share of shelf, ranging) ======================= */
/** Share of Red Bull SKUs ranged at a location (0–1), from a ranging answer set; null when nothing was answered. */
function rbRangePct(s, l, rg) {
  if (!rg) return null;
  const prods = s.ref.products.filter(x => !x.competitor && (l?.type === 'Vending' ? x.vending : x.qsr));
  const ans = prods.filter(x => rg[x.key] === 0 || rg[x.key] === 1 || rg[x.key] === '0' || rg[x.key] === '1');
  return ans.length ? ans.filter(x => +rg[x.key] === 1).length / ans.length : null;
}
const compRanged = (s, l, rg) => !!rg && s.ref.products.some(x => x.competitor && (l?.type === 'Vending' ? x.vending : x.qsr) && +rg[x.key] === 1);
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/**
 * Execution for a set of locations over [start, end]. Counts Completed audits (rejected and duplicate excluded), demo activity included.
 * Share of shelf uses the latest audit per location in the period that recorded front facings.
 */
function execStats(s, locs, start, end) {
  const ids = new Set(locs.map(l => l.id)); const byId = Object.fromEntries(locs.map(l => [l.id, l]));
  const vs = activityAll(s).filter(v => v.status === 'Completed' && ids.has(v.loc) && v.date >= start && v.date <= end && !['Rejected', 'Duplicate'].includes(approvalOf(v)));
  const sum = k => vs.reduce((t, v) => t + (+v[k] || 0), 0);
  const latestF = {}; const latestR = {};
  vs.forEach(v => { const k = v.date + (v.time || '');
    if (v.rbFacings !== null && v.rbFacings !== undefined && (!latestF[v.loc] || k > latestF[v.loc].k)) latestF[v.loc] = { k, v };
    if (v.response?.ranging && (!latestR[v.loc] || k > latestR[v.loc].k)) latestR[v.loc] = { k, v }; });
  const brands = {}; let rb = 0, comp = 0;
  Object.values(latestF).forEach(({ v }) => { rb += +v.rbFacings || 0; brands['Red Bull'] = (brands['Red Bull'] || 0) + (+v.rbFacings || 0);
    Object.entries(v.compFacings || {}).forEach(([c, n]) => { comp += +n || 0; brands[c] = (brands[c] || 0) + (+n || 0); }); });
  const present = {}; Object.values(latestF).forEach(({ v }) => Object.keys(v.compFacings || {}).forEach(c => { present[c] = (present[c] || 0) + 1; }));
  const act = locs.filter(l => l.locStatus === 'Active');
  const nowPcts = act.map(l => rbRangePct(s, l, l.ranging)).filter(x => x !== null);
  const auditPcts = Object.values(latestR).map(({ v }) => rbRangePct(s, byId[v.loc], v.response.ranging)).filter(x => x !== null);
  return { vs, audits: vs.length, pos: sum('posPlaced'), coolers: sum('coolersIn'), coolersOut: sum('coolersOut'), editions: sum('editions'), dpAdded: sum('dpAdded'), dpLost: sum('dpLost'),
    rbFacings: rb, compFacings: comp, share: rb + comp ? rb / (rb + comp) : null, shelfLocs: Object.keys(latestF).length, brands, present,
    compPos: vs.reduce((t, v) => t + (+v.compPos || 0), 0), compCoolers: vs.reduce((t, v) => t + (+v.compCoolers || 0), 0),
    rangingNow: avg(nowPcts), rangedLocs: nowPcts.length, compPresentNow: act.length ? act.filter(l => compRanged(s, l, l.ranging)).length / act.length : null,
    rangingAudited: avg(auditPcts), activeLocs: act.length };
}
const pctOr = (x, d = '—') => (x === null || x === undefined ? d : pct0(x));
const deltaTxt = (now, prev, unit = '') => { const d = now - prev; return d === 0 ? 'Same as the previous period' : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs previous period`; };

/** Running totals per day for POS, coolers and Editions (chart). */
function dailyCumulative(vs, start, end) {
  const days = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const by = {}; vs.forEach(v => { const x = by[v.date] = by[v.date] || { pos: 0, coolers: 0, editions: 0 }; x.pos += +v.posPlaced || 0; x.coolers += +v.coolersIn || 0; x.editions += +v.editions || 0; });
  let p = 0, c = 0, e = 0; return days.map(d => { const x = by[d] || {}; p += x.pos || 0; c += x.coolers || 0; e += x.editions || 0; return { d, pos: p, coolers: c, editions: e, dayPos: x.pos || 0, dayCool: x.coolers || 0, dayEd: x.editions || 0 }; });
}
const EXEC_SERIES = [['editions', 'Editions sold in', '#0B2A5B', 'var(--brand)'], ['pos', 'POS placed', '#0F8B8D', '#3FC1C3'], ['coolers', 'Coolers placed', '#B88A00', '#F2C230']];
function ExecTrend({ days, caption }) {
  const W = 560, H = 230, L = 34, B = 26, T = 14, R = 92;
  const max = Math.max(1, ...days.map(x => Math.max(x.pos, x.coolers, x.editions)));
  const n = Math.max(1, days.length - 1); const X = i => L + (W - L - R) * (i / n); const Y = v => T + (H - T - B) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const lab = days.length > 1 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [0];
  const dark = typeof matchMedia !== 'undefined' && document.documentElement.dataset.theme !== 'light' && (document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches);
  // place end labels without overlap
  const ends = EXEC_SERIES.map(([k, label]) => ({ k, label, y: Y(days.at(-1)?.[k] || 0), v: days.at(-1)?.[k] || 0 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  return html`<figure style="margin:0"><div class="legend" style="margin-bottom:8px">${EXEC_SERIES.map(([k, l, c, cd]) => html`<span key=${k}><i class="sw" style=${{ background: dark ? cd : c }}></i>${l}</span>`)}</div>
  <div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${caption}>
    ${ticks.map(t => html`<g key=${t}><line x1=${L} x2=${W - R} y1=${Y(t)} y2=${Y(t)} stroke="var(--line)" /><text x=${L - 6} y=${Y(t) + 4} text-anchor="end" font-size="11" fill="var(--ink-3)">${t}</text></g>`)}
    ${lab.map(i => html`<text key=${'d' + i} x=${X(i)} y=${H - 8} text-anchor=${i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} font-size="11" fill="var(--ink-3)">${fmtShort(days[i].d)}</text>`)}
    ${EXEC_SERIES.map(([k, l, c, cd]) => html`<g key=${k}><polyline fill="none" stroke=${dark ? cd : c} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points=${days.map((x, i) => `${X(i)},${Y(x[k])}`).join(' ')} />
      <circle cx=${X(days.length - 1)} cy=${Y(days.at(-1)[k])} r="3.5" fill=${dark ? cd : c} /></g>`)}
    ${ends.map(e => { const c = EXEC_SERIES.find(z => z[0] === e.k); return html`<text key=${'e' + e.k} x=${W - R + 8} y=${e.y + 4} font-size="11" font-weight="700" fill=${dark ? c[3] : c[2]}>${e.v} ${c[1].split(' ')[0]}</text>`; })}
    ${days.map((x, i) => html`<rect key=${'h' + i} x=${X(i) - (W - L - R) / n / 2} y=${T} width=${(W - L - R) / n} height=${H - T - B} fill="transparent"><title>${fmtDate(x.d)}: ${x.dayEd} Editions, ${x.dayPos} POS, ${x.dayCool} coolers that day · running total ${x.editions} / ${x.pos} / ${x.coolers}</title></rect>`)}
  </svg></div><figcaption class="sr">${caption}</figcaption></figure>`;
}
const BRAND_FILL = ['var(--brand)', '#6B7385', '#8C97AD', '#A9B2C3', '#C9CED9', '#D9DDE5', '#E5E8EE'];
function ShareBar({ brands }) {
  const ent = Object.entries(brands).filter(([, n]) => n > 0).sort((a, b) => (a[0] === 'Red Bull' ? -1 : b[0] === 'Red Bull' ? 1 : b[1] - a[1]));
  const tot = ent.reduce((t, [, n]) => t + n, 0); if (!tot) return null;
  return html`<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;height:30px;border-radius:8px;overflow:hidden;border:1px solid var(--line)" role="img" aria-label=${'Share of front facings: ' + ent.map(([b, n]) => `${b} ${pct0(n / tot)}`).join(', ')}>
      ${ent.map(([b, n], i) => html`<div key=${b} title=${`${b}: ${n} facings (${pct0(n / tot)})`} style=${{ width: (n / tot * 100) + '%', background: BRAND_FILL[Math.min(i, BRAND_FILL.length - 1)], color: i < 2 ? '#fff' : '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, borderRight: '1px solid var(--surface)', whiteSpace: 'nowrap', overflow: 'hidden' }}>${n / tot > 0.09 ? pct0(n / tot) : ''}</div>`)}</div>
    <div class="legend">${ent.map(([b, n], i) => html`<span key=${b}><i class="sw" style=${{ background: BRAND_FILL[Math.min(i, BRAND_FILL.length - 1)] }}></i>${b} · ${n} (${pct0(n / tot)})</span>`)}</div></div>`;
}
function ExecSection({ locs, f, start, sRows, iRows }) {
  const { s, D } = useApp();
  const cStart = f.range === 'all' ? addDays(D.today, -89) : start;
  const x = execStats(s, locs, start, D.today);
  const prevEnd = addDays(start, -1); const prevStart = addDays(prevEnd, -(diffDays(D.today, start)));
  const pv = f.range === 'all' ? null : execStats(s, locs, prevStart, prevEnd);
  const trend = dailyCumulative(execStats(s, locs, cStart, D.today).vs, cStart, D.today);
  const hasDemo = x.vs.some(v => v.demo);
  const rows = (D.isAdmin && f.state === 'all' ? sRows.map(r => ({ key: r.st.code, label: r.st.name, ls: r.ls })) : iRows.map(r => ({ key: r.u.code, label: r.u.name, sub: r.u.kind, ls: r.ls })))
    .map(r => ({ ...r, e: execStats(s, r.ls, start, D.today) }));
  const kp = (label, val, sub, tone) => html`<${Kpi} label=${label} value=${val} sub=${sub} tone=${tone} />`;
  return html`<section class="card" style="display:flex;flex-direction:column;gap:16px"><div class="card-h" style="margin:0"><div><h2>Execution</h2><p class="small muted" style="margin:2px 0 0">POS, coolers, Editions, share of shelf and ranging · ${RANGES.find(r => r[0] === f.range)[1].toLowerCase()} · updated ${fmtDate(D.today)}${hasDemo ? ' · includes demo activity' : ''}</p></div></div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      ${kp('Editions sold in', x.editions, pv ? deltaTxt(x.editions, pv.editions) : null, pv && x.editions > pv.editions ? 'good' : '')}
      ${kp('POS placed', x.pos, pv ? deltaTxt(x.pos, pv.pos) : null, pv && x.pos > pv.pos ? 'good' : '')}
      ${kp('Coolers placed', x.coolers, (pv ? deltaTxt(x.coolers, pv.coolers) : '') + (x.coolersOut ? ` · ${x.coolersOut} removed` : ''), pv && x.coolers > pv.coolers ? 'good' : '')}
      ${kp('Share of shelf', pctOr(x.share), x.shelfLocs ? `Red Bull ${x.rbFacings} vs competitors ${x.compFacings} facings · ${x.shelfLocs} location${x.shelfLocs === 1 ? '' : 's'}` : 'No front facings recorded yet', x.share === null ? '' : x.share >= 0.5 ? 'good' : 'warn')}
      ${kp('Red Bull ranging', pctOr(x.rangingNow), x.rangedLocs ? `Of Red Bull SKUs, across ${x.rangedLocs} active locations · competitors ranged at ${pctOr(x.compPresentNow)}` : 'No ranging recorded yet')}
    </div>
    <div class="grid g2">
      <div><h3 style="margin-bottom:8px">Running totals</h3><${ExecTrend} days=${trend} caption="Running totals of Editions sold in, POS placed and coolers placed, by day" />${f.range === 'all' ? html`<p class="xs muted" style="margin:6px 0 0">Chart shows the last 90 days.</p>` : null}</div>
      <div style="display:flex;flex-direction:column;gap:12px"><h3>Share of shelf vs competitors</h3>
        ${x.shelfLocs ? html`<${ShareBar} brands=${x.brands} />
          <div class="tbl-wrap"><table><thead><tr><th>Competitor</th><th class="n">Facings</th><th class="n">Seen at</th></tr></thead><tbody>${Object.entries(x.brands).filter(([b]) => b !== 'Red Bull').sort((a, b) => b[1] - a[1]).map(([b, n]) => html`<tr key=${b}><td>${b}</td><td class="n">${n}</td><td class="n">${x.present[b] || 0} of ${x.shelfLocs}</td></tr>`)}</tbody></table></div>
          ${x.compPos || x.compCoolers ? html`<p class="small" style="margin:0">Competitor execution seen: <b>${x.compPos}</b> POS pieces · <b>${x.compCoolers}</b> coolers.</p>` : null}`
          : html`<${Empty} title="No front facings yet" body="Share of shelf fills in as Student Marketeers record Red Bull and competitor front facings in step 3 of an audit." />`}</div></div>
    <div><h3 style="margin-bottom:8px">${D.isAdmin && f.state === 'all' ? 'By state' : 'By university and TAFE'}</h3>
      ${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th>${D.isAdmin && f.state === 'all' ? 'State' : 'University or TAFE'}</th><th class="n">Editions</th><th class="n">POS</th><th class="n">Coolers</th><th class="n">Share of shelf</th><th class="n">Ranging</th></tr></thead><tbody>
        ${rows.map(r => html`<tr key=${r.key}><td><b>${r.label}</b>${r.sub ? html`<div class="xs muted">${r.sub}</div>` : null}</td><td class="n">${r.e.editions}</td><td class="n">${r.e.pos}</td><td class="n">${r.e.coolers}</td><td class="n">${pctOr(r.e.share)}</td><td class="n">${pctOr(r.e.rangingNow)}</td></tr>`)}</tbody></table></div>` : html`<p class="small muted" style="margin:0">Nothing in this view.</p>`}
      <p class="xs muted" style="margin:8px 0 0">Share of shelf = Red Bull front facings ÷ all front facings, using each location’s latest audit in the period. Ranging = share of the Red Bull SKUs checked that are ranged, at active locations as of their latest audit.</p></div></section>`;
}
/** Prototype only: give demo audits front facings and competitor detail so the charts have something to show. Deterministic per audit id. */
function demoFacings(v, l) {
  if (v.rbFacings !== undefined && v.rbFacings !== null) return v;
  let h = 0; for (const ch of String(v.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const R = mulberry(h); const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pool = l?.type === 'Vending' ? ['Monster', 'V'] : ['Monster', 'V', 'Solo Energy', 'Celsius'];
  const n = ri(1, l?.type === 'Vending' ? 2 : 3); const comps = pool.slice().sort(() => R() - 0.5).slice(0, n);
  const compFacings = Object.fromEntries(comps.map(c => [c, ri(1, c === 'Monster' ? 7 : 4)]));
  const compDetail = Object.fromEntries(comps.map(c => [c, { price: +(2.8 + R() * 1.8).toFixed(2), pos: l?.type === 'Vending' ? 0 : (R() < 0.35 ? ri(1, 2) : 0), coolers: l?.type === 'Vending' ? 0 : (R() < 0.15 ? 1 : 0) }]));
  return { ...v, rbFacings: ri(2, 9), compFacings, compDetail, compPos: Object.values(compDetail).reduce((t, x) => t + x.pos, 0), compCoolers: Object.values(compDetail).reduce((t, x) => t + x.coolers, 0) };
}

/* ======================= MONTHLY AUDIT EXPORT (generated on the last calendar day; one sheet per state) ======================= */
const monthLastDay = m => addDays(shiftMonth(m, 1) + '-01', -1);
/** States this person receives exports for: all for Administrators, their own for Managers. */
const exportStates = (s, D) => (D.isAdmin ? s.states.map(x => x.code) : D.isMgr ? [D.meP.state] : []);
/** Last 12 months whose last day has arrived, newest first; plus the current month (not yet generated). */
function exportMonths(D) {
  const cur = curMonth(); const out = [];
  for (let i = 0; i < 12; i++) { const m = shiftMonth(cur, -i); out.push({ month: m, last: monthLastDay(m), ready: monthLastDay(m) <= D.today }); }
  return out;
}
function auditsFor(s, D, month, st) {
  return activityAll(s).filter(v => v.date.startsWith(month) && D.locBy[v.loc]?.state === st)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')) || String(a.id).localeCompare(String(b.id)));
}
const ynx = v => (v === 1 || v === '1' ? 'Yes' : v === 0 || v === '0' ? 'No' : '');
function auditExportWorkbook(s, D, month, states) {
  const ml = monthLabel(month); const ready = monthLastDay(month) <= D.today;
  const prods = s.ref.products;
  const head = ['Audit ID', 'Date', 'Time', 'Student Marketeer', 'Reports to', 'Visit status', 'Approval', 'Counted', 'University or TAFE', 'Type', 'Campus', 'Location ID', 'Location', 'Location type', 'Store type',
    'Contact name', 'Contact role',
    ...prods.map(p => `${p.label}${p.competitor ? ' (comp)' : ''} ranged`), 'Red Bull ranging %',
    'Red Bull price', 'Top competitor', 'Competitor price', 'Red Bull POS present', 'Red Bull cooler present', 'Bullring / Bull’s Eye', 'Channel', 'Classification',
    'Red Bull facings', 'Competitor facings', 'Share of shelf', 'Competitor POS seen', 'Competitor coolers seen', 'Competitor detail',
    'DPs added', 'DPs lost', 'Net DPs', 'Editions sold in', 'Edition flavours', 'POS placed', 'POS type', 'Coolers in', 'Coolers out',
    'Vending company', 'Machine ID', 'Issue', 'Notes', 'Next step', 'Follow-up', 'Submitted by', 'Submitted at', 'Approved by', 'Source'];
  const row = v => { const l = D.locBy[v.loc]; const r = v.response || {}; const rg = r.ranging || {}; const p = s.people.find(x => x.name === v.staff);
    const counted = v.status === 'Completed' && !['Rejected', 'Duplicate'].includes(approvalOf(v));
    const rp = rbRangePct(s, l, r.ranging);
    return [v.id, v.date, v.time || '', v.staff || '', p?.reportsTo || '', v.status, v.status === 'Completed' ? approvalOf(v) : '', counted ? 'Yes' : 'No', l?.uniName || v.uni, l?.kind || '', l?.campus || '', v.loc, l?.name || '', l?.type || '', l ? storeTypeOf(l) : '',
      v.contactName || '', v.contactRole || '',
      ...prods.map(x => ynx(rg[x.key])), rp === null ? '' : pct0(rp),
      r.price === '' || r.price === undefined || r.price === null ? '' : +r.price, r.comp || '', r.compPrice === '' || r.compPrice === undefined || r.compPrice === null ? '' : +r.compPrice, ynx(r.pos), ynx(r.cooler), r.bull || '', r.channel || '', r.classification || '',
      v.rbFacings ?? '', v.compFacings ? compTotal(v.compFacings) : '', v.rbFacings !== null && v.rbFacings !== undefined && shelfShare(v.rbFacings, v.compFacings) !== null ? pct0(shelfShare(v.rbFacings, v.compFacings)) : '',
      v.compPos ?? '', v.compCoolers ?? '', v.compFacings ? compDetailText(v.compFacings, v.compDetail, l?.type === 'Vending').join('; ') : '',
      +v.dpAdded || 0, +v.dpLost || 0, (+v.dpAdded || 0) - (+v.dpLost || 0), +v.editions || 0, v.flavours || '', +v.posPlaced || 0, v.posType || '', +v.coolersIn || 0, +v.coolersOut || 0,
      r.vendCo || '', r.machineId || '', v.issue || '', v.notes || '', v.nextStep || '', v.followUp || '', v.submittedBy || '', v.submittedAt ? v.submittedAt.replace('T', ' ').slice(0, 16) : '', v.approvedBy || '', v.demo ? 'Demo' : v.imported ? 'Workbook import' : 'Live']; };
  const summary = states.map(st => { const all = auditsFor(s, D, month, st); const vs = all.filter(v => v.status === 'Completed' && !['Rejected', 'Duplicate'].includes(approvalOf(v)));
    const locs = D.locs.filter(l => l.state === st); const e = execStats(s, locs, month + '-01', ready ? monthLastDay(month) : D.today); const act = locs.filter(l => l.locStatus === 'Active'); const seen = new Set(vs.map(v => v.loc));
    return [s.states.find(x => x.code === st)?.name || st, all.length, vs.length, all.filter(v => v.status === 'Completed' && approvalOf(v) === 'Pending').length, all.filter(v => ['Rejected', 'Duplicate'].includes(approvalOf(v))).length,
      new Set(vs.map(v => v.staff).filter(Boolean)).size, act.filter(l => seen.has(l.id)).length, act.length, act.length ? pct0(act.filter(l => seen.has(l.id)).length / act.length) : '',
      e.editions, e.pos, e.coolers, e.dpAdded - e.dpLost, pctOr(e.share, ''), pctOr(e.rangingAudited, ''), managersFor(s, st).join(', ')]; });
  const tot = summary.reduce((t, r) => r.map((v, i) => (typeof v === 'number' ? (t[i] || 0) + v : t[i])), []);
  const sumSheet = { name: 'Summary', title: `ECA audit export · ${ml}${states.length === 1 ? ' · ' + states[0] : ' · all states'}`,
    notes: [ready ? `Month closed on ${fmtDate(monthLastDay(month))}. Generated ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} by ${D.meP.name}.` : `Month to date (${fmtDate(D.today)}). The full export generates on ${fmtDate(monthLastDay(month))}.`,
      'One sheet per state lists every audit in the month, including scheduled, cancelled, rejected and duplicate ones. “Counted” = completed and not rejected or duplicate; the totals here use counted audits only.'],
    header: ['State', 'All records', 'Counted audits', 'Awaiting approval', 'Rejected / duplicate', 'Student Marketeers auditing', 'Locations visited', 'Active locations', 'Coverage', 'Editions sold in', 'POS placed', 'Coolers placed', 'Net DPs', 'Share of shelf', 'Red Bull ranging', 'Managers'],
    rows: states.length > 1 ? [...summary, boldRow(['All states', ...tot.slice(1, 8), tot[7] ? pct0(tot[6] / tot[7]) : '', ...tot.slice(9, 13), '', '', ''])] : summary };
  const stateSheets = states.map(st => { const all = auditsFor(s, D, month, st);
    return { name: `${st} audits`, title: `${s.states.find(x => x.code === st)?.name || st} · audits · ${ml}`, notes: [`${all.length} record${all.length === 1 ? '' : 's'}.${all.some(v => v.demo) ? ' Includes demo activity (prototype).' : ''}`], header: head, rows: all.map(row),
      widths: head.map(h => (/Notes|Next step|Competitor detail|Issue/.test(h) ? 40 : /Location$|University|Student Marketeer|Reports to|Contact name/.test(h) ? 24 : Math.min(18, Math.max(9, h.length + 2)))) }; });
  return { filename: fileSafe(`ECA audit export ${month} ${states.length === 1 ? states[0] : 'all states'}${ready ? '' : ' month to date'}.xlsx`), sheets: (() => { const { dash, dataSheet } = exportDashboard(s, D, month, states); return [dash, sumSheet, ...stateSheets, dataSheet]; })() };
}
/* ---------- Executive dashboard sheet for the monthly audit export (native Excel bar charts) ---------- */
function exportDashboard(s, D, month, states) {
  const single = states.length === 1; const ml = monthLabel(month); const ready = monthLastDay(month) <= D.today;
  const end = m => (monthLastDay(m) <= D.today ? monthLastDay(m) : D.today);
  const locsOf = sts => D.locs.filter(l => sts.includes(l.state));
  const counted = (m, sts) => activityAll(s).filter(v => v.date.startsWith(m) && sts.includes(D.locBy[v.loc]?.state) && v.status === 'Completed' && !['Rejected', 'Duplicate'].includes(approvalOf(v)));
  const statsFor = (m, ls, vs) => { const act = ls.filter(l => l.locStatus === 'Active'); const ids = new Set(ls.map(l => l.id)); const mine = vs.filter(v => ids.has(v.loc)); const seen = new Set(mine.map(v => v.loc));
    const e = execStats(s, ls, m + '-01', end(m)); return { audits: mine.length, active: act.length, visited: act.filter(l => seen.has(l.id)).length, coverage: act.length ? act.filter(l => seen.has(l.id)).length / act.length : null,
      sms: new Set(mine.map(v => v.staff).filter(Boolean)).size, editions: e.editions, pos: e.pos, coolers: e.coolers, share: e.share, ranging: e.rangingAudited, brands: e.brands, rb: e.rbFacings, comp: e.compFacings }; };
  const vsNow = counted(month, states); const allLocs = locsOf(states);
  const now = statsFor(month, allLocs, vsNow); const prevM = shiftMonth(month, -1); const prev = statsFor(prevM, allLocs, counted(prevM, states));
  const months6 = [5, 4, 3, 2, 1, 0].map(i => shiftMonth(month, -i)).map(m => ({ m, ...statsFor(m, allLocs, counted(m, states)) }));
  const groups = single ? D.liveUnis.filter(u => u.state === states[0]).map(u => ({ key: u.code, label: u.short || u.name, ls: D.locs.filter(l => l.uni === u.code) }))
    : states.map(st => ({ key: st, label: st, ls: locsOf([st]) }));
  const gStats = groups.map(g => ({ ...g, ...statsFor(month, g.ls, vsNow) }));
  const top = (arr, k, n = 10) => arr.filter(x => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, n);
  const instAll = D.liveUnis.filter(u => states.includes(u.state)).map(u => ({ label: (u.short || u.name) + (single ? '' : ` (${u.state})`), ...statsFor(month, D.locs.filter(l => l.uni === u.code), vsNow) }));
  const smRows = Object.entries(vsNow.reduce((o, v) => { if (v.staff) o[v.staff] = (o[v.staff] || 0) + 1; return o; }, {})).map(([n, c]) => ({ label: n + (single ? '' : ` (${s.people.find(p => p.name === n)?.state || ''})`), audits: c })).sort((a, b) => b.audits - a.audits).slice(0, 10);

  /* data sheet blocks */
  const DATA = 'Chart data'; const data = [];
  const block = (title, header, rows, pctCols = []) => { data.push([{ v: title, s: 10 }]); data.push(header.map(h => ({ v: h, s: 1 }))); const r1 = data.length + 1;
    (rows.length ? rows : [[ 'No data yet', ...header.slice(1).map(() => 0) ]]).forEach(r => data.push(r.map((v, i) => ({ v, s: pctCols.includes(i) && typeof v === 'number' ? 2 : 0 }))));
    const r2 = data.length; data.push([]); return { r1, r2, rows: rows.length ? rows : [['No data yet', ...header.slice(1).map(() => 0)]] }; };
  const R = (b, c) => XLSX_MINI.ref(DATA, c, b.r1, c, b.r2);
  const charts = []; const NAVY = '0B2A5B', TEAL = '0F8B8D', AMBER = 'B88A00';
  const chart = (title, b, series, o = {}) => charts.push({ title, dir: o.dir || 'col', pct: !!o.pct, cats: { ref: R(b, 0), vals: b.rows.map(r => String(r[0])) },
    series: series.map(([name, c, color, pointColors]) => ({ name, ref: R(b, c), vals: b.rows.map(r => r[c]), color, pointColors })) });
  const gl = single ? 'university & TAFE' : 'state';
  const gPick = single ? top(gStats, 'audits', 10).concat(gStats.filter(g => !g.audits && g.active).slice(0, Math.max(0, 6 - top(gStats, 'audits', 10).length))) : gStats;
  const bA = block(`Audits by ${gl}`, [single ? 'University / TAFE' : 'State', 'Audits completed'], gPick.map(g => [g.label, g.audits]));
  chart(`Audits completed by ${gl}`, bA, [['Audits completed', 1, NAVY]], { dir: single ? 'bar' : 'col' });
  const bC = block(`Coverage by ${gl}`, [single ? 'University / TAFE' : 'State', 'Coverage'], gPick.filter(g => g.active).map(g => [g.label, g.coverage ?? 0]), [1]);
  chart(`Coverage: share of active stores audited`, bC, [['Coverage', 1, NAVY]], { pct: true, dir: single ? 'bar' : 'col' });
  const bE = block(`Execution by ${gl}`, [single ? 'University / TAFE' : 'State', 'Editions sold in', 'POS placed', 'Coolers placed'], gPick.map(g => [g.label, g.editions, g.pos, g.coolers]));
  chart(`Editions, POS and coolers by ${gl}`, bE, [['Editions sold in', 1, NAVY], ['POS placed', 2, TEAL], ['Coolers placed', 3, AMBER]], { dir: single ? 'bar' : 'col' });
  const bS = block(`Share of shelf by ${gl}`, [single ? 'University / TAFE' : 'State', 'Share of shelf'], gPick.filter(g => g.share !== null).map(g => [g.label, g.share]), [1]);
  chart(`Red Bull share of shelf by ${gl}`, bS, [['Share of shelf', 1, NAVY]], { pct: true, dir: single ? 'bar' : 'col' });
  const brandTot = Object.values(now.brands).reduce((t, n) => t + n, 0);
  const brandRows = Object.entries(now.brands).sort((a, b) => (a[0] === 'Red Bull' ? -1 : b[0] === 'Red Bull' ? 1 : b[1] - a[1])).map(([b, n]) => [b, brandTot ? n / brandTot : 0]);
  const bB = block('Share of front facings by brand', ['Brand', 'Share of facings'], brandRows, [1]);
  chart('Share of front facings: Red Bull vs competitors', bB, [['Share of facings', 1, '9AA3B2', bB.rows.map(r => (r[0] === 'Red Bull' ? NAVY : null))]], { pct: true, dir: 'bar' });
  const bT = block('Last 6 months', ['Month', 'Audits completed', 'Editions sold in', 'POS placed', 'Coolers placed', 'Coverage', 'Share of shelf'], months6.map(x => [new Date(x.m + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }), x.audits, x.editions, x.pos, x.coolers, x.coverage ?? 0, x.share ?? 0]), [5, 6]);
  chart('Audits completed: last 6 months', bT, [['Audits completed', 1, NAVY]]);
  chart('Editions, POS and coolers: last 6 months', bT, [['Editions sold in', 2, NAVY], ['POS placed', 3, TEAL], ['Coolers placed', 4, AMBER]]);
  const bI = block('Top universities & TAFEs by audits', ['University / TAFE', 'Audits completed'], top(instAll, 'audits').map(x => [x.label, x.audits]));
  chart('Top 10 universities & TAFEs by audits', bI, [['Audits completed', 1, NAVY]], { dir: 'bar' });
  const bM = block('Top Student Marketeers by audits', ['Student Marketeer', 'Audits completed'], smRows.map(x => [x.label, x.audits]));
  chart('Top 10 Student Marketeers by audits', bM, [['Audits completed', 1, TEAL]], { dir: 'bar' });

  /* dashboard sheet */
  const W = 16; const cells = []; const merges = []; const heights = {};
  const put = (r, c, v, st) => { cells[r] = cells[r] || []; cells[r][c] = { v, s: st }; };
  put(0, 0, `ECA audit report · ${ml} · ${single ? (s.states.find(x => x.code === states[0])?.name || states[0]) : 'All states'}`, 3); heights[0] = 24;
  put(1, 0, `${ready ? 'Full month' : 'Month to date at ' + fmtDate(D.today)} · generated ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} · Education Channel Audit Tool (ECA)${vsNow.some(v => v.demo) ? ' · prototype figures include demo activity' : ''}`, 4);
  const prevL = monthLabel(prevM).split(' ')[0].slice(0, 3);
  const dl = (a, b, pct) => { if (a === null || b === null || a === undefined || b === undefined) return ''; const d = pct ? Math.round((a - b) * 100) : a - b; return d === 0 ? `Same as ${prevL}` : `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${pct ? ' pts' : ''} vs ${prevL}`; };
  const tiles = [['AUDITS COMPLETED', now.audits, false, dl(now.audits, prev.audits)], ['COVERAGE OF ACTIVE STORES', now.coverage, true, `${now.visited} of ${now.active} stores · ${dl(now.coverage, prev.coverage, true)}`],
    ['STUDENT MARKETEERS AUDITING', now.sms, false, dl(now.sms, prev.sms)], ['EDITIONS SOLD IN', now.editions, false, dl(now.editions, prev.editions)], ['POS PLACED', now.pos, false, dl(now.pos, prev.pos)],
    ['COOLERS PLACED', now.coolers, false, dl(now.coolers, prev.coolers)], ['SHARE OF SHELF', now.share, true, now.share === null ? 'No facings recorded' : `Red Bull ${now.rb} vs comp ${now.comp} · ${dl(now.share, prev.share, true)}`],
    ['RED BULL RANGING', now.ranging, true, now.ranging === null ? 'No ranging recorded' : `Of SKUs at audited stores · ${dl(now.ranging, prev.ranging, true)}`]];
  tiles.forEach(([label, val, pct, note], t) => { const c = t * 2;
    put(3, c, label, 7); put(3, c + 1, '', 7); put(4, c, val === null ? '—' : val, pct ? 9 : 8); put(4, c + 1, '', 8); put(5, c, note, 11); put(5, c + 1, '', 11);
    [3, 4, 5].forEach(r => merges.push(`${XLSX_MINI.col(c)}${r + 1}:${XLSX_MINI.col(c + 1)}${r + 1}`)); });
  heights[3] = 28; heights[4] = 36; heights[5] = 44;
  const hl = (single ? stateMonthly(s, D, month, states[0]) : nationalMonthly(s, D, month)).highlights;
  put(7, 0, 'Key points', 10); let r = 8;
  (hl.length ? hl : ['No audits recorded this month.']).forEach(t => { put(r, 0, '•  ' + t, 0); merges.push(`A${r + 1}:${XLSX_MINI.col(W - 1)}${r + 1}`); r++; });
  r++; put(r, 0, 'Charts', 10); r += 2;
  const H = 18; charts.forEach((ch, i) => { const c0 = (i % 2) * 8; const r0 = r + Math.floor(i / 2) * (H + 1); ch.from = { c: c0, r: r0 }; ch.to = { c: c0 + 8, r: r0 + H }; });
  const lastRow = r + Math.ceil(charts.length / 2) * (H + 1);
  put(lastRow, 0, 'Figures count completed audits (rejected and duplicate audits excluded). Coverage = active stores audited at least once in the month. Share of shelf = Red Bull front facings ÷ all front facings at each store’s latest audit. Chart figures are on the Chart data sheet.', 4);
  merges.push(`A${lastRow + 1}:${XLSX_MINI.col(W - 1)}${lastRow + 1}`);
  for (let i = 0; i < cells.length; i++) cells[i] = cells[i] || [];
  const dash = { name: 'Dashboard', raw: true, noGrid: true, selected: true, cells, merges, heights, widths: Array(W).fill(11.5), charts };
  const dataSheet = { name: DATA, raw: true, cells: data, widths: [34, 18, 16, 16, 16, 14, 14] };
  return { dash, dataSheet };
}

function downloadAuditExport(s, D, d, month, states) { const wb = auditExportWorkbook(s, D, month, states); offerDownload(d, wb.filename, XLSX_MINI.build(wb.sheets)); }

function AuditExports() {
  const { s, d, D } = useApp();
  const states = exportStates(s, D);
  const months = exportMonths(D);
  const count = (m, st) => auditsFor(s, D, m, st).filter(v => v.status === 'Completed' && !['Rejected', 'Duplicate'].includes(approvalOf(v))).length;
  return html`<div class="banner info"><${Icon} n="download" s=${18} /><div>An Excel of every audit is generated on the last day of each month${D.isAdmin ? ', with a sheet for each state and a state-by-state summary' : ` for ${D.meP.state}`}. It lands in your inbox and stays here to download any time.</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Month</th>${states.map(st => html`<th key=${st} class="n">${st}</th>`)}<th>Status</th><th><span class="sr">Download</span></th></tr></thead><tbody>
      ${months.map(m => html`<tr key=${m.month}><td><b>${monthLabel(m.month)}</b></td>${states.map(st => html`<td key=${st} class="n">${count(m.month, st)}</td>`)}
        <td>${m.ready ? html`<span class="chip good"><${Icon} n="check" s=${12} w=${2.6} />Ready ${fmtShort(m.last)}</span>` : html`<span class="chip plain"><${Icon} n="clock" s=${12} />Generates ${fmtShort(m.last)}</span>`}</td>
        <td style="text-align:right"><div class="chips" style="justify-content:flex-end">
          <button class=${'btn sm' + (m.ready ? ' primary' : '')} onClick=${() => downloadAuditExport(s, D, d, m.month, states)}><${Icon} n="download" s=${14} />${m.ready ? (D.isAdmin ? 'All states' : 'Download') : 'Month to date'}</button>
          ${D.isAdmin && m.ready ? html`<select class="input" style="min-height:32px;padding:4px 8px;width:auto;font-size:13px" aria-label=${'Download one state for ' + monthLabel(m.month)} value="" onChange=${e => { const st = e.target.value; e.target.value = ''; if (st) downloadAuditExport(s, D, d, m.month, [st]); }}><option value="">One state…</option>${states.map(st => html`<option key=${st} value=${st}>${st}</option>`)}</select>` : null}</div></td></tr>`)}</tbody></table></div>
    <p class="xs muted" style="margin:0">Columns: who, when, where, contact, ranging for every product, prices, Red Bull and competitor facings, share of shelf, competitor POS and coolers, DPs, Editions, POS, coolers, issues and notes. Counts above are counted audits (completed, not rejected or duplicate).</p>`;
}

/* ======================= PEOPLE ======================= */
function PeopleTable({ fixedState, note }) {
  const { s, d, D } = useApp();
  const [q, setQ] = useState(''); const [st, setSt] = useState(fixedState || (D.isAdmin ? 'all' : D.meP.state)); const [role, setRole] = useState('all'); const [status, setStatus] = useState('Active');
  const rows = s.people.filter(p => (st === 'all' || p.state === st || (p.role === 'admin' && (s.leads[st] || []).includes(p.name))) && (role === 'all' || p.role === role) && (status === 'All' || p.status === status) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ['admin', 'manager', 'marketeer'].indexOf(a.role) - ['admin', 'manager', 'marketeer'].indexOf(b.role) || a.name.localeCompare(b.name));
  const leadOf = n => Object.entries(s.leads).filter(([, ns]) => ns.includes(n)).map(([x]) => x);
  return html`${note ? html`<p class="small muted" style="margin:0">${note}</p>` : null}<div class="toolbar">
    ${fixedState ? null : html`<${StatePick} value=${st} onChange=${setSt} D=${D} s=${s} allLabel="All" />`}
    <${Select} id="pp-role" label="Role" value=${role} onChange=${setRole} options=${[['all', 'All roles'], ['marketeer', 'Student Marketeers'], ['manager', 'Managers'], ['admin', 'Administrators']]} />
    <div class="field"><span class="label">Status</span><${Seg} label="Status" value=${status} onChange=${setStatus} options=${['Active', 'Inactive', 'All']} /></div>
    <div class="field wide" style="flex:1 1 200px"><span class="label">Search</span><${Search} id="pp-q" value=${q} onChange=${setQ} placeholder="Name" /></div>
    ${D.can.managePeople ? html`<div class="field"><span class="label"> </span><button class="btn primary" onClick=${() => d({ type: 'modal', modal: { kind: 'person' } })}><${Icon} n="plus" s=${16} />Add person</button></div>` : null}</div>
  ${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th class="hide-m">State</th><th class="n hide-m">Audits</th>${D.can.managePeople ? html`<th><span class="sr">Actions</span></th>` : null}</tr></thead><tbody>
    ${rows.map(p => html`<tr key=${p.id}><td><b>${p.name}</b>${p.status !== 'Active' ? html` <span class="chip muted">${p.status}</span>` : null}${sameNameCount(s, p) > 1 ? html` <span class="chip warn" title="Another user has the same name">Same name ×${sameNameCount(s, p)}</span>` : null}${p.disambig ? html`<div class="xs muted">${p.disambig}</div>` : null}${leadOf(p.name).length ? html`<div class="xs" style="color:var(--brand);font-weight:700">Education Channel Lead · ${leadOf(p.name).join(', ')}</div>` : null}${p.reportsTo ? html`<div class="xs muted">Reports to ${p.reportsTo}</div>` : null}</td>
      <td><${RoleChip} role=${p.role} /></td><td class="hide-m">${p.state || 'National'}</td><td class="n hide-m">${s.visits.filter(v => v.staff === p.name && v.status === 'Completed').length}</td>
      ${D.can.managePeople ? html`<td style="white-space:nowrap;text-align:right">${D.can.managePerson(p) && p.name !== D.meP.name ? html`<button class="btn sm" onClick=${() => d({ type: 'modal', modal: { kind: 'person', person: p } })}>Edit</button>
        <button class=${'btn sm ' + (p.status === 'Active' ? 'danger' : '')} style="margin-left:6px" onClick=${() => { d({ type: 'setPersonStatus', id: p.id, status: p.status === 'Active' ? 'Inactive' : 'Active' }); d({ type: 'toast', msg: p.status === 'Active' ? `${p.name} deactivated` : `${p.name} reactivated` }); }}>${p.status === 'Active' ? 'Deactivate' : 'Reactivate'}</button>` : null}</td>` : null}</tr>`)}</tbody></table></div>`
    : html`<${Empty} title="No people match" body=${st !== 'all' && role === 'marketeer' ? `No Student Marketeers loaded for ${st} yet. Add them here, or send the staff list to load in bulk.` : 'Try another filter.'} />`}
  <p class="xs muted" style="margin:0">Deactivated people disappear from future audit dropdowns; their past audits keep their name.</p>`;
}
function PersonForm({ person, onClose }) {
  const { s, d, D } = useApp(); const isNew = !person;
  const [f, setF] = useState(() => person ? { ...person } : { id: 'P' + Date.now(), name: '', role: 'marketeer', state: D.isAdmin ? 'VIC' : D.meP.state, status: 'Active' });
  const [tried, setTried] = useState(false);
  const twins = s.people.filter(p => p.id !== f.id && normName(p.name) === normName(f.name));
  const errs = {}; if (!f.name.trim()) errs.name = 'Enter a first and last name.';
  else if (f.name.trim().split(/\s+/).length < 2) errs.name = 'Enter both a first and last name. People sign in with them.';
  else if (twins.length && !D.isAdmin) errs.name = `${f.name.trim()} is already on the approved list. Ask an administrator to add a second person with the same name.`;
  else if (twins.length && !f.sameOk) errs.name = `${f.name.trim()} is already on the approved list. Tick the box below if this is a different person.`;
  if (twins.length && f.sameOk && !(f.disambig || '').trim()) errs.disambig = 'Add a label that tells them apart, e.g. their campus.';
  const roleChange = (!isNew && person.role !== f.role) || (isNew && f.role !== 'marketeer');
  const save = () => { setTried(true); if (Object.keys(errs).length) return; const { sameOk, aliasText, ...rest } = f;
    const p = { ...rest, name: f.name.trim(), disambig: (f.disambig || '').trim() || null, aliases: (aliasText ?? (f.aliases || []).join(', ')).split(',').map(x => x.trim()).filter(Boolean), state: f.role === 'admin' ? null : f.state };
    const acts = [{ type: 'savePerson', person: p }, { type: 'toast', msg: `${f.name.trim()} saved` }];
    onClose(); if (D.isAdmin && roleChange) requireAdmin(D, d, acts, 'Role and permission changes need a step-up check.'); else acts.forEach(x => d(x)); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pf-h" style="width:min(520px,100%)"><div class="sheet-h"><h2 id="pf-h">${isNew ? 'Add person' : 'Edit ' + person.name}</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><${Text} id="pf-n" label="First and last name" value=${f.name} onChange=${v => setF({ ...f, name: v })} err=${tried ? errs.name : null} />
      <${Select} id="pf-r" label="Role" value=${f.role} onChange=${v => setF({ ...f, role: v })} options=${D.can.roleOptions.map(r => [r, ROLE_LABEL[r]])} hint=${D.isMgr ? 'Managers can add Student Marketeers and Managers in their own state.' : null} />
      ${f.role !== 'admin' ? html`<${Select} id="pf-s" label="State" value=${f.state} onChange=${v => setF({ ...f, state: v })} options=${s.states.filter(x => D.isAdmin || x.code === D.meP.state).map(x => [x.code, x.name])} disabled=${!D.isAdmin} hint=${f.role === 'marketeer' ? 'Can audit any approved university or TAFE in this state' : null} />` : html`<p class="small muted" style="margin:0">Administrators have national access.</p>`}
      ${f.role === 'marketeer' ? html`<${Select} id="pf-rt" label="Reports to" value=${f.reportsTo || ''} onChange=${v => setF({ ...f, reportsTo: v || null })} options=${[['', 'Not set'], ...s.people.filter(p => p.role === 'manager' && p.state === f.state && p.status === 'Active').map(p => [p.name, p.name])]} />` : null}
      ${twins.length && D.isAdmin ? html`<div class="banner warn"><${Icon} n="people" s=${18} /><div style="flex:1"><b>Same name as ${twins.length} other user${twins.length > 1 ? 's' : ''}:</b> ${twins.map(t => personLabel(t)).join('; ')}.
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:600"><input type="checkbox" checked=${!!f.sameOk} onChange=${e => setF({ ...f, sameOk: e.target.checked })} />This is a different person</label></div></div>` : null}
      ${(twins.length && f.sameOk) || f.disambig ? html`<${Text} id="pf-dis" label="Label to tell them apart" value=${f.disambig || ''} onChange=${v => setF({ ...f, disambig: v })} err=${tried ? errs.disambig : null} hint="Shown at sign-in when two people share a name, e.g. ‘UTS, Sydney’" />` : null}
      <${Text} id="pf-al" label="Other names they might type (optional)" value=${f.aliasText ?? (f.aliases || []).join(', ')} onChange=${v => setF({ ...f, aliasText: v })} hint="Comma separated, e.g. a preferred first name: ‘Chris Salem’" />
      <div class="field"><span class="label">Status</span><${Seg} label="Status" value=${f.status} onChange=${v => setF({ ...f, status: v })} options=${['Active', 'Inactive']} /></div>
      ${D.isAdmin && roleChange && !D.elevated ? html`<p class="xs muted" style="margin:0"><${Icon} n="lock" s=${12} /> Saving a role change asks for the admin PIN.</p>` : null}</div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save}>Save</button></div></div>`;
}
function People() {
  const { D } = useApp();
  return html`<div class="page-h"><div><h1>People</h1><p>${D.isAdmin ? 'Administrators, Managers and Student Marketeers across every state.' : `Managers and Student Marketeers in ${D.meP.state}.`}</p></div></div>
  ${D.isSM ? html`<div class="banner info"><${Icon} n="people" s=${18} /><div>You can view the team. Managers and administrators make changes.</div></div>` : null}<${PeopleTable} />`;
}

/* ======================= PROGRESS ======================= */
function Progress() {
  const { s, d, D } = useApp();
  const [f, setF] = useFilters();
  const start = rangeStart(f.range, D.today);
  const locs = filterLocs(D.locs, f, D);
  const sRows = stateRows(s, D, f, locs, start);
  const iRows = instRows(s, D, f, locs, start);
  const tot = summarise(locs, s.visits, start, D.today);
  const months = monthsSeries(s.visits, new Set(locs.map(l => l.id)));
  const sms = s.people.filter(p => p.role === 'marketeer' && D.scopeStates.includes(p.state) && (f.state === 'all' || p.state === f.state)).map(p => {
    const vs = s.visits.filter(v => v.staff === p.name && v.status === 'Completed' && v.date >= start && v.date <= D.today && locs.some(l => l.id === v.loc));
    return { p, n: vs.length, locs: new Set(vs.map(v => v.loc)).size, net: vs.reduce((t, v) => t + v.dpAdded - v.dpLost, 0), ed: vs.reduce((t, v) => t + v.editions, 0), pos: vs.reduce((t, v) => t + v.posPlaced, 0), last: vs.map(v => v.date).sort().at(-1) };
  }).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name));
  const [copied, setCopied] = useState(false);
  const line = (n, x) => [n, x.active, x.required, x.completed, Math.round(x.pct * 100) + '%', x.onTrack, x.dueSoon, x.overdue, x.noVisit, x.dpAdded, x.dpLost, x.dpAdded - x.dpLost, x.editions, x.posPlaced, x.coolersIn, x.coolersOut].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  const csv = () => ['Level,Name,Active,Required,Completed,Completion %,On Track,Due Soon,Overdue,No Visit,DPs Added,DPs Lost,Net DPs,Editions,POS,Coolers In,Coolers Out', ...sRows.map(r => '"State",' + line(r.st.code, r.x)), ...iRows.map(r => `"${r.u.kind}",` + line(r.u.name, r.x)), '"National",' + line('Total', tot)].join('\n');
  const xlsx = () => {
    const scopeT = `${f.state === 'all' ? 'National' : f.state} · ${RANGES.find(r => r[0] === f.range)[1]}`;
    const notes = [`Generated ${new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })} by ${D.meP.name}. Filters: ${scopeT}${f.kind && f.kind !== 'All' ? ' · ' + f.kind : ''}${f.uni && f.uni !== 'all' ? ' · ' + (D.uniBy[f.uni]?.name || f.uni) : ''}.`, 'Completion = active locations with a Completed visit in the period. Status columns are as of today.'];
    const head = ['Active', 'Completed', 'Completion', 'On Track', 'Due Soon', 'Overdue', 'No Visit', 'DPs added', 'DPs lost', 'Net DPs', 'Editions', 'POS', 'Coolers in', 'Coolers out'];
    const vals = x => [x.active, x.completed, x.required ? x.pct : null, x.onTrack, x.dueSoon, x.overdue, x.noVisit, x.dpAdded, x.dpLost, x.dpAdded - x.dpLost, x.editions, x.posPlaced, x.coolersIn, x.coolersOut];
    const sheets = [{ name: 'Summary', title: `ECA progress · ${scopeT}`, notes, header: ['Measure', 'Value'], widths: [28, 16], rows: [['Required', tot.required], ['Completed', tot.completed], ['Completion', tot.required ? pct0(tot.pct) : '—'], ['On Track', tot.onTrack], ['Due Soon', tot.dueSoon], ['Overdue', tot.overdue], ['No Visit Recorded', tot.noVisit], ['Net DPs', tot.dpAdded - tot.dpLost], ['Editions', tot.editions], ['POS placed', tot.posPlaced]] }];
    if (D.isAdmin && f.state === 'all') sheets.push({ name: 'By state', header: ['State', 'Institutions', ...head], pct: [4], rows: [...sRows.map(r => [r.st.name, r.insts, ...vals(r.x)]), boldRow(['National', sRows.reduce((t, r) => t + r.insts, 0), ...vals(tot)])] });
    sheets.push({ name: 'By institution', header: ['University or TAFE', 'Type', 'State', ...head], pct: [5], rows: iRows.map(r => [r.u.name, r.u.kind, r.u.state, ...vals(r.x)]) });
    { const eRow = (lvl, name, ls) => { const e = execStats(s, ls, start, D.today); return [lvl, name, e.editions, e.pos, e.coolers, e.coolersOut, pctOr(e.share, ''), e.rbFacings, e.compFacings, pctOr(e.rangingNow, ''), e.compPos, e.compCoolers]; };
      sheets.push({ name: 'Execution', header: ['Level', 'Name', 'Editions sold in', 'POS placed', 'Coolers placed', 'Coolers removed', 'Share of shelf', 'Red Bull facings', 'Competitor facings', 'Red Bull ranging', 'Competitor POS seen', 'Competitor coolers seen'],
        notes: ['Includes demo activity in the prototype. Share of shelf uses each location’s latest audit in the period; ranging is as of each active location’s latest audit.'],
        rows: [...(D.isAdmin && f.state === 'all' ? sRows.map(r => eRow('State', r.st.name, r.ls)) : []), ...iRows.map(r => eRow(r.u.kind, r.u.name, r.ls)), boldRow(eRow('Total', f.state === 'all' ? 'National' : f.state, locs))] }); }
    sheets.push({ name: 'Student Marketeers', header: ['Student Marketeer', 'State', 'Reports to', 'Audits', 'Locations', 'Net DPs', 'Editions', 'POS', 'Last audit'], rows: sms.map(r => [r.p.name, r.p.state, r.p.reportsTo || 'Not set', r.n, r.locs, r.net, r.ed, r.pos, r.last || '']) });
    sheets.push({ name: 'Locations', header: ['ID', 'Location', 'University or TAFE', 'State', 'Campus', 'Store type', 'Status', 'Last visit', 'Last visited by', 'Next due', 'Red Bull facings', 'Competitor facings', 'Share of shelf', 'Competitor POS', 'Competitor coolers', 'Competitor detail', 'Contact', 'Contact role', 'Contact phone', 'Contact email'], rows: locs.filter(l => l.locStatus === 'Active').map(l => [l.id, l.name, l.uniName, l.state, l.campus, storeTypeOf(l), l.status, l.last || '', l.lastBy || '', l.due || '', l.rbFacings ?? '', l.compFacings ? compTotal(l.compFacings) : '', l.rbFacings !== undefined && shelfShare(l.rbFacings, l.compFacings) !== null ? pct0(shelfShare(l.rbFacings, l.compFacings)) : '', l.compDetail ? compSum(l.compDetail, 'pos') : '', l.compDetail ? compSum(l.compDetail, 'coolers') : '', l.compFacings ? compDetailText(l.compFacings, l.compDetail, l.type === 'Vending').join('; ') : '', l.contactName || '', l.contactRole || '', l.contactPhone || '', l.contactEmail || '']) });
    offerDownload(d, fileSafe(`ECA progress ${f.state === 'all' ? 'National' : f.state} ${D.today}.xlsx`), XLSX_MINI.build(sheets));
  };
  const copy = () => { const t = csv(); if (!navigator.clipboard) { setCopied('fail'); return; } navigator.clipboard.writeText(t).then(() => { setCopied(true); d({ type: 'toast', msg: 'Progress copied as CSV' }); }, () => setCopied('fail')); };
  const tbl = (rows, nameOf) => html`<div class="tbl-wrap"><table><thead><tr><th>${rows[0]?.st ? 'State' : 'University or TAFE'}</th><th class="n">Active</th><th class="n">Completed</th><th class="n">Completion</th><th class="n hide-m">On Track</th><th class="n hide-m">Due Soon</th><th class="n">Overdue</th><th class="n hide-m">No Visit</th><th class="n hide-m">Net DPs</th></tr></thead><tbody>
    ${rows.map(r => html`<tr key=${nameOf(r)} class=${r.u ? 'click' : ''} tabindex=${r.u ? 0 : undefined} onClick=${() => r.u && d({ type: 'nav', route: { page: 'uni', code: r.u.code, tab: 'Performance' } })}><td><b>${nameOf(r)}</b>${r.u ? html`<div class="xs muted">${r.u.kind} · ${r.u.state}</div>` : html`<div class="xs muted">${r.insts} institution${r.insts === 1 ? '' : 's'}</div>`}</td><td class="n">${r.x.active}</td><td class="n">${r.x.completed}</td>
      <td class="n"><span style=${{ fontWeight: 700, color: r.x.required && r.x.pct < .5 ? 'var(--danger-ink)' : 'inherit' }}>${r.x.required ? Math.round(r.x.pct * 100) + '%' : '—'}</span></td><td class="n hide-m">${r.x.onTrack}</td><td class="n hide-m">${r.x.dueSoon}</td><td class="n">${r.x.overdue}</td><td class="n hide-m">${r.x.noVisit}</td><td class="n hide-m">${signed(r.x.dpAdded - r.x.dpLost)}</td></tr>`)}</tbody></table></div>`;
  return html`<div class="page-h"><div><div class="eyebrow">${ECA} · report</div><h1>Progress</h1><p>${f.state === 'all' ? 'National' : f.state} · ${RANGES.find(r => r[0] === f.range)[1]}.</p></div>
    ${D.can.export ? html`<div class="chips"><button class="btn primary" onClick=${xlsx}><${Icon} n="download" s=${16} />Download Excel</button><button class="btn" onClick=${copy}><${Icon} n="copy" s=${16} />Copy CSV</button></div>` : null}</div>
  ${copied === 'fail' ? html`<div class="card flat"><div class="label" style="margin-bottom:6px">Copy didn’t work here. Select the text below and copy it.</div><textarea class="input" readonly style="min-height:140px;font-family:ui-monospace,monospace;font-size:12px" onFocus=${e => e.target.select()}>${csv()}</textarea></div>` : null}
  <${Filters} f=${f} setF=${setF} showSearch=${false} />
  <div class="kpis"><${Kpi} label="Required" value=${tot.required} /><${Kpi} label="Completed" value=${tot.completed} tone="good" icon="check" /><${Kpi} label="Completion" value=${Math.round(tot.pct * 100) + '%'} /><${Kpi} label="Overdue" value=${tot.overdue} tone="bad" icon="alert" /></div>
  <${ExecSection} locs=${locs} f=${f} start=${start} sRows=${sRows} iRows=${iRows} />
  ${D.isAdmin && f.state === 'all' ? html`<section><h2 style="margin-bottom:10px">By state</h2>${tbl(sRows, r => r.st.name)}</section>
    <div class="grid g2"><section class="card"><div class="card-h"><h2>Required vs completed, by state</h2></div><${ClusterBars} rows=${sRows.map(r => ({ label: r.st.code, required: r.x.required, completed: r.x.completed }))} a="required" b="completed" aLabel="Required" bLabel="Completed" caption="Required versus completed by state" /></section>
      <section class="card"><div class="card-h"><h2>Status by state</h2></div><${StackBars} rows=${sRows.map(r => statusRow(r.st.code, r.ls))} caption="Status by state" /></section></div>` : null}
  <section><h2 style="margin-bottom:10px">By university and TAFE</h2>${iRows.length ? tbl(iRows, r => r.u.name) : html`<${Empty} title="No institutions in this view" body="Add universities or TAFEs to start tracking progress." />`}</section>
  ${iRows.length ? html`<div class="grid g2"><section class="card"><div class="card-h"><h2>Required vs completed</h2></div><${ClusterBars} rows=${iRows.map(r => ({ label: r.label, required: r.x.required, completed: r.x.completed }))} a="required" b="completed" aLabel="Required" bLabel="Completed" caption="Required versus completed by institution" /></section>
    <section class="card"><div class="card-h"><h2>Location status</h2></div><${StackBars} rows=${iRows.map(r => statusRow(r.label, r.ls))} caption="Location status by institution" /></section></div>` : null}
  <section class="card"><div class="card-h"><h2>Monthly completion trend</h2><span class="xs muted">Completed visits, last 12 months</span></div><${MonthTrend} months=${months} caption="Completed visits per month" /></section>
  <section><h2 style="margin-bottom:10px">Student Marketeer reporting</h2>${sms.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Student Marketeer</th><th class="hide-m">State</th><th class="n">Audits</th><th class="n hide-m">Locations</th><th class="n">Net DPs</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th><th class="hide-m">Last audit</th></tr></thead><tbody>
    ${sms.map(r => html`<tr key=${r.p.id}><td><b>${r.p.name}</b></td><td class="hide-m">${r.p.state}</td><td class="n">${r.n}</td><td class="n hide-m">${r.locs}</td><td class="n">${signed(r.net)}</td><td class="n hide-m">${r.ed}</td><td class="n hide-m">${r.pos}</td><td class="hide-m num">${fmtDate(r.last)}</td></tr>`)}</tbody></table></div>`
    : html`<${Empty} title="No Student Marketeers in this view" body="Load the state staff lists in People." />`}</section>`;
}

/* ======================= SETTINGS ======================= */
function Settings() {
  const { s, d, D } = useApp();
  const [confirmReset, setConfirmReset] = useState(false); const [newPos, setNewPos] = useState(''); const [newComp, setNewComp] = useState(''); const [ns, setNs] = useState({ code: '', name: '' });
  const listEditor = (label, key, val, setVal) => html`<div class="field"><span class="label">${label}</span><div class="chips">${s.ref[key].map(x => html`<span key=${x} class="chip plain">${x}${D.isAdmin ? html`<button class="btn ghost sm" style="min-height:0;padding:0 0 0 4px" aria-label=${'Remove ' + x} onClick=${() => d({ type: 'ref', ref: { [key]: s.ref[key].filter(y => y !== x) } })}><${Icon} n="x" s=${12} /></button>` : null}</span>`)}</div>
    ${D.isAdmin ? html`<div style="display:flex;gap:8px;margin-top:6px"><input class="input" aria-label=${'Add to ' + label} value=${val} onInput=${e => setVal(e.target.value)} placeholder="Add a value" /><button class="btn" onClick=${() => { if (val.trim() && !s.ref[key].includes(val.trim())) d({ type: 'ref', ref: { [key]: [...s.ref[key], val.trim()] } }); setVal(''); }}>Add</button></div>` : null}</div>`;
  const groups = ['admin', 'manager', 'marketeer'].map(r => [ROLE_LABEL[r] + 's', s.people.filter(p => p.role === r && p.status === 'Active').sort((a, b) => a.name.localeCompare(b.name))]);
  return html`<div class="page-h"><div><div class="eyebrow">${ECA}</div><h1>Settings</h1><p>${D.isAdmin ? 'Users, access, store types, scoring, results distribution and the audit history.' : 'Your access and the rules the tool uses.'}</p></div></div>
  <section class="card"><h2 class="section-t">Signed in</h2><div class="form-grid">
    <div class="field"><span class="label">Name</span><b>${D.meP.name}</b>${D.meP.disambig ? html`<span class="hint">${D.meP.disambig}</span>` : null}</div>
    <div class="field"><span class="label">Access</span><div class="chips"><${RoleChip} role=${D.role} /><span class="chip plain">${D.isAdmin ? 'National' : D.meP.state}</span>${D.leadOf.length ? html`<span class="chip type">Channel lead · ${D.leadOf.join(', ')}</span>` : null}</div></div></div>
    <button class="btn" style="margin-top:12px" onClick=${() => d({ type: 'logout' })}><${Icon} n="logout" s=${16} />Sign out</button></section>
  ${D.isAdmin ? html`<${AdminAccess} />` : null}
  <section class="card"><h2 class="section-t">States and Education Channel Leads</h2><div class="tbl-wrap"><table><thead><tr><th>State</th><th class="n">Institutions</th><th class="n">Locations</th><th>Channel leads (approve removals)</th></tr></thead><tbody>
    ${s.states.map(st => html`<tr key=${st.code}><td><b>${st.code}</b> · ${st.name}</td><td class="n">${D.liveUnis.filter(u => u.state === st.code).length}</td><td class="n">${D.locs.filter(l => l.state === st.code && l.locStatus === 'Active').length}</td><td>${(s.leads[st.code] || []).join(', ') || html`<span class="muted">None set</span>`}</td></tr>`)}</tbody></table></div>
    ${D.isAdmin ? html`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:flex-end"><${Text} id="ns-c" label="New state code" value=${ns.code} onChange=${v => setNs({ ...ns, code: v.toUpperCase().slice(0, 3) })} placeholder="TAS" /><${Text} id="ns-n" label="Name" value=${ns.name} onChange=${v => setNs({ ...ns, name: v })} placeholder="Tasmania" />
      <button class="btn" disabled=${!ns.code || !ns.name || s.states.some(x => x.code === ns.code)} onClick=${() => { d({ type: 'saveState', state: { code: ns.code, name: ns.name } }); setNs({ code: '', name: '' }); d({ type: 'toast', msg: 'State added' }); }}>Add state</button></div>` : null}</section>
  <section class="card"><h2 class="section-t">Visit rules and notifications</h2>${!D.isAdmin ? html`<dl class="kv"><dt>Default visit cycle</dt><dd>${s.ref.defaultCycle} days</dd><dt>Due soon window</dt><dd>${s.ref.dueSoonDays} days</dd><dt>Reminder lead time</dt><dd>${s.ref.reminderLeadDays} days</dd><dt>Daily summary time</dt><dd>${s.ref.dailySummaryTime}</dd></dl><p class="small muted" style="margin:10px 0 0">Administrators can change these.</p>` : html`<div class="form-grid">
    <${Text} id="set-cycle" label="Default visit cycle (days)" type="number" value=${s.ref.defaultCycle} onChange=${v => d({ type: 'ref', ref: { defaultCycle: Math.max(1, +v || 14) } })} />
    <${Text} id="set-soon" label="Due soon window (days)" type="number" value=${s.ref.dueSoonDays} onChange=${v => d({ type: 'ref', ref: { dueSoonDays: Math.max(0, +v || 0) } })} />
    <${Text} id="set-lead" label="Remind this many days before due" type="number" value=${s.ref.reminderLeadDays} onChange=${v => d({ type: 'ref', ref: { reminderLeadDays: Math.max(0, +v || 0) } })} />
    <${Text} id="set-ds" label="Daily summary send time" type="time" value=${s.ref.dailySummaryTime} onChange=${v => d({ type: 'ref', ref: { dailySummaryTime: v } })} /></div>`}</section>
  <section class="card"><h2 class="section-t">Reference values</h2>${!D.isAdmin ? html`<p class="small muted" style="margin:0 0 10px">Administrators can edit these.</p>` : null}
    <div style="display:flex;flex-direction:column;gap:14px">${listEditor('POS types', 'posTypes', newPos, setNewPos)}${listEditor('Competitors', 'competitors', newComp, setNewComp)}</div></section>
  <${StoreTypesCard} />
  <${ScoringCard} />
  ${D.isAdmin ? html`<${ResultsSettingsCard} /><${AuditHistory} /><${LoginLog} />` : null}
  <section class="card"><h2 class="section-t">Demo data</h2><p class="small" style="margin:0 0 10px">VIC data from Education_Channel_Execution_Tracker_v3 (${SEED.locations.length} locations, ${SEED.visits.length} visits). People from the requirements brief. Store contacts are masked. Changes are saved in this browser only.</p>
    ${(s.demo || []).length && D.isAdmin ? html`<p class="small" style="margin:0 0 10px">The leaderboard includes ${s.demo.length} demo audits for the 8 VIC Student Marketeers so you can see it working. They never affect visit status, dashboards or progress.</p><button class="btn" style="margin-bottom:10px" onClick=${() => { d({ type: 'removeDemo' }); d({ type: 'toast', msg: 'Demo leaderboard activity removed' }); }}>Remove demo leaderboard activity</button>` : null}
    ${s.sync?.mode === 'shared' ? html`<p class="small muted" style="margin:0">Shared pilot: everyone sees the same data, so there’s no reset button here.</p>` : confirmReset ? html`<div class="inline-confirm"><span>Reset everything to the starting data?</span><span class="chips"><button class="btn sm" onClick=${() => setConfirmReset(false)}>Keep my changes</button><button class="btn sm danger" onClick=${() => { DataService.clear(); d({ type: 'reset' }); d({ type: 'toast', msg: 'Demo data reset' }); }}>Reset</button></span></div>` : html`<button class="btn danger" onClick=${() => setConfirmReset(true)}>Reset demo data</button>`}</section>`;
}

/* ======================= ECA: SCORING, LEADERBOARD, LOGIN, ADMINISTRATION ======================= */
const ECA = 'Education Channel Audit Tool (ECA)';
const MEASURES = [
  { key: 'ranging', label: 'Ranging % by location', short: 'Ranging', pct: true, src: 'Latest approved audit at each location in the month: Red Bull SKUs ranged ÷ Red Bull SKUs that apply to that location type, averaged across locations' },
  { key: 'tdp', label: 'TDP added', short: 'TDP', src: 'Sum of distribution points added on approved audits' },
  { key: 'editions', label: 'Editions sold', short: 'Editions', src: 'Sum of Editions sold in on approved audits' },
  { key: 'pos', label: 'POS placed', short: 'POS', src: 'Sum of POS placed on approved audits' },
  { key: 'coolers', label: 'Coolers added', short: 'Coolers', src: 'Sum of coolers installed on approved audits' },
];
const APPROVAL_TONE = { Approved: 'good', Pending: 'warn', Rejected: 'bad', Duplicate: 'muted' };
const approvalOf = v => v.approval || 'Approved'; // records made before approvals existed count as approved
const activityAll = s => [...s.visits, ...(s.demo || [])];
const curMonth = () => todayISO().slice(0, 7);
const monthLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
const monthShort = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-AU', { month: 'short' });
const shiftMonth = (m, n) => { const d = new Date(m + '-01T00:00:00'); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const fmtWhen = ts => (ts ? new Date(ts).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const one = n => (Math.round(n * 10) / 10).toFixed(1);
const normName = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`.\-]/g, ' ').replace(/\s+/g, ' ').trim();
const sameNameCount = (s, p) => s.people.filter(x => x.status !== 'Removed' && normName(x.name) === normName(p.name)).length;
const personLabel = p => [ROLE_LABEL[p.role], p.state || 'National', p.disambig, p.reportsTo ? 'reports to ' + p.reportsTo : null].filter(Boolean).join(' · ');

/** Store location type for a QSR location; vending machines are their own location type. Bars named in the workbook are guessed and flagged. */
function guessStoreType(l) {
  if (l.type === 'Vending') return 'Vending';
  if (l.indNka === 'NKA') return 'NKA';
  if (/(^|\s)(tavern|pub|hotel)\b|\bbar\b/i.test(l.name) && !/(juice|espresso|coffee)/i.test(l.name)) return 'Student Bar';
  return 'QSR';
}
const storeTypeOf = l => (l ? l.storeType || guessStoreType(l) : null);
const activeStoreTypes = s => s.ref.storeTypes.filter(t => t.active).map(t => t.name);

/** Monthly scorecard. Only Completed, approved, non-duplicate audits by a named Student Marketeer count. */
function scoreMonth(s, month, o = {}) {
  const sc = s.ref.scoring; const W = sc.weights;
  const locBy = Object.fromEntries(s.locations.map(l => [l.id, l]));
  const locOk = v => { const l = locBy[v.loc]; if (!l) return (!o.storeType || o.storeType === 'All') && (!o.activity || o.activity === 'All');
    if (o.activity && o.activity !== 'All' && (o.activity === 'Vending audit') !== (l.type === 'Vending')) return false;
    if (o.storeType && o.storeType !== 'All' && storeTypeOf(l) !== o.storeType) return false; return true; };
  const acts = activityAll(s).filter(v => v.status === 'Completed' && v.staff && !v.imported && v.date.startsWith(month) && locOk(v));
  const counted = acts.filter(v => approvalOf(v) === 'Approved');
  const byPerson = p => v => (v.staffId ? v.staffId === p.id : v.staff === p.name);
  const people = s.people.filter(p => p.role === 'marketeer' && (p.status === 'Active' || acts.some(byPerson(p))));
  const rows = people.map(p => {
    const mine = acts.filter(byPerson(p)); const vs = mine.filter(v => approvalOf(v) === 'Approved');
    const latest = {}; vs.forEach(v => { const k = v.loc; if (!latest[k] || (v.date + (v.time || '')) > (latest[k].date + (latest[k].time || ''))) latest[k] = v; });
    const pcts = Object.values(latest).map(v => { const l = locBy[v.loc]; const rg = v.response?.ranging; if (!rg) return null;
      const prods = s.ref.products.filter(x => !x.competitor && (l?.type === 'Vending' ? x.vending : x.qsr));
      return prods.length ? prods.filter(x => +rg[x.key] === 1).length / prods.length * 100 : null; }).filter(x => x !== null);
    const sum = k => vs.reduce((t, v) => t + (+v[k] || 0), 0);
    return { id: p.id, name: p.name, state: p.state, reportsTo: p.reportsTo || null, audits: vs.length, locations: Object.keys(latest).length,
      ranging: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0, tdp: sum('dpAdded'), editions: sum('editions'), pos: sum('posPlaced'), coolers: sum('coolersIn'),
      pending: mine.filter(v => approvalOf(v) === 'Pending').length, excluded: mine.filter(v => ['Rejected', 'Duplicate'].includes(approvalOf(v))).length,
      lastAt: vs.map(v => v.approvedAt || v.submittedAt || v.date).sort().at(-1) || null };
  });
  const q = rows.filter(r => r.audits >= sc.minAudits);
  const max = Object.fromEntries(MEASURES.map(m => [m.key, Math.max(0, ...q.map(r => r[m.key]))]));
  const norm = (k, val) => Math.min(100, k === 'ranging' ? val : sc.method === 'target' ? (+sc.targets[k] > 0 ? val / +sc.targets[k] * 100 : 0) : (max[k] > 0 ? val / max[k] * 100 : 0));
  const wSum = MEASURES.reduce((t, m) => t + (+W[m.key] || 0), 0) || 1;
  rows.forEach(r => { r.qualified = r.audits >= sc.minAudits;
    r.scores = Object.fromEntries(MEASURES.map(m => [m.key, norm(m.key, r[m.key])]));
    r.points = Object.fromEntries(MEASURES.map(m => [m.key, r.scores[m.key] * (+W[m.key] || 0) / wSum]));
    r.total = r.qualified ? Math.round(MEASURES.reduce((t, m) => t + r.points[m.key], 0) * 10) / 10 : 0; });
  rows.sort((a, b) => (b.qualified - a.qualified) || (b.total - a.total) || (b.tdp - a.tdp) || (b.ranging - a.ranging) || (b.audits - a.audits) || String(a.lastAt).localeCompare(String(b.lastAt)) || a.name.localeCompare(b.name));
  let k = 0; rows.forEach(r => { r.rank = r.qualified ? ++k : null; });
  const lastUpdated = counted.map(v => v.approvedAt || v.submittedAt).filter(Boolean).sort().at(-1) || null;
  return { rows, counted, pending: acts.filter(v => approvalOf(v) === 'Pending'), excluded: acts.filter(v => ['Rejected', 'Duplicate'].includes(approvalOf(v))), lastUpdated };
}
const snapRows = rows => rows.map(({ id, name, state, reportsTo, audits, locations, ranging, tdp, editions, pos, coolers, scores, points, total, rank, qualified }) => ({ id, name, state, reportsTo, audits, locations, ranging, tdp, editions, pos, coolers, scores, points, total, rank, qualified }));
const snapOf = (s, m) => (s.snapshots || []).find(x => x.month === m);
function monthStatus(s, m) { const sn = snapOf(s, m); if (sn?.status === 'Final') return 'Final'; return m === curMonth() ? 'Live' : m > curMonth() ? 'Future' : 'In review'; }
function boardFor(s, m) {
  const sn = snapOf(s, m);
  if (sn?.status === 'Final') return { rows: sn.rows, lastUpdated: sn.finalisedAt, final: true, sn, pending: [], counted: null };
  return { ...scoreMonth(s, m), final: false, sn };
}
function knownMonths(s) {
  const set = new Set([curMonth(), ...(s.snapshots || []).map(x => x.month)]);
  activityAll(s).forEach(v => { if (v.staff && !v.imported && v.status === 'Completed') set.add(v.date.slice(0, 7)); });
  return [...set].filter(m => m <= curMonth()).sort().reverse();
}
const reviewQueue = (s, D) => activityAll(s).filter(v => v.status === 'Completed' && v.staff && !v.imported && approvalOf(v) === 'Pending' && monthStatus(s, v.date.slice(0, 7)) !== 'Final')
  .filter(v => { const p = s.people.find(x => x.name === v.staff); return p && D.scopeStates.includes(p.state) && v.staff !== D.meP.name; })
  .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
function recipientsFor(s, groups) {
  const act = s.people.filter(p => p.status === 'Active');
  const leads = [...new Set(Object.values(s.leads).flat())].filter(n => act.some(p => p.name === n));
  const out = { 'Education Channel Leads': groups.leads ? leads : [], Administrators: groups.admins ? act.filter(p => p.role === 'admin').map(p => p.name) : [], 'Student Marketeers': groups.sms ? act.filter(p => p.role === 'marketeer').map(p => p.name) : [],
    'Additional recipients': (s.ref.results.extra || []).filter(n => act.some(p => p.name === n)) };
  return { out, all: [...new Set(Object.values(out).flat())] };
}
function fillTemplate(t, sn, month) {
  const top = sn.rows.filter(r => r.rank && r.rank <= 3);
  const nm = i => top[i] ? `${top[i].name} (${one(top[i].total)})` : '—';
  return String(t).replace(/\{month\}/g, monthLabel(month)).replace(/\{first\}/g, nm(0)).replace(/\{second\}/g, nm(1)).replace(/\{third\}/g, nm(2)).replace(/\{ranked\}/g, String(sn.rows.filter(r => r.rank).length));
}

/* ---------- demo activity (prototype only; never mixed into visit status, dashboards or the workbook data) ---------- */
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedDemo(locs) {
  const R = mulberry(20261009); const ri = (a, b) => a + Math.floor(R() * (b - a + 1)); const pick = xs => xs[Math.floor(R() * xs.length)];
  const today = todayISO(); const out = [];
  const staff = [...new Set(SEED.allocations.map(a => a.staff))].filter(n => n !== 'Abi James').sort();
  const skill = Object.fromEntries(staff.map(n => [n, 0.5 + R() * 0.6]));
  for (let mi = 3; mi >= 0; mi--) {
    const mk = shiftMonth(curMonth(), -mi); const [y, m] = mk.split('-').map(Number);
    const last = mi === 0 ? Math.max(1, +today.slice(8, 10)) : new Date(y, m, 0).getDate();
    staff.forEach((n, si) => {
      const allocs = SEED.allocations.filter(a => a.staff === n);
      const pool = locs.filter(l => l.status === 'Active' && allocs.some(a => a.uni === l.uni && (a.campus === 'All' || a.campus === l.campus)));
      if (!pool.length) return;
      const k = skill[n]; let count = Math.max(1, Math.round((mi === 0 ? Math.min(1, (last + 14) / 30) : 1) * ri(4, 10) * k));
      if (si === staff.length - 1 && mi === 1) count = 2;
      for (let j = 0; j < count; j++) {
        const l = pick(pool); const day = ri(1, last); const date = `${mk}-${pad(day)}`;
        const prods = DEFAULT_REF.products.filter(p => (l.type === 'Vending' ? p.vending : p.qsr));
        const ranging = Object.fromEntries(prods.map(p => [p.key, R() < (p.competitor ? 0.5 : 0.4 + 0.5 * Math.min(k, 1)) ? 1 : 0]));
        const v = { id: `DEMO-${mk}-${si}-${j}`, demo: true, uni: l.uni, loc: l.id, date, time: `${pad(ri(9, 16))}:${pad(ri(0, 5) * 10)}`, staff: n, status: 'Completed',
          dpAdded: R() < 0.55 * k ? ri(1, 3) : 0, dpLost: R() < 0.12 ? 1 : 0, editions: R() < 0.45 * k ? ri(1, 4) : 0, posPlaced: R() < 0.5 * k ? ri(1, 3) : 0,
          coolersIn: l.type === 'QSR' && R() < 0.1 * k ? 1 : 0, coolersOut: 0, posType: '', flavours: '', notes: 'Demo activity for the leaderboard prototype', nextStep: '',
          response: { ranging }, photos: 0, submittedAt: `${date}T${pad(ri(9, 16))}:00:00`, submittedBy: n, approval: 'Approved', approvedBy: 'Phillip Petinella', approvedAt: `${date}T18:00:00` };
        if (v.posPlaced) v.posType = pick(['Price tag', 'Wobbler', 'Poster', 'Fridge decal']);
        out.push(v);
      }
    });
  }
  const cur = out.filter(v => v.date.startsWith(curMonth())).sort((a, b) => b.date.localeCompare(a.date));
  cur.slice(0, 5).forEach(v => { v.approval = 'Pending'; v.approvedBy = null; v.approvedAt = null; });
  cur.filter(v => v.date === today).forEach(v => { v.approval = 'Pending'; v.approvedBy = null; v.approvedAt = null; });
  const prev = out.filter(v => v.date.startsWith(shiftMonth(curMonth(), -1)));
  if (prev.length > 3) { prev[1].approval = 'Rejected'; prev[1].rejectReason = 'Outcome numbers not supported by photos'; prev[1].approvedBy = 'Phillip Petinella';
    const src = prev[2]; out.push({ ...src, id: src.id + '-dup', approval: 'Duplicate', dupOf: src.id, time: src.time, submittedAt: src.submittedAt.replace(':00:00', ':04:00') }); }
  return out;
}
function seedSnapshots(st) {
  const out = [];
  for (let mi = 3; mi >= 1; mi--) {
    const m = shiftMonth(curMonth(), -mi); const res = scoreMonth(st, m);
    const fin = `${shiftMonth(m, 1)}-03T10:15:00`;
    out.push(mi >= 2 ? { month: m, status: 'Final', demo: true, rows: snapRows(res.rows), createdAt: `${shiftMonth(m, 1)}-01T00:05:00`, finalisedAt: fin, finalisedBy: 'Keane Vivas', rules: JSON.parse(JSON.stringify(st.ref.scoring)),
      distributed: { generatedAt: fin, distributedAt: `${shiftMonth(m, 1)}-03T10:30:00`, by: 'Keane Vivas', groups: ['Education Channel Leads', 'Administrators', 'Student Marketeers'], method: st.ref.results.method, count: 0, message: '' } }
      : { month: m, status: 'In review', demo: true, rows: snapRows(res.rows), createdAt: `${shiftMonth(m, 1)}-01T00:05:00`, rules: JSON.parse(JSON.stringify(st.ref.scoring)) });
  }
  return out;
}
/** On load: when the calendar month has changed, close the old month (provisional snapshot, In review) and log the reset. Nothing is deleted. */
function rollMonths(st) {
  const cur = curMonth(); if (!st.lastMonth || st.lastMonth >= cur) return { ...st, lastMonth: cur };
  let snaps = [...(st.snapshots || [])]; const log = [...st.log];
  for (let m = st.lastMonth; m < cur; m = shiftMonth(m, 1)) {
    if (!snaps.some(x => x.month === m)) snaps.push({ month: m, status: 'In review', rows: snapRows(scoreMonth(st, m).rows), createdAt: new Date().toISOString(), rules: JSON.parse(JSON.stringify(st.ref.scoring)) });
    log.unshift({ ts: new Date().toISOString(), user: 'System', cat: 'Leaderboard', action: 'Monthly leaderboard reset', target: monthLabel(shiftMonth(m, 1)), detail: `${monthLabel(m)} closed for review; scores start at zero`, from: monthLabel(m), to: monthLabel(shiftMonth(m, 1)) });
  }
  return { ...st, snapshots: snaps, log, lastMonth: cur };
}

/* ---------- reducer for ECA actions ---------- */
function ecaReducer(s, a, stamp) {
  const now = new Date().toISOString();
  switch (a.type) {
    case 'login': return { ...s, me: a.person.name, meId: a.person.id, authed: true, elevatedUntil: 0, route: { page: a.person.role === 'marketeer' ? 'leaderboard' : 'dashboard' },
      logins: [{ ts: now, name: a.person.name, id: a.person.id, result: 'Signed in', role: a.person.role }, ...(s.logins || [])].slice(0, 1000),
      log: [{ ts: now, user: a.person.name, cat: 'Login', action: 'Signed in', target: a.person.name, detail: personLabel(a.person) }, ...s.log].slice(0, 3000) };
    case 'loginFail': return { ...s, logins: [{ ts: now, name: a.name, id: null, result: a.reason }, ...(s.logins || [])].slice(0, 1000),
      log: [{ ts: now, user: a.name || 'Unknown', cat: 'Login', action: 'Sign-in refused', target: a.name, detail: a.reason }, ...s.log].slice(0, 3000) };
    case 'logout': return { ...s, authed: false, elevatedUntil: 0, modal: null, notifOpen: false, route: { page: 'dashboard' }, log: stamp('Signed out', s.me, null, { cat: 'Login' }) };
    case 'elevate': return { ...s, elevatedUntil: Date.now() + 15 * 60e3, log: stamp('Unlocked admin tools', s.me, '15 minutes', { cat: 'Settings' }) };
    case 'lockAdmin': return { ...s, elevatedUntil: 0 };
    case 'decide': {
      const ids = new Set(a.ids); const apply = v => (ids.has(v.id) ? { ...v, approval: a.decision, approvedBy: s.me, approvedAt: now, rejectReason: a.reason || null, dupOf: a.dupOf || v.dupOf || null } : v);
      const before = activityAll(s).filter(v => ids.has(v.id));
      let notifications = s.notifications;
      if (a.decision !== 'Approved') before.forEach(v => { notifications = notify({ notifications }, { kind: 'decision', to: [v.staff], title: `Audit not counted: ${v.date}`, body: `${a.decision}${a.reason ? ' · ' + a.reason : ''} (${s.me})`, ref: { page: 'leaderboard' }, email: true }); });
      const log = [...before.map(v => ({ ts: now, user: s.me, cat: 'Approval', action: a.correction ? 'Correction: approval changed' : `${a.decision === 'Approved' ? 'Approved' : a.decision === 'Rejected' ? 'Rejected' : 'Marked duplicate'} audit`, target: v.id, detail: `${v.staff} · ${v.date}${a.reason ? ' · ' + a.reason : ''}`, from: approvalOf(v), to: a.decision })), ...s.log].slice(0, 3000);
      return { ...s, visits: s.visits.map(apply), demo: (s.demo || []).map(apply), notifications, log };
    }
    case 'finalise': {
      const prev = snapOf(s, a.month);
      const sn = { ...(prev || { month: a.month, createdAt: now }), status: 'Final', rows: a.rows, finalisedAt: now, finalisedBy: s.me, rules: JSON.parse(JSON.stringify(s.ref.scoring)), excludedPending: a.pendingCount || 0 };
      return { ...s, snapshots: [...(s.snapshots || []).filter(x => x.month !== a.month), sn], log: stamp('Finalised leaderboard', monthLabel(a.month), `${a.rows.filter(r => r.rank).length} ranked · ${a.pendingCount || 0} unapproved audits excluded`, { cat: 'Leaderboard', from: prev?.status || 'Live', to: 'Final' }) };
    }
    case 'distribute': {
      const sn = snapOf(s, a.month); if (!sn || sn.status !== 'Final') return s;
      const top = sn.rows.filter(r => r.rank && r.rank <= 3).map(r => `${r.rank}. ${r.name}`).join(' · ');
      const dist = { generatedAt: a.generatedAt || now, distributedAt: now, by: s.me, groups: a.groups, method: a.method, count: a.recipients.length, message: a.message };
      const notifications = notify(s, { kind: 'results', to: a.recipients, title: `ECA monthly results · ${monthLabel(a.month)}`, body: `${top}${a.message ? ' · ' + a.message.slice(0, 120) : ''}`, ref: { page: 'leaderboard', month: a.month }, email: a.method !== 'In-app only' });
      return { ...s, notifications, snapshots: s.snapshots.map(x => (x.month === a.month ? { ...x, distributed: dist } : x)), log: stamp('Distributed monthly results', monthLabel(a.month), `${a.recipients.length} recipients · ${a.groups.join(', ')} · ${a.method}`, { cat: 'Distribution' }) };
    }
    case 'scoring': return { ...s, ref: { ...s.ref, scoring: a.scoring, approvalMode: a.approvalMode ?? s.ref.approvalMode }, log: stamp('Changed scoring rules', 'Leaderboard', null, { cat: 'Score', from: scoringText(s.ref.scoring, s.ref.approvalMode), to: scoringText(a.scoring, a.approvalMode ?? s.ref.approvalMode) }) };
    case 'resultsSettings': return { ...s, ref: { ...s.ref, results: a.results }, log: stamp('Changed results distribution settings', 'Monthly results', null, { cat: 'Distribution', from: resultsText(s.ref.results), to: resultsText(a.results) }) };
    case 'storeTypes': return { ...s, ref: { ...s.ref, storeTypes: a.storeTypes }, log: stamp(a.what, 'Store location types', null, { cat: 'Settings', from: s.ref.storeTypes.map(t => t.name + (t.active ? '' : ' (off)')).join(', '), to: a.storeTypes.map(t => t.name + (t.active ? '' : ' (off)')).join(', ') }) };
    case 'renameStoreType': return { ...s, ref: { ...s.ref, storeTypes: s.ref.storeTypes.map(t => (t.name === a.from ? { ...t, name: a.to } : t)) }, locations: s.locations.map(l => (l.storeType === a.from ? { ...l, storeType: a.to } : l)), log: stamp('Renamed store location type', 'Store location types', null, { cat: 'Settings', from: a.from, to: a.to }) };
    case 'adminPin': return { ...s, ref: { ...s.ref, adminPin: a.pin }, log: stamp('Changed admin PIN', 'Admin access', null, { cat: 'Settings', from: '••••', to: '••••' }) };
    case 'sync': return { ...s, sync: { ...(s.sync || {}), ...a.sync } };
    case 'sharedInit': return { ...s, ...a.base, demo: [], states: DEFAULT_STATES, leads: LEADS, ref: DEFAULT_REF, lastMonth: curMonth(), sync: { ...(s.sync || {}), ...a.sync }, sharedLoaded: false };
    case 'remote': return { ...s, [a.col]: a.arr };
    case 'remoteConfig': return { ...s, states: a.cfg.states || s.states, leads: a.cfg.leads || s.leads, ref: { ...DEFAULT_REF, ...(a.cfg.ref || {}) }, lastMonth: a.cfg.lastMonth || s.lastMonth };
    case 'sharedReady': return rollMonths({ ...s, sharedLoaded: true, sync: { ...(s.sync || {}), status: 'live' } });
    case 'removeDemo': return { ...s, demo: [], snapshots: (s.snapshots || []).filter(x => !x.demo), log: stamp('Removed demo leaderboard activity', 'Leaderboard', null, { cat: 'Leaderboard' }) };
    default: return s;
  }
}
const scoringText = (sc, mode) => `${MEASURES.map(m => `${m.short} ${sc.weights[m.key]}%`).join(', ')} · ${sc.method === 'target' ? 'against targets (' + MEASURES.filter(m => m.key !== 'ranging').map(m => `${m.short} ${sc.targets[m.key]}`).join(', ') + ')' : 'relative to month leader'} · min ${sc.minAudits} audits · ${mode === 'auto' ? 'counts on submit' : 'manager approval'}`;
const resultsText = r => `${Object.entries(r.groups).filter(([, v]) => v).map(([k]) => ({ leads: 'Leads', admins: 'Admins', sms: 'Student Marketeers' }[k])).join(', ')}${r.extra.length ? ' + ' + r.extra.join(', ') : ''} · ${r.method} · business day ${r.businessDay}`;
/** High-risk admin actions need a fresh step-up (prototype: admin PIN; production: Entra ID MFA / PIM). */
function requireAdmin(D, d, actions, msg) {
  if (D.elevated) { actions.forEach(x => d(x)); return; }
  d({ type: 'modal', modal: { kind: 'elevate', then: actions, msg } });
}

/* ---------- components ---------- */
Object.assign(P, {
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3', logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10', send: 'M4 12 20 4l-5 16-3-7zM12 13l8-9',
});
const ApprovalChip = ({ v }) => { const a = approvalOf(v); return html`<span class=${'chip ' + APPROVAL_TONE[a]}><${Icon} n=${a === 'Approved' ? 'check' : a === 'Pending' ? 'clock' : 'x'} s=${12} w=${2.4} />${a === 'Approved' ? 'Counted' : a === 'Pending' ? 'Awaiting approval' : a}</span>`; };
const Medal = ({ n }) => html`<span class=${'medal m' + n} aria-label=${['First', 'Second', 'Third'][n - 1] + ' place'}>${n}</span>`;
const BoardStatus = ({ st, b }) => st === 'Final'
  ? html`<div class="banner good"><${Icon} n="lock" s=${18} /><div><b>Final · locked.</b> Approved on ${fmtWhen(b.sn.finalisedAt)} by ${b.sn.finalisedBy}.${b.sn.distributed ? ` Results sent ${fmtWhen(b.sn.distributed.distributedAt)}.` : ' Results not sent yet.'}</div></div>`
  : st === 'In review' ? html`<div class="banner warn"><${Icon} n="clock" s=${18} /><div><b>Provisional · month closed for review.</b> Scores can still change while outstanding audits are approved. The final podium is locked after review.</div></div>`
  : html`<div class="banner info"><${Icon} n="clock" s=${18} /><div><b>Live · provisional.</b> Scores update as audits are approved and reset to zero at the start of each month.</div></div>`;

function Login() {
  const { s, d } = useApp();
  const [f, setF] = useState({ first: '', last: '' }); const [tried, setTried] = useState(false); const [err, setErr] = useState(null);
  const [choices, setChoices] = useState(null); const fails = useRef(0); const lockUntil = useRef(0);
  const fe = { first: !f.first.trim() ? 'Enter your first name.' : null, last: !f.last.trim() ? 'Enter your last name.' : null };
  const submit = e => {
    e && e.preventDefault(); setTried(true); setErr(null); setChoices(null);
    if (fe.first || fe.last) return;
    if (Date.now() < lockUntil.current) { setErr(`Too many attempts. Try again in ${Math.ceil((lockUntil.current - Date.now()) / 1000)} seconds.`); return; }
    const typed = `${f.first.trim()} ${f.last.trim()}`; const key = normName(typed);
    const matches = s.people.filter(p => p.status !== 'Removed' && [p.name, ...(p.aliases || [])].some(n => normName(n) === key));
    const active = matches.filter(p => p.status === 'Active');
    if (!matches.length) { fails.current++; d({ type: 'loginFail', name: typed, reason: 'Not on approved list' });
      if (fails.current >= 5) { lockUntil.current = Date.now() + 60e3; fails.current = 0; setErr('Too many attempts. Try again in 60 seconds.'); }
      else setErr('We couldn’t find that name on the approved user list. Check the spelling, or ask your manager to add you. You can’t create an account yourself.'); return; }
    if (!active.length) { d({ type: 'loginFail', name: typed, reason: 'Account deactivated' }); setErr('Your access is switched off. Contact your manager or an ECA administrator.'); return; }
    if (active.length === 1) { fails.current = 0; d({ type: 'login', person: active[0] }); return; }
    setChoices(active);
  };
  return html`<div class="login-wrap"><main class="login" aria-labelledby="li-h">
    <div class="login-brand"><div class="lb-mark">ECA</div><div><div class="lb-t">Education Channel Audit Tool</div><div class="lb-s">Universities · TAFEs · National</div></div></div>
    <section class="card"><h1 id="li-h" style="font-size:26px;margin-bottom:4px">Sign in</h1><p class="small muted" style="margin:0 0 16px">Enter your first and last name as your manager set them up.</p>
      <form onSubmit=${submit} style="display:flex;flex-direction:column;gap:14px" novalidate>
        <div class="form-grid"><${Text} id="li-f" label="First name" value=${f.first} onChange=${v => setF({ ...f, first: v })} err=${tried ? fe.first : null} />
          <${Text} id="li-l" label="Last name" value=${f.last} onChange=${v => setF({ ...f, last: v })} err=${tried ? fe.last : null} /></div>
        ${err ? html`<div class="banner bad" role="alert"><${Icon} n="alert" s=${18} /><div>${err}</div></div>` : null}
        ${choices ? html`<div class="banner warn" role="status"><${Icon} n="people" s=${18} /><div style="flex:1"><b>More than one person has this name.</b> Choose your profile.
          <div class="list" style="margin-top:8px">${choices.map(p => html`<button type="button" key=${p.id} class="rowbtn" style="background:var(--surface);border:1px solid var(--line);margin-top:6px" onClick=${() => d({ type: 'login', person: p })}>
            <div class="main-c" style="flex:1;min-width:0"><div class="t" style="font-weight:700">${p.name}</div><div class="m">${personLabel(p)}</div></div><${Icon} n="chev" s=${16} /></button>`)}</div></div></div>` : null}
        <button class="btn primary" type="submit" style="min-height:46px" disabled=${s.sync?.mode === 'shared' && !s.sharedLoaded}>${s.sync?.mode === 'shared' && !s.sharedLoaded ? 'Loading shared data…' : 'Continue'}</button></form></section>
    <details class="card flat small"><summary style="cursor:pointer;font-weight:600">Prototype notes</summary>
      <p style="margin:8px 0 0">Names are checked against the approved user list in People. Try <b>Hudson Ayoubi</b> (administrator), <b>Charlotte Terrell</b> (manager) or <b>George Johnson</b> (Student Marketeer). Name-only sign-in isn’t proof of identity, so administrator changes ask for a step-up check.</p></details>
  </main></div>`;
}
function ElevateSheet({ m, onClose }) {
  const { s, d } = useApp(); const [pin, setPin] = useState(''); const [err, setErr] = useState(null); const tries = useRef(0);
  const go = e => { e && e.preventDefault();
    if (tries.current >= 3) { setErr('Locked after 3 wrong attempts. Close and try again later.'); return; }
    if (pin !== s.ref.adminPin) { tries.current++; d({ type: 'loginFail', name: s.me, reason: 'Wrong admin PIN' }); setErr(tries.current >= 3 ? 'Locked after 3 wrong attempts.' : 'That PIN isn’t right.'); return; }
    onClose(); d({ type: 'elevate' }); (m.then || []).forEach(x => d(x)); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="el-h" style="width:min(460px,100%)"><div class="sheet-h"><h2 id="el-h">Confirm it’s you</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <form class="sheet-b" onSubmit=${go}><div class="banner info"><${Icon} n="shield" s=${18} /><div>${m.msg || 'This is an administrator action.'} Name sign-in isn’t enough for it, so enter the admin PIN. Admin tools stay unlocked for 15 minutes.</div></div>
      <${Text} id="el-pin" label="Admin PIN" type="password" inputMode="numeric" value=${pin} onChange=${setPin} err=${err} hint="Prototype PIN: 2468. In production this step is Microsoft Entra ID multi-factor sign-in." />
      <div style="display:flex;justify-content:flex-end;gap:10px"><button type="button" class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" type="submit">Unlock and continue</button></div></form></div>`;
}

function Podium({ rows }) {
  const top = [2, 1, 3].map(n => rows.find(r => r.rank === n));
  if (!rows.some(r => r.rank)) return html`<${Empty} title="No one is ranked yet" body="The podium fills once Student Marketeers have enough approved audits this month." />`;
  return html`<div class="podium" role="list" aria-label="Top three Student Marketeers">${top.map((r, i) => { const n = [2, 1, 3][i];
    return html`<div key=${n} class=${'pod p' + n} role="listitem">${r ? html`<${Medal} n=${n} /><div class="pod-n">${r.name}</div><div class="xs muted">${r.state}${r.reportsTo ? ' · ' + r.reportsTo : ''}</div>`
      : html`<span class="xs muted">Not yet ranked</span>`}<div class="block num">${r ? one(r.total) : '—'}</div></div>`; })}</div>`;
}
function ScoreCard({ r, of, s }) {
  const W = s.ref.scoring.weights;
  return html`<section class="card" aria-label="Your scorecard"><div class="card-h"><div><div class="eyebrow">Your scorecard</div><h2>${r.rank ? `#${r.rank} of ${of}` : 'Not ranked yet'}</h2></div>
    <div style="text-align:right"><div class="kpi-like num">${one(r.total)}</div><div class="xs muted">overall score / 100</div></div></div>
    ${!r.qualified ? html`<div class="banner warn" style="margin-bottom:12px"><${Icon} n="clock" s=${18} /><div>You need ${s.ref.scoring.minAudits} approved audits this month to be ranked. You have ${r.audits}.</div></div>` : null}
    <div class="sc-grid">${MEASURES.map(m => html`<div key=${m.key} class="sc"><div class="sc-h"><span>${m.label}</span><b class="num">${m.pct ? Math.round(r[m.key]) + '%' : r[m.key]}</b></div>
      <div class="mbar" aria-hidden="true"><i style=${{ width: Math.round(r.scores[m.key]) + '%' }}></i></div>
      <div class="xs muted num">Scored ${Math.round(r.scores[m.key])} of 100 · weight ${W[m.key]}% · ${one(r.points[m.key])} points</div></div>`)}</div>
    ${r.pending ? html`<p class="xs muted" style="margin:10px 0 0">${r.pending} of your audits are awaiting approval and aren’t counted yet.</p>` : null}</section>`;
}
function BoardTable({ rows, month, meName, canDrill, showUnranked }) {
  const { d } = useApp();
  const list = rows.filter(r => showUnranked || r.rank);
  return html`<div class="tbl-wrap"><table><thead><tr><th class="n">Rank</th><th>Student Marketeer</th><th class="n">Score</th>${MEASURES.map(m => html`<th key=${m.key} class=${'n' + (m.key === 'ranging' ? '' : ' hide-m')}>${m.short}${m.pct ? ' %' : ''}</th>`)}<th class="n hide-m">Audits</th></tr></thead><tbody>
    ${list.map(r => html`<tr key=${r.id + r.name} class=${(r.name === meName ? 'me ' : '') + (canDrill ? 'click' : '')} tabindex=${canDrill ? 0 : undefined}
        onClick=${() => canDrill && d({ type: 'modal', modal: { kind: 'drill', month, name: r.name } })} onKeyDown=${e => canDrill && e.key === 'Enter' && d({ type: 'modal', modal: { kind: 'drill', month, name: r.name } })}>
      <td class="n">${r.rank ? (r.rank <= 3 ? html`<${Medal} n=${r.rank} />` : html`<span class="rankc num">${r.rank}</span>`) : html`<span class="xs muted">—</span>`}</td>
      <td style="min-width:150px"><b>${r.name}</b>${r.name === meName ? html` <span class="chip type">You</span>` : null}<div class="xs muted">${r.state}${r.reportsTo ? ' · ' + r.reportsTo : ''}${!r.rank ? ' · not ranked' : ''}</div></td>
      <td class="n"><b class="num">${r.rank ? one(r.total) : '—'}</b></td>${MEASURES.map(m => html`<td key=${m.key} class=${'n num' + (m.key === 'ranging' ? '' : ' hide-m')}>${m.pct ? Math.round(r[m.key]) : r[m.key]}</td>`)}<td class="n num hide-m">${r.audits}</td></tr>`)}
  </tbody></table></div>`;
}
function MonthBoard({ month, setMonth }) {
  const { s, d, D } = useApp();
  const staff = D.isAdmin || D.isMgr;
  const st = monthStatus(s, month); const b = boardFor(s, month);
  const [region, setRegion] = useState('all'); const [mgr, setMgr] = useState('all'); const [showUn, setShowUn] = useState(false);
  const months = knownMonths(s);
  const managers = [...new Set(b.rows.map(r => r.reportsTo).filter(Boolean))].sort();
  const view = b.rows.filter(r => (region === 'all' || r.state === region) && (mgr === 'all' || r.reportsTo === mgr));
  const ranked = b.rows.filter(r => r.rank).length; const me = b.rows.find(r => r.name === D.meP.name);
  const pend = b.final ? 0 : b.pending.length;
  const [copied, setCopied] = useState(false);
  const csv = () => [`"${ECA} · National Leaderboard · ${monthLabel(month)} · ${st}"`, 'Rank,Student Marketeer,State,Manager,Score,' + MEASURES.map(m => m.label).join(',') + ',Approved audits',
    ...b.rows.map(r => [r.rank || '', r.name, r.state, r.reportsTo || '', r.rank ? one(r.total) : '', Math.round(r.ranging), r.tdp, r.editions, r.pos, r.coolers, r.audits].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  const copy = () => { if (!navigator.clipboard) return setCopied('fail'); navigator.clipboard.writeText(csv()).then(() => { setCopied(true); d({ type: 'toast', msg: 'Leaderboard copied as CSV' }); }, () => setCopied('fail')); };
  return html`<div class="toolbar">
      <${Select} id="lb-m" label="Reporting month" value=${month} onChange=${setMonth} options=${months.filter(m => staff || m === curMonth() || monthStatus(s, m) === 'Final').map(m => [m, `${monthLabel(m)} · ${monthStatus(s, m)}`])} />
      ${staff ? html`${D.isAdmin ? html`<${StatePick} value=${region} onChange=${setRegion} D=${D} s=${s} allLabel="National" />` : null}
        <${Select} id="lb-mgr" label="Manager" value=${mgr} onChange=${setMgr} options=${[['all', 'All managers'], ...managers.map(x => [x, x])]} />` : null}
      <div class="field fit"><span class="label">Show</span><${Seg} label="Show" value=${showUn} onChange=${setShowUn} options=${[[false, 'Ranked'], [true, `Everyone (${b.rows.length})`]]} /></div>
      ${staff ? html`<div class="field fit"><span class="label"> </span><button class="btn" onClick=${copy}><${Icon} n="copy" s=${16} />Copy CSV</button></div>` : null}</div>
    ${copied === 'fail' ? html`<textarea class="input" readonly style="min-height:120px;font-family:ui-monospace,monospace;font-size:12px" onFocus=${e => e.target.select()}>${csv()}</textarea>` : null}
    <${BoardStatus} st=${st} b=${b} />
    <div class="small muted num">${monthLabel(month)} · ${ranked} ranked · last updated ${fmtWhen(b.lastUpdated)}${pend ? ` · ${pend} audit${pend > 1 ? 's' : ''} awaiting approval (not counted)` : ''}${(s.demo || []).length && b.rows.some(r => r.audits) ? ' · includes demo activity' : ''}</div>
    <div class="grid g2" style="align-items:start">
      <section class="card"><div class="card-h"><h2>Podium</h2><span class="xs muted">${monthLabel(month)}</span></div><${Podium} rows=${b.rows} /></section>
      ${me ? html`<${ScoreCard} r=${me} of=${ranked} s=${s} />` : html`<section class="card"><h2 class="section-t">How scores work</h2><${ScoringRules} s=${s} rules=${b.final ? b.sn.rules : null} /></section>`}
    </div>
    <section><div class="card-h" style="margin-bottom:10px"><h2>National ranking</h2>${staff ? html`<span class="xs muted">Select a row to see the activity behind the score</span>` : null}</div>
      ${view.some(r => showUn || r.rank) ? html`<${BoardTable} rows=${view} month=${month} meName=${D.meP.name} canDrill=${staff} showUnranked=${showUn} />` : html`<${Empty} title="No ranked Student Marketeers in this view" body="Change the filters, or show everyone." />`}
      ${region !== 'all' || mgr !== 'all' ? html`<p class="xs muted" style="margin:8px 0 0">Filtered view. Ranks are national.</p>` : null}</section>
    ${me ? html`<details class="card flat"><summary style="cursor:pointer;font-weight:700">How scores work</summary><div style="margin-top:10px"><${ScoringRules} s=${s} rules=${b.final ? b.sn.rules : null} /></div></details>` : null}`;
}
function ScoringRules({ s, rules }) {
  const sc = rules || s.ref.scoring;
  return html`<div class="small" style="display:flex;flex-direction:column;gap:8px">
    <p style="margin:0">Your monthly score is out of 100. Each measure is scored 0 to 100, then weighted.${rules ? ' These are the rules that applied when this month was finalised.' : ''}</p>
    <div class="tbl-wrap"><table><thead><tr><th>Measure</th><th class="n">Weight</th><th>How it’s scored</th></tr></thead><tbody>${MEASURES.map(m => html`<tr key=${m.key}><td><b>${m.label}</b></td><td class="n num">${sc.weights[m.key]}%</td>
      <td class="small">${m.key === 'ranging' ? 'Already a percentage, used as is' : sc.method === 'target' ? `Against a monthly target of ${sc.targets[m.key]}, capped at 100` : 'Compared with the month’s leader for this measure (leader = 100)'}</td></tr>`)}</tbody></table></div>
    <p style="margin:0" class="xs muted">Only approved audits count. Pending, rejected, duplicate and cancelled audits are left out. You need ${sc.minAudits} approved audits in the month to be ranked. Ties go to more TDP added, then higher ranging, then more approved audits, then whoever reached the score first.</p></div>`;
}
function DrillSheet({ month, name, onClose }) {
  const { s, D } = useApp();
  const acts = activityAll(s).filter(v => v.staff === name && v.status === 'Completed' && !v.imported && v.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const b = boardFor(s, month); const r = b.rows.find(x => x.name === name);
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dr-h"><div class="sheet-h"><div><div class="xs muted">${monthLabel(month)} · ${monthStatus(s, month)}</div><h2 id="dr-h">${name}</h2></div><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b">${r ? html`<div class="kpis"><${Kpi} label="Rank" value=${r.rank ? '#' + r.rank : '—'} /><${Kpi} label="Score" value=${r.rank ? one(r.total) : '—'} /><${Kpi} label="Approved audits" value=${r.audits} /><${Kpi} label="Ranging" value=${Math.round(r.ranging) + '%'} /></div>` : null}
      ${acts.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Location</th><th class="hide-m">Store type</th><th class="n">TDP</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th><th class="n hide-m">Coolers</th><th>Counted?</th></tr></thead><tbody>
        ${acts.map(v => { const l = D.locBy[v.loc]; return html`<tr key=${v.id}><td class="num" style="white-space:nowrap">${fmtShort(v.date)}</td><td style="min-width:140px">${l?.name || v.loc}<div class="xs muted">${v.demo ? 'Demo · ' : ''}${v.id}</div></td><td class="hide-m">${l ? storeTypeOf(l) : '—'}</td>
          <td class="n num">${v.dpAdded}</td><td class="n num hide-m">${v.editions}</td><td class="n num hide-m">${v.posPlaced}</td><td class="n num hide-m">${v.coolersIn}</td><td><${ApprovalChip} v=${v} />${v.rejectReason ? html`<div class="xs muted">${v.rejectReason}</div>` : v.dupOf ? html`<div class="xs muted">Duplicate of ${v.dupOf}</div>` : null}</td></tr>`; })}</tbody></table></div>`
        : html`<${Empty} title="No audits this month" body="Nothing submitted by this Student Marketeer in the month." />`}
      ${b.final ? html`<p class="xs muted" style="margin:0">This month is final. The score shown is the locked result; later corrections are logged in the audit history.</p>` : null}</div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Close</button></div></div>`;
}
function ReviewQueue() {
  const { s, d, D } = useApp();
  const q = reviewQueue(s, D); const [sel, setSel] = useState({}); const [reason, setReason] = useState({}); const [rej, setRej] = useState(null);
  const recent = activityAll(s).filter(v => v.approvedAt && v.approvedBy && !v.imported && D.scopeStates.includes(s.people.find(p => p.name === v.staff)?.state)).sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt))).slice(0, 8);
  const dupOf = v => activityAll(s).find(x => x.id !== v.id && x.staff === v.staff && x.loc === v.loc && x.date === v.date && approvalOf(x) !== 'Duplicate');
  const ids = Object.keys(sel).filter(k => sel[k]);
  const decide = (list, decision, why, extra = {}) => { d({ type: 'decide', ids: list, decision, reason: why, ...extra }); setSel({}); setRej(null); d({ type: 'toast', msg: `${list.length} audit${list.length > 1 ? 's' : ''} ${decision === 'Approved' ? 'approved' : decision === 'Rejected' ? 'rejected' : 'marked as duplicate'}` }); };
  return html`<div class="banner info"><${Icon} n="shield" s=${18} /><div>Approved audits count towards the leaderboard. Rejected and duplicate audits don’t. You can’t approve your own audits${D.isMgr ? `, and you see ${D.meP.state} only` : ''}.</div></div>
    ${q.length ? html`<div class="toolbar"><span class="small muted num" style="flex:1">${q.length} waiting${ids.length ? ` · ${ids.length} selected` : ''}</span>
      <button class="btn" onClick=${() => setSel(Object.fromEntries(q.map(v => [v.id, true])))}>Select all</button>
      <button class="btn primary" disabled=${!ids.length} onClick=${() => decide(ids, 'Approved')}>Approve selected</button></div>
    <div class="list" style="gap:10px">${q.map(v => { const l = D.locBy[v.loc]; const dup = dupOf(v); return html`<section key=${v.id} class="card" style="padding:14px">
      <div style="display:flex;gap:12px;align-items:flex-start"><input type="checkbox" aria-label=${'Select ' + v.id} checked=${!!sel[v.id]} onChange=${e => setSel({ ...sel, [v.id]: e.target.checked })} style="width:20px;height:20px;margin-top:3px" />
        <div style="flex:1;min-width:0"><div class="xs muted">${fmtDate(v.date)} ${v.time || ''} · ${v.id}${v.demo ? ' · demo' : ''}</div><b>${v.staff}</b> · ${l?.name || v.loc}
          <div class="small muted">${l ? storeTypeOf(l) + ' · ' + l.uniName : ''} · TDP +${v.dpAdded} · Editions ${v.editions} · POS ${v.posPlaced} · Coolers +${v.coolersIn}</div>
          ${dup ? html`<div class="chip warn" style="margin-top:6px"><${Icon} n="copy" s=${12} />Same store, same day as ${dup.id}</div>` : null}</div></div>
      ${rej === v.id ? html`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px"><div style="flex:1 1 220px"><${Text} id=${'rj-' + v.id} label="Reason (sent to the Student Marketeer)" value=${reason[v.id] || ''} onChange=${x => setReason({ ...reason, [v.id]: x })} /></div>
          <button class="btn" onClick=${() => setRej(null)}>Cancel</button><button class="btn danger" disabled=${!(reason[v.id] || '').trim()} onClick=${() => decide([v.id], 'Rejected', reason[v.id].trim())}>Reject</button></div>`
        : html`<div class="chips" style="margin-top:10px;justify-content:flex-end"><button class="btn sm" onClick=${() => d({ type: 'modal', modal: { kind: 'drill', month: v.date.slice(0, 7), name: v.staff } })}>Their month</button>
          ${dup ? html`<button class="btn sm" onClick=${() => decide([v.id], 'Duplicate', 'Duplicate of ' + dup.id, { dupOf: dup.id })}>Mark duplicate</button>` : null}
          <button class="btn sm danger" onClick=${() => setRej(v.id)}>Reject</button><button class="btn sm primary" onClick=${() => decide([v.id], 'Approved')}>Approve</button></div>`}</section>`; })}</div>`
      : html`<${Empty} title="Nothing waiting for approval" body="New audits from Student Marketeers in your scope appear here." />`}
    ${recent.length ? html`<section class="card"><div class="card-h"><h2>Recently decided</h2></div><div class="list">${recent.map(v => html`<div class="row" key=${v.id}><div class="main-c"><div class="t">${v.staff} · ${D.locBy[v.loc]?.name || v.loc}</div><div class="m">${fmtDate(v.date)} · ${v.approvedBy}, ${fmtWhen(v.approvedAt)}</div></div><${ApprovalChip} v=${v} /></div>`)}</div></section>` : null}`;
}
function Bars({ items, caption, fmt = x => x }) {
  const W = 560, H = 200, L = 8, B = 26, T = 18, R = 8; const max = Math.max(1, ...items.map(i => i.value));
  const step = (W - L - R) / Math.max(1, items.length), bw = Math.min(42, step * 0.6); const y = v => T + (H - T - B) * (1 - v / max);
  return html`<div class="chart-wrap"><svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${caption}><line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} stroke="var(--line-strong)" />
    ${items.map((it, i) => { const cx = L + step * i + step / 2; return html`<g key=${it.label}><rect x=${cx - bw / 2} y=${y(it.value)} width=${bw} height=${Math.max(0, H - B - y(it.value))} rx="3" fill=${it.hi ? 'var(--brand)' : 'var(--brand-tint)'} stroke="var(--brand)" stroke-width=${it.hi ? 0 : 1}><title>${it.label}: ${fmt(it.value)}</title></rect>
      <text x=${cx} y=${y(it.value) - 5} text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${fmt(it.value)}</text><text x=${cx} y=${H - 8} text-anchor="middle" font-size="11" fill="var(--ink-3)">${it.label}</text></g>`; })}</svg></div>`;
}
function YearRound() {
  const { s, d, D } = useApp();
  const year = D.today.slice(0, 4);
  const [f, setF] = useState({ month: 'all', state: D.isAdmin ? 'all' : D.meP.state, manager: 'all', sm: 'all', storeType: 'All', activity: 'All' });
  const filtered = f.storeType !== 'All' || f.activity !== 'All';
  const months = knownMonths(s).filter(m => m.startsWith(year)).sort();
  const per = months.map(m => { const st = monthStatus(s, m); const b = !filtered && st === 'Final' ? boardFor(s, m) : scoreMonth(s, m, f); return { m, st, rows: b.rows }; });
  const inScope = r => D.scopeStates.includes(r.state) && (f.state === 'all' || r.state === f.state) && (f.manager === 'all' || r.reportsTo === f.manager) && (f.sm === 'all' || r.name === f.sm);
  const use = per.filter(x => f.month === 'all' || x.m === f.month);
  const agg = {};
  use.forEach(({ m, rows }) => rows.filter(inScope).forEach(r => { const a = agg[r.name] = agg[r.name] || { name: r.name, state: r.state, reportsTo: r.reportsTo, by: {}, audits: 0, tdp: 0, editions: 0, pos: 0, coolers: 0, rg: [], sc: [], pod: 0 };
    a.by[m] = r; a.audits += r.audits; a.tdp += r.tdp; a.editions += r.editions; a.pos += r.pos; a.coolers += r.coolers; if (r.audits) a.rg.push(r.ranging); if (r.rank) { a.sc.push(r.total); if (r.rank <= 3) a.pod++; } }));
  const rows = Object.values(agg).filter(a => a.audits || f.sm !== 'all').sort((a, b) => b.pod - a.pod || (b.sc.length ? b.sc.reduce((x, y) => x + y, 0) / b.sc.length : 0) - (a.sc.length ? a.sc.reduce((x, y) => x + y, 0) / a.sc.length : 0) || b.audits - a.audits);
  const tot = k => rows.reduce((t, r) => t + r[k], 0); const rgAll = rows.flatMap(r => r.rg);
  const managers = [...new Set(s.people.filter(p => p.role === 'manager' && D.scopeStates.includes(p.state) && (f.state === 'all' || p.state === f.state)).map(p => p.name))].sort();
  const sms = s.people.filter(p => p.role === 'marketeer' && D.scopeStates.includes(p.state) && (f.state === 'all' || p.state === f.state) && (f.manager === 'all' || p.reportsTo === f.manager)).map(p => p.name).sort();
  const trend = f.sm !== 'all' ? per.map(x => ({ label: monthShort(x.m), value: x.rows.find(r => r.name === f.sm)?.total || 0, hi: x.m === curMonth() }))
    : per.map(x => ({ label: monthShort(x.m), value: x.rows.filter(inScope).reduce((t, r) => t + r.audits, 0), hi: x.m === curMonth() }));
  const types = [...s.ref.storeTypes.map(t => [t.name, t.active ? t.name : `${t.name} (retired)`])];
  return html`<div class="toolbar">
    <${Select} id="yr-m" label="Month" value=${f.month} onChange=${v => setF({ ...f, month: v })} options=${[['all', `All of ${year} (year to date)`], ...months.slice().reverse().map(m => [m, monthLabel(m)])]} />
    ${D.isAdmin ? html`<${StatePick} value=${f.state} onChange=${v => setF({ ...f, state: v, manager: 'all', sm: 'all' })} D=${D} s=${s} allLabel="National" />` : null}
    <${Select} id="yr-mgr" label="Manager" value=${f.manager} onChange=${v => setF({ ...f, manager: v, sm: 'all' })} options=${[['all', 'All managers'], ...managers.map(x => [x, x])]} />
    <${Select} id="yr-sm" label="Student Marketeer" value=${f.sm} onChange=${v => setF({ ...f, sm: v })} options=${[['all', 'All Student Marketeers'], ...sms.map(x => [x, x])]} />
    <${Select} id="yr-st" label="Store location type" value=${f.storeType} onChange=${v => setF({ ...f, storeType: v })} options=${[['All', 'All store types'], ...types]} />
    <${Select} id="yr-act" label="Activity type" value=${f.activity} onChange=${v => setF({ ...f, activity: v })} options=${[['All', 'All activity'], ['Store audit', 'Store audits'], ['Vending audit', 'Vending audits']]} /></div>
  ${filtered ? html`<div class="banner info"><${Icon} n="chart" s=${18} /><div>Scores and ranks here are recalculated on the filtered activity only. Official ranks are on the monthly leaderboard.</div></div>` : null}
  <div class="kpis"><${Kpi} label="Approved audits" value=${tot('audits')} sub=${f.month === 'all' ? 'Year to date' : monthLabel(f.month)} /><${Kpi} label="TDP added" value=${tot('tdp')} /><${Kpi} label="Editions sold" value=${tot('editions')} /><${Kpi} label="POS placed" value=${tot('pos')} />
    <${Kpi} label="Coolers added" value=${tot('coolers')} /><${Kpi} label="Avg ranging" value=${rgAll.length ? Math.round(rgAll.reduce((a, b) => a + b, 0) / rgAll.length) + '%' : '—'} /><${Kpi} label="Student Marketeers active" value=${rows.length} /><${Kpi} label="Months" value=${use.length} sub=${use.filter(x => x.st === 'Final').length + ' final'} /></div>
  <div class="grid g2"><section class="card"><div class="card-h"><h2>${f.sm !== 'all' ? `${f.sm}: score by month` : 'Approved audits by month'}</h2><span class="xs muted">${year}</span></div><${Bars} items=${trend} caption=${f.sm !== 'all' ? 'Score by month' : 'Approved audits by month'} fmt=${v => (f.sm !== 'all' ? one(v) : v)} /></section>
    <section class="card"><div class="card-h"><h2>Podium history</h2></div>${per.slice().reverse().filter(x => x.rows.some(r => r.rank)).length ? html`<div class="list">${per.slice().reverse().filter(x => x.rows.some(r => r.rank)).map(x => html`<div class="row" key=${x.m}><div class="main-c"><div class="t">${monthLabel(x.m)} <span class=${'chip ' + (x.st === 'Final' ? 'good' : 'warn')}>${x.st}</span></div>
      <div class="chips" style="margin-top:6px">${x.rows.filter(r => r.rank && r.rank <= 3).map(r => html`<span key=${r.name} class="chip plain"><${Medal} n=${r.rank} />${r.name} · ${one(r.total)}</span>`)}</div></div></div>`)}</div>` : html`<${Empty} title="No podiums yet" body="Podiums appear once Student Marketeers are ranked." />`}</section></div>
  <section><h2 style="margin-bottom:10px">Student Marketeer performance</h2>${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Student Marketeer</th>${months.map(m => html`<th key=${m} class="n hide-m">${monthShort(m)}</th>`)}<th class="n">Avg score</th><th class="n hide-m">Audits</th><th class="n hide-m">TDP</th><th class="n hide-m">Editions</th><th class="n hide-m">POS</th><th class="n hide-m">Coolers</th><th class="n">Podiums</th></tr></thead><tbody>
    ${rows.map(a => html`<tr key=${a.name} class="click" tabindex="0" onClick=${() => setF({ ...f, sm: a.name })}><td style="min-width:150px"><b>${a.name}</b><div class="xs muted">${a.state}${a.reportsTo ? ' · ' + a.reportsTo : ''}</div></td>
      ${months.map(m => { const r = a.by[m]; return html`<td key=${m} class="n num hide-m">${r?.rank ? html`<span title=${'Score ' + one(r.total)}>#${r.rank}</span>` : html`<span class="muted">—</span>`}</td>`; })}
      <td class="n num"><b>${a.sc.length ? one(a.sc.reduce((x, y) => x + y, 0) / a.sc.length) : '—'}</b></td><td class="n num hide-m">${a.audits}</td><td class="n num hide-m">${a.tdp}</td><td class="n num hide-m">${a.editions}</td><td class="n num hide-m">${a.pos}</td><td class="n num hide-m">${a.coolers}</td><td class="n num">${a.pod}</td></tr>`)}</tbody></table></div>
    <p class="xs muted" style="margin:8px 0 0">Month columns show national rank. Final months use the locked results. Select a row to chart that person.</p>`
    : html`<${Empty} title="No activity in this view" body="Try another month, region or store type." />`}</section>`;
}
function ResultsAdmin() {
  const { s, d, D } = useApp();
  const months = knownMonths(s);
  return html`<div class="banner info"><${Icon} n="send" s=${18} /><div>At month end the leaderboard closes for review. ${D.isAdmin ? 'Finalise it once outstanding audits are approved, then send the results.' : 'Education Channel Leads and administrators finalise it and send the results.'}</div></div>
  <div class="tbl-wrap"><table><thead><tr><th>Month</th><th>Status</th><th class="hide-m">Podium</th><th class="hide-m">Finalised</th><th>Results sent</th>${D.isAdmin ? html`<th><span class="sr">Actions</span></th>` : null}</tr></thead><tbody>
    ${months.map(m => { const st = monthStatus(s, m); const b = boardFor(s, m); const sn = b.sn; const pend = b.final ? 0 : b.pending.length;
      return html`<tr key=${m}><td><b>${monthLabel(m)}</b>${pend ? html`<div class="xs muted">${pend} awaiting approval</div>` : null}</td><td><span class=${'chip ' + (st === 'Final' ? 'good' : st === 'Live' ? 'plain' : 'warn')}>${st === 'Final' ? html`<${Icon} n="lock" s=${12} />` : null}${st}</span></td>
        <td class="hide-m small">${b.rows.filter(r => r.rank && r.rank <= 3).map(r => r.name).join(', ') || '—'}</td><td class="hide-m small">${sn?.finalisedAt ? `${fmtWhen(sn.finalisedAt)} · ${sn.finalisedBy}` : '—'}</td>
        <td class="small">${sn?.distributed ? `${fmtWhen(sn.distributed.distributedAt)} · ${sn.distributed.count || 'all'} recipients` : st === 'Final' ? html`<span class="chip warn">Not sent</span>` : '—'}</td>
        ${D.isAdmin ? html`<td style="white-space:nowrap;text-align:right">${st === 'In review' ? html`<button class="btn sm primary" onClick=${() => d({ type: 'modal', modal: { kind: 'finalise', month: m } })}>Finalise</button>`
          : st === 'Final' ? html`<button class=${'btn sm' + (sn.distributed ? '' : ' primary')} onClick=${() => d({ type: 'modal', modal: { kind: 'distribute', month: m } })}>${sn.distributed ? 'View results' : 'Send results'}</button>` : html`<span class="xs muted">Closes ${fmtDate(shiftMonth(m, 1) + '-01')}</span>`}</td>` : null}</tr>`; })}</tbody></table></div>`;
}
function FinaliseSheet({ month, onClose }) {
  const { s, d, D } = useApp(); const b = scoreMonth(s, month);
  const go = () => { onClose(); requireAdmin(D, d, [{ type: 'finalise', month, rows: snapRows(b.rows), pendingCount: b.pending.length }, { type: 'toast', msg: `${monthLabel(month)} finalised and locked` }], `Finalising ${monthLabel(month)} locks the results.`); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="fn-h" style="width:min(620px,100%)"><div class="sheet-h"><h2 id="fn-h">Finalise ${monthLabel(month)}</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b">${b.pending.length ? html`<div class="banner warn"><${Icon} n="alert" s=${18} /><div><b>${b.pending.length} audit${b.pending.length > 1 ? 's are' : ' is'} still awaiting approval.</b> If you finalise now ${b.pending.length > 1 ? 'they' : 'it'} won’t count. Approve them first in Review activity if they should.</div></div>` : html`<div class="banner good"><${Icon} n="check" s=${18} /><div>Every audit for the month has been reviewed.</div></div>`}
      <${Podium} rows=${b.rows} />
      <p class="small" style="margin:0">Finalising saves a snapshot of every Student Marketeer’s rank, score and measures, records you as the approver, and locks the month. Later corrections are possible for administrators but are logged and don’t change the locked snapshot.</p></div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${go}><${Icon} n="lock" s=${16} />Finalise and lock</button></div></div>`;
}
function DistributeSheet({ month, onClose }) {
  const { s, d, D } = useApp(); const sn = snapOf(s, month); const R = s.ref.results;
  const [groups, setGroups] = useState({ ...R.groups }); const [method, setMethod] = useState(R.method);
  const [msg, setMsg] = useState(() => fillTemplate(R.template, sn, month)); const gen = useRef(new Date().toISOString());
  if (!sn) return null; const sent = sn.distributed;
  const rc = recipientsFor(s, groups); const top = sn.rows.filter(r => r.rank && r.rank <= 3);
  const send = () => { const labels = Object.entries(rc.out).filter(([, v]) => v.length).map(([k]) => k); onClose();
    requireAdmin(D, d, [{ type: 'distribute', month, groups: labels, method, message: msg, recipients: rc.all, generatedAt: gen.current }, { type: 'toast', msg: `Results sent to ${rc.all.length} people` }], 'Sending results goes to the whole channel.'); };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ds-h"><div class="sheet-h"><div><div class="xs muted">${ECA}</div><h2 id="ds-h">Monthly results · ${monthLabel(month)}</h2></div><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b">${sent ? html`<div class="banner good"><${Icon} n="check" s=${18} /><div>Sent ${fmtWhen(sent.distributedAt)} by ${sent.by} to ${sent.groups.join(', ')} (${sent.count || 'all'} people) · ${sent.method}. Finalised ${fmtWhen(sn.finalisedAt)} by ${sn.finalisedBy}.</div></div>` : null}
      <section class="card flat"><div class="eyebrow">Preview</div><h3 style="margin:4px 0 10px">ECA monthly results · ${monthLabel(month)}</h3>
        <div class="chips">${top.map(r => html`<span key=${r.name} class="chip plain" style="font-size:13px"><${Medal} n=${r.rank} />${r.name} · ${one(r.total)}</span>`)}</div>
        <p style="margin:10px 0">${sent ? sent.message || '—' : msg}</p>
        <div class="tbl-wrap" style="max-height:240px;overflow:auto"><table><thead><tr><th class="n">Rank</th><th>Student Marketeer</th><th class="n">Score</th>${MEASURES.map(m => html`<th key=${m.key} class="n hide-m">${m.short}</th>`)}</tr></thead><tbody>
          ${sn.rows.filter(r => r.rank).map(r => html`<tr key=${r.name}><td class="n num">${r.rank}</td><td>${r.name}</td><td class="n num">${one(r.total)}</td>${MEASURES.map(m => html`<td key=${m.key} class="n num hide-m">${m.pct ? Math.round(r[m.key]) + '%' : r[m.key]}</td>`)}</tr>`)}</tbody></table></div>
        <p class="xs muted" style="margin:10px 0 0">See the full results in ECA → National Leaderboard → ${monthLabel(month)}. Names, ranks and scores only; no contact details.</p></section>
      ${sent ? null : html`<div class="form-grid"><div class="field span2"><span class="label">Send to</span><div class="chips">${[['leads', 'Education Channel Leads'], ['admins', 'Administrators'], ['sms', 'Student Marketeers']].map(([k, t]) => html`<label key=${k} class="fchip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" checked=${!!groups[k]} onChange=${e => setGroups({ ...groups, [k]: e.target.checked })} />${t} (${rc.out[t].length || recipientsFor(s, { [k]: true }).out[t].length})</label>`)}</div>
          ${rc.out['Additional recipients'].length ? html`<span class="hint">Plus ${rc.out['Additional recipients'].join(', ')} (additional recipients in Settings)</span>` : null}</div>
        <${Select} id="ds-m" label="Communication method" value=${method} onChange=${setMethod} options=${['Email and in-app', 'Email only', 'In-app only', 'Teams post and in-app']} />
        <div class="field"><span class="label">Recipients</span><b class="num" style="font-size:20px">${rc.all.length}</b></div>
        <div class="span2"><${Text} id="ds-msg" label="Recognition message" multiline value=${msg} onChange=${setMsg} hint="From the message template in Settings. Edit before sending." /></div></div>`}</div>
    <div class="sheet-f"><button class="btn" onClick=${onClose}>${sent ? 'Close' : 'Cancel'}</button>${sent ? null : html`<button class="btn primary" disabled=${!rc.all.length} onClick=${send}><${Icon} n="send" s=${16} />Send to ${rc.all.length}</button>`}</div></div>`;
}
function Leaderboard() {
  const { s, d, D } = useApp();
  const staff = D.isAdmin || D.isMgr;
  const tabs = ['This month', ...(staff ? ['Year-round', 'Review activity', 'Results'] : [])];
  const tab = tabs.includes(s.route.tab) ? s.route.tab : 'This month';
  const month = s.route.month || curMonth();
  const setRoute = x => d({ type: 'nav', route: { page: 'leaderboard', tab, month, ...x } });
  const q = staff ? reviewQueue(s, D).length : 0;
  return html`<div class="page-h"><div><div class="eyebrow">${ECA}</div><h1>National Leaderboard</h1><p>Monthly scorecard for Student Marketeers: ranging, TDP added, Editions sold, POS placed and coolers added.</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(t => html`<button key=${t} role="tab" aria-selected=${String(tab === t)} onClick=${() => setRoute({ tab: t })}>${t}${t === 'Review activity' && q ? ` (${q})` : ''}</button>`)}</div>
    ${tab === 'This month' ? html`<${MonthBoard} key=${month} month=${month} setMonth=${m => setRoute({ month: m })} />` : tab === 'Year-round' ? html`<${YearRound} />` : tab === 'Review activity' ? html`<${ReviewQueue} />` : html`<${ResultsAdmin} />`}`;
}

/* ---------- administration (Settings) ---------- */
function AdminAccess() {
  const { s, d, D } = useApp(); const [pin, setPin] = useState(''); const [err, setErr] = useState(null);
  return html`<section class="card"><h2 class="section-t"><${Icon} n="shield" s=${18} />Admin access</h2>
    <p class="small" style="margin:0 0 10px">Sign-in is by name only, so it isn’t treated as proof of identity. Role and permission changes, scoring rules, results distribution, finalising a month and data corrections need a step-up check first.</p>
    <div class="chips" style="align-items:center">${D.elevated ? html`<span class="chip good"><${Icon} n="check" s=${12} />Unlocked until ${new Date(s.elevatedUntil).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</span><button class="btn sm" onClick=${() => d({ type: 'lockAdmin' })}>Lock now</button>`
      : html`<span class="chip plain"><${Icon} n="lock" s=${12} />Locked</span><button class="btn sm primary" onClick=${() => requireAdmin(D, d, [{ type: 'toast', msg: 'Admin tools unlocked' }], 'Unlock administrator tools.')}>Unlock admin tools</button>`}</div>
    ${D.elevated ? html`<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:12px"><div style="flex:0 1 220px"><${Text} id="ap-pin" label="New admin PIN" type="password" inputMode="numeric" value=${pin} onChange=${v => setPin(v.replace(/\D/g, '').slice(0, 8))} err=${err} hint="4 to 8 digits" /></div>
      <button class="btn" onClick=${() => { if (pin.length < 4) return setErr('Use 4 to 8 digits.'); setErr(null); d({ type: 'adminPin', pin }); setPin(''); d({ type: 'toast', msg: 'Admin PIN changed' }); }}>Change PIN</button></div>` : null}</section>`;
}
function StoreTypesCard() {
  const { s, d, D } = useApp(); const [nw, setNw] = useState(''); const [ren, setRen] = useState(null);
  const count = n => s.locations.filter(l => storeTypeOf(l) === n && l.status !== 'Removed').length;
  const hist = n => activityAll(s).filter(v => { const l = s.locations.find(x => x.id === v.loc); return l && storeTypeOf(l) === n; }).length + s.locations.filter(l => l.storeType === n).length;
  const set = (list, what) => d({ type: 'storeTypes', storeTypes: list, what });
  return html`<section class="card"><h2 class="section-t"><${Icon} n="store" s=${18} />Store location types</h2>
    <p class="small" style="margin:0 0 10px">The one dropdown for every audit location. Vending gives the vending machine fields; the others use the store fields. Switching a type off removes it from new submissions but keeps it on historical records and in reporting filters.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Type</th><th>Status</th><th class="n">Locations</th>${D.isAdmin ? html`<th><span class="sr">Actions</span></th>` : null}</tr></thead><tbody>${s.ref.storeTypes.map(t => html`<tr key=${t.name}>
      <td>${ren?.from === t.name ? html`<input class="input" aria-label="New name" value=${ren.to} onInput=${e => setRen({ ...ren, to: e.target.value })} />` : html`<b>${t.name}</b>`}</td>
      <td><span class=${'chip ' + (t.active ? 'good' : 'muted')}>${t.active ? 'Available' : 'Retired · history kept'}</span></td><td class="n num">${count(t.name)}${!t.active && !count(t.name) ? html`<div class="xs muted">${hist(t.name) ? hist(t.name) + ' historical' : 'No records'}</div>` : null}</td>
      ${D.isAdmin ? html`<td style="text-align:right;white-space:nowrap">${ren?.from === t.name ? html`<button class="btn sm" onClick=${() => setRen(null)}>Cancel</button> <button class="btn sm primary" disabled=${!ren.to.trim() || s.ref.storeTypes.some(x => x.name.toLowerCase() === ren.to.trim().toLowerCase())} onClick=${() => { d({ type: 'renameStoreType', from: t.name, to: ren.to.trim() }); setRen(null); }}>Save</button>`
        : html`<button class="btn sm" onClick=${() => setRen({ from: t.name, to: t.name })}>Rename</button> <button class=${'btn sm' + (t.active ? ' danger' : '')} onClick=${() => set(s.ref.storeTypes.map(x => (x.name === t.name ? { ...x, active: !x.active } : x)), `${t.active ? 'Retired' : 'Reactivated'} store type ${t.name}`)}>${t.active ? 'Turn off' : 'Turn on'}</button>`}</td>` : null}</tr>`)}</tbody></table></div>
    ${D.isAdmin ? html`<div style="display:flex;gap:8px;margin-top:10px"><input class="input" aria-label="New store location type" value=${nw} onInput=${e => setNw(e.target.value)} placeholder="Add a store location type" />
      <button class="btn" disabled=${!nw.trim() || s.ref.storeTypes.some(x => x.name.toLowerCase() === nw.trim().toLowerCase())} onClick=${() => { set([...s.ref.storeTypes, { name: nw.trim(), active: true }], `Added store type ${nw.trim()}`); setNw(''); }}>Add</button></div>` : null}
    <p class="xs muted" style="margin:10px 0 0">${s.locations.filter(l => !l.storeType).length} locations were classified automatically from the workbook (vending, the NKA flag and bar names; everything else QSR). Check them in Audit Locations with the “To confirm” filter.</p></section>`;
}
function ScoringCard() {
  const { s, d, D } = useApp(); const [f, setF] = useState(() => JSON.parse(JSON.stringify(s.ref.scoring))); const [mode, setMode] = useState(s.ref.approvalMode);
  const sum = MEASURES.reduce((t, m) => t + (+f.weights[m.key] || 0), 0);
  const changed = JSON.stringify(f) !== JSON.stringify(s.ref.scoring) || mode !== s.ref.approvalMode;
  const ok = sum === 100 && +f.minAudits >= 1;
  return html`<section class="card"><h2 class="section-t"><${Icon} n="trophy" s=${18} />Leaderboard scoring</h2>
    <p class="small" style="margin:0 0 12px">Weightings are recommendations to start with. Changes apply to live and in-review months; finalised months keep the rules they were locked with.</p>
    <div class="form-grid">${MEASURES.map(m => html`<${Text} key=${m.key} id=${'w-' + m.key} label=${m.label + ' weight (%)'} type="number" inputMode="numeric" value=${f.weights[m.key]} onChange=${v => setF({ ...f, weights: { ...f.weights, [m.key]: Math.max(0, Math.min(100, +v || 0)) } })} />`)}
      <div class="field"><span class="label">Total</span><b class=${'num'} style=${{ fontSize: '22px', color: sum === 100 ? 'var(--good)' : 'var(--danger-ink)' }}>${sum}%</b><span class="hint">${sum === 100 ? 'Adds up to 100.' : 'Must add up to 100.'}</span></div>
      <div class="field span2"><span class="label">Normalising activity measures</span><${Seg} label="Normalisation" value=${f.method} onChange=${v => setF({ ...f, method: v })} options=${[['relative', 'Relative to the month’s leader'], ['target', 'Against monthly targets']]} /></div>
      ${f.method === 'target' ? MEASURES.filter(m => m.key !== 'ranging').map(m => html`<${Text} key=${'t' + m.key} id=${'t-' + m.key} label=${m.label + ' monthly target'} type="number" value=${f.targets[m.key]} onChange=${v => setF({ ...f, targets: { ...f.targets, [m.key]: Math.max(0, +v || 0) } })} />`) : null}
      <${Text} id="w-min" label="Approved audits needed to be ranked" type="number" value=${f.minAudits} onChange=${v => setF({ ...f, minAudits: Math.max(1, +v || 1) })} />
      <div class="field"><span class="label">When audits count</span><${Seg} label="Approval" value=${mode} onChange=${setMode} options=${[['manager', 'After approval'], ['auto', 'On submit']]} /></div></div>
    ${D.isAdmin ? html`<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn" disabled=${!changed} onClick=${() => { setF(JSON.parse(JSON.stringify(s.ref.scoring))); setMode(s.ref.approvalMode); }}>Undo</button>
      <button class="btn primary" disabled=${!changed || !ok} onClick=${() => requireAdmin(D, d, [{ type: 'scoring', scoring: f, approvalMode: mode }, { type: 'toast', msg: 'Scoring rules saved' }], 'Scoring rules change every Student Marketeer’s score.')}>Save scoring rules</button></div>` : html`<p class="xs muted" style="margin:10px 0 0">Administrators can change these.</p>`}</section>`;
}
function ResultsSettingsCard() {
  const { s, d, D } = useApp(); const [f, setF] = useState(() => JSON.parse(JSON.stringify(s.ref.results))); const [extra, setExtra] = useState('');
  const changed = JSON.stringify(f) !== JSON.stringify(s.ref.results); const rc = recipientsFor(s, f.groups);
  const cand = s.people.filter(p => p.status === 'Active' && p.role === 'manager' && !f.extra.includes(p.name)).map(p => p.name).sort();
  return html`<section class="card"><h2 class="section-t"><${Icon} n="send" s=${18} />Monthly results distribution</h2><div class="form-grid">
    <div class="field span2"><span class="label">Distribution groups</span><div class="chips">${[['leads', 'Education Channel Leads'], ['admins', 'Administrators'], ['sms', 'Student Marketeers']].map(([k, t]) => html`<label key=${k} class="fchip" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" checked=${!!f.groups[k]} onChange=${e => setF({ ...f, groups: { ...f.groups, [k]: e.target.checked } })} />${t}</label>`)}</div><span class="hint">${rc.all.length} people with these settings. Lists come from People, so they stay current.</span></div>
    <div class="field span2"><span class="label">Additional recipients</span><div class="chips">${f.extra.map(n => html`<span key=${n} class="chip plain">${n}<button class="btn ghost sm" style="min-height:0;padding:0 0 0 4px" aria-label=${'Remove ' + n} onClick=${() => setF({ ...f, extra: f.extra.filter(x => x !== n) })}><${Icon} n="x" s=${12} /></button></span>`)}${!f.extra.length ? html`<span class="small muted">None</span>` : null}</div>
      <div style="display:flex;gap:8px;margin-top:6px"><select class="input" aria-label="Add a recipient" value=${extra} onChange=${e => setExtra(e.target.value)}><option value="">Add a manager…</option>${cand.map(n => html`<option key=${n} value=${n}>${n}</option>`)}</select><button class="btn" disabled=${!extra} onClick=${() => { setF({ ...f, extra: [...f.extra, extra] }); setExtra(''); }}>Add</button></div></div>
    <${Select} id="rs-m" label="Communication method" value=${f.method} onChange=${v => setF({ ...f, method: v })} options=${['Email and in-app', 'Email only', 'In-app only', 'Teams post and in-app']} />
    <${Text} id="rs-d" label="Send by business day" type="number" value=${f.businessDay} onChange=${v => setF({ ...f, businessDay: Math.max(1, Math.min(10, +v || 1)) })} hint="After month end; review and approval happen first" />
    <div class="span2"><${Text} id="rs-t" label="Message template" multiline value=${f.template} onChange=${v => setF({ ...f, template: v })} hint="Placeholders: {month} {first} {second} {third} {ranked}" /></div></div>
    ${D.isAdmin ? html`<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn" disabled=${!changed} onClick=${() => setF(JSON.parse(JSON.stringify(s.ref.results)))}>Undo</button><button class="btn primary" disabled=${!changed} onClick=${() => requireAdmin(D, d, [{ type: 'resultsSettings', results: f }, { type: 'toast', msg: 'Distribution settings saved' }], 'Recipient lists decide who sees everyone’s results.')}>Save</button></div>` : null}</section>`;
}
const LOG_CATS = ['Login', 'Activity', 'Approval', 'Correction', 'Score', 'Leaderboard', 'Distribution', 'People', 'Locations', 'Settings'];
const catOf = e => e.cat || (/visit|audit/i.test(e.action) ? 'Activity' : /person|role/i.test(e.action) ? 'People' : /location|institution|removal|state/i.test(e.action) ? 'Locations' : 'Settings');
function AuditHistory() {
  const { s } = useApp(); const [cat, setCat] = useState('all'); const [q, setQ] = useState(''); const [shown, setShown] = useState(40);
  const rows = s.log.filter(e => (cat === 'all' || catOf(e) === cat) && (!q || [e.action, e.target, e.detail, e.user, e.from, e.to].some(x => x && String(x).toLowerCase().includes(q.toLowerCase()))));
  return html`<section class="card"><div class="card-h"><h2>Audit history</h2><span class="chip plain"><${Icon} n="lock" s=${12} />Read-only</span></div>
    <div class="toolbar" style="margin-bottom:10px"><${Select} id="ah-c" label="Type" value=${cat} onChange=${setCat} options=${[['all', 'Everything'], ...LOG_CATS.map(c => [c, c])]} /><div class="field wide" style="flex:1 1 200px"><span class="label">Search</span><${Search} id="ah-q" value=${q} onChange=${setQ} placeholder="Person, record, action" /></div></div>
    ${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th class="hide-m">Before → after</th></tr></thead><tbody>${rows.slice(0, shown).map((e, i) => html`<tr key=${i}><td class="num small" style="white-space:nowrap">${fmtWhen(e.ts)}</td><td class="small">${e.user}</td>
      <td style="min-width:180px"><b class="small">${e.action}</b><span class="chip plain" style="margin-left:6px">${catOf(e)}</span><div class="xs muted">${[e.target, e.detail].filter(Boolean).join(' · ')}</div></td>
      <td class="hide-m xs" style="min-width:200px">${e.from || e.to ? html`<span class="muted">${e.from || '—'}</span> → <b>${e.to || '—'}</b>` : '—'}</td></tr>`)}</tbody></table></div>
      ${rows.length > shown ? html`<div style="text-align:center;margin-top:10px"><button class="btn" onClick=${() => setShown(shown + 60)}>Show more</button></div>` : null}`
      : html`<p class="small muted" style="margin:0">Nothing logged for this filter.</p>`}
    <p class="xs muted" style="margin:10px 0 0">Covers sign-ins, submitted activity, approvals and rejections, score rule changes, corrections, role and permission changes, finalisation, monthly resets and results distribution. Entries can’t be edited or deleted here; production keeps them in a separate append-only table.</p></section>`;
}
function LoginLog() {
  const { s } = useApp(); const rows = (s.logins || []).slice(0, 40);
  return html`<section class="card"><div class="card-h"><h2>Sign-in activity</h2><span class="xs muted">Last ${rows.length}</span></div>
    ${rows.length ? html`<div class="tbl-wrap"><table><thead><tr><th>When</th><th>Name entered</th><th>Result</th></tr></thead><tbody>${rows.map((r, i) => html`<tr key=${i}><td class="num small" style="white-space:nowrap">${fmtWhen(r.ts)}</td><td>${r.name}</td><td><span class=${'chip ' + (r.result === 'Signed in' ? 'good' : 'bad')}>${r.result}</span></td></tr>`)}</tbody></table></div>`
      : html`<p class="small muted" style="margin:0">No sign-ins yet.</p>`}</section>`;
}

/* ======================= SHARED STORAGE (artifact db) =======================
   Model: the workbook data built into the page is the base. The shared database holds every record that has been
   created or changed since (one document per record, the whole record), plus tombstones for deletions.
   Effective data = base overlaid with shared documents. Per-device things (who is signed in, drafts, read markers)
   stay in this browser. Without the db capability the app falls back to this-browser-only storage. */
const SHARED = { people: 'id', locations: 'id', unis: 'code', visits: 'id', snapshots: 'month', requests: 'id', notifications: 'id', log: null, logins: null };
const NO_TOMBSTONE = new Set(['notifications', 'log', 'logins']);
const hashStr = str => { let a = 0x811c9dc5, b = 0x12345; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13); } return (a >>> 0).toString(36) + (b >>> 0).toString(36); };
const keyOf = (col, r) => r._key || (SHARED[col] ? String(r[SHARED[col]]) : String(r.ts || '').replace(/[^0-9]/g, '').slice(0, 17) + '-' + hashStr(JSON.stringify(r)));
const docIdOf = k => String(k).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 190) || '_';
const canon = (r, k) => JSON.stringify({ ...r, _key: k });
const cfgOf = s => ({ states: s.states, leads: s.leads, ref: s.ref, lastMonth: s.lastMonth });
const COL_SORT = {
  notifications: (a, b) => String(b.ts).localeCompare(String(a.ts)), log: (a, b) => String(b.ts).localeCompare(String(a.ts)),
  logins: (a, b) => String(b.ts).localeCompare(String(a.ts)), requests: (a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)),
  snapshots: (a, b) => String(a.month).localeCompare(String(b.month)),
};
function sharedBase() {
  const st = seedState();
  return { people: st.people, locations: st.locations, unis: st.unis, visits: st.visits, snapshots: [], requests: [], notifications: [], log: [], logins: [] };
}
const Sync = {
  db: null, mode: 'pending', base: null, docs: {}, known: {}, knownCfg: null, pending: new Map(), queue: [], busy: false, d: null, last: {}, ready: new Set(), readOnly: false, errors: 0,
  async start(d) {
    this.d = d;
    let db = null; const t0 = Date.now(); const diag = { inClaude: !!(window.claude && typeof window.claude.use === 'function'), framed: window.top !== window.self };
    try { db = diag.inClaude ? await window.claude.use('db') : null; } catch (e) { db = null; diag.error = String(e && (e.code || e.message) || e); }
    diag.ms = Date.now() - t0;
    if (!db) {
      if (diag.inClaude) { try { const perms = await window.claude.use('permissions'); if (perms) { diag.perm = await perms.state('db'); this.perms = perms; } } catch (e) { } }
      this.mode = 'local'; d({ type: 'sync', sync: { mode: 'local', diag } }); return; }
    this.db = db; this.mode = 'shared'; this.base = sharedBase();
    try { const user = await window.claude.use('user'); const can = user && user.can ? await user.can('data.write') : null; if (can === false) this.readOnly = true; } catch (e) { }
    Object.keys(SHARED).forEach(c => { this.docs[c] = new Map(); this.known[c] = new Map(); this.base[c].forEach(r => { const k = keyOf(c, r); this.known[c].set(k, canon(r, k)); }); });
    d({ type: 'sharedInit', base: this.base, sync: { mode: 'shared', status: 'connecting', readOnly: this.readOnly } });
    Object.keys(SHARED).forEach(c => {
      db.collection(c).onSnapshot(snap => this.onCol(c, snap), e => this.onErr(e));
    });
    db.doc('config/main').onSnapshot(snap => {
      if (snap.exists) { const body = snap.data(); this.knownCfg = JSON.stringify({ states: body.states, leads: body.leads, ref: body.ref, lastMonth: body.lastMonth });
        if (!this.pending.has('config|main')) d({ type: 'remoteConfig', cfg: body }); }
      this.markReady('config');
    }, e => this.onErr(e));
  },
  onErr(e) { this.errors++; this.d({ type: 'sync', sync: { status: 'error', code: e && e.code } }); },
  markReady(c) {
    if (this.ready.has(c)) return; this.ready.add(c);
    if (this.ready.size === Object.keys(SHARED).length + 1) this.d({ type: 'sharedReady' });
  },
  onCol(c, snap) {
    const m = new Map();
    snap.docs.forEach(doc => { const b = doc.data(); if (!b) return; const k = b._key || doc.id; m.set(k, b); });
    this.docs[c] = m;
    m.forEach((b, k) => { if (!this.pending.has(c + '|' + k)) this.known[c].set(k, b._deleted ? 'DELETED' : canon(b, k)); });
    this.d({ type: 'remote', col: c, arr: this.build(c) });
    this.markReady(c);
  },
  build(c) {
    const out = []; const seen = new Set(); const docs = this.docs[c];
    const pick = k => (this.pending.has(c + '|' + k) ? this.pending.get(c + '|' + k) : docs.get(k));
    for (const r of this.base[c]) { const k = keyOf(c, r); seen.add(k); const b = pick(k); if (b === undefined) out.push(r); else if (!b._deleted) out.push(b); }
    for (const k of docs.keys()) if (!seen.has(k)) { seen.add(k); const b = pick(k); if (b && !b._deleted) out.push(b); }
    for (const [pk, b] of this.pending) { const i = pk.indexOf('|'); const pc = pk.slice(0, i), k = pk.slice(i + 1); if (pc === c && !seen.has(k)) { seen.add(k); if (!b._deleted) out.push(b); } }
    return COL_SORT[c] ? out.sort(COL_SORT[c]) : out;
  },
  /** Called after every state change in shared mode: writes what changed, one document per changed record. */
  diff(s) {
    if (this.mode !== 'shared' || !s.sharedLoaded) return;
    for (const c of Object.keys(SHARED)) {
      if (s[c] === this.last[c]) continue; this.last[c] = s[c];
      const kn = this.known[c]; const present = new Set();
      for (const r of s[c] || []) { const k = keyOf(c, r); present.add(k); const j = canon(r, k); if (kn.get(k) !== j) { kn.set(k, j); this.enqueue(c, k, { ...r, _key: k }); } }
      if (!NO_TOMBSTONE.has(c)) for (const [k, v] of kn) if (!present.has(k) && v !== 'DELETED') { kn.set(k, 'DELETED'); this.enqueue(c, k, { _deleted: true, _key: k }); }
    }
    const cfg = cfgOf(s); if (cfg.states !== this.last.cfgStates || cfg.leads !== this.last.cfgLeads || cfg.ref !== this.last.cfgRef || cfg.lastMonth !== this.last.cfgMonth) {
      this.last.cfgStates = cfg.states; this.last.cfgLeads = cfg.leads; this.last.cfgRef = cfg.ref; this.last.cfgMonth = cfg.lastMonth;
      const j = JSON.stringify(cfg); if (this.knownCfg === null) { this.knownCfg = j; } // no shared config yet: today's defaults are the baseline
      else if (j !== this.knownCfg) { this.knownCfg = j; this.enqueue('config', 'main', JSON.parse(j)); }
    }
  },
  enqueue(c, k, body) {
    if (this.readOnly) return;
    const pk = c + '|' + k; const had = this.pending.has(pk); this.pending.set(pk, body);
    if (!had) this.queue.push(pk); this.flush();
  },
  async flush() {
    if (this.busy) return; this.busy = true; let failed = 0;
    this.d({ type: 'sync', sync: { status: 'saving', queued: this.queue.length } });
    while (this.queue.length) {
      const pk = this.queue.shift(); const body = this.pending.get(pk); const i = pk.indexOf('|'); const c = pk.slice(0, i), k = pk.slice(i + 1);
      const ref = c === 'config' ? this.db.doc('config/main') : this.db.collection(c).doc(docIdOf(k));
      try { await ref.set(body); }
      catch (e) {
        if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); try { await ref.set(body); } catch (e2) { failed++; } }
        else { failed++; if (e && e.code === 'invalid_argument') { this.readOnly = true; this.d({ type: 'sync', sync: { readOnly: true } }); } }
        if (e && e.code === 'quota_exceeded') this.d({ type: 'toast', msg: 'Shared storage is full. Ask an administrator to clear old log entries.' });
      }
      if (this.pending.get(pk) === body) this.pending.delete(pk); else this.queue.push(pk);
    }
    this.busy = false;
    this.d({ type: 'sync', sync: { status: failed ? 'error' : 'live', queued: 0, lastSaved: new Date().toISOString() } });
    if (failed) this.d({ type: 'toast', msg: `${failed} change${failed > 1 ? 's' : ''} couldn’t be saved to shared storage` });
  },
};
function SyncHelp({ onClose }) {
  const { s } = useApp(); const g = (s.sync && s.sync.diag) || {}; const [msg, setMsg] = useState(null);
  const why = !g.inClaude ? 'This copy of the ECA is a file opened outside claude.ai (for example from the handover pack, or the page opened on its own). Shared storage only exists inside claude.ai.'
    : g.perm === 'denied' ? 'Shared storage is switched off for this page in your browser. Turn it back on below.'
    : g.perm === 'prompt' ? 'This page hasn’t been given permission to use its shared storage yet.'
    : g.ms > 9000 ? 'claude.ai didn’t answer in time, which usually means the page was opened in a view that can’t use shared storage (a preview, or the page opened on its own outside the claude.ai viewer).'
    : 'claude.ai didn’t give this view access to shared storage. This happens when you aren’t signed in, the page is opened outside the claude.ai viewer, or your organisation hasn’t enabled shared storage for artifacts.';
  const turnOn = async () => { try { const r = Sync.perms ? await Sync.perms.request(['db', 'user']) : null; if (r && r.db === 'granted') { setMsg('Done. Reloading…'); setTimeout(() => location.reload(), 600); } else setMsg('It’s still off. Use “Open permissions” instead.'); } catch (e) { setMsg('Couldn’t ask from here. Use “Open permissions” instead.'); } };
  const manage = async () => { try { await Sync.perms.manage(); setMsg('Reload the page if you switched it on.'); } catch (e) { setMsg('The permissions panel didn’t open. Use the artifact’s own Permissions menu at the top of the page.'); } };
  return html`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-h" style="width:min(520px,100%)"><div class="sheet-h"><h2 id="sh-h">Not connected to shared storage</h2><button class="iconbtn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-b"><p style="margin:0">${why}</p><p class="small" style="margin:0">Until it connects, anything you enter stays on this device only.</p>
      <ol class="small" style="margin:0;padding-left:18px"><li>Open <b>https://claude.ai/artifact/2nPXWsUqTj39JeDkpjSRms</b> in Chrome or Edge, signed in to claude.ai with your Red Bull account.</li><li>If a box asks to let the page use its data, choose Allow.</li><li>Reload the page. The chip should turn green: <b>Live · shared</b>.</li></ol>
      ${msg ? html`<div class="banner info"><div>${msg}</div></div>` : null}
      <p class="xs muted" style="margin:0">Details for support: in claude.ai ${g.inClaude ? 'yes' : 'no'} · framed ${g.framed ? 'yes' : 'no'} · permission ${g.perm || 'unknown'} · answered in ${g.ms ?? '—'} ms${g.error ? ' · ' + g.error : ''}</p></div>
    <div class="sheet-f">${Sync.perms ? html`<button class="btn" onClick=${manage}>Open permissions</button><button class="btn" onClick=${turnOn}>Turn on shared storage</button>` : null}<button class="btn primary" onClick=${() => location.reload()}>Reload</button></div></div>`;
}
const SyncChip = () => {
  const { s, d } = useApp(); const y = s.sync || {};
  if (y.mode === 'local') return html`<button class="chip warn" style="cursor:pointer" title="Why? Click for details" onClick=${() => d({ type: 'modal', modal: { kind: 'syncHelp' } })}>This browser only</button>`;
  if (y.mode !== 'shared') return html`<span class="chip plain">Connecting…</span>`;
  if (y.readOnly) return html`<span class="chip warn" title="You can view but not save. Ask the owner for Contributor access.">View only</span>`;
  if (!s.sharedLoaded || y.status === 'connecting') return html`<span class="chip plain">Loading shared data…</span>`;
  if (y.status === 'saving') return html`<span class="chip plain">Saving…</span>`;
  if (y.status === 'error') return html`<span class="chip bad">Not saved</span>`;
  return html`<span class="chip good" title="Everyone sees the same data, live"><${Icon} n="check" s=${12} w=${2.4} />Live · shared</span>`;
};

/* ======================= APP ======================= */
function App() {
  const [s, d] = useReducer(reducer, null, () => { const saved = DataService.load(); if (!saved) return seedState();
    const people = [...(saved.people || [])];
    const stale = (saved.rosterRev || 0) < ROSTER_REV;
    seedPeople().forEach(sp => { const i = people.findIndex(x => x.name.toLowerCase() === sp.name.toLowerCase());
      if (i < 0) people.push({ ...sp, id: 'P' + Date.now().toString(36) + people.length });
      else if (stale && sp.role === 'marketeer' && sp.reportsTo) people[i] = { ...people[i], role: 'marketeer', state: sp.state, reportsTo: sp.reportsTo }; });
    const base = seedState();
    // Name corrections: renames people already saved in this browser, and every record that names them
    Object.entries(NAME_FIXES).forEach(([from, to]) => { if (!(saved.people || []).some(p => p.name === from)) return;
      const fx = n => (n === from ? to : n);
      people.forEach((p, i) => { if (p.name === from) people[i] = { ...p, name: to }; });
      const dupI = people.findIndex((p, i) => p.name === to && people.findIndex(x => x.name === to) !== i); if (dupI >= 0) people.splice(dupI, 1);
      saved.visits = (saved.visits || []).map(v => ({ ...v, staff: fx(v.staff), submittedBy: fx(v.submittedBy) }));
      saved.demo = (saved.demo || []).map(v => ({ ...v, staff: fx(v.staff), submittedBy: fx(v.submittedBy) }));
      saved.snapshots = (saved.snapshots || []).map(sn => ({ ...sn, rows: sn.rows.map(r => ({ ...r, name: fx(r.name) })) }));
      saved.drafts = (saved.drafts || []).map(x => ({ ...x, staff: fx(x.staff), owner: fx(x.owner) }));
      saved.notifications = (saved.notifications || []).map(n => ({ ...n, to: (n.to || []).map(fx) }));
      if (saved.me === from) saved.me = to;
      saved.log = [{ ts: new Date().toISOString(), user: 'System', cat: 'People', action: 'Corrected name', target: to, from, to }, ...(saved.log || [])]; });
    let st = { ...base, ...saved, people, ref: { ...DEFAULT_REF, ...(saved.ref || {}) }, rosterRev: ROSTER_REV, toast: null, modal: null, notifOpen: false };
    if (!saved.ecaRev) st = { ...st, ecaRev: 1, authed: false, demo: base.demo, snapshots: base.snapshots, logins: [], lastMonth: curMonth(),
      log: [{ ts: new Date().toISOString(), user: 'System', cat: 'Settings', action: 'Upgraded to Education Channel Audit Tool (ECA)', target: 'ECA', detail: 'Store types assigned, leaderboard and approvals added' }, ...(saved.log || [])] };
    if ((st.ecaRev || 0) < 2) st = { ...st, ecaRev: 2, ref: { ...st.ref, storeTypes: DEFAULT_REF.storeTypes },
      log: [{ ts: new Date().toISOString(), user: 'System', cat: 'Settings', action: 'Store location types set', target: 'Store location types', from: (saved.ref?.storeTypes || []).map(t => t.name).join(', '), to: DEFAULT_REF.storeTypes.map(t => t.name).join(', ') }, ...st.log] };
    if ((st.ecaRev || 0) < 3) { const lb = Object.fromEntries((st.locations || []).map(l => [l.id, l])); st = { ...st, ecaRev: 3, demo: (st.demo || []).map(v => demoFacings(v, lb[v.loc])) }; }
    const newUnis = EXTRA_UNIS.filter(u => !(st.unis || []).some(x => x.code === u.code));
    if (newUnis.length) st = { ...st, unis: [...st.unis, ...newUnis],
      log: [{ ts: new Date().toISOString(), user: 'System', cat: 'Institutions', action: 'Added universities and TAFEs', target: newUnis.map(u => u.state).filter((x, i, a) => a.indexOf(x) === i).join(', '), detail: newUnis.map(u => u.short).join(', ') }, ...st.log] };
    return rollMonths(st); });
  useEffect(() => { Sync.start(d); }, []);
  useEffect(() => { Sync.diff(s); });
  useEffect(() => { DataService.save(s); }, [s.locations, s.visits, s.people, s.unis, s.drafts, s.log, s.ref, s.me, s.meId, s.authed, s.requests, s.notifications, s.readKeys, s.states, s.leads, s.rosterRev, s.demo, s.snapshots, s.logins, s.lastMonth, s.elevatedUntil]);
  useEffect(() => { if (s.toast) { const t = setTimeout(() => d({ type: 'toast', msg: null }), 3200); return () => clearTimeout(t); } }, [s.toast]);
  useEffect(() => { window.scrollTo(0, 0); }, [s.route]);
  useEffect(() => { const h = (location.hash || '').slice(1); if (['dashboard', 'leaderboard', 'visits', 'universities', 'locations', 'progress', 'people', 'settings', 'audit', 'notifications'].includes(h)) d({ type: 'nav', route: { page: h } }); }, []);
  useEffect(() => { document.title = s.authed ? `${{ dashboard: 'Dashboard', leaderboard: 'National Leaderboard', visits: 'My Visits', progress: 'Progress', settings: 'Settings', people: 'People', notifications: 'Notifications' }[s.route.page] || 'Audit'} · ${ECA}` : `Sign in · ${ECA}`; }, [s.route.page, s.authed]);
  const D = useDerived(s);
  if (!s.authed) return html`<${Ctx.Provider} value=${{ s, d, D }}><${Login} />${s.toast ? html`<div class="toast" role="status">${s.toast}</div>` : null}<//>`;
  const page = s.route.page; const key = JSON.stringify(s.route);
  const view = page === 'dashboard' ? html`<${Dashboard} />` : page === 'visits' ? html`<${MyVisits} />` : page === 'universities' ? html`<${Universities} />` : page === 'uni' ? html`<${UniDetail} />`
    : page === 'locations' ? html`<${Locations} />` : page === 'loc' ? html`<${LocationDetail} />` : page === 'audit' ? html`<${Audit} key=${key} />` : page === 'progress' ? html`<${Progress} />`
    : page === 'notifications' ? html`<${Notifications} />` : page === 'people' ? html`<${People} />` : page === 'leaderboard' ? html`<${Leaderboard} key=${s.route.tab || 'm'} />` : html`<${Settings} />`;
  return html`<${Ctx.Provider} value=${{ s, d, D }}><${Shell}><${React.Fragment} key=${s.me}>${view}<//><//><//>`;
}
ReactDOM.createRoot(document.getElementById('app')).render(html`<${App} />`);
