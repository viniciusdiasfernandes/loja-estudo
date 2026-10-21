import type { Product } from './types'

type ProductCardProps = {
    product: Product
}

const priceFormatter = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
})

export function ProductCard({ product }: ProductCardProps) {
    return (
        <li>
            <strong>{product.name}</strong> — {priceFormatter.format(product.priceInCents / 100)}
            {product.stock === 0 ? <span> (sem estoque)</span> : <span> ({product.stock} em estoque)</span>}
        </li>
    )
}