// Eventos de domínio: algo que JÁ aconteceu (por isso os nomes no passado).
// São dados imutáveis e carregam só o que os outros serviços precisam saber.

type OrderEventBase = {
    readonly orderId: string
    readonly occurredAt: Date
}

// Pedido criado. O catálogo ouve este evento para reservar estoque,
// por isso leva produto e quantidade (e não o preço).
export type OrderPlaced = OrderEventBase & {
    readonly type: 'OrderPlaced'
    readonly items: readonly { readonly productId: string; readonly quantity: number }[]
}

// Estoque reservado e pedido confirmado.
export type OrderConfirmed = OrderEventBase & { readonly type: 'OrderConfirmed' }

// Pedido recusado (por exemplo, falta de estoque).
export type OrderRejected = OrderEventBase & { readonly type: 'OrderRejected' }

// Pedido cancelado antes do pagamento.
export type OrderCancelled = OrderEventBase & { readonly type: 'OrderCancelled' }

// Pagamento recebido.
export type OrderPaid = OrderEventBase & { readonly type: 'OrderPaid' }

// Pedido enviado.
export type OrderShipped = OrderEventBase & { readonly type: 'OrderShipped' }

// União de todos os eventos que o Order pode gerar.
export type OrderEvent =
    | OrderPlaced
    | OrderConfirmed
    | OrderRejected
    | OrderCancelled
    | OrderPaid
    | OrderShipped