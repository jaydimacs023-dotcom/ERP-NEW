-- =====================================================
-- CREATE TAX_CATEGORIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'VAT', -- VAT, NON_VAT, ZERO_RATED, EXEMPT
    rate DECIMAL(5,4) NOT NULL DEFAULT 0.1200,
    is_inclusive BOOLEAN NOT NULL DEFAULT TRUE,
    output_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    
    -- Standard audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT tax_category_code_per_org UNIQUE (org_id, code)
);

-- Index for org filtering
CREATE INDEX IF NOT EXISTS idx_tax_categories_org_id ON tax_categories(org_id);

-- Enable Row Level Security
ALTER TABLE tax_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see tax categories from their organization
CREATE POLICY tax_categories_org_isolation ON tax_categories
    FOR ALL
    USING (org_id IN (
        SELECT u.org_id FROM users u WHERE u.id = auth.uid()
    ));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tax_categories TO authenticated;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_tax_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tax_categories_updated_at ON tax_categories;
CREATE TRIGGER trigger_tax_categories_updated_at
    BEFORE UPDATE ON tax_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_tax_categories_updated_at();

-- =====================================================
-- USAGE NOTES:
-- 1. Run this script in your Supabase SQL Editor
-- 2. Used for mapping Items/CourseFees to Output VAT accounts
-- =====================================================
