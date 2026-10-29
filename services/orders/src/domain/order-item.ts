export class InvalidOrderItemError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidOrderItemError'
    }
}

export class OrderItem {
    private constructor(
        readonly productId: string,
        readonly unitPriceInCents: number,
        readonly quantity: number,
    ) {}

    static create(productId: string, unitPriceInCents: number, quantity: number): OrderItem {
        if (productId.trim() === '') {
            throw new InvalidOrderItemError('Id do produto não pode ser vazio')
        }

        if (!Number.isInteger(unitPriceInCents) || unitPriceInCents <= 0) {
            throw new InvalidOrderItemError('Preço unitário deve ser um inteiro maior que zero (em centavos)')
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new InvalidOrderItemError('Quantidade deve ser um inteiro maior que zero')
        }

        return new OrderItem(productId, unitPriceInCents, quantity)
    }

    get subtotalInCents(): number {
        return this.unitPriceInCents * this.quantity
    }

    equals(other: OrderItem): boolean {
        return (
            this.productId === other.productId &&
            this.unitPriceInCents === other.unitPriceInCents &&
            this.quantity === other.quantity
        )
    }
}