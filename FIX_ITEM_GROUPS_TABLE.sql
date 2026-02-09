-- Item Groups Table Migration
-- This table stores pre-defined groups of items for quick invoicing
-- Run this in Supabase SQL Editor

-- Create item_groups table
CREATE TABLE IF NOT EXISTS item_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    total_amount DECIMAL(18, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint for code per organization
ALTER TABLE item_groups 
ADD CONSTRAINT item_groups_org_code_unique UNIQUE (org_id, code);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_item_groups_org_id ON item_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_item_groups_is_active ON item_groups(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_item_groups_is_deleted ON item_groups(is_deleted) WHERE is_deleted = false;

-- Enable RLS
ALTER TABLE item_groups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view item groups in their organization" ON item_groups
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert item groups in their organization" ON item_groups
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update item groups in their organization" ON item_groups
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete item groups in their organization" ON item_groups
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

-- Add comment explaining the items JSON structure
COMMENT ON COLUMN item_groups.items IS 'JSON array of item group items: [{itemId: string, qty: number, price: number}]';

-- Example insert:
-- INSERT INTO item_groups (org_id, code, name, description, items, total_amount) VALUES (
--     'your-org-uuid',
--     'PKG-TESDA-01',
--     'TESDA NC II Certification Package',
--     'Complete package for TESDA NC II certification including assessment and training fees',
--     '[{"itemId": "item-uuid-1", "qty": 1, "price": 5000}, {"itemId": "item-uuid-2", "qty": 1, "price": 2500}]'::JSONB,
--     7500
-- );
