CREATE TABLE IF NOT EXISTS orders (
                                      id     uuid PRIMARY KEY,
                                      status text NOT NULL
                                      CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PAID', 'SHIPPED'))
    );

CREATE TABLE IF NOT EXISTS order_items (
                                           order_id            uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id          text    NOT NULL,
    unit_price_in_cents integer NOT NULL CHECK (unit_price_in_cents > 0),
    quantity            integer NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id)
    );