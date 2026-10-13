// The admin PIN sheet must not print the PIN, and must work in a frame that blocks native form submission.
const { chromium } = require('playwright'); const { signIn } = require('./lib-login'); const fs = require('fs'); const path = require('path');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
for (const [rel, f] of [['../node_modules/react/umd/react.development.js', 'react/umd/react.development.js'], ['../node_modules/react-dom/umd/react-dom.development.js', 'react-dom/umd/react-dom.development.js'], ['../node_modules/htm/dist/htm.umd.js', 'htm/dist/htm.umd.js']])
  html = html.replace(`<script src="${rel}"></script>`, () => '<script>' + fs.readFileSync(path.join(__dirname, '../node_modules', f), 'utf8') + '</script>');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const errs = []; let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
  for (const via of ['click', 'enter']) {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
    await p.setContent('<body style="margin:0"><iframe id=f sandbox="allow-scripts allow-same-origin" style="width:1380px;height:880px;border:0"></iframe></body>'); // no allow-forms
    await p.evaluate(h => { document.getElementById('f').srcdoc = h; }, html); await p.waitForTimeout(1200);
    const fr = p.frames()[1];
    await signIn(p, 'Hudson', 'Ayoubi', { root: fr, wait: 400 });
    await fr.click('.rail >> text="National Leaderboard"'); await fr.click('.tabs >> text=Results'); await p.waitForTimeout(200);
    await fr.click('button:has-text("Finalise")'); await p.waitForTimeout(200); await fr.click('button:has-text("Finalise and lock")'); await p.waitForTimeout(200);
    check(await fr.locator('#el-h').count() === 1, via + ': PIN sheet must open');
    const sheetText = await fr.locator('.sheet').innerText();
    check(!sheetText.includes('2468'), via + ': the default PIN must not be shown on the sheet');
    await fr.fill('#el-pin', '1111'); await (via === 'click' ? fr.click('button:has-text("Unlock and continue")') : fr.press('#el-pin', 'Enter')); await p.waitForTimeout(250);
    check(await fr.locator('.err').count() === 1, via + ': a wrong PIN must show an error');
    await fr.fill('#el-pin', '2468'); await (via === 'click' ? fr.click('button:has-text("Unlock and continue")') : fr.press('#el-pin', 'Enter')); await p.waitForTimeout(300);
    check(await fr.locator('#el-h').count() === 0, via + ': the right PIN must unlock when form submission is blocked');
    await p.close(); }
  await b.close(); console.log(errs.length || bad ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); })();
