import { describe, it, expect, beforeEach } from 'vitest'
import { ReserveStock } from './reserve-stock'
import type { ProductRepository } from './product-repository'
import { InMemoryProductRepository } from '../infrastructure/in-memory-product-repository'
import { InMemoryEventPublisher } from '../infrastructure/in-memory-event-publisher'
import { Product } from '../domain/product'

describe('ReserveStock', () => {
    let products: InMemoryProductRepository
    let publisher: InMemoryEventPublisher
    let reserveStock: ReserveStock
    let mouse: Product
    let keyboard: Product

    beforeEach(async () => {
        products = new InMemoryProductRepository()
        publisher = new InMemoryEventPublisher()
        reserveStock = new ReserveStock(products, publisher)

        mouse = Product.create('Mouse', 2450, 10)
        keyboard = Product.create('Teclado', 5990, 3)
        await products.save(mouse)
        await products.save(keyboard)
    })

    async function stockOf(product: Product): Promise<number | undefined> {
        return (await products.findById(product.id))?.stock
    }

    describe('quando há estoque', () => {
        it('reduz o estoque e publica StockReserved com o id do pedido', async () => {
            await reserveStock.execute({
                orderId: 'order-1',
                items: [{ productId: mouse.id, quantity: 4 }],
            })

            expect(await stockOf(mouse)).toBe(6)
            expect(publisher.published()).toHaveLength(1)
            expect(publisher.published()[0]).toMatchObject({
                type: 'StockReserved',
                orderId: 'order-1',
            })
        })

        it('reserva vários produtos do mesmo pedido', async () => {
            await reserveStock.execute({
                orderId: 'order-1',
                items: [
                    { productId: mouse.id, quantity: 2 },
                    { productId: keyboard.id, quantity: 1 },
                ],
            })

            expect(await stockOf(mouse)).toBe(8)
            expect(await stockOf(keyboard)).toBe(2)
        })

        it('aceita pedir exatamente o que existe em estoque', async () => {
            await reserveStock.execute({
                orderId: 'order-1',
                items: [{ productId: keyboard.id, quantity: 3 }],
            })

            expect(await stockOf(keyboard)).toBe(0)
            expect(publisher.published()[0]?.type).toBe('StockReserved')
        })
    })

    describe('quando não dá para reservar: publica StockRejected e não mexe em nada', () => {
        async function expectRejected(
            items: { productId: string; quantity: number }[],
            reason: RegExp,
        ) {
            await reserveStock.execute({ orderId: 'order-1', items })

            expect(publisher.published()).toHaveLength(1)
            const event = publisher.published()[0]
            expect(event).toMatchObject({ type: 'StockRejected', orderId: 'order-1' })
            expect(event && 'reason' in event && event.reason).toMatch(reason)
            expect(await stockOf(mouse)).toBe(10)
            expect(await stockOf(keyboard)).toBe(3)
        }

        it('estoque insuficiente', async () => {
            await expectRejected([{ productId: keyboard.id, quantity: 4 }], /estoque insuficiente/i)
        })

        it('tudo ou nada: se um item não tem estoque, nenhum é reservado', async () => {
            await expectRejected(
                [
                    { productId: mouse.id, quantity: 2 }, // este teria estoque
                    { productId: keyboard.id, quantity: 99 }, // este não
                ],
                /estoque insuficiente/i,
            )
        })

        it('produto que não existe', async () => {
            await expectRejected(
                [{ productId: '3f9d1c4e-8a52-4b6e-9d41-0c7a5e2b1f10', quantity: 1 }],
                /não encontrado/i,
            )
        })

        it('id que nem é um uuid', async () => {
            await expectRejected([{ productId: 'p1', quantity: 1 }], /não encontrado/i)
        })

        it.each([[0], [-1], [1.5]])('quantidade inválida (%s)', async (quantity) => {
            await expectRejected([{ productId: mouse.id, quantity }], /quantidade inválida/i)
        })

        it('o mesmo produto em duas linhas é somado antes de conferir', async () => {
            // 2 + 2 = 4, mas só há 3 teclados
            await expectRejected(
                [
                    { productId: keyboard.id, quantity: 2 },
                    { productId: keyboard.id, quantity: 2 },
                ],
                /estoque insuficiente/i,
            )
        })
    })

    it('se o banco falhar ao salvar, o erro sobe e nada é publicado', async () => {
        const failing: ProductRepository = {
            findById: (id) => products.findById(id),
            list: (params) => products.list(params),
            save: async () => {
                throw new Error('banco fora do ar')
            },
        }
        const useCase = new ReserveStock(failing, publisher)

        await expect(
            useCase.execute({ orderId: 'order-1', items: [{ productId: mouse.id, quantity: 1 }] }),
        ).rejects.toThrow(/banco fora do ar/)

        expect(publisher.published()).toHaveLength(0)
    })
})
