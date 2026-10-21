import type {Product} from '../domain/product'

export type ListParams = { limit: number; offset: number }
export type ListResult = { items: Product[]; total: number }

export interface ProductRepository {
    save(product: Product): Promise<void>
    findById(id: string):Promise<Product | null>
    list(params: ListParams): Promise<ListResult>
}