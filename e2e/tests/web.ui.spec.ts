import { test, expect } from '@playwright/test'

test('a página inicial mostra o título e o menu', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Loja', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Produtos', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Novo produto', exact: true })).toBeVisible()
})

test('o menu leva ao formulário de novo produto', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Novo produto', exact: true }).click()

    await expect(page).toHaveURL(/\/products\/new$/)
    await expect(page.getByRole('heading', { name: 'Novo produto' })).toBeVisible()
})

test('uma URL desconhecida mostra a página não encontrada', async ({ page }) => {
    await page.goto('/nao-existe')

    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('mostra a mensagem do domínio quando o nome está vazio', async ({ page }) => {
    await page.goto('/products/new')

    await page.getByLabel('Preço (€)').fill('59,90')
    await page.getByRole('button', { name: 'Adicionar produto' }).click()

    await expect(page.getByRole('alert')).toHaveText('Nome do produto não pode ser vazio')
})