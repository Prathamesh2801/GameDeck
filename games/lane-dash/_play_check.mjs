import { chromium } from 'playwright';

const BASE = 'http://localhost:5173/games/lane-dash/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

await page.goto(BASE, { waitUntil: 'networkidle' });

try {
  await page.waitForFunction(() => document.body.innerText.includes('Start Run'), null, { timeout: 45000 });
  console.log('1. StartScreen shown without token (DEV_MODE): true');

  await page.click('text=Start Run');
  await page.waitForFunction(() => document.body.innerText.includes('Coins'), null, { timeout: 20000 });
  const hasScorePill = await page.evaluate(() => document.body.innerText.includes('Score'));
  console.log('2. HUD Coins pill: true | stray "Score" text:', hasScorePill);

  await page.waitForTimeout(9500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.innerText.includes('Paused'), null, { timeout: 5000 });
  const pausedText = await page.evaluate(() => document.body.innerText);
  console.log('3. Paused — Resume:', pausedText.includes('Resume'), '| Restart (DEV expects true):', pausedText.includes('Restart'));
  await page.click('text=Resume');

  await page.waitForFunction(() => document.body.innerText.includes('Game Over'), null, { timeout: 90000 });
  const overText = await page.evaluate(() => document.body.innerText);
  const devLog = logs.find((l) => l.includes('[DEV_MODE] submitScore skipped'));
  console.log('4. Game Over — Play Again (DEV):', overText.includes('Play Again'));
  console.log('5. DEV payload log:', devLog || 'NOT FOUND');

  const music = await page.evaluate(() => {
    const games = window.Phaser?.GAMES || [];
    const g = games.find(Boolean);
    return g ? { anyMusicPlaying: g.sound?.sounds?.some((s) => s.key === 'music-run' && s.isPlaying) ?? null } : 'no game handle';
  });
  console.log('6. music-run playing at game over:', JSON.stringify(music));
} catch (e) {
  console.log('FAILED:', e.message.split('\n')[0]);
  console.log('--- console/page errors ---');
  for (const l of logs.filter((l) => l.includes('ERROR') || l.includes('error') || l.includes('Failed'))) console.log(l);
  console.log('--- body text ---');
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 400));
}
await browser.close();
