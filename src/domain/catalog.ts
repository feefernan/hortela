type ProductStatus = 'ok' | 'last' | 'sold';

export interface Product {
  id: string;
  name: string;
  collection: string;
  edition: { number: number; total: number };
  story: string;
  price: number;
  status: ProductStatus;
  /** Paleta da aquarela placeholder: [principal, secundária, fundo]. */
  palette: [string, string, string];
}

// Stryker disable all : dados do catálogo, não lógica
export const PRODUCTS: readonly Product[] = [
  {
    id: 'floresta-3',
    name: 'Floresta nº 3',
    collection: 'Coleção Véspera',
    edition: { number: 8, total: 20 },
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
    edition: { number: 3, total: 15 },
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
    edition: { number: 1, total: 10 },
    story: 'Uma série sobre o que sustenta. Galhos, raízes, fios invisíveis. O que cresce antes de aparecer.',
    price: 225,
    status: 'last',
    palette: ['#3C4E2E', '#7A9268', '#F3EDE0'],
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    collection: 'Coleção Véspera',
    edition: { number: 12, total: 20 },
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
    edition: { number: 7, total: 15 },
    story: 'Uma chuva que cai devagar, quase sem barulho. A pintura foi feita ouvindo ela.',
    price: 200,
    status: 'sold',
    palette: ['#5A7898', '#D6CCBA', '#7A9268'],
  },
  {
    id: 'broto',
    name: 'Broto',
    collection: 'Série Botânica',
    edition: { number: 5, total: 10 },
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

export const findProduct = (id: string): Product | undefined => PRODUCTS.find((p) => p.id === id);
