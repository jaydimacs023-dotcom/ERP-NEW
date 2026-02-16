-- =====================================================
-- CREATE PAYMENTS AND PAYMENT_APPLICATIONS TABLES
-- For AR payment tracking with EWT certification and invoice applications
-- =====================================================

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Payment identification
    payment_no VARCHAR(50) NOT NULL,
    
    -- Payer (either sponsor or student)
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    
    -- Payment details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'VOIDED')),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'CHECK' CHECK (payment_method IN ('CASH', 'CHECK', 'BANK_TRANSFER', 'CREDIT_CARD', 'EWALLET', 'OFFSET')),
    
    -- Reference info
    ref_no VARCHAR(100),
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
    check_number VARCHAR(50),
    check_date DATE,
    
    -- Amounts
    amount_received NUMERIC(15,2) NOT NULL DEFAULT 0,
    ewt_amount_certified NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_applied NUMERIC(15,2) NOT NULL DEFAULT 0,
    customer_deposit_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Journal entry linkage
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    
    -- Void info
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    
    -- Posting info
    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
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
    CONSTRAINT chk_payer CHECK (sponsor_id IS NOT NULL OR student_id IS NOT NULL),
    CONSTRAINT chk_amounts CHECK (amount_received >= 0 AND ewt_amount_certified >= 0),
    UNIQUE (org_id, payment_no)
);

-- Payment Applications Table (links payments to invoices)
CREATE TABLE IF NOT EXISTS payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Application amount
    amount_applied NUMERIC(15,2) NOT NULL CHECK (amount_applied > 0),
    
    -- Reversal tracking
    is_reversed BOOLEAN DEFAULT FALSE,
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index: only one active (non-reversed) application per payment-invoice pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_application 
    ON payment_applications(payment_id, invoice_id) 
    WHERE (is_reversed = FALSE);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_sponsor_id ON payments(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_not_deleted ON payments(org_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_payment_applications_payment_id ON payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_invoice_id ON payment_applications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_not_reversed ON payment_applications(payment_id) WHERE is_reversed = FALSE;

-- Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view payments in their organization" ON payments
    FOR SELECT USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert payments in their organization" ON payments
    FOR INSERT WITH CHECK (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update payments in their organization" ON payments
    FOR UPDATE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete payments in their organization" ON payments
    FOR DELETE USING (
        org_id IN (
            SELECT org_id FROM users WHERE id = auth.uid()
        )
    );

-- RLS Policies for payment_applications (inherit from payments)
CREATE POLICY "Users can view payment applications for their payments" ON payment_applications
    FOR SELECT USING (
        payment_id IN (
            SELECT id FROM payments WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert payment applications for their payments" ON payment_applications
    FOR INSERT WITH CHECK (
        payment_id IN (
            SELECT id FROM payments WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update payment applications for their payments" ON payment_applications
    FOR UPDATE USING (
        payment_id IN (
            SELECT id FROM payments WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete payment applications for their payments" ON payment_applications
    FOR DELETE USING (
        payment_id IN (
            SELECT id FROM payments WHERE org_id IN (
                SELECT org_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- Trigger to update payment totals when applications change
CREATE OR REPLACE FUNCTION update_payment_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate totals for the affected payment
    UPDATE payments
    SET 
        total_applied = COALESCE((
            SELECT SUM(amount_applied) 
            FROM payment_applications 
            WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id) 
            AND is_reversed = FALSE
        ), 0),
        customer_deposit_balance = amount_received + ewt_amount_certified - COALESCE((
            SELECT SUM(amount_applied) 
            FROM payment_applications 
            WHERE payment_id = COALESCE(NEW.payment_id, OLD.payment_id) 
            AND is_reversed = FALSE
        ), 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.payment_id, OLD.payment_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_totals
AFTER INSERT OR UPDATE OR DELETE ON payment_applications
FOR EACH ROW EXECUTE FUNCTION update_payment_totals();

-- Trigger to update invoice balance when applications change
CREATE OR REPLACE FUNCTION update_invoice_balance_on_application()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the affected invoice's balance due
    UPDATE invoices
    SET 
        amount_paid = COALESCE((
            SELECT SUM(amount_applied)
            FROM payment_applications
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            AND is_reversed = FALSE
        ), 0),
        balance_due = net_amount_due - COALESCE((
            SELECT SUM(amount_applied)
            FROM payment_applications
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
            AND is_reversed = FALSE
        ), 0),
        status = CASE 
            WHEN net_amount_due - COALESCE((
                SELECT SUM(amount_applied)
                FROM payment_applications
                WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
                AND is_reversed = FALSE
            ), 0) <= 0 THEN 'PAID'
            ELSE 'OPEN'
        END,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_balance
AFTER INSERT OR UPDATE OR DELETE ON payment_applications
FOR EACH ROW EXECUTE FUNCTION update_invoice_balance_on_application();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_applications TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- SELECT * FROM payments LIMIT 5;
-- SELECT * FROM payment_applications LIMIT 5;
