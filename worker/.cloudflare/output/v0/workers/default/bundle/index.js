//#region src/notion.ts
var API = 'https://api.notion.com/v1';
var VERSION = '2022-06-28';
var headers = (token) => ({
  Authorization: `Bearer ${token}`,
  'Notion-Version': VERSION,
});
var ok = async (res, what) => {
  if (!res.ok) throw new Error(`Notion ${what}: ${res.status} ${await res.text()}`);
  return res.json();
};
/** Sobe um arquivo (single part) e devolve o id para anexar numa propriedade "files". */
var uploadFile = async (f, token, name, type, body) => {
  const created = await ok(
    await f(`${API}/file_uploads`, {
      method: 'POST',
      headers: {
        ...headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'single_part',
        filename: name,
        content_type: type,
      }),
    }),
    'criar upload',
  );
  const form = new FormData();
  form.append('file', new Blob([body], { type }), name);
  await ok(
    await f(created.upload_url, {
      method: 'POST',
      headers: headers(token),
      body: form,
    }),
    'enviar arquivo',
  );
  return created.id;
};
var rich = (content) => ({ rich_text: content ? [{ text: { content: content.slice(0, 2e3) } }] : [] });
var fileRef = (id, name) =>
  id
    ? [
        {
          type: 'file_upload',
          file_upload: { id },
          name,
        },
      ]
    : [];
var createOrderPage = async (f, token, databaseId, order, files) =>
  ok(
    await f(`${API}/pages`, {
      method: 'POST',
      headers: {
        ...headers(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          Serial: { title: [{ text: { content: order.serial } }] },
          Status: { select: { name: 'Novo' } },
          Tipo: { select: { name: order.kind === 'colecao' ? 'Coleção' : 'Estúdio' } },
          Cliente: rich(order.name),
          'E-mail': { email: order.email },
          'Itens / Estampas': rich(order.lines.join('\n')),
          Modelo: rich(order.model),
          Cor: rich(order.color),
          Tamanho: rich(order.size),
          Posição: rich(order.view),
          Observações: rich(order.obs),
          Total: { number: order.total },
          Preview: { files: fileRef(files.preview, `${order.serial}.png`) },
          Produção: { files: fileRef(files.production, `${order.serial}.svg`) },
          Data: { date: { start: /* @__PURE__ */ new Date().toISOString() } },
        },
      }),
    }),
    'criar pedido',
  );
//#endregion
//#region ../src/domain/catalog.ts
var PRODUCTS = [
  {
    id: 'floresta-3',
    name: 'Floresta nº 3',
    collection: 'Coleção Véspera',
    edition: {
      number: 8,
      total: 20,
    },
    story:
      'Pintada numa tarde de março, depois de uma caminhada não planejada. A floresta era vista de cima, como se o olhar fosse de pássaro antes da chuva.',
    price: 210,
    status: 'ok',
    palette: ['#3C4E2E', '#7A9268', '#D6CCBA'],
  },
  {
    id: 'tarde-de-outubro',
    name: 'Tarde de outubro',
    collection: 'Série Memória',
    edition: {
      number: 3,
      total: 15,
    },
    story:
      'O terracota apareceu sozinho. Não havia plano de usar essa cor, mas a tarde pedia aquele calor específico — o tipo que vai embora antes de você perceber.',
    price: 195,
    status: 'ok',
    palette: ['#7A4030', '#D69060', '#7A9268'],
  },
  {
    id: 'raizes',
    name: 'Raízes',
    collection: 'Série Botânica',
    edition: {
      number: 1,
      total: 10,
    },
    story: 'Uma série sobre o que sustenta. Galhos, raízes, fios invisíveis. O que cresce antes de aparecer.',
    price: 225,
    status: 'last',
    palette: ['#3C4E2E', '#7A9268', '#F3EDE0'],
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    collection: 'Coleção Véspera',
    edition: {
      number: 12,
      total: 20,
    },
    story:
      'Tem uma névoa específica da manhã que existe por um instante antes de desaparecer. Esta obra é esse instante.',
    price: 190,
    status: 'ok',
    palette: ['#9AB0D0', '#7A9268', '#D6CCBA'],
  },
  {
    id: 'chuva-fina',
    name: 'Chuva fina',
    collection: 'Série Memória',
    edition: {
      number: 7,
      total: 15,
    },
    story: 'Uma chuva que cai devagar, quase sem barulho. A pintura foi feita ouvindo ela.',
    price: 200,
    status: 'sold',
    palette: ['#5A7898', '#D6CCBA', '#7A9268'],
  },
  {
    id: 'broto',
    name: 'Broto',
    collection: 'Série Botânica',
    edition: {
      number: 5,
      total: 10,
    },
    story: 'O início de algo. Menor que tudo ao redor, mas já cheio de intenção.',
    price: 185,
    status: 'ok',
    palette: ['#6A8E5A', '#3C4E2E', '#D6CCBA'],
  },
];
var ARTWORK = [
  {
    id: 's1',
    name: 'Floresta nº 3',
    series: 'Série Floresta',
    colorA: '#3C4E2E',
    colorB: '#7A9268',
  },
  {
    id: 's2',
    name: 'Floresta nº 5',
    series: 'Série Floresta',
    colorA: '#4A6038',
    colorB: '#9AB080',
  },
  {
    id: 's3',
    name: 'Névoa',
    series: 'Série Floresta',
    colorA: '#6080A0',
    colorB: '#9AB0D0',
  },
  {
    id: 's4',
    name: 'Véspera',
    series: 'Série Floresta',
    colorA: '#3C4E2E',
    colorB: '#D6CCBA',
  },
  {
    id: 's5',
    name: 'Tarde out.',
    series: 'Série Memória',
    colorA: '#804030',
    colorB: '#C08060',
  },
  {
    id: 's6',
    name: 'Chuva fina',
    series: 'Série Memória',
    colorA: '#506080',
    colorB: '#9AB0D0',
  },
  {
    id: 's7',
    name: 'Raízes',
    series: 'Série Botânica',
    colorA: '#3C4E2E',
    colorB: '#7A6040',
  },
  {
    id: 's8',
    name: 'Broto',
    series: 'Série Botânica',
    colorA: '#6A8E5A',
    colorB: '#3C4E2E',
  },
  {
    id: 's9',
    name: 'Semente',
    series: 'Série Botânica',
    colorA: '#907848',
    colorB: '#D6CCBA',
  },
  {
    id: 's10',
    name: 'Açucena',
    series: 'Série Florescer',
    colorA: '#8060B0',
    colorB: '#B0A0F0',
  },
  {
    id: 's11',
    name: 'Camanducaia',
    series: 'Série Florescer',
    colorA: '#203010',
    colorB: '#807050',
  },
];
var ALPHABET$1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
var alphabetImage = (letter) => `/images/alfabeto/${letter}.png`;
[
  ...ARTWORK.map((s) => ({
    ...s,
    image: `/images/${s.id}.png`,
  })),
  ...ALPHABET$1.map((ch) => ({
    id: `lt${ch}`,
    name: ch,
    series: 'Alfabeto',
    image: alphabetImage(ch),
  })),
];
var findProduct = (id) => PRODUCTS.find((p) => p.id === id);
//#endregion
//#region ../src/domain/cart.ts
var SIZES = ['P', 'M', 'G', 'GG'];
/** Peça marcada como "última" só pode ir uma vez para o carrinho; outras, até 3 por tamanho. */
var maxQty = (product) => (product.status === 'last' ? 1 : 3);
var sameLine = (a, b) => a.productId === b.productId && a.size === b.size;
var addToCart = (cart, product, size) => {
  if (product.status === 'sold')
    return {
      ok: false,
      reason: 'esgotada',
    };
  const limit = maxQty(product);
  if (cart.filter((l) => l.productId === product.id).reduce((n, l) => n + l.qty, 0) >= limit)
    return {
      ok: false,
      reason: 'limite',
    };
  const existing = cart.find((l) =>
    sameLine(l, {
      productId: product.id,
      size,
    }),
  );
  if (existing)
    return {
      ok: true,
      cart: cart.map((l) =>
        l === existing
          ? {
              ...l,
              qty: l.qty + 1,
            }
          : l,
      ),
    };
  return {
    ok: true,
    cart: [
      ...cart,
      {
        productId: product.id,
        name: product.name,
        size,
        unitPrice: product.price,
        qty: 1,
      },
    ],
  };
};
var lineLabel = (l) => `${l.name} (${l.size})${l.qty > 1 ? ` ×${l.qty}` : ''}`;
var isGarmentSize = (value) => SIZES.includes(value);
/** Valida dados vindos do storage (podem estar corrompidos ou de versão antiga). */
var parseCart = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l) =>
      typeof l === 'object' &&
      l !== null &&
      typeof l.productId === 'string' &&
      typeof l.name === 'string' &&
      isGarmentSize(l.size) &&
      Number.isFinite(l.unitPrice) &&
      Number.isInteger(l.qty) &&
      l.qty > 0,
  );
};
//#endregion
//#region ../src/domain/pricing.ts
var MODELS = {
  oversized: {
    id: 'oversized',
    label: 'Camiseta Oversized',
    price: 120,
  },
  long: {
    id: 'long',
    label: 'Camisetão Long',
    price: 140,
  },
};
var studioTotal = (model) => MODELS[model].price + 80;
//#endregion
//#region ../src/domain/serial.ts
/** Base32 de Crockford: sem I, L, O, U — fácil de ler e ditar. */
var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
var SUFFIX_LENGTH = 6;
var cryptoBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
/** Gera o serial do pedido no formato HRT-AAAAMMDD-XXXXXX. */
var generateSerial = (date = /* @__PURE__ */ new Date(), randomBytes = cryptoBytes) => {
  return `HRT-${date.getFullYear().toString() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0')}-${Array.from(randomBytes(SUFFIX_LENGTH), (b) => ALPHABET[b % 32]).join('')}`;
};
//#endregion
//#region ../src/domain/validation.ts
var validateCheckout = (input) => {
  if (!input.name.trim() || !input.email.trim()) return 'missing-fields';
  if (!/\S+@\S+\.\S+/.test(input.email.trim())) return 'invalid-email';
  return null;
};
//#endregion
//#region src/order.ts
/**
 * Valida o pedido que vem do navegador e recalcula tudo que envolve dinheiro no servidor.
 * Reaproveita as regras puras de src/domain — o navegador nunca decide preço, total ou serial.
 */
var OrderError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var MAX_FILE_BYTES = 4194304;
var text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
var decodePng = (v) => {
  if (typeof v !== 'string' || !v.startsWith('data:image/png;base64,')) return null;
  const bin = atob(v.slice(22));
  if (bin.length > MAX_FILE_BYTES) throw new OrderError(413, 'Imagem da composição grande demais');
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
/** Reconstrói o carrinho peça a peça com as regras do domínio (esgotada, limite, preço atual). */
var rebuildCart = (raw) => {
  const asked = parseCart(raw);
  if (!asked.length) throw new OrderError(400, 'Carrinho vazio');
  let cart = [];
  for (const line of asked) {
    const product = findProduct(line.productId);
    if (!product) throw new OrderError(409, `Peça não encontrada: ${line.productId}`);
    for (let i = 0; i < line.qty; i++) {
      const r = addToCart(cart, product, line.size);
      if (!r.ok)
        throw new OrderError(
          409,
          r.reason === 'esgotada' ? `${product.name} esgotou` : `Limite de ${product.name} atingido`,
        );
      cart = r.cart;
    }
  }
  return cart;
};
var validateOrder = (input, now = /* @__PURE__ */ new Date()) => {
  const contact = {
    name: text(input.name, 120),
    email: text(input.email, 160),
    obs: text(input.obs, 1e3),
  };
  if (validateCheckout(contact)) throw new OrderError(400, 'Nome ou e-mail inválido');
  const base = {
    serial: generateSerial(now),
    ...contact,
  };
  if (input.kind === 'colecao') {
    const cart = rebuildCart(input.items);
    return {
      ...base,
      kind: 'colecao',
      total: cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
      model: 'Peças da coleção',
      color: '—',
      size: [...new Set(cart.map((l) => l.size))].join(', '),
      view: '—',
      lines: cart.map(lineLabel),
      previewPng: null,
      productionSvg: null,
    };
  }
  if (input.kind === 'estudio') {
    const s = input.studio ?? {};
    const model = s.model;
    if (!(typeof model === 'string' && model in MODELS)) throw new OrderError(400, 'Modelo inválido');
    const stamps = Array.isArray(s.stamps)
      ? s.stamps
          .map((x) => text(x, 80))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    if (!stamps.length) throw new OrderError(400, 'Composição sem estampas');
    const svg = text(input.productionSvg, MAX_FILE_BYTES).replaceAll('__SERIAL__', base.serial);
    return {
      ...base,
      kind: 'estudio',
      total: studioTotal(model),
      model: MODELS[model].label,
      color: text(s.color, 40),
      size: text(s.size, 4),
      view: text(s.view, 40),
      lines: stamps,
      previewPng: decodePng(input.previewPng),
      productionSvg: svg.startsWith('<?xml') || svg.startsWith('<svg') ? svg : null,
    };
  }
  throw new OrderError(400, 'Tipo de pedido inválido');
};
//#endregion
//#region src/app.ts
/**
 * API de pedidos da Hortelã. Recebe o pedido do site, valida e recalcula no servidor,
 * grava no Notion (com preview PNG e SVG de produção) e devolve o serial.
 *
 * Tipos mínimos e locais (em vez dos gerados pelo cf) para o mesmo código ser checado e testado
 * pelo TypeScript/Vitest da raiz; `entry.ts` confere que eles batem com os tipos gerados.
 */
var MAX_BODY_BYTES = 6291456;
var log = (level, msg, data = {}) =>
  console[level === 'info' ? 'log' : level](
    JSON.stringify({
      level,
      msg,
      ...data,
    }),
  );
var cors = (request, env) => {
  const origin = request.headers.get('Origin') ?? '';
  return env.ALLOWED_ORIGIN.split(',')
    .map((o) => o.trim())
    .includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : { Vary: 'Origin' };
};
var json = (body, status, extra) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extra,
    },
  });
var createOrder = async (request, env, f, h) => {
  if (!h['Access-Control-Allow-Origin']) return json({ error: 'Origem não permitida' }, 403, h);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!(await env.ORDERS_LIMITER.limit({ key: ip })).success)
    return json({ error: 'Muitos pedidos seguidos, tente em 1 minuto' }, 429, h);
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES)
    return json({ error: 'Pedido grande demais' }, 413, h);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return json({ error: 'Pedido grande demais' }, 413, h);
  let order;
  try {
    order = validateOrder(JSON.parse(new TextDecoder().decode(raw)));
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message }, e.status, h);
    return json({ error: 'Pedido inválido' }, 400, h);
  }
  const upload = async (name, type, body) => {
    if (!body) return null;
    try {
      return await uploadFile(f, env.NOTION_TOKEN, name, type, body);
    } catch (e) {
      log('warn', 'upload falhou', {
        serial: order.serial,
        name,
        error: String(e),
      });
      return null;
    }
  };
  const [preview, production] = await Promise.all([
    upload(`${order.serial}.png`, 'image/png', order.previewPng),
    upload(`${order.serial}.svg`, 'image/svg+xml', order.productionSvg),
  ]);
  try {
    await createOrderPage(f, env.NOTION_TOKEN, env.NOTION_ORDERS_DB, order, {
      preview,
      production,
    });
  } catch (e) {
    log('error', 'pedido não gravado no Notion', {
      serial: order.serial,
      kind: order.kind,
      error: String(e),
    });
    return json({ error: 'Não foi possível registrar o pedido agora. Tente de novo.' }, 502, h);
  }
  log('info', 'pedido criado', {
    serial: order.serial,
    kind: order.kind,
    total: order.total,
  });
  return json(
    {
      serial: order.serial,
      total: order.total,
    },
    201,
    h,
  );
};
var handle = async (request, env, _ctx, f = fetch) => {
  const url = new URL(request.url);
  const h = cors(request, env);
  if (request.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: h,
    });
  if (url.pathname === '/api/health') return json({ ok: true }, 200, h);
  if (url.pathname === '/api/orders' && request.method === 'POST') return createOrder(request, env, f, h);
  return json({ error: 'Não encontrado' }, 404, h);
};
//#endregion
//#region \0virtual:cloudflare/worker-entry
var worker_entry_default = { fetch: (request, env, ctx) => handle(request, env, ctx) };

//#endregion
export { worker_entry_default as default };

//# sourceMappingURL=index.js.map
