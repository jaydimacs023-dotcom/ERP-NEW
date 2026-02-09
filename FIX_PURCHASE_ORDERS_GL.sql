-- Add GL Entry Number and approval fields to purchase_orders table
-- Run this in Supabase SQL Editor

-- Add gl_entry_number column (generated when PO is APPROVED)
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS gl_entry_number VARCHAR(50);

-- Add approval tracking fields
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS approved_by UUID;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add an index for efficient GL number lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_gl_entry_number 
ON purchase_orders(gl_entry_number) 
WHERE gl_entry_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN purchase_orders.gl_entry_number IS 'Sequential GL entry number generated when PO is approved (e.g., GL-2026-00001)';
COMMENT ON COLUMN purchase_orders.approved_by IS 'User ID who approved the PO';
COMMENT ON COLUMN purchase_orders.approved_at IS 'Timestamp when PO was approved';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;
