# Recurring Journal Entries - Quick Reference

## Quick Start

### Create a Recurring Entry
```typescript
const entry = await dataService.createRecurringJournalEntry({
  orgId: currentOrgId,
  name: "Monthly Rent Payment",
  description: "Monthly rent for office space",
  frequency: "MONTHLY",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  maxRuns: 12,
  autoPost: true,
  templateEntry: {
    description: "Rent payment",
    lineTemplate: [
      { accountId: "EXPENSE-RENT", debit: 5000 },
      { accountId: "CASH", credit: 5000 }
    ]
  }
});
```

### Check If Due to Run
```typescript
const isDue = RecurringJournalEntryService.isDueToRun(entry);
if (isDue) {
  // Execute entry
}
```

### Execute Recurring Entry
```typescript
const newJournalEntry = RecurringJournalEntryService.generateEntryFromTemplate(entry);
const created = await dataService.createJournalEntry(newJournalEntry);

const updated = RecurringJournalEntryService.updateAfterExecution(entry, created.id);
await dataService.updateRecurringJournalEntry(entry.id, updated);
```

### Pause Entry
```typescript
const paused = RecurringJournalEntryService.pause(entry);
await dataService.updateRecurringJournalEntry(entry.id, paused);
```

### Resume Entry
```typescript
const resumed = RecurringJournalEntryService.resume(entry);
await dataService.updateRecurringJournalEntry(entry.id, resumed);
```

### Find All Due Entries
```typescript
const dueEntries = RecurringJournalEntryService.filterDueEntries(
  recurringJournalEntries
);
```

## Frequency Types

| Frequency | Interval | Example |
|-----------|----------|---------|
| DAILY | Every day | Processing fee accrual |
| WEEKLY | Every 7 days | Weekly team meeting accrual |
| BIWEEKLY | Every 14 days | Bi-weekly payroll accrual |
| MONTHLY | Same day each month | Rent, subscriptions |
| QUARTERLY | Every 3 months | Quarterly tax estimates |
| SEMIANNUAL | Every 6 months | Semi-annual interest accrual |
| ANNUAL | Every 12 months | Annual depreciation |
| CUSTOM | Custom interval (days) | Custom intervals |

## Entry Status Flow

```
ACTIVE ---pause---> PAUSED
  |                    |
  |                resume
  |                    |
  |                 ACTIVE
  |
  ├--maxRuns reached--> COMPLETED
  |
  └--endDate passed---> COMPLETED

PAUSED ---cancel---> INACTIVE
ACTIVE ---cancel---> INACTIVE
COMPLETED ---cancel--> INACTIVE
```

## Common Scenarios

### Monthly Depreciation
```javascript
{
  name: "Equipment Depreciation",
  frequency: "MONTHLY",
  startDate: "2024-01-01",
  maxRuns: 60,  // 5 years
  templateEntry: {
    description: "Accumulated depreciation",
    lineTemplate: [
      { accountId: "DEPRECIATION_EXPENSE", debit: 500 },
      { accountId: "ACCUMULATED_DEPRECIATION", credit: 500 }
    ]
  }
}
```

### Quarterly Tax Estimate
```javascript
{
  name: "Quarterly Tax Estimate",
  frequency: "QUARTERLY",
  startDate: "2024-01-15",
  endDate: "2024-12-31",
  templateEntry: {
    description: "Estimated tax payment",
    lineTemplate: [
      { accountId: "TAX_EXPENSE", debit: 25000 },
      { accountId: "CASH", credit: 25000 }
    ]
  }
}
```

### Weekly Accrual
```javascript
{
  name: "Weekly Service Fee Accrual",
  frequency: "WEEKLY",
  startDate: "2024-01-01",
  autoPost: true,
  templateEntry: {
    description: "Weekly service fee",
    lineTemplate: [
      { accountId: "SERVICE_EXPENSE", debit: 1000 },
      { accountId: "ACCRUED_EXPENSES", credit: 1000 }
    ]
  }
}
```

## Database Schema Quick Look

| Field | Type | Purpose |
|-------|------|---------|
| name | VARCHAR | Template name |
| frequency | VARCHAR | Recurrence pattern |
| startDate | DATE | First execution date |
| endDate | DATE | (Optional) Stop date |
| nextRunDate | DATE | Calculated: when to run next |
| maxRuns | INTEGER | (Optional) Stop after N runs |
| timesRun | INTEGER | Counter: how many times run |
| status | VARCHAR | ACTIVE/PAUSED/COMPLETED/INACTIVE |
| autoPost | BOOLEAN | Auto-post generated entries |
| templateEntry | JSONB | Entry template definition |

## Calculation Examples

### Monthly - Jan 15, startDate=Jan 1
```
Run 1: Jan 15
Run 2: Feb 15
Run 3: Mar 15
Run 4: Apr 15 (but Feb doesn't have 15th on leap year - uses Feb 15)
```

### Monthly - Jan 31, startDate=Jan 1
```
Run 1: Jan 31
Run 2: Feb 28 (Feb has no 31st)
Run 3: Mar 31
Run 4: Apr 30 (Apr has no 31st)
```

### Quarterly - Jan 15, frequency=QUARTERLY
```
Run 1: Jan 15
Run 2: Apr 15
Run 3: Jul 15
Run 4: Oct 15
```

### Annual - Feb 29 (leap year), frequency=ANNUAL
```
Run 1: Feb 29, 2024
Run 2: Feb 28, 2025 (2025 is not a leap year)
Run 3: Feb 28, 2026
Run 4: Feb 29, 2028 (2028 is a leap year)
```

## Common Patterns

### Recurring Monthly Rent
```typescript
{
  name: "Monthly Rent - Office",
  frequency: "MONTHLY",
  startDate: "2024-01-01",
  autoPost: true,
  templateEntry: {
    description: "January rent payment",
    lineTemplate: [
      { accountId: "RENT_EXPENSE", debit: 5000 },
      { accountId: "CASH", credit: 5000 }
    ]
  }
}
```

### Recurring Biweekly Payroll Accrual
```typescript
{
  name: "Biweekly Payroll Accrual",
  frequency: "BIWEEKLY",
  startDate: "2024-01-05",
  autoPost: true,
  templateEntry: {
    description: "Payroll accrual",
    lineTemplate: [
      { accountId: "PAYROLL_EXPENSE", debit: 50000 },
      { accountId: "ACCRUED_PAYROLL", credit: 50000 }
    ]
  }
}
```

### Annual Depreciation
```typescript
{
  name: "Annual Depreciation - Building",
  frequency: "ANNUAL",
  startDate: "2024-12-31",
  maxRuns: 40,  // 40 years useful life
  autoPost: true,
  templateEntry: {
    description: "Annual depreciation",
    lineTemplate: [
      { accountId: "DEPRECIATION_EXPENSE", debit: 25000 },
      { accountId: "ACCUMULATED_DEPRECIATION_BLDG", credit: 25000 }
    ]
  }
}
```

## Testing Checklist

- [ ] Create new recurring entry
- [ ] Verify nextRunDate calculated correctly
- [ ] Run entry, check journal entry created
- [ ] Verify recurring entry updated (timesRun, lastRunDate, lastGeneratedEntryId)
- [ ] Pause recurring entry
- [ ] Resume recurring entry
- [ ] Cancel recurring entry
- [ ] Verify status changes appear in UI
- [ ] Check audit log entries created
- [ ] Delete recurring entry
- [ ] Verify soft delete (is_deleted flag set)

## Troubleshooting

### Entry not running
- Check status is ACTIVE (not PAUSED or COMPLETED)
- Check nextRunDate <= today
- Check maxRuns not exceeded
- Check endDate not passed

### Wrong next run date
- Verify frequency is correct
- Check for month-end handling
- Try calculateNextRunDate() directly in console

### Generated entries not posting
- Check autoPost = true
- Verify templateEntry has valid accountIds
- Check debits = credits
- Check chart of accounts populated

### Audit logs missing
- Verify AuditService.create called
- Check RECURRING_JOURNAL_ENTRY in EntityType enum
- Verify audit_logs table exists

## API Reference

### RecurringJournalEntryService Methods

```typescript
// Schedule calculations
calculateNextRunDate(entry: RecurringJournalEntry): string
getScheduleInfo(entry: RecurringJournalEntry): RecurrenceSchedule
isDueToRun(entry: RecurringJournalEntry): boolean
isCompleted(entry: RecurringJournalEntry): boolean

// Entry generation
generateEntryFromTemplate(entry: RecurringJournalEntry): JournalEntry
createRecurringTemplate(data: any): RecurringJournalEntry
updateAfterExecution(entry: RecurringJournalEntry, journalEntryId: string): RecurringJournalEntry

// Status management
pause(entry: RecurringJournalEntry): RecurringJournalEntry
resume(entry: RecurringJournalEntry): RecurringJournalEntry
cancel(entry: RecurringJournalEntry): RecurringJournalEntry

// Batch operations
filterDueEntries(entries: RecurringJournalEntry[]): RecurringJournalEntry[]
getSummary(entries: RecurringJournalEntry[]): Summary
getStatistics(entries: RecurringJournalEntry[]): Statistics

// Validation
validate(data: any): boolean
```

## Performance Tips

1. **Batch Execution** - Process all due entries in single transaction
2. **Lazy Load** - Don't load all recurring entries upfront if many exist
3. **Caching** - Cache generated entries in state, update only on changes
4. **Indexes** - Use (status, nextRunDate) index for due entry queries
5. **Archive** - Move COMPLETED entries to archive after 1+ year

