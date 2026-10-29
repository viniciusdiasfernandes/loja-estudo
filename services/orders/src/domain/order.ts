import { randomUUID } from 'node:crypto'
import { OrderItem } from './order-item'

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
        return new Order(randomUUID(), [...items], 'PENDING')
    }
}