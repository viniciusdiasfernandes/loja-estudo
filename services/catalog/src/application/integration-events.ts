// Contrato de eventos do ponto de vista do CATÁLOGO.
// O formato é o combinado com o orders, mas cada serviço mantém a sua própria cópia:
// os serviços não compartilham código, só o formato das mensagens.

// Consumido: o orders criou um pedido e precisa reservar estoque.
export type OrderPlaced = {
    readonly type: 'OrderPlaced'
    readonly orderId: string
    readonly items: readonly { readonly productId: string; readonly quantity: number }[]
    readonly occurredAt: Date
}

// Publicado: o estoque de todos os itens do pedido foi reservado.
export type StockReserved = {
    readonly type: 'StockReserved'
    readonly orderId: string
    readonly occurredAt: Date
}

// Publicado: não foi possível reservar (nada foi reservado).
export type StockRejected = {
    readonly type: 'StockRejected'
    readonly orderId: string
    readonly reason: string
    readonly occurredAt: Date
}

export type IntegrationEvent = OrderPlaced | StockReserved | StockRejected
