import pg from 'pg'

const connectionString =
    process.env.DATABASE_URL ?? 'postgres://loja:loja@localhost:5432/loja_catalog'

const pool = new pg.Pool({ connectionString })

const result = await pool.query('select 1 as ok')
console.log(result.rows)

await pool.end()