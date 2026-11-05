import type { EventSubscriber } from '../../application/event-subscriber'
import type { ReserveStock } from '../../application/reserve-stock'

// Adaptador de entrada por eventos: "chegou OrderPlaced" vira "execute ReserveStock".
export function registerOrderEventHandlers(
    subscriber: EventSubscriber,
    reserveStock: ReserveStock,
): void {
    subscriber.subscribe('OrderPlaced', (event) =>
        reserveStock.execute({ orderId: event.orderId, items: event.items }),
    )
}
