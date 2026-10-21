import { defineConfig } from '@playwright/test'

const port = 3101

export default defineConfig({
    testDir: './tests',
    use: { baseURL: `http://localhost:${port}` },
    webServer: {
        command: 'npm run start -w services/catalog',
        cwd: '..',
        url: `http://localhost:${port}/health`,
        reuseExistingServer: true,
        timeout: 30_000,
        env: {
            PORT: String(port),
            DATABASE_URL: 'postgres://loja:loja@localhost:5432/loja_catalog_test',
        },
    },
})