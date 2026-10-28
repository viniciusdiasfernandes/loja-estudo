import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['services/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['services/*/src/**/*.ts'],
            exclude: ['**/*.test.ts', '**/server.ts'],
            reporter: ['text', 'html'],
            thresholds: {
                lines: 85,
                branches: 80,
                functions: 85,
                statements: 85,
                'services/*/src/domain/**': { 100: true },
            },
        },
    },
})