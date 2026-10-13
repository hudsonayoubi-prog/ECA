const { chromium } = require('playwright'); const { signIn } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error' && !/key/.test(m.text())) errs.push(m.text()); });
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 const login = async (f,l) => { await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.authed=false; s.meId=null; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(600);
   await signIn(p, f, l); await p.waitForTimeout(500); };
 const go = async t => { await p.locator('.rail >> text=Notifications').click(); await p.waitForTimeout(300); if (t) { await p.locator('.tabs button', { hasText: t }).click(); await p.waitForTimeout(400); } };
 // Manager VIC
 await login('Phillip','Petinella'); await go();
 console.log('VIC mgr inbox monthly:', (await p.locator('.rowbtn', { hasText: 'Monthly summary' }).allInnerTexts()).slice(0,3).map(t=>t.replace(/\n/g,' | ')));
 await go('Monthly summaries'); console.log('VIC mgr cards:', await p.locator('.ucard h3').allInnerTexts());
 await p.screenshot({ path: 'out/m_mgr.png' });
 await p.locator('.ucard').first().click(); await p.waitForTimeout(400); await p.screenshot({ path: 'out/m_mgr_view.png' });
 let [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.sheet-f button.primary').click()]); await dl.saveAs('out/m_state.xlsx'); console.log('state file:', dl.suggestedFilename());
 await p.keyboard.press('Escape'); await p.locator('.sheet-f button', { hasText: 'Close' }).click().catch(()=>{});
 await p.locator('.rail >> text=Progress').click(); await p.waitForTimeout(400);
 [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Download Excel' }).click()]); await dl.saveAs('out/m_progress_mgr.xlsx'); console.log('progress file:', dl.suggestedFilename());
 // Admin
 await login('Hudson','Ayoubi'); await go();
 console.log('admin inbox:', (await p.locator('.rowbtn', { hasText: /National breakdown|Monthly summary/ }).allInnerTexts()).slice(0,3).map(t=>t.replace(/\n/g,' | ')));
 await go('Monthly summaries'); console.log('admin cards:', await p.locator('.ucard h3').allInnerTexts());
 await p.screenshot({ path: 'out/m_admin.png' });
 await p.locator('.ucard', { hasText: 'National breakdown' }).click(); await p.waitForTimeout(400); await p.screenshot({ path: 'out/m_admin_view.png' });
 [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.sheet-f button.primary').click()]); await dl.saveAs('out/m_national.xlsx'); console.log('national file:', dl.suggestedFilename());
 await p.locator('.sheet-f button', { hasText: 'Close' }).click();
 await p.locator('.rail >> text=Progress').click(); await p.waitForTimeout(400);
 [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Download Excel' }).click()]); await dl.saveAs('out/m_progress_admin.xlsx');
 // SM
 await login('Amy','Ward'); await go(); console.log('SM tabs:', await p.locator('.tabs button').allInnerTexts());
 // mobile
 await p.setViewportSize({ width: 390, height: 844 }); await login('Phillip','Petinella'); await p.locator('.bottombar button', { hasText: 'More' }).click().catch(()=>{}); await p.waitForTimeout(300);
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
