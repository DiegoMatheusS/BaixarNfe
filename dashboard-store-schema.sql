-- ProcurandoDashboardBI - compras Pix
CREATE TABLE IF NOT EXISTS dashboard_purchases (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  dashboard_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  mp_order_id TEXT UNIQUE,
  mp_payment_id TEXT,
  mp_status TEXT,
  mp_status_detail TEXT,
  status_token_hash TEXT NOT NULL,
  status_token_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  buyer_email_sent_at TEXT,
  seller_email_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_ip_created ON dashboard_purchases(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_email_created ON dashboard_purchases(email_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_purchases_mp_order ON dashboard_purchases(mp_order_id);
