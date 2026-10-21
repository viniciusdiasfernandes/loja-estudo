import Fastify from 'fastify'
import type { CreateProduct } from '../../application/create-product'
import { InvalidProductError } from '../../domain/product'
import { InvalidProductIdError } from '../../domain/product'
import { ProductNotFoundError } from '../../application/get-product'
import type { GetProduct } from '../../application/get-product'

export type AppDependencies = {
    createProduct: CreateProduct
    getProduct: GetProduct
}

type CreateProductBody = {
    name: string
    priceInCents: number
    stock?: number
}

const createProductSchema = {
    body: {
        type: 'object',
        required: ['name', 'priceInCents'],
        properties: {
            name: { type: 'string' },
            priceInCents: { type: 'integer' },
            stock: { type: 'integer' },
        },
    },
}

export function buildApp(deps: AppDependencies) {
    const app = Fastify({
        ajv: { customOptions: { coerceTypes: false } },//desligando a coerção para não ter transformação de tipos pelo fastify
    })

    app.get('/health', async () => ({ ok: true }))

    app.post<{ Body: CreateProductBody }>(
        '/products',
        { schema: createProductSchema },
        async (request, reply) => {
            try {
                const output = await deps.createProduct.execute(request.body)
                return reply.code(201).send(output)
            } catch (error) {
                if (error instanceof InvalidProductError) {
                    return reply.code(422).send({ error: error.message })
                }
                throw error
            }
        },
    )
    app.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
        try {
            return await deps.getProduct.execute({ id: request.params.id })
        } catch (error) {
            if (error instanceof ProductNotFoundError) {
                return reply.code(404).send({ error: error.message })
            }
            if (error instanceof InvalidProductIdError) {
                return reply.code(400).send({ error: error.message })
            }
            throw error
        }
    })

    return app
}