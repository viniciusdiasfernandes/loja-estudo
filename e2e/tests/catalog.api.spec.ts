import { test, expect } from '@playwright/test'

test('GET /health responde ok', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
})