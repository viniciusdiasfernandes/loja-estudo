import type { EventSubscriber } from '../../application/event-subscriber'
import type { ConfirmOrder } from '../../application/confirm-order'
import type { RejectOrder } from '../../application/reject-order'

// Adaptador de entrada, como uma rota HTTP, mas para eventos:
// traduz "chegou um evento" em "execute este caso de uso".
export function registerStockEventHandlers(
    subscriber: EventSubscriber,
    confirmOrder: ConfirmOrder,
    rejectOrder: RejectOrder,
): void {
    subscriber.subscribe('StockReserved', (event) => confirmOrder.execute({ orderId: event.orderId }))
    subscriber.subscribe('StockRejected', (event) => rejectOrder.execute({ orderId: event.orderId }))
}