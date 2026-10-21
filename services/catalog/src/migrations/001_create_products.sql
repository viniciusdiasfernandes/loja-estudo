create table if not exists products (
    id uuid primary key,
    name text not null,
    price_in_cents integer not null check (price_in_cents > 0),
stock integer not null default 0 check (stock >= 0)
);