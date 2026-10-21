import { describe, it, expect } from 'vitest'
import { buildApp } from './app'

describe('GET /health', () => {
    it('responde 200 com ok true', async () => {
        const app = buildApp()

        const response = await app.inject({ method: 'GET', url: '/health' })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ ok: true })
    })
})