const { chromium } = require('playwright'); const { signIn } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error' && !/key/.test(m.text())) errs.push(m.text()); });
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 const sm = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); return s.people.find(x => x.role==='marketeer' && x.state==='VIC').name; });
 const [fn, ...ln] = sm.split(' '); await signIn(p, fn, ln.join(' ')); await p.waitForTimeout(500);
 console.log('SM:', sm);
 await p.evaluate(() => {}); 
 await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300);
 await p.selectOption('#a-uni', 'MON'); await p.waitForTimeout(150);
 await p.selectOption('#a-loc', 'MON-001'); await p.waitForTimeout(200);
 await p.screenshot({ path: 'out/f_step1.png', fullPage: true });
 // validation: bad phone
 await p.fill('#a-cn', ''); await p.fill('#a-cph', '12'); await p.fill('#a-cem', 'nope');
 // jump to review
 for (let i=0;i<5;i++) { await p.locator('.audit-foot button', { hasText: 'Next' }).click(); await p.waitForTimeout(120); }
 console.log('errors on review:', await p.locator('.banner.bad li').allInnerTexts());
 await p.locator('.stepper button').first().click(); await p.waitForTimeout(150);
 await p.fill('#a-cn', 'Frank Grafali'); await p.selectOption('#a-cr', 'Owner'); await p.fill('#a-cph', '0412 345 678'); await p.fill('#a-cem', 'frank@grafalis.com.au');
 await p.locator('.stepper button').nth(1).click(); await p.waitForTimeout(200);
 const segs = p.locator('[aria-labelledby], .seg'); await p.locator('.field', { has: p.locator('#yn-zero') }).locator('button', { hasText: 'Yes' }).click();
 await p.locator('.stepper button').nth(2).click(); await p.waitForTimeout(200);
 console.log('preselected comps:', await p.locator('.fchip[aria-pressed=true]').allInnerTexts());
 await p.locator('#a-rbf').locator('..').locator('button').last().click(); for (let i=0;i<5;i++) await p.locator('#a-rbf').locator('..').locator('button').last().click();
 await p.locator('.fchip', { hasText: 'Monster' }).click(); await p.waitForTimeout(100);
 await p.fill('#a-cf-Monster', '4');
 console.log('share:', await p.locator('.card.flat', { hasText: 'share of shelf' }).innerText());
 await p.screenshot({ path: 'out/f_step3.png', fullPage: true });
 await p.locator('.stepper button').nth(5).click(); await p.waitForTimeout(200);
 await p.screenshot({ path: 'out/f_review.png', fullPage: true });
 console.log('review errors:', await p.locator('.banner.bad li').allInnerTexts());
 await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500);
 const r = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const v = s.visits.at(-1); const l = s.locations.find(x=>x.id==='MON-001');
   return { v: { rb: v.rbFacings, cf: v.compFacings, cn: v.contactName, cr: v.contactRole, phoneOnVisit: v.contactPhone }, l: { rb: l.rbFacings, cf: l.compFacings, fc: l.facingComps, cn: l.contactName, ph: l.contactPhone, em: l.contactEmail } }; });
 console.log(JSON.stringify(r));
 await p.screenshot({ path: 'out/f_loc_sm.png', fullPage: true });
 console.log('SM sees phone on location:', (await p.locator('body').innerText()).includes('0412 345 678'));
 // second audit by SM: phone not prefilled for SM
 await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300);
 await p.selectOption('#a-uni', 'MON'); await p.waitForTimeout(150); await p.selectOption('#a-loc', 'MON-001'); await p.waitForTimeout(200);
 console.log('SM prefill:', await p.inputValue('#a-cn'), '|', await p.inputValue('#a-cph'), '|', (await p.locator('#a-cph').locator('..').locator('.hint').innerText()));
 // admin view
 await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.authed=false; s.meId=null; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(600);
 await signIn(p, 'Hudson', 'Ayoubi'); await p.waitForTimeout(500);
 await p.evaluate(() => {}); await p.setViewportSize({ width: 1280, height: 900 });
 await p.locator('.rail >> text=Audit Locations').click(); await p.waitForTimeout(300); await p.locator('#l-q, input[placeholder*="Store"]').first().fill('Grafali').catch(()=>{}); await p.waitForTimeout(200);
 await p.locator('text=Grafali').first().click(); await p.waitForTimeout(300);
 const t = await p.locator('body').innerText(); console.log('admin sees phone:', t.includes('0412 345 678'), '| facings shown:', /Red Bull front facings\s*6/.test(t), '| share:', t.includes('60%'));
 await p.screenshot({ path: 'out/f_loc_admin.png', fullPage: true });
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
