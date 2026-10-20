import {describe, it, expect} from 'vitest'
import {Product, InvalidProductError, InsufficientStockError} from './product'

describe('Product', () => {
    it('Cria um produto válido', () => {
        const product = Product.create('Teclado mecânico', 5990)
        expect(product.name).toBe('Teclado mecânico');
        expect(product.priceInCents).toBe(5990);
    })
    it('rejeita nome vazio', () => {
        expect(() =>
            Product.create(
                '',
                5990,
            ),
        ).toThrow(InvalidProductError)
    })
    it('rejeita nome só com espaço em branco', () => {
        expect(() =>
            Product.create('       ', 5990),
        ).toThrow(InvalidProductError)
    })

    it('remove espaços nas pontas do nome', () => {
        const product = Product.create('   Mouse   ', 2450)
        expect(product.name).toBe('Mouse');
    })

    it('rejeita preço zerado', () => {
        expect(() =>
            Product.create('Mouse', 0),
        ).toThrow(InvalidProductError)
    })

    it('rejeita preço negativo', () => {
        expect(() =>
            Product.create('Mouse', -100),
        ).toThrow(InvalidProductError)
    })

    it('rejeita preço decimal (deve estar em centavos inteiros)', () => {
        expect(() =>
            Product.create('Mouse', 59.9),
        ).toThrow(InvalidProductError)
    })

    it('Confere se os ids foram criados', () => {
        const product = Product.create('Mouse', 10);
        expect(product.id).not.toBeNull();

    })

    it('rejeita nome com mais de 100 caracteres', () => {
        const nomeLongo = 'a'.repeat(101)
        expect(() => Product.create(nomeLongo, 2450)).toThrow(InvalidProductError)
    })

    it('aceita nome com exatamente 100 caracteres', () => {
        const nomeNoLimite = 'a'.repeat(100)
        const product = Product.create(nomeNoLimite, 2450)
        expect(product.name).toBe(nomeNoLimite)
    })

    it('cria produto com estoque zero por padrão', () => {
        const product = Product.create('Mouse', 2450)
        expect(product.stock).toBe(0)
    })

    it('cria produto com o estoque informado', () => {
        const product = Product.create('Mouse', 2450, 10)
        expect(product.stock).toBe(10)
    })

    it('rejeita estoque negativo', () => {
        expect(() => Product.create('Mouse', 2450, -1)).toThrow(InvalidProductError)
    })

    it('rejeita estoque decimal', () => {
        expect(() => Product.create('Mouse', 2450, 1.5)).toThrow(InvalidProductError)
    })

    describe('decreaseStock', () => {
        it('diminui o estoque', () => {
            const product = Product.create('Mouse', 2450, 10)
            product.decreaseStock(3)
            expect(product.stock).toBe(7)
        })

        it('permite baixar exatamente todo o estoque', () => {
            const product = Product.create('Mouse', 2450, 5)
            product.decreaseStock(5)
            expect(product.stock).toBe(0)
        })

        it('rejeita quando a quantidade é maior que o estoque', () => {
            const product = Product.create('Mouse', 2450, 5)
            expect(() => product.decreaseStock(6)).toThrow(InsufficientStockError)
        })

        it('não altera o estoque quando a baixa é rejeitada', () => {
            const product = Product.create('Mouse', 2450, 5)
            expect(() => product.decreaseStock(6)).toThrow()
            expect(product.stock).toBe(5)
        })

        it.each([
            ['zero', 0],
            ['negativo', -3],
            ['decimal', 1.5],
            ['NaN', Number.NaN],
        ])('rejeita quantidade %s', (_descricao, quantity) => {
            const product = Product.create('Mouse', 2450, 10)

            expect(() => product.decreaseStock(quantity)).toThrow(InvalidProductError)
        })

        it('valida a quantidade antes de checar o estoque', () => {
            const product = Product.create('Mouse', 2450, 1)

            expect(() => product.decreaseStock(1.5)).toThrow(InvalidProductError)
        })
    })
})