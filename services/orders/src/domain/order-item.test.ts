import { describe, it, expect } from 'vitest'
import { OrderItem, InvalidOrderItemError } from './order-item'

describe('OrderItem', () => {
    it('cria um item e calcula o subtotal', () => {
        const item = OrderItem.create('p1', 5990, 3)

        expect(item.productId).toBe('p1')
        expect(item.unitPriceInCents).toBe(5990)
        expect(item.quantity).toBe(3)
        expect(item.subtotalInCents).toBe(17970)
    })

    it('não altera o id do produto (sem trim)', () => {
        const item = OrderItem.create(' p1 ', 5990, 3)

        expect(item.productId).toBe(' p1 ')
    })

    it('itens com os mesmos valores são iguais', () => {
        const a = OrderItem.create('p1', 5990, 3)
        const b = OrderItem.create('p1', 5990, 3)

        expect(a.equals(b)).toBe(true)
    })

    it.each([
        ['id diferente', OrderItem.create('p2', 5990, 3)],
        ['preço diferente', OrderItem.create('p1', 5991, 3)],
        ['quantidade diferente', OrderItem.create('p1', 5990, 4)],
    ])('itens com %s não são iguais', (_descricao, other) => {
        const item = OrderItem.create('p1', 5990, 3)

        expect(item.equals(other)).toBe(false)
    })

    describe('validações', () => {
        it.each([
            ['vazio', ''],
            ['só com espaços', '   '],
        ])('rejeita id do produto %s', (_descricao, productId) => {
            expect(() => OrderItem.create(productId, 5990, 3)).toThrow(InvalidOrderItemError)
        })

        it.each([
            ['zero', 0],
            ['negativo', -100],
            ['decimal (não está em centavos)', 59.9],
            ['NaN', Number.NaN],
            ['infinito', Number.POSITIVE_INFINITY],
        ])('rejeita preço unitário %s', (_descricao, unitPriceInCents) => {
            expect(() => OrderItem.create('p1', unitPriceInCents, 3)).toThrow(InvalidOrderItemError)
        })

        it.each([
            ['zero', 0],
            ['negativa', -1],
            ['decimal', 1.5],
            ['NaN', Number.NaN],
            ['infinita', Number.POSITIVE_INFINITY],
        ])('rejeita quantidade %s', (_descricao, quantity) => {
            expect(() => OrderItem.create('p1', 5990, quantity)).toThrow(InvalidOrderItemError)
        })

        it('a mensagem indica qual campo está inválido', () => {
            expect(() => OrderItem.create('', 5990, 3)).toThrow(/id do produto/i)
            expect(() => OrderItem.create('p1', 0, 3)).toThrow(/preço/i)
            expect(() => OrderItem.create('p1', 5990, 0)).toThrow(/quantidade/i)
        })
    })
})