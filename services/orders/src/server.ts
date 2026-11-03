import { Pool } from 'pg'
import { connect } from 'amqplib'
import { buildApp } from './interfaces/http/app'
import { PlaceOrder } from './application/place-order'
import { GetOrder } from './application/get-order'
import { ConfirmOrder } from './application/confirm-order'
import { RejectOrder } from './application/reject-order'
import { PostgresOrderRepository } from './infrastructure/postgres-order-repository'
import { RabbitMqEventPublisher } from './infrastructure/rabbitmq-event-publisher'
import { RabbitMqEventSubscriber } from './infrastructure/rabbitmq-event-subscriber'
import { assertEventsExchange } from './infrastructure/rabbitmq-topology'
import { registerStockEventHandlers } from './interfaces/events/stock-event-handlers'

// Raiz de composição: o único lugar que conhece as classes concretas
// e decide quem se liga a quem.
const port = Number(process.env.PORT ?? 3002)
const databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://loja:loja@localhost:5432/loja_orders'
const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://loja:loja@localhost:5672'

// Infraestrutura
const pool = new Pool({ connectionString: databaseUrl })
const connection = await connect(rabbitUrl)
const publishChannel = await connection.createConfirmChannel() // com confirmação, para publicar
const consumeChannel = await connection.createChannel() // para consumir
await assertEventsExchange(publishChannel)

const orders = new PostgresOrderRepository(pool)
const publisher = new RabbitMqEventPublisher(publishChannel)

// Casos de uso
const placeOrder = new PlaceOrder(orders, publisher)
const getOrder = new GetOrder(orders)
const confirmOrder = new ConfirmOrder(orders, publisher)
const rejectOrder = new RejectOrder(orders, publisher)

// Entrada por eventos: a fila deste serviço escuta as respostas do estoque.
const subscriber = new RabbitMqEventSubscriber(consumeChannel, 'orders.stock-results')
registerStockEventHandlers(subscriber, confirmOrder, rejectOrder)
await subscriber.start()

// Entrada por HTTP
const app = buildApp({ placeOrder, getOrder })
await app.listen({ port, host: '0.0.0.0' })
console.log(`orders ouvindo na porta ${port}`)

// Desligamento ordenado: para de receber, termina o que está em andamento e fecha as conexões.
async function shutdown(signal: string) {
    console.log(`${signal} recebido, encerrando...`)
    await app.close()
    await subscriber.stop()
    await publishChannel.close()
    await consumeChannel.close()
    await connection.close()
    await pool.end()
    process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))