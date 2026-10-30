import type { OrderRepository } from './order-repository'
import type { EventPublisher } from './event-publisher'
import { OrderNotFoundError } from './order-not-found-error'

export class RejectOrder {
    constructor(
        private readonly orders: OrderRepository,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(input: { orderId: string }): Promise<void> {
        const order = await this.orders.findById(input.orderId)
        if (!order) throw new OrderNotFoundError(input.orderId)

        order.reject()

        await this.orders.save(order)
        await this.publisher.publish(order.pullEvents())
    }
}