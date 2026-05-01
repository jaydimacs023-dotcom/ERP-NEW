# 🧾 AT-ERP Accounts Receivable (AR) — Deep Audit & Gap Analysis Report

**Prepared by:** Dual-role Audit (Senior Accountant CPA + Senior Software Engineer)  
**Scope:** Accounts Receivable Module  
**System:** AccountTech ERP (React + TypeScript + Supabase)  
**Date:** Auto-Generated

---

## 🧾 EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Overall AR System Score** | **4.2 / 10** |
| **Critical Issues** | 14 |
| **Major Risks** | 9 |
| **Missing Core ERP Features** | 12 |
| **Architecture Anti-patterns** | 7 |

> **Verdict:** The system has working UI scaffolding for basic AR operations (create invoice, record payment, apply payment, view aging), but it is **NOT production-ready** as a compliant ERP AR module. The gaps span fundamental accounting principles (accrual integrity, GL control account reconciliation, automated revenue recognition), internal controls (no segregation of duties, no fraud prevention), and software engineering rigor (no atomic transactions, no event sourcing, massive service classes). At scale or under audit, this system will fail catastrophically.

---

## ❌ CRITICAL ISSUES (MUST FIX)

### CI-001: No Atomic (All-or-Nothing) Transactions for Invoice-to-Payment Flow
- **Problem:** The payment application flow performs multiple independent HTTP calls to Supabase: (1) create payment, (2) create payment_applications, (3) update invoice amount_paid / balance_due, (4) create journal entry + lines. If step 3 or 4 fails after step 1 succeeds, the database is left inconsistent (payment exists but invoice not updated, or GL not posted).
- **Why it matters (Accounting + Tech):** This violates the fundamental accounting principle that every transaction must have equal debits and credits. If the GL journal fails but the payment is saved, your cash account doesn't reflect reality. Under audit, this is a **material weakness**.
- **Suggested Fix:** Implement database-level transactions using Supabase RPC functions with `BEGIN TRANSACTION; ... COMMIT;`. Wrap the entire flow in an edge function that uses `supabase.rpc()` or raw SQL transactions.

### CI-002: No Automated Double-Entry Posting from AR to GL
- **Problem:** When an invoice is created or a payment is applied, there is NO automatic generation of balanced journal entries. The `accountingService.ts` only manages numbers for reports; it does not enforce double-entry bookkeeping. Invoice creation and payment recording appear to be independent of the GL.
- **Why it matters:** In accrual accounting, every AR transaction MUST hit the General Ledger. The system currently allows invoices and payments to exist without any GL audit trail — this is a **complete accounting system failure**.
- **Suggested Fix:** On every invoice creation → auto-post: Debit AR Control, Credit Revenue (+ Output VAT if applicable). On payment receipt → auto-post: Debit Cash, Credit AR Control. Use the same atomic RPC transaction as CI-001.

### CI-003: No GL Control Account Reconciliation for AR
- **Problem:** The `ARAgingReportView` computes balances directly from journal lines, and `ARView` computes from invoices. There is no periodic reconciliation mechanism that validates: `Sum(Invoice Balances) == GL AR Control Account Balance`.
- **Why it matters:** This is an essential internal control. Without it, journal entry errors, unauthorized adjustments, or system bugs can go undetected indefinitely. The aging report might show ₱500K outstanding while the GL shows ₱450K.
- **Suggested Fix:** Build an AR-to-GL reconciliation view that compares `SUM(invoice.balance_due)` against `SUM(journal_lines.debit - journal_lines.credit WHERE account_id = ar_control_account_id)` and flags variances.

### CI-004: No Numerical Validation on Payment Application Amounts
- **Problem:** `PaymentsView.tsx` allows manual entry of applied amounts without real-time validation against `invoice.balance_due`. A user can apply ₱10,000 to an invoice with only ₱5,000 balance. There is no validation that `total_applied ≤ amount_received` or `amount_applied ≤ balance_due`.
- **Why it matters:** This allows overpayment application, negative applications, duplicate applications, and completely breaks the AR subledger accuracy. Fraud scenario: apply payment to wrong invoice, then create credit memo for self.
- **Suggested Fix:** Implement server-side validation in a PostgreSQL `BEFORE INSERT/UPDATE` trigger on `payment_applications` that enforces: `amount_applied ≤ invoice.balance_due` AND `total_applied ≤ payment.amount_received`.

### CI-005: Invoice Status Updates Are Manual, Not Event-Driven
- **Problem:** Invoice `status` field is updated manually in the UI (e.g., "POSTING" an invoice). There is no automated state machine. A payment can be received against an invoice with status `DRAFT`, or a fully paid invoice might remain `OPEN` if the status wasn't manually changed.
- **Why it matters:** Revenue recognition depends on proper invoice status lifecycle. Auditors will flag unposted invoices with payments applied as a **control deficiency**. It also enables revenue manipulation (keep invoice in DRAFT to defer revenue).
- **Suggested Fix:** Implement an event-driven status machine: `DRAFT → POSTED (on approval) → PARTIAL (on partial payment) → PAID (on full payment) → OVERPAID (on excess) → VOID/CANCELLED`. Status should update automatically via database triggers, never by UI.

### CI-006: Missing EWT (Expanded Withholding Tax) Handling for AR Collections
- **Problem:** The `invoices` table has `ewt_rate`, `total_ewt_amount`, and net amounts, but `payments` has `ewt_amount_certified` with no clear GL posting mechanism for withholding taxes receivable/payable. When EWT is applied, there is no automatic creation of a "Withholding Tax Receivable" or "Creditable Withholding Tax" journal line.
- **Why it matters:** Philippine tax compliance requires accurate EWT tracking. If a sponsor deducts 2% EWT, the company should debit EWT Receivable and credit AR (not just Cash). Missing this creates tax underreporting.
- **Suggested Fix:** When a payment includes EWT, the auto-generated journal entry should be: Debit Cash (net), Debit EWT Receivable (deducted amount), Credit AR Control (gross). Build an EWT certificate tracking module.

### CI-007: Write-Offs Do Not Auto-Post to Bad Debt Expense
- **Problem:** The `ARWriteOffView` (if implemented) only updates invoice status/balance but doesn't create a journal entry debiting Bad Debt Expense and crediting AR Control Account. The `RecurringJournalEntryService` exists but there is no tie-in.
- **Why it matters:** A write-off is a realized loss. Without the GL entry, the expense is invisible in P&L and AR remains overstated. This is a material misstatement.
- **Suggested Fix:** On write-off approval, atomically create: (1) journal entry: Debit Bad Debt Expense, Credit AR Control Account; (2) invoice update: remaining balance = 0; status = WRITTEN_OFF; (3) audit log entry.

### CI-008: Duplicate Payment Detection Is Non-Existent
- **Problem:** There is no mechanism to detect duplicate payments (same `amount_received`, same `student_id` or `sponsor_id`, same `payment_date`). A malicious or accidental duplicate submission creates phantom cash.
- **Why it matters:** Fraud scenario: a clerk records payment twice, applies to two different invoices, then creates a fake refund on one. Without duplicate detection, this is trivial.
- **Suggested Fix:** Add a unique constraint or a warning trigger: `(org_id, student_id/sponsor_id, amount_received, payment_date, payment_method)` with tolerance for exact duplicates. Require manager approval for same-day duplicates above a threshold.

### CI-009: No Proper Overpayment / Customer Deposit Handling
- **Problem:** The `payments` table has `customer_deposit_balance` but there is no liability account tracking. When a payment exceeds invoice balances, the excess is not automatically posted to "Customer Deposits" (a liability).
- **Why it matters:** Unapplied overpayments are liabilities, not revenue. Keeping them in the AR 
