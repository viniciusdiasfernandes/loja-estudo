import type { Pool } from 'pg'
import {InvalidProductIdError, Product} from '../domain/product'
import type { ProductRepository } from '../application/product-repository'
import validator from 'validator'

type ProductRow = {
    id: string
    name: string
    price_in_cents: number
    stock: number
}

export class PostgresProductRepository implements ProductRepository {
    constructor(private readonly pool: Pool) {}

    async save(product: Product): Promise<void> {
        await this.pool.query(
    `insert into products (id, name, price_in_cents, stock)
     values ($1, $2, $3, $4) on conflict (id) do
    update set
        name = excluded.name,
        price_in_cents = excluded.price_in_cents,
        stock = excluded.stock`,
            [product.id, product.name, product.priceInCents, product.stock],
        )
    }

    async findById(id: string): Promise<Product | null> {

        if (!validator.isUUID(id)) {
            throw new InvalidProductIdError(`ID inválido: ${id}`)
        }

        const result = await this.pool.query<ProductRow>(
            'select id, name, price_in_cents, stock from products where id = $1',
            [id],
        )

        const row = result.rows[0]
        if (!row) return null

        return Product.restore(row.id, row.name, row.price_in_cents, row.stock)
    }
}