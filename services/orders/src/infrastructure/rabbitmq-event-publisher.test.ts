import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { connect } from 'amqplib'
import type { ChannelModel, ConfirmChannel } from 'amqplib'
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher'
import { assertEventsExchange } from './rabbitmq-topology'
import type { OrderPlaced, OrderConfirmed } from '../domain/order-events'

const url = process.env.RABBITMQ_URL ?? 'amqp://loja:loja@localhost:5672'

// Exchange só deste arquivo: o Vitest roda arquivos de teste em paralelo, e uma exchange
// compartilhada misturaria as mensagens de testes diferentes.
const exchange = `test.events.${randomUUID()}`

describe('RabbitMqEventPublisher', () => {
    let connection: ChannelModel
    let channel: ConfirmChannel
    let publisher: RabbitMqEventPublisher
    let queue: string

    beforeAll(async () => {
        connection = await connect(url)
        channel = await connection.createConfirmChannel()
        await assertEventsExchange(channel, exchange)
        publisher = new RabbitMqEventPublisher(channel, exchange)
    })

    afterAll(async () => {
        await channel.deleteExchange(exchange)
        await channel.close()
        await connection.close()
    })

    beforeEach(async () => {
        // Fila temporária só deste teste: nome sorteado pelo RabbitMQ, apagada ao fechar a conexão.
        const created = await channel.assertQueue('', { exclusive: true })
        queue = created.queue
        await channel.bindQueue(queue, exchange, 'OrderPlaced')
    })

    const orderPlaced: OrderPlaced = {
        type: 'OrderPlaced',
        orderId: 'order-1',
        items: [{ productId: 'p1', quantity: 2 }],
        occurredAt: new Date('2026-11-03T10:00:00.000Z'),
    }

    it('entrega o evento na fila ligada ao tipo dele, como JSON', async () => {
        await publisher.publish([orderPlaced])

        const message = await channel.get(queue, { noAck: true })

        expect(message).not.toBe(false)
        if (message === false) return
        expect(JSON.parse(message.content.toString())).toEqual({
            type: 'OrderPlaced',
            orderId: 'order-1',
            items: [{ productId: 'p1', quantity: 2 }],
            occurredAt: '2026-11-03T10:00:00.000Z', // a data chega como texto
        })
        expect(message.fields.routingKey).toBe('OrderPlaced')
        expect(message.properties.contentType).toBe('application/json')
    })

    it('marca a mensagem como persistente', async () => {
        await publisher.publish([orderPlaced])

        const message = await channel.get(queue, { noAck: true })

        expect(message && message.properties.deliveryMode).toBe(2)
    })

    it('não entrega à fila eventos de outro tipo', async () => {
        const confirmed: OrderConfirmed = {
            type: 'OrderConfirmed',
            orderId: 'order-1',
            occurredAt: new Date(),
        }

        await publisher.publish([confirmed])

        expect(await channel.get(queue, { noAck: true })).toBe(false)
    })

    it('publica vários eventos, cada um na sua mensagem e na ordem', async () => {
        await publisher.publish([
            { ...orderPlaced, orderId: 'a' },
            { ...orderPlaced, orderId: 'b' },
        ])

        const first = await channel.get(queue, { noAck: true })
        const second = await channel.get(queue, { noAck: true })

        expect(first && JSON.parse(first.content.toString()).orderId).toBe('a')
        expect(second && JSON.parse(second.content.toString()).orderId).toBe('b')
        expect(await channel.get(queue, { noAck: true })).toBe(false)
    })

    it('publicar uma lista vazia não faz nada nem dá erro', async () => {
        await expect(publisher.publish([])).resolves.toBeUndefined()

        expect(await channel.get(queue, { noAck: true })).toBe(false)
    })
})