import type { OrderEvent } from '../domain/order-events'
import type { EventPublisher } from '../application/event-publisher'

export class InMemoryEventPublisher implements EventPublisher {
    private readonly events: OrderEvent[] = []

    async publish(events: readonly OrderEvent[]): Promise<void> {
        this.events.push(...events)
    }

    // Só para os testes conferirem o que foi publicado.
    published(): readonly OrderEvent[] {
        return [...this.events]
    }
}