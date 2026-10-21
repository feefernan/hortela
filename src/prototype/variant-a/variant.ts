/**
 * Variação A — "A metade fixa" (tasteskill: split-stage).
 * Ideia: a edição numerada vira a metade que não se mexe. A camiseta fica parada à esquerda
 * com o número da próxima peça em foco ("nº 9 de 20"); a coluna da direita rola com o resto.
 * Ação principal: escrever a palavra e levar ao Estúdio (na home), levar o número (na peça).
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

export const key = 'A';
export const name = 'A metade fixa';

const numberLine = (p: Piece) => (p.next === null ? 'Esgotada' : `nº ${p.next} de ${p.edition.total}`);

const stageLayer = (id: string, art: string, number: string, caption: string, on: boolean) =>
  `<div class="pva-layer${on ? ' on' : ''}" data-layer="${id}">
    <div class="pva-stage-shirt">${art}</div>
    <p class="pva-stage-num">${number}</p>
    <p class="pva-stage-cap">${caption}</p>
  </div>`;

const pieceLayer = (p: Piece, on: boolean) =>
  stageLayer(p.id, shirt(artImg(p, false)), numberLine(p), `${p.name} · ${p.collection}`, on);

const nav = () => `<header class="pva-nav">
  <a class="pva-word" href="#/">hortelã</a>
  <nav aria-label="Principal">
    <a href="#/colecao">Coleção</a><a href="#/sobre">Sobre</a><a href="#/estudio">Carrinho</a>
    <a class="pva-nav-action" href="#/estudio">Estúdio</a>
  </nav>
</header>`;

const names = (list: Piece[], full = false) =>
  `<ul class="pva-names">${list
    .map(
      (p, i) => `<li data-collection="${p.collection}">
      <a href="#/peca/${p.id}" data-show="${p.id}"${i === 0 ? ' class="on"' : ''}>
        <span class="pva-name">${p.name}</span>
        <span class="pva-name-meta">${full ? `${p.collection} · ${formatBRL(p.price)} · ` : ''}${numberLine(p)}</span>
      </a></li>`,
    )
    .join('')}</ul>`;

const home = (list: Piece[]) => {
  const last = list.find((p) => p.next !== null && p.avail === 1) ?? list[0];
  return {
    stage:
      stageLayer(
        'studio',
        shirt(`<div data-pv-word-out>${wordSVG(DEFAULT_WORD)}</div>`),
        'nº 1 de 1',
        'Peça do Estúdio: a sua palavra, uma vez só',
        true,
      ) + list.map((p) => pieceLayer(p, false)).join(''),
    col: `
    <section class="pva-hero">
      <h1>Cada peça, <em>uma obra.</em></h1>
      <p class="pva-lede">Arte vestível autoral em edições numeradas. Quando esgota, esgotou.</p>
    </section>
    <section class="pva-compose" aria-labelledby="pva-compose-h">
      <h2 id="pva-compose-h">Escreva a sua</h2>
      <label class="pva-field">
        <span>Uma palavra, nas letras pintadas da Hortelã</span>
        <input data-pv-word maxlength="10" value="${DEFAULT_WORD}" autocomplete="off" spellcheck="false">
      </label>
      <p>Ela aparece na camiseta ao lado. No Estúdio você escolhe as cores, o lugar e as aquarelas, e a peça sai como edição única.</p>
      <div class="pva-actions">
        <a class="pva-btn" href="#/estudio">Montar no Estúdio · ${STUDIO_PRICE}</a>
        <a class="pva-link" href="#/colecao">Ver a coleção</a>
      </div>
    </section>
    <section class="pva-index" aria-labelledby="pva-index-h">
      <h2 id="pva-index-h">A coleção</h2>
      ${names(list)}
    </section>`,
    after: `
    <section class="pva-plate" aria-labelledby="pva-plate-h">
      <div class="pva-plate-art">${artImg(last)}</div>
      <div class="pva-plate-text">
        <p class="pva-plate-tabs"><span class="on">Edição de ${last.edition.total}</span><span>${last.collection}</span><span>${formatBRL(last.price)}</span></p>
        <div>
          <h2 id="pva-plate-h">${last.name}</h2>
          <p>${last.story}</p>
        </div>
        <div class="pva-cells">
          <a class="pva-cell ink" href="#/peca/${last.id}">${last.next === null ? 'Esgotada' : `Levar a nº ${last.next}`}</a>
          <a class="pva-cell" href="#/peca/${last.id}">Ver a peça</a>
        </div>
      </div>
    </section>
    ${letter()}`,
  };
};

const letter = () => `<section class="pva-letter" aria-labelledby="pva-letter-h">
  <h2 id="pva-letter-h">Por que numeramos</h2>
  <p>Cada estampa nasce de uma pintura minha, feita no papel antes de pensar em tecido. Quando ela vira camiseta, imprimo um número curto de peças, e cada uma leva o seu número.</p>
  <p>Não reponho. Quando a nº 20 de 20 sai, a obra fica completa e a próxima começa a ser pintada.</p>
  <p>No Estúdio é o contrário: você compõe, e a peça existe uma vez só.</p>
  <p class="pva-sign">Hortelã<span>texto de exemplo para a Hortelã reescrever</span></p>
</section>`;

const collection = (list: Piece[]) => ({
  stage: list.map((p, i) => pieceLayer(p, i === 0)).join(''),
  col: `<section class="pva-hero">
    <h1>Coleção</h1>
    <p class="pva-lede">${list.length} obras, cada peça com o seu número. Passe o dedo ou o mouse para ver ao lado.</p>
    <p class="pva-tabs" role="group" aria-label="Filtrar por coleção">
      ${['Todas', ...new Set(list.map((p) => p.collection))].map((c, i) => `<button type="button" data-filter="${c}"${i === 0 ? ' aria-pressed="true"' : ' aria-pressed="false"'}>${c}</button>`).join('')}
    </p>
  </section>
  <section class="pva-index" aria-label="Peças">${names(list, true)}</section>`,
  after: '',
});

const product = (p: Piece, list: Piece[]) => ({
  stage: pieceLayer(p, true),
  col: `<section class="pva-hero">
    <a class="pva-back" href="#/colecao">← Coleção</a>
    <h1>${p.name}</h1>
    <p class="pva-lede">${p.collection} · ${formatBRL(p.price)}</p>
  </section>
  <section class="pva-buy" aria-labelledby="pva-buy-h">
    <h2 id="pva-buy-h">${editionLine(p)}</h2>
    <p>${p.next === null ? 'Esta obra está completa. Não haverá reposição.' : 'O número definitivo é confirmado quando o pagamento é aprovado.'}</p>
    <ol class="pva-run" aria-label="As ${p.edition.total} peças da edição">
      ${Array.from({ length: p.edition.total }, (_, i) => i + 1)
        .map((n) => {
          const state =
            p.next !== null && n === p.next ? 'next' : n < (p.next ?? p.edition.total + 1) ? 'sold' : 'free';
          return `<li class="${state}" title="nº ${n}${state === 'sold' ? ', vendida' : ''}">${n}</li>`;
        })
        .join('')}
    </ol>
    <fieldset class="pva-sizes"><legend>Tamanho</legend>
      ${['P', 'M', 'G', 'GG'].map((s) => `<label><input type="radio" name="pva-size" value="${s}"${s === 'G' ? ' checked' : ''}><span>${s}</span></label>`).join('')}
    </fieldset>
    <button type="button" class="pva-btn" data-stub ${p.next === null ? 'disabled' : ''}>${p.next === null ? 'Esgotada' : `Levar a nº ${p.next} · ${formatBRL(p.price)}`}</button>
    <p class="pva-stub" hidden>Protótipo: o botão ainda não compra.</p>
    <details class="pva-chart"><summary>Tabela de medidas</summary>${sizeTable()}</details>
  </section>
  <section class="pva-story" aria-labelledby="pva-story-h">
    <h2 id="pva-story-h">A obra</h2>
    <p>${p.story}</p>
  </section>
  <section class="pva-index" aria-labelledby="pva-more-h">
    <h2 id="pva-more-h">Outras obras</h2>
    ${names(list.filter((x) => x.id !== p.id))}
  </section>`,
  after: '',
});

const about = (list: Piece[]) => ({
  stage: pieceLayer(list[0], true),
  col: `<section class="pva-hero">
    <h1>Sobre a Hortelã</h1>
    <p class="pva-lede">Arte vestível autoral: a obra existe antes do produto.</p>
  </section>
  <section class="pva-facts" aria-labelledby="pva-facts-h">
    <h2 id="pva-facts-h">Três regras</h2>
    <dl>
      <dt>Arte autoral</dt><dd>Toda estampa nasce de uma pintura original.</dd>
      <dt>Edição numerada</dt><dd>No máximo 20 peças por obra. Quando esgota, não repõe.</dd>
      <dt>Sob demanda</dt><dd>As peças do Estúdio são feitas depois do pedido, sem estoque.</dd>
    </dl>
  </section>`,
  after: letter(),
});

const footer = (list: Piece[]) => `<footer class="pva-foot">
  <div class="pva-foot-art">${artImg(list[1] ?? list[0], false)}</div>
  <div class="pva-foot-menu">
    <nav aria-label="Rodapé">
      <a href="#/colecao">Coleção</a><a href="#/estudio">Estúdio</a><a href="#/sobre">Sobre</a><a href="https://instagram.com/usehortela">Instagram</a>
    </nav>
    <div class="pva-foot-blocks">
      <p>Contato<br><a href="mailto:contato@usehortela.art.br">contato@usehortela.art.br</a></p>
      <p>Trocas e envio<br>Texto de exemplo</p>
    </div>
  </div>
  <p class="pva-foot-name" aria-hidden="true">hortelã</p>
  <p class="pva-foot-legal">© Hortelã · arte vestível autoral · CNPJ de exemplo</p>
</footer>`;

export const render = (route: Route) => {
  const list = pieces();
  const p = route.productId ? findPiece(route.productId) : undefined;
  const view =
    route.page === 'sobre' ? about(list) : p ? product(p, list) : route.page === 'loja' ? collection(list) : home(list);
  return `<div class="pva">
    <div class="pva-split">
      <aside class="pva-stage" aria-label="Peça em foco">${view.stage}</aside>
      <main class="pva-col">${nav()}${view.col}</main>
    </div>
    ${view.after}
    ${footer(list)}
  </div>`;
};

export const mount = (root: HTMLElement) => {
  const unbindComposer = bindComposer(root);
  const show = (id: string) => {
    for (const layer of root.querySelectorAll<HTMLElement>('.pva-layer'))
      layer.classList.toggle('on', layer.dataset.layer === id);
    for (const a of root.querySelectorAll<HTMLElement>('[data-show]')) a.classList.toggle('on', a.dataset.show === id);
  };
  const onPoint = (event: Event) => {
    const a = (event.target as HTMLElement).closest<HTMLElement>('[data-show]');
    if (a && root.querySelector(`[data-layer="${a.dataset.show}"]`)) show(a.dataset.show as string);
  };
  const onClick = (event: Event) => {
    const t = event.target as HTMLElement;
    const filter = t.closest<HTMLButtonElement>('[data-filter]');
    if (filter) {
      for (const b of root.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed', String(b === filter));
      for (const li of root.querySelectorAll<HTMLElement>('.pva-names li'))
        li.hidden = filter.dataset.filter !== 'Todas' && li.dataset.collection !== filter.dataset.filter;
    }
    if (t.closest('[data-stub]')) root.querySelector<HTMLElement>('.pva-stub')?.removeAttribute('hidden');
  };
  const onFocusWord = (event: Event) => {
    if ((event.target as HTMLElement).matches('[data-pv-word]')) show('studio');
  };
  root.addEventListener('pointerover', onPoint);
  root.addEventListener('focusin', onPoint);
  root.addEventListener('focusin', onFocusWord);
  root.addEventListener('click', onClick);
  return () => {
    unbindComposer();
    root.removeEventListener('pointerover', onPoint);
    root.removeEventListener('focusin', onPoint);
    root.removeEventListener('focusin', onFocusWord);
    root.removeEventListener('click', onClick);
  };
};
