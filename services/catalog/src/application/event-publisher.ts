import type { IntegrationEvent } from './integration-events'

export interface EventPublisher {
    publish(events: readonly IntegrationEvent[]): Promise<void>
}