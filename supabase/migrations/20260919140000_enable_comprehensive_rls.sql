-- Migration: 20260919140000_enable_comprehensive_rls.sql
-- Enables and standardizes Row Level Security (RLS) across all remaining database tables
-- Guarantees tenant isolation via private.erp_org_id() and role enforcement via private.erp_has_role()

-- ============================================================================
-- STEP 1: Enable RLS on all 28 previously unshielded tables
-- ============================================================================

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atc_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_number_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Revoke anon table privileges on tenant tables, grant to authenticated
-- ============================================================================

REVOKE ALL ON public.accounting_periods, public.audit_logs, public.bank_accounts,
  public.batches, public.chart_of_accounts, public.check_number_settings,
  public.check_vouchers, public.employees, public.fixed_assets, public.items,
  public.journal_entry_lines, public.locations, public.payment_histories,
  public.payroll_lines, public.payroll_runs, public.purchase_order_items,
  public.purchase_orders, public.qualifications, public.schedules, public.sponsors,
  public.tax_categories, public.trainer_schedules, public.trainers,
  public.vendor_tax_settings, public.vendors, public.bills, public.ap_reclassifications,
  public.inventory_classes, public.inventory_ledger, public.opening_inventory_headers,
  public.opening_inventory_lines, public.journal_entries, public.journal_lines,
  public.bank_deposits, public.bank_deposit_lines, public.bank_reconciliations,
  public.inventory_levels, public.inventory_transactions, public.stock_items,
  public.stock_adjustments, public.warehouse_locations, public.reorder_points,
  public.recurring_journal_entries, public.course_fees, public.item_groups,
  public.alumni_employment_reports FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.accounting_periods, public.audit_logs, public.bank_accounts,
  public.batches, public.chart_of_accounts, public.check_number_settings,
  public.check_vouchers, public.employees, public.fixed_assets, public.items,
  public.journal_entry_lines, public.locations, public.payment_histories,
  public.payroll_lines, public.payroll_runs, public.purchase_order_items,
  public.purchase_orders, public.qualifications, public.schedules, public.sponsors,
  public.tax_categories, public.trainer_schedules, public.trainers,
  public.vendor_tax_settings, public.vendors, public.bills, public.ap_reclassifications,
  public.inventory_classes, public.inventory_ledger, public.opening_inventory_headers,
  public.opening_inventory_lines, public.journal_entries, public.journal_lines,
  public.bank_deposits, public.bank_deposit_lines, public.bank_reconciliations,
  public.inventory_levels, public.inventory_transactions, public.stock_items,
  public.stock_adjustments, public.warehouse_locations, public.reorder_points,
  public.recurring_journal_entries, public.course_fees, public.item_groups,
  public.alumni_employment_reports, public.atc_categories, public.atc_items,
  public.atc_rates TO authenticated;

-- ============================================================================
-- STEP 3: Drop legacy, insecure, or conflicting policies
-- ============================================================================

-- Organizations
DROP POLICY IF EXISTS organizations_update ON public.organizations;

-- Journal entries & lines
DROP POLICY IF EXISTS journal_entries_delete ON public.journal_entries;
DROP POLICY IF EXISTS journal_entries_insert ON public.journal_entries;
DROP POLICY IF EXISTS journal_entries_select ON public.journal_entries;
DROP POLICY IF EXISTS journal_entries_update ON public.journal_entries;
DROP POLICY IF EXISTS journal_lines_delete ON public.journal_lines;
DROP POLICY IF EXISTS journal_lines_insert ON public.journal_lines;
DROP POLICY IF EXISTS journal_lines_select ON public.journal_lines;
DROP POLICY IF EXISTS journal_lines_update ON public.journal_lines;

-- Banking & deposits
DROP POLICY IF EXISTS "Users can view bank accounts in their organization" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can insert bank accounts in their organization" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update bank accounts in their organization" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank accounts in their organization" ON public.bank_accounts;

DROP POLICY IF EXISTS "Users can view bank deposits in their organization" ON public.bank_deposits;
DROP POLICY IF EXISTS "Users can insert bank deposits in their organization" ON public.bank_deposits;
DROP POLICY IF EXISTS "Users can update bank deposits in their organization" ON public.bank_deposits;
DROP POLICY IF EXISTS "Users can delete bank deposits in their organization" ON public.bank_deposits;

DROP POLICY IF EXISTS "Users can view bank deposit lines for their deposits" ON public.bank_deposit_lines;
DROP POLICY IF EXISTS "Users can insert bank deposit lines for their deposits" ON public.bank_deposit_lines;
DROP POLICY IF EXISTS "Users can update bank deposit lines for their deposits" ON public.bank_deposit_lines;
DROP POLICY IF EXISTS "Users can delete bank deposit lines for their deposits" ON public.bank_deposit_lines;

DROP POLICY IF EXISTS "Users can view reconciliations for their org" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can create reconciliations for their org" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can update reconciliations for their org" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "Users can delete reconciliations for their org" ON public.bank_reconciliations;

-- Accounting periods
DROP POLICY IF EXISTS "Users can view accounting periods in their organization" ON public.accounting_periods;
DROP POLICY IF EXISTS "Users can insert accounting periods in their organization" ON public.accounting_periods;
DROP POLICY IF EXISTS "Users can update accounting periods in their organization" ON public.accounting_periods;
DROP POLICY IF EXISTS "Users can delete accounting periods in their organization" ON public.accounting_periods;

-- Recurring journals
DROP POLICY IF EXISTS recurring_entries_view_org ON public.recurring_journal_entries;
DROP POLICY IF EXISTS recurring_entries_insert_org ON public.recurring_journal_entries;
DROP POLICY IF EXISTS recurring_entries_update_org ON public.recurring_journal_entries;
DROP POLICY IF EXISTS recurring_entries_delete_org ON public.recurring_journal_entries;

-- Inventory & Stock
DROP POLICY IF EXISTS warehouse_locations_org_isolation ON public.warehouse_locations;
DROP POLICY IF EXISTS warehouse_locations_update_org ON public.warehouse_locations;
DROP POLICY IF EXISTS stock_items_org_isolation ON public.stock_items;
DROP POLICY IF EXISTS stock_items_update_org ON public.stock_items;
DROP POLICY IF EXISTS inventory_levels_org_isolation ON public.inventory_levels;
DROP POLICY IF EXISTS inventory_levels_update_org ON public.inventory_levels;
DROP POLICY IF EXISTS inventory_transactions_org_isolation ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update_org ON public.inventory_transactions;
DROP POLICY IF EXISTS stock_adjustments_org_isolation ON public.stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_update_org ON public.stock_adjustments;
DROP POLICY IF EXISTS reorder_points_org_isolation ON public.reorder_points;
DROP POLICY IF EXISTS reorder_points_update_org ON public.reorder_points;

-- Items & Item groups
DROP POLICY IF EXISTS "Users can view item groups in their organization" ON public.item_groups;
DROP POLICY IF EXISTS "Users can insert item groups in their organization" ON public.item_groups;
DROP POLICY IF EXISTS "Users can update item groups in their organization" ON public.item_groups;
DROP POLICY IF EXISTS "Users can delete item groups in their organization" ON public.item_groups;

-- Course fees & Alumni
DROP POLICY IF EXISTS "Users can view course fees in their organization" ON public.course_fees;
DROP POLICY IF EXISTS "Users can insert course fees in their organization" ON public.course_fees;
DROP POLICY IF EXISTS "Users can update course fees in their organization" ON public.course_fees;
DROP POLICY IF EXISTS "Users can delete course fees in their organization" ON public.course_fees;
DROP POLICY IF EXISTS course_fees_select ON public.course_fees;
DROP POLICY IF EXISTS course_fees_insert ON public.course_fees;
DROP POLICY IF EXISTS course_fees_update ON public.course_fees;
DROP POLICY IF EXISTS course_fees_delete ON public.course_fees;

DROP POLICY IF EXISTS alumni_reports_select ON public.alumni_employment_reports;
DROP POLICY IF EXISTS alumni_reports_insert ON public.alumni_employment_reports;
DROP POLICY IF EXISTS alumni_reports_update ON public.alumni_employment_reports;
DROP POLICY IF EXISTS alumni_reports_delete ON public.alumni_employment_reports;

-- Tax categories
DROP POLICY IF EXISTS tax_categories_org_isolation ON public.tax_categories;

-- ============================================================================
-- STEP 4: Install Standardized RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Organizations
-- ----------------------------------------------------------------------------
CREATE POLICY organizations_admin_update ON public.organizations FOR UPDATE TO authenticated
USING (private.erp_is_system_admin() OR (id = private.erp_org_id() AND private.erp_has_role('ADMIN')))
WITH CHECK (private.erp_is_system_admin() OR (id = private.erp_org_id() AND private.erp_has_role('ADMIN')));

-- ----------------------------------------------------------------------------
-- 2. General Ledger & Chart of Accounts
-- ----------------------------------------------------------------------------
-- chart_of_accounts
CREATE POLICY coa_tenant_select ON public.chart_of_accounts FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY coa_finance_insert ON public.chart_of_accounts FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY coa_finance_update ON public.chart_of_accounts FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY coa_finance_delete ON public.chart_of_accounts FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- accounting_periods
CREATE POLICY periods_tenant_select ON public.accounting_periods FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY periods_finance_insert ON public.accounting_periods FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY periods_finance_update ON public.accounting_periods FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY periods_finance_delete ON public.accounting_periods FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- journal_entries
CREATE POLICY je_tenant_select ON public.journal_entries FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY je_finance_insert ON public.journal_entries FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY je_finance_update ON public.journal_entries FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY je_finance_delete ON public.journal_entries FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- journal_lines
CREATE POLICY jl_tenant_select ON public.journal_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_entry_id
  AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jl_finance_insert ON public.journal_lines FOR INSERT TO authenticated
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jl_finance_update ON public.journal_lines FOR UPDATE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())))
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jl_finance_delete ON public.journal_lines FOR DELETE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = journal_entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

-- journal_entry_lines (legacy)
CREATE POLICY jel_tenant_select ON public.journal_entry_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = entry_id
  AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jel_finance_insert ON public.journal_entry_lines FOR INSERT TO authenticated
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jel_finance_update ON public.journal_entry_lines FOR UPDATE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())))
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

CREATE POLICY jel_finance_delete ON public.journal_entry_lines FOR DELETE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER')
  AND EXISTS (SELECT 1 FROM public.journal_entries j WHERE j.id = entry_id
    AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())));

-- recurring_journal_entries
CREATE POLICY rje_tenant_select ON public.recurring_journal_entries FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY rje_finance_insert ON public.recurring_journal_entries FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY rje_finance_update ON public.recurring_journal_entries FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

CREATE POLICY rje_finance_delete ON public.recurring_journal_entries FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- ----------------------------------------------------------------------------
-- 3. Banking & Treasury
-- ----------------------------------------------------------------------------
-- bank_accounts
CREATE POLICY bank_accounts_tenant_select ON public.bank_accounts FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY bank_accounts_treasury_insert ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'TREASURY'));

CREATE POLICY bank_accounts_treasury_update ON public.bank_accounts FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'TREASURY'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'TREASURY'));

CREATE POLICY bank_accounts_treasury_delete ON public.bank_accounts FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- bank_deposits
CREATE POLICY bank_deposits_tenant_select ON public.bank_deposits FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY bank_deposits_ar_insert ON public.bank_deposits FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST'));

CREATE POLICY bank_deposits_ar_update ON public.bank_deposits FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST'));

CREATE POLICY bank_deposits_ar_delete ON public.bank_deposits FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- bank_deposit_lines
CREATE POLICY bank_deposit_lines_tenant_select ON public.bank_deposit_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bank_deposits d WHERE d.id = deposit_id
  AND (private.erp_is_system_admin() OR d.org_id = private.erp_org_id())));

CREATE POLICY bank_deposit_lines_ar_insert ON public.bank_deposit_lines FOR INSERT TO authenticated
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST')
  AND EXISTS (SELECT 1 FROM public.bank_deposits d WHERE d.id = deposit_id
    AND (private.erp_is_system_admin() OR d.org_id = private.erp_org_id())));

CREATE POLICY bank_deposit_lines_ar_update ON public.bank_deposit_lines FOR UPDATE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST')
  AND EXISTS (SELECT 1 FROM public.bank_deposits d WHERE d.id = deposit_id
    AND (private.erp_is_system_admin() OR d.org_id = private.erp_org_id())))
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AR_SPECIALIST')
  AND EXISTS (SELECT 1 FROM public.bank_deposits d WHERE d.id = deposit_id
    AND (private.erp_is_system_admin() OR d.org_id = private.erp_org_id())));

CREATE POLICY bank_deposit_lines_ar_delete ON public.bank_deposit_lines FOR DELETE TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER')
  AND EXISTS (SELECT 1 FROM public.bank_deposits d WHERE d.id = deposit_id
    AND (private.erp_is_system_admin() OR d.org_id = private.erp_org_id())));

-- bank_reconciliations
CREATE POLICY bank_rec_tenant_select ON public.bank_reconciliations FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY bank_rec_treasury_insert ON public.bank_reconciliations FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY'));

CREATE POLICY bank_rec_treasury_update ON public.bank_reconciliations FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY'));

CREATE POLICY bank_rec_treasury_delete ON public.bank_reconciliations FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- check_number_settings
CREATE POLICY check_settings_tenant_select ON public.check_number_settings FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY check_settings_treasury_write ON public.check_number_settings FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'TREASURY'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'TREASURY'));

-- check_vouchers
CREATE POLICY check_vouchers_tenant_select ON public.check_vouchers FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY check_vouchers_treasury_write ON public.check_vouchers FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY', 'AP_SUPERVISOR'));

-- ----------------------------------------------------------------------------
-- 4. Accounts Payable, Procurement & Fixed Assets
-- ----------------------------------------------------------------------------
-- vendors
CREATE POLICY vendors_tenant_select ON public.vendors FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY vendors_ap_insert ON public.vendors FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR'));

CREATE POLICY vendors_ap_update ON public.vendors FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR'));

CREATE POLICY vendors_ap_delete ON public.vendors FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'AP_SUPERVISOR'));

-- vendor_tax_settings
CREATE POLICY vendor_tax_tenant_select ON public.vendor_tax_settings FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY vendor_tax_ap_write ON public.vendor_tax_settings FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SUPERVISOR'));

-- bills
CREATE POLICY bills_tenant_select ON public.bills FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY bills_ap_insert ON public.bills FOR INSERT TO authenticated
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_CLERK', 'AP_SUPERVISOR'));

CREATE POLICY bills_ap_update ON public.bills FOR UPDATE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_CLERK', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_CLERK', 'AP_SUPERVISOR'));

CREATE POLICY bills_ap_delete ON public.bills FOR DELETE TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'AP_SUPERVISOR'));

-- ap_reclassifications
CREATE POLICY ap_reclass_tenant_select ON public.ap_reclassifications FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY ap_reclass_ap_write ON public.ap_reclassifications FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SUPERVISOR'));

-- purchase_orders
CREATE POLICY po_tenant_select ON public.purchase_orders FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY po_ap_write ON public.purchase_orders FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR'));

-- purchase_order_items
CREATE POLICY poi_tenant_select ON public.purchase_order_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
  AND (private.erp_is_system_admin() OR po.org_id = private.erp_org_id())));

CREATE POLICY poi_ap_write ON public.purchase_order_items FOR ALL TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR')
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
    AND (private.erp_is_system_admin() OR po.org_id = private.erp_org_id())))
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST', 'AP_SUPERVISOR')
  AND EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id
    AND (private.erp_is_system_admin() OR po.org_id = private.erp_org_id())));

-- fixed_assets
CREATE POLICY fixed_assets_tenant_select ON public.fixed_assets FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY fixed_assets_finance_write ON public.fixed_assets FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- ----------------------------------------------------------------------------
-- 5. Accounts Receivable
-- ----------------------------------------------------------------------------
-- course_fees
CREATE POLICY course_fees_tenant_select ON public.course_fees FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY course_fees_ar_write ON public.course_fees FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'REGISTRAR', 'AR_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'REGISTRAR', 'AR_SPECIALIST'));

-- payment_histories
CREATE POLICY payment_histories_tenant_select ON public.payment_histories FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY payment_histories_ar_write ON public.payment_histories FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST'));

-- ----------------------------------------------------------------------------
-- 6. Training Operations & Registrar
-- ----------------------------------------------------------------------------
-- batches
CREATE POLICY batches_tenant_select ON public.batches FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY batches_registrar_write ON public.batches FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- trainers
CREATE POLICY trainers_tenant_select ON public.trainers FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY trainers_registrar_write ON public.trainers FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- trainer_schedules
CREATE POLICY trainer_schedules_tenant_select ON public.trainer_schedules FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY trainer_schedules_write ON public.trainer_schedules FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR', 'TRAINER'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR', 'TRAINER'));

-- qualifications
CREATE POLICY qualifications_tenant_select ON public.qualifications FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY qualifications_registrar_write ON public.qualifications FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- schedules
CREATE POLICY schedules_tenant_select ON public.schedules FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY schedules_registrar_write ON public.schedules FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- locations
CREATE POLICY locations_tenant_select ON public.locations FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY locations_registrar_write ON public.locations FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- sponsors
CREATE POLICY sponsors_tenant_select ON public.sponsors FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY sponsors_write ON public.sponsors FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR', 'AR_SPECIALIST', 'FINANCE_MANAGER'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR', 'AR_SPECIALIST', 'FINANCE_MANAGER'));

-- alumni_employment_reports
CREATE POLICY alumni_tenant_select ON public.alumni_employment_reports FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY alumni_registrar_write ON public.alumni_employment_reports FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'REGISTRAR'));

-- ----------------------------------------------------------------------------
-- 7. Items, Warehouses & Inventory
-- ----------------------------------------------------------------------------
-- items
CREATE POLICY items_tenant_select ON public.items FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY items_write ON public.items FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'));

-- item_groups
CREATE POLICY item_groups_tenant_select ON public.item_groups FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY item_groups_write ON public.item_groups FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'));

-- warehouse_locations
CREATE POLICY wh_tenant_select ON public.warehouse_locations FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY wh_inventory_write ON public.warehouse_locations FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- stock_items
CREATE POLICY stock_items_tenant_select ON public.stock_items FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY stock_items_inventory_write ON public.stock_items FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'));

-- inventory_classes
CREATE POLICY inv_classes_tenant_select ON public.inventory_classes FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY inv_classes_write ON public.inventory_classes FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- inventory_levels
CREATE POLICY inv_levels_tenant_select ON public.inventory_levels FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY inv_levels_write ON public.inventory_levels FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- inventory_transactions
CREATE POLICY inv_trans_tenant_select ON public.inventory_transactions FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY inv_trans_write ON public.inventory_transactions FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AP_SPECIALIST'));

-- stock_adjustments
CREATE POLICY stock_adj_tenant_select ON public.stock_adjustments FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY stock_adj_write ON public.stock_adjustments FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- reorder_points
CREATE POLICY reorder_tenant_select ON public.reorder_points FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY reorder_write ON public.reorder_points FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- opening_inventory_headers
CREATE POLICY opening_inv_h_tenant_select ON public.opening_inventory_headers FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY opening_inv_h_write ON public.opening_inventory_headers FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- opening_inventory_lines
CREATE POLICY opening_inv_l_tenant_select ON public.opening_inventory_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.opening_inventory_headers h WHERE h.id = header_id
  AND (private.erp_is_system_admin() OR h.org_id = private.erp_org_id())));

CREATE POLICY opening_inv_l_write ON public.opening_inventory_lines FOR ALL TO authenticated
USING (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.opening_inventory_headers h WHERE h.id = header_id
    AND (private.erp_is_system_admin() OR h.org_id = private.erp_org_id())))
WITH CHECK (private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT')
  AND EXISTS (SELECT 1 FROM public.opening_inventory_headers h WHERE h.id = header_id
    AND (private.erp_is_system_admin() OR h.org_id = private.erp_org_id())));

-- inventory_ledger
CREATE POLICY inv_ledger_tenant_select ON public.inventory_ledger FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY inv_ledger_write ON public.inventory_ledger FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- ----------------------------------------------------------------------------
-- 8. Payroll & Human Resources
-- ----------------------------------------------------------------------------
-- employees
CREATE POLICY employees_tenant_select ON public.employees FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY employees_write ON public.employees FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- payroll_runs
CREATE POLICY payroll_runs_tenant_select ON public.payroll_runs FOR SELECT TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'));

CREATE POLICY payroll_runs_write ON public.payroll_runs FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- payroll_lines
CREATE POLICY payroll_lines_tenant_select ON public.payroll_lines FOR SELECT TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'));

CREATE POLICY payroll_lines_write ON public.payroll_lines FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER'));

-- ----------------------------------------------------------------------------
-- 9. Tax Reference & System Tables
-- ----------------------------------------------------------------------------
-- tax_categories
CREATE POLICY tax_categories_tenant_select ON public.tax_categories FOR SELECT TO authenticated
USING (private.erp_is_system_admin() OR org_id = private.erp_org_id());

CREATE POLICY tax_categories_finance_write ON public.tax_categories FOR ALL TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'))
WITH CHECK ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'));

-- atc_categories (National BIR reference)
CREATE POLICY atc_categories_read ON public.atc_categories FOR SELECT TO authenticated
USING (true);

CREATE POLICY atc_categories_admin_write ON public.atc_categories FOR ALL TO authenticated
USING (private.erp_is_system_admin())
WITH CHECK (private.erp_is_system_admin());

-- atc_items (National BIR reference)
CREATE POLICY atc_items_read ON public.atc_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY atc_items_admin_write ON public.atc_items FOR ALL TO authenticated
USING (private.erp_is_system_admin())
WITH CHECK (private.erp_is_system_admin());

-- atc_rates (National BIR reference)
CREATE POLICY atc_rates_read ON public.atc_rates FOR SELECT TO authenticated
USING (true);

CREATE POLICY atc_rates_admin_write ON public.atc_rates FOR ALL TO authenticated
USING (private.erp_is_system_admin())
WITH CHECK (private.erp_is_system_admin());

-- audit_logs (Immutable audit trail: authenticated users can insert logs in their org, select is restricted to auditors/managers)
CREATE POLICY audit_logs_tenant_select ON public.audit_logs FOR SELECT TO authenticated
USING ((private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'AUDITOR'));

CREATE POLICY audit_logs_tenant_insert ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (private.erp_is_system_admin() OR org_id = private.erp_org_id());

-- ============================================================================
-- STEP 5: Performance Indexes on Foreign Keys and Organization IDs
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_lines_je_id ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_je_id ON public.journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_bank_deposit_lines_dep_id ON public.bank_deposit_lines(deposit_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_opening_inventory_lines_hdr ON public.opening_inventory_lines(header_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_org ON public.chart_of_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_org ON public.accounting_periods(org_id);
CREATE INDEX IF NOT EXISTS idx_batches_org ON public.batches(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON public.vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_org ON public.stock_items(org_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_org ON public.warehouse_locations(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_org ON public.payroll_runs(org_id);
