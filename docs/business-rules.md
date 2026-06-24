# Business Rules

## Tenant And Access Rules
- Every normal user works inside an organization identified by `orgId`.
- `SYSTEM_ADMIN` can access system-wide tenant, maintenance, schema, payment-monitoring, and feedback areas.
- `ADMIN` and `PRESIDENT` are tenant admin roles.
- Finance roles include `FINANCE_MANAGER`, `ACCOUNTANT`, `AR_SPECIALIST`, `AP_SPECIALIST`, `AP_CLERK`, `AP_SUPERVISOR`, `TREASURY`, and `AUDITOR`.
- Registrar users focus on training operations and are isolated from financial GL modules by role permissions.
- Student users land on the student portal and should be linked to a student record.
- Trainer users land on the trainer portal and should be linked to a trainer record.
- Users created through `users-write` must have a valid role; trainer/student roles require valid linked records in the same organization.

## Subscription And Tenant Rules
- Organizations carry subscription status: `ACTIVE`, `TRIAL`, `SUSPENDED`, `EXPIRED`, or `PENDING`.
- Plan type is `BASIC`, `PROFESSIONAL`, or `ENTERPRISE`.
- Payment reference and pending plan fields support manual subscription confirmation flows.
- Institution type is `TRAINING`, `ACADEMIC`, or `HYBRID`.
- System admins can create/delete tenants; system admins and same-org admins can update eligible organization details.

## Accounting Rules
- Journal entries have statuses including `DRAFT`, `ON_HOLD`, `POSTED`, `REVERSED`, and `REVISION_REQUESTED` in TypeScript/UI. The SQL dump enforces `DRAFT`, `POSTED`, `REVERSED`, and `REVISION_REQUESTED`.
- Posted journal entries are used for financial reports and ledger summaries.
- Journal lines must be balanced before a journal is posted.
- Journal entries carry `sourceType` and source reference information for invoices, bills, payments, collections, payroll, inventory, reversals, deposits, and manual entries.
- Reversal creates a reversing journal entry instead of mutating the original posted accounting effect.
- Chart of accounts uses account class and normal balance to compute signs and financial statement placement.

## Accounting Period Rules
- Accounting periods support `OPEN`, `SOFT_CLOSE`, `HARD_CLOSE`, and `LOCKED`.
- AP, AR, and GL can be closed separately.
- Lock metadata records who locked a period and when.
- Period close views use payables, journal entries, accounts, and user context to drive close/lock operations.

## Accounts Receivable Rules
- Invoices can bill either a sponsor or an individual student.
- Invoices may link to enrollments, batches, and assessment registrations.
- Invoice statuses include `DRAFT`, `ON_HOLD`, `OPEN`, `CLOSED`, and `VOIDED` in the UI model.
- Invoice totals track subtotal, VAT, grand total, EWT, net amount due, amount paid, and balance due.
- Invoice line types are `COURSE_FEE`, `DISCOUNT`, `ADJUSTMENT`, and `MANUAL`.
- Posted/accounting-locked invoices and invoice lines should not be edited in ways that change accounting.
- Voiding an invoice records void user, time, and reason.
- The app can backfill or reconcile invoice journal links by matching related journal entries.
- VAT pricing supports inclusive behavior and a default 12 percent VAT rate.
- EWT can reduce receivable through total EWT amount and payment-certified EWT fields.

## Payment And Collection Rules
- Payments record amount received, EWT certified, total applied, and customer deposit balance.
- Payment methods include `CASH`, `CHECK`, `BANK_TRANSFER`, `CREDIT_CARD`, `EWALLET`, and `OFFSET`.
- UI logic treats `OPEN`, `POSTED`, and `CLOSED` as finalized-like payment states, while persistence may normalize `OPEN` and `CLOSED` to `POSTED`.
- A payment application links a payment to an invoice and must have a positive applied amount.
- Customer deposit balance is the unapplied remainder of amount received plus EWT certified minus total applied.
- Invoice status is recalculated from balance/payment state unless the invoice is voided.
- Payment applications can be reversed with reason, user, and timestamp.
- Payment and payment-application numbering uses RPC helpers when available.

## Bank Deposit And Treasury Rules
- Bank deposits group AR payments into a bank account deposit.
- Deposit statuses are `DRAFT`, `POSTED`, and `VOIDED`.
- Posted deposits can link to journal entries.
- Voids record void user, timestamp, and reason.
- Bank reconciliations track in-progress, reconciled, and locked states.
- Check vouchers track draft, printed, released, cleared, voided, and stale states.

## Accounts Payable Rules
- Payables require vendor, category, description, amount, bill date, due date, currency, creator, and status.
- Payable statuses are `for_approval`, `approved`, `paid`, `partially_paid`, and `cancelled`.
- AP categories include utilities, supplies, training materials, contractor services, assessments, insurance, government obligations, scholarship advances, employee reimbursements, general/other.
- Payables can carry withholding type, ATC item/rate, applied percentage, withholding amount, and net payable.
- Approval and payment metadata records users and timestamps.
- Vendors can be active, blocked, or archived.
- Vendors with outstanding balances are protected from deletion in the view logic.

## Procurement And Receiving Rules
- Purchase orders move through `DRAFT`, `SENT`, `APPROVED`, `RECEIVED`, and `CANCELLED`.
- Approved POs record approver and approval timestamp.
- Goods receipts move through `DRAFT`, `POSTED`, and `CANCELLED`.
- Three-way matching compares purchase order, goods receipt, and invoice/payable data.
- Matching classifies discrepancies across line items, amounts, and dates, then determines an overall result.

## Training And Enrollment Rules
- Batches belong to a qualification, trainer, organization, and optionally sponsor/location.
- Batch statuses are `PLANNED`, `ONGOING`, `COMPLETED`, and `CANCELLED`.
- Batch capacity tracks max students and current students.
- Sponsored batches may have a billable student limit.
- Enrollments link a student to a batch and optional sponsor.
- Enrollment statuses are `ACTIVE`, `DROPPED`, `COMPLETED`, and `ON_HOLD`.
- Enrollment billing statuses are `UNBILLED`, `BILLED`, and `PARTIALLY_BILLED`.
- Enrollment billing types are `BILLABLE`, `FREE_SPONSORED`, and `MANUAL_FREE` in TypeScript, with SQL also showing legacy `FREE_EXCESS`.
- Billing computation sorts enrollments and can mark excess sponsored enrollments as free according to batch billing limits.

## Assessment Rules
- Assessment registration statuses are `PENDING`, `BILLED`, `PAID`, `ASSESSED`, `COMPLETED`, `COMPETENT`, `NOT_YET_COMPETENT`, and `CANCELLED`.
- Assessment billing party is `SELF` or `SPONSOR`.
- Assessment types are `FULL_ASSESSMENT`, `REASSESSMENT`, `COC`, and `RPL`.
- Assessment date may be null.
- App logic can auto-mark due non-result assessment registrations as `COMPLETED` when the assessment date has arrived and the status is not already a result/locked status.
- Assessment registrations can link to invoices and invoice lines.

## Student Document Rules
- Student document status values are `PENDING`, `UPLOADED`, `VERIFIED`, and `REJECTED`.
- Required compliance documents are normalized through `StudentDocumentService`.
- Profile photo, TOR, birth certificate, and application form are handled as canonical document types.
- Compliance percentage is based on uploaded/verified required documents.
- Student document arrays are normalized before persistence and after retrieval.

## Inventory Rules
- Stock items belong to an organization and a warehouse location.
- Valuation methods include `FIFO`, `LIFO`, `WEIGHTED_AVERAGE`, and `STANDARD_COST`.
- Inventory transaction types include purchase, sale, adjustment, transfer, return, damage, and writeoff.
- Inventory levels track on hand, reserved, and available quantities per stock item/location.
- Reorder points define minimum stock and reorder quantity.
- Stock adjustments track approval metadata and can generate GL entries.
- Inventory GL posting should preserve stock movement, account, and journal link consistency.

## Revenue Recognition Rules
- Revenue schedules support straight-line, percentage-of-completion, and point-in-time recognition.
- Recognition periods include daily, weekly, monthly, and quarterly.
- Schedule statuses are `ACTIVE`, `PAUSED`, `COMPLETED`, and `CANCELLED`.
- Recognition entries move through `PENDING`, `POSTED`, and `REVERSED`.
- Posted recognition entries link to journal entries.

## Payroll And HR Rules
- Payroll runs are `DRAFT` or `POSTED`.
- Payroll lines track gross pay, statutory deductions, other deductions, and net pay.
- Payroll services include tax, SSS, PhilHealth, Pag-IBIG, overtime, attendance, leave, 13th month, separation pay, and BIR reporting models.
- Leave statuses include `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, and `TAKEN`.
- Attendance statuses include present, absent, half-day, on-leave, holiday, and rest-day states.

## Audit, Archive, And Backup Rules
- Audit logs record entity type, entity ID/name, action, details, and before/after-style changes where available.
- Archive/restore/permanent-delete behavior is exposed through generic data service methods.
- Backup/restore packages include versioning, data version, record counts, organization filtering, and checksum validation.

## Reporting Rules
- Financial reports use posted journal entries and journal lines.
- AR reports use invoice/payment status, dates, customer, sponsor/student, and balances.
- Inventory reports use stock items, levels, transactions, and related GL lines.
- Dashboards and reports generally filter by current organization and exclude soft-deleted rows.
