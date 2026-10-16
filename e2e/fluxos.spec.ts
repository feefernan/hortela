import { expect, test } from '@playwright/test';

// Worker de pedidos e ViaCEP simulados: respondem como as APIs reais.
test.beforeEach(async ({ page }) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  await page.route('https://api.test/api/orders', async (route) => {
    const body = route.request().postDataJSON() as { kind: string };
    await route.fulfill({
      status: 201,
      headers: cors,
      json: { serial: 'HRT-20261015-E2E000', total: (body.kind === 'colecao' ? 210 : 200) + 22.5, checkoutUrl: null },
    });
  });
  await page.route('https://api.test/api/shipping/quote', (route) =>
    route.fulfill({
      headers: cors,
      json: { options: [{ id: 1, name: 'PAC', company: 'Correios', price: 22.5, days: 7 }] },
    }),
  );
  await page.route('https://viacep.com.br/**', (route) =>
    route.fulfill({
      headers: cors,
      json: { logradouro: 'Rua do Ouvidor', bairro: 'Centro', localidade: 'Rio de Janeiro', uf: 'RJ' },
    }),
  );
});

/** CEP → frete → número da casa (o resto do endereço vem do CEP). */
const fillDelivery = async (page: import('@playwright/test').Page) => {
  await page.locator('#ck-cep').fill('20040020');
  await page.locator('#ck-cep').press('Enter');
  await expect(page.locator('.ck-ship')).toHaveCount(1);
  await page.locator('#ck-number').fill('10');
};

test.describe('fluxos principais', () => {
  test('home carrega sem erros de console', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Cada peça/ })).toBeVisible();
    await expect(page.locator('#home-grid .p-card')).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test('coleção → carrinho → pedido', async ({ page }) => {
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
    await fillDelivery(page);
    await page.locator('[data-action="submit-order"]').click();
    await expect(page.locator('#confirmacao')).toHaveClass(/active/);
    await expect(page.locator('#conf-cert-btn')).toBeHidden();
  });

  test('compõe no estúdio e finaliza o pedido', async ({ page }) => {
    await page.goto('/');
    await page.locator('#n-estudio').click();
    await page.locator('[data-stamp-id="s10"]').click();
    await page.locator('#word-input').fill('flor');
    await page.locator('#word-input').press('Enter');
    await expect(page.locator('#drop-zone .ps')).toHaveCount(2);
    await page.locator('[data-action="add-studio"]').click();
    await page.locator('#ck-name').fill('Ana');
    await page.locator('#ck-email').fill('ana@site.com');
    await fillDelivery(page);
    await page.locator('[data-action="submit-order"]').click();
    await expect(page.locator('#confirmacao')).toHaveClass(/active/);
    await expect(page.locator('#conf-serial')).toHaveText('HRT-20261015-E2E000');
  });
});

test.describe('layout responsivo', () => {
  test('sem rolagem horizontal em nenhuma página', async ({ page }) => {
    await page.goto('/');
    for (const id of ['n-home', 'n-loja', 'n-estudio', 'n-sobre']) {
      await page.locator(`#${id}`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, id).toBeLessThanOrEqual(0);
    }
  });

  test('no celular, total e botão do Estúdio ficam visíveis', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'só no celular');
    await page.goto('/');
    await page.locator('#n-estudio').click();
    await page.locator('[data-stamp-id="s10"]').click();
    await page.mouse.wheel(0, 600);
    await expect(page.locator('[data-action="add-studio"]')).toBeInViewport();
    await expect(page.locator('#n-loja')).toBeInViewport();
  });
});

test.describe('rotas e compartilhamento', () => {
  test('link direto de uma peça e botão Voltar', async ({ page }) => {
    await page.goto('/#/peca/raizes');
    await expect(page.locator('#m-name')).toHaveText('Raízes');
    await expect(page).toHaveTitle('Raízes — Hortelã');
    await page.locator('#modal-bg .modal-close').click();
    await expect(page).toHaveURL(/#\/colecao$/);
    await page.locator('#n-sobre').click();
    await expect(page).toHaveURL(/#\/sobre$/);
    await page.goBack();
    await expect(page.locator('#loja')).toHaveClass(/active/);
  });

  test('metadados de compartilhamento e arquivos de SEO', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /aquarela/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);
    for (const path of ['/og.png', '/favicon.svg', '/robots.txt', '/sitemap.xml']) {
      expect((await request.get(path)).ok(), path).toBe(true);
    }
  });
});
