# Treasury (Bank Accounts) CRUD - Quick Reference

## Status: ✅ COMPLETE

The Treasury module is fully wired for Supabase CRUD operations.

## Architecture

### TypeScript Interface (`types.ts`)
```typescript
interface BankAccount {
  id: string;
  orgId: string;
  bankName: string;
  accountNumber: string;
  type: 'SAVINGS' | 'CHECKING' | 'CREDIT' | 'CASH';
  glAccountId: string;
  currency: string;
  balance: number;
  createdAt?: string;
  updatedAt?: string;
  // BaseEntity soft-delete
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}
```

### Data Service Methods (`SupabaseDataService.ts`)
- `createBankAccount(account)` - Insert new bank account
- `updateBankAccount(id, updates)` - Update existing account
- `deleteBankAccount(id)` - Delete account (hard delete)

### App Handlers (`App.tsx`)
- `handleAddBankAccount(bank)` - Creates with orgId, updates state
- `handleUpdateBankAccount(id, updates)` - Updates and refreshes state
- `handleDeleteBankAccount(id)` - Deletes and removes from state

### View (`views/BankingView.tsx`)
Props received:
- `bankAccounts` - Filtered by orgId
- `onAddBankAccount` - Calls App handler
- `onUpdateBankAccount` - Calls App handler  
- `onDeleteBankAccount` - Calls App handler

## Supabase Setup

### 1. Run the SQL Script
Execute `BANK_ACCOUNTS_TABLE.sql` in Supabase SQL Editor.

### 2. Table Structure
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| org_id | UUID | FK to organizations |
| bank_name | VARCHAR(255) | Bank/institution name |
| account_number | VARCHAR(100) | Account number |
| type | VARCHAR(20) | SAVINGS, CHECKING, CREDIT, CASH |
| gl_account_id | UUID | FK to chart of accounts |
| currency | VARCHAR(10) | Currency code (default: PHP) |
| balance | DECIMAL(18,2) | Current balance |
| is_deleted | BOOLEAN | Soft delete flag |
| deleted_at | TIMESTAMPTZ | When deleted |
| deleted_by | UUID | Who deleted |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |

### 3. RLS Policies Included
- SELECT: Users can view bank accounts in their org
- INSERT: Users can add bank accounts to their org
- UPDATE: Users can update bank accounts in their org
- DELETE: Users can delete bank accounts in their org

## Usage Flow

### Add Bank Account
1. Go to Treasury/Banking view
2. Click "Link Bank Account"
3. Fill in:
   - Bank Name (required)
   - Account Number
   - Account Type (Savings/Checking/Credit/Cash)
   - GL Account (required - links to Chart of Accounts)
   - Currency
   - Opening Balance
4. Click Save

### Update Bank Account
1. Select a bank account from the list
2. Click Edit (pencil icon)
3. Modify fields
4. Save changes

### Delete Bank Account
1. Select a bank account
2. Click Delete (trash icon)
3. Confirm deletion

## Column Mapping (TypeScript ↔ PostgreSQL)

| TypeScript | PostgreSQL |
|------------|------------|
| bankName | bank_name |
| accountNumber | account_number |
| glAccountId | gl_account_id |
| orgId | org_id |
| createdAt | created_at |
| updatedAt | updated_at |
| isDeleted | is_deleted |
| deletedAt | deleted_at |
| deletedBy | deleted_by |

## Verification

After running the SQL:
```sql
SELECT * FROM bank_accounts LIMIT 5;
```

Test CRUD from the app:
1. Add a new bank account
2. Refresh page - data should persist
3. Update the account
4. Refresh page - changes should persist
5. Delete the account
6. Refresh page - account should be gone
