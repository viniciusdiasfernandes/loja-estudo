import {randomUUID} from 'node:crypto'

export class InvalidProductError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidProductError'
    }
}

export class InsufficientStockError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InsufficientStockError'
    }
}

export class Product {

    private constructor(
        readonly id: string,
        readonly name: string,
        readonly priceInCents: number,
        private _stock: number,
    ) {
        this.name = name
        this.priceInCents = priceInCents
    }

    static create(name: string, priceInCents: number, stock: number = 0): Product {
        const trimmedName = name.trim();

        if (trimmedName.length > 100) {
            throw new InvalidProductError('Nome do produto deve ter no máximo 100 caracteres')
        }

        if (trimmedName === '') {
            throw new InvalidProductError('Nome do produto não pode ser vazio')
        }

        if (priceInCents <= 0) {
            throw new InvalidProductError('Preço do produto deve ser maior que zero')
        }

        if (!Number.isInteger(priceInCents)) {
            throw new InvalidProductError('Preço deve ser um número inteiro em centavos')
        }


        if (!Number.isInteger(stock) || stock < 0) {
            throw new InvalidProductError('Estoque deve ser um inteiromaior ou igual a zero')
        }

        return new Product(
            randomUUID(),
            trimmedName,
            priceInCents,
            stock
        )
    }

    get stock(): number {
        return this._stock
    }

    decreaseStock(quantity: number): void {
        if(!Number.isInteger(quantity) || quantity <= 0) {
            throw new InvalidProductError(
                `'A quantidade para decrementar o estoque deve ser um inteiro maior que zero'`,
            )
        }
        if (quantity > this._stock) {
            throw new InsufficientStockError(
                `Estoque insuficiente: disponível ${this._stock}, solicitado ${quantity}`,
            )
        }
        this._stock -= quantity
    }
}