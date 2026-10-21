import { describe, it, expect } from 'vitest'
import { buildApp } from './app'
import { CreateProduct } from '../../application/create-product'
import { InMemoryProductRepository } from '../../infrastructure/in-memory-product-repository'

function setup() {
    const repository = new InMemoryProductRepository()
    const app = buildApp({ createProduct: new CreateProduct(repository) })
    return { app, repository }
}

describe('GET /health', () => {
    it('responde 200 com ok true', async () => {
        const { app } = setup()

        const response = await app.inject({ method: 'GET', url: '/health' })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ ok: true })
    })
})

describe('POST /products', () => {
    it('cria o produto e responde 201 com o id', async () => {
        const { app, repository } = setup()

        const response = await app.inject({
            method: 'POST',
            url: '/products',
            payload: { name: 'Mouse', priceInCents: 2450, stock: 10 },
        })

        expect(response.statusCode).toBe(201)
        const { id } = response.json()
        const saved = await repository.findById(id)
        expect(saved?.name).toBe('Mouse')
        expect(saved?.stock).toBe(10)
    })

    it.each([
        ['sem nome', { priceInCents: 2450 }],
        ['preço que não é número', { name: 'Mouse', priceInCents: 'abc' }],
    ])('responde 400 quando o corpo é inválido: %s', async (_descricao, payload) => {
        const { app } = setup()

        const response = await app.inject({ method: 'POST', url: '/products', payload })
        expect(response.statusCode).toBe(400)
    })

    it.each([
        ['nome vazio', { name: '', priceInCents: 2450 }],
        ['preço zero', { name: 'Mouse', priceInCents: 0 }],
    ])('responde 422 quando uma regra de negócio é violada: %s', async (_descricao, payload) => {
        const { app } = setup()
        const response = await app.inject({ method: 'POST', url: '/products', payload })
        expect(response.statusCode).toBe(422)
        expect(response.json().error).toBeTruthy()
    })
})