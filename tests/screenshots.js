// Regenerates assets/screenshots/*.png from tests/index.html (run npm run build first). Run from the tests folder: node screenshots.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: !process.env.CHROMIUM_PATH, args: process.env.CHROMIUM_PATH ? ['--headless=new', '--no-sandbox'] : ['--no-sandbox'] });
  const errs = []; const shots = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + path.join(__dirname, 'index.html');
  const snap = async (name, opts = {}) => { await p.waitForTimeout(350); const f = path.join(OUT, name + '.png'); if (opts.el) await p.locator(opts.el).first().screenshot({ path: f }); else await p.screenshot({ path: f, fullPage: !!opts.full }); shots.push(name); };
  const signOut = async () => { await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('edu-audit-national-v2')); s.authed = false; s.meId = null; localStorage.setItem('edu-audit-national-v2', JSON.stringify(s)); }); await p.reload(); await p.waitForTimeout(600); };
  const signIn = async (f, l) => { await p.fill('#li-f', f); await p.fill('#li-l', l); await p.click('button[type=submit]'); await p.waitForTimeout(600); };
  const rail = async t => { await p.locator('.rail .navbtn', { hasText: t }).first().click(); await p.waitForTimeout(450); };
  await p.goto(url); await p.waitForTimeout(800);
  await snap('01-sign-in-desktop');
  // Administrator, desktop
  await signIn('Hudson', 'Ayoubi');
  await snap('02-dashboard-admin-desktop', { full: true });
  await rail('National Leaderboard'); await snap('03-national-leaderboard-desktop', { full: true });
  await rail('My Visits'); await snap('04-my-visits-admin-desktop');
  await rail('Universities & TAFEs'); await snap('05-universities-tafes-desktop');
  await p.locator('.ucard', { hasText: 'Monash University' }).click(); await p.waitForTimeout(400); await snap('06-institution-detail-desktop', { full: true });
  await rail('Audit Locations'); await snap('07-audit-locations-desktop');
  await p.locator('text=Grafali').first().click(); await p.waitForTimeout(400); await snap('08-location-detail-desktop', { full: true });
  await rail('Progress'); await snap('09-progress-desktop', { full: true });
  await rail('Notifications'); await snap('10-notifications-inbox-desktop');
  await p.locator('.tabs button', { hasText: 'Monthly summaries' }).click(); await snap('11-monthly-summaries-desktop');
  await p.locator('.ucard', { hasText: 'National breakdown' }).first().click(); await snap('12-monthly-national-breakdown-modal', { el: '.sheet' });
  await p.locator('.sheet-f button', { hasText: 'Close' }).click();
  await p.locator('.tabs button', { hasText: 'Audit exports' }).click(); await snap('13-audit-exports-desktop');
  await p.locator('.tabs button', { hasText: 'Daily summaries' }).click(); await snap('14-daily-summaries-desktop');
  await rail('People'); await snap('15-people-desktop');
  await rail('Settings'); await snap('16-settings-admin-desktop', { full: true });
  await p.locator('.chip', { hasText: /This browser only|Live/ }).first().click().catch(() => {}); await p.waitForTimeout(300); if (await p.locator('.sheet').count()) { await snap('17-sync-status-help-modal', { el: '.sheet' }); await p.keyboard.press('Escape'); await p.locator('.sheet-f button').first().click().catch(() => {}); }
  // Start audit, desktop (admin: state picker)
  await p.locator('.rail .start button, .rail button.start-cta').first().click(); await p.waitForTimeout(400); await snap('18-audit-step1-admin-state-picker-desktop');
  // Manager
  await p.setViewportSize({ width: 1366, height: 900 }); await signOut(); await signIn('Phillip', 'Petinella');
  await snap('19-dashboard-manager-desktop', { full: true });
  // Student Marketeer, mobile
  await p.setViewportSize({ width: 390, height: 844 }); await signOut(); await snap('20-sign-in-mobile'); await signIn('Alex', 'Mozjerin');
  await snap('21-dashboard-student-marketeer-mobile', { full: true });
  await p.locator('.bottombar button', { hasText: 'Visits' }).click(); await snap('22-my-visits-mobile');
  await p.locator('.bottombar button', { hasText: 'Audit' }).click(); await p.waitForTimeout(300);
  await p.selectOption('#a-uni', 'MON'); await p.waitForTimeout(150); await p.selectOption('#a-loc', 'MON-004'); await p.waitForTimeout(200); await p.fill('#a-cn', 'Sam Store');
  await snap('23-audit-step1-visit-details-mobile', { full: true });
  await p.locator('.stepper button').nth(1).click(); await snap('24-audit-step2-ranging-mobile', { full: true });
  for (const fld of await p.locator('.field').filter({ has: p.locator('[id^="yn-"]') }).all()) { if (!(await fld.locator('button[aria-pressed="true"]').count())) await fld.locator('button', { hasText: 'Yes' }).click(); }
  await p.locator('.stepper button').nth(2).click(); await p.waitForTimeout(200);
  for (let i = 0; i < 5; i++) await p.locator('#a-rbf').locator('..').locator('button').last().click();
  if (!(await p.locator('#a-cf-V').count())) await p.locator('.fchip', { hasText: /^\+ V$/ }).click();
  for (let i = 0; i < 3; i++) await p.locator('#a-cf-Monster').locator('..').locator('button').last().click().catch(() => {});
  await snap('25-audit-step3-facings-competitors-mobile', { full: true });
  await p.locator('.stepper button').nth(3).click(); await snap('26-audit-step4-outcomes-mobile', { full: true });
  await p.locator('.stepper button').nth(4).click(); await snap('27-audit-step5-notes-mobile', { full: true });
  await p.locator('.stepper button').nth(5).click(); await snap('28-audit-step6-review-mobile', { full: true });
  await p.locator('.audit-foot button.primary').click(); await p.waitForTimeout(500); await snap('29-location-after-submit-mobile', { full: true });
  await p.locator('.bottombar button', { hasText: 'Leaders' }).click(); await snap('30-leaderboard-scorecard-mobile', { full: true });
  await p.locator('.bottombar button', { hasText: 'More' }).click(); await snap('31-more-menu-mobile');
  console.log('screenshots:', shots.length); console.log(errs.length ? errs : 'NO ERRORS'); await b.close();
})();
