import { defineConfig, devices } from '@playwright/test'

const apiPort = 3101
const webPort = 5174

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'api',
            testMatch: '**/*.api.spec.ts',
            use: { baseURL: `http://localhost:${apiPort}` },
        },
        {
            name: 'ui',
            testMatch: '**/*.ui.spec.ts',
            use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${webPort}` },
        },
    ],
    webServer: [
        {
            command: 'npm run start -w services/catalog',
            cwd: '..',
            url: `http://localhost:${apiPort}/health`,
            reuseExistingServer: true,
            timeout: 30_000,
            env: {
                PORT: String(apiPort),
                DATABASE_URL: 'postgres://loja:loja@localhost:5432/loja_catalog_test',
            },
        },
        {
            command: `npm run dev -w web -- --port ${webPort} --strictPort`,
            cwd: '..',
            url: `http://localhost:${webPort}`,
            reuseExistingServer: true,
            timeout: 60_000,
            env: { API_URL: `http://localhost:${apiPort}` },
        },
    ],
})