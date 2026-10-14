import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetTelemetry, initTelemetry, reportError, scrub, track } from '../../src/infra/telemetry';

afterEach(() => __resetTelemetry());

describe('telemetria', () => {
  it('remove atributos com dados pessoais', () => {
    expect(scrub({ nome: 'Ana', email: 'a@b.co', obs: 'x', cliente: 'Ana', produto: 'raizes', letras: 4 })).toEqual({
      produto: 'raizes',
      letras: 4,
    });
    expect(scrub()).toEqual({});
  });

  it('sem configuração, não carrega nada e track só executa a função', async () => {
    await expect(initTelemetry({})).resolves.toBeUndefined();
    expect(track('teste', { produto: 'x' }, () => 42)).toBe(42);
    await expect(track('async', {}, async () => 'ok')).resolves.toBe('ok');
  });

  it('propaga erros da função rastreada', () => {
    expect(() =>
      track('falha', {}, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
  });

  it('reportError registra no console mesmo sem Sentry', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('x'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
