import { randomUUID } from 'node:crypto'
import { OrderItem } from './order-item'

export class InvalidOrderError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidOrderError'
    }
}

export type OrderStatus = 'PENDING'

export class Order {
    private constructor(
        readonly id: string,
        readonly items: readonly OrderItem[],
        readonly status: OrderStatus,
    ) {}

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

        return new Order(randomUUID(), [...items], 'PENDING')
    }
}