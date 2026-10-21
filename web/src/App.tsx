import { ProductCard } from './ProductCard'
import { Header } from './Header'
import type { Product } from './types'

const products: Product[] = [
    { id: '1', name: 'Teclado', priceInCents: 5990, stock: 5 },
    { id: '2', name: 'Mouse', priceInCents: 2450, stock: 0 },
    { id: '3', name: 'Monitor', priceInCents: 12900, stock: 2 },
]

function App() {
    return (
        <main>
            <Header title="Loja de estudos" subtitle="Test"/>
            <ul>
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </ul>
        </main>
    )
}

export default App