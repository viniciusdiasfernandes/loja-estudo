import { Link } from 'react-router'

export function NotFoundPage() {
    return (
        <section>
            <h2>Página não encontrada</h2>
            <Link to="/">Voltar para os produtos</Link>
        </section>
    )
}