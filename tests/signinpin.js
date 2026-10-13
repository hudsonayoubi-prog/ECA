// Personal sign-in PIN: default 0000, create on first sign-in, change, reset, lockout, hashing. Synthetic flows only.
const { chromium } = require('playwright'); const { signIn, createPinIfAsked, TEST_PIN } = require('./lib-login');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); let bad = 0;
  const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
  const open = async () => { await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForSelector('#li-f'); };
  const attempt = async (f, l, pin) => { await p.fill('#li-f', f); await p.fill('#li-l', l); await p.fill('#li-pin', pin); await p.click('button[type=submit]'); await p.waitForTimeout(250); };
  const signedIn = async () => !(await p.$('#li-f')) && !(await p.$('#np-a'));
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('edu-audit-national-v2')));
  const person = async n => (await state()).people.find(x => x.name === n);
  const signOut = async () => { await p.click('text=Sign out >> nth=0'); await p.waitForSelector('#li-f'); };
  await open();

  // hashing
  const vec = await p.evaluate(() => [sha256hex('abc'), sha256hex('')]);
  check(vec[0] === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && vec[1] === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256 test vectors');

  // field required
  await attempt('George', 'Johnson', ''); check((await p.locator('.err').allInnerTexts()).join('|').includes('Enter your PIN.'), 'empty PIN must be refused');
  // wrong default for a person who has no PIN yet
  await attempt('George', 'Johnson', '1234'); check((await p.locator('.banner.bad').innerText()).includes('PIN isn’t right'), 'a wrong PIN must be refused');
  // first sign-in: 0000 leads to create-PIN, not into the app
  await attempt('George', 'Johnson', '0000'); check(await p.$('#np-a'), 'default PIN must lead to Create your PIN');
  check(!(await p.$('.who')), 'must not be signed in before the PIN is created');
  const errsOf = async () => (await p.locator('.err').allInnerTexts()).join('|');
  await p.fill('#np-a', '0000'); await p.fill('#np-b', '0000'); await p.click('button:has-text("Save PIN and continue")'); check((await errsOf()).includes('other than 0000'), '0000 must not be accepted as a new PIN');
  await p.fill('#np-a', '12'); await p.fill('#np-b', '12'); await p.click('button:has-text("Save PIN and continue")'); check((await errsOf()).includes('4 to 8 digits'), 'a short PIN must be refused');
  await p.fill('#np-a', '2580'); await p.fill('#np-b', '2581'); await p.click('button:has-text("Save PIN and continue")'); check((await errsOf()).includes('don’t match'), 'mismatched PINs must be refused');
  await p.fill('#np-a', 'ab25x80'); check(await p.inputValue('#np-a') === '2580', 'letters must be stripped from the PIN field');
  await p.fill('#np-b', '2580'); await p.click('button:has-text("Save PIN and continue")'); await p.waitForTimeout(300);
  check(await signedIn(), 'a valid new PIN must sign the person in');

  // stored as a salted hash, never the PIN
  const g = await person('George Johnson');
  check(/^[0-9a-f]{64}$/.test(g.pinHash) && g.pinSalt && g.pinSalt.length >= 12, 'PIN must be stored as a salted hash');
  check(!JSON.stringify(g).includes('"2580"') && !JSON.stringify(await state()).includes('"pin":'), 'the PIN itself must not be stored');
  const log = (await state()).log; check(log.some(x => x.action === 'Created sign-in PIN' && x.target === 'George Johnson'), 'creating a PIN must be logged');
  check(!JSON.stringify(log).includes('2580'), 'the log must not contain the PIN');

  // sign out and back in
  await signOut();
  await attempt('George', 'Johnson', '0000'); check(!(await signedIn()) && !(await p.$('#np-a')), 'the default PIN must stop working once a PIN is chosen');
  await attempt('george', 'JOHNSON', '2580'); check(await signedIn(), 'the chosen PIN must sign in (name is not case sensitive)');

  // change my PIN
  await p.click('.rail >> text=Settings'); await p.waitForTimeout(200); await p.click('summary:has-text("Change my sign-in PIN")');
  await p.fill('#cp-cur', '9999'); await p.fill('#cp-a', '1357'); await p.fill('#cp-b', '1357'); await p.click('button:has-text("Save PIN")'); check((await errsOf()).includes('isn’t your current PIN'), 'a wrong current PIN must be refused');
  await p.fill('#cp-cur', '2580'); await p.fill('#cp-a', '1357'); await p.fill('#cp-b', '1357'); await p.click('button:has-text("Save PIN")'); await p.waitForTimeout(250);
  check((await person('George Johnson')).pinHash !== g.pinHash, 'changing the PIN must change the stored hash');
  await signOut(); await attempt('George', 'Johnson', '2580'); check(!(await signedIn()), 'the old PIN must stop working after a change');
  await attempt('George', 'Johnson', '1357'); check(await signedIn(), 'the new PIN must work');
  await signOut();

  // lockout after five wrong attempts, even for the right PIN
  for (let i = 0; i < 5; i++) await attempt('George', 'Johnson', '0001');
  check((await p.locator('.banner.bad').innerText()).includes('Too many attempts'), 'five wrong PINs must lock sign-in');
  await attempt('George', 'Johnson', '1357'); check(!(await signedIn()) && (await p.locator('.banner.bad').innerText()).includes('Too many attempts'), 'the right PIN must be refused while locked');
  const logins = (await state()).logins; check(logins.some(x => x.result === 'Wrong PIN'), 'wrong PINs must be recorded in the sign-in log');

  // admin reset: back to 0000, then create again
  await open(); await signIn(p, 'Hudson', 'Ayoubi'); await p.click('.rail >> text=People'); await p.waitForTimeout(300);
  const row = p.locator('tr:has-text("George Johnson")'); await row.locator('button:has-text("Reset PIN")').click(); await p.waitForTimeout(250);
  check(await p.locator('#el-h').count() === 1, 'an administrator reset must ask for the step-up check');
  await p.fill('#el-pin', '2468'); await p.click('button:has-text("Unlock and continue")'); await p.waitForTimeout(300);
  const g2 = await person('George Johnson'); check(!g2.pinHash && !g2.pinSalt, 'a reset must clear the stored PIN');
  check((await state()).log.some(x => x.action === 'Reset sign-in PIN' && x.target === 'George Johnson'), 'a reset must be logged');
  await signOut(); await attempt('George', 'Johnson', '0000'); check(await p.$('#np-a'), 'after a reset the default PIN must lead to Create your PIN again');

  // two people with the same name: only the profile whose PIN matches is offered
  await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('edu-audit-national-v2')); st.people.push({ id: 'Ptest-zoe-qld', name: 'Zoe Smith', role: 'marketeer', state: 'QLD', status: 'Active', disambig: 'UQ, St Lucia' }); localStorage.setItem('edu-audit-national-v2', JSON.stringify(st)); });
  await open(); await p.fill('#li-f', 'Zoe'); await p.fill('#li-l', 'Smith'); await p.fill('#li-pin', '0000'); await p.click('button[type=submit]'); await p.waitForTimeout(250);
  const rows = p.locator('.banner.warn .rowbtn'); check(await rows.count() === 2, 'two people with the same name and default PIN must show the chooser');
  await rows.nth(0).click(); await p.waitForTimeout(200); await createPinIfAsked(p); check(await signedIn(), 'chosen profile must create a PIN and sign in');
  await signOut();
  await attempt('Zoe', 'Smith', TEST_PIN); check(await signedIn(), 'the PIN must pick out the right Zoe Smith without a chooser');
  await signOut(); await attempt('Zoe', 'Smith', '0000'); check(await p.$('#np-a') && (await p.locator('.banner.warn .rowbtn').count()) === 0, 'the default PIN must reach only the other Zoe Smith, who still has to create a PIN');

  await b.close(); console.log(errs.length || bad ? 'ERRORS ' + errs.join('|') : 'NO ERRORS'); })();
