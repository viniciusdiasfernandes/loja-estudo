import { describe, it, expect } from 'vitest'
import { Order } from './order'
import { OrderItem } from './order-item'

describe('Order.create', () => {
    it('cria um pedido pendente com o total dos itens', () => {
        const order = Order.create([
            OrderItem.create('p1', 5990, 2),
            OrderItem.create('p2', 2450, 1),
        ])

        expect(order.id).toBeTruthy()
        expect(order.status).toBe('PENDING')
        expect(order.totalInCents).toBe(14430)
    })

    it('não é afetado por mudanças posteriores no array original', () => {
        const items = [OrderItem.create('p1', 1000, 1)]

        const order = Order.create(items)
        items.push(OrderItem.create('p2', 500, 1))

        expect(order.totalInCents).toBe(1000)
    })
})