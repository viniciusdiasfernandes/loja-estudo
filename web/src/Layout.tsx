import { NavLink, Outlet } from 'react-router'
import { Header } from './Header'

export function Layout() {
    return (
        <main>
            <Header title="Loja" />

            <nav>
                <NavLink to="/" end>
                    Produtos
                </NavLink>
                {' | '}
                <NavLink to="/products/new">Novo produto</NavLink>
            </nav>

            <Outlet />
        </main>
    )
}