# DropDeck End-to-End Testing Guide

Complete guide for testing all features of the DropDeck flash-drop commerce platform.

## Prerequisites

- Access to deployed Vercel instance OR local development environment (`npm run dev`)
- Test database with seed data (3 sample drops + 6 test users)
- Stripe test mode credentials (for payment testing)
- Browser with developer tools

## Test Credentials

Use these accounts for testing different user roles:

### Buyer Account
- Email: `buyer1@example.com`
- Password: `password123`

### Seller Account
- Email: `seller1@example.com`
- Password: `password123`

### Admin Account
- Email: `admin@example.com`
- Password: `password123`

---

## Phase 1: Authentication & User Management

### Test 1.1: User Registration (Buyer)

**Steps:**
1. Navigate to homepage
2. Click "Sign Up" button
3. Fill in registration form:
   - Full Name: "Test Buyer"
   - Email: "testbuyer@example.com"
   - Account Type: "Buyer (Buy drops)"
   - Password: "TestPass123!"
   - Confirm Password: "TestPass123!"
4. Click "Sign Up"

**Expected Results:**
- Account created successfully
- Redirected to sign in page
- Can login with new credentials
- User appears as "buyer" role in database

**Pass/Fail:** [ ]

---

### Test 1.2: User Registration (Seller)

**Steps:**
1. Navigate to `/auth/signup`
2. Fill in registration form:
   - Full Name: "Test Seller"
   - Email: "testseller@example.com"
   - Account Type: "Seller (Create drops)"
   - Store Name: "Test Store"
   - Password: "TestPass123!"
3. Click "Sign Up"

**Expected Results:**
- Seller account created
- Seller profile created with store name
- Can access seller dashboard
- User role is "seller"

**Pass/Fail:** [ ]

---

### Test 1.3: Login Flow

**Steps:**
1. Navigate to `/auth/signin`
2. Enter email: `buyer1@example.com`
3. Enter password: `password123`
4. Click "Sign In"

**Expected Results:**
- Login succeeds
- Redirected to homepage
- Navigation shows "My Orders" button (not "Sign In")
- Session is active (can refresh page without logging out)

**Pass/Fail:** [ ]

---

### Test 1.4: Logout Flow

**Steps:**
1. While logged in, click "Sign Out" button in navigation
2. Confirm logout action

**Expected Results:**
- Session ends
- Redirected to homepage
- Navigation shows "Sign In" / "Sign Up" (not "Sign Out")
- Accessing protected pages redirects to login

**Pass/Fail:** [ ]

---

## Phase 2: Browse & Product Discovery

### Test 2.1: Homepage Load

**Steps:**
1. Navigate to homepage
2. Observe page load

**Expected Results:**
- Page loads in under 3 seconds
- Hero section displays with gradient text
- All sections render properly
- No console errors
- Responsive on mobile (test with device emulation)

**Pass/Fail:** [ ]

---

### Test 2.2: Live Drops Display

**Steps:**
1. Look at "Live Now" section on homepage
2. Verify drop card displays

**Expected Results:**
- "Nike Air Jordan 1 Retro High OG" drop appears
- Shows $150.00 price
- Shows "LIVE" badge in amber/orange color
- Shows "0 left" stock remaining (from seed data)
- Image loads properly
- Hover effect works (card glows, text changes color)

**Pass/Fail:** [ ]

---

### Test 2.3: Scheduled Drops Display

**Steps:**
1. Look at "Coming Soon" section
2. Check Adidas drop

**Expected Results:**
- "Adidas Ultra Boost 22" appears
- Shows $180.00 price
- Shows "SCHEDULED" badge
- Shows countdown time (e.g., "Drops in 2 hours")
- Date and time displayed

**Pass/Fail:** [ ]

---

### Test 2.4: Sold Out Drops Display

**Steps:**
1. Look at "Recently Sold Out" section
2. Check sold out drop

**Expected Results:**
- "Nike Dunk Low Travis Scott" appears
- Shows "SOLD OUT" badge in gray
- Shows $200.00 price
- Click still works (but checkout should fail with "sold_out")

**Pass/Fail:** [ ]

---

### Test 2.5: Drop Detail Page

**Steps:**
1. Click on "Nike Air Jordan 1" drop card
2. Navigate to drop detail page

**Expected Results:**
- Page loads with drop title, description, image
- Price displays: $150.00
- Stock counter shows: "0 in stock"
- Status shows: "LIVE"
- Checkout button present (or disabled if no stock)
- Related information displays correctly

**Pass/Fail:** [ ]

---

## Phase 3: Checkout & Payments (Critical)

### Test 3.1: Add to Cart (Pre-Purchase)

**Steps:**
1. Login as buyer1@example.com
2. Navigate to any live drop detail page
3. If checkout form exists, proceed to next step
4. If add-to-cart button exists, click it

**Expected Results:**
- Form or cart updates
- Can proceed to checkout
- No validation errors for valid inputs
- Quantity limits enforced (max 3 per buyer per spec)

**Pass/Fail:** [ ]

---

### Test 3.2: Initiate Checkout

**Steps:**
1. From drop detail page, click "Checkout" or "Buy Now"
2. Verify checkout form loads

**Expected Results:**
- Checkout page/modal opens
- Stripe Elements payment form loads
- Form shows fields:
  - Email (pre-filled)
  - Stripe card input
  - Quantity selector
- Proceed button present

**Pass/Fail:** [ ]

---

### Test 3.3: Complete Payment (Stripe Test)

**Steps:**
1. In checkout form, enter:
   - Email: buyer1@example.com
   - Card Number: `4242 4242 4242 4242` (test card)
   - Expiry: `12/25`
   - CVC: `123`
2. Click "Pay Now" or "Complete Order"
3. Wait for payment processing

**Expected Results:**
- Payment processes successfully
- Page shows confirmation (order ID, status "confirmed")
- Order appears in buyer's order history
- Stock decremented in database
- Stripe webhook fires (check Stripe dashboard logs)
- Order status changes from "reserved" → "paid" → "confirmed"

**Pass/Fail:** [ ]

---

### Test 3.4: Order History

**Steps:**
1. Click "My Orders" in navigation
2. View orders page

**Expected Results:**
- Page loads with list of buyer's orders
- Recent order appears with:
  - Drop name
  - Order date
  - Order status: "confirmed"
  - Price paid
  - Order ID (clickable for details)
- Click order shows full details

**Pass/Fail:** [ ]

---

### Test 3.5: Failed Payment Handling

**Steps:**
1. Navigate back to drop detail page
2. Start checkout again
3. Enter invalid test card: `4000 0000 0000 0002` (declined)
4. Click "Pay Now"

**Expected Results:**
- Payment fails with error message
- Error message displays: "Your card was declined"
- Order NOT created (stays in "reserved" state, not "paid")
- Stock remains unchanged
- User can retry with different card

**Pass/Fail:** [ ]

---

## Phase 4: Zero-Oversell Guarantee (Load Test)

**Critical test to verify the core feature of DropDeck**

### Test 4.1: Prepare for Load Test

**Steps:**
1. Verify you have access to create test data or modify seed data
2. Create a drop with:
   - Title: "Load Test Drop"
   - Total Stock: 50
   - Price: $10.00
   - Status: "live"
   - Max per buyer: 1
3. Get the drop ID from database

**Expected Results:**
- Drop created successfully
- Stock verified as 50
- Drop appears on homepage as live

**Pass/Fail:** [ ]

---

### Test 4.2: Run Load Test Script

**Steps:**
1. Open terminal
2. Navigate to project directory: `cd /vercel/share/v0-project`
3. Run load test:
   ```bash
   npx tsx scripts/load-test.ts --drop-id YOUR_DROP_ID --concurrency 150
   ```
4. Wait for test to complete (typically 30-60 seconds)
5. Review results

**Expected Output:**
```
Load Test Results:
- Total Requests: 150
- Successful Checkouts: 50 ✓
- Sold Out Errors: 100 ✓
- Failed Orders: 0
- Success Rate: 100%
- Average Latency: 45ms
- P95 Latency: 120ms
- Database Consistency: ✓ (50 orders exactly)
```

**Expected Results:**
- Exactly 50 checkouts succeed (matching 50 stock)
- Remaining 100 get "sold_out" error
- Zero double-sales
- All database records consistent
- No data corruption
- Response times reasonable (P95 < 200ms)

**Pass/Fail:** [ ]

---

### Test 4.3: Verify Database Consistency Post-Load Test

**Steps:**
1. Query database for the test drop:
   ```sql
   SELECT id, total_stock, available_stock, status 
   FROM drops 
   WHERE title = 'Load Test Drop';
   ```
2. Query orders for this drop:
   ```sql
   SELECT COUNT(*) as total_orders, 
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
   FROM orders 
   WHERE drop_id = 'YOUR_DROP_ID';
   ```

**Expected Results:**
- Total stock: 50 (unchanged from start)
- Available stock: 0 (all sold)
- Status: "sold_out"
- Total confirmed orders: 50
- No duplicates or conflicts
- No orphaned records

**Pass/Fail:** [ ]

---

## Phase 5: Seller Operations

### Test 5.1: Access Seller Dashboard

**Steps:**
1. Login as seller1@example.com
2. Click "Seller" in navigation
3. Navigate to seller dashboard

**Expected Results:**
- Seller dashboard loads
- Shows seller stats:
  - Total drops created
  - Revenue
  - Units sold
  - Active drops count
- Shows list of seller's drops
- Can see each drop's stats

**Pass/Fail:** [ ]

---

### Test 5.2: Create New Drop

**Steps:**
1. From seller dashboard, click "Create Drop" or "New Drop"
2. Fill form:
   - Title: "Test Drop - Limited Edition"
   - Description: "Exclusive test release"
   - Price: $99.99
   - Stock: 25
   - Max per Buyer: 2
   - Start Time: Tomorrow 10:00 AM
   - End Time: Tomorrow 10:30 AM
3. Upload image (or use URL)
4. Click "Create Drop"

**Expected Results:**
- Drop created successfully
- Redirected to drop detail/dashboard
- Drop appears in seller's drops list
- Status shows "scheduled"
- Can edit drop details
- Drop appears on homepage in "Coming Soon" section

**Pass/Fail:** [ ]

---

### Test 5.3: View Drop Analytics

**Steps:**
1. From drop list, click "Analytics" or "View Stats" on created drop
2. Navigate to analytics page

**Expected Results:**
- Page loads with drop statistics:
  - Total views
  - Checkout attempts
  - Completed orders
  - Revenue generated
  - Stock sold vs. remaining
- Chart showing orders over time
- Export to CSV option available

**Pass/Fail:** [ ]

---

## Phase 6: Admin Panel

### Test 6.1: Access Admin Dashboard

**Steps:**
1. Login as admin@example.com
2. Click "Admin" in navigation
3. Navigate to admin panel

**Expected Results:**
- Admin panel loads
- Shows platform metrics:
  - Total GMV (Gross Merchandise Value)
  - Total users
  - Total sellers
  - Total drops
  - Total orders
- Shows key statistics

**Pass/Fail:** [ ]

---

### Test 6.2: View All Drops

**Steps:**
1. From admin panel, click "All Drops" or "Drops"
2. View drops table

**Expected Results:**
- Table displays all drops in system
- Shows: title, seller, revenue, orders, status
- Can sort/filter by status
- Can search for drop by title
- Pagination works if many drops

**Pass/Fail:** [ ]

---

### Test 6.3: View All Orders

**Steps:**
1. From admin panel, click "All Orders" or "Orders"
2. View orders table

**Expected Results:**
- Table displays all orders
- Shows: order ID, buyer, drop, status, price, date
- Can filter by status (paid, expired, confirmed)
- Can sort by date, price
- Can search for order by ID

**Pass/Fail:** [ ]

---

## Phase 7: Database & Triggers (PostgreSQL Automation)

### Test 7.1: Drop Status Auto-Transition

**Steps:**
1. Create a drop with:
   - Start time: Now + 2 minutes
   - End time: Now + 5 minutes
   - Status: "scheduled"
2. Wait 3 minutes
3. Query database status

**Expected Results:**
- After start time, drop status auto-changes to "live"
- After end time, drop status auto-changes to "ended"
- No manual intervention required
- Triggered by database triggers (not cron jobs)

**Pass/Fail:** [ ]

---

### Test 7.2: Reservation Expiry

**Steps:**
1. Start a checkout (creates reserved order)
2. Don't complete payment
3. Wait 5+ minutes (RESERVATION_TIMEOUT_SECONDS)
4. Query database

**Expected Results:**
- Order status changes from "reserved" → "expired"
- Stock is automatically freed/restored
- If all stock was reserved, drop auto-transitions from "sold_out" back to "live"
- No cron job needed - triggers handle it

**Pass/Fail:** [ ]

---

## Phase 8: Performance & Load Testing

### Test 8.1: Page Load Performance

**Steps:**
1. Open browser DevTools (F12)
2. Go to Performance tab
3. Navigate to homepage
4. Check metrics

**Expected Results:**
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3s
- No layout thrashing or jank

**Pass/Fail:** [ ]

---

### Test 8.2: Checkout Performance

**Steps:**
1. From drop detail page, initiate checkout
2. Monitor Network tab in DevTools
3. Time payment submission to confirmation

**Expected Results:**
- Checkout form loads: < 1s
- Stripe Elements load: < 1s
- Payment processing: 1-3s
- Total checkout: < 5s
- No slow requests
- All assets cached appropriately

**Pass/Fail:** [ ]

---

## Phase 9: Mobile Responsiveness

### Test 9.1: Mobile Layout

**Steps:**
1. Open DevTools (F12)
2. Click device emulation (Cmd+Shift+M)
3. Select iPhone 14 or similar
4. Navigate through all pages:
   - Homepage
   - Drop detail
   - Checkout
   - Orders page
   - Seller dashboard

**Expected Results:**
- All pages render correctly on mobile
- Text is readable (no tiny fonts)
- Buttons are clickable (at least 48px)
- No horizontal scroll
- Images scale properly
- Forms are usable
- Navigation adapts for mobile

**Pass/Fail:** [ ]

---

## Phase 10: Error Handling & Edge Cases

### Test 10.1: Handle Sold Out Mid-Checkout

**Steps:**
1. Start checkout for drop with 1 unit left
2. In another browser/incognito, quickly checkout the same drop
3. Go back to first browser, try to complete payment

**Expected Results:**
- First checkout succeeds (gets the last unit)
- Second checkout fails with "sold_out" error
- No overselling occurs
- User shown clear error message
- Can retry with different drop

**Pass/Fail:** [ ]

---

### Test 10.2: Exceeded Purchase Limit

**Steps:**
1. Try to checkout with quantity > max_per_buyer (spec says max 3)
2. Try quantity = 4

**Expected Results:**
- Form validation prevents submission
- Error message: "Maximum 3 units per buyer"
- Can't bypass with direct API call (server-side validation)

**Pass/Fail:** [ ]

---

### Test 10.3: Invalid Payment Details

**Steps:**
1. Start checkout
2. Enter expired card: `4000 0000 0000 0069`
3. Complete payment

**Expected Results:**
- Payment fails
- Clear error message shown
- Order not created
- User can retry
- No partial/corrupt data in database

**Pass/Fail:** [ ]

---

### Test 10.4: Network Failure During Checkout

**Steps:**
1. Open DevTools Network tab
2. Throttle to "Offline"
3. Start checkout
4. Try to submit payment
5. Go back online

**Expected Results:**
- Clear error message (can't reach server)
- Order not created (no orphaned data)
- Can retry when online
- Session remains valid

**Pass/Fail:** [ ]

---

## Scoring & Sign-Off

### Scoring Matrix

| Phase | Tests | Passed | Score |
|-------|-------|--------|-------|
| 1. Auth | 4 | __/4 | __% |
| 2. Discovery | 5 | __/5 | __% |
| 3. Checkout | 5 | __/5 | __% |
| 4. Load Test | 3 | __/3 | __% |
| 5. Seller | 3 | __/3 | __% |
| 6. Admin | 3 | __/3 | __% |
| 7. Triggers | 2 | __/2 | __% |
| 8. Performance | 2 | __/2 | __% |
| 9. Mobile | 1 | __/1 | __% |
| 10. Error Handling | 4 | __/4 | __% |
| **TOTAL** | **32** | **__/32** | **__/%** |

### Sign-Off

- **Tested By:** ___________________
- **Date:** ___________________
- **Environment:** [ ] Local | [ ] Staging | [ ] Production
- **Overall Status:** [ ] PASS | [ ] FAIL
- **Critical Issues:** (if any)
  - Issue 1: _______________________
  - Issue 2: _______________________

### Notes

Any additional findings, observations, or recommendations:

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Troubleshooting

### Common Issues & Solutions

**Issue: Login fails with "Invalid email or password"**
- Ensure you're using correct test credentials
- For seeded users, password must be `password123`
- Check if user exists in database

**Issue: Stripe payment fails**
- Verify you're using test card: `4242 4242 4242 4242`
- Check STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are set
- Verify Stripe webhook is configured correctly

**Issue: Load test shows "Connection refused"**
- Ensure database is accessible
- Check AWS credentials and VPC security groups
- Verify PGHOST, PGUSER, PGDATABASE are correct

**Issue: Drop status not auto-transitioning**
- Verify PostgreSQL triggers are installed (003-add-automation-triggers.sql)
- Check database time is correct (triggers use NOW())
- Look at database logs for trigger errors

**Issue: Mobile layout broken**
- Clear browser cache (Cmd+Shift+Delete)
- Check viewport meta tag in layout.tsx
- Test in multiple browsers (Chrome, Safari, Firefox)

---

## Next Steps After Testing

If all tests pass:
1. Deploy to production
2. Set up monitoring and alerting
3. Configure Stripe webhooks for production
4. Enable analytics tracking
5. Set up database backups
6. Create runbook for common issues

If any tests fail:
1. Log the issue with reproduction steps
2. Check if it's environment-specific
3. Debug and fix the code
4. Re-run failing test only
5. Document the fix in changelog
