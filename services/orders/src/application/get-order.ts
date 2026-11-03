import type { OrderRepository } from './order-repository'
import type { OrderStatus } from '../domain/order'
import { OrderNotFoundError } from './order-not-found-error'

export class InvalidOrderIdError extends Error {
    constructor(id: string) {
        super(`Id de pedido inválido: ${id}`)
        this.name = 'InvalidOrderIdError'
    }
}

// O que quem consulta recebe: dados simples, sem a entidade Order.
export type OrderView = {
    id: string
    status: OrderStatus
    totalInCents: number
    items: {
        productId: string
        unitPriceInCents: number
        quantity: number
        subtotalInCents: number
    }[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class GetOrder {
    constructor(private readonly orders: OrderRepository) {}

    async execute(input: { id: string }): Promise<OrderView> {
        // O banco guarda o id como uuid: um texto qualquer geraria erro de banco (500).
        if (!UUID.test(input.id)) throw new InvalidOrderIdError(input.id)

        const order = await this.orders.findById(input.id)
        if (!order) throw new OrderNotFoundError(input.id)

        return {
            id: order.id,
            status: order.status,
            totalInCents: order.totalInCents,
            items: order.items.map((item) => ({
                productId: item.productId,
                unitPriceInCents: item.unitPriceInCents,
                quantity: item.quantity,
                subtotalInCents: item.subtotalInCents,
            })),
        }
    }
}