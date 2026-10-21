import {describe, it, expect} from 'vitest'
import {CreateProduct} from './create-product'
import {GetProduct, ProductNotFoundError} from './get-product'
import {InMemoryProductRepository} from "../infrastructure/in-memory-product-repository";
import {InvalidProductError, InvalidProductIdError} from "../domain/product";
import {randomUUID} from "node:crypto";

describe('GetProduct', () => {
    it('Acha um produto válido', async () => {
        const repository = new InMemoryProductRepository()
        const createProduct = new CreateProduct(repository)
        const getProduct = new GetProduct(repository)

        const outputCreateProduct = await createProduct.execute({
            name: 'Mouse',
            priceInCents: 2450,
            stock: 10
        })
        const outputGetProduct = await getProduct.execute({id: outputCreateProduct.id});
        expect(outputGetProduct).toEqual({ id: outputCreateProduct.id, name: 'Mouse', priceInCents: 2450, stock: 10 })

    })

    it('Falha ao enviar id vazio ou invalido', async () => {

        const repository = new InMemoryProductRepository()
        const getProduct = new GetProduct(repository)

        await expect(
            getProduct.execute({id:'a'})
        ).rejects.toThrow(InvalidProductIdError)
    })

    it('Falha ao não achar o produto pelo ID', async () => {

        const repository = new InMemoryProductRepository()
        const getProduct = new GetProduct(repository)

        await expect(
            getProduct.execute({id: randomUUID()})
        ).rejects.toThrow(ProductNotFoundError)
    })
})