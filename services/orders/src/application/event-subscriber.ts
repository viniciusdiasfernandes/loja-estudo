import type { IntegrationEvent } from './integration-events'

// Dado o nome de um evento (ex.: 'OrderPlaced'), o tipo do evento correspondente.
export type EventOfType<T extends IntegrationEvent['type']> = Extract<IntegrationEvent, { type: T }>

export type EventHandler<T extends IntegrationEvent['type']> = (
    event: EventOfType<T>,
) => void | Promise<void>

export interface EventSubscriber {
    subscribe<T extends IntegrationEvent['type']>(type: T, handler: EventHandler<T>): void
}