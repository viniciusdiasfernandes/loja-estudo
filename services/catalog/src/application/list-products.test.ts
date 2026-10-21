import { describe, it, expect } from 'vitest'
import { ListProducts, InvalidPaginationError } from './list-products'
import { InMemoryProductRepository } from '../infrastructure/in-memory-product-repository'
import { Product } from '../domain/product'

async function setup(names: string[]) {
    const repository = new InMemoryProductRepository()
    for (const name of names) {
        await repository.save(Product.create(name, 1000))
    }
    return new ListProducts(repository)
}

describe('ListProducts', () => {
    it('usa página 1 e tamanho 20 quando nada é informado', async () => {
        const listProducts = await setup(['A', 'B', 'C'])

        const output = await listProducts.execute({})

        expect(output.page).toBe(1)
        expect(output.pageSize).toBe(20)
        expect(output.total).toBe(3)
        expect(output.totalPages).toBe(1)
        expect(output.items.map((i) => i.name)).toEqual(['A', 'B', 'C'])
    })

    it('devolve a página pedida', async () => {
        const listProducts = await setup(['A', 'B', 'C', 'D', 'E'])

        const output = await listProducts.execute({ page: 2, pageSize: 2 })

        expect(output.items.map((i) => i.name)).toEqual(['C', 'D'])
        expect(output.total).toBe(5)
        expect(output.totalPages).toBe(3)
    })

    it('a última página pode ter menos itens', async () => {
        const listProducts = await setup(['A', 'B', 'C', 'D', 'E'])

        const output = await listProducts.execute({ page: 3, pageSize: 2 })

        expect(output.items.map((i) => i.name)).toEqual(['E'])
    })

    it('página além do fim devolve lista vazia, sem erro', async () => {
        const listProducts = await setup(['A', 'B', 'C', 'D', 'E'])

        const output = await listProducts.execute({ page: 10, pageSize: 2 })

        expect(output.items).toEqual([])
        expect(output.total).toBe(5)
        expect(output.totalPages).toBe(3)
    })

    it('sem produtos, devolve zero itens e zero páginas', async () => {
        const listProducts = await setup([])

        const output = await listProducts.execute({})

        expect(output).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 })
    })

    it('limita o tamanho da página a 100', async () => {
        const listProducts = await setup(['A'])

        const output = await listProducts.execute({ pageSize: 1000 })

        expect(output.pageSize).toBe(100)
    })

    it.each([
        ['page zero', { page: 0 }],
        ['page negativo', { page: -1 }],
        ['page decimal', { page: 1.5 }],
        ['page NaN', { page: Number.NaN }],
        ['pageSize zero', { pageSize: 0 }],
        ['pageSize negativo', { pageSize: -5 }],
    ])('rejeita %s', async (_descricao, input) => {
        const listProducts = await setup(['A'])

        await expect(listProducts.execute(input)).rejects.toThrow(InvalidPaginationError)
    })

    it('devolve objetos simples, e não entidades do domínio', async () => {
        const listProducts = await setup(['Mouse'])

        const output = await listProducts.execute({})

        expect(output.items[0]).toEqual({
            id: expect.any(String),
            name: 'Mouse',
            priceInCents: 1000,
            stock: 0,
        })
    })
})