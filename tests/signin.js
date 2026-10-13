// Sign-in must work even when the page runs in a frame that blocks native form submission (some preview panes do).
const { chromium } = require('playwright'); const { signIn } = require('./lib-login'); const fs = require('fs'); const path = require('path');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
for (const [rel, f] of [['../node_modules/react/umd/react.development.js', 'react/umd/react.development.js'], ['../node_modules/react-dom/umd/react-dom.development.js', 'react-dom/umd/react-dom.development.js'], ['../node_modules/htm/dist/htm.umd.js', 'htm/dist/htm.umd.js']])
  html = html.replace(`<script src="${rel}"></script>`, () => '<script>' + fs.readFileSync(path.join(__dirname, '../node_modules', f), 'utf8') + '</script>');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const errs = []; let bad = 0; const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
  for (const via of ['click', 'enter']) {
    const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.setContent('<iframe id=f sandbox="allow-scripts allow-same-origin" style="width:900px;height:700px"></iframe>'); // no allow-forms
    await p.evaluate(h => { document.getElementById('f').srcdoc = h; }, html); await p.waitForTimeout(1200);
    const fr = p.frames()[1]; await fr.fill('#li-f', 'Nobody'); await fr.fill('#li-l', 'Here'); await fr.fill('#li-pin', '0000');
    await (via === 'click' ? fr.click('button[type=submit]') : fr.press('#li-l', 'Enter')); await p.waitForTimeout(400);
    check(await fr.$('.banner.bad'), via + ': a wrong name must show the error');
    await fr.fill('#li-f', 'Hudson'); await fr.fill('#li-l', 'Ayoubi'); await fr.fill('#li-pin', '0000');
    await (via === 'click' ? fr.click('button[type=submit]') : fr.press('#li-l', 'Enter')); await p.waitForTimeout(500);
    check(await fr.$('#np-a'), via + ': first sign-in must ask the person to create a PIN');
    await fr.fill('#np-a', '2580'); await fr.fill('#np-b', '2580'); await (via === 'click' ? fr.click('button:has-text("Save PIN and continue")') : fr.press('#np-b', 'Enter')); await p.waitForTimeout(500);
    check(!(await fr.$('#li-f')), via + ': a valid name and PIN must sign in when form submission is blocked');
    await p.close(); }
  await b.close(); console.log(errs.length || bad ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); })();
