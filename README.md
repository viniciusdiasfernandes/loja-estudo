# loja-estudo

Projeto de estudo para praticar **Node.js, TypeScript, React e testes E2E com Playwright**, com foco em **Clean Architecture** e **comunicação entre serviços por eventos**.

É uma mini loja com dois serviços: o **catálogo** (produtos e estoque) e o **orders** (pedidos). Cada um tem o seu banco PostgreSQL, e eles conversam só por eventos no **RabbitMQ**. Um front-end em React lista e cadastra produtos.

## O que tem aqui

- **Catálogo** (`services/catalog`): Node.js + TypeScript + Fastify, organizado em camadas (`domain`, `application`, `infrastructure`, `interfaces`). O domínio não depende de nada externo; PostgreSQL e RabbitMQ entram por interfaces (portas) e adaptadores. Além da API de produtos, escuta `OrderPlaced` e reserva o estoque.
- **Orders** (`services/orders`): mesma arquitetura. Cria pedidos, publica `OrderPlaced` e confirma ou recusa o pedido conforme a resposta do catálogo.
- **Frontend** (`web`): React + Vite + React Router. Lista de produtos com busca, filtro de estoque e favoritos, e um formulário de novo produto.
- **Testes**:
    - Vitest: testes unitários (domínio e casos de uso, com repositório e publicador em memória), de rotas e de integração com o PostgreSQL e o RabbitMQ reais.
    - Playwright: testes E2E da API do catálogo e da interface, em navegador real.

## Como os serviços se comunicam

Os serviços **não chamam um ao outro**. Cada um publica eventos na exchange `loja.events` (tipo `topic`, a chave de roteamento é o nome do evento) e consome os que interessam pela sua própria fila. É uma **saga coreografada**: não há um coordenador central, cada serviço reage aos eventos do outro.

### Fluxo de um pedido

```mermaid
sequenceDiagram
    autonumber
    actor C as Cliente
    participant O as orders
    participant ODB as Postgres<br/>loja_orders
    participant R as RabbitMQ<br/>exchange loja.events
    participant CT as catalog
    participant CDB as Postgres<br/>loja_catalog

    C->>O: POST /orders { items }
    O->>O: valida e cria Order (status PENDING)
    O->>ODB: salva o pedido
    O->>R: publica OrderPlaced { orderId, items }
    O-->>C: 201 { orderId }
    Note over C,O: O HTTP termina aqui.<br/>Nenhum estoque foi reservado ainda.

    R->>CT: fila catalog.order-placed entrega OrderPlaced
    CT->>CDB: busca os produtos
    alt todos os itens existem e têm estoque
        CT->>CDB: baixa o estoque de cada produto
        CT->>R: publica StockReserved { orderId }
    else algum item falha (não existe, quantidade inválida, sem estoque)
        Note over CT: nada é baixado (tudo ou nada)
        CT->>R: publica StockRejected { orderId, reason }
    end

    R->>O: fila orders.stock-results entrega a resposta
    alt StockReserved
        O->>ODB: status CONFIRMED
        O->>R: publica OrderConfirmed
    else StockRejected
        O->>ODB: status REJECTED
        O->>R: publica OrderRejected
    end

    C->>O: GET /orders/:id
    O-->>C: status atual (PENDING, CONFIRMED ou REJECTED)
```

Pontos importantes:

- **Só o HTTP é síncrono.** O `201` do `POST /orders` quer dizer "pedido recebido", não "estoque garantido". Logo depois de criado, o pedido ainda está `PENDING`; o resultado aparece consultando `GET /orders/:id`.
- **A reserva acontece no catálogo**, quando ele consome `OrderPlaced` ([reserve-stock.ts](services/catalog/src/application/reserve-stock.ts)). Primeiro confere todos os itens (somando linhas repetidas do mesmo produto) e só então baixa o estoque.
- **Um serviço não precisa que o outro esteja no ar.** As filas e as mensagens são duráveis: se o catálogo cair, o orders continua aceitando pedidos, que ficam `PENDING` até o catálogo voltar e consumir a fila.
- **Consistência eventual**: por um instante existe pedido sem estoque reservado. É o preço do desacoplamento.

### Eventos

| Evento | Quem publica | Quem consome | Fila | Conteúdo |
|---|---|---|---|---|
| `OrderPlaced` | orders | catalog | `catalog.order-placed` | `orderId`, `items` (`productId`, `quantity`) |
| `StockReserved` | catalog | orders | `orders.stock-results` | `orderId` |
| `StockRejected` | catalog | orders | `orders.stock-results` | `orderId`, `reason` |
| `OrderConfirmed`, `OrderRejected` | orders | ninguém (ainda) | — | `orderId` |

Todos levam `type` e `occurredAt` (data ISO). As mensagens trafegam como JSON e são persistentes.

**Os serviços não compartilham código.** Cada um tem a sua própria cópia do contrato em `src/application/integration-events.ts`; o que é combinado entre eles é só o formato das mensagens.

**Garantias do consumo** ([rabbitmq-event-subscriber.ts](services/catalog/src/infrastructure/rabbitmq-event-subscriber.ts)):

- Uma mensagem por vez (`prefetch(1)`), confirmada (`ack`) só depois que o handler termina com sucesso.
- O publicador espera a confirmação do RabbitMQ (`waitForConfirms`) antes de considerar o evento enviado.
- Mensagem inválida ou handler com erro: o erro é registrado e a mensagem é descartada, sem reenfileirar (evita loop infinito).

### Limitações conhecidas

- **Sem transação na reserva**: os produtos de um pedido são salvos um a um. Se o banco falhar no meio, parte do estoque fica baixada e nenhum evento sai.
- **Sem idempotência**: se o mesmo `OrderPlaced` for entregue duas vezes, o estoque é baixado duas vezes.
- **Concorrência**: com mais de uma instância do catálogo, duas reservas podem ler o mesmo estoque ao mesmo tempo.
- **Evento salvo, mas não publicado**: o pedido é salvo e só depois o evento é publicado; se o processo cair entre os dois, o evento se perde (a solução clássica é o padrão *outbox*).
- **Sem compensação**: cancelar um pedido confirmado ainda não devolve o estoque.
- **Mensagens descartadas se perdem**: ainda não há fila de mensagens mortas (*dead letter*).
- **O preço vem do cliente**: o orders não confere `unitPriceInCents` com o catálogo.

## Estrutura

```
loja-estudo/
├── services/
│   ├── catalog/                # API de produtos + reserva de estoque
│   │   ├── migrations/         # SQL das tabelas
│   │   └── src/
│   │       ├── domain/         # Product
│   │       ├── application/    # casos de uso, portas e contrato de eventos
│   │       ├── infrastructure/ # Postgres, RabbitMQ e versões em memória
│   │       ├── interfaces/
│   │       │   ├── http/       # rotas Fastify
│   │       │   └── events/     # OrderPlaced -> ReserveStock
│   │       └── server.ts       # raiz de composição
│   └── orders/                 # API de pedidos
│       ├── migrations/
│       └── src/
│           ├── domain/         # Order, OrderItem, eventos de domínio
│           ├── application/    # PlaceOrder, GetOrder, ConfirmOrder, RejectOrder
│           ├── infrastructure/
│           ├── interfaces/
│           │   ├── http/
│           │   └── events/     # StockReserved/StockRejected -> Confirm/Reject
│           └── server.ts
├── web/                        # React (Vite)
├── e2e/                        # Playwright
└── docker-compose.yml          # PostgreSQL e RabbitMQ
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

**2. Subir o PostgreSQL e o RabbitMQ**

```bash
docker compose up -d
docker compose ps
```

Espere os dois ficarem `healthy`. O painel do RabbitMQ fica em http://localhost:15672 (usuário `loja`, senha `loja`): lá dá para ver a exchange `loja.events`, as filas e as mensagens passando.

A exchange e as filas são criadas pelos próprios serviços quando sobem; não precisa configurar nada no RabbitMQ.

**3. Criar os bancos e as tabelas**

São quatro bancos: `loja_catalog` e `loja_orders` (desenvolvimento), `loja_catalog_test` e `loja_orders_test` (testes). O `loja_catalog` já é criado pelo `docker-compose.yml`.

PowerShell:

```powershell
# catálogo
Get-Content services/catalog/migrations/001_create_products.sql | docker compose exec -T postgres psql -U loja -d loja_catalog
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_catalog_test"
Get-Content services/catalog/migrations/001_create_products.sql | docker compose exec -T postgres psql -U loja -d loja_catalog_test

# orders
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_orders"
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_orders_test"
Get-Content services/orders/migrations/001_create_orders.sql | docker compose exec -T postgres psql -U loja -d loja_orders
Get-Content services/orders/migrations/001_create_orders.sql | docker compose exec -T postgres psql -U loja -d loja_orders_test
```

Bash (macOS/Linux):

```bash
# catálogo
docker compose exec -T postgres psql -U loja -d loja_catalog < services/catalog/migrations/001_create_products.sql
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_catalog_test"
docker compose exec -T postgres psql -U loja -d loja_catalog_test < services/catalog/migrations/001_create_products.sql

# orders
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_orders"
docker compose exec postgres psql -U loja -d loja_catalog -c "create database loja_orders_test"
docker compose exec -T postgres psql -U loja -d loja_orders < services/orders/migrations/001_create_orders.sql
docker compose exec -T postgres psql -U loja -d loja_orders_test < services/orders/migrations/001_create_orders.sql
```

**4. Iniciar os serviços** (um terminal para cada)

```bash
npm run dev -w services/catalog
```

```bash
npm run dev -w services/orders
```

**5. Iniciar o front-end** (outro terminal)

```bash
npm run dev -w web
```

**6. Abrir**

- Aplicação: http://localhost:5173
- Catálogo: http://localhost:3001/health
- Orders: http://localhost:3002/health
- RabbitMQ: http://localhost:15672

### Experimentar o fluxo de um pedido

Bash:

```bash
# 1. cria um produto com 5 unidades e anota o id
curl -s -X POST localhost:3001/products -H 'content-type: application/json' \
  -d '{"name":"Mouse","priceInCents":2450,"stock":5}'

# 2. faz um pedido de 3 unidades (troque <ID-DO-PRODUTO>) e anota o orderId
curl -s -X POST localhost:3002/orders -H 'content-type: application/json' \
  -d '{"items":[{"productId":"<ID-DO-PRODUTO>","unitPriceInCents":2450,"quantity":3}]}'

# 3. um instante depois o pedido está CONFIRMED e o estoque caiu para 2
curl -s localhost:3002/orders/<ORDER-ID>
curl -s localhost:3001/products/<ID-DO-PRODUTO>
```

Repita o passo 2: como só restam 2 unidades, o segundo pedido fica `REJECTED` e o estoque não muda.

### Variáveis de ambiente

Todas têm um valor padrão para desenvolvimento local.

| Variável | Serviço | Padrão |
|---|---|---|
| `PORT` | catalog / orders | `3001` / `3002` |
| `DATABASE_URL` | catalog | `postgres://loja:loja@localhost:5432/loja_catalog` |
| `DATABASE_URL` | orders | `postgres://loja:loja@localhost:5432/loja_orders` |
| `RABBITMQ_URL` | os dois e os testes | `amqp://loja:loja@localhost:5672` |
| `ORDERS_TEST_DATABASE_URL` | testes do orders | `postgres://loja:loja@localhost:5432/loja_orders_test` |

## Testes

**Unitários e de integração (Vitest)**. Precisam do Docker no ar (PostgreSQL e RabbitMQ) e dos bancos de teste criados (passo 3):

```bash
npm test
npm run typecheck
npm run test:coverage
```

Os testes do RabbitMQ criam uma exchange e filas com nomes sorteados e apagam tudo no fim, então não interferem nos serviços rodando nem uns nos outros.

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

O Playwright sobe sozinho a API do catálogo e o front de teste, em portas e banco próprios, sem encostar nos dados de desenvolvimento.

## Portas

| Serviço | Desenvolvimento | Testes E2E |
|---|---|---|
| Front-end | 5173 | 5174 |
| API catalog | 3001 | 3101 |
| API orders | 3002 | — |
| PostgreSQL | 5432 | 5432 (bancos `*_test`) |
| RabbitMQ (AMQP) | 5672 | 5672 |
| RabbitMQ (painel) | 15672 | — |

## API

O preço trafega em **centavos inteiros** (`5990` = 59,90).

Respostas de erro: `400` para formato inválido, `404` para recurso inexistente e `422` para regra de negócio violada.

### Catálogo (porta 3001)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado do servidor |
| POST | `/products` | Cria um produto (`name`, `priceInCents`, `stock` opcional) |
| GET | `/products/:id` | Busca um produto pelo id |
| GET | `/products?page=1&pageSize=20` | Lista paginada, ordenada por nome (máximo de 100 por página) |

### Orders (porta 3002)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Estado do servidor |
| POST | `/orders` | Cria um pedido `PENDING` e devolve `201 { orderId }` |
| GET | `/orders/:id` | Busca o pedido: `id`, `status`, `totalInCents` e `items` com `subtotalInCents` |

Corpo do `POST /orders`:

```json
{
  "items": [
    { "productId": "…", "unitPriceInCents": 2450, "quantity": 3 }
  ]
}
```

Regras: pelo menos um item, preço e quantidade inteiros maiores que zero, e o mesmo produto não pode aparecer em duas linhas (some as quantidades).

Status de um pedido: `PENDING` → `CONFIRMED` ou `REJECTED` (pela resposta do estoque) ou `CANCELLED`. `PAID` e `SHIPPED` já existem no domínio, mas ainda não têm fluxo.

## Telas

| Rota | Tela |
|---|---|
| `/` | Lista de produtos |
| `/products/new` | Novo produto |
| qualquer outra | Página não encontrada |

## Comandos úteis do Docker

```bash
docker compose stop        # para o banco e o RabbitMQ (dados mantidos)
docker compose start       # liga de novo
docker compose down        # remove os contêineres (dados mantidos)
docker compose down -v     # remove tudo, inclusive os dados e as filas
```

## Problemas comuns

- **`port is already allocated` na 5432**: já existe um PostgreSQL rodando na máquina. Troque a porta no `docker-compose.yml` (por exemplo `"5433:5432"`) e ajuste as strings de conexão.
- **`cannot connect to the docker daemon`**: o Docker Desktop não está aberto.
- **`password authentication failed`** depois de mudar credenciais: o volume guarda as antigas. Rode `docker compose down -v` e suba de novo (apaga os dados).
- **Testes falham com `ECONNREFUSED`**: o PostgreSQL ou o RabbitMQ não está no ar, ou um banco de teste não foi criado (passo 3). Na porta 5672 é o RabbitMQ.
- **`database "loja_orders" does not exist`**: falta criar os bancos do orders (passo 3).
- **Pedido fica `PENDING` para sempre**: o catálogo não está rodando ou não conectou no RabbitMQ. Veja a fila `catalog.order-placed` no painel: se as mensagens estão acumulando, é o catálogo que não está consumindo.
- **Credenciais**: `loja` / `loja` são só para desenvolvimento local.

## Estado do projeto

- [x] Catálogo: criar, buscar e listar com paginação
- [x] Front: lista, busca, filtro, favoritos, cadastro e rotas
- [x] E2E: API do catálogo e interface
- [x] Serviço de pedidos (`orders`): criar e consultar pedidos
- [x] Comunicação por eventos com RabbitMQ: reserva de estoque e confirmação/recusa do pedido
- [ ] Reserva de estoque em transação e idempotente
- [ ] Outbox para não perder eventos
- [ ] Fila de mensagens mortas (*dead letter*)
- [ ] Cancelamento devolvendo o estoque
- [ ] Pagamento e envio do pedido
- [ ] E2E do fluxo de pedidos
- [ ] Paginação na tela
- [ ] Página de detalhe do produto
