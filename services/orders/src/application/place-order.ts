import { Order } from '../domain/order'
import { OrderItem } from '../domain/order-item'
import type { OrderRepository } from './order-repository'
import type { EventPublisher } from './event-publisher'

export type PlaceOrderInput = {
    items: { productId: string; unitPriceInCents: number; quantity: number }[]
}

export type PlaceOrderOutput = {
    orderId: string
}

export class PlaceOrder {
    constructor(
        private readonly orders: OrderRepository,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
        // Se algum item ou o pedido forem inválidos, o domínio lança erro aqui
        // e nada abaixo (salvar, publicar) chega a rodar.
        const items = input.items.map((item) =>
            OrderItem.create(item.productId, item.unitPriceInCents, item.quantity),
        )
        const order = Order.create(items)

        await this.orders.save(order)
        // Só publica depois de salvar. Se o save falhar, nenhum evento sai.
        await this.publisher.publish(order.pullEvents())

        return { orderId: order.id }
    }
}