const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error' && !/key/.test(m.text())) errs.push(m.text()); });
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 await p.fill('#li-f','Phillip'); await p.fill('#li-l','Petinella'); await p.click('button[type=submit]'); await p.waitForTimeout(500);
 const inc = async (id, n) => { for (let i=0;i<n;i++) await p.locator('#'+id).locator('..').locator('button').last().click(); };
 const audit = async (uni, loc) => {
   await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300);
   await p.selectOption('#a-uni', uni); await p.waitForTimeout(150); await p.selectOption('#a-loc', loc); await p.waitForTimeout(200);
   if (!(await p.inputValue('#a-staff'))) await p.selectOption('#a-staff', { index: 1 });
   await p.fill('#a-cn', 'Sam Store');
   await p.locator('.stepper button').nth(1).click(); await p.waitForTimeout(150);
   for (const fld of await p.locator('.field').filter({ has: p.locator('[id^="yn-"]') }).all()) { const sel = await fld.locator('button[aria-pressed="true"]').count(); if (!sel) await fld.locator('button', { hasText: 'Yes' }).click(); }
   await p.locator('.stepper button').nth(2).click(); await p.waitForTimeout(150);
 };
 // QSR
 await audit('MON', 'MON-004');
 console.log('preselected:', await p.locator('.fchip[aria-pressed=true]').allInnerTexts());
 if (!(await p.locator('.fchip[aria-pressed=true]', { hasText: 'V' }).count())) await p.locator('.fchip', { hasText: /^\+ V$/ }).click();
 await p.fill('#a-newc', 'Prime'); await p.locator('button', { hasText: 'Add competitor' }).click(); await p.waitForTimeout(150);
 await inc('a-rbf', 4); await inc('a-cf-Monster', 6); await p.fill('#a-cfp-Monster', '3.20'); await inc('a-cfpos-Monster', 2); await inc('a-cfcool-Monster', 1);
 await inc('a-cf-Prime', 2); await p.fill('#a-cfp-Prime', '4.5');
 console.log('cards:', await p.locator('.card.flat h3').allInnerTexts());
 await p.screenshot({ path: 'out/c_step3.png', fullPage: true });
 await p.locator('.stepper button').nth(5).click(); await p.waitForTimeout(200);
 console.log('review errs:', await p.locator('.banner.bad li').allInnerTexts());
 await p.screenshot({ path: 'out/c_review.png', fullPage: true });
 await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
 let r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const v = s.visits.at(-1); const l = s.locations.find(x=>x.id===v.loc); return { loc: v.loc, cf: v.compFacings, cd: v.compDetail, pos: v.compPos, cool: v.compCoolers, top: [l.topComp, l.compPrice], lcd: l.compDetail }; });
 console.log('QSR saved:', JSON.stringify(r));
 const t = await p.locator('body').innerText(); console.log('location page shows:', t.includes('Monster: 6 facings · $3.20 · 2 POS · 1 cooler'), t.includes('Prime: 2 facings · $4.50'));
 // Vending
 const vl = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const l = s.locations.find(x => x.type==='Vending' && x.status==='Active'); return [l.uni, l.id]; });
 await audit(vl[0], vl[1]);
 await p.locator('.fchip', { hasText: 'Monster' }).click().catch(()=>{}); await p.waitForTimeout(100);
 if (!(await p.locator('#a-cf-Monster').count())) await p.locator('.fchip', { hasText: 'Monster' }).click();
 await p.locator('.fchip', { hasText: 'Celsius' }).click(); await inc('a-cf-Monster', 3); await inc('a-cf-Celsius', 1); await inc('a-rbf', 5);
 console.log('vending POS/cooler fields:', await p.locator('[id^="a-cfpos-"], [id^="a-cfcool-"]').count());
 await p.screenshot({ path: 'out/c_vend.png', fullPage: true });
 await p.locator('.stepper button').nth(5).click(); await p.waitForTimeout(150); console.log('vend review errs:', await p.locator('.banner.bad li').allInnerTexts());
 await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
 r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const v = s.visits.at(-1); return { cf: v.compFacings, rb: v.rbFacings }; });
 console.log('Vending saved:', JSON.stringify(r));
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
