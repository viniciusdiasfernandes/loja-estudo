import type { Channel } from 'amqplib'

// Uma exchange para todos os eventos da loja. O tipo "topic" roteia pela chave
// de cada mensagem; usamos o nome do evento (ex.: 'OrderPlaced') como chave.
export const EVENTS_EXCHANGE = 'loja.events'

// O nome padrão é o da aplicação. Os testes passam um nome próprio para não
// misturar mensagens com outros testes rodando ao mesmo tempo.
export async function assertEventsExchange(
    channel: Channel,
    exchange: string = EVENTS_EXCHANGE,
): Promise<void> {
    // durable: a exchange sobrevive a um reinício do RabbitMQ.
    // assert é idempotente: criar de novo com os mesmos parâmetros não faz mal.
    await channel.assertExchange(exchange, 'topic', { durable: true })
}