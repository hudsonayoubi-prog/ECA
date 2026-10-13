const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !m.text().includes('unique "key"') && errs.push('console: '+m.text().slice(0,200)));
 const shot = n => p.screenshot({ path: 'out/eca-' + n + '.png', fullPage: false });
 const login = async (f, l) => { await p.fill('#li-f', f); await p.fill('#li-l', l); await p.click('button[type=submit]'); await p.waitForTimeout(250); };
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(800);
 console.log('title:', await p.title()); await shot('login');
 await p.click('button[type=submit]'); console.log('empty errs:', await p.locator('.err').allInnerTexts());
 await login('Nobody', 'Here'); console.log('unknown:', (await p.locator('.banner.bad').innerText()).slice(0,60));
 // SM
 await login('  george ', 'JOHNSON'); console.log('SM page:', await p.locator('.page-title').innerText()); await shot('sm-board');
 console.log('SM tabs:', await p.locator('.tabs button').allInnerTexts()); console.log('scorecard:', (await p.locator('[aria-label="Your scorecard"] h2').innerText()));
 console.log('podium:', (await p.locator('.pod-n').allInnerTexts()).join(' | '));
 const opts = await p.locator('#lb-m option').allInnerTexts(); console.log('SM months:', opts);
 await p.click('text=Sign out >> nth=0'); await p.waitForTimeout(200);
 // Manager approve
 await login('Phillip', 'Petinella'); await p.click('.rail >> text="National Leaderboard"'); await p.click('.tabs >> text=Review activity'); await p.waitForTimeout(200);
 console.log('queue:', await p.locator('.tabs button[aria-selected=true]').innerText());
 const before = await p.locator('.small.muted.num').first().innerText(); console.log(before);
 await p.locator('.card .btn.primary.sm:has-text("Approve")').first().click(); await p.waitForTimeout(200);
 await p.locator('.btn.danger.sm:has-text("Reject")').first().click(); await p.fill('[id^=rj-]', 'No photo of the fridge'); await p.locator('.btn.danger:has-text("Reject")').last().click(); await p.waitForTimeout(200);
 console.log('after:', await p.locator('.tabs button[aria-selected=true]').innerText()); await shot('mgr-review');
 await p.click('.tabs >> text=Year-round'); await p.waitForTimeout(300); await p.selectOption('#yr-st', 'Convenience'); await p.waitForTimeout(200); console.log('yr kpis:', (await p.locator('.kpi .v').allInnerTexts()).join(',')); await shot('mgr-year');
 await p.click('text=Sign out >> nth=0'); await p.waitForTimeout(200);
 // Admin finalise + distribute
 await login('Hudson', 'Ayoubi'); await p.click('.rail >> text="National Leaderboard"'); await p.click('.tabs >> text=Results'); await p.waitForTimeout(200);
 console.log('results rows:', (await p.locator('tbody tr td:nth-child(2)').allInnerTexts()).join(','));
 await p.click('button:has-text("Finalise")'); await p.waitForTimeout(200); await shot('finalise');
 await p.click('button:has-text("Finalise and lock")'); await p.waitForTimeout(200); console.log('elevate shown:', await p.locator('#el-h').count());
 await p.fill('#el-pin', '1111'); await p.click('button:has-text("Unlock and continue")'); console.log('bad pin:', await p.locator('.err').innerText());
 await p.fill('#el-pin', '2468'); await p.click('button:has-text("Unlock and continue")'); await p.waitForTimeout(250);
 console.log('after finalise:', (await p.locator('tbody tr td:nth-child(2)').allInnerTexts()).join(','));
 await p.locator('button:has-text("Send results")').first().click(); await p.waitForTimeout(200); await shot('distribute');
 await p.locator('.sheet-f .btn.primary').click(); await p.waitForTimeout(250); console.log('toast:', await p.locator('.toast').innerText());
 await p.click('.tabs >> text=This month'); await p.selectOption('#lb-m', { index: 1 }); await p.waitForTimeout(200); console.log('banner:', (await p.locator('.banner').first().innerText()).slice(0, 90)); await shot('admin-final');
 await p.locator('tbody tr.click').first().click(); await p.waitForTimeout(200); console.log('drill rows:', await p.locator('.sheet tbody tr').count()); await p.keyboard.press('Escape');
 // settings
 await p.click('.rail >> text="Settings"'); await p.waitForTimeout(200); console.log('settings sections:', (await p.locator('h2').allInnerTexts()).join(' | '));
 await p.fill('#w-ranging', '40'); await p.waitForTimeout(100); console.log('save disabled at 110%:', await p.locator('button:has-text("Save scoring rules")').isDisabled());
 await p.fill('#w-tdp', '15'); await p.click('button:has-text("Save scoring rules")'); await p.waitForTimeout(200); console.log('toast:', await p.locator('.toast').innerText().catch(()=>'-'));
 const hist = await p.locator('h2:has-text("Audit history") >> xpath=../..').locator('tbody tr').allInnerTexts(); console.log('history top:', hist.slice(0,6).map(x=>x.replace(/\s+/g,' ').slice(0,110)));
 // duplicate name
 await p.click('.rail >> text="People"'); await p.click('button:has-text("Add person")'); await p.fill('#pf-n', 'Zoe Smith'); await p.click('.sheet-f .btn.primary'); console.log('dup err:', await p.locator('.sheet .err').first().innerText());
 await p.check('.sheet input[type=checkbox]'); await p.selectOption('#pf-s', 'QLD'); await p.fill('#pf-dis', 'UQ, St Lucia'); await p.click('.sheet-f .btn.primary'); await p.waitForTimeout(200);
 await p.click('text=Sign out >> nth=0'); await login('Zoe', 'Smith'); console.log('choices:', (await p.locator('.banner.warn .rowbtn').allInnerTexts()).map(x=>x.replace(/\s+/g,' ')));
 await p.locator('.banner.warn .rowbtn').nth(1).click(); await p.waitForTimeout(200); console.log('signed in as:', (await p.locator('.who').innerText()).split('\n').slice(0,2).join(' / '));
 // store types / location filter
 await p.click('text=Sign out >> nth=0'); await login('Hudson','Ayoubi'); await p.click('.rail >> text="Audit Locations"'); await p.selectOption('#l-stt', 'Student Bar'); await p.waitForTimeout(150); console.log('student bars:', await p.locator('.small.muted.num').first().innerText());
 await p.click('button:has-text("Add Location") >> nth=0'); await p.waitForTimeout(150); console.log('store type opts:', await p.locator('#lf-stype option').allInnerTexts()); await p.keyboard.press('Escape');
 // mobile
 await p.setViewportSize({ width: 390, height: 844 }); await p.click('.bottombar >> text=Leaders'); await p.waitForTimeout(250); await shot('m-board');
 const ow = await p.evaluate(() => document.documentElement.scrollWidth); console.log('mobile scrollWidth:', ow);
 await p.click('text=Sign out >> nth=0').catch(()=>{});
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
