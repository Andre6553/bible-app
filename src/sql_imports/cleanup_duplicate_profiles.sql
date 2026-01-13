-- ============================================
-- CLEANUP DUPLICATE USER PROFILES SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor
-- STEP 1: First, review which emails have duplicates

-- View all emails that have more than one profile
SELECT email, COUNT(*) as duplicate_count
FROM user_profiles
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================
-- STEP 2: View details of duplicate profiles
-- This shows all profiles for emails that have duplicates
-- so you can decide which to keep

SELECT 
    user_id,
    email,
    subscription_tier,
    subscription_override,
    ai_usage_count,
    last_seen,
    created_at
FROM user_profiles
WHERE email IN (
    SELECT email
    FROM user_profiles
    WHERE email IS NOT NULL AND email != ''
    GROUP BY email
    HAVING COUNT(*) > 1
)
ORDER BY email, last_seen DESC;

-- ============================================
-- STEP 3: DELETE DUPLICATES (KEEP ADMIN/PREMIUM)
-- This keeps the profile with 'admin' or 'premium' override
-- Or if none have that, keeps the most recently seen one
-- 
-- ⚠️ CAUTION: Review Step 2 output before running this!
-- ============================================

-- Delete duplicate profiles, keeping the "best" one per email
-- Priority: admin > premium > tester > most recent last_seen
DELETE FROM user_profiles
WHERE user_id IN (
    SELECT user_id FROM (
        SELECT 
            user_id,
            email,
            ROW_NUMBER() OVER (
                PARTITION BY email 
                ORDER BY 
                    CASE subscription_override
                        WHEN 'admin' THEN 1
                        WHEN 'premium' THEN 2
                        WHEN 'tester' THEN 3
                        WHEN 'tester_finger' THEN 4
                        ELSE 5
                    END,
                    last_seen DESC NULLS LAST
            ) as rn
        FROM user_profiles
        WHERE email IN (
            SELECT email
            FROM user_profiles
            WHERE email IS NOT NULL AND email != ''
            GROUP BY email
            HAVING COUNT(*) > 1
        )
    ) duplicates
    WHERE rn > 1  -- Delete all except the first (best) one per email
);

-- ============================================
-- STEP 4: Verify cleanup worked
-- Should return 0 rows if all duplicates are removed
SELECT email, COUNT(*) as count
FROM user_profiles
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1;
