const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
 const p = await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
 await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(700);
 const chk = async l => console.log(l, await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); const t = JSON.stringify(s); return { mill: (t.match(/"Mill Burgess"/g)||[]).length, milla: (t.match(/Milla Burgess/g)||[]).length, people: s.people.filter(p => /Burgess/.test(p.name)).map(p=>p.name) }; }));
 await chk('fresh:');
 // simulate an older browser state that still says Mill
 await p.evaluate(() => { let t = localStorage.getItem('edu-audit-national-v2').replace(/Milla Burgess/g, 'Mill Burgess'); const s = JSON.parse(t); s.log = []; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); });
 await p.reload(); await p.waitForTimeout(700); await chk('migrated:');
 await p.fill('#li-f','Milla'); await p.fill('#li-l','Burgess'); await p.click('button[type=submit]'); await p.waitForTimeout(300);
 console.log('signed in:', (await p.locator('.who b').innerText()), '| scorecard:', await p.locator('[aria-label="Your scorecard"] h2').innerText().catch(()=>'none'));
 console.log(errs.length ? errs : 'NO ERRORS'); await b.close(); })();
