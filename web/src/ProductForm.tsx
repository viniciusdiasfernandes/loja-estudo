import { useState, type FormEvent } from 'react'
import { parsePriceToCents } from './money'

type ProductFormProps = {
    onCreated: () => void
}

type SubmitState =
    | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'success' }
    | { status: 'error'; message: string }

export function ProductForm({ onCreated }: ProductFormProps) {
    const [name, setName] = useState('')
    const [price, setPrice] = useState('')
    const [stock, setStock] = useState('')
    const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' })

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const priceInCents = parsePriceToCents(price)
        if (priceInCents === null) {
            setSubmit({ status: 'error', message: 'Informe um preço válido, por exemplo 59,90' })
            return
        }

        setSubmit({ status: 'submitting' })

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    priceInCents,
                    stock: stock === '' ? undefined : Number(stock),
                }),
            })

            if (response.status === 422) {
                const body: { error: string } = await response.json()
                setSubmit({ status: 'error', message: body.error })
                return
            }
            if (!response.ok) {
                throw new Error(`Erro ${response.status}`)
            }

            setName('')
            setPrice('')
            setStock('')
            setSubmit({ status: 'success' })
            onCreated()
        } catch {
            setSubmit({ status: 'error', message: 'Não foi possível criar o produto. Tente novamente.' })
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2>Novo produto</h2>

            <label>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label>
                Preço (€)
                <input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="59,90"
                />
            </label>

            <label>
                Estoque
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                />
            </label>

            <button type="submit" disabled={submit.status === 'submitting'}>
                {submit.status === 'submitting' ? 'Salvando…' : 'Adicionar produto'}
            </button>

            {submit.status === 'error' && <p role="alert">{submit.message}</p>}
            {submit.status === 'success' && <p role="status">Produto criado</p>}
        </form>
    )
}