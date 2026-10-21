import { describe, it, expect } from 'vitest'
import { buildApp } from './app'
import { CreateProduct } from '../../application/create-product'
import { InMemoryProductRepository } from '../../infrastructure/in-memory-product-repository'
import { randomUUID } from 'node:crypto'
import { Product } from '../../domain/product'
import { GetProduct } from '../../application/get-product'

function setup() {
    const repository = new InMemoryProductRepository()
    const app = buildApp({
        createProduct: new CreateProduct(repository),
        getProduct: new GetProduct(repository),
    })
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

describe('GET /products/:id', () => {
    it('responde 200 com os dados do produto', async () => {
        const { app, repository } = setup()
        const product = Product.create('Mouse', 2450, 10)
        await repository.save(product)

        const response = await app.inject({ method: 'GET', url: `/products/${product.id}` })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            id: product.id,
            name: 'Mouse',
            priceInCents: 2450,
            stock: 10,
        })
    })

    it('responde 404 quando o produto não existe', async () => {
        const { app } = setup()

        const response = await app.inject({ method: 'GET', url: `/products/${randomUUID()}` })

        expect(response.statusCode).toBe(404)
        expect(response.json().error).toBeTruthy()
    })

    it.each([
        ['texto qualquer', 'abc'],
        ['quase um UUID (falta um caractere)', '123e4567-e89b-12d3-a456-42661417400'],
    ])('responde 400 quando o id não é um UUID: %s', async (_descricao, id) => {
        const { app } = setup()

        const response = await app.inject({ method: 'GET', url: `/products/${id}` })
        console.log(response.body)   // temporário
        expect(response.statusCode).toBe(400)
    })
})