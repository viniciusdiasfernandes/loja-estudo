export class OrderNotFoundError extends Error {
    constructor(readonly orderId: string) {
        super(`Pedido não encontrado: ${orderId}`)
        this.name = 'OrderNotFoundError'
    }
}