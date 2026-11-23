import { chromium } from 'playwright';
const OUT = process.env.OUT;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 810 }, deviceScaleFactor: 2 });
try {
  await p.goto('http://localhost:5213/games/lane-dash/', { waitUntil: 'networkidle', timeout: 15000 });
  await p.waitForTimeout(1500);
  try { await p.getByRole('button', { name: 'Start Run' }).click({ timeout: 4000 }); } catch { await p.locator('button').first().click(); }
  await p.waitForTimeout(2900 + 5300);

  let found = 0;
  let lives = 0;
  for (let i = 0; i < 30 && found < 2 && lives < 3; i++) {
    if (await p.getByText('Game Over').isVisible().catch(() => false)) {
      lives++;
      if (lives >= 3) break;
      await p.getByRole('button', { name: 'Retry' }).click().catch(() => {});
      await p.waitForTimeout(2900 + 5300);
    }
    const info = await p.evaluate(() => {
      const g = window.Phaser?.GAMES?.[0];
      const rs = g?.scene?.getScene?.('RunScene');
      if (!rs) return null;
      const kids = rs.obstacles.getChildren().filter(o => o.active);
      const wide = kids.find(o => (o.getData('lanes')||[]).length > 1);
      if (!wide) return { count: kids.length };
      return { hit: true, y: wide.y, tex: wide.texture.key };
    });
    if (info?.hit && info.y > 250 && info.y < 600) {
      found++;
      await p.screenshot({ path: `${OUT}/wide-${found}-${info.tex}.png` });
      console.log('CAPTURED', JSON.stringify(info));
    }
    await p.waitForTimeout(300);
  }
  console.log('DONE total:', found, 'lives used:', lives);
} catch (e) {
  console.log('ERR:', e.message);
} finally {
  await b.close().catch(()=>{});
}
