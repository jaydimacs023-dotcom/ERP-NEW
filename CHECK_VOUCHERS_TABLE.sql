-- =============================================
-- CHECK VOUCHERS TABLE FOR AT-ERP
-- =============================================
-- This table stores check voucher records with manual check number sequencing
-- Run this in your Supabase SQL Editor

-- Drop existing table if needed (uncomment if recreating)
-- DROP TABLE IF EXISTS check_vouchers;

-- Create the check_vouchers table
CREATE TABLE IF NOT EXISTS check_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Check Information
    check_number VARCHAR(50) NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    
    -- Payee Information
    payee_id UUID,
    payee_type VARCHAR(20) CHECK (payee_type IN ('VENDOR', 'EMPLOYEE', 'OTHER')),
    payee_name VARCHAR(255) NOT NULL,
    
    -- Check Details
    check_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    amount_in_words VARCHAR(500),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' 
        CHECK (status IN ('DRAFT', 'PRINTED', 'RELEASED', 'CLEARED', 'VOIDED', 'STALE')),
    
    -- Linked Records
    payable_ids UUID[] DEFAULT '{}',
    journal_entry_id UUID REFERENCES journal_entries(id),
    
    -- Audit Trail - Preparation
    prepared_by UUID REFERENCES users(id),
    prepared_at TIMESTAMPTZ,
    
    -- Audit Trail - Approval
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Audit Trail - Printing
    printed_by UUID REFERENCES users(id),
    printed_at TIMESTAMPTZ,
    
    -- Audit Trail - Release
    released_by UUID REFERENCES users(id),
    released_at TIMESTAMPTZ,
    
    -- Audit Trail - Clearing
    cleared_by UUID REFERENCES users(id),
    cleared_at TIMESTAMPTZ,
    
    -- Audit Trail - Voiding
    voided_by UUID REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    
    -- Unique constraint: check number must be unique per bank account
    CONSTRAINT unique_check_number_per_bank UNIQUE (bank_account_id, check_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_check_vouchers_org_id ON check_vouchers(org_id);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_bank_account_id ON check_vouchers(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_check_number ON check_vouchers(check_number);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_status ON check_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_payee_id ON check_vouchers(payee_id);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_check_date ON check_vouchers(check_date);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_created_at ON check_vouchers(created_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_check_vouchers_org_status ON check_vouchers(org_id, status);
CREATE INDEX IF NOT EXISTS idx_check_vouchers_bank_status ON check_vouchers(bank_account_id, status);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
-- Disable RLS for simpler access (same as bank_accounts)
ALTER TABLE check_vouchers DISABLE ROW LEVEL SECURITY;

-- =============================================
-- PERMISSIONS
-- =============================================
GRANT ALL ON check_vouchers TO authenticated;
GRANT ALL ON check_vouchers TO anon;
GRANT ALL ON check_vouchers TO service_role;

-- =============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_check_vouchers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_vouchers_updated_at ON check_vouchers;
CREATE TRIGGER trigger_check_vouchers_updated_at
    BEFORE UPDATE ON check_vouchers
    FOR EACH ROW
    EXECUTE FUNCTION update_check_vouchers_updated_at();

-- =============================================
-- CHECK NUMBER SETTINGS TABLE (Optional)
-- =============================================
-- This table stores the check number prefix and starting sequence per bank account
CREATE TABLE IF NOT EXISTS check_number_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    prefix VARCHAR(20) DEFAULT '',
    start_number INTEGER DEFAULT 1,
    current_number INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_settings_per_bank UNIQUE (bank_account_id)
);

-- Index for check_number_settings
CREATE INDEX IF NOT EXISTS idx_check_number_settings_org_id ON check_number_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_check_number_settings_bank_id ON check_number_settings(bank_account_id);

-- Disable RLS for settings table
ALTER TABLE check_number_settings DISABLE ROW LEVEL SECURITY;

-- Permissions for settings table
GRANT ALL ON check_number_settings TO authenticated;
GRANT ALL ON check_number_settings TO anon;
GRANT ALL ON check_number_settings TO service_role;

-- Auto-update trigger for settings
CREATE OR REPLACE FUNCTION update_check_number_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_number_settings_updated_at ON check_number_settings;
CREATE TRIGGER trigger_check_number_settings_updated_at
    BEFORE UPDATE ON check_number_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_check_number_settings_updated_at();

-- =============================================
-- HELPER FUNCTION: Get Next Check Number
-- =============================================
CREATE OR REPLACE FUNCTION get_next_check_number(
    p_bank_account_id UUID,
    p_org_id UUID
) RETURNS VARCHAR AS $$
DECLARE
    v_prefix VARCHAR(20);
    v_start_number INTEGER;
    v_max_number INTEGER;
    v_next_number INTEGER;
    v_check_number VARCHAR(50);
BEGIN
    -- Get settings for this bank account
    SELECT prefix, start_number 
    INTO v_prefix, v_start_number
    FROM check_number_settings 
    WHERE bank_account_id = p_bank_account_id;
    
    -- Default values if no settings found
    IF v_prefix IS NULL THEN v_prefix := ''; END IF;
    IF v_start_number IS NULL THEN v_start_number := 1; END IF;
    
    -- Find the highest check number for this bank account
    SELECT COALESCE(MAX(
        CASE 
            WHEN v_prefix = '' THEN check_number::INTEGER
            ELSE NULLIF(REPLACE(check_number, v_prefix, ''), '')::INTEGER
        END
    ), v_start_number - 1)
    INTO v_max_number
    FROM check_vouchers 
    WHERE bank_account_id = p_bank_account_id
    AND check_number ~ ('^' || v_prefix || '[0-9]+$');
    
    -- Calculate next number
    v_next_number := GREATEST(v_max_number + 1, v_start_number);
    
    -- Format with prefix
    v_check_number := v_prefix || LPAD(v_next_number::TEXT, 6, '0');
    
    RETURN v_check_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================
-- Uncomment to insert sample check vouchers
/*
INSERT INTO check_vouchers (org_id, check_number, bank_account_id, payee_name, check_date, amount, status)
SELECT 
    (SELECT id FROM organizations LIMIT 1),
    'CHK-000001',
    (SELECT id FROM bank_accounts LIMIT 1),
    'Sample Vendor',
    CURRENT_DATE,
    1000.00,
    'DRAFT'
WHERE EXISTS (SELECT 1 FROM bank_accounts);
*/

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these to verify the table was created correctly:

-- Check table structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'check_vouchers' 
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'check_vouchers';

-- Check constraints
-- SELECT conname, contype, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'check_vouchers'::regclass;

SELECT 'check_vouchers table created successfully!' AS status;
