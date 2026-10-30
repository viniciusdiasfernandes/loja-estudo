import type { IntegrationEvent } from '../application/integration-events'
import type { EventPublisher } from '../application/event-publisher'

export class InMemoryEventPublisher implements EventPublisher {
    private readonly events: IntegrationEvent[] = []

    async publish(events: readonly IntegrationEvent[]): Promise<void> {
        this.events.push(...events)
    }

    // Só para os testes conferirem o que foi publicado.
    published(): readonly IntegrationEvent[] {
        return [...this.events]
    }
}