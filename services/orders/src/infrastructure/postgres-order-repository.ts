import type { Pool } from 'pg'
import { Order } from '../domain/order'
import type { OrderStatus } from '../domain/order'
import { OrderItem } from '../domain/order-item'
import type { OrderRepository } from '../application/order-repository'

type OrderRow = {
    id: string
    status: OrderStatus
}

type OrderItemRow = {
    product_id: string
    unit_price_in_cents: number
    quantity: number
}

export class PostgresOrderRepository implements OrderRepository {
    constructor(private readonly pool: Pool) {}

    async save(order: Order): Promise<void> {
        // Pedido e itens são gravados juntos: ou entram os dois, ou nenhum.
        const client = await this.pool.connect()
        try {
            await client.query('begin')

            await client.query(
                `insert into orders (id, status) values ($1, $2)
                 on conflict (id) do update set status = excluded.status`,
                [order.id, order.status],
            )

            // Os itens do pedido não mudam depois de criado, então regravar é seguro e simples.
            await client.query('delete from order_items where order_id = $1', [order.id])
            for (const item of order.items) {
                await client.query(
                    `insert into order_items (order_id, product_id, unit_price_in_cents, quantity)
                     values ($1, $2, $3, $4)`,
                    [order.id, item.productId, item.unitPriceInCents, item.quantity],
                )
            }

            await client.query('commit')
        } catch (error) {
            await client.query('rollback')
            throw error
        } finally {
            client.release()
        }
    }

    async findById(id: string): Promise<Order | null> {
        const orderResult = await this.pool.query<OrderRow>(
            'select id, status from orders where id = $1',
            [id],
        )
        const orderRow = orderResult.rows[0]
        if (!orderRow) return null

        const itemsResult = await this.pool.query<OrderItemRow>(
            `select product_id, unit_price_in_cents, quantity
             from order_items where order_id = $1 order by product_id`,
            [id],
        )
        const items = itemsResult.rows.map((row) =>
            OrderItem.create(row.product_id, row.unit_price_in_cents, row.quantity),
        )

        return Order.restore(orderRow.id, items, orderRow.status)
    }
}