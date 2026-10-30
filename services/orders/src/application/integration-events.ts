import type { OrderEvent } from '../domain/order-events'

// Eventos que o CATÁLOGO publica e o orders escuta.
// Este é o contrato entre os serviços: o orders mantém a sua própria cópia do formato
// e não importa código do catálogo.

// Estoque reservado para todos os itens do pedido.
export type StockReserved = {
    readonly type: 'StockReserved'
    readonly orderId: string
    readonly occurredAt: Date
}

// Não foi possível reservar o estoque (nada foi reservado).
export type StockRejected = {
    readonly type: 'StockRejected'
    readonly orderId: string
    readonly reason: string
    readonly occurredAt: Date
}

// Tudo o que trafega no barramento do ponto de vista do orders:
// os eventos que ele publica e os que ele consome.
export type IntegrationEvent = OrderEvent | StockReserved | StockRejected