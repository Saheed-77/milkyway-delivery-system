
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
BEGIN
  -- Get current stock
  SELECT total_stock INTO current_stock FROM milk_stock;
  
  -- Update the stock
  IF current_stock IS NULL THEN
    INSERT INTO milk_stock (total_stock) VALUES (add_quantity);
  ELSE
    UPDATE milk_stock SET total_stock = total_stock + add_quantity;
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
