# Recurring Journal Entries Implementation Guide

## Overview

The **Recurring Journal Entries** feature automates the creation and posting of journal entries based on configurable schedules. This is essential for:
- Monthly rent or lease payments
- Depreciation entries
- Regular accrual adjustments
- Subscription or maintenance costs
- Recurring payroll accruals

## Architecture

### Type Definitions

#### RecurringJournalEntry Interface
```typescript
interface RecurringJournalEntry extends BaseEntity {
  orgId: string;
  name: string;
  description?: string;
  
  // Scheduling
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  lastRunDate?: string;
  
  // Execution
  maxRuns?: number;
  timesRun: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'INACTIVE';
  autoPost: boolean;
  
  // Template
  templateEntry: {
    description: string;
    lineTemplate: Array<{
      accountId: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>;
  };
  
  // Tracking
  lastGeneratedEntryId?: string;
}
```

#### RecurrenceFrequency Enum
```typescript
type RecurrenceFrequency = 
  | 'DAILY'        // Every day
  | 'WEEKLY'       // Every 7 days
  | 'BIWEEKLY'     // Every 14 days
  | 'MONTHLY'      // Same day each month (if possible)
  | 'QUARTERLY'    // Every 3 months
  | 'SEMIANNUAL'   // Every 6 months
  | 'ANNUAL'       // Every 12 months
  | 'CUSTOM';      // Custom interval
```

### Service Layer

#### RecurringJournalEntryService

Static utility service with 13 methods for scheduling, generation, and management:

**Schedule Management:**
- `calculateNextRunDate(entry)` - Computes next execution date based on frequency
- `getScheduleInfo(entry)` - Returns detailed schedule information
- `isDueToRun(entry)` - Checks if entry should execute today
- `isCompleted(entry)` - Checks if max runs or end date reached

**Entry Generation:**
- `generateEntryFromTemplate(entry)` - Creates JournalEntry from template
- `createRecurringTemplate(data)` - Creates new RecurringJournalEntry from data
- `updateAfterExecution(entry, journalEntryId)` - Updates post-execution state

**Status Management:**
- `pause(entry)` - Pauses future executions
- `resume(entry)` - Resumes from pause
- `cancel(entry)` - Cancels all future executions

**Batch Operations:**
- `filterDueEntries(entries)` - Finds all entries due to run
- `getSummary(entries)` - Returns aggregated statistics
- `getStatistics(entries)` - Detailed execution metrics

**Validation:**
- `validate(data)` - Validates entry data before creation

### Data Layer Integration

#### IDataService Methods
```typescript
// Create new recurring entry
createRecurringJournalEntry(entry: RecurringJournalEntry): Promise<RecurringJournalEntry>;

// Update existing entry
updateRecurringJournalEntry(id: string, updates: Partial<RecurringJournalEntry>): Promise<RecurringJournalEntry>;

// Delete entry (soft delete by default)
deleteRecurringJournalEntry(id: string): Promise<void>;

// Get all entries for organization
getRecurringJournalEntriesByOrg(orgId: string): Promise<RecurringJournalEntry[]>;

// Get specific entry
getRecurringJournalEntryById(id: string): Promise<RecurringJournalEntry | null>;
```

### App Integration

#### State Management
```typescript
const [recurringJournalEntries, setRecurringJournalEntries] = useState<any[]>([]);
```

#### Handlers

**Create Handler:**
```typescript
const handleAddRecurringJournalEntry = async (entry: any) => {
  const created = await dataService.createRecurringJournalEntry({
    ...entry,
    orgId: currentOrgId
  });
  setRecurringJournalEntries(prev => [...prev, created]);
  AuditService.create(...);
};
```

**Update Handler:**
```typescript
const handleUpdateRecurringJournalEntry = async (id: string, updates: any) => {
  const updated = await dataService.updateRecurringJournalEntry(id, updates);
  setRecurringJournalEntries(prev => prev.map(e => e.id === id ? updated : e));
  AuditService.update(...);
};
```

**Delete Handler:**
```typescript
const handleDeleteRecurringJournalEntry = async (id: string) => {
  await dataService.deleteRecurringJournalEntry(id);
  setRecurringJournalEntries(prev => prev.filter(e => e.id !== id));
  AuditService.hardDelete(...);
};
```

**Execute Handler:**
```typescript
const handleRunRecurringEntry = async (id: string) => {
  const entry = recurringJournalEntries.find(e => e.id === id);
  
  // Check if due
  if (!RecurringJournalEntryService.isDueToRun(entry)) return;
  
  // Generate and post entry
  const newJournalEntry = RecurringJournalEntryService.generateEntryFromTemplate(entry);
  const created = await dataService.createJournalEntry(newJournalEntry);
  
  // Update recurring entry
  const updated = RecurringJournalEntryService.updateAfterExecution(entry, created.id);
  await dataService.updateRecurringJournalEntry(id, updated);
  
  // Track in audit log
  AuditService.create(...);
};
```

## Frequency Calculation Logic

### Daily
- Adds 1 day to last run date (or start date if first run)

### Weekly
- Adds 7 days to last run date

### Biweekly
- Adds 14 days to last run date

### Monthly
- Maintains same day of month
- If last day of month, maintains as last day
- If day doesn't exist (e.g., Feb 31), uses last day of month

### Quarterly
- Adds 3 months to last run date
- Maintains day of month rules (same as monthly)

### Semiannual
- Adds 6 months to last run date
- Maintains day of month rules

### Annual
- Adds 12 months to last run date
- Maintains day of month rules

### Custom
- Uses custom interval (days) parameter
- Adds specified number of days to last run date

## Execution Logic

### Auto-Posting Workflow

1. **Scheduler Check** (Daily/Batch Process)
   - Query `recurring_journal_entries` where status='ACTIVE' and nextRunDate <= today
   - Filter by organization

2. **Execution**
   - For each due entry:
     - Check `isCompleted()` - skip if maxRuns reached or endDate passed
     - Generate JournalEntry from template
     - Create journal entry (posts if autoPost=true)
     - Update recurring entry with lastGeneratedEntryId, lastRunDate, timesRun

3. **Schedule Update**
   - Calculate new nextRunDate
   - Update recurring entry status
   - If maxRuns reached or endDate passed, set status='COMPLETED'

### Manual Execution
- User clicks "Run" button on active recurring entry
- Same logic applies: check isDueToRun, generate, post, update

## Database Schema

### recurring_journal_entries Table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| org_id | UUID | Organization (FK, cascade delete) |
| name | VARCHAR(255) | Entry template name |
| description | TEXT | Optional description |
| frequency | VARCHAR(50) | ENUM: DAILY, WEEKLY, etc. |
| start_date | DATE | First scheduled run date |
| end_date | DATE | Optional: stop date |
| next_run_date | DATE | Calculated next execution |
| last_run_date | DATE | When last executed |
| max_runs | INTEGER | Optional: maximum executions |
| times_run | INTEGER | Counter: number of executions |
| status | VARCHAR(50) | ENUM: ACTIVE, PAUSED, COMPLETED, INACTIVE |
| auto_post | BOOLEAN | Auto-post generated entries |
| last_generated_entry_id | UUID | Link to last JournalEntry |
| template_entry | JSONB | Template with description and lineTemplate |
| created_by | UUID | Created by user (FK) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_by | UUID | Last updated by user (FK) |
| updated_at | TIMESTAMP | Last update timestamp |
| is_deleted | BOOLEAN | Soft delete flag |
| deleted_by | UUID | Deleted by user (FK) |
| deleted_at | TIMESTAMP | Delete timestamp |

### Indexes
- `org_id` - Filter by organization
- `status` - Find active entries
- `next_run_date` - Find due entries
- `created_at` - Sort by recency

### RLS Policies
- Users can only access recurring entries from their assigned organizations
- Select, Insert, Update, Delete all filtered by organization

## Mock Data

MockDataService initializes empty array:
```typescript
getInitialData() {
  return {
    ...
    recurringJournalEntries: []
  };
}
```

## Audit Trail Integration

All operations logged via AuditService:
- **CREATE**: When new recurring entry created
  - `action: 'CREATE'`
  - `entityType: 'RECURRING_JOURNAL_ENTRY'`
  - `entityName: entry.name`

- **UPDATE**: When entry paused, resumed, or schedule changed
  - `action: 'UPDATE'`
  - Tracks before/after values

- **DELETE**: When entry soft-deleted
  - `action: 'DELETE'`
  - Via `AuditService.hardDelete()`

- **Auto-Generated Entries**: Linked to source recurring entry
  - Journal entry has `recurringEntryId` field
  - Audit log notes auto-generation source

## UI Integration Points

### Recurring Entries View
- List all recurring entries for organization
- Filter by status (ACTIVE, PAUSED, COMPLETED, INACTIVE)
- Show next run date, last run date, times run

### Template Editor
- Edit description and journal entry lines
- Adjust frequency, start date, end date
- Set maxRuns or leave unlimited

### Execution Controls
- "Run Now" button (if due or force run)
- "Pause" button (status -> PAUSED)
- "Resume" button (status -> ACTIVE)
- "Cancel" button (status -> INACTIVE)
- "View Generated Entries" link

### Dashboard/Ledger Integration
- Show count of active recurring entries
- Display due-to-run entries
- Show next scheduled executions
- Link generated entries back to templates

## Testing & Validation

### Business Logic Tests
1. All frequency calculations generate correct dates
2. isDueToRun() returns true when nextRunDate <= today
3. isCompleted() respects maxRuns and endDate
4. Auto-posting correctly creates balanced journal entries
5. Pause/resume toggles status correctly
6. Max runs enforcement stops execution

### Data Integration Tests
1. Create/Read/Update/Delete all work in Mock and Supabase
2. Organization isolation enforced via RLS
3. Soft delete preserved history
4. Audit logs created for all operations

### Edge Cases
1. Month-end handling (Feb 28/29 on leap year)
2. Custom intervals with various day counts
3. Canceling completed entries
4. Resuming entries past endDate
5. Multiple recurring entries due on same day

## Performance Considerations

1. **Index Strategy**
   - Query due entries: `WHERE status='ACTIVE' AND nextRunDate <= today`
   - Add composite index on (status, nextRunDate)

2. **Batch Processing**
   - Process all due entries in single transaction
   - Use background job/scheduled function for automation

3. **Archive Old Entries**
   - Move COMPLETED entries to archive table after 1 year
   - Keep recent data in active table

## Migration Steps

1. **Create Table & RLS**
   - Run RECURRING_JOURNAL_ENTRIES_MIGRATION.sql in Supabase
   - Verify RLS policies active

2. **Deploy Code**
   - Update types.ts with RecurringJournalEntry
   - Create RecurringJournalEntryService.ts
   - Update IDataService, MockDataService, SupabaseDataService
   - Add handlers to App.tsx
   - Update AuditService entity types

3. **Create UI**
   - Build RecurringEntriesView component
   - Integrate into tab navigation
   - Add to sidebar menu

4. **Test End-to-End**
   - Create recurring entry
   - Verify nextRunDate calculated correctly
   - Execute entry, verify journal entry created
   - Check recurring entry updated with execution info
   - Verify audit log entries created

## Known Limitations

1. **No Scheduled Execution** - Currently manual or API-driven; background job needed for automation
2. **Simple Calculations** - Custom intervals only; no complex expressions (e.g., "last business day of month")
3. **No Grouping** - Recurring entries execute independently; no batch templating
4. **Limited Template** - Only one template per entry; no conditional variations

## Future Enhancements

1. **Scheduled Execution** - Background worker to auto-run due entries daily
2. **Advanced Frequency** - Support "last day of month", "first business day", etc.
3. **Bulk Templates** - Create multiple recurring entries from single definition
4. **Conditional Logic** - Run entry only if conditions met (e.g., "if balance > X")
5. **Override Amounts** - Allow manual adjustments to generated amounts per execution
6. **Email Notifications** - Alert when entry executed or due to run

## Related Features

- **Journal Entries** - Generated entries stored as regular journal entries with recurringEntryId link
- **Bank Reconciliation** - Can be used to generate clearing entries for recurring transfers
- **Audit Trail** - All executions logged with timestamps and user information
- **Payroll** - Payroll run can use similar recurring template logic for regular accruals

