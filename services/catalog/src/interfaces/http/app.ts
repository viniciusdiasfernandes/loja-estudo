import Fastify from 'fastify'
import type { CreateProduct } from '../../application/create-product'
import { InvalidProductError } from '../../domain/product'

export type AppDependencies = {
    createProduct: CreateProduct
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
    const app = Fastify()

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

    return app
}