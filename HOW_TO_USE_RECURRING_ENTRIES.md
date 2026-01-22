# How to Use Recurring Journal Entries

## Overview
Recurring Journal Entries allow you to automate the creation and posting of journal entries based on predefined schedules (daily, weekly, monthly, quarterly, etc.).

## Common Use Cases

### 1. Monthly Rent Payment
Create a recurring entry to automatically post rent expense every month:

```javascript
handleAddRecurringJournalEntry({
  name: "Monthly Rent - Office Space",
  description: "Recurring office rent payment",
  frequency: "MONTHLY",
  startDate: "2024-01-01",
  maxRuns: 12,  // One year
  autoPost: true,  // Auto-post the entry
  templateEntry: {
    description: "Monthly office rent",
    lineTemplate: [
      { 
        accountId: "RENT_EXPENSE",  // Expense account
        debit: 5000 
      },
      { 
        accountId: "CASH",  // Asset account
        credit: 5000 
      }
    ]
  }
});
```

**Result**: Every month on the 1st, a $5,000 debit to Rent Expense and credit to Cash is automatically created and posted.

---

### 2. Quarterly Tax Estimate Payment
Create a recurring entry for estimated tax payments:

```javascript
handleAddRecurringJournalEntry({
  name: "Quarterly Estimated Tax Payment",
  frequency: "QUARTERLY",
  startDate: "2024-04-15",  // First payment date
  endDate: "2024-12-31",
  autoPost: true,
  templateEntry: {
    description: "Estimated tax payment",
    lineTemplate: [
      { 
        accountId: "TAX_EXPENSE",
        debit: 25000 
      },
      { 
        accountId: "CASH",
        credit: 25000 
      }
    ]
  }
});
```

**Result**: 
- April 15: $25,000 tax payment
- July 15: $25,000 tax payment
- October 15: $25,000 tax payment
- Stops after 3 payments

---

### 3. Biweekly Payroll Accrual
Create a recurring entry for regular payroll accruals:

```javascript
handleAddRecurringJournalEntry({
  name: "Biweekly Payroll Accrual",
  frequency: "BIWEEKLY",
  startDate: "2024-01-05",
  autoPost: true,
  templateEntry: {
    description: "Biweekly payroll accrual",
    lineTemplate: [
      { 
        accountId: "PAYROLL_EXPENSE",
        debit: 50000 
      },
      { 
        accountId: "ACCRUED_PAYROLL",
        credit: 50000 
      }
    ]
  }
});
```

**Result**: Every 2 weeks, a $50,000 payroll accrual is created (no max limit, continues indefinitely).

---

### 4. Annual Depreciation
Create a recurring entry for equipment depreciation:

```javascript
handleAddRecurringJournalEntry({
  name: "Annual Equipment Depreciation",
  frequency: "ANNUAL",
  startDate: "2024-12-31",  // Year-end
  maxRuns: 10,  // 10-year useful life
  autoPost: true,
  templateEntry: {
    description: "Annual depreciation - equipment",
    lineTemplate: [
      { 
        accountId: "DEPRECIATION_EXPENSE",
        debit: 50000 
      },
      { 
        accountId: "ACCUMULATED_DEPRECIATION_EQUIPMENT",
        credit: 50000 
      }
    ]
  }
});
```

**Result**: Every year on December 31st, a $50,000 depreciation entry is posted for 10 years.

---

### 5. Weekly Service Fee Accrual
Create a recurring entry for weekly service fees:

```javascript
handleAddRecurringJournalEntry({
  name: "Weekly Service Fee",
  frequency: "WEEKLY",
  startDate: "2024-01-01",
  autoPost: true,
  templateEntry: {
    description: "Weekly service fee accrual",
    lineTemplate: [
      { 
        accountId: "SERVICE_EXPENSE",
        debit: 1000 
      },
      { 
        accountId: "ACCRUED_SERVICE_EXPENSE",
        credit: 1000 
      }
    ]
  }
});
```

**Result**: Every week (same day of week), a $1,000 service fee accrual is created.

---

## Managing Recurring Entries

### Check If Entry Is Due
```javascript
const isDue = RecurringJournalEntryService.isDueToRun(recurringEntry);
if (isDue) {
  console.log("This entry should run today!");
}
```

### Manually Run an Entry (If Due)
```javascript
// In React component with access to handlers:
await handleRunRecurringEntry(entryId);
```

The handler will:
1. Check if entry is due
2. Generate a journal entry from the template
3. Post the entry (if autoPost=true)
4. Update the recurring entry with execution info
5. Log the action in the audit trail

### Pause an Entry (Stop Running)
```javascript
handleUpdateRecurringJournalEntry(entryId, {
  status: 'PAUSED'
});
```

**Result**: Entry stops running. You can resume later.

### Resume a Paused Entry
```javascript
handleUpdateRecurringJournalEntry(entryId, {
  status: 'ACTIVE'
});
```

**Result**: Entry resumes running on its next scheduled date.

### Cancel an Entry (Stop Permanently)
```javascript
handleUpdateRecurringJournalEntry(entryId, {
  status: 'INACTIVE'
});
```

**Result**: Entry permanently stops. Cannot be resumed.

### Delete an Entry
```javascript
handleDeleteRecurringJournalEntry(entryId);
```

**Result**: Entry is soft-deleted (marked as deleted in database, history preserved).

---

## Frequency Types Explained

### DAILY
- Runs every single day
- **Use case**: Daily processing fees, daily adjustments

### WEEKLY
- Runs every 7 days on the same day of week
- **Use case**: Weekly accruals, weekly fees

### BIWEEKLY
- Runs every 14 days
- **Use case**: Biweekly payroll, biweekly subscriptions

### MONTHLY
- Runs on the same day each month
- **Smart handling**: If day doesn't exist (e.g., Feb 31), uses last day of month
- **Use case**: Monthly rent, monthly subscriptions, monthly interest

### QUARTERLY
- Runs every 3 months (same day)
- **Use case**: Quarterly tax payments, quarterly bonuses, quarterly reports

### SEMIANNUAL
- Runs every 6 months (same day)
- **Use case**: Semi-annual insurance premiums, semi-annual reviews

### ANNUAL
- Runs every 12 months (same day)
- **Use case**: Annual depreciation, annual maintenance, annual licenses

### CUSTOM
- Runs every N days (you specify the number)
- **Use case**: Custom intervals like every 35 days, every 90 days

---

## Important Concepts

### Status States
- **ACTIVE**: Entry is running and will execute on schedule
- **PAUSED**: Entry is temporarily stopped but can be resumed
- **COMPLETED**: Entry has finished (maxRuns reached or endDate passed)
- **INACTIVE**: Entry has been canceled and will not run again

### Auto-Post
- **autoPost: true** - Journal entry is automatically posted
- **autoPost: false** - Journal entry created as DRAFT, must be manually posted

### Max Runs
- Optional field that limits how many times an entry will run
- Example: `maxRuns: 12` means the entry will run exactly 12 times, then auto-complete
- If not set, entry will continue running indefinitely

### End Date
- Optional field that stops the entry from running after a certain date
- Example: `endDate: "2024-12-31"` means entry stops running on this date
- If not set, entry continues based on other constraints

### Template Entry
- Defines the journal entry structure to use
- Contains account references and amounts
- All generated entries will follow this template

---

## Common Scheduling Patterns

### Month-End Accruals
```javascript
// Runs on the last day of each month
startDate: "2024-01-31",  // January has 31 days
frequency: "MONTHLY"
// Also runs Feb 28, Mar 31, Apr 30, etc.
```

### Mid-Month Payments
```javascript
// Runs on the 15th of each month
startDate: "2024-01-15",
frequency: "MONTHLY"
// Runs Feb 15, Mar 15, Apr 15, etc.
```

### First Day of Month
```javascript
// Runs on the 1st of each month
startDate: "2024-01-01",
frequency: "MONTHLY"
// Runs Feb 1, Mar 1, Apr 1, etc.
```

### Year-End Entries
```javascript
// Runs on December 31st each year
startDate: "2024-12-31",
frequency: "ANNUAL"
// Runs Dec 31 each year
```

### Quarterly with Specific Months
```javascript
// Runs Jan 15, Apr 15, Jul 15, Oct 15
startDate: "2024-01-15",
frequency: "QUARTERLY"
```

---

## Data Structure

Each recurring entry stores:
- **name**: Descriptive name
- **description**: Details about the entry
- **frequency**: How often it runs (DAILY, MONTHLY, etc.)
- **startDate**: When to start
- **endDate**: When to stop (optional)
- **nextRunDate**: System-calculated next execution date
- **lastRunDate**: When it last executed
- **maxRuns**: Max executions (optional)
- **timesRun**: Counter of how many times executed
- **status**: ACTIVE, PAUSED, COMPLETED, INACTIVE
- **autoPost**: Whether to automatically post
- **templateEntry**: The journal entry structure
- **lastGeneratedEntryId**: Link to last created entry
- **created/updated/deleted**: Audit fields

---

## Troubleshooting

### Entry Not Running?
1. **Check Status**: Must be ACTIVE (not PAUSED, COMPLETED, INACTIVE)
2. **Check Date**: nextRunDate must be ≤ today
3. **Check Limits**: maxRuns not exceeded, endDate not passed

### Wrong Schedule?
1. **Verify Frequency**: Check if MONTHLY runs on correct day
2. **Check Start Date**: Entry won't run before startDate
3. **Month-End Logic**: Feb 30/31 dates are handled specially

### Entries Not Posting?
1. **Check autoPost**: If false, entries are DRAFT not POSTED
2. **Check Accounts**: Account IDs must exist in chart of accounts
3. **Check Balance**: Debits must equal credits in template

### Can't Find Entry?
1. **Organization**: Entry filtered by current organization
2. **Soft Delete**: Deleted entries still exist with is_deleted flag
3. **State Loading**: Might need to refresh to see new entries

---

## Best Practices

### 1. Use Clear Names
```javascript
// Good
name: "Monthly Rent - Office Space"

// Bad  
name: "rent"
```

### 2. Add Descriptions
```javascript
// Good
description: "Recurring office rent payment to landlord"

// Bad
templateEntry.description: "rent"
```

### 3. Set Realistic Limits
```javascript
// Good
maxRuns: 60,  // Know how long entry should run

// Bad
maxRuns: 999999  // Unclear when it stops
```

### 4. Use Appropriate Amounts
```javascript
// Good
debit: 5000,  // Clear amount
credit: 5000

// Bad
debit: 5000.50,  // Pennies cause rounding issues
credit: 5000
```

### 5. Keep Account IDs Consistent
```javascript
// Good - use account IDs from chart of accounts
accountId: "RENT_EXPENSE"
accountId: "CASH"

// Bad - generic names
accountId: "expense_1"
accountId: "bank_1"
```

### 6. Monitor Execution
```javascript
// Check how many times executed
console.log(entry.timesRun);

// Check when it last ran
console.log(entry.lastRunDate);

// Check when next will run
console.log(entry.nextRunDate);
```

---

## Summary

Recurring Journal Entries automate repetitive accounting tasks:
- ✅ Create once, runs automatically
- ✅ Flexible scheduling (all frequency types)
- ✅ Audit trail tracking
- ✅ Easy management (pause, resume, cancel)
- ✅ Error handling and notifications
- ✅ Organization isolation (multi-tenant safe)

**Start using it today by calling `handleAddRecurringJournalEntry()`**

