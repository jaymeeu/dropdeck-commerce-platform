# DropDeck — Flash Sales Platform

**The zero-oversell commerce platform for flash drops and limited releases.**

DropDeck is a production-grade flash sale platform built with Next.js 16, Amazon Aurora PostgreSQL, and Stripe. The core innovation is an atomic checkout transaction using database-level row locking (`SELECT ... FOR UPDATE`) to guarantee zero overselling under concurrent load — verified by a 150-concurrent-request load test against a 100-unit drop.

---

## Key Features

- **Zero-Oversell Guarantee** — Database-level row locking serializes concurrent checkouts; impossible to oversell
- **Flash Drop Management** — Sellers create limited-stock drops with start/end times and per-buyer limits
- **Live Countdown Timers** — Storefront shows live countdowns for active and upcoming drops
- **Stock Progress Bar** — Real-time remaining inventory display on every drop card
- **Role-Based Access** — Separate buyer, seller, and admin experiences with middleware guards
- **Atomic Transactions** — All checkout operations are fully ACID-compliant
- **Stripe Payments** — Payment intents, webhook confirmation, and refund handling
- **Reservation System** — 5-minute hold on reserved stock; PostgreSQL triggers expire stale reservations automatically
- **Auto Status Transitions** — Drops move `scheduled → live → ended` via DB triggers + inline query promotion
- **Live Seller Analytics** — Real-time order dashboards per drop with CSV export
- **Admin Panel** — Platform-wide GMV, user, drop, and order metrics
- **ISR Storefront** — Homepage revalidates every 30 seconds for near-real-time drop status without polling

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Amazon Aurora PostgreSQL Serverless v2 + IAM Auth |
| Authentication | Custom session auth (bcrypt + iron-session) |
| Payments | Stripe (Payment Intents + Webhooks) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Queries | Raw PostgreSQL with parameterized queries (no ORM) |
| Deployment | Vercel (ISR + Edge middleware) |

### Database Schema

```
users                    — buyers, sellers, admins
  └── seller_profiles    — store name, slug, bio (extends sellers)

drops                    — flash sales with inventory, start/end times, status
  ├── orders             — customer reservations and confirmed purchases
  └── checkout_log       — full audit trail of every checkout attempt
```

### Migration Files

| File | Purpose |
|---|---|
| `001-setup-dropdeck-schema.sql` | Full schema: tables, indexes, constraints |
| `002-seed-data.sql` | Test users, seller profiles, and drops |
| `003-add-automation-triggers.sql` | PostgreSQL triggers for reservation expiry and status transitions |

### The Zero-Oversell Solution

**The Problem**: Without proper locking, concurrent requests can read the same available stock count and all succeed, overselling inventory.

**The Solution**: A `SELECT ... FOR UPDATE` row lock inside a serializable transaction:

```sql
BEGIN;

SELECT total_stock, reserved_count
FROM drops
WHERE id = $1
FOR UPDATE;  -- serializes all concurrent checkouts for this drop

-- check stock, insert order, update counts
COMMIT;
```

Every concurrent checkout for the same drop queues at the row lock. The first request takes the lock, checks stock, and either creates the order or returns `sold_out`. The next request gets the lock and sees the updated count. Overselling is structurally impossible.

**Load Test Result**: 150 concurrent requests against a 100-unit drop → exactly 100 succeeded, 50 rejected — zero oversell.

---

## Getting Started

### Prerequisites

1. Node.js 18+
2. Amazon Aurora PostgreSQL Serverless v2 instance
3. Vercel project with Aurora integration configured
4. Stripe account

### Environment Variables

Set these in your Vercel project (Settings → Environment Variables):

```env
# Database — provided by Vercel Aurora integration
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::123456789:role/vercel-aurora-role
PGHOST=your-cluster.cluster-xxx.us-east-1.rds.amazonaws.com
PGUSER=postgres
PGDATABASE=dropdeck

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Platform Config (optional — defaults shown)
PLATFORM_FEE_PERCENT=5
RESERVATION_TIMEOUT_SECONDS=300
MAX_UNITS_PER_BUYER=5
```

### Installation

```bash
# Install dependencies
npm install

# Apply database schema and seed data
npx tsx scripts/migrate.ts

# Start development server
npm run dev
```

Visit `http://localhost:3000`.

---

## Test Credentials

From `002-seed-data.sql`:

| Role | Email | Password |
|---|---|---|
| Seller | `seller1@example.com` | `password123` |
| Seller | `seller2@example.com` | `password123` |
| Buyer | `buyer1@example.com` | `password123` |
| Buyer | `buyer2@example.com` | `password123` |
| Buyer | `buyer3@example.com` | `password123` |
| Admin | `admin@example.com` | `password123` |

---

## User Flows

### Buyer
1. Browse the storefront at `/` — live drops show countdowns and stock bars
2. Click a drop to view details
3. Click **Checkout** to create a 5-minute reservation
4. Complete payment via Stripe on `/orders/[id]/pay`
5. View order history at `/orders`

### Seller
1. Sign in and go to `/seller/dashboard`
2. Click **New Drop** — fill in title, description, price, stock, images, start/end times
3. Drop is created as `scheduled`; transitions to `live` automatically at `start_time`
4. View real-time orders and analytics at `/seller/drops/[id]/analytics`
5. Export orders as CSV via `/api/seller/drops/[id]/orders/export`

### Admin
1. Sign in and go to `/admin`
2. View platform-wide metrics: GMV, user counts, active drops, total orders
3. Monitor all drops and orders across all sellers

---

## API Routes

### Public / Auth
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |

### Authenticated
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/checkout` | Create a stock reservation |
| `POST` | `/api/payments/intent` | Create a Stripe payment intent |
| `GET` | `/api/seller/drops/[id]/orders/export` | CSV export of orders for a drop |

### Webhooks & Cron
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/webhooks/stripe` | Handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` |
| `GET` | `/api/drops/status` | Cron: promotes `scheduled → live`, `live → ended`, expires stale reservations |

### Load Testing (internal)
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/load-test` | Seeds test drop + 150 buyers, fires concurrent checkouts, returns results |
| `POST` | `/api/load-test/cleanup` | Deletes all `loadtest_` prefixed rows in FK-safe order |

---

## Drop Status Lifecycle

```
scheduled
    │
    ▼  (start_time <= NOW())
  live  ──────────────────────────────►  sold_out  (when stock = 0)
    │
    ▼  (end_time <= NOW())
  ended
```

Status transitions happen in two places:
1. **Inline** — `getLiveDrops()` runs `UPDATE drops SET status = 'live'` before querying, ensuring the storefront is always current
2. **Cron** — `/api/drops/status` runs every minute to catch transitions between page loads

---

## Project Structure

```
app/
  ├── page.tsx                         # Storefront (ISR, revalidate: 30s)
  ├── drops/[id]/                      # Drop detail + checkout
  ├── orders/                          # Order history
  │   ├── [id]/pay/                    # Stripe payment page
  │   └── [id]/success/               # Post-payment confirmation
  ├── seller/
  │   ├── dashboard/                   # Seller overview
  │   └── drops/[id]/analytics/        # Per-drop real-time analytics
  ├── admin/                           # Platform metrics
  ├── auth/                            # Sign in / sign up pages
  └── api/                             # All route handlers (see API Routes above)

lib/
  ├── actions/                         # Server actions (checkout, drops, auth, users)
  ├── auth/                            # Session config, guards, middleware, password utils
  ├── hooks/                           # useAuth, useStripePayment
  ├── drop-lifecycle.ts                # Status transition helpers
  ├── stripe.ts / stripe/index.ts      # Stripe client utilities
  ├── db.ts                            # Aurora connection pool + IAM token refresh
  ├── env.ts                           # Runtime environment validation
  ├── types.ts                         # Shared TypeScript interfaces
  └── utils.ts                         # Shared helpers

scripts/
  ├── 001-setup-dropdeck-schema.sql    # Schema
  ├── 002-seed-data.sql                # Test data
  ├── 003-add-automation-triggers.sql  # PostgreSQL triggers
  └── migrate.ts                       # Migration runner

components/
  ├── drops/drop-card.tsx              # Drop card with live countdown + stock bar
  ├── layout/nav.tsx                   # Top navigation
  └── ui/                              # shadcn/ui primitives
```

---

## Performance

### Checkout Latency (Aurora Serverless v2, us-east-1)
- P50: ~30ms
- P95: ~80ms
- P99: ~150ms

### Storefront Caching
- Homepage uses ISR with `revalidate = 30` — at most one DB query per 30 seconds regardless of traffic
- `revalidatePath('/')` is called on `createDrop` to flush the cache immediately

### Scalability Notes
- Aurora connection pool defaults to 20 connections; increase `max` in `lib/db.ts` for higher throughput
- `SELECT ... FOR UPDATE` serializes checkouts per-drop, not per-request — horizontal scaling does not break the oversell guarantee

---

## Deployment

### Vercel

```bash
git remote add origin https://github.com/your-org/dropdeck.git
git push -u origin main
```

Then in the Vercel dashboard:
1. Connect the GitHub repo
2. Add all environment variables (see above)
3. Attach the Aurora integration under the Integrations tab

### Post-Deploy Checklist

- [ ] Run `npx tsx scripts/migrate.ts` against the production database
- [ ] Configure the Stripe webhook endpoint in the Stripe dashboard:
  - URL: `https://your-domain.com/api/webhooks/stripe`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- [ ] Verify Vercel Cron is running `/api/drops/status` every minute (`vercel.json` already configures this)

---

## Troubleshooting

**Database connection refused**
Check `PGHOST`, `PGUSER`, `PGDATABASE`. Verify the Aurora security group allows connections on port 5432 and the IAM role has `rds-db:connect` permission.

**Drop stuck in `scheduled` after start time**
Either trigger a page load (which runs the inline promotion) or wait for the cron at `/api/drops/status` to fire. In development, call `GET /api/drops/status` manually.

**Stripe webhook not firing**
Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in the Stripe dashboard. In development, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

**Checkout returns `sold_out` unexpectedly**
Check for stale `reserved` orders with expired `reserved_at` timestamps. The cron at `/api/drops/status` clears these. Call it manually to free reserved stock.

**Load test cleanup not running**
Call `POST /api/load-test/cleanup` separately after the test. The load test route intentionally leaves data in the DB for inspection.

---

## License

MIT
