-- =====================================================
-- CREATE BANK_DEPOSITS AND BANK_DEPOSIT_LINES TABLES
-- For deposit slip tracking with cash and check items
-- =====================================================

-- Bank Deposits Table
CREATE TABLE IF NOT EXISTS bank_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Deposit identification
    deposit_no VARCHAR(50) NOT NULL,
    
    -- Bank account
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    reference_no VARCHAR(100),  -- Bank reference / deposit slip number
    
    -- Deposit details
    deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'VOIDED')),
    
    -- Amounts
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    cash_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    check_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Journal entry linkage
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    
    -- Posting info
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Void info
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_amounts_positive CHECK (total_amount >= 0 AND cash_amount >= 0 AND check_amount >= 0),
    UNIQUE (org_id, deposit_no)
);

-- Bank Deposit Lines Table (individual items in deposit)
CREATE TABLE IF NOT EXISTS bank_deposit_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID NOT NULL REFERENCES bank_deposits(id) ON DELETE CASCADE,
    
    -- Link to payment (if from AR collection)
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    -- Line details
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    
    -- Check info
    check_number VARCHAR(50),
    check_date DATE,
    payer_name VARCHAR(255),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_deposits_org_id ON bank_deposits(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_bank_account_id ON bank_deposits(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_status ON bank_deposits(status);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_deposit_date ON bank_deposits(deposit_date);
CREATE INDEX IF NOT EXISTS idx_bank_deposits_not_deleted ON bank_deposits(org_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_bank_deposit_lines_deposit_id ON bank_deposit_lines(deposit_id);
CREATE INDEX IF NOT EXISTS idx_bank_deposit_lines_payment_id ON bank_deposit_lines(payment_id);

-- Row Level Security
ALTER TABLE bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_deposit_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_deposits
CREATE POLICY "Users can view bank deposits in their organization" ON bank_deposits
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert bank deposits in their organization" ON bank_deposits
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update bank deposits in their organization" ON bank_deposits
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete bank deposits in their organization" ON bank_deposits
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

-- RLS Policies for bank_deposit_lines (inherit from bank_deposits)
CREATE POLICY "Users can view bank deposit lines for their deposits" ON bank_deposit_lines
    FOR SELECT USING (
        deposit_id IN (
            SELECT id FROM bank_deposits WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert bank deposit lines for their deposits" ON bank_deposit_lines
    FOR INSERT WITH CHECK (
        deposit_id IN (
            SELECT id FROM bank_deposits WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update bank deposit lines for their deposits" ON bank_deposit_lines
    FOR UPDATE USING (
        deposit_id IN (
            SELECT id FROM bank_deposits WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete bank deposit lines for their deposits" ON bank_deposit_lines
    FOR DELETE USING (
        deposit_id IN (
            SELECT id FROM bank_deposits WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- Trigger to update deposit totals when lines change
CREATE OR REPLACE FUNCTION update_bank_deposit_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate totals for the affected deposit
    UPDATE bank_deposits
    SET 
        check_amount = COALESCE((
            SELECT SUM(amount) 
            FROM bank_deposit_lines 
            WHERE deposit_id = COALESCE(NEW.deposit_id, OLD.deposit_id)
        ), 0),
        total_amount = cash_amount + COALESCE((
            SELECT SUM(amount) 
            FROM bank_deposit_lines 
            WHERE deposit_id = COALESCE(NEW.deposit_id, OLD.deposit_id)
        ), 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.deposit_id, OLD.deposit_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bank_deposit_totals
AFTER INSERT OR UPDATE OR DELETE ON bank_deposit_lines
FOR EACH ROW EXECUTE FUNCTION update_bank_deposit_totals();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_deposits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_deposit_lines TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- SELECT * FROM bank_deposits LIMIT 5;
-- SELECT * FROM bank_deposit_lines LIMIT 5;
