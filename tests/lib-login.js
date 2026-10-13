// Shared sign-in for the test suites. Signs in with name + PIN. A person who has not chosen a PIN yet uses the default 0000
// and is taken through "Create your PIN"; the test PIN below is then used for every later sign-in in the same browser.
const TEST_PIN = '2580';
async function signIn(p, first, last, opts = {}) {
  const root = opts.root || p;
  await root.fill('#li-f', first); await root.fill('#li-l', last);
  const submit = async pin => { await root.fill('#li-pin', pin); await root.click('button[type=submit]'); await p.waitForTimeout(opts.wait || 250); };
  await submit(TEST_PIN);
  if (await root.$('.banner.bad')) await submit('0000');            // not chosen yet: the default PIN
  await createPinIfAsked(p, opts);
}
// First sign-in: "Create your PIN" step.
async function createPinIfAsked(p, opts = {}) {
  const root = opts.root || p;
  if (await root.$('#np-a')) {
    await root.fill('#np-a', TEST_PIN); await root.fill('#np-b', TEST_PIN); await root.click('button:has-text("Save PIN and continue")'); await p.waitForTimeout(opts.wait || 250);
  }
}
module.exports = { signIn, createPinIfAsked, TEST_PIN };
