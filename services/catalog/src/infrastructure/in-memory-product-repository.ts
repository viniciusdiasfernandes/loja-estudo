import {InvalidProductIdError, Product} from '../domain/product'
import type { ListParams, ListResult, ProductRepository } from '../application/product-repository'
import validator from "validator";

export class InMemoryProductRepository implements ProductRepository {

    private readonly products = new Map<string, Product>()

    async save(product: Product): Promise<void> {
        this.products.set(product.id, product);
    }

    async findById(id: string): Promise<Product | null> {
        if (!validator.isUUID(id)) {
            throw new InvalidProductIdError(`ID inválido: ${id}`)
        }
        return this.products.get(id) ?? null
    }

    async list({ limit, offset }: ListParams): Promise<ListResult> {
        /**
         * ESTUDO:
         * this.products.values(): o Map guarda pares chave-valor, e .values() devolve só os valores, mas como um iterador (algo que você percorre com for...of), e não como array. Iteradores não têm .sort, .slice ou .map.
         *
         * Array.from(...): converte o iterador num array de verdade. A forma equivalente é o spread, [...this.products.values()]. Qualquer uma serve; use a que achar mais legível.
         *
         * .sort(comparador): ordena o array. Dois pontos importantes:
         *
         * Ele muda o array original (é mutável), diferente do map e do filter, que devolvem um array novo. Aqui não faz mal, porque Array.from já criou uma cópia: ordenar a cópia não mexe no Map. Se você ordenasse um array que pertence a outro objeto, teria um efeito colateral escondido.
         * Sem comparador, o sort ordena como texto, e [10, 9, 1].sort() vira [1, 10, 9]. Com objetos, nem faz sentido. Por isso sempre passe um comparador.
         *
         * O comparador (a, b) => ...: recebe dois elementos e devolve um número. Negativo significa “a vem antes de b”, positivo significa “b vem antes”, e zero significa “empate”.
         *
         * a.name.localeCompare(b.name): compara dois textos e já devolve esse número negativo, zero ou positivo. É o jeito de comparar strings.
         *
         * O || como desempate: localeCompare devolve 0 quando os nomes são iguais, e 0 é falsy (lembra da aula 2?). Então || cai no lado direito, que compara os ids. Se o nome já desempata, o || devolve esse número e nem olha o id. É o mesmo order by name asc, id asc do SQL.
         *
         * .slice(offset, offset + limit): devolve uma cópia de um trecho do array, do índice offset até offset + limit (sem incluir o fim). Exemplo com limit = 2:
         */
        const all = Array.from(this.products.values()).sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        )

        return {
            items: all.slice(offset, offset + limit),
            total: all.length,
        }
    }
}