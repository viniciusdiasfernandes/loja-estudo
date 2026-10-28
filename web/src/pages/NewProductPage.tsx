import { useNavigate } from 'react-router'
import { ProductForm } from '../ProductForm'

export function NewProductPage() {
    const navigate = useNavigate()

    return <ProductForm onCreated={() => navigate('/')} />
}