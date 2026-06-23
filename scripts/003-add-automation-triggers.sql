-- DropDeck Automation Triggers
-- Replaces Vercel Cron jobs with database-native triggers
-- Zero-cost, instant, and guaranteed execution

-- 1. Trigger to auto-transition drops from scheduled → live
-- Runs whenever a drop's start_time passes (checked on any update to drops table)
CREATE OR REPLACE FUNCTION check_and_update_drop_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Transition scheduled → live
  IF NEW.status = 'scheduled' AND NEW.start_time <= NOW() THEN
    NEW.status := 'live';
  END IF;

  -- Transition live → ended
  IF NEW.status = 'live' AND NEW.end_time IS NOT NULL AND NEW.end_time <= NOW() THEN
    NEW.status := 'ended';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_drop_status ON drops;
CREATE TRIGGER trg_check_drop_status
  BEFORE UPDATE ON drops
  FOR EACH ROW
  EXECUTE FUNCTION check_and_update_drop_status();

-- 2. Trigger to auto-expire reservations when they pass their expiry time
-- When an order is inserted or updated, check if it should be expired
CREATE OR REPLACE FUNCTION check_order_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a reserved order and its expiry time has passed, mark as expired
  IF NEW.status = 'reserved' AND NEW.expires_at <= NOW() THEN
    NEW.status := 'expired';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_expiry ON orders;
CREATE TRIGGER trg_check_order_expiry
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_order_expiry();

-- 3. Trigger to auto-transition drops from sold_out → live when stock frees up
-- This runs AFTER an order status changes (e.g., expires or is refunded)
CREATE OR REPLACE FUNCTION check_drop_stock_availability()
RETURNS TRIGGER AS $$
DECLARE
  total_stock INTEGER;
  current_sold INTEGER;
  drop_record RECORD;
BEGIN
  -- Only proceed if this is a status change to a state that frees up stock
  IF OLD.status IN ('reserved', 'paid', 'confirmed') 
     AND NEW.status IN ('expired', 'refunded') THEN
    
    -- Get drop info
    SELECT d.total_stock, d.status, d.start_time, d.end_time
    INTO drop_record
    FROM drops d
    WHERE d.id = NEW.drop_id;

    -- Calculate current sales (only active statuses)
    SELECT COALESCE(SUM(quantity), 0)
    INTO current_sold
    FROM orders
    WHERE drop_id = NEW.drop_id
      AND status IN ('reserved', 'paid', 'confirmed');

    -- If stock became available and drop is still in the live window, mark as live
    IF current_sold < drop_record.total_stock 
       AND drop_record.status = 'sold_out'
       AND drop_record.start_time <= NOW()
       AND (drop_record.end_time IS NULL OR drop_record.end_time > NOW()) THEN
      UPDATE drops
      SET status = 'live', updated_at = NOW()
      WHERE id = NEW.drop_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_drop_stock_on_order_change ON orders;
CREATE TRIGGER trg_check_drop_stock_on_order_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_drop_stock_availability();

-- 4. Create a view for monitoring drop status (useful for debugging)
CREATE OR REPLACE VIEW vw_drop_status_summary AS
SELECT
  d.id,
  d.title,
  d.status,
  d.total_stock,
  COALESCE(SUM(CASE WHEN o.status IN ('reserved', 'paid', 'confirmed') THEN o.quantity ELSE 0 END), 0) as current_sold,
  d.total_stock - COALESCE(SUM(CASE WHEN o.status IN ('reserved', 'paid', 'confirmed') THEN o.quantity ELSE 0 END), 0) as available_stock,
  COUNT(CASE WHEN o.status IN ('reserved', 'paid', 'confirmed') THEN 1 END) as order_count,
  d.start_time,
  d.end_time,
  NOW() as checked_at
FROM drops d
LEFT JOIN orders o ON d.id = o.drop_id
GROUP BY d.id, d.title, d.status, d.total_stock, d.start_time, d.end_time;

-- Vacuum and analyze to update statistics
VACUUM ANALYZE drops;
VACUUM ANALYZE orders;
