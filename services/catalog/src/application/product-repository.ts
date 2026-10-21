import type {Product} from '../domain/product'

export interface ProductRepository {
    save(product: Product): Promise<void>
    findById(id: string):Promise<Product | null>
}