# loja-estudo

Projeto de estudo para praticar **Node.js, TypeScript, React e testes E2E com Playwright**, com foco em **Clean Architecture**.

É uma mini loja: um serviço de catálogo (API) com PostgreSQL e um front-end em React para listar e cadastrar produtos.

## O que tem aqui

- **Backend** (`services/catalog`): Node.js + TypeScript + Fastify, organizado em camadas (`domain`, `application`, `infrastructure`, `interfaces/http`). O domínio não depende de nada externo; o PostgreSQL entra por uma interface (porta) e um adaptador.
- **Frontend** (`web`): React + Vite + React Router. Lista de produtos com busca, filtro de estoque e favoritos, e um formulário de novo produto.
- **Testes**:
    - Vitest: testes unitários (domínio e casos de uso, com repositório em memória), de rotas e de integração com o PostgreSQL real.
    - Playwright: testes E2E da API e da interface, em navegador real.

## Estrutura

```
loja-estudo/
├── services/
│   ├── catalog/          # API de produtos
│   │   ├── migrations/   # SQL das tabelas
│   │   └── src/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       └── interfaces/http/
│   └── orders/           # previsto, ainda vazio
├── web/                  # React (Vite)
├── e2e/                  # Playwright
├── scripts/api.ps1       # atalho de PowerShell para chamar a API
└── docker-compose.yml    # PostgreSQL
```

## Pré-requisitos

- [Node.js](https://nodejs.org) (versão LTS)
- [Docker](https://www.docker.com/products/docker-desktop) (Docker Desktop aberto, no Windows e no macOS)
- Git

## Como rodar

**1. Clonar e instalar**

```bash
git clone <URL-DO-REPOSITORIO>
cd loja-estudo
npm install
```

**2. Subir o PostgreSQL**

```bash
docker compose up -d
docker compose ps
```

Espere o status ficar `healthy`.

**3. Criar as tabelas**

O projeto usa dois bancos: `loja_catalog` (desenvolvimento) e `loja_catalog_test` (testes).

PowerShell:

```powershell
Get-Content services/catalog/migrations/001_create_products.sql | docker compose exec -T postgres psql -U loja -d loja_catalog

docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_catalog_test"
Get-Content services/catalog/migrations/001_create_products.sql | docker compose exec -T postgres psql -U loja -d loja_catalog_test
```

Bash (macOS/Linux):

```bash
docker compose exec -T postgres psql -U loja -d loja_catalog < services/catalog/migrations/001_create_products.sql

docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_catalog_test"
docker compose exec -T postgres psql -U loja -d loja_catalog_test < services/catalog/migrations/001_create_products.sql
```

**4. Iniciar a API** (terminal 1)

```bash
npm run dev -w services/catalog
```

**5. Iniciar o front-end** (terminal 2)

```bash
npm run dev -w web
```

**6. Abrir**

- Aplicação: http://localhost:5173
- API: http://localhost:3001 (teste em http://localhost:3001/health)

## Testes

**Unitários e de integração (Vitest)**. Precisam do Docker no ar e do banco de teste criado (passo 3):

```bash
npm test
npm run typecheck
```

**E2E (Playwright)**. Na primeira vez, baixe o navegador:

```bash
npx playwright install chromium
```

Depois:

```bash
npm run test -w e2e                       # tudo
npm run test -w e2e -- --project=api      # só a API
npm run test -w e2e -- --project=ui       # só a interface
npm run test -w e2e -- --project=ui --ui  # modo interativo (recomendado para estudar)
npx playwright show-report e2e/playwright-report
```

O Playwright sobe sozinho a API e o front de teste, em portas e banco próprios, sem encostar nos dados de desenvolvimento.

## Portas

| Serviço | Desenvolvimento | Testes E2E |
|---|---|---|
| Front-end | 5173 | 5174 |
| API (catalog) | 3001 | 3101 |
| PostgreSQL | 5432 | 5432 (banco `loja_catalog_test`) |

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado do servidor |
| POST | `/products` | Cria um produto (`name`, `priceInCents`, `stock` opcional) |
| GET | `/products/:id` | Busca um produto pelo id |
| GET | `/products?page=1&pageSize=20` | Lista paginada, ordenada por nome (máximo de 100 por página) |

O preço trafega em **centavos inteiros** (`5990` = 59,90).

Respostas de erro: `400` para formato inválido, `404` para produto inexistente e `422` para regra de negócio violada.

## Telas

| Rota | Tela |
|---|---|
| `/` | Lista de produtos |
| `/products/new` | Novo produto |
| qualquer outra | Página não encontrada |

## Comandos úteis do Docker

```bash
docker compose stop        # para o banco (dados mantidos)
docker compose start       # liga de novo
docker compose down        # remove o contêiner (dados mantidos)
docker compose down -v     # remove tudo, inclusive os dados
```

## Problemas comuns

- **`port is already allocated` na 5432**: já existe um PostgreSQL rodando na máquina. Troque a porta no `docker-compose.yml` (por exemplo `"5433:5432"`) e ajuste as strings de conexão.
- **`cannot connect to the docker daemon`**: o Docker Desktop não está aberto.
- **`password authentication failed`** depois de mudar credenciais: o volume guarda as antigas. Rode `docker compose down -v` e suba de novo (apaga os dados).
- **Testes falham com `ECONNREFUSED`**: o PostgreSQL não está no ar ou o banco de teste não foi criado (passo 3).
- **Credenciais**: `loja` / `loja` são só para desenvolvimento local.

## Estado do projeto

- [x] Catálogo: criar, buscar e listar com paginação
- [x] Front: lista, busca, filtro, favoritos, cadastro e rotas
- [x] E2E: API e interface
- [ ] Paginação na tela
- [ ] Página de detalhe do produto
- [ ] Serviço de pedidos (`orders`)