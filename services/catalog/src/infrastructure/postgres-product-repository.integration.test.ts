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
})