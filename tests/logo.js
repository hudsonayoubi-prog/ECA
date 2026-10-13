const { chromium } = require('playwright'); const { signIn } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 await signIn(p, 'Hudson', 'Ayoubi'); await p.waitForTimeout(500);
 const pin = p.locator('input[type=password]'); if (await pin.count()) { await pin.first().fill('2468'); await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
 await p.locator('.rail >> text=Universities & TAFEs').click(); await p.waitForTimeout(400);
 await p.locator('.ucard', { hasText: 'Monash University' }).click(); await p.waitForTimeout(300);
 await p.locator('button', { hasText: 'Edit' }).first().click(); await p.waitForTimeout(300);
 await p.setInputFiles('#if-logo', 'fixtures-logo.png'); await p.waitForTimeout(600);
 await p.locator('.sheet-f button.primary').click(); await p.waitForTimeout(400);
 const L = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const u = s.unis.find(u=>u.code==='MON'); return u.logo ? u.logo.slice(0,22)+' '+u.logo.length+' chars' : 'none'; });
 console.log('saved logo:', L);
 await p.screenshot({ path: 'out/logo_detail.png' });
 await p.locator('.rail >> text=Universities & TAFEs').click(); await p.waitForTimeout(400);
 await p.screenshot({ path: 'out/logo_tiles.png' });
 // edit a 6-letter code institution saves
 await p.locator('.ucard', { hasText: 'GOTAFE' }).click(); await p.waitForTimeout(300);
 await p.locator('button', { hasText: 'Edit' }).first().click(); await p.waitForTimeout(200); await p.locator('.sheet-f button.primary').click(); await p.waitForTimeout(300);
 console.log('GOTAFE edit closed:', !(await p.locator('.sheet').count()));
 const m = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
 await m.goto('file://' + process.cwd() + '/index.html'); await m.waitForTimeout(600);
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
