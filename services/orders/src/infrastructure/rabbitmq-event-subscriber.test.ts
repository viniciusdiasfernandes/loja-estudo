import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { connect } from 'amqplib'
import type { ChannelModel, Channel, ConfirmChannel } from 'amqplib'
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher'
import { RabbitMqEventSubscriber, MalformedMessageError } from './rabbitmq-event-subscriber'
import { assertEventsExchange } from './rabbitmq-topology'
import type { OrderPlaced, OrderConfirmed } from '../domain/order-events'
import type { StockReserved } from '../application/integration-events'

const url = process.env.RABBITMQ_URL ?? 'amqp://loja:loja@localhost:5672'

// Exchange só deste arquivo (os arquivos de teste rodam em paralelo; ver o teste do publisher).
const exchange = `test.events.${randomUUID()}`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(condition: () => boolean, timeoutMs = 3000): Promise<void> {
    const start = Date.now()
    while (!condition()) {
        if (Date.now() - start > timeoutMs) throw new Error('Tempo esgotado esperando a condição')
        await sleep(20)
    }
}

describe('RabbitMqEventSubscriber', () => {
    let connection: ChannelModel
    let adminChannel: ConfirmChannel // publica e inspeciona filas
    let publisher: RabbitMqEventPublisher
    let consumerChannel: Channel
    let queueName: string
    let errors: unknown[]

    beforeAll(async () => {
        connection = await connect(url)
        adminChannel = await connection.createConfirmChannel()
        await assertEventsExchange(adminChannel, exchange)
        publisher = new RabbitMqEventPublisher(adminChannel, exchange)
    })

    afterAll(async () => {
        await adminChannel.deleteExchange(exchange)
        await adminChannel.close()
        await connection.close()
    })

    beforeEach(async () => {
        errors = []
        queueName = `test.orders.${randomUUID()}`
        consumerChannel = await connection.createChannel()
    })

    afterEach(async () => {
        await consumerChannel.close().catch(() => undefined)
        await adminChannel.deleteQueue(queueName)
    })

    function newSubscriber() {
        return new RabbitMqEventSubscriber(consumerChannel, queueName, {
            exchange,
            onError: (error) => errors.push(error),
        })
    }

    // Mensagens que ficaram na fila (prontas para entrega) vistas por outro canal.
    async function messagesInQueue(): Promise<number> {
        return (await adminChannel.checkQueue(queueName)).messageCount
    }

    const orderPlaced: OrderPlaced = {
        type: 'OrderPlaced',
        orderId: 'order-1',
        items: [{ productId: 'p1', quantity: 2 }],
        occurredAt: new Date('2026-11-03T10:00:00.000Z'),
    }

    it('entrega ao handler o evento publicado, com occurredAt de volta como Date', async () => {
        const received: OrderPlaced[] = []
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', (event) => {
            received.push(event)
        })
        await subscriber.start()

        await publisher.publish([orderPlaced])
        await waitFor(() => received.length === 1)

        expect(received[0]).toEqual(orderPlaced)
        expect(received[0]?.occurredAt).toBeInstanceOf(Date)
    })

    it('só recebe os tipos em que se inscreveu', async () => {
        const received: string[] = []
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', (event) => {
            received.push(event.type)
        })
        await subscriber.start()

        const confirmed: OrderConfirmed = {
            type: 'OrderConfirmed',
            orderId: 'order-1',
            occurredAt: new Date(),
        }
        await publisher.publish([confirmed, orderPlaced])
        await waitFor(() => received.length >= 1)
        await sleep(100) // dá tempo de uma entrega indevida aparecer

        expect(received).toEqual(['OrderPlaced'])
    })

    it('trata vários tipos na mesma fila, cada um no seu handler', async () => {
        const received: string[] = []
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', () => {
            received.push('placed')
        })
        subscriber.subscribe('StockReserved', () => {
            received.push('reserved')
        })
        await subscriber.start()

        const reserved: StockReserved = {
            type: 'StockReserved',
            orderId: 'order-1',
            occurredAt: new Date(),
        }
        await publisher.publish([orderPlaced, reserved])
        await waitFor(() => received.length === 2)

        expect(received).toEqual(['placed', 'reserved'])
    })

    it('duas filas diferentes recebem, cada uma, uma cópia do mesmo evento', async () => {
        const otherQueue = `test.other.${randomUUID()}`
        const otherChannel = await connection.createChannel()
        const a: string[] = []
        const b: string[] = []

        const first = newSubscriber()
        first.subscribe('OrderPlaced', (e) => {
            a.push(e.orderId)
        })
        await first.start()

        const second = new RabbitMqEventSubscriber(otherChannel, otherQueue, { exchange })
        second.subscribe('OrderPlaced', (e) => {
            b.push(e.orderId)
        })
        await second.start()

        await publisher.publish([orderPlaced])
        await waitFor(() => a.length === 1 && b.length === 1)

        expect(a).toEqual(['order-1'])
        expect(b).toEqual(['order-1'])

        await otherChannel.close()
        await adminChannel.deleteQueue(otherQueue)
    })

    it('confirma (ack) a mensagem depois que o handler termina: ela sai da fila', async () => {
        let done = false
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', async () => {
            await sleep(30)
            done = true
        })
        await subscriber.start()

        await publisher.publish([orderPlaced])
        await waitFor(() => done)
        await sleep(100) // tempo do ack chegar ao RabbitMQ

        // Fechar o canal devolve à fila o que ficou sem ack. Se o ack não tivesse ido,
        // a mensagem voltaria e a contagem seria 1.
        await consumerChannel.close()
        expect(await messagesInQueue()).toBe(0)
    })

    it('mensagens que chegam enquanto não há consumidor esperam na fila', async () => {
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', () => undefined)
        // a fila e o binding existem desde o start; paramos o consumo em seguida
        await subscriber.start()
        await subscriber.stop()

        await publisher.publish([orderPlaced])

        expect(await messagesInQueue()).toBe(1)
    })

    describe('quando algo dá errado', () => {
        it('handler que falha: o erro é reportado e a mensagem é descartada (sem loop)', async () => {
            let calls = 0
            const subscriber = newSubscriber()
            subscriber.subscribe('OrderPlaced', () => {
                calls++
                throw new Error('estoque quebrou')
            })
            await subscriber.start()

            await publisher.publish([orderPlaced])
            await waitFor(() => errors.length === 1)
            await sleep(150) // se fosse reenfileirada, voltaria a ser entregue neste intervalo

            expect(calls).toBe(1)
            expect((errors[0] as Error).message).toBe('estoque quebrou')
            await consumerChannel.close()
            expect(await messagesInQueue()).toBe(0)
        })

        it('mensagem que não é JSON: reportada como inválida e a fila segue funcionando', async () => {
            const received: string[] = []
            const subscriber = newSubscriber()
            subscriber.subscribe('OrderPlaced', (event) => {
                received.push(event.orderId)
            })
            await subscriber.start()

            adminChannel.publish(exchange, 'OrderPlaced', Buffer.from('isto não é json'))
            await adminChannel.waitForConfirms()
            await publisher.publish([orderPlaced])

            await waitFor(() => received.length === 1)
            expect(errors).toHaveLength(1)
            expect(errors[0]).toBeInstanceOf(MalformedMessageError)
            expect(received).toEqual(['order-1'])
        })

        it('JSON sem os campos obrigatórios também é recusado', async () => {
            const subscriber = newSubscriber()
            subscriber.subscribe('OrderPlaced', () => undefined)
            await subscriber.start()

            adminChannel.publish(
                exchange,
                'OrderPlaced',
                Buffer.from(JSON.stringify({ type: 'OrderPlaced' })),
            )
            await adminChannel.waitForConfirms()

            await waitFor(() => errors.length === 1)
            expect(errors[0]).toBeInstanceOf(MalformedMessageError)
        })

        it('um handler com erro não impede o próximo evento de ser tratado', async () => {
            const received: string[] = []
            const subscriber = newSubscriber()
            subscriber.subscribe('OrderPlaced', (event) => {
                if (event.orderId === 'ruim') throw new Error('falhou')
                received.push(event.orderId)
            })
            await subscriber.start()

            await publisher.publish([
                { ...orderPlaced, orderId: 'ruim' },
                { ...orderPlaced, orderId: 'boa' },
            ])

            await waitFor(() => received.length === 1)
            expect(received).toEqual(['boa'])
            expect(errors).toHaveLength(1)
        })
    })

    it('stop() para de entregar novos eventos', async () => {
        const received: string[] = []
        const subscriber = newSubscriber()
        subscriber.subscribe('OrderPlaced', (event) => {
            received.push(event.orderId)
        })
        await subscriber.start()
        await subscriber.stop()

        await publisher.publish([orderPlaced])
        await sleep(150)

        expect(received).toEqual([])
    })
})