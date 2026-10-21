import {InvalidProductIdError, Product} from '../domain/product'
import type {ProductRepository} from "../application/product-repository";
import validator from "validator";

export class InMemoryProductRepository implements ProductRepository {

    private readonly products = new Map<string, Product>()

    async save(product: Product): Promise<void> {
        this.products.set(product.id, product);
    }

    async findById(id: string): Promise<Product | null> {
        if (!validator.isUUID(id)) {
            throw new InvalidProductIdError(`ID inválido: ${id}`)
        }
        return this.products.get(id) ?? null
    }
}