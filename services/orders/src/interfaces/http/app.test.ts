import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from './app'
import { PlaceOrder } from '../../application/place-order'
import { GetOrder } from '../../application/get-order'
import { InMemoryOrderRepository } from '../../infrastructure/in-memory-order-repository'
import { InMemoryEventPublisher } from '../../infrastructure/in-memory-event-publisher'

describe('API de pedidos', () => {
    let orders: InMemoryOrderRepository
    let publisher: InMemoryEventPublisher
    let app: ReturnType<typeof buildApp>

    beforeEach(() => {
        orders = new InMemoryOrderRepository()
        publisher = new InMemoryEventPublisher()
        app = buildApp({
            placeOrder: new PlaceOrder(orders, publisher),
            getOrder: new GetOrder(orders),
        })
    })

    const validBody = {
        items: [
            { productId: 'p1', unitPriceInCents: 5990, quantity: 2 },
            { productId: 'p2', unitPriceInCents: 2450, quantity: 1 },
        ],
    }

    it('GET /health responde ok', async () => {
        const response = await app.inject({ method: 'GET', url: '/health' })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ ok: true })
    })

    describe('POST /orders', () => {
        it('cria o pedido e responde 201 com o orderId', async () => {
            const response = await app.inject({ method: 'POST', url: '/orders', payload: validBody })

            expect(response.statusCode).toBe(201)
            const { orderId } = response.json()
            expect(orders.all()[0]?.id).toBe(orderId)
            expect(publisher.published()).toHaveLength(1)
        })

        it('lista de itens vazia: 422', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/orders',
                payload: { items: [] },
            })

            expect(response.statusCode).toBe(422)
            expect(response.json().error).toBe('InvalidOrderError')
            expect(orders.all()).toHaveLength(0)
        })

        it('quantidade zero: 422', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/orders',
                payload: { items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: 0 }] },
            })

            expect(response.statusCode).toBe(422)
            expect(response.json().error).toBe('InvalidOrderItemError')
        })

        it('produto repetido: 422', async () => {
            const item = { productId: 'p1', unitPriceInCents: 1000, quantity: 1 }
            const response = await app.inject({
                method: 'POST',
                url: '/orders',
                payload: { items: [item, item] },
            })

            expect(response.statusCode).toBe(422)
        })

        it.each([
            ['sem corpo', undefined],
            ['sem items', {}],
            ['items que não é lista', { items: 'p1' }],
            ['item sem quantity', { items: [{ productId: 'p1', unitPriceInCents: 1000 }] }],
            ['quantity como texto', { items: [{ productId: 'p1', unitPriceInCents: 1000, quantity: '2' }] }],
        ])('formato do corpo errado (%s): 400', async (_descricao, payload) => {
            const response = await app.inject({ method: 'POST', url: '/orders', payload })

            expect(response.statusCode).toBe(400)
            expect(orders.all()).toHaveLength(0)
        })
    })

    describe('GET /orders/:id', () => {
        it('devolve o pedido criado', async () => {
            const created = await app.inject({ method: 'POST', url: '/orders', payload: validBody })
            const { orderId } = created.json()

            const response = await app.inject({ method: 'GET', url: `/orders/${orderId}` })

            expect(response.statusCode).toBe(200)
            expect(response.json()).toMatchObject({
                id: orderId,
                status: 'PENDING',
                totalInCents: 14430,
            })
            expect(response.json().items).toHaveLength(2)
        })

        it('pedido que não existe: 404', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/orders/3f9d1c4e-8a52-4b6e-9d41-0c7a5e2b1f10',
            })

            expect(response.statusCode).toBe(404)
            expect(response.json().error).toBe('OrderNotFoundError')
        })

        it('id que não é uuid: 400', async () => {
            const response = await app.inject({ method: 'GET', url: '/orders/abc' })

            expect(response.statusCode).toBe(400)
            expect(response.json().error).toBe('InvalidOrderIdError')
        })
    })
})