import { randomUUID } from 'node:crypto'
import { OrderItem } from './order-item'
import type { OrderEvent } from './order-events'

export class InvalidOrderError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidOrderError'
    }
}

export class InvalidOrderTransitionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidOrderTransitionError'
    }
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'PAID' | 'SHIPPED'

// Para cada estado, os estados para os quais é permitido ir.
// Como é um Record completo, adicionar um estado novo à união sem
// preencher esta tabela gera erro no typecheck.
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
    CONFIRMED: ['PAID', 'CANCELLED'],
    PAID: ['SHIPPED'],
    SHIPPED: [],
    REJECTED: [],
    CANCELLED: [],
}

// Estado de destino -> evento gerado ao entrar nele.
// PENDING não está aqui: ninguém "volta" para ele, o pedido já nasce assim (OrderPlaced).
type TargetStatus = Exclude<OrderStatus, 'PENDING'>

const EVENT_BY_TARGET_STATUS: Record<TargetStatus, Exclude<OrderEvent['type'], 'OrderPlaced'>> = {
    CONFIRMED: 'OrderConfirmed',
    REJECTED: 'OrderRejected',
    CANCELLED: 'OrderCancelled',
    PAID: 'OrderPaid',
    SHIPPED: 'OrderShipped',
}

export class Order {
    private constructor(
        readonly id: string,
        readonly items: readonly OrderItem[],
        private _status: OrderStatus,
    ) {}

    // Eventos que aconteceram e ainda não foram recolhidos por quem usa o Order.
    private _events: OrderEvent[] = []

    get status(): OrderStatus {
        return this._status
    }

    get totalInCents(): number {
        let total = 0
        for (const item of this.items) {
            total += item.subtotalInCents
        }
        return total
    }

    static create(items: OrderItem[]): Order {
        if (items.length === 0) {
            throw new InvalidOrderError('O pedido deve ter pelo menos um item')
        }

        const seenProductIds = new Set<string>()
        for (const item of items) {
            if (seenProductIds.has(item.productId)) {
                throw new InvalidOrderError(
                    `Produto repetido no pedido: ${item.productId}. Some as quantidades num único item`,
                )
            }
            seenProductIds.add(item.productId)
        }

        const order = new Order(randomUUID(), [...items], 'PENDING')

        order._events.push({
            type: 'OrderPlaced',
            orderId: order.id,
            items: order.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
            })),
            occurredAt: new Date(),
        })

        return order
    }

    // Devolve os eventos anotados e esvazia a lista, para que o mesmo
    // evento não seja publicado duas vezes.
    pullEvents(): readonly OrderEvent[] {
        const events = this._events
        this._events = []
        return events
    }

    confirm(): void {
        this.transitionTo('CONFIRMED')
    }

    reject(): void {
        this.transitionTo('REJECTED')
    }

    cancel(): void {
        this.transitionTo('CANCELLED')
    }

    pay(): void {
        this.transitionTo('PAID')
    }

    ship(): void {
        this.transitionTo('SHIPPED')
    }

    private transitionTo(next: TargetStatus): void {
        if (!ALLOWED_TRANSITIONS[this._status].includes(next)) {
            throw new InvalidOrderTransitionError(
                `Não é possível mudar o pedido de ${this._status} para ${next}`,
            )
        }
        this._status = next
        this._events.push({
            type: EVENT_BY_TARGET_STATUS[next],
            orderId: this.id,
            occurredAt: new Date(),
        })
    }
}