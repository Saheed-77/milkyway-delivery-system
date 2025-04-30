-- Create milk_stock_archive table
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

-- Create index on date column for faster lookups
CREATE INDEX IF NOT EXISTS idx_milk_stock_archive_date ON public.milk_stock_archive(date);

-- Add RLS policies
ALTER TABLE public.milk_stock_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.milk_stock_archive
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.milk_stock_archive
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_milk_stock_archive_updated_at
    BEFORE UPDATE ON public.milk_stock_archive
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 