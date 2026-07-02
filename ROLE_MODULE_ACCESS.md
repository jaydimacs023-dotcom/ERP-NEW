# Role and Module Access Matrix

This document describes the access currently configured in
[`config/permissions.ts`](config/permissions.ts). It is a reference for tenant
administrators, implementers, auditors, and testers.

## Important interpretation notes

- Module access controls which tabs a role can open through the application.
- Action access controls operations such as create, edit, approve, post, void,
  and delete.
- `SYSTEM_ADMIN` and `ADMIN` currently receive every action on every module they
  can access.
- For most other roles, an action is currently allowed whenever the role can
  access the module, unless `ROLE_ACTIONS` explicitly restricts it.
- `AUDITOR` is described as read-only, but only some of its modules have an
  explicit `view` restriction. This is a current enforcement gap.
- Inventory Classes and Opening Inventory are currently shown inside the
  Inventory sidebar, but their tab keys are not registered in `ModuleTab`,
  `MODULE_GROUPS`, or `ROLE_PERMISSIONS`. Their current visibility is therefore
  inherited from the Inventory navigation rather than explicitly authorized.

## Current access by role

### System Administrator (`SYSTEM_ADMIN`)

Default landing page: Tenant Management

- Financial Core: Dashboard, General Ledger, Reports, Banking, Checks
- Accounts Receivable: AR, Recurring Invoices, Revenue Recognition
- Accounts Payable: Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Payroll and Planning: Payroll, Budgets
- Registries: Sponsors, Vendors, Items, Fixed Assets
- Inventory: Inventory Dashboard, Warehouse Locations, Stock Items, Stock
  Levels, Stock Adjustments, Reorder Points, Inventory Transactions, Inventory
  Reports
- Training Operations: Students, Trainers, Qualifications, Batches, Locations,
  Schedules, Enrollments, Course Fees, Alumni Reports
- Organization Administration: Employees, Chart of Accounts, Accounting
  Periods, Branding, Subscription, Payment History, Users, Audit Log
- Platform Administration: Maintenance, Backup/Restore, Tenant Management,
  Schema, Payment Monitoring
- Support: Feedback
- Actions: Full access

### Organization Administrator (`ADMIN`)

Default landing page: Dashboard

- Financial Core: Dashboard, General Ledger, Reports, Banking, Checks
- Accounts Receivable: Invoices, Payments, Customers, Bank Deposits, Recurring
  Invoices, Revenue Recognition
- Accounts Payable: Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Payroll and Planning: Payroll, Budgets
- Registries: Sponsors, Vendors, Items, Fixed Assets
- Inventory: Inventory Dashboard, Warehouse Locations, Stock Items, Stock
  Levels, Stock Adjustments, Reorder Points, Inventory Transactions, Inventory
  Reports
- Training Operations: Students, Trainers, Qualifications, Batches, Locations,
  Schedules, Enrollments, Course Fees, Alumni Reports
- Organization Administration: Employees, Chart of Accounts, Accounting
  Periods, Branding, Subscription, Payment History, Users, Audit Log
- Support: Feedback
- Actions: Full access

### President / Executive (`PRESIDENT`)

Default landing page: Dashboard

- Executive Finance: Dashboard, General Ledger, Reports, Banking, AR, Payables,
  Payroll, Budgets
- Operations Oversight: Students, Trainers, Qualifications, Batches, Employees
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules because no
  executive-specific action restrictions are configured.

### Finance Manager (`FINANCE_MANAGER`)

Default landing page: Dashboard

- Financial Core: Dashboard, General Ledger, Reports, Banking, Checks
- Accounts Receivable: Invoices, Payments, Customers, Bank Deposits, Recurring
  Invoices, Revenue Recognition
- Accounts Payable: Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Payroll and Planning: Payroll, Budgets
- Registries: Sponsors, Vendors, Items, Fixed Assets
- Inventory: Inventory Dashboard, Warehouse Locations, Stock Items, Stock
  Levels, Stock Adjustments, Reorder Points, Inventory Transactions, Inventory
  Reports
- Finance Administration: Employees, Chart of Accounts, Accounting Periods
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Accountant (`ACCOUNTANT`)

Default landing page: Dashboard

- Financial Core: Dashboard, General Ledger, Reports, Banking
- Accounts Receivable: Invoices, Payments, Customers, Bank Deposits, Recurring
  Invoices, Revenue Recognition
- Accounts Payable: Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Planning: Budgets
- Registries: Sponsors, Vendors, Items, Fixed Assets
- Finance Administration: Chart of Accounts, Accounting Periods
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Accounts Receivable Specialist (`AR_SPECIALIST`)

Default landing page: Dashboard

- Dashboard
- AR Calendar and Tasks
- Customers
- Invoices
- Payments and Applications
- Credit/Debit Memos
- Write-offs
- Aging Report
- Statements of Account
- Customer Ledger
- Collection Receipts
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Accounts Payable Specialist (`AP_SPECIALIST`)

Default landing page: Payables

- Dashboard, Reports, Banking, Checks
- Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Vendors, Items
- Inventory Dashboard, Stock Items, Stock Levels
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Accounts Payable Clerk (`AP_CLERK`)

Default landing page: Payables

- Payables
- Purchase Orders
- Goods Receipt
- Vendors
- Items
- Support: Feedback
- Explicit actions:
  - Payables, Purchase Orders, Goods Receipt: view, create, edit
  - Vendors and Items: view only
  - Feedback currently falls back to all actions allowed
  - No approve, post, void, or delete action is granted on the three AP
    transaction modules

### Accounts Payable Supervisor (`AP_SUPERVISOR`)

Default landing page: Payables

- Dashboard, Reports, Banking, Checks
- Payables, Purchase Orders, Goods Receipt, Recurring Bills
- Vendors, Items
- Inventory Dashboard, Stock Items, Stock Levels
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Treasury (`TREASURY`)

Default landing page: Banking

- Dashboard, Reports, Banking, Checks
- AR and Payables for cash forecasting
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Auditor (`AUDITOR`)

Default landing page: Dashboard

- Financial Core: Dashboard, General Ledger, Reports, Banking
- Accounts Receivable: AR, Recurring Invoices, Revenue Recognition
- Accounts Payable: Payables, Purchase Orders, Goods Receipt
- Payroll
- Registries: Sponsors, Vendors, Items, Fixed Assets
- Inventory: Inventory Dashboard, Warehouse Locations, Stock Items, Stock
  Levels, Stock Adjustments, Inventory Transactions, Inventory Reports
- Finance Administration: Chart of Accounts, Accounting Periods
- Support: Feedback
- Explicitly view-only today: Dashboard, General Ledger, Reports, AR, Payables,
  and Audit
- Enforcement gap: all other accessible modules currently fall back to allowing
  every action.

### Registrar (`REGISTRAR`)

Default landing page: Students

- Dashboard
- Students, Trainers, Qualifications, Batches, Locations, Schedules
- Alumni Reports
- Sponsors for scholarship administration
- Support: Feedback
- Actions: All actions are currently allowed on accessible modules.

### Trainer (`TRAINER`)

Default landing page: Trainer Portal

- Trainer Portal
- Feedback
- Actions: All actions are currently allowed within accessible modules.

### Student (`STUDENT`)

Default landing page: Student Portal

- Student Portal
- Feedback
- Actions: All actions are currently allowed within accessible modules.

## Recommended corrections

### Priority 1 — close authorization gaps

1. Register `inventory-classes` and `opening-inventory` as formal `ModuleTab`
   values and add them explicitly to the Inventory group and appropriate roles.
2. Change `canPerformAction` to default-deny for roles that do not have an
   explicit action rule. The current default-allow behavior is too permissive
   for accounting software.
3. Define complete read-only action rules for every Auditor module, including
   inventory, payroll, banking, periods, assets, and source documents.
4. Enforce action permissions in handlers and Supabase/Edge Functions. Hidden
   buttons alone are not authorization.
5. Prevent non-administrator roles from deleting posted, approved, or finalized
   accounting records. Corrections should use voids, reversals, or compensating
   entries.

### Priority 2 — improve segregation of duties

1. Distinguish AP Specialist from AP Supervisor:
   - Clerk/Specialist: prepare and edit drafts.
   - Supervisor: approve.
   - Treasury: release payment.
   - Accountant/Finance Manager: post to the General Ledger.
2. Restrict Finance Manager, Accountant, President, and Registrar actions
   explicitly rather than allowing every action on every visible module.
3. Give the President primarily view and approve access, not routine
   create/edit/delete access.
4. Consider separating tenant user administration from financial administration
   instead of giving both to one broad `ADMIN` role.
5. Consider making System Administrator a platform-support role without routine
   authority to create or post tenant accounting transactions.

### Priority 3 — role and module additions

1. Add an `INVENTORY_MANAGER` or `WAREHOUSE_MANAGER` role for:
   warehouse locations, stock items, stock levels, opening inventory, stock
   adjustments, reorder points, transactions, and analytics.
2. Optionally add an `INVENTORY_CLERK` role that can prepare stock movements but
   cannot approve/post adjustments or opening inventory.
3. Give Accountants read access to Inventory Transactions, Inventory Analytics,
   and Inventory Classes so they can reconcile inventory to the General Ledger.
4. Give Registrars explicit access to Enrollments and, where appropriate,
   read-only Course Fees. These records are operationally coupled to students
   and batches.
5. Give Auditors access to the Audit Log. The role currently has an action rule
   for `audit` but does not include the Audit module in its module list.

## Suggested inventory action matrix

| Role | Classes | Opening inventory | Stock master | Adjustments | Transactions/levels/analytics |
|---|---|---|---|---|---|
| Admin | Manage | Approve/post | Manage | Approve/post/reverse | View |
| Finance Manager | Manage mappings | Approve/post | View | Approve/post/reverse | View |
| Accountant | View mappings | Review/post | View | Review/post/reverse | View |
| Inventory Manager | View mappings | Prepare | Manage | Prepare/approve operationally | View |
| Inventory Clerk | View mappings | Prepare draft | Prepare | Prepare draft | View |
| AP Specialist/Supervisor | View | No access | View | No access | View |
| Auditor | View only | View only | View only | View only | View only |
| President | Summary only | Approve only if required by policy | Summary | Approve exceptional adjustments | View |

## Maintenance rule

Whenever a module is added or renamed, update all of the following together:

1. `ModuleTab`
2. `ROLE_PERMISSIONS`
3. `MODULE_GROUPS`
4. `ROLE_ACTIONS`
5. Sidebar visibility in `App.tsx`
6. Route/render handling in `App.tsx`
7. Backend authorization and tenant scoping
8. This document
