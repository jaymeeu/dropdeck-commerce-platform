# DropDeck Database Setup Guide

## Overview

DropDeck uses **Amazon Aurora PostgreSQL Serverless v2** with **role-based access control (IAM authentication)** for secure, scalable database operations.

The core innovation: **atomic checkout transactions** using `SELECT ... FOR UPDATE` to guarantee zero overselling under concurrent load.

## Prerequisites

1. **Amazon Aurora PostgreSQL Serverless v2** provisioned and running
2. **Vercel project** with Amazon Aurora PostgreSQL integration configured
3. **Environment variables** set in Vercel project settings:
   - `AWS_REGION` - e.g., `us-east-1`
   - `AWS_ROLE_ARN` - IAM role ARN for OIDC authentication
   - `PGHOST` - Aurora database endpoint
   - `PGUSER` - Database username (e.g., `postgres`)
   - `PGDATABASE` - Database name (e.g., `dropdeck`)

## Database Schema

### Tables

1. **users** - All platform users (buyers, sellers, admins)
   - PK: `id` (UUID)
   - Unique: `email`
   - Indexes: `email`, `role`

2. **seller_profiles** - Extended profile for sellers
   - PK: `id` (UUID)
   - FK: `user_id` → users (UNIQUE)
   - Unique: `store_slug` for URL routing

3. **drops** - Flash sales / drops
   - PK: `id` (UUID)
   - FK: `seller_id` → users
   - Status: enum (draft, scheduled, live, sold_out, ended)
   - Indexes: (status, start_time), seller_id, start_time, end_time

4. **orders** - Customer orders / reservations
   - PK: `id` (UUID)
   - FK: `drop_id`, `buyer_id` → users
   - Status: enum (reserved, paid, confirmed, expired, refunded)
   - **Key index**: (drop_id, status) for stock calculations
   - **Key index**: (expires_at, status) for expiry cron
   - **Key index**: stripe_payment_intent_id for webhook reconciliation

5. **checkout_log** - Audit trail of all checkout attempts
   - PK: `id` (UUID)
   - Outcome: enum (success, sold_out, limit_exceeded, not_live, error)
   - Indexes: drop_id, buyer_id, attempted_at DESC

## Migration

### Option 1: Manual Setup (Development)

```bash
# Apply all SQL migrations
npx tsx scripts/migrate.ts
```

This reads all `scripts/NNN-*.sql` files in order and applies them.

### Option 2: Vercel Deployment (Production)

When deploying to Vercel:

1. Ensure Aurora PostgreSQL is provisioned
2. Set environment variables in Vercel project settings
3. Deploy the code
4. Run migration in a pre-deployment hook or manually via Vercel CLI:
   ```bash
   vercel env pull
   npx tsx scripts/migrate.ts
   ```

## Key Schema Features

### 1. Zero-Oversell Guarantee

The `attemptCheckout()` server action uses:

```sql
SELECT ... FROM drops WHERE id = $1 FOR UPDATE
```

This **serializes concurrent checkout attempts** at the database layer:
- No application-level mutex needed
- No Redis lock needed
- Database handles all concurrency

### 2. Reservation Expiry (PostgreSQL Triggers)

Orders in `reserved` status expire automatically via **database triggers** (no external cron needed).

**Automation is handled by PostgreSQL triggers** (completely free, instant, guaranteed):
- `check_order_expiry()` trigger marks orders as `expired` when `expires_at <= NOW()`
- `check_drop_stock_on_order_change()` trigger automatically frees stock when orders expire/refund
- If stock becomes available, drop is auto-transitioned from `sold_out` back to `live` if still in live window
- No Vercel Cron fee, no external service dependency

### 3. Stock Calculation

Available stock = `total_stock` - SUM(quantity) where status IN ('reserved', 'paid', 'confirmed')

This includes reserved orders because they temporarily hold stock.

### 4. Per-Buyer Limits

Each buyer can purchase maximum `maxPerBuyer` units per drop, enforced in the transaction.

## API Functions

### Checkout

```typescript
import { attemptCheckout } from '@/lib/actions/checkout'

const result = await attemptCheckout(dropId, buyerId, quantity)

// Result:
// {
//   success: true,
//   order: Order,
//   latencyMs: 45
// }
// OR
// {
//   success: false,
//   error: "Only 5 units available",
//   errorCode: "sold_out",
//   latencyMs: 32
// }
```

### Drops

```typescript
import { getLiveDrops, getScheduledDrops, getAvailableStock, createDrop } from '@/lib/actions/drops'

// Get drops by status
const liveDrops = await getLiveDrops(20)
const scheduledDrops = await getScheduledDrops(20)

// Get available stock (accounting for active orders)
const available = await getAvailableStock(dropId)

// Create a new drop
const drop = await createDrop(sellerId, {
  title: 'Limited Sneakers',
  price: 10000, // $100.00 in cents
  totalStock: 100,
  startTime: new Date('2024-06-20T10:00:00Z'),
  maxPerBuyer: 3,
})
```

## Testing

### Load Testing

To verify the zero-oversell guarantee:

```bash
# Create a test drop with 100 units
# Fire 200+ concurrent checkout requests
# Verify exactly 100 orders are in 'reserved' or 'paid' status
```

See `scripts/load-test.ts` for automated load testing.

### Manual Testing

1. Create a drop with limited stock (e.g., 5 units)
2. Open drop page in multiple browser tabs
3. Click "Checkout" in each tab simultaneously
4. Verify only 5 orders are created (others fail with "sold_out")

## Environment Variables

```env
# Database (from Vercel Aurora integration)
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::123456789:role/...
PGHOST=aurora-db.123456.us-east-1.rds.amazonaws.com
PGUSER=postgres
PGDATABASE=dropdeck

# Platform config
PLATFORM_FEE_PERCENT=5
RESERVATION_TIMEOUT_SECONDS=300
MAX_UNITS_PER_BUYER=5

# Authentication (will be set up in next phase)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

# Stripe (will be set up in next phase)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Troubleshooting

### Connection Refused

- [ ] Verify `PGHOST`, `PGUSER`, `PGDATABASE` are correct
- [ ] Check Aurora security group allows outbound to port 5432
- [ ] Verify IAM role has `rds-db:connect` permission

### Permission Denied

- [ ] Check `AWS_ROLE_ARN` is valid
- [ ] Verify role trusts the Vercel OIDC provider
- [ ] Check role has RDS IAM database authentication policy

### Schema Not Found

- [ ] Run migrations: `npx tsx scripts/migrate.ts`
- [ ] Check for SQL errors in migration output

## Next Steps

1. Apply the schema using migration script
2. Implement authentication (Phase 3)
3. Build checkout UI and payment flow (Phase 4-5)
4. Add seller drop creation interface (Phase 6-7)
