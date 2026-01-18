# Deploy Students Table to Supabase

## Quick Start

### Option 1: Use Supabase Dashboard SQL Editor (Recommended)

1. **Open Supabase Console**
   - Go to https://supabase.com
   - Log in to your project (athhdmvhtfgnohwngqfv)
   - Click "SQL Editor" in left sidebar

2. **Create New Query**
   - Click "+ New Query"
   - Copy entire contents from `CREATE_MISSING_TABLES.sql`
   - Click "Run" button

3. **Verify Tables Created**
   - Go to "Table Editor" 
   - You should see:
     - `students` (new)
     - `student_documents` (new)
     - `batch_students` (new or updated)
   - All tables should show in left sidebar

### Option 2: Use psql CLI (Advanced)

```bash
# Connect to Supabase PostgreSQL
psql -h db.athhdmvhtfgnohwngqfv.supabase.co -U postgres -d postgres < CREATE_MISSING_TABLES.sql

# When prompted, enter your Supabase database password
```

### Option 3: Use curl (REST API)

```bash
# Not recommended for schema changes - use SQL Editor instead
```

---

## Tables Created

### 1. **students** (Main Table)
```
├─ Columns: id, org_id, uli, first_name, last_name, email, contact_number, ...
├─ Relationships: org_id → organizations(id)
├─ Soft Delete: is_deleted, deleted_at, deleted_by, created_at, updated_at
├─ Indexes: org_id, uli, email, contact_number, created_at, is_deleted
└─ Constraint: UNIQUE(org_id, uli) - ULI must be unique per organization
```

**Key Columns:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| org_id | uuid | Organization reference |
| uli | varchar | Unique Learner ID |
| first_name | varchar | Student first name |
| last_name | varchar | Student last name |
| email | varchar | Contact email |
| documents | jsonb | Array of compliance documents |
| is_enrollment_overridden | boolean | Can skip compliance if true |
| is_deleted | boolean | Soft delete flag |
| created_at | timestamp | Record creation |
| updated_at | timestamp | Last modified (auto) |

### 2. **student_documents** (Optional Normalized Table)
```
├─ Columns: id, org_id, student_id, name, status, file_data, ...
├─ Relationships: org_id → organizations(id), student_id → students(id)
├─ Purpose: Denormalized document tracking
└─ Status: PENDING, UPLOADED, VERIFIED, REJECTED
```

### 3. **batch_students** (Junction Table - Updated)
```
├─ Columns: id, org_id, batch_id, student_id, enrollment_status, ...
├─ Relationships: batch_id → batches(id), student_id → students(id)
├─ Constraint: UNIQUE(batch_id, student_id) - Prevent duplicate enrollments
└─ Status: ACTIVE, DROPPED, COMPLETED
```

---

## SQL File Location

```
E:\laragon\www\AT-ERP\CREATE_MISSING_TABLES.sql
```

**Contains:**
- Students table (new)
- Student documents table (new)
- Batch students table (updated with indexes)
- Employee table
- Payroll tables
- Payment history table
- Schedules table

---

## Verification Checklist

After running SQL, verify everything worked:

### ✓ Check Table Exists
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'students';
```
Expected: 1 row returned

### ✓ Check Columns
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'students'
ORDER BY ordinal_position;
```
Expected: 42 columns

### ✓ Check Indexes
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'students';
```
Expected: 6 indexes (org_id, uli, email, contact, created_at, is_deleted)

### ✓ Check Triggers
```sql
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'students';
```
Expected: 1 trigger (students_updated_at_trigger)

---

## Enable RLS (Row Level Security) - Optional

For multi-tenant isolation at database level:

```sql
-- Enable RLS on students table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see students from their organization
CREATE POLICY "Students are organization-scoped" ON students
  USING (org_id = auth.uid()::uuid)
  WITH CHECK (org_id = auth.uid()::uuid);

-- Allow service role to bypass RLS (for backend operations)
CREATE POLICY "Service role bypass" ON students
  AS PERMISSIVE FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (true);
```

**Note:** RLS requires proper authentication setup. If not needed, skip this step.

---

## Test CRUD Operations

### Test Create
```bash
curl -X POST "https://athhdmvhtfgnohwngqfv.supabase.co/rest/v1/students" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "YOUR_ORG_ID",
    "uli": "STU-2024-00001",
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan@example.com",
    "date_of_birth": "1995-05-15",
    "age": 29,
    "sex": "Male",
    "contact_number": "+63-9-123-456-7890",
    "city": "Manila",
    "province": "Metro Manila",
    "country": "Philippines"
  }'
```

### Test Read
```bash
curl -X GET "https://athhdmvhtfgnohwngqfv.supabase.co/rest/v1/students?org_id=eq.YOUR_ORG_ID&is_deleted=eq.false" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Expected Response
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "org_id": "550e8400-e29b-41d4-a716-446655440001",
    "uli": "STU-2024-00001",
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan@example.com",
    "is_deleted": false,
    "created_at": "2026-01-17T10:30:00Z",
    "updated_at": "2026-01-17T10:30:00Z"
  }
]
```

---

## Troubleshooting

### Error: "Table already exists"
- **Cause**: Table was already created in previous deployment
- **Solution**: This is safe - `CREATE TABLE IF NOT EXISTS` will skip existing tables

### Error: "Foreign key constraint violation"
- **Cause**: Referenced tables (organizations, batches, trainers) don't exist
- **Solution**: Ensure base schema is deployed first (check `schema.sql`)

### Error: "Permission denied for schema public"
- **Cause**: Insufficient database privileges
- **Solution**: 
  1. Log in as postgres user (not anon)
  2. Or ask Supabase support to elevate privileges

### Students table created but no data appears
- **Cause**: RLS policies blocking access
- **Solution**: Ensure RLS policies allow your user/API key access

---

## Rollback

If you need to remove the tables:

```sql
-- Drop tables (will cascade to dependent tables)
DROP TABLE IF EXISTS batch_students CASCADE;
DROP TABLE IF EXISTS student_documents CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- Verify they're deleted
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('students', 'student_documents', 'batch_students');
```

---

## Next Steps

After tables are created:

1. **Verify in App**
   - Go to Students tab in AT-ERP UI
   - Try creating a new student
   - Should save to Supabase (not fallback to memory)

2. **Check Browser Console**
   - Open DevTools (F12)
   - Look for `[Supabase] ✅ Inserted into students` log
   - Should see student ID in response

3. **Verify in Supabase Dashboard**
   - Go to Table Editor
   - Click "students" table
   - Should see new student row with created_at timestamp

4. **Test Referential Integrity**
   - Enroll student in batch
   - Try to delete student
   - Should show error: "Cannot delete student. Referenced in: Batch Enrollments"

---

## Environment Variables

Make sure these are set in `.env.local`:

```env
VITE_SUPABASE_URL=https://athhdmvhtfgnohwngqfv.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Without these, the app will fall back to memory storage and show the error you saw.

---

## Performance Notes

The students table includes several optimizations:

1. **Indexes on frequently queried columns**
   - `org_id` with `WHERE is_deleted = false`
   - `uli` for unique student lookup
   - `email` for contact searching

2. **JSONB for documents**
   - Stores array of documents in single column
   - More flexible than normalized approach
   - Can query with `documents @> '{"status":"VERIFIED"}'`

3. **Auto-updating timestamps**
   - Trigger automatically sets `updated_at` on changes
   - Enables audit trail and sorting

4. **Soft deletes**
   - Data preserved for compliance
   - Faster than hard deletes (no cascading)
   - Queries default to `WHERE is_deleted = false`

---

## Support

If tables fail to create:

1. Check Supabase status: https://status.supabase.com
2. Verify database credentials in `.env.local`
3. Check browser console for API errors (F12)
4. Review Supabase logs: Dashboard → Logs → Database

For detailed errors, check:
- Supabase Dashboard → SQL Editor → Query Results
- Browser Console (F12) → Network tab
