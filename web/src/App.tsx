import { useState } from 'react'
import { Header } from './Header'
import { ProductCard } from './ProductCard'
import type { Product } from './types'
import {Counter} from "./Counter.tsx";

const products: Product[] = [
    { id: '1', name: 'Teclado', priceInCents: 5990, stock: 5 },
    { id: '2', name: 'Mouse', priceInCents: 2450, stock: 0 },
    { id: '3', name: 'Monitor', priceInCents: 12900, stock: 2 },
]

function App() {
    const [onlyInStock, setOnlyInStock] = useState(false)
    const [search, setSearch] = useState('')

    const visibleProducts = products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
        const matchesStock = !onlyInStock || product.stock > 0
        return matchesSearch && matchesStock
    })

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

            <ul>
                {visibleProducts.length === 0 ? (
                    <p>Nenhum produto encontrado</p>
                ) : (
                    <ul>
                        {visibleProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </ul>
                )}
            </ul>
        </main>
    )
}

export default App