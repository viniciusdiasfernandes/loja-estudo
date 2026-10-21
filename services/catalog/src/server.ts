import { buildApp } from './interfaces/http/app'

const app = buildApp()
const port = Number(process.env.PORT ?? 3001)

await app.listen({ port, host: '0.0.0.0' })
console.log(`catalog ouvindo na porta ${port}`)