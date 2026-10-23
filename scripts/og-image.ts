/**
 * Gera public/og.png (1200×630) a partir do hero do site, para prévias de link (WhatsApp, Instagram).
 * Uso: npm run build && npx vite preview --port 4173 & npx tsx scripts/og-image.ts
 * (ou: node --experimental-strip-types scripts/og-image.ts)
 */
import { chromium } from '@playwright/test';

const url = process.env.OG_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(url);
await page.addStyleTag({
  content: `nav{display:none!important}.page{padding-top:0!important}
  .hero{min-height:630px!important;padding:40px!important;justify-content:center}
  .hero-art-frame{width:300px!important;height:300px!important;margin-bottom:24px!important}
  .hero-btns{display:none!important}`,
});
await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('public/og.png gerado');
