import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import { PostgresOrderRepository } from './postgres-order-repository'
import { Order } from '../domain/order'
import { OrderItem } from '../domain/order-item'

const pool = new Pool({
    connectionString:
        process.env.ORDERS_TEST_DATABASE_URL ??
        'postgres://loja:loja@localhost:5432/loja_orders_test',
})

describe('PostgresOrderRepository', () => {
    const repository = new PostgresOrderRepository(pool)

    beforeEach(async () => {
        await pool.query('truncate orders cascade')
    })

    afterAll(async () => {
        await pool.end()
    })

    function newOrder() {
        return Order.create([
            OrderItem.create('p1', 5990, 2),
            OrderItem.create('p2', 2450, 1),
        ])
    }

    it('salva e recupera um pedido com id, status, itens e total', async () => {
        const order = newOrder()
        await repository.save(order)

        const found = await repository.findById(order.id)

        expect(found).not.toBeNull()
        expect(found?.id).toBe(order.id)
        expect(found?.status).toBe('PENDING')
        expect(found?.totalInCents).toBe(14430)
        expect(found?.items.map((i) => [i.productId, i.unitPriceInCents, i.quantity])).toEqual([
            ['p1', 5990, 2],
            ['p2', 2450, 1],
        ])
    })

    it('devolve null quando o pedido não existe', async () => {
        const found = await repository.findById('3f9d1c4e-8a52-4b6e-9d41-0c7a5e2b1f10')

        expect(found).toBeNull()
    })

    it('o pedido recuperado não traz eventos pendentes', async () => {
        const order = newOrder()
        await repository.save(order)

        const found = await repository.findById(order.id)

        expect(found?.pullEvents()).toEqual([])
    })

    it('atualiza o status de um pedido que já existe, sem duplicar os itens', async () => {
        const order = newOrder()
        await repository.save(order)

        order.confirm()
        await repository.save(order)

        const found = await repository.findById(order.id)
        expect(found?.status).toBe('CONFIRMED')
        expect(found?.items).toHaveLength(2)
    })

    it('guarda pedidos diferentes sem misturar os itens', async () => {
        const a = Order.create([OrderItem.create('p1', 1000, 1)])
        const b = Order.create([OrderItem.create('p9', 500, 3)])
        await repository.save(a)
        await repository.save(b)

        const foundA = await repository.findById(a.id)
        const foundB = await repository.findById(b.id)

        expect(foundA?.totalInCents).toBe(1000)
        expect(foundB?.totalInCents).toBe(1500)
    })
})