# DropDeck Deployment Guide

Complete guide for deploying DropDeck to production on Vercel with AWS Aurora PostgreSQL.

## Pre-Deployment Checklist

- [ ] All tests pass (see TESTING_GUIDE.md)
- [ ] Code review completed
- [ ] Environment variables prepared
- [ ] Database backups configured
- [ ] Monitoring/alerting set up
- [ ] Incident response plan ready
- [ ] Team trained on runbook
- [ ] SSL/HTTPS verified
- [ ] Rate limiting configured
- [ ] Security headers added

---

## Environment Variables Setup

### Production Environment Variables

Create these in your Vercel Project Settings → Environment Variables:

#### Database (Aurora PostgreSQL)
```
PGHOST=your-aurora-endpoint.rds.amazonaws.com
PGUSER=postgres
PGDATABASE=dropdeck_prod
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_ROLE_NAME
```

#### Authentication (NextAuth.js)
```
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-production-domain.com
```

#### Stripe (Production Keys)
```
STRIPE_SECRET_KEY=sk_live_YOUR_PRODUCTION_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

#### Platform Config
```
PLATFORM_FEE_PERCENT=5
RESERVATION_TIMEOUT_SECONDS=300
MAX_UNITS_PER_BUYER=5
```

**To Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## Database Setup for Production

### 1. Create Aurora PostgreSQL Instance

**Via AWS Console:**
1. Go to RDS → Create Database
2. Select "Aurora PostgreSQL"
3. Choose "Production" template
4. Engine: PostgreSQL 15.x or higher
5. Database name: `dropdeck_prod`
6. Master username: `postgres`
7. Auto-generate password (save in AWS Secrets Manager)
8. Instance type: `db.t4g.medium` (minimum for production)
9. Enable backups: 30-day retention
10. Enable Multi-AZ for high availability
11. Enable encryption at rest
12. Configure security group to allow port 5432 from Vercel IPs

### 2. Configure IAM Authentication

**Create IAM Role for Vercel:**
1. Go to IAM → Roles → Create Role
2. Trust Vercel's OIDC provider
3. Attach policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds:YOUR_REGION:YOUR_ACCOUNT_ID:db/YOUR_DB_NAME"
    }
  ]
}
```

### 3. Run Migrations

```bash
# Connect to production database
export PGHOST=your-aurora-endpoint.rds.amazonaws.com
export PGUSER=postgres
export PGDATABASE=dropdeck_prod
export AWS_REGION=us-east-1
export AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_ROLE_NAME

# Run migrations
npx tsx scripts/migrate.ts

# Verify schema created
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "\dt"
```

### 4. Verify Triggers

```bash
# Check triggers are installed
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "\df"

# Should see:
# - check_and_update_drop_status()
# - check_order_expiry()
# - check_drop_stock_on_order_change()
```

---

## Vercel Deployment

### 1. Connect GitHub Repository

1. Go to Vercel → New Project
2. Import repository: `jaymeeu/dropdeck-commerce-platform`
3. Select `main` branch for production
4. Framework Preset: Next.js (auto-detected)

### 2. Configure Environment

1. Add all environment variables from "Environment Variables Setup" section
2. Set production branch: `main`
3. Disable Preview Deployments for production safety (or require approval)

### 3. Deploy

```bash
# Automatic: Push to main branch
git push origin main

# Manual: Deploy via CLI
vercel deploy --prod
```

### 4. Verify Deployment

1. Check Vercel deployments page
2. Verify build logs show no errors
3. Test production URL
4. Check Vercel logs for runtime errors
5. Monitor error tracking (Sentry if configured)

---

## Stripe Setup (Production)

### 1. Create Stripe Account

- Sign up at stripe.com
- Complete verification process
- Go to Dashboard → API Keys
- Copy Live keys (not test keys)

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Create endpoint:
   - URL: `https://your-production-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
3. Copy signing secret (starts with `whsec_`)
4. Add to `STRIPE_WEBHOOK_SECRET` in Vercel

### 3. Enable 3D Secure (Optional but Recommended)

- Dashboard → Settings → Billing settings
- Enable automatic 3D Secure

### 4. Test Webhooks

```bash
# Use Stripe CLI to test locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Or test from production
curl https://your-domain.com/api/webhooks/stripe -H "Content-Type: application/json" -d "{\"type\": \"payment_intent.succeeded\"}"
```

---

## Domain & SSL Configuration

### 1. Add Custom Domain (Vercel)

1. Vercel Project → Settings → Domains
2. Add custom domain (e.g., `dropdeck.com`)
3. Update DNS:
   - Create CNAME: `www` → `cname.vercel-dns.com`
   - Create A record for root domain (details provided by Vercel)
4. Wait for DNS propagation (5-30 minutes)
5. Verify SSL certificate auto-issued

### 2. Verify HTTPS

```bash
curl -I https://your-domain.com
# Should show: HTTP/2 200 with SSL certificate info
```

---

## Monitoring & Logging

### 1. Vercel Monitoring

- Vercel Dashboard shows real-time metrics
- Function duration, cold starts, errors
- Automatic alerts for deployment failures

### 2. Database Monitoring

```sql
-- Monitor slow queries (> 1 second)
SELECT query, mean_exec_time, max_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;

-- Monitor table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname='public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Set Up Error Tracking (Optional)

Sentry.io integration:
1. Sign up at sentry.io
2. Create project for Next.js
3. Install: `npm install @sentry/nextjs`
4. Configure in `next.config.js`
5. Add DSN to environment variables

---

## Scaling Configuration

### Aurora PostgreSQL Scaling

**Read Replicas:**
```bash
# Add read replicas for load distribution
aws rds create-db-instance-read-replica \
  --db-instance-identifier dropdeck-prod-read-1 \
  --source-db-instance-identifier dropdeck-prod
```

**Auto-scaling:**
- Enable for CPU and connections
- Min instances: 1
- Max instances: 3

**Connection Pooling:**
- Use Amazon RDS Proxy for connection pooling
- Reduces connection overhead
- Automatic scaling

### Vercel Edge Functions (Optional)

- Use for API routes with high traffic
- Automatic geographic distribution
- Lower latency for global users

---

## Backup & Disaster Recovery

### Automated Backups

```bash
# Verify backup retention
aws rds describe-db-instances \
  --db-instance-identifier dropdeck-prod \
  --query 'DBInstances[0].BackupRetentionPeriod'

# Should return >= 30 (days)
```

### Manual Backup

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier dropdeck-prod \
  --db-snapshot-identifier dropdeck-backup-$(date +%Y%m%d)
```

### Point-in-Time Recovery Test

Monthly: Restore to new instance and verify data integrity

---

## Security Hardening

### 1. Database Security

```sql
-- Revoke unnecessary privileges
REVOKE ALL ON DATABASE dropdeck_prod FROM public;

-- Create limited user for app
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE dropdeck_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### 2. API Security

- Enable rate limiting in Vercel
- Add security headers (HSTS, CSP, X-Frame-Options)
- Implement CORS properly
- Validate all input server-side

### 3. Environment Variable Security

- Use Vercel's encrypted environment variables
- Never commit secrets to git
- Rotate secrets quarterly
- Use different credentials for prod/staging

---

## Maintenance Schedule

### Daily
- Monitor error rates and latency
- Check database performance
- Review Stripe transactions

### Weekly
- Analyze usage patterns
- Check for any anomalies
- Review logs for warnings

### Monthly
- Full backup verification
- Security audit
- Performance optimization
- Capacity planning review

### Quarterly
- Dependency updates
- Security patches
- Penetration testing
- Disaster recovery drill

---

## Rollback Procedure

If deployment causes issues:

### Quick Rollback (Last 24 Hours)
```bash
# Via Vercel CLI
vercel rollback --prod

# Or via Vercel Dashboard:
# Deployments → Select previous → Click "Redeploy"
```

### Full Database Rollback
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier dropdeck-prod-restored \
  --db-snapshot-identifier dropdeck-backup-YYYYMMDD
```

### Verify Rollback
1. Check homepage loads
2. Verify authentication works
3. Test checkout flow
4. Monitor error rates drop

---

## Post-Deployment Verification

### 1. Smoke Tests (5 minutes after deploy)

```bash
# Test homepage
curl -I https://your-domain.com

# Test auth endpoint
curl -X POST https://your-domain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test drops API
curl https://your-domain.com/api/drops
```

### 2. Functional Tests (30 minutes)

- [ ] Homepage loads with live drops
- [ ] User can sign in
- [ ] User can view drop details
- [ ] Checkout form loads
- [ ] Test payment succeeds
- [ ] Order appears in order history
- [ ] Admin dashboard loads

### 3. Performance Tests (60 minutes)

- [ ] Page loads < 2s
- [ ] API responses < 500ms
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Images optimized

### 4. Load Test (2 hours after deploy)

```bash
# Run production load test
npx tsx scripts/load-test.ts --concurrency 100

# Expected: 100+ concurrent users, < 5% errors
```

---

## Incident Response

### Website Down (Total Outage)

1. **Immediate (0-5 min):**
   - Check Vercel status page
   - Check AWS status
   - Restart deployment (rollback if needed)

2. **Investigation (5-30 min):**
   - Review Vercel logs
   - Check database connectivity
   - Look for recent changes

3. **Communication:**
   - Post status on status page (statuspage.io)
   - Notify stakeholders
   - Update customer support

### High Error Rate (> 5%)

1. Check error tracking (Sentry)
2. Identify error pattern
3. Determine if:
   - Code issue → rollback
   - Database issue → check queries
   - External service → check Stripe, AWS status
4. Fix and redeploy if needed

### Performance Degradation

1. Check database metrics (CPU, connections)
2. Check Vercel function duration
3. Look for:
   - Slow queries
   - N+1 queries
   - Connection pool exhaustion
4. Optimize or scale as needed

---

## Support & Escalation

### Tier 1 Support
- Vercel Documentation: vercel.com/docs
- PostgreSQL Docs: postgresql.org/docs
- Stripe Docs: stripe.com/docs

### Tier 2 Support
- Vercel Support: vercel.com/help
- AWS Support Plan (if applicable)
- GitHub Issues

### Emergency Contact
- On-call engineer: [Add contact info]
- Incident channel: [Add Slack/Discord channel]

---

## Sign-Off

- **Deployed By:** ___________________
- **Date:** ___________________
- **Environment:** Production
- **Version:** ___________________
- **Status:** [ ] Successful | [ ] Issues Found

### Sign-Off Verification
- [ ] All smoke tests pass
- [ ] No critical errors in logs
- [ ] Performance metrics normal
- [ ] Team notified and ready
