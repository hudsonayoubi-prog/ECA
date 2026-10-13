const { chromium } = require('playwright'); const { signIn } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 // simulate older saved ECA state with old list
 await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2') || 'null'); });
 await signIn(p, 'Hudson', 'Ayoubi'); await p.waitForTimeout(300);
 await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.ecaRev = 1; s.ref.storeTypes = [{name:'Student Bar',active:true},{name:'Convenience',active:true},{name:'NKA',active:true},{name:'NPD',active:false}]; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); });
 await p.reload(); await p.waitForTimeout(700);
 await p.click('.rail >> text="Settings"'); await p.waitForTimeout(200);
 const rows = await p.locator('h2:has-text("Store location types") >> xpath=..').locator('tbody tr').allInnerTexts(); console.log('types:', rows.map(r => r.replace(/\s+/g,' ').replace(/Rename.*/,'')));
 await p.click('.rail >> text="Audit Locations"'); await p.click('button:has-text("Add Location") >> nth=0'); await p.waitForTimeout(150);
 await p.selectOption('#lf-stype', 'Vending'); await p.waitForTimeout(100); console.log('id:', await p.inputValue('#lf-id'), '| name label:', await p.locator('label[for=lf-name]').innerText(), '| has building:', await p.locator('#lf-bld').count());
 await p.fill('#lf-name', 'Test machine'); await p.click('.sheet-f .btn.primary'); await p.waitForTimeout(200);
 await p.selectOption('#l-stt', 'Vending'); await p.waitForTimeout(150); console.log('vending count:', await p.locator('.small.muted.num').first().innerText());
 await p.selectOption('#l-stt', 'QSR'); await p.waitForTimeout(150); console.log('QSR count:', await p.locator('.small.muted.num').first().innerText());
 await p.screenshot({ path: 'out/st-list.png' });
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
