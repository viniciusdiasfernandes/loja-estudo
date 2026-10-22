export type Product = {
    id: string
    name: string
    priceInCents: number
    stock: number
}

export type ProductsPage = {
    items: Product[]
    page: number
    pageSize: number
    total: number
    totalPages: number
}