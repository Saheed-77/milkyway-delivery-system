
-- Function to link contributions to a payment
CREATE OR REPLACE FUNCTION public.link_contributions_to_payment(
  farmer_id UUID,
  payment_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update all contributions without a payment_id for this farmer
  UPDATE milk_contributions
  SET payment_id = link_contributions_to_payment.payment_id
  WHERE farmer_id = link_contributions_to_payment.farmer_id
  AND payment_id IS NULL;
END;
$$;
