import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      { extends: true, test: { name: 'worker', include: ['tests/worker/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], environment: 'jsdom' },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'worker/src/**/*.ts'],
      // Desenho em canvas não roda no jsdom; coberto pelos testes e2e (Playwright).
      exclude: ['src/main.ts', 'src/**/*.d.ts', 'src/ui/certificate.ts', 'src/ui/capture.ts', 'worker/src/entry.ts'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // Catraca: só sobe. Valores atuais ~ lines 96, statements 94, functions 94, branches 82.
      thresholds: { lines: 93, functions: 90, branches: 78, statements: 91 },
    },
  },
});
