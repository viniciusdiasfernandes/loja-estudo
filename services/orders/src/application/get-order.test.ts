import { describe, it, expect, beforeEach } from 'vitest'
import { GetOrder, InvalidOrderIdError } from './get-order'
import { OrderNotFoundError } from './order-not-found-error'
import { InMemoryOrderRepository } from '../infrastructure/in-memory-order-repository'
import { Order } from '../domain/order'
import { OrderItem } from '../domain/order-item'

describe('GetOrder', () => {
    let orders: InMemoryOrderRepository
    let getOrder: GetOrder

    beforeEach(() => {
        orders = new InMemoryOrderRepository()
        getOrder = new GetOrder(orders)
    })

    it('devolve os dados do pedido, com subtotais e total', async () => {
        const order = Order.create([
            OrderItem.create('p1', 5990, 2),
            OrderItem.create('p2', 2450, 1),
        ])
        await orders.save(order)

        const view = await getOrder.execute({ id: order.id })

        expect(view).toEqual({
            id: order.id,
            status: 'PENDING',
            totalInCents: 14430,
            items: [
                { productId: 'p1', unitPriceInCents: 5990, quantity: 2, subtotalInCents: 11980 },
                { productId: 'p2', unitPriceInCents: 2450, quantity: 1, subtotalInCents: 2450 },
            ],
        })
    })

    it('mostra o status atual do pedido', async () => {
        const order = Order.create([OrderItem.create('p1', 1000, 1)])
        order.confirm()
        await orders.save(order)

        const view = await getOrder.execute({ id: order.id })

        expect(view.status).toBe('CONFIRMED')
    })

    it('lança OrderNotFoundError quando o pedido não existe', async () => {
        await expect(
            getOrder.execute({ id: '3f9d1c4e-8a52-4b6e-9d41-0c7a5e2b1f10' }),
        ).rejects.toThrow(OrderNotFoundError)
    })

    it.each([['abc'], [''], ['123'], ['3f9d1c4e-8a52-4b6e-9d41-0c7a5e2b1f1g']])(
        'rejeita o id inválido "%s"',
        async (id) => {
            await expect(getOrder.execute({ id })).rejects.toThrow(InvalidOrderIdError)
        },
    )
})