
-- Add payment_id to milk_contributions table
ALTER TABLE public.milk_contributions
ADD COLUMN payment_id UUID REFERENCES public.farmer_payments(id) NULL;
