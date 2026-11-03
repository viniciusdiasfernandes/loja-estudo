import type { ConfirmChannel } from 'amqplib'
import type { EventPublisher } from '../application/event-publisher'
import type { IntegrationEvent } from '../application/integration-events'
import { EVENTS_EXCHANGE } from './rabbitmq-topology'

export class RabbitMqEventPublisher implements EventPublisher {
    // Recebe o canal pronto (como o Pool no repositório): quem monta a aplicação
    // abre e fecha a conexão.
    constructor(
        private readonly channel: ConfirmChannel,
        private readonly exchange: string = EVENTS_EXCHANGE,
    ) {}

    async publish(events: readonly IntegrationEvent[]): Promise<void> {
        for (const event of events) {
            this.channel.publish(
                this.exchange,
                event.type, // chave de roteamento = nome do evento
                Buffer.from(JSON.stringify(event)), // Date vira texto ISO no JSON
                {
                    persistent: true, // a mensagem é gravada em disco
                    contentType: 'application/json',
                    type: event.type,
                },
            )
        }

        // Espera o RabbitMQ confirmar que recebeu tudo. Sem isso, publish() poderia
        // "terminar" com a mensagem ainda no buffer da rede, e se perder numa falha.
        await this.channel.waitForConfirms()
    }
}