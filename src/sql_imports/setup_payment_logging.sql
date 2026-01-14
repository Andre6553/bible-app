-- setup_payment_logging.sql
-- Run this in Supabase SQL Editor to prepare for server-side IPN verification.

-- 1. Enhance payment_history table with audit fields
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'pf_payment_id') THEN
        ALTER TABLE public.payment_history ADD COLUMN pf_payment_id TEXT;
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'payment_status') THEN
        ALTER TABLE public.payment_history ADD COLUMN payment_status TEXT;
    END IF; 

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'item_name') THEN
        ALTER TABLE public.payment_history ADD COLUMN item_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'amount_gross') THEN
        ALTER TABLE public.payment_history ADD COLUMN amount_gross DECIMAL(10,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'full_ipn_data') THEN
        ALTER TABLE public.payment_history ADD COLUMN full_ipn_data JSONB;
    END IF;
END $$;

-- 2. Update RLS policies to allow the Service Role (webhook) to insert/update, 
-- but keep existing restrictions for end users.
-- (Note: Service Role bypasses RLS by default, so no change needed to policies,
-- but we ensure the user can still see their history).

NOTIFY pgrst, 'reload schema';
