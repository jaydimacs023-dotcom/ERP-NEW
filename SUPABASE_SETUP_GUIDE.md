# Supabase Database Setup Guide for AT-ERP

## Quick Start - 3 Steps

### Step 1: Create New Project in Supabase
1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click **New Project**
3. Fill in:
   - **Name:** AT-ERP
   - **Database Password:** Use a strong password (save this!)
   - **Region:** Select closest to you (e.g., Singapore for Asia-Pacific)
4. Wait 2-3 minutes for project creation

### Step 2: Create Tables Using SQL
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy entire contents of `SUPABASE_SCHEMA_COMPLETE.sql` from this project
4. Paste into the SQL editor
5. Click **Run** (or Ctrl+Enter)
6. Wait for all tables to be created (no errors should appear)

### Step 3: Load Sample Data
1. Click **New Query** again
2. Copy entire contents of `SUPABASE_SEED_DATA.sql`
3. Paste into SQL editor
4. Click **Run**
5. Verify data is loaded (you should see sample records)

---

## What Was Created

### ✅ Database Tables (27 tables)
Complete double-entry accounting system with:
- **Organization** - Multi-tenant support
- **Users** - Role-based access control
- **Chart of Accounts** - 45+ standard accounts
- **Journal Entries & Lines** - Transaction recording
- **Master Data** - Students, Trainers, Sponsors, Vendors, Employees
- **Payables** - Vendor bills with ATC withholding
- **Receivables** - Student/Sponsor invoicing
- **Banking** - Cash and bank account management
- **Payroll** - Employee compensation
- **Fixed Assets** - Depreciation tracking
- **Budgeting** - Financial planning
- **Audit Logs** - Compliance & security

### ✅ Sample Data Loaded
- **1 Organization:** Sample Training Center
- **45+ Accounts:** Complete COA with Philippine structure
- **3 Vendors:** Supplies, Training Materials, Utilities
- **3 Locations:** Main & Satellite offices
- **7 ATC Tax Categories:** Philippine withholding rates
- **3 Bank Accounts:** Various account types
- **3 Employees:** For payroll processing

---

## Connect to Your Application

### In VS Code / AT-ERP Project

1. **Get Connection Details from Supabase:**
   - Go to Supabase Dashboard → **Settings** → **Database**
   - Scroll to "Connection string"
   - Copy the connection string (or individual parameters)

2. **Get API Credentials:**
   - Go to **Settings** → **API**
   - Copy `Project URL` (your VITE_SUPABASE_URL)
   - Copy `anon public` key (your VITE_SUPABASE_ANON_KEY)

3. **Create `.env.local` file** (in project root):
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Test Connection:**
   ```bash
   npm run dev
   ```
   - App should load without "Can't connect to database" errors
   - You should see sample data in all dropdown lists

---

## Database Structure Overview

### Multi-Tenancy Design
```
organizations (one)
    ├── users
    ├── accounts (Chart of Accounts)
    ├── journal_entries
    │   └── journal_entry_lines
    ├── students
    ├── trainers
    ├── vendors
    ├── employees
    ├── bank_accounts
    └── payables
```

### Double-Entry Accounting Rules
**Every transaction:**
- Debits one or more accounts
- Credits one or more accounts (debit sum = credit sum)
- Is immutable once posted
- Creates audit trail

**Example - Record Bill:**
```
Debit: Expense Account (e.g., Supplies)  → 10,000
Debit: Input VAT                         →  1,200
Credit: EWT Payable (2%)                 →    200
Credit: Accounts Payable - Vendor        → 11,000
                                    Total: 11,200
```

### Philippine Tax Withholding (ATC)
Automatic withholding on vendor bills:
- **Goods/Supplies:** 1-2% withholding
- **Capital Equipment:** 2% withholding
- **Lease/Rental:** 5% withholding
- **Professional Services:** 10% withholding

---

## Chart of Accounts Structure

### 1000-1999 ASSETS
| Code | Account | Type |
|------|---------|------|
| 1010 | Cash - Peso | Current |
| 1020 | Petty Cash | Current |
| 1050 | AR - Students | Current |
| 1210 | Input VAT | Tax |
| 1510 | Land | Fixed Asset |
| 1520 | Building | Fixed Asset |

### 2000-2999 LIABILITIES
| Code | Account | Type |
|------|---------|------|
| 2100 | Accounts Payable | Current |
| 2310 | EWT on Purchases | Tax |
| 2320 | Output VAT | Tax |
| 2410 | SSS Payable | Statutory |

### 3000-3999 EQUITY
| Code | Account | Type |
|------|---------|------|
| 3100 | Capital Stock | Equity |
| 3200 | Retained Earnings | Equity |

### 4000-4999 REVENUE
| Code | Account | Type |
|------|---------|------|
| 4010 | Training Fees - Tuition | Revenue |
| 4020 | Registration Fees | Revenue |
| 4030 | Certification Fees | Revenue |

### 5000-5999 EXPENSES
| Code | Account | Type |
|------|---------|------|
| 5110 | Trainer Salaries | Personnel |
| 5210 | Training Materials | Materials |
| 5310 | Rent | Facilities |
| 5510 | Depreciation | Depreciation |

---

## Common Operations

### Recording a Bill (Purchase)
1. Go to **Payables & Procurement** tab
2. Click **Record Bill**
3. Select vendor (withholding tax auto-calculates)
4. Add items (select from catalog)
5. Click **Post to Payables**
6. Journal entry auto-created with:
   - Expense account debited
   - Input VAT debited
   - EWT payable credited
   - Vendor AP account credited

### Issuing an Invoice (Sale)
1. Go to **Receivables** tab
2. Click **Issue Invoice**
3. Select customer (student or sponsor)
4. Add training services
5. Click **Post to Receivables**
6. Journal entry auto-created

### Recording a Payment
1. Go to **Payables & Procurement** → **Payments** tab
2. Click **Pay Bill**
3. Select vendor & bank account
4. Enter amount
5. Click **Confirm Disbursement**
6. Cash account debited, AP credited

### Processing Payroll
1. Go to **Payroll** tab
2. Click **New Payroll Run**
3. Select period
4. System auto-calculates: Gross, Deductions (SSS, PhilHealth, Pag-IBIG), Net
5. Click **Post Payroll**
6. Journal entry spreads salary to employees

---

## Database Maintenance

### Monthly
- [ ] Run trial balance report (verify debit = credit)
- [ ] Reconcile bank accounts
- [ ] Review & post depreciation
- [ ] Accrue expenses (utilities, rent)

### Quarterly
- [ ] Close accounting period
- [ ] Generate financial statements
- [ ] Review aged payables/receivables
- [ ] Backup database

### Annually
- [ ] Prepare & file ATC returns (withholding report)
- [ ] Calculate tax liabilities
- [ ] Prepare for external audit
- [ ] Reset budgets for new year

---

## Security Best Practices

### 1. Row Level Security (RLS)
Currently enabled on all critical tables. To test:
```sql
-- In Supabase SQL editor
SELECT * FROM organizations;  -- Only returns your org
SELECT * FROM accounts;       -- Only returns your org's accounts
```

### 2. Database Backups
Supabase auto-backs up daily. To manually backup:
- Go to **Settings** → **Backups**
- Click **Create Backup Now**

### 3. Access Control
Users are limited by:
- Organization membership (orgId)
- Role (ADMIN, ACCOUNTANT, FINANCE_MANAGER, etc.)
- Individual record permissions via RLS

---

## Troubleshooting

### "Can't connect to database"
1. Check `.env.local` exists and has correct values
2. Verify VITE_SUPABASE_URL format: `https://xxxxx.supabase.co`
3. Check anon key is not empty
4. Restart dev server: `npm run dev`

### "Table does not exist"
1. Verify all SQL from SUPABASE_SCHEMA_COMPLETE.sql ran without errors
2. In Supabase dashboard, go to **Table Editor**
3. Check table is listed
4. If missing, run SQL again

### "Invalid UUID" errors
1. Ensure you're using Supabase UUID functions
2. Never manually create UUIDs like: `id: 'ven-' + Date.now()`
3. Let Supabase auto-generate: `id UUID DEFAULT gen_random_uuid()`

### "Withholding tax not calculating"
1. Verify vendor has tax setting configured
2. Check ATC rates are loaded in atc_rates table
3. Confirm item is linked to correct ATC item
4. Review tax formula: grossAmount × ratePercent

---

## File Reference

| File | Purpose |
|------|---------|
| `SUPABASE_SCHEMA_COMPLETE.sql` | Full database schema (27 tables) |
| `SUPABASE_SEED_DATA.sql` | Sample data & chart of accounts |
| `.env.local` | Credentials (create this locally) |

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Run SUPABASE_SCHEMA_COMPLETE.sql
3. ✅ Run SUPABASE_SEED_DATA.sql
4. ✅ Add .env.local with credentials
5. ✅ Test by running `npm run dev`
6. 📝 Create organization & users
7. 📝 Configure chart of accounts
8. 📝 Import your actual master data

---

## Support & Documentation

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Manual:** https://www.postgresql.org/docs/
- **Philippine GAAP:** https://www.icpaf.edu.ph/
- **BIR ATC Returns:** https://www.bir.gov.ph/

**Created:** January 19, 2026  
**Version:** 1.0 - Complete Schema with ATC Tax Support  
**Status:** Production Ready
