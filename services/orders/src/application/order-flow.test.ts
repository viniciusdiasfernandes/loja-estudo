import { describe, it, expect, beforeEach } from 'vitest'
import { PlaceOrder } from './place-order'
import { ConfirmOrder } from './confirm-order'
import { RejectOrder } from './reject-order'
import { registerStockEventHandlers } from '../interfaces/events/stock-event-handlers'
import { InMemoryEventBus } from '../infrastructure/in-memory-event-bus'
import { InMemoryOrderRepository } from '../infrastructure/in-memory-order-repository'
import { OrderNotFoundError } from './order-not-found-error'
import { InvalidOrderTransitionError } from '../domain/order'
import type { EventSubscriber } from './event-subscriber'
import type { EventPublisher } from './event-publisher'

// Catálogo FALSO: faz o papel do serviço de catálogo, que ainda não existe aqui.
// Escuta OrderPlaced e responde com StockReserved ou StockRejected.
function startFakeCatalogService(
    bus: EventSubscriber & EventPublisher,
    stock: Record<string, number>,
) {
    bus.subscribe('OrderPlaced', async (event) => {
        const enough = event.items.every((item) => (stock[item.productId] ?? 0) >= item.quantity)

        if (enough) {
            await bus.publish([
                { type: 'StockReserved', orderId: event.orderId, occurredAt: new Date() },
            ])
        } else {
            await bus.publish([
                {
                    type: 'StockRejected',
                    orderId: event.orderId,
                    reason: 'Estoque insuficiente',
                    occurredAt: new Date(),
                },
            ])
        }
    })
}

describe('fluxo do pedido por eventos', () => {
    let bus: InMemoryEventBus
    let orders: InMemoryOrderRepository
    let placeOrder: PlaceOrder
    let handlerErrors: unknown[]
    let seen: string[]

    beforeEach(() => {
        handlerErrors = []
        seen = []
        bus = new InMemoryEventBus((error) => handlerErrors.push(error))
        orders = new InMemoryOrderRepository()

        placeOrder = new PlaceOrder(orders, bus)

        // Espião: anota o nome de cada evento que passa pelo barramento, na ordem.
        // Inscrito ANTES dos handlers reais, para anotar cada evento antes de alguém reagir a ele
        // (aqui a entrega é aninhada: quem reage já publica o próximo evento durante o publish).
        for (const type of [
            'OrderPlaced',
            'StockReserved',
            'StockRejected',
            'OrderConfirmed',
            'OrderRejected',
        ] as const) {
            bus.subscribe(type, () => {
                seen.push(type)
            })
        }

        registerStockEventHandlers(bus, new ConfirmOrder(orders, bus), new RejectOrder(orders, bus))
    })

    it('com estoque suficiente, o pedido termina CONFIRMED', async () => {
        startFakeCatalogService(bus, { p1: 10, p2: 10 })

        const { orderId } = await placeOrder.execute({
            items: [
                { productId: 'p1', unitPriceInCents: 1000, quantity: 2 },
                { productId: 'p2', unitPriceInCents: 1000, quantity: 1 },
            ],
        })

        const order = await orders.findById(orderId)
        expect(order?.status).toBe('CONFIRMED')
        expect(handlerErrors).toEqual([])
    })

    it('com estoque insuficiente, o pedido termina REJECTED', async () => {
        startFakeCatalogService(bus, { p1: 1, p2: 10 })

        const { orderId } = await placeOrder.execute({
            items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 2 }],
        })

        const order = await orders.findById(orderId)
        expect(order?.status).toBe('REJECTED')
        expect(handlerErrors).toEqual([])
    })

    it('os eventos acontecem na ordem esperada (confirmado)', async () => {
        startFakeCatalogService(bus, { p1: 10 })

        await placeOrder.execute({ items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 1 }] })

        expect(seen).toEqual(['OrderPlaced', 'StockReserved', 'OrderConfirmed'])
    })

    it('os eventos acontecem na ordem esperada (rejeitado)', async () => {
        startFakeCatalogService(bus, { p1: 0 })

        await placeOrder.execute({ items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 1 }] })

        expect(seen).toEqual(['OrderPlaced', 'StockRejected', 'OrderRejected'])
    })

    it('sem ninguém respondendo, o pedido fica PENDING', async () => {
        const { orderId } = await placeOrder.execute({ items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 1 }] })

        const order = await orders.findById(orderId)
        expect(order?.status).toBe('PENDING')
    })

    describe('respostas problemáticas', () => {
        it('StockReserved de um pedido que não existe: erro isolado, nada quebra', async () => {
            await bus.publish([
                { type: 'StockReserved', orderId: 'fantasma', occurredAt: new Date() },
            ])

            expect(handlerErrors).toHaveLength(1)
            expect(handlerErrors[0]).toBeInstanceOf(OrderNotFoundError)
        })

        it('StockReserved duplicado: o segundo é recusado e o status não muda', async () => {
            const { orderId } = await placeOrder.execute({
                items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 1 }],
            })
            const reserved = { type: 'StockReserved', orderId, occurredAt: new Date() } as const

            await bus.publish([reserved])
            await bus.publish([reserved])

            expect((await orders.findById(orderId))?.status).toBe('CONFIRMED')
            expect(handlerErrors).toHaveLength(1)
            expect(handlerErrors[0]).toBeInstanceOf(InvalidOrderTransitionError)
        })

        it('StockRejected depois de CONFIRMED não desfaz a confirmação', async () => {
            startFakeCatalogService(bus, { p1: 10 })
            const { orderId } = await placeOrder.execute({
                items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 1 }],
            })

            await bus.publish([
                { type: 'StockRejected', orderId, reason: 'atrasado', occurredAt: new Date() },
            ])

            expect((await orders.findById(orderId))?.status).toBe('CONFIRMED')
            expect(handlerErrors).toHaveLength(1)
        })
    })
})