import { describe, it, expect } from 'vitest'
import { InMemoryEventBus } from './in-memory-event-bus'
import type { OrderEvent, OrderPlaced } from '../domain/order-events'

function orderPlaced(orderId = 'o1'): OrderPlaced {
    return {
        type: 'OrderPlaced',
        orderId,
        items: [{ productId: 'p1', quantity: 2 }],
        occurredAt: new Date(),
    }
}

function orderConfirmed(orderId = 'o1'): OrderEvent {
    return { type: 'OrderConfirmed', orderId, occurredAt: new Date() }
}

describe('InMemoryEventBus', () => {
    it('entrega o evento a quem se inscreveu no tipo dele', async () => {
        const bus = new InMemoryEventBus()
        const received: OrderPlaced[] = []
        bus.subscribe('OrderPlaced', (event) => {
            received.push(event)
        })

        const event = orderPlaced()
        await bus.publish([event])

        expect(received).toEqual([event])
    })

    it('não entrega eventos de outros tipos', async () => {
        const bus = new InMemoryEventBus()
        const received: OrderPlaced[] = []
        bus.subscribe('OrderPlaced', (event) => {
            received.push(event)
        })

        await bus.publish([orderConfirmed()])

        expect(received).toEqual([])
    })

    it('entrega a todos os inscritos no mesmo tipo', async () => {
        const bus = new InMemoryEventBus()
        const calls: string[] = []
        bus.subscribe('OrderPlaced', () => {
            calls.push('estoque')
        })
        bus.subscribe('OrderPlaced', () => {
            calls.push('notificacao')
        })

        await bus.publish([orderPlaced()])

        expect(calls).toEqual(['estoque', 'notificacao'])
    })

    it('entrega vários eventos na ordem em que foram publicados', async () => {
        const bus = new InMemoryEventBus()
        const ids: string[] = []
        bus.subscribe('OrderPlaced', (event) => {
            ids.push(event.orderId)
        })

        await bus.publish([orderPlaced('a'), orderPlaced('b'), orderPlaced('c')])

        expect(ids).toEqual(['a', 'b', 'c'])
    })

    it('espera handlers assíncronos terminarem antes de publish resolver', async () => {
        const bus = new InMemoryEventBus()
        let done = false
        bus.subscribe('OrderPlaced', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            done = true
        })

        await bus.publish([orderPlaced()])

        expect(done).toBe(true)
    })

    it('publicar sem inscritos não dá erro', async () => {
        const bus = new InMemoryEventBus()

        await expect(bus.publish([orderPlaced()])).resolves.toBeUndefined()
    })

    describe('quando um handler falha', () => {
        it('não faz publish falhar e os outros handlers continuam', async () => {
            const errors: unknown[] = []
            const bus = new InMemoryEventBus((error) => errors.push(error))
            const calls: string[] = []
            bus.subscribe('OrderPlaced', () => {
                throw new Error('estoque quebrou')
            })
            bus.subscribe('OrderPlaced', () => {
                calls.push('notificacao')
            })

            await expect(bus.publish([orderPlaced()])).resolves.toBeUndefined()

            expect(calls).toEqual(['notificacao'])
            expect(errors).toHaveLength(1)
            expect((errors[0] as Error).message).toBe('estoque quebrou')
        })

        it('também isola handlers assíncronos que rejeitam', async () => {
            const errors: unknown[] = []
            const bus = new InMemoryEventBus((error) => errors.push(error))
            bus.subscribe('OrderPlaced', async () => {
                throw new Error('falhou depois')
            })

            await expect(bus.publish([orderPlaced()])).resolves.toBeUndefined()

            expect(errors).toHaveLength(1)
        })
    })
})