// Only the store's newest audit may set its latest picture and contact: editing or backdating an older audit leaves them alone.
const { chromium } = require('playwright'); const { signIn } = require('./lib-login'); const { answerHi5Step3 } = require('./lib-audit');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/key/.test(m.text())) errs.push(m.text()); });
  let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700); await signIn(p, 'Hudson', 'Ayoubi'); await p.waitForTimeout(400);
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('edu-audit-national-v2')));
  const loc = async () => (await state()).locations.find(x => x.id === 'MON-001');
  const step = i => p.locator('.stepper button').nth(i).click().then(() => p.waitForTimeout(150));
  const yesAll = async () => { for (const fld of await p.locator('.field').filter({ has: p.locator('[id^="yn-"]') }).all()) if (!(await fld.locator('button[aria-pressed="true"]').count())) await fld.locator('button', { hasText: 'Yes' }).click(); };
  // fill and submit an audit of MON-001 on a given date with a contact and price
  const audit = async (date, contact, price) => {
    await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300);
    await p.locator('[aria-label="State"] button', { hasText: 'VIC' }).click().catch(() => {}); await p.waitForTimeout(100);
    await p.selectOption('#a-uni', 'MON'); await p.waitForTimeout(150); await p.selectOption('#a-loc', 'MON-001'); await p.waitForTimeout(200);
    if (!(await p.inputValue('#a-staff'))) await p.selectOption('#a-staff', { index: 1 });
    await p.fill('#a-date', date); await p.fill('#a-cn', contact);
    await step(1); await yesAll(); await step(2); await p.fill('#a-price', price); await answerHi5Step3(p, { price });
    await step(5); await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500); };
  await audit('2026-10-10T10:00', 'First Contact', '3.50');
  let l = await loc(); check(l.contactName === 'First Contact' && +l.price === 3.5, 'first audit sets the store: ' + l.contactName + ' ' + l.price);
  await audit('2026-10-12T10:00', 'Second Contact', '4.20');
  l = await loc(); check(l.contactName === 'Second Contact' && +l.price === 4.2 && l.contactAt === '2026-10-12', 'newer audit sets the store: ' + l.contactName + ' ' + l.price);

  // edit the OLDER audit: the visit changes, the store does not
  const editVisit = async (date, newContact, newPrice) => {
    await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(200);
    await p.locator('.rail >> text=Universities').first().click(); await p.waitForTimeout(250); await p.locator('.ucard', { hasText: 'Monash' }).first().click(); await p.waitForTimeout(250);
    await p.locator('.tabs button', { hasText: 'Visits' }).click(); await p.waitForTimeout(200);
    await p.locator('tr.click', { hasText: date }).first().click(); await p.waitForTimeout(250); await p.locator('button', { hasText: 'Edit visit' }).click(); await p.waitForTimeout(300);
    await step(0); await p.fill('#a-cn', newContact); await step(2); await p.fill('#a-price', newPrice); await step(5); await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); };
  await editVisit('10 Oct', 'Edited Old', '9.99');
  let st = await state(); const first = st.visits.filter(v => v.loc === 'MON-001' && v.date === '2026-10-10').at(-1); l = await loc();
  check(first.contactName === 'Edited Old' && +first.response.price === 9.99, 'the older visit itself is updated: ' + first.contactName + ' ' + first.response.price);
  check(l.contactName === 'Second Contact' && +l.price === 4.2 && l.contactAt === '2026-10-12', 'editing an older audit must not change the store: ' + l.contactName + ' ' + l.price);

  // a backdated NEW audit also leaves the store alone
  await audit('2026-10-01T10:00', 'Backdated Contact', '2.10');
  l = await loc(); check(l.contactName === 'Second Contact' && +l.price === 4.2, 'a backdated audit must not change the store: ' + l.contactName + ' ' + l.price);
  check((await state()).visits.some(v => v.loc === 'MON-001' && v.contactName === 'Backdated Contact'), 'the backdated visit is still saved');

  // editing the NEWEST audit still updates the store
  await editVisit('12 Oct', 'Second Edited', '5.00');
  l = await loc(); check(l.contactName === 'Second Edited' && +l.price === 5, 'editing the newest audit must update the store: ' + l.contactName + ' ' + l.price);
  await b.close(); console.log(errs.length || bad ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); })();
