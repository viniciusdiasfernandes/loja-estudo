import type {ProductRepository} from "./product-repository";

type Output = {id:string, name: string; priceInCents: number; stock?: number}
type Input = {id: string}

export class GetProduct {

    constructor(private readonly repository: ProductRepository) {}
    async execute(input: Input): Promise<Output>  {

        const product = await this.repository.findById(input.id)

        if (!product) {
            throw new ProductNotFoundError(`Produto não encontrado: ${input.id}`)
        }

        return {
            id: product.id,
            name: product?.name,
            priceInCents: product?.priceInCents,
            stock: product?.stock
        }
    }
}

export class ProductNotFoundError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ProductNotFoundError'
    }
}