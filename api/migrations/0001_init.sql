CREATE TABLE products (
  id TEXT PRIMARY KEY,
  price INTEGER NOT NULL CHECK (price > 0)
);

CREATE TABLE stock (
  sku TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  glaze TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty >= 0)
);

CREATE TABLE orders (
  code TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,
  card_last4 TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'site'
);
CREATE INDEX orders_created ON orders(created_at);

CREATE TABLE order_lines (
  order_code TEXT NOT NULL REFERENCES orders(code) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  PRIMARY KEY (order_code, sku)
);

CREATE TABLE users (
  login TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  login TEXT NOT NULL REFERENCES users(login),
  expires_at INTEGER NOT NULL
);

CREATE TABLE hits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
