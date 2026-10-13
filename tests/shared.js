const { chromium } = require('playwright'); const { signIn } = require('./lib-login'); const { answerHi5Step3 } = require('./lib-audit'); const fs = require('fs');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await ctx.addInitScript({ content: fs.readFileSync('fakedb.js', 'utf8') });
 const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !m.text().includes('unique "key"') && errs.push(m.text().slice(0,200)));
 const W = () => p.evaluate(() => window.__writes.slice()); const S = () => p.evaluate(() => Object.keys(window.__store));
 const login = async (f, l) => { await p.waitForSelector('button[type=submit]:not([disabled])'); await signIn(p, f, l); await p.waitForTimeout(400); };
 const settle = async () => { await p.waitForTimeout(800); const a = (await W()).length; await p.waitForTimeout(1200); const c = (await W()).length; return [a, c]; };
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(600);
 console.log('boot writes:', await W());
 await login('George', 'Johnson'); console.log('chip:', await p.locator('.topbar .chip').first().innerText(), '| writes after login:', (await W()).map(x=>x.split('/')[0]).join(','));
 // SM submits an audit through the form
 await p.click('.rail >> text="Audit Locations"'); await p.locator('tbody tr.click').first().click(); await p.waitForTimeout(200);
 const locName = await p.locator('h1').innerText(); await p.click('button:has-text("Start Audit") >> nth=1').catch(async () => p.click('main button:has-text("Start Audit")'));
 await p.waitForTimeout(200);
 await p.fill("#a-cn", "Test Contact");
 for (let step = 0; step < 5; step++) { for (const y of await p.locator('section.card button:has-text("Yes")').all()) await y.click(); if (step === 2) await answerHi5Step3(p); if (step === 3) await p.click('button[aria-label="Increase Distribution points added"]'); await p.click('.audit-foot button:has-text("Next")'); await p.waitForTimeout(120); }
 await p.click('.audit-foot button.primary'); await p.waitForTimeout(300); console.log('toast:', await p.locator('.toast').innerText().catch(()=>'-'));
 let st = await S(); const vdoc = st.find(x => x.startsWith('visits/')); console.log('visit doc:', vdoc, '| loc:', locName);
 console.log('settle (no echo loop):', await settle());
 await p.click('text=Sign out >> nth=0');
 // another viewer adds a location directly in the shared store
 await p.evaluate(() => window.__external('locations/MON-999', { id: 'MON-999', _key: 'MON-999', uni: 'MON', type: 'QSR', storeType: 'Convenience', name: 'Pilot Test Store', campus: 'Clayton', status: 'Active', added: '2026-10-09', cycle: 14, ranging: {} }));
 // manager approves
 await login('Phillip', 'Petinella'); await p.click('.rail >> text="National Leaderboard"'); await p.click('.tabs >> text=Review activity'); await p.waitForTimeout(300);
 console.log('queue:', await p.locator('.tabs button[aria-selected=true]').innerText());
 await p.locator('.card .btn.primary.sm:has-text("Approve")').first().click(); await p.waitForTimeout(600);
 const v = await p.evaluate(k => window.__store[k], vdoc); console.log('approved in store:', v.approval, v.approvedBy);
 await p.click('.rail >> text="Audit Locations"'); await p.fill('#l-q', 'Pilot Test'); await p.waitForTimeout(200); console.log('remote location visible:', await p.locator('tbody tr').count());
 // admin changes scoring -> config doc
 await p.click('text=Sign out >> nth=0'); await login('Hudson', 'Ayoubi'); await p.click('.rail >> text="Settings"'); await p.fill('#w-ranging', '35'); await p.fill('#w-tdp', '20');
 await p.click('button:has-text("Save scoring rules")'); await p.fill('#el-pin', '2468'); await p.click('button:has-text("Unlock and continue")'); await p.waitForTimeout(600);
 console.log('config weights:', JSON.stringify((await p.evaluate(() => window.__store['config/main']))?.ref?.scoring?.weights));
 console.log('settle:', await settle());
 // reload: data comes back from the store
 await p.reload(); await p.waitForTimeout(1200);
 await p.click('.rail >> text="National Leaderboard"').catch(()=>{}); await p.waitForTimeout(300);
 console.log('after reload ranking rows:', await p.locator('tbody tr').count(), '| George audits:', await p.locator('tbody tr:has-text("George Johnson") td').last().innerText().catch(()=>'not ranked (needs 3)'));
 await p.click('.rail >> text="Settings"'); console.log('weights after reload:', await p.inputValue('#w-ranging'), await p.inputValue('#w-tdp'));
 const docs = await S(); const by = {}; docs.forEach(x => { const c = x.split('/')[0]; by[c] = (by[c]||0)+1; }); console.log('store docs:', JSON.stringify(by), 'total writes', (await W()).length);
 await p.screenshot({ path: 'out/shared.png' });
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
