import {Header} from './Header'
import {ProductCard} from './ProductCard'
import {Counter} from "./Counter.tsx";
import {useEffect, useState} from 'react'
import type {Product, ProductsPage} from './types'

type ProductsState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; products: Product[] }

function App() {
    const [onlyInStock, setOnlyInStock] = useState(false)
    const [search, setSearch] = useState('')
    const [favoriteIds, setFavoriteIds] = useState<string[]>([])
    const [state, setState] = useState<ProductsState>({status: 'loading'})

    useEffect(() => {
        const controller = new AbortController()

        async function load() {
            try {
                const response = await fetch('/api/products', {signal: controller.signal})
                if (!response.ok) {
                    throw new Error(`Erro ${response.status} ao buscar produtos`)
                }
                const data: ProductsPage = await response.json()
                setState({status: 'success', products: data.items})
            } catch (error) {
                if (controller.signal.aborted) return
                setState({
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Erro desconhecido',
                })
            }
        }

        load()

        return () => controller.abort()
    }, [])

    const products = state.status === 'success' ? state.products : []

    const visibleProducts = products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
        const matchesStock = !onlyInStock || product.stock > 0
        return matchesSearch && matchesStock
    })

    function toggleFavorite(id: string) {
        setFavoriteIds((current) =>
            current.includes(id)
                ? current.filter((favoriteId) => favoriteId !== id)
                : [...current, id],
        )
    }

    return (
        <main>
            <Header title="Loja" subtitle="Uma loja para estudos"/>
            <Counter/>
            <div>
                <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(event) => setOnlyInStock(event.target.checked)}
                />
                Só com estoque
            </div>
            <div>
                <input
                    type="text"
                    placeholder="Buscar por nome"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>

            {state.status === 'loading' && <p>Carregando…</p>}
            {state.status === 'error' && <p role="alert">{state.message}</p>}
            {state.status === 'success' &&
                (visibleProducts.length === 0 ? (
                    <p>Nenhum produto encontrado</p>
                ) : (
                    <ul>
                        {visibleProducts.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                isFavorite={favoriteIds.includes(product.id)}
                                onToggleFavorite={() => toggleFavorite(product.id)}
                            />
                        ))}
                    </ul>
                ))}
        </main>
    )
}

export default App