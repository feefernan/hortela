// PROTÓTIPO: fotografa as 3 variações em cada rota, a 1440 e a 390.
// Uso: npx vite --port 5181 &  node src/prototype/screenshots.mjs [http://localhost:5181] [saída]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5181';
const out = process.argv[3] ?? 'docs/prototipos';
const routes = [
  ['home', '#/'],
  ['colecao', '#/colecao'],
  ['peca', '#/peca/floresta-3'],
  ['sobre', '#/sobre'],
];
const widths = [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
];

const browser = await chromium.launch();
for (const [label, width, height] of widths) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  for (const v of ['A', 'B', 'C']) {
    for (const [name, hash] of routes) {
      await page.goto(`${base}/?variant=${v}${hash}`);
      await page.waitForSelector('#proto-root > *');
      await page.waitForTimeout(400);
      const file = `${out}/${v}-${name}-${label}`;
      await page.screenshot({ path: `${file}.png`, fullPage: true });
      // Telas fixas e presas não aparecem direito na página inteira: uma tela no meio do caminho.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.3));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${file}-tela2.png` });
      console.log(file);
    }
  }
  await context.close();
}
await browser.close();
