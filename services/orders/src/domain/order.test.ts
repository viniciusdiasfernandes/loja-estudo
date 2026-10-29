import { describe, it, expect } from 'vitest'
import { Order, InvalidOrderError } from './order'
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

    it('gera ids diferentes a cada pedido', () => {
        const a = Order.create([OrderItem.create('p1', 1000, 1)])
        const b = Order.create([OrderItem.create('p1', 1000, 1)])

        expect(a.id).not.toBe(b.id)
    })

    describe('validações', () => {
        it('rejeita pedido sem itens', () => {
            expect(() => Order.create([])).toThrow(InvalidOrderError)
            expect(() => Order.create([])).toThrow(/pelo menos um item/i)
        })

        it.each([
            [
                'iguais',
                [OrderItem.create('p1', 1000, 1), OrderItem.create('p1', 1000, 2)],
            ],
            [
                'com preços diferentes',
                [OrderItem.create('p1', 1000, 1), OrderItem.create('p1', 1500, 1)],
            ],
            [
                'não adjacentes',
                [
                    OrderItem.create('p1', 1000, 1),
                    OrderItem.create('p2', 2000, 1),
                    OrderItem.create('p1', 1000, 1),
                ],
            ],
        ])('rejeita produto repetido: itens %s', (_descricao, items) => {
            expect(() => Order.create(items)).toThrow(InvalidOrderError)
            expect(() => Order.create(items)).toThrow(/repetido/i)
        })

        it('aceita produtos diferentes com a mesma quantidade e preço', () => {
            const order = Order.create([
                OrderItem.create('p1', 1000, 1),
                OrderItem.create('p2', 1000, 1),
            ])

            expect(order.items).toHaveLength(2)
        })
    })
})