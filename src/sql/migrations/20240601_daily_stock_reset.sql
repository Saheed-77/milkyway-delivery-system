-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Make sure the stock tables exist
CREATE TABLE IF NOT EXISTS public.milk_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_stock NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Make sure milk_stock_archive table exists
CREATE TABLE IF NOT EXISTS public.milk_stock_archive (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    total_stock NUMERIC NOT NULL,
    subscription_demand NUMERIC NOT NULL,
    leftover_stock NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_date UNIQUE (date)
);

-- Schedule the archive_and_reset_daily_stock function to run at midnight every day
SELECT cron.schedule(
  'daily-milk-stock-reset',  -- unique job name
  '0 0 * * *',              -- cron schedule (midnight every day)
  $$SELECT public.archive_and_reset_daily_stock()$$
);

-- Add index for faster lookups by date
CREATE INDEX IF NOT EXISTS idx_milk_stock_archive_date ON public.milk_stock_archive(date); 