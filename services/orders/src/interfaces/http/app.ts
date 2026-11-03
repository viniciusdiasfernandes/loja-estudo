import Fastify from 'fastify'
import type { PlaceOrder, PlaceOrderInput } from '../../application/place-order'
import type { GetOrder } from '../../application/get-order'
import { InvalidOrderIdError } from '../../application/get-order'
import { OrderNotFoundError } from '../../application/order-not-found-error'
import { InvalidOrderError } from '../../domain/order'
import { InvalidOrderItemError } from '../../domain/order-item'

type Dependencies = {
    placeOrder: PlaceOrder
    getOrder: GetOrder
}

export function buildApp({ placeOrder, getOrder }: Dependencies) {
    // coerceTypes: false => "2" não vira 2. Quem manda o tipo errado recebe 400.
    const app = Fastify({ ajv: { customOptions: { coerceTypes: false } } })

    // Traduz erros da aplicação e do domínio em respostas HTTP, num lugar só.
    app.setErrorHandler((error, _request, reply) => {
        if (error instanceof InvalidOrderError || error instanceof InvalidOrderItemError) {
            return reply.code(422).send({ error: error.name, message: error.message })
        }
        if (error instanceof InvalidOrderIdError) {
            return reply.code(400).send({ error: error.name, message: error.message })
        }
        if (error instanceof OrderNotFoundError) {
            return reply.code(404).send({ error: error.name, message: error.message })
        }
        // Qualquer outro erro (inclusive o 400 de validação do próprio Fastify) segue o caminho padrão.
        return reply.send(error)
    })

    app.get('/health', async () => ({ ok: true }))

    app.post<{ Body: PlaceOrderInput }>(
        '/orders',
        {
            // Só o formato do corpo. As regras de negócio (quantidade > 0 etc.) são do domínio.
            schema: {
                body: {
                    type: 'object',
                    required: ['items'],
                    properties: {
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['productId', 'unitPriceInCents', 'quantity'],
                                properties: {
                                    productId: { type: 'string' },
                                    unitPriceInCents: { type: 'number' },
                                    quantity: { type: 'number' },
                                },
                            },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const output = await placeOrder.execute(request.body)
            return reply.code(201).send(output)
        },
    )

    app.get<{ Params: { id: string } }>('/orders/:id', async (request) => {
        return getOrder.execute({ id: request.params.id })
    })

    return app
}