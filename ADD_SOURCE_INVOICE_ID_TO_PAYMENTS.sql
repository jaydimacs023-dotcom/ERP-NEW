-- Add invoice-to-payment link for AR invoice Pay action control
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS source_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_source_invoice_id
ON payments(source_invoice_id);
