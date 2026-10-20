import type {ProductRepository} from "./product-repository";
import {Product} from "../domain/product";

type Input = {name: string; priceInCents: number; stock?: number}
type Output = {id: string}

export class CreateProduct {

    constructor(private readonly repository: ProductRepository) {}
    async execute(input: Input): Promise<Output>  {
        const product = Product.create(input.name, input.priceInCents, input.stock)
        await this.repository.save(product)
        return {id: product.id}
    }
}