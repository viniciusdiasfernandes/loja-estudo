import pg from 'pg'
import { connect } from 'amqplib'
import { buildApp } from './interfaces/http/app'
import { CreateProduct } from './application/create-product'
import { GetProduct } from './application/get-product'
import { ListProducts } from './application/list-products'
import { ReserveStock } from './application/reserve-stock'
import { PostgresProductRepository } from './infrastructure/postgres-product-repository'
import { RabbitMqEventPublisher } from './infrastructure/rabbitmq-event-publisher'
import { RabbitMqEventSubscriber } from './infrastructure/rabbitmq-event-subscriber'
import { assertEventsExchange } from './infrastructure/rabbitmq-topology'
import { registerOrderEventHandlers } from './interfaces/events/order-event-handlers'

// Raiz de composição: o único lugar que conhece as classes concretas
// e decide quem se liga a quem.
const port = Number(process.env.PORT ?? 3001)
const databaseUrl =
    process.env.DATABASE_URL ?? 'postgres://loja:loja@localhost:5432/loja_catalog'
const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://loja:loja@localhost:5672'

// Infraestrutura
const pool = new pg.Pool({ connectionString: databaseUrl })
const connection = await connect(rabbitUrl)
const publishChannel = await connection.createConfirmChannel() // com confirmação, para publicar
const consumeChannel = await connection.createChannel() // para consumir
await assertEventsExchange(publishChannel)

const repository = new PostgresProductRepository(pool)
const publisher = new RabbitMqEventPublisher(publishChannel)

// Casos de uso
const createProduct = new CreateProduct(repository)
const getProduct = new GetProduct(repository)
const listProducts = new ListProducts(repository)
const reserveStock = new ReserveStock(repository, publisher)

// Entrada por eventos: a fila deste serviço escuta os pedidos criados no orders.
const subscriber = new RabbitMqEventSubscriber(consumeChannel, 'catalog.order-placed')
registerOrderEventHandlers(subscriber, reserveStock)
await subscriber.start()

// Entrada por HTTP
const app = buildApp({ createProduct, getProduct, listProducts })
await app.listen({ port, host: '0.0.0.0' })
console.log(`catalog ouvindo na porta ${port}`)

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
