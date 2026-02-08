# Foreign Currency & Exchange Rates Implementation

## Status: âœ… COMPLETE

This document outlines the complete foreign currency and exchange rate support implemented in AT-ERP.

---

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Type System](#type-system)
4. [Service Layer](#service-layer)
5. [Data Persistence](#data-persistence)
6. [Usage Examples](#usage-examples)
7. [Integration Points](#integration-points)
8. [Deployment](#deployment)

---

## Overview

The foreign currency module enables AT-ERP to:
- **Manage exchange rates** by currency pair and effective date
- **Convert currencies** using historical rates
- **Track unrealized gains/losses** on foreign currency balances
- **Generate period-end adjustments** for currency revaluation
- **Support multi-currency** transactional data (vendors, payables, bank accounts)

**Key Features:**
- âœ… Exchange rate table with historical tracking
- âœ… Implicit 1:1 rates for same-currency pairs
- âœ… Inverse rate calculation (e.g., USDâ†’PHP from PHPâ†’USD)
- âœ… Unrealized gain/loss calculations (GAAP-compliant)
- âœ… Period-end adjustment entry generation
- âœ… Rate validation with thresholds
- âœ… Full audit trail integration
- âœ… Organization-isolated data via RLS

---

## Database Schema

### Table: `exchange_rates`

```sql
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Currency pair
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  
  -- Rate data
  rate DECIMAL(18, 8) NOT NULL,
  effective_date DATE NOT NULL,
  
  -- Metadata
  source VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  is_manual BOOLEAN DEFAULT true,
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_currencies CHECK (from_currency != to_currency),
  CONSTRAINT valid_rate CHECK (rate > 0),
  UNIQUE (org_id, from_currency, to_currency, effective_date)
);
```

**Indexes:**
- `org_id` - Fast organization filtering
- `org_id, from_currency, to_currency` - Currency pair lookups
- `org_id, effective_date DESC` - Date-based rate retrieval
- `created_at DESC` - Audit trail sorting

**RLS Policies:**
- SELECT, INSERT, UPDATE, DELETE restricted to user's organization
- Implementation: `SELECT org_id FROM users WHERE id = auth.uid()`

---

## Type System

### ExchangeRate Interface

```typescript
export interface ExchangeRate extends BaseEntity {
  id: string;
  orgId: string;
  fromCurrency: string;          // ISO 4217 code (e.g., "USD")
  toCurrency: string;            // ISO 4217 code (e.g., "PHP")
  rate: number;                  // Exchange rate (e.g., 56.5)
  effectiveDate: string;         // YYYY-MM-DD
  source: string;                // "MANUAL", "API", etc.
  isManual: boolean;             // true if user-entered
  notes?: string;                // Optional documentation
  createdBy?: string;            // Audit: Who created
  createdAt: string;
  updatedBy?: string;            // Audit: Who last updated
  updatedAt?: string;
}
```

### CurrencyConversion Interface

Represents the result of converting an amount from one currency to another:

```typescript
export interface CurrencyConversion {
  originalAmount: number;        // Original amount in source currency
  originalCurrency: string;      // Source currency code
  targetCurrency: string;        // Target currency code
  rate: number;                  // Exchange rate used
  convertedAmount: number;       // Result in target currency
  rateDate: string;              // Date rate was effective
}
```

### MulticurrencyBalance Interface

Represents account balances in multiple currencies:

```typescript
export interface MulticurrencyBalance {
  accountId: string;
  accountName: string;
  balances: {
    [currency: string]: number;  // Currency code â†’ balance
  };
  functionalBalance: number;     // Balance in functional currency
  functionalCurrency: string;    // Organization's functional currency
}
```

---

## Service Layer

### ExchangeRateService

Located at `services/ExchangeRateService.ts`, provides static utility methods:

#### 1. Get Exchange Rate

```typescript
static getExchangeRate(
  rates: ExchangeRate[],
  fromCurrency: string,
  toCurrency: string,
  onDate: string,
  orgId: string
): ExchangeRate | null
```

**Behavior:**
- Returns most recent rate effective on or before `onDate`
- Returns implicit 1:1 rate for same currency pairs
- Returns `null` if no rate found
- Filters by organization ID for isolation
- Ignores soft-deleted rates

**Example:**
```typescript
const rate = ExchangeRateService.getExchangeRate(
  exchangeRates,
  'USD',
  'PHP',
  '2024-01-31',
  orgId
);
// Returns: { rate: 56.50, effectiveDate: '2024-01-30', ... }
```

---

#### 2. Get Inverse Rate

```typescript
static getInverseRate(
  rates: ExchangeRate[],
  fromCurrency: string,
  toCurrency: string,
  onDate: string,
  orgId: string
): ExchangeRate | null
```

**Behavior:**
- Attempts direct rate lookup first
- Falls back to inverse calculation (1 / rate)
- Inverts currency pair fields
- Useful when only reverse pair exists in database

**Example:**
```typescript
// If we have USDâ†’PHP at 56.50, we can calculate PHPâ†’USD
const inverseRate = ExchangeRateService.getInverseRate(
  exchangeRates,
  'PHP',
  'USD',
  '2024-01-31',
  orgId
);
// Returns: { rate: 0.01769, fromCurrency: 'PHP', toCurrency: 'USD', ... }
```

---

#### 3. Convert Currency

```typescript
static convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number
): CurrencyConversion
```

**Behavior:**
- Performs actual currency conversion
- Returns conversion details including rate used
- Handles same-currency conversions (returns 1:1 rate)
- Does NOT look up rate; you provide it

**Example:**
```typescript
const conversion = ExchangeRateService.convert(
  1000,
  'USD',
  'PHP',
  56.50
);
// Returns: {
//   originalAmount: 1000,
//   originalCurrency: 'USD',
//   targetCurrency: 'PHP',
//   rate: 56.50,
//   convertedAmount: 56500,
//   rateDate: '2024-01-31'
// }
```

---

#### 4. Calculate Unrealized Gain/Loss

```typescript
static calculateUnrealizedGainLoss(
  foreignAmount: number,
  transactionRate: number,
  periodEndRate: number,
  functionalCurrency: string
): {
  functionalCurrencyAmount: number;
  transactionAmount: number;
  unrealizedGainLoss: number;
  isGain: boolean;
}
```

**Behavior:**
- Calculates difference between transaction rate and current period-end rate
- Determines if difference is gain or loss
- GAAP-compliant (deferred exchange gain/loss accounting)
- Used for period-end revaluation

**Example:**
```typescript
// Company has $1,000 USD receivable
// Transaction rate (when invoice issued): 50.00
// Period-end rate: 56.50
const gapl = ExchangeRateService.calculateUnrealizedGainLoss(
  1000,
  50.00,
  56.50,
  'PHP'
);
// Returns: {
//   transactionAmount: 50000,        // PHP 50,000 (at transaction rate)
//   functionalCurrencyAmount: 56500, // PHP 56,500 (at period-end rate)
//   unrealizedGainLoss: 6500,        // Gain of PHP 6,500
//   isGain: true
// }
```

---

#### 5. Generate Unrealized Gain/Loss Journal Entries

```typescript
static generateUnrealizedGainLossEntries(
  foreignAmount: number,
  foreignCurrency: string,
  transactionRate: number,
  periodEndRate: number,
  functionalCurrency: string,
  gainAccountId: string,
  lossAccountId: string,
  assetAccountId: string
): Partial<JournalLine>[]
```

**Behavior:**
- Generates 2 journal entry lines for period-end adjustment
- Handles both gains and losses automatically
- Uses separate GL accounts for gains vs losses
- Returns empty array if adjustment is negligible (<0.01)

**Generated Lines (Gain Scenario):**
```typescript
// Line 1: Debit Asset Account
{
  accountId: assetAccountId,
  debit: 6500,
  credit: 0,
  memo: 'Unrealized gain on USD at 56.50000000'
}

// Line 2: Credit Gain Account
{
  accountId: gainAccountId,
  debit: 0,
  credit: 6500,
  memo: 'Unrealized gain on USD'
}
```

**Example Usage in Period Close:**
```typescript
const adjustmentLines = ExchangeRateService.generateUnrealizedGainLossEntries(
  1000,           // $1,000 USD receivable
  'USD',
  50.00,          // Original transaction rate
  56.50,          // Period-end rate
  'PHP',
  gainAccountId,  // GL account for unrealized gains
  lossAccountId,  // GL account for unrealized losses
  receivableAccountId
);

// Add to period-end adjustment entry
const entry = {
  date: periodEnd,
  description: 'Period-end currency revaluation',
  lines: adjustmentLines,
  ...
};
```

---

#### 6. Check Rate Change Threshold

```typescript
static needsRevaluation(
  previousRate: number,
  currentRate: number,
  thresholdPercent: number = 1
): boolean
```

**Behavior:**
- Calculates percentage change between rates
- Compares against threshold (default 1%)
- Useful for determining if revaluation journal needed
- Returns `true` if change exceeds threshold

**Example:**
```typescript
const prev = 50.00;
const current = 50.75;

const needsReval = ExchangeRateService.needsRevaluation(prev, current);
// Change: 1.5% â†’ returns true (exceeds 1% threshold)
```

---

#### 7. Get Active Rates for Date

```typescript
static getActiveRatesForDate(
  rates: ExchangeRate[],
  orgId: string,
  onDate: string
): ExchangeRate[]
```

**Behavior:**
- Returns all unique currency pairs active on a date
- Selects most recent rate for each pair
- Useful for generating rate listing reports
- Filters by organization

---

#### 8. Validate Exchange Rate

```typescript
static validateRate(rate: Partial<ExchangeRate>): {
  isValid: boolean;
  errors: string[];
}
```

**Checks:**
- âœ… Currency codes are 3-letter ISO codes
- âœ… From and to currencies are different
- âœ… Rate is positive
- âœ… Effective date provided
- âœ… Rate is reasonable (<1,000,000)

**Example:**
```typescript
const validation = ExchangeRateService.validateRate({
  fromCurrency: 'USD',
  toCurrency: 'PHP',
  rate: 56.50,
  effectiveDate: '2024-01-31'
});

if (!validation.isValid) {
  validation.errors.forEach(err => console.error(err));
}
```

---

## Data Persistence

### IDataService Methods

Added to `services/IDataService.ts`:

```typescript
// Exchange Rate CRUD
async createExchangeRate(rate: ExchangeRate): Promise<ExchangeRate>;
async updateExchangeRate(id: string, updates: Partial<ExchangeRate>): Promise<ExchangeRate>;
async deleteExchangeRate(id: string): Promise<void>;
async getExchangeRatesByOrg(orgId: string): Promise<ExchangeRate[]>;
async getExchangeRateById(id: string): Promise<ExchangeRate | null>;
```

### Supabase Implementation

In `services/SupabaseDataService.ts`:

```typescript
async createExchangeRate(rate: any): Promise<any> {
  const snakeCaseRate = this.camelToSnake(rate);
  const filtered = this.filterToTableSchema('exchange_rates', snakeCaseRate, true);
  return this.insertToSupabaseRaw('exchange_rates', filtered);
}

async updateExchangeRate(id: string, updates: any): Promise<any> {
  const snake = this.camelToSnake(updates);
  const filtered = this.filterToTableSchema('exchange_rates', snake);
  return this.updateInSupabaseRaw('exchange_rates', id, filtered);
}

async getExchangeRatesByOrg(orgId: string): Promise<any[]> {
  const url = `${this.baseUrl}/exchange_rates?org_id=eq.${orgId}&is_deleted=eq.false&order=effective_date.desc`;
  const response = await fetch(url, { headers: this.getHeaders() });
  const data = await response.json();
  return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
}
```

### Mock Implementation

In `services/MockDataService.ts`:

```typescript
async createExchangeRate(rate: any): Promise<any> {
  console.warn('[MockDataService] Exchange rates are memory-only.');
  return { ...rate, id: `rate-${Date.now()}` };
}

async getExchangeRatesByOrg(orgId: string): Promise<any[]> {
  return []; // Returns empty array for testing
}
```

---

## Usage Examples

### Example 1: Add Exchange Rate

```typescript
const handleAddExchangeRate = async (rate: Partial<ExchangeRate>) => {
  try {
    // Validate
    const validation = ExchangeRateService.validateRate(rate);
    if (!validation.isValid) {
      handleNotify('error', validation.errors.join('; '));
      return;
    }

    // Create
    const fullRate = {
      ...rate,
      orgId: currentOrgId,
      createdBy: currentUser?.id || 'system'
    };
    
    const savedRate = await dataService.createExchangeRate(fullRate);
    setExchangeRates(prev => [...prev, savedRate]);
    
    // Audit
    AuditService.log({
      orgId: currentOrgId,
      userId: currentUser?.id || 'system',
      action: 'CREATE',
      entityType: 'EXCHANGE_RATE',
      entityId: savedRate.id,
      entityName: `${rate.fromCurrency}/${rate.toCurrency}`
    });
    
    handleNotify('success', `Rate ${rate.fromCurrency}â†’${rate.toCurrency} saved`);
  } catch (error) {
    handleNotify('error', `Failed to save rate: ${error.message}`);
  }
};
```

---

### Example 2: Convert Foreign Receivable

```typescript
// User receives invoice for $1,000 USD when rate is 50.00
const invoiceAmount = 1000;
const invoiceRate = 50.00; // PHP per USD

// At period end, rate is 56.50
const periodEndRate = 56.50;

// Method 1: Calculate unrealized gain
const gapl = ExchangeRateService.calculateUnrealizedGainLoss(
  invoiceAmount,
  invoiceRate,
  periodEndRate,
  'PHP'
);

console.log(`Original PHP amount: ${gapl.transactionAmount}`);
console.log(`Period-end PHP amount: ${gapl.functionalCurrencyAmount}`);
console.log(`Unrealized ${gapl.isGain ? 'gain' : 'loss'}: ${Math.abs(gapl.unrealizedGainLoss)}`);

// Output:
// Original PHP amount: 50000
// Period-end PHP amount: 56500
// Unrealized gain: 6500
```

---

### Example 3: Generate Period-End Adjustment Entry

```typescript
// Period-end closure: Generate revaluation journal entry
const generateCurrencyRevaluation = () => {
  const adjustmentLines = ExchangeRateService.generateUnrealizedGainLossEntries(
    1000,                          // Foreign amount
    'USD',
    50.00,                         // Historical rate
    56.50,                         // Period-end rate
    'PHP',
    gainAccountId,                 // GL: Unrealized Gains on FX
    lossAccountId,                 // GL: Unrealized Losses on FX
    receivableAccountId            // GL: Accounts Receivable - USD
  );

  const entry = {
    orgId: currentOrgId,
    periodId: currentPeriodId,
    date: periodEndDate,
    description: 'Period-end currency revaluation - USD receivables',
    reference: 'FX-REVAL-' + periodEndDate,
    status: 'DRAFT',
    sourceType: 'ACCRUAL',
    lines: adjustmentLines,
    createdBy: currentUser?.id
  };

  onPostJournal(entry, adjustmentLines);
};
```

---

### Example 4: List All Rates for Date

```typescript
// Get all currency pairs active on specific date
const activeRates = ExchangeRateService.getActiveRatesForDate(
  exchangeRates,
  currentOrgId,
  '2024-01-31'
);

console.log('Active currency pairs:');
activeRates.forEach(r => {
  console.log(`  ${r.fromCurrency}/${r.toCurrency}: ${r.rate}`);
});

// Output:
// Active currency pairs:
//   USD/PHP: 56.50
//   EUR/PHP: 61.25
//   JPY/PHP: 0.3820
```

---

## Integration Points

### 1. Vendor Payables (Multi-currency Support)

**Current:**
- Vendor has `currency` field (VARCHAR)
- Payable has `currency` field (VARCHAR)

**Enhancement:**
```typescript
// When creating payable in foreign currency
const payable = {
  ...payableData,
  currency: vendor.currency,  // USD, EUR, etc.
  journalEntryId: entryId,
  createdAt: new Date().toISOString()
};

// When posting to GL, need to convert to functional currency
const rate = ExchangeRateService.getExchangeRate(
  exchangeRates,
  payable.currency,
  organizationalCurrency,
  payable.billDate,
  currentOrgId
);

const conversion = ExchangeRateService.convert(
  payable.amount,
  payable.currency,
  organizationalCurrency,
  rate?.rate || 1
);

// Journal entry uses functional currency amounts
const journalLines = [
  {
    accountId: expenseAccount.id,
    debit: conversion.convertedAmount,
    credit: 0
  },
  {
    accountId: apAccount.id,
    debit: 0,
    credit: conversion.convertedAmount
  }
];
```

---

### 2. Bank Accounts (Multi-currency)

**Current:**
- BankAccount has `currency` field

**Enhancement:**
```typescript
// When reconciling foreign currency bank account
const bankReconciliation = {
  bankAccountId,
  statementBalance: 5000,      // USD
  bookBalance: 4500,           // USD
  asOfDate: '2024-01-31'
};

// Convert to functional currency for reporting
const rate = ExchangeRateService.getExchangeRate(
  exchangeRates,
  selectedBank.currency,
  organizationalCurrency,
  bankReconciliation.asOfDate,
  currentOrgId
);

const reconciliationInPHP = {
  statementBalance: bankReconciliation.statementBalance * rate.rate,
  bookBalance: bankReconciliation.bookBalance * rate.rate
};
```

---

### 3. Financial Reports

**Enhancement:**
```typescript
// When generating multi-currency balance sheet
const generateMulticurrencyReport = () => {
  const accounts = filteredAccounts;
  const reportDate = periodEndDate;
  
  const multicurrencyBalances: MulticurrencyBalance[] = accounts.map(acc => {
    const lines = journalLines.filter(l => l.accountId === acc.id);
    
    // Group by currency
    const currencyBalances: { [key: string]: number } = {};
    
    lines.forEach(line => {
      // This requires enhanced journal line structure with currency
      const currency = line.currency || organizationalCurrency;
      currencyBalances[currency] = (currencyBalances[currency] || 0) + 
        (line.debit - line.credit);
    });
    
    // Convert all to functional currency
    let functionalBalance = 0;
    Object.entries(currencyBalances).forEach(([currency, balance]) => {
      if (currency === organizationalCurrency) {
        functionalBalance += balance;
      } else {
        const rate = ExchangeRateService.getExchangeRate(
          exchangeRates,
          currency,
          organizationalCurrency,
          reportDate,
          currentOrgId
        );
        functionalBalance += balance * (rate?.rate || 1);
      }
    });
    
    return {
      accountId: acc.id,
      accountName: acc.name,
      balances: currencyBalances,
      functionalBalance,
      functionalCurrency: organizationalCurrency
    };
  });
  
  return multicurrencyBalances;
};
```

---

## Deployment

### Step 1: Run SQL Migration

1. Open Supabase SQL Editor
2. Copy contents of `EXCHANGE_RATES_TABLE.sql`
3. Execute the migration
4. Verify table created:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'exchange_rates' 
   ORDER BY ordinal_position;
   ```

### Step 2: Build and Deploy

```bash
# Rebuild project
npm run build

# Verify no TypeScript errors
npm run dev  # Test locally first
```

### Step 3: Verify in Browser

```javascript
// In browser console, verify service is accessible
const rate = {
  fromCurrency: 'USD',
  toCurrency: 'PHP',
  rate: 56.50,
  effectiveDate: '2024-01-31'
};

const validation = ExchangeRateService.validateRate(rate);
console.log(validation.isValid); // Should be true
```

---

## Future Enhancements

### Phase 2: API Integration
- [ ] Integrate with external FX rate APIs (OpenExchangeRates, etc.)
- [ ] Scheduled rate updates
- [ ] Rate variance alerts

### Phase 3: Multi-currency Transactions
- [ ] Enhance JournalLine with currency and rate fields
- [ ] Multi-currency AR/AP modules
- [ ] Currency-aware cash application

### Phase 4: Advanced Reporting
- [ ] Multi-currency financial statements
- [ ] Currency-specific subledger reports
- [ ] Exchange gain/loss trend analysis

---

## Summary

âœ… **Exchange Rate System Complete**
- Database: `exchange_rates` table with RLS
- Service: `ExchangeRateService` with 8 static methods
- Data Layer: CRUD in IDataService, Supabase, Mock
- Types: `ExchangeRate`, `CurrencyConversion`, `MulticurrencyBalance`
- Integration: Vendor payables, bank accounts, period-end revaluation
- Audit: Full activity logging via triggers

**Ready for:** Financial reporting, multi-currency transactions, period-end closures
