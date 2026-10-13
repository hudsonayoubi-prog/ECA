const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 const login = async (f,l) => { await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.authed=false; s.meId=null; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(600); await p.fill('#li-f',f); await p.fill('#li-l',l); await p.click('button[type=submit]'); await p.waitForTimeout(500); };
 await login('Phillip','Petinella'); await p.locator('.rail .navbtn', { hasText: 'Settings' }).click(); await p.waitForTimeout(300);
 console.log('manager cycle input present:', await p.locator('#set-cycle').count(), '| read-only text:', await p.locator('text=Administrators can change these.').count());
 // add a location under GOTAFE (6-letter code)
 await p.locator('.rail .navbtn', { hasText: 'Audit Locations' }).click(); await p.waitForTimeout(300);
 await p.locator('button', { hasText: /Add Location/ }).first().click(); await p.waitForTimeout(300);
 await p.selectOption('#lf-uni', 'GOTAFE'); await p.waitForTimeout(150);
 console.log('auto id:', await p.inputValue('#lf-id').catch(() => '?'));
 await p.fill('#lf-name', 'Test Café'); await p.fill('#lf-newc', 'Shepparton').catch(()=>{});
 await p.locator('.sheet-f button.primary').click(); await p.waitForTimeout(300);
 console.log('saved:', await p.evaluate(() => JSON.parse(localStorage.getItem('edu-audit-national-v2')).locations.some(l => l.id === 'GOTAFE-001')), '| sheet still open:', await p.locator('.sheet').count(), (await p.locator('.sheet .err').allInnerTexts()).join(' / '));
 await login('Hudson','Ayoubi'); await p.locator('.rail .navbtn', { hasText: 'Settings' }).click(); await p.waitForTimeout(300);
 console.log('admin cycle input present:', await p.locator('#set-cycle').count());
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
