-- Migration 011: Add optional transfer receipt URL to orders
-- Enables attaching proof of payment for bank transfers at creation or post-sale

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

COMMENT ON COLUMN public.orders.receipt_url IS 'Optional image URL pointing to payment receipt or bank transfer proof.';
