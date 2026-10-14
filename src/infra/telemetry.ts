/**
 * Observabilidade: Sentry (erros, performance) + OpenTelemetry (traces OTLP).
 *
 * - Cada integração só é carregada (import dinâmico) quando a variável de ambiente existe,
 *   então o bundle não cresce para quem não usa.
 * - Nunca envie dados pessoais (nome, e-mail, observações) como atributo. Use `scrub`.
 */
import type { Attributes, Tracer } from '@opentelemetry/api';

export type SpanAttributes = Record<string, string | number | boolean>;

interface SentryLike {
  startSpan<T>(options: { name: string; op?: string; attributes?: SpanAttributes }, fn: () => T): T;
  captureException(error: unknown): void;
}

let sentry: SentryLike | null = null;
let tracer: Tracer | null = null;

const PII_KEYS = /^(name|nome|email|e-mail|obs|observa|cliente|client)/i;

/** Remove atributos que possam conter dados pessoais. */
export const scrub = (attrs: SpanAttributes = {}): SpanAttributes =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => !PII_KEYS.test(key)));

export interface TelemetryConfig {
  sentryDsn?: string;
  otelUrl?: string;
  release?: string;
  environment?: string;
}

const readEnv = (): TelemetryConfig => ({
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  otelUrl: import.meta.env.VITE_OTEL_EXPORTER_URL,
  release: import.meta.env.VITE_RELEASE,
  environment: import.meta.env.MODE,
});

const initSentry = async (cfg: TelemetryConfig) => {
  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn: cfg.sentryDsn,
    release: cfg.release,
    environment: cfg.environment,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    // Sem dados pessoais: nunca anexamos usuário aos eventos.
    beforeSend: (event) => {
      delete event.user;
      return event;
    },
    beforeBreadcrumb: (crumb) => (crumb.category === 'ui.input' ? null : crumb),
  });
  sentry = Sentry;
};

const initOtel = async (cfg: TelemetryConfig) => {
  const [{ trace }, web, { OTLPTraceExporter }, { resourceFromAttributes }, semconv, { registerInstrumentations }] =
    await Promise.all([
      import('@opentelemetry/api'),
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
      import('@opentelemetry/instrumentation'),
    ]);
  const [{ DocumentLoadInstrumentation }, { FetchInstrumentation }] = await Promise.all([
    import('@opentelemetry/instrumentation-document-load'),
    import('@opentelemetry/instrumentation-fetch'),
  ]);
  const provider = new web.WebTracerProvider({
    resource: resourceFromAttributes({
      [semconv.ATTR_SERVICE_NAME]: 'hortela-web',
      [semconv.ATTR_SERVICE_VERSION]: cfg.release ?? 'dev',
    }),
    spanProcessors: [new web.BatchSpanProcessor(new OTLPTraceExporter({ url: cfg.otelUrl }))],
  });
  provider.register({ contextManager: new web.StackContextManager() });
  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation(), new FetchInstrumentation()],
  });
  tracer = trace.getTracer('hortela-web');
};

/** Liga as integrações configuradas. Falhas de telemetria nunca derrubam o site. */
export const initTelemetry = async (cfg: TelemetryConfig = readEnv()): Promise<void> => {
  const jobs: Promise<void>[] = [];
  if (cfg.sentryDsn) jobs.push(initSentry(cfg));
  if (cfg.otelUrl) jobs.push(initOtel(cfg));
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') console.warn('Telemetria indisponível', r.reason);
};

/**
 * Executa `fn` dentro de um span de negócio (Sentry + OTel quando ativos).
 * Sem telemetria configurada, só executa `fn`.
 */
export const track = <T>(name: string, attrs: SpanAttributes, fn: () => T): T => {
  const safe = scrub(attrs);
  const withOtel = (): T => {
    if (!tracer) return fn();
    return tracer.startActiveSpan(name, { attributes: safe as Attributes }, (span) => {
      try {
        const out = fn();
        if (out instanceof Promise) {
          return out.finally(() => span.end()) as T;
        }
        span.end();
        return out;
      } catch (e) {
        span.recordException(e as Error);
        span.end();
        throw e;
      }
    });
  };
  return sentry ? sentry.startSpan({ name, op: 'ui.action', attributes: safe }, withOtel) : withOtel();
};

export const reportError = (error: unknown) => {
  sentry?.captureException(error);
  console.error(error);
};

/** Só para testes. */
export const __resetTelemetry = () => {
  sentry = null;
  tracer = null;
};
