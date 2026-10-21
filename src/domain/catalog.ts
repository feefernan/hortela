type ProductStatus = 'ok' | 'last' | 'sold';

export interface Product {
  id: string;
  name: string;
  collection: string;
  edition: { total: number };
  /** Unidades à venda, do banco Peças no Notion; ausente quando o Notion não respondeu. */
  available?: number;
  story: string;
  price: number;
  status: ProductStatus;
  /** Paleta do desenho de reserva (sem imagem): [principal, secundária, fundo]. */
  palette: [string, string, string];
  /** Imagem real da peça, vinda do Notion (via Worker). */
  image?: string;
  /** Aparece na home. */
  featured?: boolean;
}

// Stryker disable all : dados do catálogo, não lógica
export const PRODUCTS: readonly Product[] = [
  {
    id: 'floresta-3',
    name: 'Floresta nº 3',
    collection: 'Coleção Véspera',
    edition: { total: 20 },
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
    edition: { total: 15 },
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
    edition: { total: 10 },
    story: 'Uma série sobre o que sustenta. Galhos, raízes, fios invisíveis. O que cresce antes de aparecer.',
    price: 225,
    status: 'last',
    palette: ['#3C4E2E', '#7A9268', '#F3EDE0'],
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    collection: 'Coleção Véspera',
    edition: { total: 20 },
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
    edition: { total: 15 },
    story: 'Uma chuva que cai devagar, quase sem barulho. A pintura foi feita ouvindo ela.',
    price: 200,
    status: 'sold',
    palette: ['#5A7898', '#D6CCBA', '#7A9268'],
  },
  {
    id: 'broto',
    name: 'Broto',
    collection: 'Série Botânica',
    edition: { total: 10 },
    story: 'O início de algo. Menor que tudo ao redor, mas já cheio de intenção.',
    price: 185,
    status: 'ok',
    palette: ['#6A8E5A', '#3C4E2E', '#D6CCBA'],
  },
];

export interface Stamp {
  id: string;
  name: string;
  series: string;
  /** Cores do placeholder vetorial usado quando a aquarela não carrega. */
  colorA?: string;
  colorB?: string;
  /** Caminho da imagem (aquarela digitalizada). */
  image: string;
}

const ARTWORK: ReadonlyArray<Omit<Stamp, 'image'>> = [
  { id: 's1', name: 'Floresta nº 3', series: 'Série Floresta', colorA: '#3C4E2E', colorB: '#7A9268' },
  { id: 's2', name: 'Floresta nº 5', series: 'Série Floresta', colorA: '#4A6038', colorB: '#9AB080' },
  { id: 's3', name: 'Névoa', series: 'Série Floresta', colorA: '#6080A0', colorB: '#9AB0D0' },
  { id: 's4', name: 'Véspera', series: 'Série Floresta', colorA: '#3C4E2E', colorB: '#D6CCBA' },
  { id: 's5', name: 'Tarde out.', series: 'Série Memória', colorA: '#804030', colorB: '#C08060' },
  { id: 's6', name: 'Chuva fina', series: 'Série Memória', colorA: '#506080', colorB: '#9AB0D0' },
  { id: 's7', name: 'Raízes', series: 'Série Botânica', colorA: '#3C4E2E', colorB: '#7A6040' },
  { id: 's8', name: 'Broto', series: 'Série Botânica', colorA: '#6A8E5A', colorB: '#3C4E2E' },
  { id: 's9', name: 'Semente', series: 'Série Botânica', colorA: '#907848', colorB: '#D6CCBA' },
  { id: 's10', name: 'Açucena', series: 'Série Florescer', colorA: '#8060B0', colorB: '#B0A0F0' },
  { id: 's11', name: 'Camanducaia', series: 'Série Florescer', colorA: '#203010', colorB: '#807050' },
];

// Stryker restore all
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const alphabetImage = (letter: string): string => `/images/alfabeto/${letter}.png`;

export const STAMPS: readonly Stamp[] = [
  ...ARTWORK.map((s) => ({ ...s, image: `/images/${s.id}.png` })),
  ...ALPHABET.map((ch) => ({ id: `lt${ch}`, name: ch, series: 'Alfabeto', image: alphabetImage(ch) })),
];

export const findStamp = (id: string): Stamp | undefined => STAMPS.find((s) => s.id === id);

/** Uma linha do banco Peças do Notion (null/ausente = coluna vazia). */
export interface StockRow {
  id: string;
  price: number | null;
  total: number | null;
  available: number | null;
  active: boolean;
  name?: string | null;
  collection?: string | null;
  story?: string | null;
  order?: number | null;
  featured?: boolean;
  /** Caminho da imagem servida pelo Worker, se a peça tiver arquivo. */
  image?: string | null;
}

const DEFAULT_PALETTE: Product['palette'] = ['#3C4E2E', '#7A9268', '#D6CCBA'];

const statusFor = (available: number | undefined, fallback: ProductStatus): ProductStatus => {
  if (available === undefined) return fallback;
  if (available <= 0) return 'sold';
  return available === 1 ? 'last' : 'ok';
};

/**
 * Catálogo vivo a partir do banco Peças. Sem linhas (Notion fora do ar ou não configurado), vale o
 * catálogo do código. Com linhas, o Notion manda: só as peças ativas, na Ordem dele; o código entra
 * só como reserva de campos vazios (história, paleta do desenho) das peças que já existiam.
 */
export const fromNotion = (rows: readonly StockRow[]): Product[] => {
  if (!rows.length) return [...PRODUCTS];
  const known = new Map(PRODUCTS.map((p, i) => [p.id, { p, i }]));
  return rows
    .filter((r) => r.active && (r.name || known.has(r.id)))
    .map((r, i) => ({ r, i, base: known.get(r.id) }))
    .sort((a, b) => (a.r.order ?? a.base?.i ?? 1000 + a.i) - (b.r.order ?? b.base?.i ?? 1000 + b.i))
    .map(({ r, base }) => {
      const p = base?.p;
      const available = r.available ?? undefined;
      return {
        id: r.id,
        name: r.name || p?.name || r.id,
        collection: r.collection || p?.collection || '',
        story: r.story || p?.story || '',
        price: r.price ?? p?.price ?? 0,
        edition: { total: r.total ?? p?.edition.total ?? 1 },
        available,
        status: statusFor(available, p?.status ?? 'ok'),
        palette: p?.palette ?? DEFAULT_PALETTE,
        ...(r.image ? { image: r.image } : {}),
        ...(r.featured ? { featured: true } : {}),
      };
    });
};

// Estado do módulo: o site troca uma vez ao receber o catálogo; o Worker, a cada pedido.
let live: readonly Product[] = PRODUCTS;
export const useStock = (rows: readonly StockRow[]) => {
  live = fromNotion(rows);
};
export const products = (): readonly Product[] => live;
export const findProduct = (id: string): Product | undefined => live.find((p) => p.id === id);
/** Peças da home: as marcadas como Destaque no Notion, ou as 3 primeiras. */
export const featuredProducts = (): readonly Product[] => {
  const marked = live.filter((p) => p.featured);
  return (marked.length ? marked : live).slice(0, 3);
};
