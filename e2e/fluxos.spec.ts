import { expect, test } from '@playwright/test';

test.describe('fluxos principais', () => {
  test('home carrega sem erros de console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Cada peça/ })).toBeVisible();
    await expect(page.locator('#home-grid .p-card')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('coleção → carrinho → pedido', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Menu mobile quebrado — coberto pela issue de layout mobile');
    await page.goto('/');
    await page.locator('#n-loja').click();
    await page.locator('.loja-card[data-product="floresta-3"]').click();
    await expect(page.locator('#m-name')).toHaveText('Floresta nº 3');
    await page.locator('[data-action="buy-product"]').click();
    await expect(page.locator('#cn')).toHaveText('1');
    await page.locator('#cart-open-btn').click();
    await expect(page.locator('#cart-drawer')).toBeVisible();
    await expect(page.locator('#cart-lines')).toContainText('Floresta nº 3');
    await page.locator('[data-action="checkout-cart"]').click();
    await page.locator('#ck-name').fill('Ana');
    await page.locator('#ck-email').fill('ana@site.com');
    await page.locator('[data-action="submit-order"]').click();
    await expect(page.locator('#confirmacao')).toHaveClass(/active/);
    await expect(page.locator('#conf-cert-btn')).toBeHidden();
  });

  test('compõe no estúdio e finaliza o pedido', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Estúdio sem layout mobile — coberto pela issue de layout mobile');
    await page.goto('/');
    await page.locator('#n-estudio').click();
    await page.locator('[data-stamp-id="s10"]').click();
    await page.locator('#word-input').fill('flor');
    await page.locator('#word-input').press('Enter');
    await expect(page.locator('#drop-zone .ps')).toHaveCount(2);
    await page.locator('[data-action="add-studio"]').click();
    await page.locator('#ck-name').fill('Ana');
    await page.locator('#ck-email').fill('ana@site.com');
    await page.locator('[data-action="submit-order"]').click();
    await expect(page.locator('#confirmacao')).toHaveClass(/active/);
    await expect(page.locator('#conf-serial')).toHaveText(/^HRT-\d{8}-[0-9A-Z]{6}$/);
  });
});
