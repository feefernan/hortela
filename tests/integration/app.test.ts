import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;
const click = (sel: string) => $(sel).click();
const isActive = (id: string) => $(`#${id}`).classList.contains('active');

/** API de pedidos (Worker) e ViaCEP falsos: guardam o que o site enviou e respondem como os reais. */
const api = {
  sent: [] as Record<string, unknown>[],
  fail: null as null | { status: number; error: string },
  checkoutUrl: null as string | null,
  status: 'Pago',
};
const SHIPPING = [
  { id: 1, name: 'PAC', company: 'Correios', price: 22.5, days: 7 },
  { id: 2, name: 'SEDEX', company: 'Correios', price: 38.9, days: 3 },
];
const apiFetch = vi.fn(async (url: string, init?: RequestInit) => {
  if (url.startsWith('https://viacep.com.br/'))
    return Response.json({ logradouro: 'Rua do Ouvidor', bairro: 'Centro', localidade: 'Rio de Janeiro', uf: 'RJ' });
  if (url.endsWith('/status')) return Response.json({ status: api.status });
  // Banco Peças: só a Floresta nº 3 tem estoque cadastrado; as outras ficam como no código.
  if (url.endsWith('/api/catalog'))
    return Response.json({ pieces: [{ id: 'floresta-3', price: 210, total: 20, available: 12, active: true }] });
  if (url.endsWith('/api/shipping/quote')) return Response.json({ options: SHIPPING });
  const body = JSON.parse(String(init?.body));
  api.sent.push(body);
  if (api.fail) return Response.json({ error: api.fail.error }, { status: api.fail.status });
  const total = (body.kind === 'colecao' ? 185 : 200) + 22.5;
  return Response.json({ serial: 'HRT-20261015-ABC123', total, checkoutUrl: api.checkoutUrl }, { status: 201 });
});

/** CEP → frete (PAC, a primeira opção) → número; o resto do endereço vem do CEP. */
const fillDelivery = async () => {
  $<HTMLInputElement>('#ck-cep').value = '20040020';
  click('[data-action="quote-shipping"]');
  await vi.waitFor(() => expect(document.querySelectorAll('.ck-ship')).toHaveLength(2));
  $<HTMLInputElement>('#ck-number').value = '10';
};

beforeAll(async () => {
  vi.stubEnv('VITE_ORDERS_API', 'https://api.test');
  vi.stubGlobal('fetch', apiFetch);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.innerHTML = body;
  await import('../../src/main');
});

beforeEach(() => {
  click('#n-home');
});

describe('navegação', () => {
  it('começa na home e troca de página pelos links do menu', () => {
    expect(isActive('home')).toBe(true);
    click('#n-loja');
    expect(isActive('loja')).toBe(true);
    expect(isActive('home')).toBe(false);
    expect($('#n-loja').classList.contains('active')).toBe(true);
  });

  it('botões com data-page navegam', () => {
    click('.hero-btns [data-page="estudio"]');
    expect(isActive('estudio')).toBe(true);
  });
});

describe('carregamento', () => {
  it('troca os skeletons pelo conteúdo e limpa aria-busy', () => {
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('cards entram escalonados (--i) e estampas usam lazy loading', () => {
    const cards = document.querySelectorAll<HTMLElement>('#loja-grid .loja-card');
    expect(cards[2].style.getPropertyValue('--i')).toBe('2');
    const img = document.querySelector<HTMLImageElement>('#stamps-scroll img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.hasAttribute('data-lazy')).toBe(true);
  });
});

describe('rotas e URLs compartilháveis (#15)', () => {
  it('navegar muda a URL, o título e marca o link atual', () => {
    click('#n-loja');
    expect(window.location.hash).toBe('#/colecao');
    expect(document.title).toBe('Coleção — Hortelã');
    expect($('#n-loja').getAttribute('aria-current')).toBe('page');
    expect($('#n-loja').getAttribute('href')).toBe('#/colecao');
  });

  it('abrir uma peça gera link próprio; fechar volta para a coleção', () => {
    click('#n-loja');
    click('.loja-card[data-product="nevoa"]');
    expect(window.location.hash).toBe('#/peca/nevoa');
    expect(document.title).toBe('Névoa — Hortelã');
    expect($('#modal-bg').classList.contains('open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('#modal-bg').classList.contains('open')).toBe(false);
  });

  it('link direto para uma peça abre o modal (ex.: vindo do Instagram)', () => {
    history.replaceState(null, '', '#/peca/broto');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(isActive('loja')).toBe(true);
    expect($('#modal-bg').classList.contains('open')).toBe(true);
    expect($('#m-name').textContent).toBe('Broto');
    history.replaceState(null, '', '#/colecao');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect($('#modal-bg').classList.contains('open')).toBe(false);
  });

  it('o botão Voltar troca de página', () => {
    click('#n-sobre');
    history.replaceState(null, '', '#/estudio');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(isActive('estudio')).toBe(true);
  });

  it('confirmação não abre por link direto', () => {
    history.replaceState(null, '', '#/pedido');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(isActive('home')).toBe(true);
  });

  it('cards de peça são links reais', () => {
    expect($('#home-grid a.p-card').getAttribute('href')).toMatch(/^#\/peca\//);
    expect($('#loja-grid a.loja-card').getAttribute('href')).toMatch(/^#\/peca\//);
  });
});

describe('coleção', () => {
  it('renderiza 3 peças na home e 6 na coleção', () => {
    expect(document.querySelectorAll('#home-grid .p-card')).toHaveLength(3);
    expect(document.querySelectorAll('#loja-grid .loja-card')).toHaveLength(6);
  });

  it('peça esgotada não abre o modal', () => {
    const sold = [...document.querySelectorAll<HTMLElement>('.loja-card')].find((c) =>
      c.textContent?.includes('Esgotada'),
    );
    expect(sold?.dataset.action).toBeUndefined();
  });

  it('abre a peça, escolhe tamanho e adiciona ao carrinho', () => {
    click('.loja-card[data-product="floresta-3"]');
    expect($('#modal-bg').classList.contains('open')).toBe(true);
    expect($('#m-name').textContent).toBe('Floresta nº 3');
    expect($('#m-col').textContent).toBe('Coleção Véspera · Edição de 20 · 12 disponíveis');
    const sizes = document.querySelectorAll<HTMLElement>('#modal-bg .sz');
    sizes[0].click();
    expect(sizes[0].classList.contains('on')).toBe(true);
    expect(sizes[2].classList.contains('on')).toBe(false);
    click('[data-action="buy-product"]');
    expect($('#modal-bg').classList.contains('open')).toBe(false);
    expect($('#cn').textContent).toBe('1');
    expect($('#cn').classList.contains('bump')).toBe(true);
  });

  it('o carrinho lista a peça, com tamanho e subtotal (#10, #11)', () => {
    expect($('#toast-el').textContent).toBe('"Floresta nº 3" (P) no carrinho');
    click('[data-action="open-cart"]');
    expect($('#cart-drawer-bg').classList.contains('open')).toBe(true);
    expect($('#cart-open-btn').getAttribute('aria-expanded')).toBe('true');
    expect($('#cart-lines').textContent).toContain('Floresta nº 3');
    expect($('#cart-lines').textContent).toContain('Tamanho P');
    expect($('#cart-subtotal').textContent).toBe('R$ 210');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect($('#cart-drawer-bg').classList.contains('open')).toBe(false);
  });

  it('peça "última" só entra uma vez', () => {
    click('.loja-card[data-product="raizes"]');
    click('[data-action="buy-product"]');
    click('.loja-card[data-product="raizes"]');
    click('[data-action="buy-product"]');
    expect($('#toast-el').textContent).toBe('Limite desta peça já está no carrinho');
    expect($('#modal-bg').classList.contains('open')).toBe(true);
    click('[data-action="close-product"]');
    expect($('#cn').textContent).toBe('2');
    expect(JSON.parse(localStorage.getItem('hortela_cart_v1') ?? '[]')).toHaveLength(2);
  });

  it('remove itens e mostra estado vazio', () => {
    click('[data-action="open-cart"]');
    click('[data-action="remove-cart-line"][data-product="raizes"]');
    expect($('#cn').textContent).toBe('1');
    click('[data-action="remove-cart-line"]');
    expect($('#cart-lines').textContent).toContain('Seu carrinho está vazio');
    expect($('#cart-foot').hidden).toBe(true);
    expect($('#cn').classList.contains('on')).toBe(false);
    click('[data-action="cart-browse"]');
    expect(isActive('loja')).toBe(true);
    expect($('#cart-drawer-bg').classList.contains('open')).toBe(false);
  });

  it('filtros da coleção filtram de verdade (#9)', () => {
    click('#n-loja');
    click('[data-filter="disponiveis"]');
    expect(document.querySelectorAll('#loja-grid .loja-card')).toHaveLength(5);
    expect($('#loja-grid').textContent).not.toContain('Chuva fina');
    expect($('[data-filter="disponiveis"]').getAttribute('aria-pressed')).toBe('true');
    click('[data-filter="ultimas"]');
    const cards = document.querySelectorAll('#loja-grid .loja-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Raízes');
    click('[data-filter="todas"]');
    expect(document.querySelectorAll('#loja-grid .loja-card')).toHaveLength(6);
    expect($('#loja-empty').hidden).toBe(true);
  });
});

describe('checkout do carrinho', () => {
  it('finaliza peças da coleção, sem certificado, e esvazia o carrinho', async () => {
    click('.loja-card[data-product="broto"]');
    click('[data-action="buy-product"]');
    click('[data-action="open-cart"]');
    click('[data-action="checkout-cart"]');
    expect($('#checkout-modal').classList.contains('open')).toBe(true);
    expect($('#ck-stamps-label').textContent).toBe('Itens');
    expect($('#ck-stamps').textContent).toBe('Broto (G)');
    expect($('#ck-total').textContent).toBe('R$ 185');
    $<HTMLInputElement>('#ck-name').value = 'Bia';
    $<HTMLInputElement>('#ck-email').value = 'bia@site.com';
    click('[data-action="submit-order"]');
    expect($('#toast-el').textContent).toBe('Calcule o frete com o seu CEP');
    await fillDelivery();
    expect($<HTMLInputElement>('#ck-street').value).toBe('Rua do Ouvidor');
    expect($<HTMLInputElement>('#ck-cep').value).toBe('20040-020');
    expect($('#ck-shipping').textContent).toBe('R$ 22,50');
    expect($('#ck-total').textContent).toBe('R$ 207,50');
    // Escolher o SEDEX atualiza o total ao vivo.
    $<HTMLInputElement>('.ck-ship:nth-child(2) input').click();
    expect($('#ck-total').textContent).toBe('R$ 223,90');
    $<HTMLInputElement>('.ck-ship:nth-child(1) input').click();
    click('[data-action="submit-order"]');
    await vi.waitFor(() => expect(isActive('confirmacao')).toBe(true));
    expect($('#conf-stamps-label').textContent).toBe('Itens');
    expect($('#conf-cert-btn').hidden).toBe(true);
    expect($('#cn').classList.contains('on')).toBe(false);
    const sent = api.sent.at(-1) as { kind: string; items: { productId: string; size: string }[] };
    expect(sent.kind).toBe('colecao');
    expect(sent.items).toMatchObject([{ productId: 'broto', size: 'G', qty: 1 }]);
    expect(sent).not.toHaveProperty('total');
    expect(sent).toMatchObject({
      address: { cep: '20040020', street: 'Rua do Ouvidor', number: '10', city: 'Rio de Janeiro', uf: 'RJ' },
      shipping: { serviceId: 1 },
    });
  });
});

describe('estúdio', () => {
  beforeEach(() => {
    click('#n-estudio');
    click('[data-action="clear"]');
  });

  it('lista as estampas por série com o campo do alfabeto', () => {
    expect(document.querySelectorAll('#stamps-scroll .st')).toHaveLength(11);
    expect($('#word-input')).toBeTruthy();
  });

  it('adiciona estampas e palavras como camadas', () => {
    click('[data-stamp-id="s10"]');
    const input = $<HTMLInputElement>('#word-input');
    input.value = 'flor';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(input.value).toBe('');
    const layers = [...document.querySelectorAll('.layer-name')].map((e) => e.textContent);
    expect(layers).toEqual(['FLOR', 'Açucena']);
    expect($('#sc-hint').style.opacity).toBe('0');
  });

  it('recusa palavra com acento', () => {
    const input = $<HTMLInputElement>('#word-input');
    input.value = 'maçã';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect($('#word-err').style.opacity).toBe('1');
    expect(document.querySelectorAll('#drop-zone .ps')).toHaveLength(0);
  });

  it('desfaz, remove e limpa camadas', () => {
    click('[data-stamp-id="s1"]');
    click('[data-stamp-id="s2"]');
    click('[data-stamp-id="s3"]');
    click('[data-action="undo"]');
    expect(document.querySelectorAll('#drop-zone .ps')).toHaveLength(2);
    click('#drop-zone .ps [data-action="remove-stamp"]');
    expect(document.querySelectorAll('#drop-zone .ps')).toHaveLength(1);
    click('[data-action="clear"]');
    expect(document.querySelectorAll('#drop-zone .ps')).toHaveLength(0);
    expect($('#layers-wrap').textContent).toContain('Nenhuma estampa na frente');
  });

  it('ajusta a opacidade da camada selecionada', () => {
    click('[data-stamp-id="s1"]');
    const slider = $<HTMLInputElement>('#op-slider');
    slider.value = '40';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect($('#op-val').textContent).toBe('40%');
    expect($('#drop-zone .ps').style.opacity).toBe('0.4');
  });

  it('troca modelo e recalcula o total', () => {
    click('[data-action="pick-model"][data-model="long"]');
    expect($('#o-total').textContent).toBe('R$ 220');
    click('[data-action="pick-model"][data-model="oversized"]');
    expect($('#o-total').textContent).toBe('R$ 200');
  });

  it('troca a cor da peça', () => {
    click('[data-action="pick-color"][data-name="Musgo"]');
    expect($('#shirt-body').getAttribute('fill')).toBe('#3C4E2E');
  });

  it('pede ao menos uma estampa antes do checkout', () => {
    click('[data-action="add-studio"]');
    expect($('#checkout-modal').classList.contains('open')).toBe(false);
    expect($('#toast-el').textContent).toBe('Adicione pelo menos uma estampa');
  });
});

describe('estúdio: frente, costas, modelo e gestos', () => {
  const ps = (zone = '#drop-zone') => [...document.querySelectorAll<HTMLElement>(`${zone} .ps`)];
  const rect = (el: HTMLElement) => ({
    x: Number.parseFloat(el.style.left),
    y: Number.parseFloat(el.style.top),
    w: Number.parseFloat(el.style.width),
    h: Number.parseFloat(el.style.height),
  });

  beforeEach(() => {
    click('#n-estudio');
    click('[data-view="costas"]');
    click('[data-action="clear"]');
    click('[data-view="frente"]');
    click('[data-action="clear"]');
  });

  it('distribui estampas novas sem empilhar (#12)', () => {
    click('[data-stamp-id="s1"]');
    click('[data-stamp-id="s2"]');
    const [a, b] = ps().map(rect);
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(overlap).toBe(false);
  });

  it('frente e costas têm composições independentes (#12)', () => {
    click('[data-stamp-id="s10"]');
    click('[data-view="costas"]');
    expect($('#drop-zone').hidden).toBe(true);
    expect($('#drop-zone-back').hidden).toBe(false);
    expect($('#vc').getAttribute('aria-pressed')).toBe('true');
    expect($('#layers-wrap').textContent).toContain('Nenhuma estampa nas costas');
    expect($('#shirt-collar').getAttribute('d')).toContain('Q 144 44');
    const input = $<HTMLInputElement>('#word-input');
    input.value = 'sol';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(ps('#drop-zone-back')).toHaveLength(1);
    expect(ps('#drop-zone')).toHaveLength(1);
    click('[data-action="clear"]');
    expect(ps('#drop-zone-back')).toHaveLength(0);
    expect(ps('#drop-zone')).toHaveLength(1);
  });

  it('pedido lista os dois lados e nomeia palavras (#8)', () => {
    click('[data-stamp-id="s10"]');
    click('[data-view="costas"]');
    const input = $<HTMLInputElement>('#word-input');
    input.value = 'flor';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    click('[data-action="add-studio"]');
    expect($('#ck-view').textContent).toBe('Frente e costas');
    expect($('#ck-stamps').textContent).toBe('Frente: Açucena, Costas: Palavra "FLOR"');
    click('[data-action="close-checkout"]');
  });

  it('Camisetão muda a silhueta (#12)', () => {
    const before = $('#shirt-body').getAttribute('d');
    click('[data-action="pick-model"][data-model="long"]');
    expect($('#shirt-body').getAttribute('d')).not.toBe(before);
    click('[data-action="pick-model"][data-model="oversized"]');
    expect($('#shirt-body').getAttribute('d')).toBe(before);
  });

  it('botões de ferramenta têm rótulo acessível', () => {
    for (const action of ['undo', 'center', 'clear']) {
      expect($(`.sc-btn[data-action="${action}"]`).getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('arrasta e redimensiona com Pointer Events, inclusive toque (#13)', () => {
    click('[data-stamp-id="s1"]');
    const el = ps()[0];
    const start = rect(el);
    const fire = (target: EventTarget, type: string, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
    fire(el, 'pointerdown', 100, 100);
    fire(document, 'pointermove', 130, 90);
    fire(document, 'pointerup', 130, 90);
    expect(rect(el).x).toBe(start.x + 30);
    expect(rect(el).y).toBe(start.y - 10);

    fire(el.querySelector('.ps-resize') as Element, 'pointerdown', 0, 0);
    fire(document, 'pointermove', 40, 0);
    fire(document, 'pointercancel', 40, 0);
    expect(rect(el).w).toBe(start.w + 40);
    fire(document, 'pointermove', 400, 0);
    expect(rect(el).w).toBe(start.w + 40);
  });
});

describe('palco no celular (#14)', () => {
  it('reduz a escala para caber na tela e nunca amplia', async () => {
    const { updateStageScale } = await import('../../src/ui/studio');
    const scale = () => Number(document.documentElement.style.getPropertyValue('--stage-scale'));
    updateStageScale(1280);
    expect(scale()).toBe(1);
    updateStageScale(320);
    expect(scale()).toBeCloseTo((320 - 32) / 360);
    updateStageScale(100);
    expect(scale()).toBe(0.5);
  });

  it('arrastar respeita a escala do palco', async () => {
    const { updateStageScale } = await import('../../src/ui/studio');
    click('#n-estudio');
    click('[data-action="clear"]');
    click('[data-stamp-id="s1"]');
    const el = document.querySelector<HTMLElement>('#drop-zone .ps') as HTMLElement;
    const x0 = Number.parseFloat(el.style.left);
    updateStageScale(212); // escala 0.5
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 0 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(Number.parseFloat(el.style.left)).toBe(x0 + 100);
    updateStageScale(1280);
    click('[data-action="clear"]');
  });
});

describe('Surpresa (#41)', () => {
  it('trocar de lado no meio não leva estampas para o outro lado', () => {
    vi.useFakeTimers();
    click('#n-estudio');
    click('[data-view="costas"]');
    click('[data-action="clear"]');
    click('[data-view="frente"]');
    click('[data-action="surprise"]');
    vi.advanceTimersByTime(0);
    click('[data-view="costas"]');
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    expect(document.querySelectorAll('#drop-zone-back .ps')).toHaveLength(0);
    expect(document.querySelectorAll('#drop-zone .ps').length).toBeGreaterThanOrEqual(1);
    click('[data-view="frente"]');
    click('[data-action="clear"]');
  });
});

describe('arquivo de produção', () => {
  it('inclui as aquarelas como <image> e os dois lados', async () => {
    click('#n-estudio');
    click('[data-view="costas"]');
    click('[data-action="clear"]');
    click('[data-view="frente"]');
    click('[data-action="clear"]');
    click('[data-stamp-id="s11"]');
    click('[data-view="costas"]');
    click('[data-stamp-id="s10"]');
    const { exportProductionSVG } = await import('../../src/ui/capture');
    const svg = exportProductionSVG('HRT-TESTE');
    expect(svg).toContain('<g id="frente"');
    expect(svg).toContain('<g id="costas"');
    expect(svg).toMatch(/<image href="http[^"]*\/images\/s11\.png"/);
    expect(svg).toMatch(/<image href="http[^"]*\/images\/s10\.png"/);
    expect(svg).toContain('Serial: HRT-TESTE');
    click('[data-action="clear"]');
    click('[data-view="frente"]');
    click('[data-action="clear"]');
  });
});

describe('checkout', () => {
  it('valida os dados, envia ao Worker e mostra o serial que ele devolveu', async () => {
    click('#n-estudio');
    click('[data-action="clear"]');
    click('[data-stamp-id="s11"]');
    click('[data-action="add-studio"]');
    expect($('#checkout-modal').classList.contains('open')).toBe(true);
    expect($('#ck-stamps').textContent).toBe('Camanducaia');

    click('[data-action="submit-order"]');
    expect($('#toast-el').textContent).toBe('Preencha nome e e-mail');

    $<HTMLInputElement>('#ck-name').value = 'Ana';
    $<HTMLInputElement>('#ck-email').value = 'ana@site.com';
    await fillDelivery();
    click('[data-action="submit-order"]');
    await vi.waitFor(() => expect(isActive('confirmacao')).toBe(true));
    expect(window.location.hash).toBe('#/pedido/HRT-20261015-ABC123');
    expect($('#conf-serial').textContent).toBe('HRT-20261015-ABC123');
    expect($('#conf-stamps').textContent).toBe('Camanducaia');
    expect($('#conf-cert-btn').hidden).toBe(false);

    const sent = api.sent.at(-1) as {
      kind: string;
      studio: { model: string; stamps: string[] };
      productionSvg: string;
    };
    expect(apiFetch).toHaveBeenLastCalledWith(
      'https://api.test/api/orders',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sent.kind).toBe('estudio');
    expect(sent.studio).toMatchObject({ model: 'oversized', stamps: ['Camanducaia'] });
    expect(sent.productionSvg).toContain('Serial: __SERIAL__');
    expect(sent).not.toHaveProperty('total');
    expect(sent).not.toHaveProperty('serial');
  });

  it('se o Worker recusar, mostra o motivo e não perde nada', async () => {
    click('#n-estudio');
    click('[data-action="clear"]');
    click('[data-stamp-id="s10"]');
    click('[data-action="add-studio"]');
    $<HTMLInputElement>('#ck-name').value = 'Bia';
    $<HTMLInputElement>('#ck-email').value = 'bia@site.com';
    await fillDelivery();
    api.fail = { status: 502, error: 'Não foi possível registrar o pedido agora. Tente de novo.' };
    click('[data-action="submit-order"]');
    await vi.waitFor(() => expect($('#toast-el').textContent).toBe(api.fail?.error));
    api.fail = null;
    expect(isActive('confirmacao')).toBe(false);
    expect($('#checkout-modal').classList.contains('open')).toBe(true);
    expect($<HTMLInputElement>('#ck-name').value).toBe('Bia');
    expect($<HTMLButtonElement>('#ck-submit').disabled).toBe(false);
    expect(document.querySelectorAll('#drop-zone .ps')).toHaveLength(1);
    click('[data-action="close-checkout"]');
  });
});

describe('pagamento no Mercado Pago', () => {
  it('vai para o pagamento e, na volta, mostra o pedido com o status real', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // jsdom não navega para fora
    click('#n-estudio');
    click('[data-action="clear"]');
    click('[data-stamp-id="s10"]');
    click('[data-action="add-studio"]');
    $<HTMLInputElement>('#ck-name').value = 'Caio';
    $<HTMLInputElement>('#ck-email').value = 'caio@site.com';
    await fillDelivery();
    api.checkoutUrl = 'https://mp.test/pagar';
    click('[data-action="submit-order"]');
    await vi.waitFor(() => expect(sessionStorage.getItem('hortela_pedido_pendente')).toContain('HRT-20261015-ABC123'));
    api.checkoutUrl = null;
    expect(isActive('confirmacao')).toBe(false);

    // O Mercado Pago devolve para #/pedido/<serial> com os parâmetros dele.
    window.location.hash = '#/pedido/HRT-20261015-ABC123?collection_status=approved';
    await vi.waitFor(() => expect($('#conf-status').textContent).toBe('Pagamento aprovado'));
    expect(isActive('confirmacao')).toBe(true);
    expect($('#conf-name').textContent).toBe('Caio');
    expect($('#conf-cert-btn').hidden).toBe(false);
  });

  it('pagamento recusado diz isso na volta', async () => {
    api.status = 'Cancelado';
    window.location.hash = '#/pedido/HRT-20261015-XYZ789';
    await vi.waitFor(() => expect($('#conf-status').textContent).toBe('Pagamento não aprovado'));
    expect($('#conf-serial').textContent).toBe('HRT-20261015-XYZ789');
    api.status = 'Pago';
  });
});
