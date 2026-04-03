-- Add Collection Receipt number to payments
-- Safe to run multiple times

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS cr_no VARCHAR(50);
