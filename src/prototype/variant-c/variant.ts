/**
 * Variação C — "O número fixo" (tasteskill: pinned-poster).
 * Ideia: a edição numerada vira o título preso na tela. "nº 9 de 20" fica parado enquanto as
 * obras passam por baixo, uma de cada vez, e o número troca para o da obra que está passando.
 * Ação principal: uma obra por tela; o botão leva o número que está no alto.
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

export const key = 'C';
export const name = 'O número fixo';

const short = (p: Piece) => (p.next === null ? 'esgotada' : `nº ${p.next} de ${p.edition.total}`);

const bar = () => `<header class="pvc-bar">
  <a class="pvc-word" href="#/">hortelã</a>
  <nav aria-label="Principal"><a href="#/colecao">Coleção</a><a href="#/sobre">Sobre</a><a href="#/estudio">Carrinho</a><a class="pvc-action" href="#/estudio">Estúdio</a></nav>
</header>`;

const hero = () => `<section class="pvc-hero" aria-labelledby="pvc-h1">
  <h1 id="pvc-h1" class="pvc-split"><span>Cada peça,</span><em>uma obra.</em></h1>
  <div class="pvc-hero-frame">${shirt(`<div data-pv-word-out>${wordSVG(DEFAULT_WORD)}</div>`)}</div>
  <div class="pvc-hero-foot">
    <p>Arte vestível autoral em edições numeradas. Escreva uma palavra e veja nas letras pintadas da Hortelã.</p>
    <div class="pvc-compose">
      <label class="pvc-sr" for="pvc-word">Sua palavra</label>
      <input id="pvc-word" data-pv-word maxlength="10" value="${DEFAULT_WORD}" autocomplete="off" spellcheck="false">
      <a class="pvc-btn" href="#/estudio">Montar no Estúdio · ${STUDIO_PRICE}</a>
    </div>
  </div>
</section>`;

/** O número preso no alto; as obras passam por baixo. */
const pinnedRun = (list: Piece[]) => `<section class="pvc-run" aria-labelledby="pvc-num">
  <div class="pvc-pin">
    <h2 id="pvc-num" class="pvc-num">${short(list[0])}</h2>
    <p class="pvc-num-sub">${list[0].name}, a próxima disponível</p>
  </div>
  ${list
    .map(
      (
        p,
      ) => `<article class="pvc-panel" data-num="${short(p)}" data-sub="${p.next === null ? `${p.name}: obra completa, sem reposição` : `${p.name}, a próxima disponível`}">
      <a class="pvc-panel-frame" href="#/peca/${p.id}" style="background:${p.palette[2]}">${artImg(p)}</a>
      <p class="pvc-cap"><a href="#/peca/${p.id}">${p.name}</a> · ${p.collection} · ${formatBRL(p.price)}</p>
    </article>`,
    )
    .join('')}
</section>`;

const statement = () => `<section class="pvc-about" aria-labelledby="pvc-about-h">
  <h2 id="pvc-about-h">Quando esgota, esgotou.</h2>
  <p>Cada estampa nasce de uma pintura feita à mão. Ela vira uma edição curta, de 10 a 20 peças, e cada peça leva o seu número. Não há reposição: a última fecha a obra.</p>
  <dl>
    <div><dt>Arte autoral</dt><dd>A obra existe antes do produto.</dd></div>
    <div><dt>Edição numerada</dt><dd>No máximo 20 peças por obra.</dd></div>
    <div><dt>Sob demanda</dt><dd>As peças do Estúdio são feitas depois do pedido.</dd></div>
  </dl>
</section>`;

const footer = () => `<footer class="pvc-foot">
  <p class="pvc-foot-name" aria-hidden="true">hortelã</p>
  <div class="pvc-foot-row">
    <ul class="pvc-places">
      <li><a href="mailto:contato@usehortela.art.br">contato@usehortela.art.br</a></li>
      <li><a href="https://instagram.com/usehortela">@usehortela</a></li>
    </ul>
    <nav aria-label="Rodapé"><a href="#/colecao">Coleção</a><a href="#/estudio">Estúdio</a><a href="#/sobre">Sobre</a></nav>
    <ul class="pvc-small"><li>Trocas e envio</li><li>Cuidados com a peça</li><li>Texto de exemplo</li></ul>
  </div>
  <div class="pvc-foot-legal"><span>© Hortelã · arte vestível autoral</span><a href="#top" data-top>Voltar ao topo</a></div>
</footer>`;

const home = (list: Piece[]) => `${hero()}${pinnedRun(list)}${statement()}`;

/** Nomes enormes passam por um quadrado parado no centro. */
const collection = (list: Piece[]) => `<section class="pvc-names" aria-labelledby="pvc-col-h">
  <div class="pvc-held" aria-hidden="true">
    <p class="pvc-fact-l">${list[0].collection}</p>
    <div class="pvc-square">${list.map((p, i) => `<img data-for="${p.id}" class="${i === 0 ? 'on' : ''}" src="${p.art}" alt="" width="400" height="400">`).join('')}</div>
    <p class="pvc-fact-r">${short(list[0])} · ${formatBRL(list[0].price)}</p>
  </div>
  <ul>
    <li><h1 id="pvc-col-h" class="pvc-name pvc-name-head">Coleção</h1></li>
    ${list
      .map(
        (p) =>
          `<li><a class="pvc-name" href="#/peca/${p.id}" data-id="${p.id}" data-l="${p.collection}" data-r="${short(p)} · ${formatBRL(p.price)}">${p.name}</a></li>`,
      )
      .join('')}
  </ul>
</section>`;

const product = (p: Piece, list: Piece[]) => `<section class="pvc-piece" aria-labelledby="pvc-p-h">
  <h1 id="pvc-p-h" class="pvc-p-name">${p.name}</h1>
  <div class="pvc-hero-frame">${shirt(artImg(p))}</div>
  <div class="pvc-p-buy">
    <p class="pvc-p-num">${short(p)}</p>
    <p>${editionLine(p)} · ${formatBRL(p.price)}</p>
    <fieldset class="pvc-sizes"><legend>Tamanho</legend>
      ${['P', 'M', 'G', 'GG'].map((s) => `<label><input type="radio" name="pvc-size" value="${s}"${s === 'G' ? ' checked' : ''}><span>${s}</span></label>`).join('')}
    </fieldset>
    <button type="button" class="pvc-btn" data-stub ${p.next === null ? 'disabled' : ''}>${p.next === null ? 'Esgotada' : `Levar a nº ${p.next}`}</button>
    <p class="pvc-stub" hidden>Protótipo: o botão ainda não compra.</p>
  </div>
</section>
<section class="pvc-flow" aria-labelledby="pvc-flow-h">
  <h2 id="pvc-flow-h">A obra</h2>
  <p>${p.story}</p>
  <p class="pvc-soft">${p.collection}. O número definitivo é confirmado quando o pagamento é aprovado.</p>
  <details class="pvc-chart"><summary>Tabela de medidas</summary>${sizeTable()}</details>
</section>
<section class="pvc-zoom" aria-labelledby="pvc-zoom-h">
  <div class="pvc-zoom-stage">
    <h2 id="pvc-zoom-h">De perto</h2>
    <div class="pvc-zoom-frame" data-stage="1" style="background:${p.palette[2]}">${artImg(p, false)}</div>
    <p class="pvc-zoom-cap">Pintada à mão; o traço do pincel aparece no tecido.</p>
  </div>
  <i data-mark="1"></i><i data-mark="2"></i><i data-mark="3"></i>
</section>
${pinnedRun(list.filter((x) => x.id !== p.id))}`;

const about = (list: Piece[]) => `<section class="pvc-pinned-about" aria-labelledby="pvc-sobre-h">
  <h1 id="pvc-sobre-h" class="pvc-pinned-title">Sem reposição</h1>
  ${list
    .slice(0, 3)
    .map(
      (p, i) => `<figure class="pvc-portrait ${i % 2 ? 'r' : 'l'}">
      <div style="background:${p.palette[2]}">${artImg(p)}</div>
      <figcaption><strong>${['Arte autoral', 'Edição numerada', 'Sob demanda'][i]}</strong>${
        [
          'Toda estampa nasce de uma pintura original, feita no papel antes de pensar em tecido.',
          'No máximo 20 peças por obra, cada uma com o seu número. Quando esgota, não repõe.',
          'As peças do Estúdio são feitas depois do pedido. Sem estoque, sem desperdício.',
        ][i]
      }</figcaption>
    </figure>`,
    )
    .join('')}
</section>${statement()}`;

export const render = (route: Route) => {
  const list = pieces();
  const p = route.productId ? findPiece(route.productId) : undefined;
  const body =
    route.page === 'sobre' ? about(list) : p ? product(p, list) : route.page === 'loja' ? collection(list) : home(list);
  return `<div class="pvc" id="top">${bar()}<main>${body}</main>${footer()}</div>`;
};

export const mount = (root: HTMLElement) => {
  const unbind = bindComposer(root);
  const observers: IntersectionObserver[] = [];
  const middle = { rootMargin: '-50% 0px -50% 0px' };

  // O número preso troca para o da obra que cruza o meio da tela.
  for (const runEl of root.querySelectorAll<HTMLElement>('.pvc-run')) {
    const num = runEl.querySelector('.pvc-num') as HTMLElement;
    const sub = runEl.querySelector('.pvc-num-sub') as HTMLElement;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const panel = e.target as HTMLElement;
        num.textContent = panel.dataset.num ?? '';
        sub.textContent = panel.dataset.sub ?? '';
      }
    }, middle);
    for (const panel of runEl.querySelectorAll('.pvc-panel')) io.observe(panel);
    observers.push(io);
  }

  // Coleção: o quadrado parado mostra a obra cujo nome cruza o centro.
  const held = root.querySelector<HTMLElement>('.pvc-held');
  if (held) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const a = e.target as HTMLElement;
        for (const img of held.querySelectorAll<HTMLElement>('img'))
          img.classList.toggle('on', img.dataset.for === a.dataset.id);
        (held.querySelector('.pvc-fact-l') as HTMLElement).textContent = a.dataset.l ?? '';
        (held.querySelector('.pvc-fact-r') as HTMLElement).textContent = a.dataset.r ?? '';
      }
    }, middle);
    for (const a of root.querySelectorAll('.pvc-name[data-id]')) io.observe(a);
    observers.push(io);
  }

  // Peça: a mesma arte em três distâncias.
  const zoom = root.querySelector<HTMLElement>('.pvc-zoom-frame');
  if (zoom) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) zoom.dataset.stage = (e.target as HTMLElement).dataset.mark;
    }, middle);
    for (const m of root.querySelectorAll('[data-mark]')) io.observe(m);
    observers.push(io);
  }

  const onClick = (event: Event) => {
    const t = event.target as HTMLElement;
    if (t.closest('[data-stub]')) root.querySelector<HTMLElement>('.pvc-stub')?.removeAttribute('hidden');
    if (t.closest('[data-top]')) {
      event.preventDefault();
      window.scrollTo({ top: 0 });
    }
  };
  root.addEventListener('click', onClick);
  return () => {
    unbind();
    for (const io of observers) io.disconnect();
    root.removeEventListener('click', onClick);
  };
};
