import { chromium } from 'playwright';
const OUT = process.env.OUT;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 810 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await p.goto('http://localhost:5199/games/lane-dash/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
try { await p.getByRole('button', { name: 'Start Run' }).click({ timeout: 4000 }); } catch { await p.locator('button').first().click(); }
await p.waitForTimeout(2900 + 5300); // countdown + tutorial
// Stay center, jump only to survive obstacles; dense burst to catch flights.
let shot = 0;
for (let i = 0; i < 60; i++) {
  if (await p.getByText('Game Over').isVisible().catch(() => false)) {
    await p.getByRole('button', { name: 'Retry' }).click().catch(() => {});
    await p.waitForTimeout(2900 + 5300);
  }
  shot++;
  await p.screenshot({ path: `${OUT}/fly-${String(shot).padStart(2, '0')}.png` });
  await p.waitForTimeout(75);
}
console.log('shots:', shot, 'ERRORS:', JSON.stringify(errs));
await b.close();
