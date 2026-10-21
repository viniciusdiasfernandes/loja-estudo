import {describe, it, expect} from 'vitest'
import {CreateProduct} from './create-product'
import {InMemoryProductRepository} from "../infrastructure/in-memory-product-repository";
import {InvalidProductError} from "../domain/product";

describe('CreateProduct', () => {
    it('Cria e salva um produto', async () => {
        const repository = new InMemoryProductRepository()
        const createProduct = new CreateProduct(repository)

        const output = await createProduct.execute({
            name: 'Mouse',
            priceInCents: 2450,
            stock: 10
        })
        const savedProduct = await repository.findById(output.id)
        expect(savedProduct?.name).toBe('Mouse')
        expect(savedProduct?.stock).toBe(10)
    })

    it('Falha ao enviar nome vazio', async () => {

        const repository = new InMemoryProductRepository()
        const createProduct = new CreateProduct(repository)

        await expect(
            createProduct.execute({
                name: '',
                priceInCents: 2450,
                stock: 10
            })
        ).rejects.toThrow(InvalidProductError)
    })
})