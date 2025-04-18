
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
