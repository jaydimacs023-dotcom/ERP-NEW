# Inventory Usability and Accounting Controls TODO

## Objective

Make the Inventory module easier for warehouse and operations users while preserving double-entry accounting, inventory valuation, auditability, tenant isolation, and posted-document immutability.

Users should record the physical event that occurred. The Inventory posting engine should determine the signed quantity movement, valuation, inventory transaction, and balanced General Ledger entry.

---

## Scope Guardrails

- [x] Limit implementation to the active Inventory files:
  - `views/InventoryView.tsx`
  - `views/StockItemsView.tsx`
  - `views/StockAdjustmentsView.tsx`
  - `views/OpeningInventoryView.tsx`
  - `views/InventoryTransactionsView.tsx`
  - `views/InventoryClassesView.tsx`
  - `views/WarehouseLocationsView.tsx`
  - `views/AdvancedInventoryReports.tsx`
  - `services/InventoryService.ts`
  - `services/InventoryGLService.ts`
  - `services/InventoryReportingService.ts`
  - inventory-specific methods in `services/IDataService.ts` and `services/SupabaseDataService.ts`
  - `supabase/functions/stock-adjustments-write/`
  - `supabase/functions/stock-items-write/`
  - `supabase/functions/warehouse-locations-write/`
  - `supabase/functions/inventory-accounting/`
  - new Inventory-only migrations in `supabase/migrations/`
  - Inventory tests in `tests/`
- [x] Do not change the logic or behavior of Accounting, AR, AP, Purchasing, Payroll, Training, Student, Trainer, Subscription, Backup, or Administration modules.
- [x] Do not rename existing functions, callbacks, variables, types, tab keys, database tables, or columns.
- [x] Preserve existing component props and service method signatures. Add optional Inventory-only props or methods only when required.
- [x] Do not modify shared accounting posting behavior. Inventory must continue to create standard balanced journal entries through its Inventory posting engine.
- [x] Do not change `App.tsx` routing, global state, or handlers unless a later Inventory task cannot be connected through the existing callbacks. Any permitted change must be limited to Inventory prop wiring and must preserve every existing name and behavior.
- [x] Keep root-level `views/` and `services/` as the active implementation paths. Do not move work into duplicated files under `src/`.
- [x] Keep all reads and writes explicitly scoped by `orgId`.
- [x] Do not add a package unless the existing React, TypeScript, Tailwind, Lucide, Vitest, and Supabase stack cannot support the requirement.

---

## Non-Negotiable Accounting Rules

- [x] Inventory quantity, ledger value, inventory transaction, stock level, and journal entry must post atomically.
- [x] Every posted journal entry must have equal total debits and credits.
- [x] Block posting when the stock item has no active Inventory Class or required GL mapping.
- [x] Block a stock decrease that would produce negative quantity on hand.
- [x] Calculate issue and write-off cost on the server using the configured valuation method; do not trust a user-entered cost for outbound stock.
- [x] Resolve the accounting period from the posting date and block posting to locked or hard-closed periods.
- [x] Posted adjustments and inventory transactions must remain immutable.
- [x] Correct posted records only through linked reversal transactions.
- [x] Preserve the original cost basis when reversing a posted transaction.
- [x] Store the actor, posting timestamp, source document, source module, and journal-entry link for every posted movement.
- [x] Do not allow Inventory UI validation to replace server-side validation.

---

## Phase 1 — Clarify the Existing Experience

### 1. Use Plain Operational Language

- [x] Rename display labels only; preserve component, function, variable, and tab-key names.
- [x] Change technical dashboard copy such as “surveillance,” “nodes,” and “warehouse clusters” to familiar warehouse language.
- [x] Use consistent terms: `On Hand`, `Reserved`, `Available`, `Reorder Point`, and `Safety Stock`.
- [x] Add short help text explaining the difference between on-hand and available stock.
- [x] Replace unclear button text such as `Commit Adjustment` with `Review and Post` without renaming the submit handler.
- [x] Fix visible encoding artifacts such as `â€”`, `â€™`, and `â€¦` in Inventory screens only.

### 2. Make Actions Discoverable

- [x] Keep row actions visible instead of revealing them only on hover.
- [x] Ensure row actions remain usable on touch devices and narrow screens.
- [x] Add text labels or accessible tooltips to icon-only actions.
- [x] Provide clear loading, success, empty, and failure states for every Inventory action.
- [x] Preserve the user's search and filter selections after a failed action.

### 3. Improve Search and Selection

- [x] Provide searchable item selection by item code, name, barcode, and unit of measure.
- [x] Provide searchable warehouse selection by code and name.
- [x] Default the warehouse from the item or current user's warehouse when available.
- [x] Filter out inactive or deleted items and warehouses.
- [x] Show the selected item's unit of measure beside every quantity input.
- [x] Show current available quantity for the selected item and warehouse.

### Phase 1 Acceptance Criteria

- [x] A warehouse user can find an item and start an Inventory action without knowing accounting terminology.
- [x] All existing Inventory callbacks and service calls still use their current names and signatures.
- [x] No non-Inventory screen or workflow changes visually or functionally.
- [x] Existing Inventory tests and the production build pass.

---

## Phase 2 — Guided Count and Adjustment Workflow

### 4. Ask What Physically Happened

- [x] Present user-friendly event choices mapped internally to existing adjustment types:
  - count differs from system quantity
  - damaged item
  - lost item
  - expired item
  - unrecorded stock found
  - correction of a previous transaction
- [x] Keep the existing `adjustmentType` field and values; implement only a display-label mapping.
- [x] Explain whether each choice will increase or decrease stock.
- [x] Require item, warehouse, quantity/count, reason, and posting date.
- [ ] Require notes or evidence for high-value adjustments based on an Inventory-specific configurable threshold.

### 5. Support Counted Quantity

- [x] For physical counts, ask for the actual counted quantity instead of asking the user to calculate a signed variance.
- [x] Display system quantity, counted quantity, and calculated difference before posting.
- [x] Calculate the difference with a pure helper in `InventoryService`.
- [x] Recalculate and validate the difference on the server immediately before posting.
- [x] Prevent stale-count posting when another movement changed the balance after the count began; show the latest balance and require review.

### 6. Add a Review Screen

- [x] Show an Inventory impact preview:
  - item and warehouse
  - current quantity
  - increase or decrease
  - expected quantity after posting
  - valuation method
  - estimated value impact
- [x] Show a read-only accounting preview:
  - debit account
  - credit account
  - estimated amount
  - accounting period
- [x] Do not allow ordinary warehouse users to select GL accounts.
- [x] Explain missing Inventory Class or GL mappings with an actionable message.
- [x] Require an explicit confirmation before final posting.

### 7. Separate Draft, Review, and Posting

- [ ] Add an Inventory-only draft state without changing existing posted-record semantics.
- [ ] Allow drafts to be edited or deleted by authorized users.
- [x] Make `Approve and Post` a single atomic server-side operation.
- [ ] Support optional maker-checker approval using existing user roles and permissions without changing role behavior in other modules.
- [x] Permit same-user posting only when the existing Inventory permission allows it.
- [ ] Support approval thresholds based on quantity or value without changing global approval logic.

### Phase 2 Acceptance Criteria

- [x] A user can complete a physical count adjustment without manually calculating the variance.
- [x] The displayed preview matches the posted quantity and journal amounts.
- [x] Double submission creates no duplicate Inventory or GL postings.
- [x] Posted adjustments cannot be edited or deleted through the UI, service, Edge Function, RPC, or direct authenticated API.

---

## Phase 3 — Reversal and Period Controls

### 8. Implement a Dedicated Reversal Action

- [ ] Add `Reverse` to posted Inventory adjustment and transaction rows.
- [ ] Copy the original item, warehouse, quantity, value, reference, and GL linkage into a read-only reversal review.
- [x] Require reversal date and reason.
- [x] Create an equal and opposite Inventory movement and balanced journal entry atomically.
- [x] Link the reversal to the original transaction using the existing reversal relationship where available.
- [x] Prevent multiple active reversals of the same transaction.
- [x] Block reversal if it would cause negative stock.
- [x] Never reopen, edit, soft-delete, or overwrite the original posted transaction.

### 9. Enforce Accounting Periods

- [x] Replace generic period assignment in the Inventory posting routine with period resolution based on posting date.
- [x] Validate that the resolved period belongs to the same organization.
- [x] Block posting and reversal in locked or hard-closed periods.
- [x] Apply existing soft-close rules without changing how other modules interpret period status.
- [x] Return a user-friendly Inventory error showing the invalid date and, when available, the next open date.
- [ ] Add database tests proving that UI or API bypass cannot post into a closed period.

### Phase 3 Acceptance Criteria

- [x] Every correction to a posted Inventory record is traceable through a linked reversal.
- [x] Original and reversal quantities and values net to zero when fully reversed.
- [x] Inventory cannot post into a locked or hard-closed accounting period.
- [x] Period enforcement changes no posting behavior outside Inventory.

---

## Phase 4 — Actionable Inventory Overview

### 10. Show Useful Quantities

- [ ] Display `On Hand`, `Reserved`, `Available`, `Incoming`, `Reorder Point`, and `Safety Stock` where data is available.
- [x] Keep organization-wide totals separate from warehouse-level balances.
- [x] Expand an item row to show balances by warehouse.
- [x] Clearly identify negative availability caused by reservations while continuing to prohibit negative on-hand posting.
- [x] Show last movement date and last physical count date.

### 11. Add Inventory-Only Quick Actions

- [x] From a critical item, allow the user to review warehouse balances.
- [x] From an item, allow the user to start a count or adjustment with item and warehouse prefilled.
- [ ] From an overstock item, allow the user to review other warehouse shortages.
- [ ] From a transaction, allow the user to open its Inventory details and linked journal entry.
- [x] Do not create or change Purchase Order logic as part of these quick actions.
- [x] If purchasing integration is requested later, stop at a read-only suggestion or existing navigation link unless that module is separately authorized.

### 12. Improve Filters and Statuses

- [ ] Add Inventory filters for warehouse, stock status, active item, adjustment type, posting status, and date range.
- [ ] Add saved Inventory-only views such as `Needs Attention`, `My Warehouse`, `Unposted Drafts`, and `This Month`.
- [x] Use text plus color for status; do not communicate status using color alone.
- [x] Make summary cards clickable filters.
- [x] Keep exports consistent with the active filters.

### Phase 4 Acceptance Criteria

- [x] Organization totals cannot hide a stockout at an individual warehouse.
- [ ] Dashboard quantities reconcile with the latest Inventory ledger entries.
- [x] All quick actions stay within Inventory and do not mutate another module.

---

## Phase 5 — Opening Inventory Safety

### 13. Restrict Opening Inventory

- [x] Limit access to authorized implementation/accounting users using existing permissions where possible.
- [x] Display a warning that Opening Inventory is for beginning balances, not routine receipts.
- [x] Detect an existing ledger history for the item and warehouse before accepting an opening line.
- [x] Prevent duplicate document numbers within an organization.
- [x] Prevent duplicate item-and-warehouse lines within one opening document.
- [x] Require a valid posting date and open accounting period.
- [x] Require non-negative unit cost and positive quantity.
- [x] Show the resulting debit to Inventory Asset and credit to Opening Balance Equity before posting.

### 14. Add Safe Spreadsheet Import

- [x] Provide a downloadable Inventory-only import template.
- [x] Validate item codes, warehouse codes, quantities, costs, duplicate lines, and dates before posting.
- [x] Show valid and invalid rows in a preview.
- [x] Require the user to resolve all invalid rows before posting.
- [x] Post the document atomically so a failed line does not leave partial opening balances.
- [x] Return row-specific errors without exposing database internals.

### Phase 5 Acceptance Criteria

- [x] Opening Inventory cannot be used to bypass normal stock movement controls.
- [x] A failed multi-line opening document leaves no posted Inventory or GL records.
- [ ] Successful totals reconcile to the generated journal entries.

---

## Phase 6 — Inventory Master Data Usability

### 15. Simplify Stock Item Setup

- [x] Group fields into `Basic Information`, `Stock Rules`, and `Accounting Setup`.
- [ ] Hide advanced accounting fields from ordinary warehouse users.
- [x] Require an Inventory Class before the item can participate in posted stock movements.
- [x] Inherit valuation and GL settings from the Inventory Class unless an existing supported override is explicitly enabled.
- [x] Explain reorder level, reorder quantity, and safety stock with concise examples.
- [x] Validate minimum, maximum, reorder, and safety quantities for contradictory values.

### 16. Protect Inventory Class Configuration

- [x] Show account codes and names for each configured mapping.
- [x] Validate that mapped accounts are active, non-header accounts in the same organization.
- [x] Validate appropriate account classifications where existing Chart of Account data supports it.
- [ ] Warn before changing valuation or GL mappings for a class with posted history.
- [x] Do not retroactively rewrite previously posted valuation or journal entries.
- [x] Add an Inventory-only configuration-health indicator for missing mappings.

### Phase 6 Acceptance Criteria

- [x] A new stock item can be configured correctly without entering debit or credit accounts directly.
- [x] Existing posted history remains unchanged after permitted master-data edits.
- [x] Cross-organization account, item, class, and warehouse relationships are rejected server-side.

---

## Phase 7 — Audit Trail and Reporting

### 17. Strengthen Inventory Traceability

- [x] Display adjustment number, transaction reference, source document, actor, posting date, and journal-entry reference together.
- [x] Show original-to-reversal relationships.
- [x] Include reason and notes in the Inventory audit detail.
- [x] Show whether a record originated from opening inventory, adjustment, count, receipt, issue, or reversal.
- [x] Keep posted records read-only in reports and detail views.

### 18. Add Reconciliation Reports

- [ ] Add an Inventory ledger-to-stock-level reconciliation report.
- [ ] Add an Inventory value-to-GL reconciliation report using read-only accounting data.
- [ ] Report Inventory transactions without a journal entry.
- [ ] Report journals referencing missing Inventory transactions.
- [ ] Report inactive or deleted items with non-zero stock.
- [ ] Report items with incomplete Inventory Class mappings.
- [ ] Scope every report and export by active `orgId`.

### Phase 7 Acceptance Criteria

- [ ] An auditor can trace a displayed stock balance to Inventory movements and journal entries.
- [ ] Reconciliation reports identify exceptions without changing Accounting module data.
- [ ] Inventory exports contain the same filtered records and totals shown on screen.

---

## Test Checklist

### Unit Tests

- [x] Counted quantity to variance calculation.
- [ ] Increase/decrease mapping for every existing adjustment type.
- [x] Available quantity and warehouse aggregation.
- [x] Status thresholds for critical, low, optimal, and overstock.
- [ ] Reversal quantity and value calculations.
- [ ] Accounting-preview calculation using configured Inventory Class accounts.

### Component Tests

- [x] Adjustment workflow requires item, warehouse, count/quantity, reason, and posting date.
- [x] Physical count displays system quantity, count, and variance.
- [x] Review screen displays quantity and accounting impact.
- [x] Posted rows do not expose edit or delete actions.
- [x] Reversal action requires date and reason.
- [x] Missing GL mapping shows a useful error.
- [x] Item and warehouse selectors exclude inactive and deleted records.
- [x] Dashboard actions and filters work without hover.

### Service and Integration Tests

- [x] All Inventory requests enforce `orgId` ownership.
- [x] Cross-tenant item, warehouse, Inventory Class, and account IDs are rejected.
- [x] Posting writes ledger, level, transaction, adjustment, and balanced journal data atomically.
- [x] Duplicate submission is idempotent or safely rejected.
- [x] Negative stock is rejected under concurrent requests.
- [x] Locked-period posting and reversal are rejected.
- [x] Posted adjustments cannot be updated or deleted.
- [x] Reversal preserves original cost and links to the source transaction.
- [x] Opening Inventory rolls back all lines when any line fails.

### Regression Verification

- [x] Run `npm test -- tests/InventoryService.test.ts --run`.
- [x] Run `npm test -- tests/InventoryReportingService.test.ts --run`.
- [x] Run `npm test -- tests/SupabaseDataService.warehouseLocations.test.ts --run`.
- [x] Run any new Inventory-specific tests.
- [x] Run `npm test`. Existing unrelated AR, student-document, and local-storage test failures remain; Inventory tests pass.
- [x] Run `npm run build`.
- [x] Confirm no existing non-Inventory test was changed merely to accommodate Inventory work.
- [ ] Manually confirm Accounting, AR, AP, Purchasing, Payroll, Training, Student, and Administration workflows are unchanged.

---

## Definition of Done

- [x] The Inventory workflow uses plain operational language.
- [x] Users can enter physical facts without selecting debit and credit accounts.
- [x] Inventory posting remains atomic, balanced, tenant-scoped, and valuation-controlled.
- [x] Locked-period and negative-stock controls are enforced server-side.
- [x] Posted records are immutable and corrections use linked reversals.
- [ ] Inventory balances reconcile to the Inventory ledger and related GL entries.
- [x] Existing function names, variable names, callback names, service signatures, and tab keys remain intact.
- [x] No other module's logic or behavior was changed.
- [ ] All Inventory tests and the full production build pass.
