import type { Product } from './types'

type ProductCardProps = {
    product: Product
    isFavorite: boolean
    onToggleFavorite: () => void
}

const priceFormatter = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
})

export function ProductCard({ product, isFavorite, onToggleFavorite }: ProductCardProps) {
    return (
        <li>
            <strong>{product.name}</strong> — {priceFormatter.format(product.priceInCents / 100)}
            {product.stock === 0 ? <span> (sem estoque)</span> : <span> ({product.stock} em estoque)</span>}
            <button onClick={onToggleFavorite} aria-pressed={isFavorite}>
                {isFavorite ? '★ Favorito' : '☆ Favoritar'}
            </button>
        </li>
    )
}