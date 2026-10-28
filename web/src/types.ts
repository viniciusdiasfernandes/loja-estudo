export type Product = {
    id: string
    name: string
    priceInCents: number
    stock: number
}

export type ProductsResponse = {
    items: Product[]
    page: number
    pageSize: number
    total: number
    totalPages: number
}