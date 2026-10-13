// Hi5 audit changes: four-product listing (no competitor ranging), Hi5 KPIs, where they buy Red Bull from, additional visibility tools.
const { chromium } = require('playwright'); const { signIn } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/key/.test(m.text())) errs.push(m.text()); });
  let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
  const sm = await p.evaluate(() => JSON.parse(localStorage.getItem('edu-audit-national-v2')).people.find(x => x.role === 'marketeer' && x.state === 'VIC').name);
  const [fn, ...ln] = sm.split(' '); await signIn(p, fn, ln.join(' ')); await p.waitForTimeout(400);
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('edu-audit-national-v2')));
  const step = i => p.locator('.stepper button').nth(i).click().then(() => p.waitForTimeout(150));
  const yn = async (id, text) => { await p.locator('.field', { has: p.locator('#' + id) }).locator('button', { hasText: text }).click(); };
  const errsOnReview = async () => { await step(5); return (await p.locator('.banner.bad li').allInnerTexts()).join(' | '); };
  const start = async loc => { await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300); const uni = await p.evaluate(l => JSON.parse(localStorage.getItem('edu-audit-national-v2')).locations.find(x => x.id === l).uni, loc);
    await p.selectOption('#a-uni', uni); await p.waitForTimeout(150); await p.selectOption('#a-loc', loc); await p.waitForTimeout(200); if (!(await p.inputValue('#a-staff'))) await p.selectOption('#a-staff', { index: 1 }); await p.fill('#a-cn', 'Sam Store'); };

  // ---- store audit
  await start('MON-001'); await step(1);
  const ids = await p.locator('[id^="yn-"]').evaluateAll(els => els.map(e => e.id));
  check(JSON.stringify(ids.slice(0, 4)) === JSON.stringify(['yn-ed', 'yn-sf', 'yn-zero', 'yn-editions']), 'listing must be ED, SF, Zero, Editions: ' + ids);
  check(!ids.some(i => /^yn-(monster|monsterUltra|v|vsf|vblue|solo)$/.test(i)), 'competitor ranging questions must be gone: ' + ids);
  check(['yn-placement', 'yn-visibility', 'yn-activation'].every(i => ids.includes(i)), 'Hi5 questions must be shown');
  check(!(await p.locator('h3', { hasText: 'Competitors' }).count()), 'no Competitors heading in step 2');
  // availability = ED + (SF or Zero) + Editions
  const avail = async () => (await p.locator('.chip', { hasText: 'Availability:' }).first().innerText()).trim();
  await yn('yn-ed', 'Yes'); await yn('yn-sf', 'No'); await yn('yn-zero', 'No'); await yn('yn-editions', 'Yes'); check((await avail()).includes('Not met'), 'ED + Editions without a low-cal is not Availability');
  await yn('yn-zero', 'Yes'); check((await avail()).includes('Met') && !(await avail()).includes('Not'), 'ED + Zero + Editions is Availability');
  await yn('yn-zero', 'No'); await yn('yn-sf', 'Yes'); check((await avail()).includes('Met') && !(await avail()).includes('Not'), 'ED + SF + Editions is Availability');
  // validation
  let e = await errsOnReview();
  check(/Perfect Placement/.test(e) && /Perfect Visibility/.test(e) && /Consumption Activation/.test(e) && /where they buy Red Bull/.test(e), 'unanswered Hi5 questions must block submit: ' + e);
  await step(1); await yn('yn-placement', 'Yes'); await yn('yn-visibility', 'No'); await yn('yn-activation', 'Yes');
  await step(2); await p.fill('#a-price', ''); // activation needs pricing
  e = await errsOnReview(); check(/needs pricing/.test(e), 'Consumption Activation without a price must be refused: ' + e);
  await step(2); await p.fill('#a-price', '3.80'); await p.locator('.field', { has: p.locator('#a-src-l') }).locator('button', { hasText: 'Distributor' }).click();
  check(await p.locator('#a-dist').count() === 1, 'distributor name field must appear');
  e = await errsOnReview(); check(/distributor name/i.test(e), 'a distributor needs a name: ' + e);
  await step(2); await p.fill('#a-dist', 'Acme Beverages'); await p.locator('.field', { has: p.locator('#a-src-l') }).locator('button', { hasText: 'Retail' }).click(); check(await p.locator('#a-dist').count() === 0, 'retail must hide the distributor name');
  await p.locator('.field', { has: p.locator('#a-src-l') }).locator('button', { hasText: 'Distributor' }).click(); check(await p.inputValue('#a-dist') === 'Acme Beverages', 'the distributor name is kept while switching');
  // visibility tools
  const toolNames = await p.locator('#a-vt-l').locator('..').locator('.fchip').allInnerTexts(); check(['Can glorifier', 'Window decals', 'Ambient display'].every(t => toolNames.some(x => x.includes(t))), 'default tools: ' + toolNames);
  await p.locator('.fchip', { hasText: 'Window decals' }).click(); await p.fill('#a-newtool', 'A-frame'); await p.locator('button', { hasText: 'Add tool' }).click(); await p.waitForTimeout(100);
  check((await p.locator('.fchip[aria-pressed=true]', { hasText: 'A-frame' }).count()) === 1 && (await p.locator('.fchip[aria-pressed=true]', { hasText: 'Window decals' }).count()) === 1, 'tools must be selectable and addable');
  // win vs comp
  const win = async () => (await p.locator('.chip', { hasText: 'Win vs Comp:' }).first().innerText()).trim();
  await p.locator('.fchip', { hasText: 'Monster' }).click().catch(() => {}); await p.waitForTimeout(100);
  if (!(await p.locator('#a-cf-Monster').count())) await p.locator('.fchip', { hasText: /^\+ Monster$/ }).click();
  const inc = async (id, n) => { for (let i = 0; i < n; i++) await p.locator('#' + id).locator('..').locator('button').last().click(); };
  await inc('a-rbf', 3); await inc('a-cf-Monster', 4); check((await win()).includes('Not met'), 'fewer facings than the top competitor is not a win: ' + await win());
  await inc('a-rbf', 3); check((await win()).includes('Met') && !(await win()).includes('Not'), 'more facings than the top competitor is a win: ' + await win());
  await step(5); const rev = await p.locator('section.card').last().innerText(); check(/Hi5 KPIs/.test(rev) && /Acme Beverages/.test(rev) && /A-frame/.test(rev), 'review must show Hi5, distributor and tools');
  check((await p.locator('.banner.bad').count()) === 0, 'no errors left: ' + await p.locator('.banner.bad').allInnerTexts());
  await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
  let st = await state(); let v = st.visits.at(-1); let l = st.locations.find(x => x.id === 'MON-001');
  check(JSON.stringify(v.hi5) === JSON.stringify({ availability: 1, placement: 1, visibility: 0, activation: 1, win: 1 }), 'visit Hi5 result: ' + JSON.stringify(v.hi5));
  check(v.response.placement === 1 && v.response.visibility === 0 && v.response.activation === 1 && v.response.buySource === 'Distributor' && v.response.distributor === 'Acme Beverages', 'visit answers saved');
  check(JSON.stringify(v.response.visTools) === JSON.stringify(['Window decals', 'A-frame']), 'visit tools saved: ' + JSON.stringify(v.response.visTools));
  check(Object.keys(v.response.ranging).every(k => ['ed', 'sf', 'zero', 'editions'].includes(k)), 'a new audit saves only the four listed products: ' + Object.keys(v.response.ranging));
  check(Object.keys(l.ranging).includes('monster') && l.ranging.ed === 1, 'old competitor ranging on the location is kept');
  check(l.hi5 && l.hi5.activation === 1 && l.buySource === 'Distributor' && (l.visTools || []).length === 2, 'location keeps the latest Hi5 picture');
  const body = await p.locator('body').innerText(); check(/Hi5 KPIs/.test(body) && /Acme Beverages/.test(body) && /A-frame/.test(body), 'location page shows Hi5');
  // prefill on the next audit
  await start('MON-001'); await step(1); await p.waitForTimeout(100);
  check(await p.locator('.field', { has: p.locator('#yn-placement') }).locator('button[aria-pressed=true]').innerText() === 'Yes', 'Hi5 answers start from the last audit');
  await step(2); check(await p.inputValue('#a-dist') === 'Acme Beverages' && (await p.locator('.fchip[aria-pressed=true]', { hasText: 'A-frame' }).count()) === 1, 'source and tools start from the last audit');

  // ---- vending: no Hi5, no competitor ranging, still submits
  const vl = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const l = s.locations.find(x => x.type === 'Vending' && x.status === 'Active'); return [l.uni, l.id]; });
  await p.locator('.audit-foot button.ghost').click().catch(() => {}); await p.waitForTimeout(150);
  await p.locator('.inline-confirm button', { hasText: /^Leave$/ }).click().catch(() => {}); await p.waitForTimeout(200);
  await start(vl[1]); await step(1);
  const vids = await p.locator('[id^="yn-"]').evaluateAll(els => els.map(e => e.id)); check(!vids.includes('yn-placement') && !vids.some(i => /^yn-(monster|monsterUltra|v|vsf|vblue|solo)$/.test(i)), 'vending has no Hi5 or competitor ranging: ' + vids);
  for (const id of vids) await yn(id, 'Yes'); await step(2); await p.locator('#a-cf-l').count();
  await step(5); check((await p.locator('.banner.bad').count()) === 0, 'vending audit needs none of the Hi5 answers: ' + await p.locator('.banner.bad').allInnerTexts());
  await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
  v = (await state()).visits.at(-1); check(v.loc === vl[1] && v.hi5 === null, 'vending visit has no Hi5 result');

  // ---- admin can edit the tool list and it appears in the audit
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.authed = false; s.meId = null; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(500);
  await signIn(p, 'Hudson', 'Ayoubi'); await p.setViewportSize({ width: 1280, height: 900 }); await p.click('.rail >> text=Settings'); await p.waitForTimeout(250);
  await p.fill('[aria-label="Add to Additional visibility tools"]', 'Fridge branding'); await p.locator('.field', { has: p.locator('[aria-label="Add to Additional visibility tools"]') }).locator('button', { hasText: 'Add' }).click(); await p.waitForTimeout(150);
  check((await state()).ref.visTools.includes('Fridge branding'), 'admin can add a visibility tool in Settings');
  await b.close(); console.log(errs.length || bad ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); })();
