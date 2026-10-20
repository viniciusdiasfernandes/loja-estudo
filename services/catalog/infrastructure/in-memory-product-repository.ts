import type {Product} from '../domain/product'
import type {ProductRepository} from "../application/product-repository";

export class InMemoryProductRepository implements ProductRepository {

    private readonly products = new Map<string, Product>()

    async save(product: Product): Promise<void> {
        this.products.set(product.id, product);
    }

    async findById(id: string): Promise<Product | null> {
        return this.products.get(id) ?? null
    }
}