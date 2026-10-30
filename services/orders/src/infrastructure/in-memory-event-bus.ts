import type { IntegrationEvent } from '../application/integration-events'
import type { EventPublisher } from '../application/event-publisher'
import type { EventHandler, EventSubscriber } from '../application/event-subscriber'

type AnyHandler = (event: IntegrationEvent) => void | Promise<void>

// Barramento em memória: quem publica não sabe quem escuta.
// Faz o papel que o RabbitMQ fará depois, só que dentro do mesmo processo.
export class InMemoryEventBus implements EventPublisher, EventSubscriber {
    private readonly handlers = new Map<string, AnyHandler[]>()

    // Um handler que falha não pode derrubar quem publicou nem os outros handlers:
    // num broker de verdade, o publicador nem sabe quem está escutando.
    constructor(
        private readonly onHandlerError: (error: unknown, event: IntegrationEvent) => void = (error, event) =>
            console.error(`Falha ao tratar ${event.type}:`, error),
    ) {}

    subscribe<T extends IntegrationEvent['type']>(type: T, handler: EventHandler<T>): void {
        const current = this.handlers.get(type) ?? []
        // O cast é seguro: o handler só será chamado com eventos do tipo `type`.
        current.push(handler as AnyHandler)
        this.handlers.set(type, current)
    }

    async publish(events: readonly IntegrationEvent[]): Promise<void> {
        for (const event of events) {
            const handlers = this.handlers.get(event.type) ?? []
            for (const handler of handlers) {
                try {
                    await handler(event)
                } catch (error) {
                    this.onHandlerError(error, event)
                }
            }
        }
    }
}