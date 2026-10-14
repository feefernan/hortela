import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        extends: true,
        test: { name: 'integration', include: ['tests/integration/**/*.test.ts'], environment: 'jsdom' },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Desenho em canvas não roda no jsdom; coberto pelos testes e2e (Playwright).
      exclude: ['src/main.ts', 'src/**/*.d.ts', 'src/ui/certificate.ts', 'src/ui/capture.ts'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      // Catraca: só sobe. Valores atuais ~ lines 82, branches 57.
      thresholds: { lines: 80, functions: 75, branches: 55, statements: 78 },
    },
  },
});
