import type { Channel, ConsumeMessage } from 'amqplib'
import type { EventHandler, EventSubscriber } from '../application/event-subscriber'
import type { IntegrationEvent } from '../application/integration-events'
import { EVENTS_EXCHANGE } from './rabbitmq-topology'

type AnyHandler = (event: IntegrationEvent) => void | Promise<void>

export class MalformedMessageError extends Error {
    constructor(reason: string) {
        super(`Mensagem inválida: ${reason}`)
        this.name = 'MalformedMessageError'
    }
}

// Faz o caminho inverso do publisher: bytes -> texto -> objeto.
// No JSON a data é um texto ISO; aqui ela volta a ser um Date de verdade.
function parseEvent(content: Buffer): IntegrationEvent {
    let raw: unknown
    try {
        raw = JSON.parse(content.toString())
    } catch {
        throw new MalformedMessageError('não é um JSON válido')
    }

    if (typeof raw !== 'object' || raw === null) {
        throw new MalformedMessageError('não é um objeto')
    }
    const data = raw as Record<string, unknown>
    if (typeof data.type !== 'string') {
        throw new MalformedMessageError('sem o campo "type"')
    }
    if (typeof data.orderId !== 'string') {
        throw new MalformedMessageError('sem o campo "orderId"')
    }
    if (typeof data.occurredAt !== 'string' || Number.isNaN(Date.parse(data.occurredAt))) {
        throw new MalformedMessageError('"occurredAt" ausente ou inválido')
    }

    return { ...data, occurredAt: new Date(data.occurredAt) } as IntegrationEvent
}

export class RabbitMqEventSubscriber implements EventSubscriber {
    private readonly handlers = new Map<string, AnyHandler[]>()
    private consumerTag: string | null = null

    // queueName: a fila é DO SERVIÇO (ex.: 'orders.stock-results'). Se várias cópias
    // do serviço usarem o mesmo nome, dividem as mensagens entre si.
    private readonly exchange: string
    private readonly onError: (error: unknown, message: ConsumeMessage) => void

    constructor(
        private readonly channel: Channel,
        private readonly queueName: string,
        options: {
            exchange?: string
            onError?: (error: unknown, message: ConsumeMessage) => void
        } = {},
    ) {
        this.exchange = options.exchange ?? EVENTS_EXCHANGE
        this.onError = options.onError ?? ((error) => console.error('Falha ao tratar mensagem:', error))
    }

    // Só anota o handler. A ligação com o RabbitMQ acontece no start(),
    // porque falar com o broker é assíncrono e a porta EventSubscriber não é.
    subscribe<T extends IntegrationEvent['type']>(type: T, handler: EventHandler<T>): void {
        const current = this.handlers.get(type) ?? []
        current.push(handler as AnyHandler)
        this.handlers.set(type, current)
    }

    async start(): Promise<void> {
        await this.channel.assertQueue(this.queueName, { durable: true })

        // Uma ligação por tipo de evento que alguém pediu.
        for (const type of this.handlers.keys()) {
            await this.channel.bindQueue(this.queueName, this.exchange, type)
        }

        // Uma mensagem por vez, sem receber a próxima antes de confirmar a atual.
        await this.channel.prefetch(1)

        const { consumerTag } = await this.channel.consume(this.queueName, (message) => {
            if (message) void this.handleMessage(message)
        })
        this.consumerTag = consumerTag
    }

    async stop(): Promise<void> {
        if (this.consumerTag) {
            await this.channel.cancel(this.consumerTag)
            this.consumerTag = null
        }
    }

    private async handleMessage(message: ConsumeMessage): Promise<void> {
        try {
            const event = parseEvent(message.content)
            for (const handler of this.handlers.get(event.type) ?? []) {
                await handler(event)
            }
            // ack: "pode apagar, já tratei". Só depois do handler terminar com sucesso.
            this.channel.ack(message)
        } catch (error) {
            this.onError(error, message)
            // nack sem reenfileirar: a mensagem é descartada. Reenfileirar uma mensagem
            // que sempre falha faria o serviço tentar para sempre. Depois a gente
            // manda essas mensagens para uma fila de "mortas" (dead letter) para análise.
            this.channel.nack(message, false, false)
        }
    }
}
