import type { ProductRepository } from './product-repository'

export class InvalidPaginationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidPaginationError'
    }
}

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type Input = { page?: number; pageSize?: number }

type ProductOutput = {
    id: string
    name: string
    priceInCents: number
    stock: number
}

type Output = {
    items: ProductOutput[]
    page: number
    pageSize: number
    total: number
    totalPages: number
}

export class ListProducts {
    constructor(private readonly repository: ProductRepository) {}

    async execute(input: Input = {}): Promise<Output> {
        const page = input.page ?? DEFAULT_PAGE
        const requestedPageSize = input.pageSize ?? DEFAULT_PAGE_SIZE

        if (!Number.isInteger(page) || page < 1) {
            throw new InvalidPaginationError('A página deve ser um inteiro maior ou igual a 1')
        }
        if (!Number.isInteger(requestedPageSize) || requestedPageSize < 1) {
            throw new InvalidPaginationError('O tamanho da página deve ser um inteiro maior ou igual a 1')
        }

        const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE)
        const offset = (page - 1) * pageSize

        const { items, total } = await this.repository.list({ limit: pageSize, offset })

        return {
            items: items.map((product) => ({
                id: product.id,
                name: product.name,
                priceInCents: product.priceInCents,
                stock: product.stock,
            })),
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        }
    }
}