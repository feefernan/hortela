import { afterEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
  startSpan: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
  captureException: vi.fn(),
}));
vi.mock('@sentry/browser', () => sentry);

const span = vi.hoisted(() => ({ end: vi.fn(), recordException: vi.fn() }));
const tracer = vi.hoisted(() => ({
  startActiveSpan: vi.fn((_name: string, _opts: unknown, fn: (s: typeof span) => unknown) => fn(span)),
}));
vi.mock('@opentelemetry/api', () => ({ trace: { getTracer: () => tracer } }));
vi.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: class {
    register = vi.fn();
  },
  BatchSpanProcessor: class {},
  StackContextManager: class {},
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({ OTLPTraceExporter: class {} }));
vi.mock('@opentelemetry/resources', () => ({ resourceFromAttributes: (a: unknown) => a }));
vi.mock('@opentelemetry/instrumentation', () => ({ registerInstrumentations: vi.fn() }));
vi.mock('@opentelemetry/instrumentation-document-load', () => ({ DocumentLoadInstrumentation: class {} }));
vi.mock('@opentelemetry/instrumentation-fetch', () => ({ FetchInstrumentation: class {} }));

import { __resetTelemetry, initTelemetry, reportError, track } from '../../src/infra/telemetry';

afterEach(() => {
  __resetTelemetry();
  vi.clearAllMocks();
});

describe('telemetria com Sentry e OpenTelemetry ativos', () => {
  it('inicializa o Sentry sem dados pessoais e envolve ações em spans', async () => {
    await initTelemetry({ sentryDsn: 'https://k@sentry.example/1', release: 'abc', environment: 'test' });
    const options = sentry.init.mock.calls[0][0];
    expect(options).toMatchObject({ dsn: 'https://k@sentry.example/1', release: 'abc', environment: 'test' });
    expect(options.beforeSend({ user: { email: 'a@b.co' }, message: 'x' })).toEqual({ message: 'x' });
    expect(options.beforeBreadcrumb({ category: 'ui.input' })).toBeNull();
    expect(options.beforeBreadcrumb({ category: 'navigation' })).toEqual({ category: 'navigation' });

    expect(track('pedido.finalizar', { origem: 'estudio', email: 'a@b.co' }, () => 7)).toBe(7);
    expect(sentry.startSpan).toHaveBeenCalledWith(
      { name: 'pedido.finalizar', op: 'ui.action', attributes: { origem: 'estudio' } },
      expect.any(Function),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('x'));
    expect(sentry.captureException).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cria spans OTel e os encerra (síncrono, assíncrono e com erro)', async () => {
    await initTelemetry({ otelUrl: 'https://otel.example/v1/traces', release: 'abc' });
    expect(track('produto.abrir', { produto: 'raizes' }, () => 'ok')).toBe('ok');
    await expect(track('async', {}, async () => 1)).resolves.toBe(1);
    expect(() =>
      track('falha', {}, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(tracer.startActiveSpan).toHaveBeenCalledTimes(3);
    expect(span.end).toHaveBeenCalledTimes(3);
    expect(span.recordException).toHaveBeenCalledOnce();
  });

  it('falha ao carregar a telemetria não derruba o site', async () => {
    sentry.init.mockImplementationOnce(() => {
      throw new Error('bloqueado por adblock');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initTelemetry({ sentryDsn: 'x' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
