# Payables Module - Database Structure Guide

## Table: `payables`

### Overview
The `payables` table stores accounts payable records for vendor bills, with support for Philippine tax withholding (ATC), multi-tenant organization isolation, and complete audit trail.

### Field Reference

#### Identification & Organization
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `id` | UUID | PRIMARY KEY | Unique payable record identifier |
| `org_id` | UUID | FOREIGN KEY, NOT NULL | Organization (tenant) identifier |
| `payable_number` | TEXT | UNIQUE(org_id, payable_number) | Unique bill number per organization (e.g., PAY-2026-001) |

#### Vendor & Document Info
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `vendor_id` | UUID | FOREIGN KEY, NOT NULL | Reference to vendors table |
| `category` | TEXT | ENUM, NOT NULL | Payable type: utilities, supplies, training_materials, contractor_services, assessments, insurance, government_obligations, scholarship_advances, employee_reimbursements, other |
| `description` | TEXT | NOT NULL | Detailed payable description |
| `reference_document` | TEXT | Optional | Supporting document reference (invoice #, receipt #, etc.) |

#### Financial Details
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `amount` | NUMERIC(15,2) | NOT NULL | Gross payable amount (before withholding) |
| `currency` | TEXT | DEFAULT 'PHP' | ISO 4217 currency code |
| `net_payable` | NUMERIC(15,2) | Optional | Amount after withholding: net_payable = amount - withholding_amount |

#### Withholding Tax (Philippine ATC)
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `withholding_type` | TEXT | ENUM Optional | EXPANDED or FINAL withholding |
| `atc_item_id` | UUID | FOREIGN KEY, Optional | Reference to atc_items (tax category) |
| `atc_rate_id` | UUID | FOREIGN KEY, Optional | Reference to atc_rates (specific tax rate) |
| `applied_rate_percent` | NUMERIC(5,2) | DEFAULT 0 | Applied withholding percentage (e.g., 2.00 for 2%) |
| `withholding_amount` | NUMERIC(15,2) | DEFAULT 0 | Calculated: amount × (applied_rate_percent / 100) |

#### Dates
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `bill_date` | DATE | NOT NULL | Date bill was issued by vendor |
| `due_date` | DATE | NOT NULL | Payment due date |
| `payment_date` | DATE | Optional | Actual payment date |

#### Status & Workflow
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `status` | TEXT | ENUM, DEFAULT 'for_approval' | for_approval → approved → paid / partially_paid / cancelled |
| `gl_account_id` | UUID | FOREIGN KEY, Optional | GL account for payable posting |
| `journal_entry_id` | UUID | FOREIGN KEY, Optional | Link to journal_entries table (audit trail) |

#### Approval & Payment Tracking
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `created_by` | UUID | FOREIGN KEY, NOT NULL | User who created the payable |
| `approved_by` | UUID | FOREIGN KEY, Optional | User who approved |
| `paid_by` | UUID | FOREIGN KEY, Optional | User who marked as paid |
| `approved_at` | TIMESTAMPTZ | Optional | Approval timestamp |
| `paid_at` | TIMESTAMPTZ | Optional | Payment timestamp |

#### Audit & Soft Delete
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Soft delete flag |
| `deleted_at` | TIMESTAMPTZ | Optional | Deletion timestamp |
| `deleted_by` | UUID | Optional | User who deleted |

#### Internal Notes
| Field | Type | Constraints | Purpose |
|-------|------|-----------|---------|
| `notes` | TEXT | Optional | Internal notes and comments |

---

## Status Workflow

```
┌─────────────────────────────────────────────────┐
│  User Creates Payable → Status: FOR_APPROVAL    │
└─────────────┬───────────────────────────────────┘
              │
              ↓
      ┌──────────────┐
      │ AP Approves? │
      └──────┬───────┘
             │ YES
             ↓
      Status: APPROVED
             │
             ↓
      ┌──────────────┐
      │ Payment Made?│
      └──────┬───────┘
             │
             ├─→ PAID (full payment)
             │
             ├─→ PARTIALLY_PAID (partial payment)
             │
             └─→ CANCELLED (if rejected)
```

### Status Values
- **for_approval**: Initial status, awaiting AP review
- **approved**: Approved and ready to pay
- **paid**: Fully paid
- **partially_paid**: Partial payment received
- **cancelled**: Rejected or voided

---

## Categories

Support for flexible payable categorization:

| Category | Description | GL Account Default |
|----------|-------------|-------------------|
| utilities | Electricity, water, gas, internet | 5320, 5330 |
| supplies | Office & training supplies | 5220 |
| training_materials | Learning modules & materials | 5210 |
| contractor_services | Contract labor & services | 5120 |
| assessments | External testing/certification | 5400 |
| insurance | Insurance premiums | 5430 |
| government_obligations | Taxes & permits | 5610 |
| scholarship_advances | Student scholarship disbursements | 1050 |
| employee_reimbursements | Employee expense reimbursements | 5460 |
| other | Miscellaneous payables | 5600 |

---

## Tax Withholding (Philippine ATC)

Automatically calculated based on vendor tax settings:

### Withholding Types
- **EXPANDED** (EWT - Expanded Withholding Tax): Applied to most purchases (1-2%)
- **FINAL** (Final Tax): Applied to certain services or rentals (5-10%)

### Calculation
```
net_payable = amount - withholding_amount
withholding_amount = amount × (applied_rate_percent / 100)
```

### Example
```
Bill Amount: PHP 10,000
Category: Supplies
ATC Rate: 2% (WI020 - Expanded Withholding)
Withholding: 10,000 × 0.02 = PHP 200
Net Payable: 10,000 - 200 = PHP 9,800

Journal Entry:
  Debit: Supplies Expense (5220)     10,000
  Credit: EWT Payable (2310)             200
  Credit: Accounts Payable (2100)      9,800
```

---

## Accounting Integration

### Journal Entry Creation
When a payable is posted (status → POSTED), a journal entry is automatically created:

**Account Structure:**
```
DEBIT:  Expense Account (based on category)
DEBIT:  (if applicable) Tax Input Account
CREDIT: EWT Payable Account (if withholding applies)
CREDIT: Accounts Payable / Vendor Account
```

### Multi-Tenant Isolation
All queries MUST filter by `org_id` to ensure organization data isolation:

```sql
SELECT * FROM payables
WHERE org_id = 'organization-uuid'
  AND is_deleted = FALSE;
```

---

## Common Queries

### Outstanding Payables by Vendor
```sql
SELECT v.name, SUM(p.amount - COALESCE(p.withholding_amount, 0)) as outstanding
FROM payables p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.org_id = 'org-uuid'
  AND p.is_deleted = FALSE
  AND p.status IN ('for_approval', 'approved')
GROUP BY v.name
ORDER BY outstanding DESC;
```

### Payables Due Within 7 Days
```sql
SELECT payable_number, v.name, due_date, amount
FROM payables p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.org_id = 'org-uuid'
  AND p.is_deleted = FALSE
  AND p.status IN ('for_approval', 'approved')
  AND p.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY p.due_date;
```

### Overdue Payables
```sql
SELECT payable_number, v.name, due_date, amount
FROM payables p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.org_id = 'org-uuid'
  AND p.is_deleted = FALSE
  AND p.status IN ('for_approval', 'approved')
  AND p.due_date < CURRENT_DATE
ORDER BY p.due_date;
```

### Payables by Category
```sql
SELECT category, COUNT(*) as count, SUM(amount) as total
FROM payables
WHERE org_id = 'org-uuid'
  AND is_deleted = FALSE
  AND status IN ('for_approval', 'approved')
GROUP BY category
ORDER BY total DESC;
```

### Payables Awaiting Approval
```sql
SELECT payable_number, v.name, amount, due_date
FROM payables p
JOIN vendors v ON p.vendor_id = v.id
WHERE p.org_id = 'org-uuid'
  AND p.is_deleted = FALSE
  AND p.status = 'for_approval'
ORDER BY p.created_at DESC;
```

### Total Withholding Due
```sql
SELECT category, SUM(withholding_amount) as total_withholding
FROM payables
WHERE org_id = 'org-uuid'
  AND is_deleted = FALSE
  AND status IN ('approved', 'paid')
  AND withholding_amount > 0
GROUP BY category;
```

---

## Performance Indexes

Indexes created on payables table:

```sql
CREATE INDEX idx_payables_org_id ON payables(org_id);
CREATE INDEX idx_payables_vendor_id ON payables(vendor_id);
CREATE INDEX idx_payables_status ON payables(org_id, status);
CREATE INDEX idx_payables_payable_number ON payables(org_id, payable_number);
CREATE INDEX idx_payables_due_date ON payables(org_id, due_date);
CREATE INDEX idx_payables_category ON payables(org_id, category);
CREATE INDEX idx_payables_created_by ON payables(created_by);
CREATE INDEX idx_payables_approved_by ON payables(approved_by);
```

---

## Data Integrity Constraints

1. **Organization Isolation**: All records must have valid `org_id`
2. **Unique Payable Number**: `payable_number` must be unique per organization
3. **Dates**: `due_date` must be ≥ `bill_date`
4. **Withholding**: If `withholding_type` is set, `applied_rate_percent` must be > 0
5. **Status Transitions**: 
   - for_approval → approved/cancelled
   - approved → paid/partially_paid/cancelled
   - paid/cancelled → (immutable)

---

## Usage Example (TypeScript/React)

```typescript
// Create a payable
const newPayable = {
  orgId: 'org-uuid',
  vendorId: 'vendor-uuid',
  payableNumber: 'PAY-2026-001',
  category: 'utilities',
  description: 'Monthly electricity bill - January',
  amount: 15000,
  billDate: '2026-01-15',
  dueDate: '2026-02-15',
  currency: 'PHP',
  status: 'for_approval',
  createdBy: 'user-uuid'
};

// With withholding
const payableWithEWT = {
  ...newPayable,
  withholding_type: 'EXPANDED',
  atc_rate_id: 'atc-rate-uuid',
  applied_rate_percent: 2.00,
  withholding_amount: 300,
  net_payable: 14700
};
```

---

## Migration Notes

If migrating from legacy payables table:
1. Run `MIGRATE_PAYABLES.sql`
2. Map old status values to new workflow
3. Ensure all vendors have `vendor_id`
4. Create `created_by` user references
5. Calculate `net_payable` based on withholding rules
6. Validate dates (bill_date ≤ due_date)

---

**Created:** January 19, 2026  
**Database:** Supabase (PostgreSQL)  
**Status:** Production Ready
