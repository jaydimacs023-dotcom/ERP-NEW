# Accounts Receivable Audit Remediation TODO

Current working directory: `e:/laragon/www/AT-ERP`

## Goal

Make the AR module audit-ready by enforcing accounting integrity, improving revenue recognition, strengthening internal controls, and making reports reliable under real-world billing and collection scenarios.

## Critical - Must Fix First

### 1. Build a Server-Side AR Posting Layer

- [ ] Create a database RPC or edge function for invoice posting, for example `post_ar_invoice(invoice_id, actor_user_id)`.
- [ ] Move invoice posting out of client-only logic in `App.tsx`.
- [ ] The posting function must run in one transaction:
  - validate invoice status is draft/on hold
  - validate invoice lines and tax setup
  - generate the GL reference
  - create journal entry header
  - create journal lines
  - verify debit total equals credit total
  - mark invoice as posted/open
  - write audit log
- [ ] Return the posted journal entry ID and GL reference to the app.
- [ ] Block direct posting if no open/soft-open accounting period exists.

### 2. Enforce Double-Entry Integrity

- [ ] Add database validation that posted journal entries must balance.
- [ ] Prevent journal entries from being marked `POSTED` unless total debits equal total credits.
- [ ] Add a server-side helper to calculate journal totals before posting.
- [ ] Add tests for balanced and unbalanced journal posting.
- [ ] Review all calls to `handlePostJournal` in `App.tsx`.

### 3. Lock Posted Invoices

- [ ] Add database-level protection so posted/open/closed/voided invoices cannot have accounting fields or lines edited.
- [ ] Allow only approved fields after posting, such as notes that do not affect accounting, if required.
- [ ] Prevent `SupabaseDataService.updateInvoice()` from replacing lines on posted invoices.
- [ ] Prevent `deleteInvoice()` for posted invoices; require void/reversal instead.
- [ ] Add tests for attempted edits after posting.

### 4. Fix Invoice Line Persistence

- [ ] Update Supabase schema/service allowlist for `invoice_lines`.
- [ ] Persist:
  - `org_id`
  - `net_amount`
  - `gross_amount`
  - `classification_code`
  - `tax_category_id`
  - `gl_account_id`
- [ ] Backfill missing net/gross values from existing invoice data where possible.
- [ ] Make invoice GL posting use persisted `net_amount`, not fallback gross `amount`.
- [ ] Add regression test for VAT-exclusive and VAT-inclusive invoice posting.

### 5. Replace Client-Side Invoice Number Generation

- [ ] Create a database function such as `get_next_invoice_no(p_org_id uuid)`.
- [ ] Add a unique constraint on `(org_id, invoice_no)`.
- [ ] Replace `generateInvoiceNo()` in `views/InvoicesView.tsx`.
- [ ] Ensure failed drafts do not consume a posted invoice number unless the business requires gapless control.
- [ ] Document numbering policy: no duplicates, explain whether gaps are allowed for drafts/voids.

## Important - Accounting and Control Improvements

### 6. Integrate Deferred Revenue With Invoicing

- [ ] Add invoice line revenue treatment:
  - immediate revenue
  - deferred revenue
  - milestone/percentage completion
- [ ] Add deferred revenue account mapping per item/course fee.
- [ ] If deferred, invoice posting should create:
  - Dr Accounts Receivable
  - Cr Deferred Revenue
  - Cr Output VAT, if applicable
- [ ] Link revenue schedules to invoice/invoice line IDs.
- [ ] Prevent duplicate manual schedules for the same deferred invoice line.

### 7. Correct Revenue Recognition Posting

- [ ] Update `RevenueRecognitionService.generateJournalEntry()` to produce entries that are posted through the same server-side GL posting layer.
- [ ] When recognition succeeds, update recognition entry:
  - `status = POSTED`
  - `journalEntryId`
  - `postedDate`
  - `postedBy`
- [ ] If GL posting fails, do not update the schedule recognized amount.
- [ ] Add reversal flow for posted recognition entries.

### 8. Make Payment Posting Atomic

- [ ] Create server-side payment posting function.
- [ ] One transaction should:
  - validate payment status
  - create GL entry
  - update payment status
  - write audit log
- [ ] Keep current accounting pattern if intended:
  - Dr Cash/Bank
  - Dr CWT/EWT Receivable, if applicable
  - Cr Customer Deposits
- [ ] Add tests for cash, bank transfer, check, and EWT payments.

### 9. Make Payment Application Atomic

- [ ] Create server-side function for payment application.
- [ ] In one transaction:
  - validate payment has available balance
  - validate invoice is open
  - insert payment application
  - create GL entry: Dr Customer Deposits, Cr AR
  - update payment totals
  - update invoice paid/balance/status
  - write audit log
- [ ] Remove client-side multi-step application persistence.
- [ ] Add concurrency test for duplicate application attempts.

### 10. Fix Voids and Reversals

- [ ] Invoice void must persist a reversal journal entry, not only update local state.
- [ ] Payment void must reverse payment GL and undo unapplied/applied balances correctly.
- [ ] Payment application reversal must be transactional.
- [ ] Use a consistent reversal source type and original-entry linkage.
- [ ] Require reason and actor for all voids/reversals.

### 11. Improve Aging Accuracy

- [ ] Move aging from GL-line bucketing to invoice open-item aging.
- [ ] Age unpaid invoice balances from invoice due date or invoice date, based on policy.
- [ ] Apply payments to invoices explicitly and reduce the related invoice balance.
- [ ] Keep credit memos/write-offs tied to invoice balances when possible.
- [ ] Add test cases:
  - partial payment
  - overpayment
  - credit memo
  - write-off
  - payment reversal

### 12. Add Customer Credit Controls

- [ ] Extend customer/sponsor/student debtor profile with:
  - payment terms days
  - credit limit
  - credit hold flag
  - risk rating
  - collector/owner
- [ ] Block invoice approval/posting if credit limit would be exceeded.
- [ ] Allow finance manager override with audit reason.
- [ ] Add customer aging summary to customer profile.

### 13. Strengthen Segregation of Duties

- [ ] Define workflow permissions separately from module access:
  - create invoice
  - approve invoice
  - post invoice
  - receive payment
  - apply payment
  - reverse/void
  - write off
- [ ] Prevent the same user from creating and approving/posting the same invoice unless explicitly overridden.
- [ ] Prevent AR specialist from posting write-offs without approval.
- [ ] Make auditor role read-only at action-handler/API level, not just navigation.

## Enhancements - Next Phase

### 14. Customer Master Data Expansion

- [ ] Add multiple addresses per customer.
- [ ] Add multiple contacts per customer with roles:
  - billing
  - collections
  - finance approver
  - general contact
- [ ] Add customer classification/segment.
- [ ] Add tax profile validation, including TIN requirements.

### 15. Collections Workflow

- [ ] Add collection status per invoice:
  - current
  - follow-up
  - promised to pay
  - disputed
  - escalated
  - legal/write-off review
- [ ] Add dunning letter/email templates.
- [ ] Track collection notes and next follow-up date.
- [ ] Add collector dashboard.

### 16. Penalties and Interest

- [ ] Add overdue penalty/interest settings.
- [ ] Generate penalty debit memos from overdue invoices.
- [ ] Support waiver approval and audit trail.

### 17. Multi-Currency Support

- [ ] Add currency and exchange rate to invoices and payments.
- [ ] Store functional currency amounts separately from transaction currency amounts.
- [ ] Add realized FX gain/loss on settlement.
- [ ] Add AR revaluation process for open foreign currency balances.

### 18. Reporting Improvements

- [ ] Add AR subledger-to-GL reconciliation report.
- [ ] Add unapplied cash report.
- [ ] Add invoice status exception report.
- [ ] Add posted document edit/void audit report.
- [ ] Add deferred revenue roll-forward report.

## Suggested Implementation Order

1. Fix invoice line persistence.
2. Add journal balance validation.
3. Add server-side invoice number generation.
4. Build server-side invoice posting.
5. Lock posted invoices at service/database level.
6. Build atomic payment posting.
7. Build atomic payment application.
8. Fix void/reversal persistence.
9. Rebuild aging on invoice open items.
10. Integrate deferred revenue and revenue recognition.
11. Add credit controls.
12. Add segregation-of-duties enforcement.

## Acceptance Criteria

- [ ] No posted AR document can be edited without reversal.
- [ ] No posted journal can be unbalanced.
- [ ] Invoice numbers cannot duplicate within an organization.
- [ ] Posting invoice/payment/application is atomic.
- [ ] AR aging agrees to customer ledger and GL AR balance.
- [ ] Deferred revenue is recognized only through approved schedules.
- [ ] Voids and reversals always create traceable accounting entries.
- [ ] Audit logs identify actor, timestamp, action, document, old value, new value, and reason where applicable.
