import type { ProductRepository } from './product-repository'
import type { EventPublisher } from './event-publisher'
import type { Product } from '../domain/product'

export type ReserveStockInput = {
    orderId: string
    items: readonly { productId: string; quantity: number }[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ReserveStock {
    constructor(
        private readonly products: ProductRepository,
        private readonly publisher: EventPublisher,
    ) {}

    async execute(input: ReserveStockInput): Promise<void> {
        // Se o mesmo produto aparecer em duas linhas, soma antes de conferir.
        const wanted = new Map<string, number>()
        for (const item of input.items) {
            wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + item.quantity)
        }

        // Fase 1: só CONFERE. Nada é alterado enquanto houver dúvida.
        const toReserve: { product: Product; quantity: number }[] = []
        for (const [productId, quantity] of wanted) {
            // Um id que não é uuid não pode existir no catálogo (e o banco recusaria a consulta).
            const product = UUID.test(productId) ? await this.products.findById(productId) : null
            if (!product) {
                return this.reject(input.orderId, `Produto não encontrado: ${productId}`)
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return this.reject(input.orderId, `Quantidade inválida para o produto ${productId}`)
            }
            if (quantity > product.stock) {
                return this.reject(
                    input.orderId,
                    `Estoque insuficiente para o produto ${productId}: disponível ${product.stock}, solicitado ${quantity}`,
                )
            }
            toReserve.push({ product, quantity })
        }

        // Fase 2: tudo confere, agora reserva de verdade.
        for (const { product, quantity } of toReserve) {
            product.decreaseStock(quantity)
            await this.products.save(product)
        }

        await this.publisher.publish([
            { type: 'StockReserved', orderId: input.orderId, occurredAt: new Date() },
        ])
    }

    private async reject(orderId: string, reason: string): Promise<void> {
        await this.publisher.publish([
            { type: 'StockRejected', orderId, reason, occurredAt: new Date() },
        ])
    }
}
