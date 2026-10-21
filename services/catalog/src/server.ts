import pg from 'pg'
import { buildApp } from './interfaces/http/app'
import { CreateProduct } from './application/create-product'
import { GetProduct } from './application/get-product'
import { PostgresProductRepository } from './infrastructure/postgres-product-repository'

const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ?? 'postgres://loja:loja@localhost:5432/loja_catalog',
})

const repository = new PostgresProductRepository(pool)
const createProduct = new CreateProduct(repository)
const getProduct = new GetProduct(repository)
const app = buildApp({ createProduct, getProduct })

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
console.log(`catalog ouvindo na porta ${port}`)