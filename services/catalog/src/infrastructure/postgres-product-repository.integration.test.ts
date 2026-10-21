import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import {InvalidProductIdError, Product} from '../domain/product'
import { PostgresProductRepository } from './postgres-product-repository'

const connectionString =
    process.env.TEST_DATABASE_URL ?? 'postgres://loja:loja@localhost:5432/loja_catalog_test'

describe('PostgresProductRepository', () => {
    let pool: pg.Pool
    let repository: PostgresProductRepository

    beforeAll(() => {
        pool = new pg.Pool({ connectionString })
        repository = new PostgresProductRepository(pool)
    })

    beforeEach(async () => {
        await pool.query('truncate table products')
    })

    afterAll(async () => {
        await pool.end()
    })

    async function seed(names: string[]): Promise<Product[]> {
        const products: Product[] = []
        for (const name of names) {
            const product = Product.create(name, 1000)
            await repository.save(product)
            products.push(product)
        }
        return products
    }

    it('salva um produto e o encontra pelo id', async () => {
        const product = Product.create('Mouse', 2450, 10)
        await repository.save(product)
        const found = await repository.findById(product.id)
        expect(found?.id).toBe(product.id)
        expect(found?.name).toBe('Mouse')
        expect(found?.priceInCents).toBe(2450)
        expect(found?.stock).toBe(10)
    })

    it('devolve null quando o produto não existe', async () => {
        const found = await repository.findById(randomUUID())
        expect(found).toBeNull()
    })

    it('lança InvalidProductIdError quando o id não é um UUID', async () => {
        await expect(repository.findById('ABC')).rejects.toThrow(InvalidProductIdError)
    })

    describe('list', () => {
        it('ordena por nome, e não pela ordem de inserção', async () => {
            await seed(['C', 'A', 'E', 'B', 'D'])

            const { items } = await repository.list({ limit: 10, offset: 0 })

            expect(items.map((p) => p.name)).toEqual(['A', 'B', 'C', 'D', 'E'])
        })

        it('respeita o limit', async () => {
            await seed(['A', 'B', 'C', 'D', 'E'])

            const { items } = await repository.list({ limit: 3, offset: 0 })

            expect(items.map((p) => p.name)).toEqual(['A', 'B', 'C'])
        })

        it('o offset pula as primeiras linhas', async () => {
            await seed(['A', 'B', 'C', 'D', 'E'])

            const { items } = await repository.list({ limit: 2, offset: 2 })

            expect(items.map((p) => p.name)).toEqual(['C', 'D'])
        })

        it('o total conta todos os produtos, e não só os da página', async () => {
            await seed(['A', 'B', 'C', 'D', 'E'])

            const { items, total } = await repository.list({ limit: 2, offset: 0 })

            expect(items).toHaveLength(2)
            expect(total).toBe(5)
        })

        it('devolve lista vazia e total zero quando não há produtos', async () => {
            const result = await repository.list({ limit: 10, offset: 0 })

            expect(result).toEqual({ items: [], total: 0 })
        })

        it('com offset além do fim, devolve lista vazia mas o total correto', async () => {
            await seed(['A', 'B', 'C'])

            const { items, total } = await repository.list({ limit: 10, offset: 100 })

            expect(items).toEqual([])
            expect(total).toBe(3)
        })

        it('páginas consecutivas não repetem nem perdem produtos', async () => {
            await seed(['A', 'B', 'C', 'D', 'E'])

            const names: string[] = []
            for (let offset = 0; offset < 5; offset += 2) {
                const { items } = await repository.list({ limit: 2, offset })
                names.push(...items.map((p) => p.name))
            }

            expect(names).toEqual(['A', 'B', 'C', 'D', 'E'])
        })

        it('desempata nomes iguais pelo id, sempre na mesma ordem', async () => {
            const products = await seed(new Array<string>(8).fill('Mouse'))
            const expectedIds = products.map((p) => p.id).sort()

            const first = await repository.list({ limit: 10, offset: 0 })
            const second = await repository.list({ limit: 10, offset: 0 })

            expect(first.items.map((p) => p.id)).toEqual(expectedIds)
            expect(second.items.map((p) => p.id)).toEqual(expectedIds)
        })

        it('reconstrói todos os campos do produto', async () => {
            const product = Product.create('Mouse', 2450, 10)
            await repository.save(product)

            const { items } = await repository.list({ limit: 10, offset: 0 })

            expect(items).toHaveLength(1)
            expect(items[0]?.id).toBe(product.id)
            expect(items[0]?.name).toBe('Mouse')
            expect(items[0]?.priceInCents).toBe(2450)
            expect(items[0]?.stock).toBe(10)
        })
    })
})