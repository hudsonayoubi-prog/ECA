// Helpers for audit tests: answer the Hi5 questions and the store details that every Completed store audit now needs.
// Step 2 (Ranging tab): Perfect Placement, Perfect Visibility, Consumption Activation. Step 3: Red Bull price, where they buy from.
async function answerHi5Step2(p) {
  for (const k of ['placement', 'visibility', 'activation']) {
    const fld = p.locator('.field', { has: p.locator('#yn-' + k) });
    if (await fld.count() && !(await fld.locator('button[aria-pressed="true"]').count())) await fld.locator('button', { hasText: 'Yes' }).click();
  }
}
async function answerHi5Step3(p, o = {}) {
  if (!(await p.locator('#a-src-l').count())) return;                                   // vending audits have no Hi5 questions
  if (!(await p.inputValue('#a-price'))) await p.fill('#a-price', o.price || '3.50');
  const src = p.locator('.field', { has: p.locator('#a-src-l') });
  if (!(await src.locator('button[aria-pressed="true"]').count())) await src.locator('button', { hasText: o.source || 'Retail' }).click();
  if (o.source === 'Distributor') await p.fill('#a-dist', o.distributor || 'Test Distributor');
}
module.exports = { answerHi5Step2, answerHi5Step3 };
