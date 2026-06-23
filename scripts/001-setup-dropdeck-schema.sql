-- DropDeck Schema Setup
-- Aurora PostgreSQL with Drizzle ORM integration

-- Create ENUM types (IF NOT EXISTS - idempotent)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE drop_status AS ENUM ('draft', 'scheduled', 'live', 'sold_out', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('reserved', 'paid', 'confirmed', 'expired', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE checkout_outcome AS ENUM ('success', 'sold_out', 'limit_exceeded', 'not_live', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users table (buyers, sellers, admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'buyer',
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Seller profiles
CREATE TABLE IF NOT EXISTS seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  payout_email TEXT,
  stripe_account_id TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_seller_profiles_user_id ON seller_profiles(user_id);
CREATE INDEX idx_seller_profiles_store_slug ON seller_profiles(store_slug);

-- Drops table
CREATE TABLE IF NOT EXISTS drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  price INTEGER NOT NULL,
  total_stock INTEGER NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status drop_status DEFAULT 'draft',
  max_per_buyer INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_drops_status_start_time ON drops(status, start_time);
CREATE INDEX idx_drops_seller_id ON drops(seller_id);
CREATE INDEX idx_drops_start_time ON drops(start_time);
CREATE INDEX idx_drops_end_time ON drops(end_time) WHERE end_time IS NOT NULL;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status order_status DEFAULT 'reserved',
  stripe_payment_intent_id TEXT,
  reserved_at TIMESTAMP DEFAULT now(),
  paid_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_orders_drop_id_status ON orders(drop_id, status);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_expires_at_status ON orders(expires_at, status);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders(stripe_payment_intent_id);

-- Checkout audit log
CREATE TABLE IF NOT EXISTS checkout_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  buyer_id UUID,
  attempted_at TIMESTAMP DEFAULT now(),
  outcome checkout_outcome NOT NULL,
  order_id UUID REFERENCES orders(id),
  latency_ms INTEGER
);

CREATE INDEX idx_checkout_log_drop_id ON checkout_log(drop_id);
CREATE INDEX idx_checkout_log_buyer_id ON checkout_log(buyer_id);
CREATE INDEX idx_checkout_log_attempted_at ON checkout_log(attempted_at DESC);

-- Ensure all tables have appropriate constraints
ALTER TABLE orders ADD CONSTRAINT ck_orders_quantity_positive CHECK (quantity > 0);
ALTER TABLE orders ADD CONSTRAINT ck_orders_unit_price_non_negative CHECK (unit_price >= 0);
ALTER TABLE orders ADD CONSTRAINT ck_orders_total_amount_non_negative CHECK (total_amount >= 0);
ALTER TABLE drops ADD CONSTRAINT ck_drops_total_stock_positive CHECK (total_stock > 0);
ALTER TABLE drops ADD CONSTRAINT ck_drops_price_non_negative CHECK (price >= 0);
ALTER TABLE drops ADD CONSTRAINT ck_drops_max_per_buyer_positive CHECK (max_per_buyer > 0);
