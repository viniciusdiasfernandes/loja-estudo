import { describe, it, expect } from 'vitest'
import { Order, InvalidOrderError, InvalidOrderTransitionError } from './order'
import type { OrderStatus } from './order'
import { OrderItem } from './order-item'

function newOrder() {
    return Order.create([OrderItem.create('p1', 5990, 2)])
}

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

describe('transições de status', () => {
    type Action = 'confirm' | 'reject' | 'cancel' | 'pay' | 'ship'

    const TARGET: Record<Action, OrderStatus> = {
        confirm: 'CONFIRMED',
        reject: 'REJECTED',
        cancel: 'CANCELLED',
        pay: 'PAID',
        ship: 'SHIPPED',
    }

    // Como chegar a cada estado de partida a partir de um pedido novo.
    const PATH_TO: Record<OrderStatus, Action[]> = {
        PENDING: [],
        CONFIRMED: ['confirm'],
        REJECTED: ['reject'],
        CANCELLED: ['cancel'],
        PAID: ['confirm', 'pay'],
        SHIPPED: ['confirm', 'pay', 'ship'],
    }

    // Escrito à mão de propósito, para não repetir a tabela do código de produção.
    const ALLOWED: [OrderStatus, Action][] = [
        ['PENDING', 'confirm'],
        ['PENDING', 'reject'],
        ['PENDING', 'cancel'],
        ['CONFIRMED', 'pay'],
        ['CONFIRMED', 'cancel'],
        ['PAID', 'ship'],
    ]

    const ALL_STATUSES = Object.keys(PATH_TO) as OrderStatus[]
    const ALL_ACTIONS = Object.keys(TARGET) as Action[]

    const FORBIDDEN: [OrderStatus, Action][] = []
    for (const from of ALL_STATUSES) {
        for (const action of ALL_ACTIONS) {
            const isAllowed = ALLOWED.some(([f, a]) => f === from && a === action)
            if (!isAllowed) FORBIDDEN.push([from, action])
        }
    }

    function orderIn(status: OrderStatus): Order {
        const order = newOrder()
        for (const action of PATH_TO[status]) {
            order[action]()
        }
        return order
    }

    it('o auxiliar chega a todos os estados de partida', () => {
        for (const status of ALL_STATUSES) {
            expect(orderIn(status).status).toBe(status)
        }
    })

    it.each(ALLOWED)('de %s, %s() é permitido', (from, action) => {
        const order = orderIn(from)

        order[action]()

        expect(order.status).toBe(TARGET[action])
    })

    it.each(FORBIDDEN)('de %s, %s() é rejeitado e não altera o status', (from, action) => {
        const order = orderIn(from)

        expect(() => order[action]()).toThrow(InvalidOrderTransitionError)
        expect(order.status).toBe(from)
    })

    it('a mensagem de erro mostra o estado atual e o pedido', () => {
        const order = orderIn('SHIPPED')

        expect(() => order.cancel()).toThrow(/SHIPPED.*CANCELLED/)
    })
})

describe('eventos de domínio', () => {
    it('registra OrderPlaced ao criar o pedido', () => {
        const order = Order.create([
            OrderItem.create('p1', 5990, 2),
            OrderItem.create('p2', 2450, 1),
        ])

        const events = order.pullEvents()

        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({
            type: 'OrderPlaced',
            orderId: order.id,
            items: [
                { productId: 'p1', quantity: 2 },
                { productId: 'p2', quantity: 1 },
            ],
        })
        expect(events[0]?.occurredAt).toBeInstanceOf(Date)
    })

    it('o evento não leva o preço (o catálogo só precisa de produto e quantidade)', () => {
        const order = newOrder()

        const event = order.pullEvents()[0]

        // Os eventos formam uma união: o `if` estreita o tipo para OrderPlaced.
        if (event?.type !== 'OrderPlaced') throw new Error('esperava OrderPlaced')
        expect(event.items[0]).toEqual({ productId: 'p1', quantity: 2 })
    })

    it('pullEvents esvazia a lista: a segunda chamada não devolve nada', () => {
        const order = newOrder()

        order.pullEvents()

        expect(order.pullEvents()).toEqual([])
    })

    it.each([
        ['confirm', 'OrderConfirmed', []],
        ['reject', 'OrderRejected', []],
        ['cancel', 'OrderCancelled', []],
        ['pay', 'OrderPaid', ['confirm']],
        ['ship', 'OrderShipped', ['confirm', 'pay']],
    ] as const)('%s() gera o evento %s', (action, eventType, setup) => {
        const order = newOrder()
        for (const step of setup) order[step]()
        order.pullEvents()

        order[action]()

        const events = order.pullEvents()
        expect(events).toHaveLength(1)
        expect(events[0]).toMatchObject({ type: eventType, orderId: order.id })
        expect(events[0]?.occurredAt).toBeInstanceOf(Date)
    })

    it('transição inválida não gera evento', () => {
        const order = newOrder()
        order.cancel()
        order.pullEvents()

        expect(() => order.confirm()).toThrow(InvalidOrderTransitionError)

        expect(order.pullEvents()).toEqual([])
    })

    it('acumula eventos na ordem em que aconteceram', () => {
        const order = newOrder()

        order.confirm()
        order.pay()

        expect(order.pullEvents().map((e) => e.type)).toEqual([
            'OrderPlaced',
            'OrderConfirmed',
            'OrderPaid',
        ])
    })
})

describe('Order.restore', () => {
    const items = [OrderItem.create('p1', 5990, 2), OrderItem.create('p2', 2450, 1)]

    it('reconstrói o pedido com o mesmo id, itens e status', () => {
        const order = Order.restore('order-123', items, 'PAID')

        expect(order.id).toBe('order-123')
        expect(order.status).toBe('PAID')
        expect(order.items).toHaveLength(2)
        expect(order.totalInCents).toBe(14430)
    })

    it('não gera eventos (o pedido não está sendo criado agora)', () => {
        const order = Order.restore('order-123', items, 'PENDING')

        expect(order.pullEvents()).toEqual([])
    })

    it('não é afetado por mudanças posteriores no array original', () => {
        const original = [OrderItem.create('p1', 1000, 1)]

        const order = Order.restore('order-123', original, 'PENDING')
        original.push(OrderItem.create('p2', 500, 1))

        expect(order.items).toHaveLength(1)
    })

    it('continua obedecendo as transições a partir do status restaurado', () => {
        const paid = Order.restore('order-123', items, 'PAID')
        const shipped = Order.restore('order-456', items, 'SHIPPED')

        paid.ship()
        expect(paid.status).toBe('SHIPPED')
        expect(() => shipped.cancel()).toThrow(InvalidOrderTransitionError)
    })

    it('uma transição depois do restore gera só o evento novo', () => {
        const order = Order.restore('order-123', items, 'PENDING')

        order.confirm()

        expect(order.pullEvents()).toMatchObject([
            { type: 'OrderConfirmed', orderId: 'order-123' },
        ])
    })
})