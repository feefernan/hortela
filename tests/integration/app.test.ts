import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel) as T;
const click = (sel: string) => $(sel).click();
const isActive = (id: string) => $(`#${id}`).classList.contains('active');

beforeAll(async () => {
  vi.stubEnv('VITE_PANEL_PASSWORD_SHA256', createHash('sha256').update('senha-de-teste').digest('hex'));
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
    expect($('#m-col').textContent).toBe('Coleção Véspera · Ed. 8 de 20');
    const sizes = document.querySelectorAll<HTMLElement>('#modal-bg .sz');
    sizes[0].click();
    expect(sizes[0].classList.contains('on')).toBe(true);
    expect(sizes[2].classList.contains('on')).toBe(false);
    click('[data-action="buy-product"]');
    expect($('#modal-bg').classList.contains('open')).toBe(false);
    expect($('#cn').textContent).toBe('1');
    expect($('#cn').classList.contains('bump')).toBe(true);
  });

  it('o carrinho ainda é só um contador', () => {
    click('[data-action="cart"]');
    expect($('#toast-el').textContent).toBe('Carrinho vazio');
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
    expect($('#layers-wrap').textContent).toContain('Nenhuma estampa adicionada');
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

describe('checkout', () => {
  it('valida os dados e finaliza o pedido salvando no repositório', async () => {
    click('#n-estudio');
    click('[data-action="clear"]');
    click('[data-stamp-id="s11"]');
    click('[data-action="add-studio"]');
    expect($('#checkout-modal').classList.contains('open')).toBe(true);
    expect($('#ck-stamps').textContent).toBe('Camanducaia');

    click('[data-action="submit-order"]');
    expect($('#toast-el').textContent).toBe('Preencha nome e e-mail');

    // Payload de XSS no nome: precisa aparecer como texto no painel (#18).
    $<HTMLInputElement>('#ck-name').value = '<img src=x onerror="window.__xss=1">Ana';
    $<HTMLInputElement>('#ck-email').value = 'ana@site.com';
    click('[data-action="submit-order"]');
    await vi.waitFor(() => expect(isActive('confirmacao')).toBe(true));
    expect($('#conf-serial').textContent).toMatch(/^HRT-\d{8}-[0-9A-Z]{6}$/);
    expect($('#conf-stamps').textContent).toBe('Camanducaia');

    const saved = JSON.parse(localStorage.getItem('hortela_orders_v1') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: 'novo', hasSVG: true });
    expect(saved[0].name).toContain('Ana');
  });
});

describe('painel', () => {
  it('recusa senha errada e mantém o painel fechado', async () => {
    click('[data-action="open-panel"]');
    expect($('#panel-login').classList.contains('open')).toBe(true);
    $<HTMLInputElement>('#panel-pw').value = 'errada';
    click('[data-action="panel-login"]');
    await vi.waitFor(() => expect($('#panel-pw-err').style.opacity).toBe('1'));
    expect(isActive('painel')).toBe(false);
    click('[data-action="close-panel-login"]');
    expect($('#panel-login').classList.contains('open')).toBe(false);
  });

  it('com a senha certa lista (escapando dados do cliente), muda status e apaga', async () => {
    click('[data-action="open-panel"]');
    const pw = $<HTMLInputElement>('#panel-pw');
    pw.value = 'senha-de-teste';
    pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect(isActive('painel')).toBe(true));
    expect($('#panel-count').textContent).toBe('1 pedido');
    expect(document.querySelector('#panel-list img[src="x"]')).toBeNull();
    expect($('#panel-list').textContent).toContain('<img src=x');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    expect(sessionStorage.getItem('hortela_panel_auth')).not.toBe('senha-de-teste');

    const select = $<HTMLSelectElement>('.pc-select');
    select.value = 'enviado';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('hortela_orders_v1') ?? '[]')[0].status).toBe('enviado');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    click('[data-action="panel-delete"]');
    expect($('#panel-count').textContent).toBe('0 pedidos');
    expect($('#panel-empty').style.display).toBe('block');

    click('[data-action="panel-logout"]');
    expect(isActive('home')).toBe(true);
    click('[data-action="open-panel"]');
    expect(isActive('painel')).toBe(false);
  });
});
