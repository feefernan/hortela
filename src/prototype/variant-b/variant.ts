/**
 * Variação B — "A folha de numeração" (tasteskill: contact-sheet).
 * Ideia: a edição numerada vira a folha de contatos. Cada obra é uma fileira com um quadro por
 * número (nº 1 a nº 20): os vendidos ficam como fichas apagadas, a próxima disponível sobe do
 * tamanho das outras. Nada é destacado pela loja; quem escolhe o número é o visitante.
 * Ação principal: clicar no quadro levantado (a próxima disponível).
 */
import type { Route } from '../../domain/routes';
import {
  artImg,
  bindComposer,
  DEFAULT_WORD,
  editionLine,
  findPiece,
  formatBRL,
  type Piece,
  pieces,
  STUDIO_PRICE,
  shirt,
  sizeTable,
  wordSVG,
} from '../shared';
import './style.css';

export const key = 'B';
export const name = 'A folha de numeração';

const band = () => `<header class="pvb-band">
  <a class="pvb-cell pvb-word" href="#/">hortelã</a>
  <p class="pvb-cell pvb-what">Arte vestível autoral em edições numeradas. Quando esgota, esgotou.</p>
  <nav class="pvb-cell pvb-links" aria-label="Principal">
    <a href="#/colecao">Coleção</a><a href="#/estudio">Estúdio</a><a href="#/sobre">Sobre</a>
  </nav>
  <p class="pvb-cell pvb-reach"><a href="mailto:contato@usehortela.art.br">contato@usehortela.art.br</a><br><a href="https://instagram.com/usehortela">@usehortela</a></p>
  <a class="pvb-cell pvb-cart" href="#/estudio">Carrinho (0)</a>
</header>`;

const frames = (p: Piece, big = false) =>
  Array.from({ length: p.edition.total }, (_, i) => i + 1)
    .map((n) => {
      if (p.next !== null && n === p.next)
        return `<a class="pvb-frame lifted" href="#/peca/${p.id}">${artImg(p, false)}<span>nº ${n} · a próxima</span></a>`;
      if (n < (p.next ?? p.edition.total + 1))
        return `<span class="pvb-frame sold" title="nº ${n}, vendida"><span>nº ${n}</span></span>`;
      return `<a class="pvb-frame" href="#/peca/${p.id}" aria-label="${p.name}, nº ${n}">${artImg(p, false)}${big ? `<span>nº ${n}</span>` : ''}</a>`;
    })
    .join('');

const run = (p: Piece) => `<section class="pvb-run" aria-labelledby="pvb-${p.id}">
  <h2 id="pvb-${p.id}" class="pvb-run-title"><a href="#/peca/${p.id}">${p.name}</a> <span>${p.collection} · ${formatBRL(p.price)} · ${p.next === null ? 'esgotada' : `${p.avail} de ${p.edition.total} disponíveis`}</span></h2>
  <div class="pvb-frames">${frames(p)}</div>
</section>`;

const studioRun = () => `<section class="pvb-run pvb-studio" aria-labelledby="pvb-studio">
  <h2 id="pvb-studio" class="pvb-run-title"><a href="#/estudio">Estúdio</a> <span>a sua palavra, edição de 1 · ${STUDIO_PRICE}</span></h2>
  <div class="pvb-frames">
    <a class="pvb-frame lifted pvb-studio-frame" href="#/estudio">${shirt(`<div data-pv-word-out>${wordSVG(DEFAULT_WORD)}</div>`, '#F3EDE0')}<span>nº 1 de 1 · a sua</span></a>
    <div class="pvb-studio-form">
      <label for="pvb-word">Escreva uma palavra e veja nas letras pintadas da Hortelã</label>
      <input id="pvb-word" data-pv-word maxlength="10" value="${DEFAULT_WORD}" autocomplete="off" spellcheck="false">
      <a class="pvb-btn" href="#/estudio">Montar no Estúdio</a>
    </div>
  </div>
</section>`;

const dropCap = (p: Piece, text: string, more: string) => `<section class="pvb-about" aria-labelledby="pvb-about-h">
  <h2 id="pvb-about-h" class="pvb-sr">Sobre a Hortelã</h2>
  <dl class="pvb-facts">
    <div><dt>Onde</dt><dd>Brasil, envio para todo o país</dd></div>
    <div><dt>Edições</dt><dd>Até 20 peças por obra</dd></div>
    <div><dt>Contato</dt><dd><a href="mailto:contato@usehortela.art.br">contato@usehortela.art.br</a></dd></div>
  </dl>
  <div class="pvb-statement">
    <p><img src="${p.art}" alt="" width="400" height="400"><strong>Hortelã</strong> ${text}</p>
    <p class="pvb-soft">${more}</p>
  </div>
</section>`;

const ABOUT = [
  'pinta cada estampa à mão, no papel, antes de ela virar tecido. Cada obra sai numa edição curta, e cada peça leva o seu número: a nº 1 é a primeira a sair do ateliê, a última fecha a obra.',
  'Não há reposição nem calendário de moda. No Estúdio é o contrário: você compõe, e a peça existe uma vez só.',
];

const footer = () => `<footer class="pvb-foot">
  <div class="pvb-tile pvb-t-statement"><p>Cada peça, <em>uma obra.</em></p><p class="pvb-legal">© Hortelã · CNPJ de exemplo</p></div>
  <nav class="pvb-tile pvb-t-nav" aria-label="Rodapé"><a href="#/colecao">Coleção</a><a href="#/estudio">Estúdio</a><a href="#/sobre">Sobre</a><a href="https://instagram.com/usehortela">Instagram</a></nav>
  <div class="pvb-tile pvb-t-mail"><p>Trocas, envio e dúvidas</p><a href="mailto:contato@usehortela.art.br">contato@usehortela.art.br</a></div>
  <a class="pvb-tile pvb-t-accent" href="#/estudio"><span>Monte a sua</span>
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><path d="M8 40 L40 8 M18 8 H40 V30" fill="none" stroke="currentColor" stroke-width="4"/></svg></a>
  <div class="pvb-tile pvb-t-name" aria-hidden="true">hortelã</div>
</footer>`;

const home = (list: Piece[]) => `${band()}
  <main>
    <h1 class="pvb-h1">Cada peça, <em>uma obra.</em></h1>
    <div class="pvb-sheet">${studioRun()}${list.map(run).join('')}</div>
    ${dropCap(list[2] ?? list[0], ABOUT[0], ABOUT[1])}
  </main>`;

const collection = (list: Piece[]) => `${band()}
  <main>
    <h1 class="pvb-h1">Coleção</h1>
    <section class="pvb-ledger" aria-labelledby="pvb-ledger-h">
      <h2 id="pvb-ledger-h">Todas as obras</h2>
      <p class="pvb-ledger-sub">Cada quadradinho é uma peça numerada; o lilás é a próxima.</p>
      <ul>${list
        .map(
          (p) => `<li><a href="#/peca/${p.id}" data-preview="${p.art}">
          <span class="pvb-l-name">${p.name}</span>
          <span class="pvb-l-kind">${p.collection}</span>
          <span class="pvb-l-dots" aria-hidden="true">${Array.from({ length: p.edition.total }, (_, i) => `<i class="${p.next !== null && i + 1 === p.next ? 'n' : i + 1 < (p.next ?? 99) ? 's' : ''}"></i>`).join('')}</span>
          <span class="pvb-l-next">${p.next === null ? 'esgotada' : `nº ${p.next} de ${p.edition.total}`}</span>
          <span class="pvb-l-price">${formatBRL(p.price)}</span>
          <img class="pvb-l-img" src="${p.art}" alt="" width="400" height="300">
        </a></li>`,
        )
        .join('')}</ul>
      <div class="pvb-preview" aria-hidden="true"><img alt="" width="300" height="225"></div>
    </section>
  </main>`;

const product = (p: Piece, list: Piece[]) => `${band()}
  <main>
    <h1 class="pvb-h1">${p.name}</h1>
    <section class="pvb-piece" aria-labelledby="pvb-buy-h">
      <div class="pvb-piece-notes">
        <h2 id="pvb-buy-h">${editionLine(p)}</h2>
        <p>${p.collection} · ${formatBRL(p.price)}</p>
        <p class="pvb-soft">Escolha o tamanho; o número definitivo é confirmado quando o pagamento é aprovado.</p>
        <fieldset class="pvb-sizes"><legend>Tamanho</legend>
          ${['P', 'M', 'G', 'GG'].map((s) => `<label><input type="radio" name="pvb-size" value="${s}"${s === 'G' ? ' checked' : ''}><span>${s}</span></label>`).join('')}
        </fieldset>
        <button type="button" class="pvb-btn" data-stub ${p.next === null ? 'disabled' : ''}>${p.next === null ? 'Esgotada' : `Levar a nº ${p.next}`}</button>
        <p class="pvb-stub" hidden>Protótipo: o botão ainda não compra.</p>
        <details class="pvb-chart"><summary>Tabela de medidas</summary>${sizeTable()}</details>
      </div>
      <div class="pvb-frames pvb-frames-big">${frames(p, true)}</div>
    </section>
    ${dropCap(p, p.story.charAt(0).toLowerCase() + p.story.slice(1), 'Aquarela original digitalizada e impressa em algodão; a arte aqui é provisória.').replace('<strong>Hortelã</strong>', `<strong>${p.name}:</strong>`)}
    <div class="pvb-sheet"><h2 class="pvb-more">Outras obras</h2>${list
      .filter((x) => x.id !== p.id)
      .map(run)
      .join('')}</div>
  </main>`;

const about = (list: Piece[]) => `${band()}
  <main>
    <h1 class="pvb-h1">Sobre a Hortelã</h1>
    ${dropCap(list[0], ABOUT[0], ABOUT[1])}
    <div class="pvb-sheet">${list.slice(0, 2).map(run).join('')}</div>
  </main>`;

export const render = (route: Route) => {
  const list = pieces();
  const p = route.productId ? findPiece(route.productId) : undefined;
  const body =
    route.page === 'sobre' ? about(list) : p ? product(p, list) : route.page === 'loja' ? collection(list) : home(list);
  return `<div class="pvb">${body}${footer()}</div>`;
};

export const mount = (root: HTMLElement) => {
  const unbind = bindComposer(root);
  const preview = root.querySelector<HTMLElement>('.pvb-preview');
  const onOver = (event: Event) => {
    const a = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-preview]');
    if (!a || !preview) return;
    const img = preview.querySelector('img') as HTMLImageElement;
    img.src = a.dataset.preview as string;
    preview.style.top = `${a.offsetTop}px`;
    preview.classList.add('on');
    a.closest('ul')?.classList.add('dim');
    for (const x of root.querySelectorAll('[data-preview]')) x.classList.toggle('on', x === a);
  };
  const onLeave = (event: Event) => {
    if (!(event.target as HTMLElement).matches?.('.pvb-ledger ul')) return;
    preview?.classList.remove('on');
    root.querySelector('.pvb-ledger ul')?.classList.remove('dim');
  };
  const onClick = (event: Event) => {
    if ((event.target as HTMLElement).closest('[data-stub]'))
      root.querySelector<HTMLElement>('.pvb-stub')?.removeAttribute('hidden');
  };
  root.addEventListener('pointerover', onOver);
  root.addEventListener('focusin', onOver);
  root.addEventListener('pointerleave', onLeave, true);
  root.addEventListener('click', onClick);
  return () => {
    unbind();
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('focusin', onOver);
    root.removeEventListener('pointerleave', onLeave, true);
    root.removeEventListener('click', onClick);
  };
};
