-- Fix trainer_schedules table schema
-- Run this in Supabase SQL Editor

-- Add the slots JSONB column if missing
ALTER TABLE trainer_schedules 
ADD COLUMN IF NOT EXISTS slots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Make schedule_date nullable (app doesn't use this column)
ALTER TABLE trainer_schedules 
ALTER COLUMN schedule_date DROP NOT NULL;

-- Set default for schedule_date
ALTER TABLE trainer_schedules 
ALTER COLUMN schedule_date SET DEFAULT CURRENT_DATE;

-- Make any other potentially problematic columns nullable
DO $$ 
BEGIN
  -- Only alter if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trainer_schedules' AND column_name = 'start_time') THEN
    ALTER TABLE trainer_schedules ALTER COLUMN start_time DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trainer_schedules' AND column_name = 'end_time') THEN
    ALTER TABLE trainer_schedules ALTER COLUMN end_time DROP NOT NULL;
  END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'trainer_schedules'
ORDER BY ordinal_position;
