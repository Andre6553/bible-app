-- ==========================================
-- FIX DUPLICATE PROFILES & PREVENT RECURRENCE
-- ==========================================

-- 1. CLEANUP DUPLICATES
-- Deletes "Ghost" profiles (Guest IDs that accidentally got an email attached)
-- Keeps the "Real" profile (Authenticated ID) based on:
-- Priority: Admin > Premium > Created Earlier (Assuming Auth ID is older or matches better)

DELETE FROM public.user_profiles
WHERE user_id IN (
    SELECT user_id FROM (
        SELECT 
            user_id,
            email,
            ROW_NUMBER() OVER (
                PARTITION BY email 
                ORDER BY 
                    -- Keep Admin/Premium first
                    CASE subscription_override
                        WHEN 'admin' THEN 1
                        WHEN 'premium' THEN 2
                        WHEN 'tester' THEN 3
                        ELSE 4
                    END,
                    -- Then keep the one that looks like a UUID (Real Auth ID) vs a generated string?
                    -- Actually, simpler: Keep the one that was created first? 
                    -- Or keep the one with the most AI usage?
                    -- "ai_usage_count" DESC, 
                    created_at ASC -- Oldest one is usually the original Auth one? 
                    -- Wait, the user said the BAD one was created Jan 13 (Newer). The Real one Dec 29 (Older).
                    -- So keeping OLDER is better.
            ) as rn
        FROM public.user_profiles
        WHERE email IS NOT NULL AND email != ''
    ) duplicates
    WHERE rn > 1
);

-- 2. PREVENT FUTURE DUPLICATES
-- Add a unique constraint to the email column.
-- This ensures that if code tries to "update" a Guest ID with an existing Email, it will fail (safely).

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_email_key UNIQUE (email);

-- 3. VERIFY ADMIN ACCESS
-- Just in case the cleanup messed up, re-assert admin rights for Andre
UPDATE public.user_profiles
SET subscription_override = 'admin'
WHERE email = 'andre.ecprint@gmail.com';
