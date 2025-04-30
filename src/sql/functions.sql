-- This file contains SQL functions that should be executed in the Supabase SQL editor

-- Function to safely get stock reservations
CREATE OR REPLACE FUNCTION public.get_stock_reservations()
RETURNS SETOF public.stock_reservations
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.stock_reservations 
    ORDER BY reservation_date DESC 
    LIMIT 10;
END;
$$;

-- Function to safely create a stock reservation
CREATE OR REPLACE FUNCTION public.create_stock_reservation(
  res_date DATE,
  res_amount NUMERIC,
  res_type TEXT DEFAULT 'subscription'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.stock_reservations 
    (reservation_date, reserved_amount, reservation_type)
  VALUES 
    (res_date, res_amount, res_type)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to safely check stock availability
CREATE OR REPLACE FUNCTION public.check_stock_availability(
  requested_quantity NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  total_stock NUMERIC;
  reserved_amount NUMERIC;
  available_stock NUMERIC;
BEGIN
  -- Get total milk stock
  SELECT total_stock INTO total_stock FROM public.milk_stock LIMIT 1;
  
  -- Get latest reservation
  SELECT COALESCE(SUM(reserved_amount), 0) INTO reserved_amount 
  FROM public.stock_reservations 
  WHERE reservation_date >= CURRENT_DATE;
  
  -- Calculate available stock
  available_stock := COALESCE(total_stock, 0) - COALESCE(reserved_amount, 0);
  
  -- Return whether there's enough available stock
  RETURN available_stock >= requested_quantity;
END;
$$;

-- Function to safely update milk stock
CREATE OR REPLACE FUNCTION public.update_milk_stock_safe(
  add_quantity NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock NUMERIC;
  stock_id UUID;
BEGIN
  -- Get current stock and ID
  SELECT id, total_stock INTO stock_id, current_stock FROM milk_stock LIMIT 1;
  
  -- Update the stock
  IF current_stock IS NULL OR stock_id IS NULL THEN
    INSERT INTO milk_stock (total_stock) VALUES (add_quantity);
  ELSE
    UPDATE milk_stock SET total_stock = total_stock + add_quantity WHERE id = stock_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to automatically reserve stock for subscriptions
CREATE OR REPLACE FUNCTION public.auto_reserve_subscription_stock()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  daily_demand NUMERIC := 0;
  tomorrow DATE := CURRENT_DATE + 1;
  existing_reservation_id UUID;
  new_reservation_id UUID;
BEGIN
  -- Calculate daily demand from active subscriptions
  SELECT COALESCE(SUM(
    CASE 
      WHEN frequency = 'daily' THEN quantity
      WHEN frequency = 'weekly' THEN quantity / 7
      WHEN frequency = 'monthly' THEN quantity / 30
      ELSE 0
    END
  ), 0) INTO daily_demand
  FROM subscriptions
  WHERE status = 'active';
  
  -- Round up the daily demand
  daily_demand := CEILING(daily_demand);
  
  -- Check if a reservation already exists for tomorrow
  SELECT id INTO existing_reservation_id 
  FROM stock_reservations
  WHERE reservation_date = tomorrow
  LIMIT 1;
  
  -- If reservation exists, update it. Otherwise create a new one
  IF existing_reservation_id IS NOT NULL THEN
    UPDATE stock_reservations
    SET reserved_amount = daily_demand
    WHERE id = existing_reservation_id;
  ELSE
    -- Create a new reservation for tomorrow
    INSERT INTO stock_reservations 
      (reservation_date, reserved_amount, reservation_type)
    VALUES 
      (tomorrow, daily_demand, 'subscription')
    RETURNING id INTO new_reservation_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to archive and reset daily milk stock
CREATE OR REPLACE FUNCTION public.archive_and_reset_daily_stock()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock NUMERIC;
  stock_id UUID;
  yesterday_stock NUMERIC;
  leftover_stock NUMERIC;
  subscription_demand NUMERIC;
  today DATE := CURRENT_DATE;
BEGIN
  -- Check if we already have an archive entry for yesterday
  -- If we do, we've already run the reset for today
  IF EXISTS (SELECT 1 FROM milk_stock_archive WHERE date = today - 1) THEN
    RETURN FALSE;
  END IF;

  -- Get current stock and ID
  SELECT id, total_stock INTO stock_id, current_stock FROM milk_stock LIMIT 1;
  
  IF stock_id IS NULL THEN
    RETURN FALSE; -- No stock record exists yet
  END IF;
  
  -- Calculate subscription demand for today
  SELECT COALESCE(SUM(
    CASE 
      WHEN frequency = 'daily' THEN quantity
      WHEN frequency = 'weekly' THEN quantity / 7
      WHEN frequency = 'monthly' THEN quantity / 30
      ELSE 0
    END
  ), 0) INTO subscription_demand
  FROM subscriptions
  WHERE status = 'active';
  
  -- Calculate leftover stock (current stock - subscription demand)
  leftover_stock := GREATEST(0, COALESCE(current_stock, 0) - COALESCE(subscription_demand, 0));
  
  -- Archive yesterday's stock
  INSERT INTO milk_stock_archive (
    date,
    total_stock,
    subscription_demand,
    leftover_stock
  ) VALUES (
    today - 1,
    COALESCE(current_stock, 0),
    COALESCE(subscription_demand, 0),
    leftover_stock
  );
  
  -- Reset current stock to leftover amount
  UPDATE milk_stock SET total_stock = leftover_stock WHERE id = stock_id;
  
  RETURN TRUE;
END;
$$;

-- Create a cron job to automatically archive and reset stock at midnight
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the archive_and_reset_daily_stock function to run at midnight every day
SELECT cron.schedule(
  'daily-milk-stock-reset',  -- unique job name
  '0 0 * * *',              -- cron schedule (midnight every day)
  'SELECT public.archive_and_reset_daily_stock()'
);

-- Function to get today's stock summary with more details
CREATE OR REPLACE FUNCTION public.get_today_stock_summary()
RETURNS TABLE (
  total_stock NUMERIC,
  available_stock NUMERIC,
  subscription_demand NUMERIC,
  leftover_from_yesterday NUMERIC,
  sold_stock NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  initial_stock NUMERIC;
BEGIN
  -- Get current stock
  SELECT total_stock INTO total_stock FROM milk_stock;
  
  -- Get leftover from yesterday (which would be our initial stock today)
  SELECT COALESCE(leftover_stock, 0) INTO leftover_from_yesterday
  FROM milk_stock_archive
  WHERE date = CURRENT_DATE - 1;
  
  -- If no record exists for yesterday, set leftover to 0
  IF leftover_from_yesterday IS NULL THEN
    leftover_from_yesterday := 0;
  END IF;
  
  -- Get any milk added today
  SELECT COALESCE(SUM(quantity), 0) INTO initial_stock
  FROM milk_collections
  WHERE DATE(created_at) = CURRENT_DATE;
  
  -- Add leftover to any milk added today to get total initial stock
  initial_stock := initial_stock + leftover_from_yesterday;
  
  -- Get subscription demand for today
  SELECT COALESCE(SUM(
    CASE 
      WHEN frequency = 'daily' THEN quantity
      WHEN frequency = 'weekly' THEN quantity / 7
      WHEN frequency = 'monthly' THEN quantity / 30
      ELSE 0
    END
  ), 0) INTO subscription_demand
  FROM subscriptions
  WHERE status = 'active';
  
  -- Calculate sold stock (initial - current)
  sold_stock := GREATEST(0, initial_stock - total_stock);
  
  -- Calculate available stock (current stock - subscription demand)
  available_stock := GREATEST(0, total_stock - subscription_demand);
  
  RETURN NEXT;
END;
$$;

-- Function to get milk inventory archive records by date range
CREATE OR REPLACE FUNCTION public.get_milk_inventory_archive(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS SETOF public.milk_inventory_archive
LANGUAGE plpgsql
AS $$
BEGIN
  IF start_date IS NULL AND end_date IS NULL THEN
    RETURN QUERY 
    SELECT * FROM public.milk_inventory_archive
    ORDER BY date DESC
    LIMIT 30;
  ELSE
    RETURN QUERY 
    SELECT * FROM public.milk_inventory_archive
    WHERE (start_date IS NULL OR date >= start_date)
    AND (end_date IS NULL OR date <= end_date)
    ORDER BY date DESC;
  END IF;
END;
$$;

-- Function to archive current milk_stock data to milk_inventory_archive
CREATE OR REPLACE FUNCTION public.archive_milk_inventory(
  archive_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  stock_record public.milk_stock;
BEGIN
  -- Check if we already have an archive entry for the date
  IF EXISTS (SELECT 1 FROM milk_inventory_archive WHERE date = archive_date) THEN
    RETURN FALSE;
  END IF;

  -- Get stock record for the archive date
  SELECT * INTO stock_record 
  FROM public.milk_stock 
  WHERE date = archive_date;
  
  -- If no record exists for the date, return false
  IF stock_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Archive the milk stock record
  INSERT INTO public.milk_inventory_archive (
    date,
    total_stock,
    available_stock,
    subscription_demand,
    leftover_milk
  ) VALUES (
    archive_date,
    stock_record.total_stock::INTEGER,
    stock_record.available_stock,
    stock_record.subscription_demand,
    stock_record.leftover_milk
  );
  
  RETURN TRUE;
END;
$$;

-- Function to get inventory summary statistics
CREATE OR REPLACE FUNCTION public.get_inventory_summary(
  period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  start_date DATE,
  end_date DATE,
  avg_total_stock NUMERIC,
  avg_subscription_demand NUMERIC,
  avg_leftover_milk NUMERIC,
  max_total_stock INTEGER,
  min_total_stock INTEGER,
  total_days INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  end_date DATE := CURRENT_DATE - 1;
  start_date DATE := end_date - period_days;
BEGIN
  RETURN QUERY
  SELECT 
    start_date,
    end_date,
    ROUND(AVG(total_stock)::NUMERIC, 2) AS avg_total_stock,
    ROUND(AVG(subscription_demand)::NUMERIC, 2) AS avg_subscription_demand,
    ROUND(AVG(leftover_milk)::NUMERIC, 2) AS avg_leftover_milk,
    MAX(total_stock) AS max_total_stock,
    MIN(total_stock) AS min_total_stock,
    COUNT(*)::INTEGER AS total_days
  FROM public.milk_inventory_archive
  WHERE date BETWEEN start_date AND end_date;
END;
$$;

-- Function to automatically archive milk stock daily
CREATE OR REPLACE FUNCTION public.auto_archive_milk_inventory()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  yesterday DATE := CURRENT_DATE - 1;
BEGIN
  -- Archive yesterday's inventory if not already archived
  RETURN public.archive_milk_inventory(yesterday);
END;
$$;

-- Schedule daily inventory archiving
SELECT cron.schedule(
  'daily-milk-inventory-archive',  -- unique job name
  '5 0 * * *',                    -- cron schedule (5 minutes after midnight every day)
  'SELECT public.auto_archive_milk_inventory()'
);
