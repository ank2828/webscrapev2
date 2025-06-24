-- CRITICAL FIX: Add missing DELETE policies to enable report deletion
-- Run this ENTIRE script in your Supabase SQL Editor

-- Step 1: Check if DELETE policies already exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('reports', 'report_requests', 'analytics') 
AND cmd = 'DELETE';

-- Step 2: Add DELETE policy for reports table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reports' 
        AND cmd = 'DELETE'
        AND policyname = 'Public reports can be deleted by everyone'
    ) THEN
        CREATE POLICY "Public reports can be deleted by everyone" 
        ON reports FOR DELETE 
        USING (true);
        RAISE NOTICE 'Created DELETE policy for reports table';
    ELSE
        RAISE NOTICE 'DELETE policy for reports already exists';
    END IF;
END $$;

-- Step 3: Add DELETE policy for report_requests table  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'report_requests' 
        AND cmd = 'DELETE'
        AND policyname = 'Public report_requests can be deleted by everyone'
    ) THEN
        CREATE POLICY "Public report_requests can be deleted by everyone" 
        ON report_requests FOR DELETE 
        USING (true);
        RAISE NOTICE 'Created DELETE policy for report_requests table';
    ELSE
        RAISE NOTICE 'DELETE policy for report_requests already exists';
    END IF;
END $$;

-- Step 4: Add DELETE policy for analytics table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'analytics' 
        AND cmd = 'DELETE'
        AND policyname = 'Public analytics can be deleted by everyone'
    ) THEN
        CREATE POLICY "Public analytics can be deleted by everyone" 
        ON analytics FOR DELETE 
        USING (true);
        RAISE NOTICE 'Created DELETE policy for analytics table';
    ELSE
        RAISE NOTICE 'DELETE policy for analytics already exists';
    END IF;
END $$;

-- Step 5: Verify all policies are now in place
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies 
WHERE tablename IN ('reports', 'report_requests', 'analytics')
ORDER BY tablename, cmd;

-- Step 6: Test deletion (optional - uncomment to test)
-- DELETE FROM analytics WHERE report_id IN (SELECT id FROM reports LIMIT 1);
-- DELETE FROM report_requests WHERE report_id IN (SELECT id FROM reports LIMIT 1);
-- DELETE FROM reports WHERE id IN (SELECT id FROM reports LIMIT 1);

-- If the above test deletion works, your DELETE policies are now active! 