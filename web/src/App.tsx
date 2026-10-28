import { Route, Routes } from 'react-router'
import { Layout } from './Layout'
import { NewProductPage } from './pages/NewProductPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductsPage } from './pages/ProductsPage'

function App() {
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<ProductsPage />} />
                <Route path="products/new" element={<NewProductPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    )
}

export default App