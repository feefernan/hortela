import { describe, expect, it } from 'vitest';
import {
  formatAddress,
  formatCep,
  nextOrderStatus,
  normalizeCep,
  parseAddress,
  paymentStatus,
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
