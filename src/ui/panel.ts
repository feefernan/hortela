import { escapeHtml as e } from '../domain/escape';
import { ORDER_STATUSES, type OrderRecord, type OrderRepository, type OrderStatus } from '../domain/orders';
import { config } from '../infra/config';
import { sha256Hex } from '../infra/password';
import { downloadDataUrl, downloadText } from './capture';
import { downloadCertificate } from './certificate';
import { byId, onAction, onEnter } from './dom';
import { go } from './router';
import { toast } from './toast';

const AUTH_KEY = 'hortela_panel_auth';

const STATUS_COLORS: Record<OrderStatus, string> = {
  novo: '#9B7FA8',
  'em produção': '#7A9268',
  enviado: '#3C4E2E',
};

// Todo dado vindo do pedido passa por escapeHtml (e): nome, e-mail e observações são do cliente (#18).
const pcRow = (label: string, value: string) => `<div>
  <div style="font-family:var(--body);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--sage);margin-bottom:2px;">${label}</div>
  <div style="font-family:var(--display);font-style:italic;font-size:14px;color:var(--ink);">${value ? e(value) : '—'}</div>
</div>`;

const cardHTML = (o: OrderRecord, img: string | null) => `
  <div class="panel-card" id="pc-${e(o.serial)}">
    <div class="pc-thumb">
      ${
        img
          ? `<img src="${e(img)}" alt="" style="width:100%;height:100%;object-fit:contain;padding:8px;">`
          : `<div style="font-family:var(--body);font-style:italic;font-size:11px;color:var(--sage);text-align:center;padding:12px;">${o.cfg.stamps.slice(0, 2).map(e).join('<br>')}</div>`
      }
    </div>
    <div class="pc-info">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="font-family:'Courier New',monospace;font-size:11px;color:var(--lilas);letter-spacing:.06em;">${e(o.serial)}</div>
        <div style="font-family:var(--body);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:3px 9px;background:${STATUS_COLORS[o.status] ?? '#D6CCBA'};color:white;">${e(o.status)}</div>
        <div style="font-family:var(--body);font-size:11px;color:var(--sage);margin-left:auto;">${e(o.date)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 20px;margin-bottom:14px;">
        ${pcRow('Cliente', o.name)}${pcRow('E-mail', o.email)}${pcRow('Total', o.total)}
        ${pcRow('Modelo', o.cfg.model)}${pcRow('Cor', o.cfg.color)}${pcRow('Tamanho', o.cfg.size)}
        ${pcRow('Posição', o.cfg.view)}${pcRow(o.kind === 'colecao' ? 'Itens' : 'Estampas', o.cfg.stamps.join(', '))}
        ${o.obs ? pcRow('Observações', o.obs) : ''}
      </div>
    </div>
    <div class="pc-actions">
      ${o.hasSVG ? `<button class="pc-btn pc-btn-primary" data-action="panel-svg" data-serial="${e(o.serial)}">↓ SVG produção</button>` : ''}
      ${o.hasImg ? `<button class="pc-btn pc-btn-primary" data-action="panel-img" data-serial="${e(o.serial)}">↓ Preview PNG</button>` : ''}
      ${o.kind === 'colecao' ? '' : `<button type="button" class="pc-btn pc-btn-primary" data-action="panel-cert" data-serial="${e(o.serial)}">↓ Certificado</button>`}
      <div style="margin-top:8px;">
        <select class="pc-select" data-serial="${e(o.serial)}">
          ${ORDER_STATUSES.map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s[0].toUpperCase()}${s.slice(1)}</option>`).join('')}
        </select>
      </div>
      <button class="pc-btn pc-btn-danger" data-action="panel-delete" data-serial="${e(o.serial)}">Apagar</button>
    </div>
  </div>`;

const render = (repo: OrderRepository) => {
  const orders = repo.list();
  const list = byId('panel-list');
  const empty = byId('panel-empty');
  byId('panel-count').textContent = `${orders.length}${orders.length === 1 ? ' pedido' : ' pedidos'}`;
  list.style.display = orders.length ? 'block' : 'none';
  empty.style.display = orders.length ? 'none' : 'block';
  list.innerHTML = orders.map((o) => cardHTML(o, o.hasImg ? repo.asset(o.serial, 'img') : null)).join('');
};

const isEnabled = () => Boolean(config.panelPasswordHash);
const isAuthed = () => isEnabled() && sessionStorage.getItem(AUTH_KEY) === config.panelPasswordHash;

export const initPanel = (repo: OrderRepository) => {
  const showPanel = () => {
    go('painel');
    render(repo);
  };
  const login = async () => {
    const input = byId<HTMLInputElement>('panel-pw');
    const hash = isEnabled() && input.value ? await sha256Hex(input.value) : '';
    if (hash && hash === config.panelPasswordHash) {
      sessionStorage.setItem(AUTH_KEY, hash);
      input.value = '';
      byId('panel-login').classList.remove('open');
      showPanel();
    } else {
      const err = byId('panel-pw-err');
      err.style.opacity = '1';
      setTimeout(() => {
        err.style.opacity = '0';
      }, 2000);
    }
  };

  // Sem senha configurada o painel não existe: some o link discreto do menu.
  if (!isEnabled()) document.getElementById('n-painel')?.closest('li')?.remove();

  onAction('open-panel', (_el, event) => {
    event.preventDefault();
    if (isAuthed()) showPanel();
    else byId('panel-login').classList.add('open');
  });
  onAction('close-panel-login', () => byId('panel-login').classList.remove('open'));
  onAction('panel-login', () => void login());
  onEnter('panel-login', () => void login());
  onAction('panel-logout', () => {
    sessionStorage.removeItem(AUTH_KEY);
    go('home');
  });
  onAction('panel-svg', (el) => {
    const svg = repo.asset(el.dataset.serial as string, 'svg');
    if (!svg) return toast('SVG não encontrado');
    downloadText(svg, 'image/svg+xml;charset=utf-8', `hortela-producao-${el.dataset.serial}.svg`);
    toast('SVG de produção baixado ✓');
  });
  onAction('panel-img', (el) => {
    const img = repo.asset(el.dataset.serial as string, 'img');
    if (!img) return toast('Imagem não encontrada');
    downloadDataUrl(img, `hortela-preview-${el.dataset.serial}.png`);
    toast('Preview baixado ✓');
  });
  onAction('panel-cert', (el) => {
    const o = repo.list().find((x) => x.serial === el.dataset.serial);
    if (!o) return toast('Pedido não encontrado');
    void downloadCertificate({ ...o, imgB64: repo.asset(o.serial, 'img') }).then(() => toast('Certificado baixado ✓'));
  });
  onAction('panel-delete', (el) => {
    const serial = el.dataset.serial as string;
    if (window.confirm(`Apagar pedido ${serial}?`)) {
      repo.remove(serial);
      render(repo);
    }
  });
  byId('panel-list').addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    if (!select.matches('.pc-select')) return;
    repo.updateStatus(select.dataset.serial as string, select.value as OrderStatus);
    render(repo);
  });
};
