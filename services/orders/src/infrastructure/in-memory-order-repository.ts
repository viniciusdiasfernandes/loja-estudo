import type { Order } from '../domain/order'
import type { OrderRepository } from '../application/order-repository'

export class InMemoryOrderRepository implements OrderRepository {
    private readonly orders = new Map<string, Order>()

    async save(order: Order): Promise<void> {
        this.orders.set(order.id, order)
    }

    // Só para os testes conferirem o que foi salvo.
    all(): Order[] {
        return [...this.orders.values()]
    }
}