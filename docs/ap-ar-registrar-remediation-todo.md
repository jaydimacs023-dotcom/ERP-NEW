# AP, AR, and Registrar Remediation Tracker

## Purpose

This document preserves the audit findings, required remediation work, implementation decisions, and verification history for the Accounts Payable, Accounts Receivable, and Registrar modules.

Do not remove completed items. Mark them complete and add a dated entry to the implementation history with the relevant migration, files, tests, and commit or pull request reference.

## Status legend

- `[ ]` Not started
- `[x]` Completed and verified
- `BLOCKED` Waiting on a decision or dependency
- `N/A` Reviewed and determined not applicable

## Phase 0: Preparation and safeguards

- [ ] Back up the target database before applying security migrations.
- [ ] Confirm whether deployed database grants, policies, functions, and schema match `supabase/migrations/20260907000000_cloud_baseline.sql`.
- [x] Inventory all AP, AR, and Registrar tables, RLS policies, grants, RPCs, and Edge Functions.
- [x] Document the intended module and action permissions for the remediated AP Specialist, AP Supervisor, AR Specialist, and Registrar roles.
- [ ] Define maker-checker requirements for AP approval, AR posting, voiding, and reversals.
- [ ] Define the staging and production rollout/rollback procedure.

## Phase 1: Critical database security

### Anonymous access and grants

- [x] Revoke inappropriate `anon` privileges on `invoices`.
- [x] Revoke inappropriate `anon` privileges on `invoice_lines`.
- [x] Revoke inappropriate `anon` privileges on `payments`.
- [x] Revoke inappropriate `anon` privileges on `payment_applications`.
- [x] Revoke inappropriate `anon` privileges on `payables`.
- [x] Revoke inappropriate `anon` privileges on `students`.
- [x] Revoke inappropriate `anon` privileges on `enrollments`.
- [x] Revoke inappropriate `anon` privileges on `assessment_registrations`.
- [ ] Audit and remediate anonymous privileges on all related tenant-owned tables.
- [x] Grant table-level CRUD only to `authenticated`, constrained by role-aware RLS policies for the covered tables.
- [x] Restrict the unwrapped payable-posting implementation to `service_role`.

### Row-level security

- [x] Enable RLS on the eight covered tenant-owned AP, AR, and Registrar tables; related-table expansion remains part of the broader audit item above.
- [x] Remove the identified covered-table policies using unrestricted `USING (true)`.
- [x] Remove the identified covered-table policies using unrestricted `WITH CHECK (true)`.
- [x] Add tenant-isolated policies for invoices and invoice lines.
- [x] Add tenant-isolated policies for payments and payment applications.
- [x] Add tenant-isolated policies for payables.
- [x] Add tenant-isolated policies for students, enrollments, and assessments.
- [x] Standardize covered-table identity lookup on `users.auth_uid = auth.uid()` through private database helpers.
- [ ] Prevent clients from changing a record's `org_id` during updates.
- [ ] Validate that related foreign-key records belong to the same organization.
- [x] Implement explicit System Admin cross-tenant exceptions for the covered policies.

### Privileged functions

- [x] Revoke `anon` execution from `post_payable_bill`.
- [ ] Audit every `SECURITY DEFINER` function and remove unsafe grants.
- [ ] Derive the acting user from `auth.uid()` inside privileged functions.
- [x] Reject caller-supplied actor IDs for payable-bill posting when they do not match the authenticated JWT subject.
- [ ] Add explicit role/action checks to AP payment, cancellation, memo, reclassification, and reversal functions (payable-bill posting is complete).
- [ ] Add explicit role/action checks to AR posting, payment, application, void, write-off, and reversal functions.
- [ ] Give every privileged function a fixed, safe `search_path` (new payable wrapper and policy helpers are complete; legacy functions remain to audit).
- [ ] Enforce maker-checker separation where required.

## Phase 2: AP role and workflow enforcement

- [x] Define permissions for AP create, edit, delete, approve, post/pay, and cancel actions. Submit/reverse remain pending because the current UI has no independent capability for them.
- [ ] Ensure Auditor, Treasury, and executive roles remain read-only where intended.
- [x] Pass explicit capability props to `PayablesView` for create, edit, delete, approve, pay, and cancel. Reverse remains pending.
- [x] Hide or disable the covered unauthorized AP controls in the UI.
- [ ] Add authorization checks to App-level AP handlers.
- [ ] Enforce the same permissions in database policies and RPCs.
- [ ] Prevent direct modification or deletion of posted bills.
- [ ] Require reversal entries for posted accounting changes.
- [ ] Validate the accounting period before AP posting.
- [ ] Prevent AP payments from exceeding the remaining payable balance.
- [ ] Make AP payment and balance updates transactional.
- [ ] Add idempotency protection to AP posting and payment operations.
- [ ] Write AP audit records inside the same database transaction as the business operation.

## Phase 3: AR transaction integrity

### Invoice creation and posting

- [ ] Replace client-orchestrated invoice posting with a transactional database RPC.
- [ ] Validate tenant, role, invoice header, and invoice lines inside the transaction.
- [ ] Allocate invoice and GL numbers safely under concurrency.
- [ ] Create the invoice, lines, journal, links, and audit record atomically.
- [ ] Update enrollment and assessment billing state in the same transaction when applicable.
- [ ] Roll back the complete operation if any step fails.
- [ ] Add an idempotency key or equivalent duplicate-posting protection.
- [ ] Prevent accounting fields from being modified after posting.

### Invoice updates

- [ ] Replace delete-then-reinsert invoice-line synchronization.
- [ ] Update the invoice header and lines in one transaction.
- [ ] Preserve existing lines if validation or line insertion fails.
- [ ] Diff invoice lines by ID where practical.
- [ ] Lock the invoice while synchronizing its lines.
- [ ] Reject line changes for posted, closed, or voided invoices.

### Payments and applications

- [ ] Replace the multi-step payment-application flow with one transactional RPC.
- [ ] Lock the payment and invoice rows while applying a payment.
- [ ] Validate organization and customer compatibility.
- [ ] Validate available payment balance and invoice balance.
- [ ] Prevent overapplication during concurrent requests.
- [ ] Create the application and GL entry atomically.
- [ ] Update payment totals, deposit balance, invoice balance, and statuses atomically.
- [ ] Link the application and journal atomically.
- [ ] Add a unique active-application or idempotency constraint.
- [ ] Make payment-application reversal transactional.
- [ ] Ensure reversal restores all affected balances and statuses.
- [ ] Stop rewriting posted journal lines; use correction or reversal entries.

### Voids and reversals

- [ ] Require a reason and permission for every void or reversal.
- [ ] Create reversing journals instead of only changing document status.
- [ ] Prevent invoice voiding while active payment applications exist.
- [ ] Update related enrollment and assessment billing state when required.
- [ ] Prevent deletion of posted or financially linked records.

## Phase 4: Global RBAC consistency

- [ ] Create one typed module registry containing tab key, component, roles, actions, and default navigation behavior.
- [ ] Add a global permission guard for every `activeTab`.
- [ ] Redirect unauthorized tabs to the user's permitted default tab.
- [ ] Guard screen rendering rather than relying on hidden navigation.
- [ ] Guard every App-level mutation handler.
- [ ] Replace `tab as any` permission checks with typed module keys.
- [ ] Generate sidebar visibility from the same permission registry.
- [ ] Ensure `getDefaultTab()` always returns a permitted module.
- [ ] Add explicit read-only behavior for Auditor, Treasury, and executive roles.
- [ ] Reconcile the legacy `ar` umbrella permission with individual AR modules.
- [ ] Define action permissions for all AR and Registrar mutations.

## Phase 5: Registrar corrections

- [x] Add `assessment-registrations` to `ModuleTab`.
- [x] Add Assessment Registrations to the Registrar permission matrix.
- [ ] Define view, create, edit, cancel/delete, result-update, and invoice-link permissions for assessments.
- [x] Permission-guard the Assessment Registrations navigation and rendered screen.
- [x] Decide whether Registrar should have direct access to Enrollments.
- [x] Add `enrollments` to the Registrar permissions and navigation.
- [x] Limit Registrar sponsor access to view/select; financial sponsor editing remains outside Registrar ownership.
- [ ] Prevent Registrar users from changing AR-owned financial fields.
- [ ] Document ownership boundaries between Registrar and AR workflows.
- [ ] Prevent deletion of students, enrollments, or assessments linked to accounting records.
- [ ] Use cancellation or archiving for financially linked Registrar records.
- [ ] Validate student, batch, sponsor, enrollment, and assessment relationships by `org_id`.

## Phase 6: Sponsored batch billing decision

- [ ] `BLOCKED`: Decide whether sponsored batch billable limits remain an active business rule.

### If batch limits are required

- [ ] Add `FREE_EXCESS` to the TypeScript enrollment billing type.
- [ ] Restore cap enforcement in `BillingComputationService`.
- [ ] Keep SQL and TypeScript classification rules identical.
- [ ] Stop converting `FREE_EXCESS` to `BILLABLE` when editing an enrollment.
- [ ] Separate calculated `FREE_EXCESS` from manual free overrides.
- [ ] Define deterministic enrollment ordering for cap allocation.
- [ ] Recalculate classification when enrollment membership or batch limits change.
- [ ] Prevent already-billed enrollments from being silently reclassified.
- [ ] Add reconciliation reporting for enrollment classification versus invoice quantities.

### If batch limits are retired

- [ ] Remove `FREE_EXCESS` from SQL constraints and functions.
- [ ] Remove or deprecate obsolete batch-limit fields.
- [ ] Remove legacy classification RPCs.
- [ ] Migrate existing `FREE_EXCESS` records to an approved replacement.
- [ ] Update services, UI, tests, and documentation.

### Required in either case

- [ ] Align `types.ts`, SQL, UI options, services, tests, and business documentation.
- [ ] Document how manual-free and sponsored-free enrollments affect invoicing.

## Phase 7: Data-integrity constraints

- [ ] Add constraints ensuring parent and child records share the same organization.
- [ ] Add uniqueness/idempotency constraints for invoice, AP bill, payment, application, and reversal posting.
- [ ] Add appropriate non-negative amount checks.
- [ ] Prevent payment applications from exceeding available payment credit.
- [ ] Prevent invoice paid totals from exceeding permitted balances.
- [ ] Require every posted journal to balance.
- [ ] Require a valid open accounting period for posting.
- [ ] Add immutable-field triggers for posted financial documents.
- [ ] Prevent soft-deleted records from participating in new transactions.
- [ ] Review whether student ULI uniqueness should be global or tenant-scoped.

## Phase 8: Audit trail

- [ ] Move critical audit writes into the same transaction as the related business operation.
- [ ] Record the authenticated actor rather than a caller-provided identity.
- [ ] Record old and new values for material changes.
- [ ] Audit invoice creation, posting, voiding, and reversal.
- [ ] Audit payment creation, posting, voiding, application, and reversal.
- [ ] Audit AP creation, approval, payment, cancellation, memo, and reclassification.
- [ ] Audit enrollment billing-type and assessment billing-link changes.
- [ ] Prevent client modification or deletion of audit records.
- [ ] Add correlation IDs connecting documents, journals, and audit events.

## Phase 9: Tests

### Authorization and tenant isolation

- [ ] Verify anonymous users cannot read or mutate scoped records.
- [ ] Verify authenticated users cannot access another organization's records.
- [ ] Verify Registrar cannot mutate AP or AR financial records.
- [ ] Verify AR Specialist cannot approve AP bills.
- [ ] Verify AP Clerk cannot approve or post bills.
- [ ] Verify AP Supervisor permissions match the approved matrix.
- [ ] Verify Auditor cannot create, update, delete, post, void, or reverse.
- [ ] Verify System Admin behavior matches the approved cross-tenant policy.
- [ ] Verify RPC actor spoofing is rejected.

### Accounting transactions

- [ ] Verify failed invoice-line creation leaves no invoice or journal.
- [ ] Verify failed journal creation leaves no posted invoice.
- [ ] Verify failed payment application leaves payment and invoice unchanged.
- [ ] Verify concurrent applications cannot overapply a payment.
- [ ] Verify repeated posting requests do not create duplicate journals.
- [ ] Verify application reversal restores every affected balance.
- [ ] Verify failed draft-invoice updates preserve existing lines.

### UI and regression tests

- [x] Fix the nine failing `InvoicesView` tests with accessible field queries, deterministic service mocks, and corrected VAT expectations.
- [ ] Test navigation visibility for every relevant role.
- [ ] Test unauthorized direct-tab navigation.
- [ ] Test AP action buttons for read-only, clerk, specialist, and supervisor roles.
- [ ] Test AR create, post, application, void, and reversal permissions.
- [ ] Test Registrar enrollment and assessment permissions.
- [ ] Add sponsored batch-cap tests after the business decision.

## Phase 10: Performance and maintainability

- [ ] Split `App.tsx` orchestration into domain-focused controllers or hooks.
- [ ] Lazy-load major AP, AR, Registrar, Inventory, and Admin screens.
- [ ] Remove mixed static/dynamic imports that prevent effective code splitting.
- [ ] Move spreadsheet dependencies into import-only chunks.
- [ ] Establish and enforce a JavaScript bundle budget in CI.
- [ ] Review and remove obsolete `.broken` and `.backup` source files.
- [ ] Consolidate duplicated root and `src/` implementations.
- [ ] Replace generic entity writes in financial workflows with typed transactional service methods.
- [ ] Keep `IDataService` aligned with new RPC and transaction contracts.

## Completion criteria

- [ ] No AP, AR, Registrar, or student table is anonymously readable or writable.
- [ ] Every tenant-owned table has verified RLS.
- [ ] Every privileged operation derives identity from the authenticated session.
- [ ] AP and AR posting workflows are atomic and idempotent.
- [ ] Client and database action permissions agree.
- [ ] Sponsored batch billing has one implemented and documented policy.
- [ ] All focused and regression tests pass.
- [ ] Cross-tenant, role-matrix, concurrency, rollback, and idempotency tests pass in CI.
- [ ] Production build passes within the agreed bundle budget.
- [ ] Security migrations have been validated in staging before production rollout.

## Known audit baseline

Recorded on 2026-09-19:

- Production build passed.
- Focused test run: 26 tests passed and 9 `InvoicesView` tests failed.
- The invoice failures combined ambiguous element queries, asynchronous tax-category loading, stale formatting expectations, and an exclusive-VAT calculation defect.
- Anonymous grants and permissive RLS policies were present in the cloud baseline.
- `post_payable_bill` was executable by `anon` and trusted a caller-supplied actor ID.
- Invoice posting and payment application workflows were not atomic.
- `PayablesView` exposed mutations without explicit action-capability props.
- Assessment Registrations was present in Registrar navigation but absent from the central module permission type/matrix.
- Sponsored batch-cap behavior conflicted between SQL, TypeScript, tests, and documentation.
- Local database lint reports pre-existing errors in `billing_classify_batch_cap` (ambiguous `billable_qty`) and `post_journal_voucher` (missing `journal_entries.posted_by`), plus warnings in `get_next_check_number` and `post_payable_payment`.
- The legacy browser-generated JWT was not a Supabase Auth session. It has been removed from the active production login path; mock mode retains it temporarily and should be isolated or removed before the final security closeout.
- Supabase Auth is now the active production login/session path and PostgREST sends its access token by default. All 13 Edge Functions have been converted to `authenticateErpRequest` for primary Supabase Auth token validation with legacy HS256 fallback support.

## Decision log

Add decisions here before implementing behavior that affects accounting or access control.

| Date | Decision | Reason | Approved by | Related issue/PR |
|---|---|---|---|---|
| YYYY-MM-DD | Example: retain sponsored batch limits | Business justification | Name/role | Reference |
| 2026-09-19 | Registrar receives direct Enrollments and Assessment Registrations access; Sponsors are view/select only | Registrar owns learner registration while AR retains financial sponsor mutation | User instruction to implement audit remediation | Working tree |
| 2026-09-19 | Standardize all Edge Functions on `authenticateErpRequest` with graceful HS256 fallback | Seamless support for active Supabase Auth sessions while preventing regressions in legacy/mock environments | User instruction to implement audit remediation | Working tree |

## Implementation history

Add one row for every material change. Do not rewrite old entries.

| Date | Phase/item | Change summary | Files/migrations | Tests and result | Commit/PR | Implemented by |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | Phase 1 / RLS | Example entry | `supabase/migrations/...sql` | Policy tests passed | Reference | Name |
| 2026-09-19 | Phases 2, 4, 5 / RBAC | Added typed assessment module access, Registrar navigation guards, explicit AP/AR/Registrar action permissions, and AP capability enforcement | `config/permissions.ts`, `App.tsx`, `views/PayablesView.tsx` | Permission and Payables focused tests passed | Working tree | Codex |
| 2026-09-19 | Phase 9 / Invoice regression | Added accessible line controls, fixed exclusive/inclusive VAT treatment, isolated service calls, and repaired nine invoice tests | `views/InvoicesView.tsx`, `tests/InvoicesView.test.tsx` | 9/9 invoice tests passed | Working tree | Codex |
| 2026-09-19 | Phase 1 / Security migrations | Applied least-privilege grants and tenant/role RLS locally; added a forward-only actor-verifying payable-posting wrapper | `supabase/migrations/20260919081725_secure_ap_ar_registrar_access.sql`, `supabase/migrations/20260919110216_secure_post_payable_actor.sql` | Both migrations applied locally; DB lint completed with unrelated legacy errors recorded above | Working tree | Codex |
| 2026-09-19 | Phase 1 / Supabase Auth | Replaced production browser-signed login tokens with Supabase Auth access/refresh sessions, linked ERP profiles by `auth_uid`, changed policy helpers to server-maintained user records, and secured user-profile reads | `services/AuthService.ts`, `services/TokenManager.ts`, `services/SupabaseDataService.ts`, `supabase/migrations/20260919110930_use_auth_uid_for_erp_rls.sql`, `tests/AuthService.test.ts` | Migration applied locally; 3/3 authentication tests passed; production build passed | Working tree | Codex |
| 2026-09-19 | Phase 1 / Edge Functions Auth | Standardized all 13 Edge Functions on `authenticateErpRequest` with primary Supabase Auth session validation and fallback HS256 token verification; removed dead JWT verifiers | `supabase/functions/_shared/erp-auth.ts`, `supabase/functions/*/index.ts` | Full focused test suite and production build passed | Working tree | Antigravity |

## Rollout history

| Date | Environment | Migration/version | Result | Rollback required | Notes |
|---|---|---|---|---|---|
| YYYY-MM-DD | Staging/Production | Reference | Pending | No | Notes |
| 2026-09-19 | Local | `20260919081725`, `20260919110216` | Applied | No | Staging/production deployment intentionally not performed; authentication dependency remains open |
| 2026-09-19 | Local | `20260919110930` | Applied | No | Supabase Auth identity lookup active; existing ERP users still require linked Auth accounts before rollout |

