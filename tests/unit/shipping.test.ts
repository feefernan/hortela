import { describe, expect, it } from 'vitest';
import {
  addressErrors,
  formatAddress,
  formatCep,
  nextOrderStatus,
  normalizeCep,
  parseAddress,
  paymentStatus,
  pickShippingOptions,
  shippingLabel,
  shippingProducts,
} from '../../src/domain/shipping';

describe('CEP', () => {
  it('aceita com ou sem traço e recusa o resto', () => {
    expect(normalizeCep('20040-020')).toBe('20040020');
    expect(normalizeCep(' 20040020 ')).toBe('20040020');
    expect(normalizeCep('2004002')).toBeNull();
    expect(normalizeCep(20040020)).toBeNull();
    expect(formatCep('20040020')).toBe('20040-020');
  });
});

describe('endereço', () => {
  const ok = {
    cep: '20040-020',
    street: 'Rua A',
    number: '10',
    complement: 'ap 2',
    district: 'Centro',
    city: 'Rio',
    uf: 'rj',
  };

  it('valida, limpa e formata', () => {
    const a = parseAddress(ok);
    expect(a).toMatchObject({ cep: '20040020', uf: 'RJ' });
    expect(formatAddress(a as NonNullable<typeof a>)).toBe('Rua A, 10 — ap 2\nCentro · Rio/RJ\nCEP 20040-020');
  });

  it('falta número, CEP ou UF válida: incompleto', () => {
    expect(parseAddress({ ...ok, number: ' ' })).toBeNull();
    expect(parseAddress({ ...ok, cep: '1' })).toBeNull();
    expect(parseAddress({ ...ok, uf: 'R' })).toBeNull();
    expect(parseAddress(undefined)).toBeNull();
  });
});

describe('pacote', () => {
  it('declara o valor por peça e a quantidade', () => {
    expect(shippingProducts(2, 420)[0]).toMatchObject({ quantity: 2, insurance_value: 210 });
  });

  it('usa a caixa real de 24 × 16 × 8 cm', () => {
    expect(shippingProducts(1, 210)[0]).toMatchObject({ length: 24, width: 16, height: 8 });
  });
});

describe('status do pagamento', () => {
  it('traduz o Mercado Pago para o Notion', () => {
    expect(paymentStatus('approved')).toBe('Pago');
    expect(paymentStatus('rejected')).toBe('Cancelado');
    expect(paymentStatus('refunded')).toBe('Cancelado');
    expect(paymentStatus('in_process')).toBe('Aguardando pagamento');
    expect(paymentStatus('pending')).toBe('Aguardando pagamento');
  });
});

describe('status do pedido diante de avisos fora de ordem', () => {
  it('tentativa recusada depois do pagamento aprovado não desfaz o Pago', () => {
    expect(nextOrderStatus('Pago', 'rejected')).toBeNull();
    expect(nextOrderStatus('Pago', 'pending')).toBeNull();
    expect(nextOrderStatus('Pago', 'approved')).toBeNull();
  });

  it('estorno e contestação cancelam; o resto segue o pagamento', () => {
    expect(nextOrderStatus('Pago', 'refunded')).toBe('Cancelado');
    expect(nextOrderStatus('Pago', 'charged_back')).toBe('Cancelado');
    expect(nextOrderStatus('Aguardando pagamento', 'approved')).toBe('Pago');
    expect(nextOrderStatus('Cancelado', 'approved')).toBe('Pago');
    expect(nextOrderStatus('Aguardando pagamento', 'rejected')).toBe('Cancelado');
  });
});

describe('opções de frete exibidas', () => {
  const o = (id: number, price: number, days: number) => ({ id, price, days });

  it('até 4, mais baratas primeiro', () => {
    const all = [o(1, 30, 5), o(2, 15, 6), o(3, 16, 4), o(4, 17, 3), o(5, 18, 2), o(6, 40, 3)];
    expect(pickShippingOptions(all).map((x) => x.id)).toEqual([2, 3, 4, 5]);
  });

  it('a mais rápida entra no lugar da última quando não está entre as baratas', () => {
    const all = [o(1, 15, 6), o(2, 16, 5), o(3, 17, 7), o(4, 18, 6), o(9, 36, 1)];
    expect(pickShippingOptions(all).map((x) => x.id)).toEqual([1, 2, 3, 9]);
  });

  it('lista curta fica como está', () => {
    expect(pickShippingOptions([o(1, 20, 3)])).toEqual([o(1, 20, 3)]);
    expect(pickShippingOptions([])).toEqual([]);
  });
});

describe('nome do serviço', () => {
  it('não repete a transportadora', () => {
    expect(shippingLabel({ company: 'Loggi', name: 'Loggi Ponto' })).toBe('Loggi Ponto');
    expect(shippingLabel({ company: 'Correios', name: 'PAC' })).toBe('Correios PAC');
    expect(shippingLabel({ company: 'Jadlog', name: '.Package' })).toBe('Jadlog .Package');
  });
});

describe('erros do endereço, campo a campo', () => {
  it('aponta cada campo que falta, na ordem do formulário', () => {
    expect(addressErrors({ cep: '123', street: '', number: '', district: 'Centro', city: 'Rio', uf: 'r' })).toEqual([
      { field: 'cep', message: 'Informe um CEP com 8 números.' },
      { field: 'street', message: 'Informe a rua.' },
      { field: 'number', message: 'Informe o número (ou "s/n").' },
      { field: 'uf', message: 'Use a sigla do estado (ex.: RJ).' },
    ]);
  });

  it('endereço completo não tem erro', () => {
    expect(
      addressErrors({ cep: '20040-020', street: 'Rua A', number: '10', district: 'Centro', city: 'Rio', uf: 'rj' }),
    ).toEqual([]);
  });
});
