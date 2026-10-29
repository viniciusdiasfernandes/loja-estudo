import type { OrderEvent } from '../domain/order-events'

export interface EventPublisher {
    publish(events: readonly OrderEvent[]): Promise<void>
}