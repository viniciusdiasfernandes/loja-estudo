import { describe, it, expect, beforeEach } from 'vitest'
import { PlaceOrder } from './place-order'
import type { OrderRepository } from './order-repository'
import { InMemoryOrderRepository } from '../infrastructure/in-memory-order-repository'
import { InMemoryEventPublisher } from '../infrastructure/in-memory-event-publisher'
import { InvalidOrderError } from '../domain/order'
import { InvalidOrderItemError } from '../domain/order-item'

describe('PlaceOrder', () => {
    let orders: InMemoryOrderRepository
    let publisher: InMemoryEventPublisher
    let placeOrder: PlaceOrder

    beforeEach(() => {
        orders = new InMemoryOrderRepository()
        publisher = new InMemoryEventPublisher()
        placeOrder = new PlaceOrder(orders, publisher)
    })

    const validInput = {
        items: [
            { productId: 'p1', unitPriceInCents: 5990, quantity: 2 },
            { productId: 'p2', unitPriceInCents: 2450, quantity: 1 },
        ],
    }

    it('cria e salva um pedido pendente com o total certo', async () => {
        const { orderId } = await placeOrder.execute(validInput)

        const saved = orders.all()
        expect(saved).toHaveLength(1)
        expect(saved[0]?.id).toBe(orderId)
        expect(saved[0]?.status).toBe('PENDING')
        expect(saved[0]?.totalInCents).toBe(14430)
    })

    it('publica exatamente um OrderPlaced com o id do pedido', async () => {
        const { orderId } = await placeOrder.execute(validInput)

        const events = publisher.published()
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({
            type: 'OrderPlaced',
            orderId,
            items: [
                { productId: 'p1', quantity: 2 },
                { productId: 'p2', quantity: 1 },
            ],
        })
    })

    it('não deixa eventos pendentes no pedido salvo (já foram recolhidos)', async () => {
        await placeOrder.execute(validInput)

        expect(orders.all()[0]?.pullEvents()).toEqual([])
    })

    describe('entrada inválida: não salva nem publica nada', () => {
        it('lista de itens vazia', async () => {
            await expect(placeOrder.execute({ items: [] })).rejects.toThrow(InvalidOrderError)

            expect(orders.all()).toHaveLength(0)
            expect(publisher.published()).toHaveLength(0)
        })

        it('item com quantidade zero', async () => {
            await expect(
                placeOrder.execute({
                    items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 0 }],
                }),
            ).rejects.toThrow(InvalidOrderItemError)

            expect(orders.all()).toHaveLength(0)
            expect(publisher.published()).toHaveLength(0)
        })

        it('produto repetido', async () => {
            await expect(
                placeOrder.execute({
                    items: [
                        { productId: 'p1', unitPriceInCents: 1000, quantity: 1 },
                        { productId: 'p1', unitPriceInCents: 1000, quantity: 1 },
                    ],
                }),
            ).rejects.toThrow(InvalidOrderError)

            expect(publisher.published()).toHaveLength(0)
        })
    })

    it('se o repositório falhar, nenhum evento é publicado', async () => {
        const failingRepository: OrderRepository = {
            save: async () => {
                throw new Error('banco fora do ar')
            },
            findById: async () => null,
        }
        const useCase = new PlaceOrder(failingRepository, publisher)

        await expect(useCase.execute(validInput)).rejects.toThrow(/banco fora do ar/)

        expect(publisher.published()).toHaveLength(0)
    })
})