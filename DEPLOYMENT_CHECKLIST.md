# DropDeck Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment

### Database Setup
- [ ] Amazon Aurora PostgreSQL Serverless v2 is provisioned and running
- [ ] VPC/security group allows outbound to port 5432
- [ ] Run migrations: `npx tsx scripts/migrate.ts`
- [ ] Verify schema is complete: Check all 5 tables exist
- [ ] Seed test data (optional): `npx tsx scripts/migrate.ts` applies 002-seed-data.sql
- [ ] Test database connection from app: `npm run dev` starts without errors

### Authentication Setup
- [ ] `NEXTAUTH_SECRET` is set (generate with `openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` is set to your domain (e.g., `https://dropdeck.vercel.app`)
- [ ] NextAuth.js is configured for production (secure: true for HTTPS)

### Stripe Setup
- [ ] Stripe account is created and verified
- [ ] Test API keys are obtained (`pk_test_...`, `sk_test_...`)
- [ ] Webhook secret is generated (`whsec_test_...`)
- [ ] Webhook endpoint is created in Stripe dashboard:
  - URL: `https://your-domain.com/api/webhooks/stripe`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- [ ] All Stripe keys are set in environment variables

### Environment Variables (Vercel Project Settings)
```env
# Database
AWS_REGION=
AWS_ROLE_ARN=
PGHOST=
PGUSER=
PGDATABASE=

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Platform
PLATFORM_FEE_PERCENT=5
RESERVATION_TIMEOUT_SECONDS=300
MAX_UNITS_PER_BUYER=5
CRON_SECRET= (generate with: openssl rand -base64 32)
```

## Local Testing

### Functionality Tests
- [ ] User registration works (buyer and seller roles)
- [ ] User login works with correct credentials
- [ ] Creating a drop works (sellers only)
- [ ] Checkout creates a reservation
- [ ] Stock countdown updates in real-time (poll every 5s)
- [ ] Orders appear in buyer's order history
- [ ] Seller dashboard shows accurate stats
- [ ] Admin panel shows all drops and orders

### Load Test
- [ ] Seed test data is loaded
- [ ] Drop with 100 units exists and is in `live` status
- [ ] Run load test: `npx tsx scripts/load-test.ts`
- [ ] Verify: Exactly 100 orders succeed (zero oversell)
- [ ] Verify: Remaining 50+ requests get "sold_out"

### Edge Cases
- [ ] Buyer hits per-drop purchase limit
- [ ] Drop transitions from scheduled → live automatically
- [ ] Reservation expires after timeout and frees stock
- [ ] Sold-out drop transitions back to live when stock opens up
- [ ] Stripe webhook receives payment confirmation

## Pre-Production Checklist

### Code Quality
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No ESLint errors: `npx eslint .`
- [ ] All console.log debug statements removed
- [ ] Error messages are user-friendly

### Security
- [ ] Password hashing uses bcryptjs (✓ configured)
- [ ] All user inputs are validated and sanitized
- [ ] Database queries use parameterized statements (✓ implemented)
- [ ] Stripe webhook verifies signature (✓ implemented)
- [ ] CORS is properly configured
- [ ] HTTPS is enforced (Vercel default)
- [ ] Session secrets are strong and random

### Performance
- [ ] Database indexes are all in place (✓ created)
- [ ] Cron job endpoint returns in <100ms
- [ ] Checkout endpoint returns in <500ms p99
- [ ] No N+1 queries in main flows
- [ ] Images are optimized (using URLs, not blobs)

### Monitoring & Observability
- [ ] Error logging is configured
- [ ] Vercel Analytics is enabled
- [ ] Stripe webhook logs are monitored
- [ ] Database slow query log is reviewed
- [ ] Alert thresholds are set for:
  - [ ] High error rate (>5%)
  - [ ] Slow checkouts (>1000ms p99)
  - [ ] Database connection pool exhaustion

## Deployment (to Vercel)

### GitHub Integration
- [ ] Repository is on GitHub (public or private)
- [ ] Vercel is connected to GitHub repo
- [ ] Branch to deploy is set (main)
- [ ] Vercel will auto-deploy on push

### Deploy Steps
```bash
# 1. Push code to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. Monitor deployment in Vercel dashboard
# 3. Run migrations in production (one-time):
#    Option A: Use Vercel CLI locally
#    vercel env pull
#    npx tsx scripts/migrate.ts
#
#    Option B: Manual SQL execution via AWS Console
#    Connect to Aurora and run 001-setup-dropdeck-schema.sql
#
# 4. Verify production database has schema:
#    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
```

### Post-Deployment
- [ ] Visit your production URL and test login/signup
- [ ] Create a test drop
- [ ] Test checkout flow
- [ ] Verify Stripe webhook receives events
- [ ] Check Vercel analytics for errors
- [ ] Monitor error logs for the first hour

## Stripe Test Mode Checklist

### Test Cards for Payments
```
4242 4242 4242 4242  - Success
4000 0000 0000 0002  - Decline
4000 0000 0000 0069  - 3D Secure required
```

### Test Webhook Events
```bash
# Use Stripe CLI to test webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Staging Environment (Optional)

If using a staging environment before production:

- [ ] Create staging Aurora instance
- [ ] Create staging Stripe account (or use test mode)
- [ ] Deploy to Vercel staging branch
- [ ] Run full test suite in staging
- [ ] Load test in staging (if possible)
- [ ] Monitor staging for 24 hours

## Go-Live (Production Deployment)

### Final Checks (1 hour before)
- [ ] All environment variables are set in Vercel
- [ ] Database is backed up (Aurora automated backups ✓)
- [ ] Stripe is in test mode or production approved
- [ ] Support/runbook is prepared for on-call team

### During Deployment
- [ ] Monitor error rates in Vercel
- [ ] Monitor database connection pool
- [ ] Monitor Stripe webhook logs
- [ ] Have a rollback plan ready

### Post-Deployment (First 24 hours)
- [ ] Check error logs hourly
- [ ] Verify cron job runs every minute
- [ ] Monitor database performance
- [ ] Monitor payment processing
- [ ] Check for any scaling issues

### Ongoing (Weekly)
- [ ] Review error logs
- [ ] Check database query performance
- [ ] Monitor Aurora storage usage
- [ ] Verify backups are being created

## Production Environment Variables

For production, switch Stripe keys to live mode:

```env
STRIPE_SECRET_KEY=sk_live_...  # NOT sk_test_
STRIPE_PUBLISHABLE_KEY=pk_live_...  # NOT pk_test_
STRIPE_WEBHOOK_SECRET=whsec_...  # Live webhook secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Rollback Plan

If something goes wrong:

1. **Immediate**: Pause cron job (disable `/api/drops/status` in vercel.json)
2. **Within 5 minutes**: Disable checkout (return error from `/api/checkout`)
3. **Within 15 minutes**: Revert code to last known good commit
4. **Investigation**: Review error logs and database logs
5. **Fix**: Apply hotfix and redeploy

## Support & On-Call

- [ ] On-call team trained on DropDeck architecture
- [ ] Escalation path established (Slack #incidents)
- [ ] Runbook created for common issues
- [ ] Contact info for Vercel support configured

## Sign-Off

- [ ] Tech Lead: __________ Date: __________
- [ ] DevOps/Infrastructure: __________ Date: __________
- [ ] Product Manager: __________ Date: __________

Production deployment approved on: __________
