import { test, expect } from '@playwright/test'

test('GET /health responde ok', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
})

test('cria um produto e o busca pelo id', async ({ request }) => {
    const created = await request.post('/products', {
        data: { name: 'Teclado', priceInCents: 5990, stock: 5 },
    })
    expect(created.status()).toBe(201)
    const { id } = await created.json()

    const found = await request.get(`/products/${id}`)

    expect(found.status()).toBe(200)
    expect(await found.json()).toEqual({
        id,
        name: 'Teclado',
        priceInCents: 5990,
        stock: 5,
    })
})