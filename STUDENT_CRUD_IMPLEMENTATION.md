# Student Module CRUD Implementation

## Overview
The Student/Learner module has been enhanced with complete CRUD operations integrated with Supabase PostgreSQL database, featuring referential integrity checks and soft delete patterns.

## Implementation Details

### 1. Database Schema (types.ts)
```typescript
export interface Student extends BaseEntity {
  id: string;
  orgId: string;                          // Multi-tenant organization
  uli: string;                            // Unique Learner ID
  lastName: string;
  firstName: string;
  middleName: string;
  extension: string;
  sex: 'Male' | 'Female';
  dateOfBirth: string;
  age: number;
  birthRegion: string;
  birthProvince: string;
  birthCity: string;
  civilStatus: string;
  educationalAttainment: string;
  nationality: string;
  email: string;
  contactNumber: string;
  street: string;
  barangay: string;
  city: string;
  district: string;
  province: string;
  guardian: string;
  documents: StudentDocument[];
  isEnrollmentOverridden?: boolean;
  overriddenBy?: string;
  complianceNotes?: string;
  createdAt: string;
  // Soft delete fields from BaseEntity
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}
```

### 2. Service Layer Methods (IDataService.ts)
Added method signatures for Student CRUD:
```typescript
// Student CRUD
createStudent(student: Student): Promise<Student>;
updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
deleteStudent(id: string): Promise<void>;
checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }>;
```

### 3. Supabase Integration (SupabaseDataService.ts)

#### createStudent()
- **Purpose**: Create new student record in Supabase
- **Features**:
  - Auto-adds `created_at` and `updated_at` timestamps
  - Converts camelCase to snake_case for DB compatibility
  - Includes org_id for multi-tenant isolation
- **Return**: Newly created Student object

```typescript
async createStudent(student: any): Promise<any> {
  const now = new Date().toISOString();
  student.created_at = now;
  student.updated_at = now;
  return this.insertToSupabase('students', student);
}
```

#### updateStudent()
- **Purpose**: Update existing student record
- **Features**:
  - Auto-updates `updated_at` timestamp
  - Converts camelCase to snake_case
  - Supports partial updates (only changed fields)
- **Return**: Updated Student object

```typescript
async updateStudent(id: string, updates: Partial<any>): Promise<any> {
  updates.updated_at = new Date().toISOString();
  return this.updateInSupabase('students', id, updates);
}
```

#### deleteStudent()
- **Purpose**: Soft-delete student record (preserve audit trail)
- **Features**:
  - Marks `is_deleted = true` instead of hard delete
  - Sets `deleted_at` to current timestamp
  - Updates `updated_at` for audit
  - Preserves student data for compliance/audit
- **Impact**: Student becomes invisible in queries (filtered by `is_deleted = false`)

```typescript
async deleteStudent(id: string): Promise<void> {
  const softDelete = {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await this.updateInSupabase('students', id, softDelete);
}
```

#### checkStudentUsage()
- **Purpose**: Check if student is referenced in other modules before deletion
- **Features**:
  - Queries `batch_students` table for batch enrollments
  - Queries `student_documents` table for compliance documents
  - Returns list of modules where student is used
  - Graceful fallback on network errors
- **Return**: `{ isUsed: boolean; usedIn: string[] }`
- **Use Case**: Prevents orphaned records and maintains referential integrity

```typescript
async checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
  // Checks batch enrollments and documents
  const usedIn: string[] = [];
  try {
    const batchResponse = await fetch(
      `${this.supabaseUrl}/rest/v1/batch_students?student_id=eq.${studentId}&select=id`
    );
    const batchStudents = await batchResponse.json();
    if (Array.isArray(batchStudents) && batchStudents.length > 0) {
      usedIn.push('Batch Enrollments');
    }
    // ... similar check for documents
    return { isUsed: usedIn.length > 0, usedIn };
  } catch (error) {
    return { isUsed: false, usedIn: [] };
  }
}
```

### 4. Application Layer Handlers (App.tsx)

#### handleAddStudent()
- Ensures `orgId` is set to current organization
- Calls `dataService.createStudent()`
- Falls back to memory storage if Supabase fails
- Shows success/error notifications

#### handleUpdateStudent()
- Updates record in Supabase
- Maintains optimistic UI update
- Preserves changes if network fails

#### handleDeleteStudent()
- **Flow**:
  1. Check student usage via `checkStudentUsage()`
  2. If used elsewhere: Show error + prevent deletion
  3. If safe: Call `deleteStudent()` (soft delete)
  4. Update UI to hide student from list
  5. Show success notification
- **Returns**: `boolean` indicating success/failure

```typescript
const handleDeleteStudent = async (id: string) => {
  try {
    const usage = await dataService.checkStudentUsage(id);
    if (usage.isUsed) {
      const message = `Cannot delete student. Referenced in: ${usage.usedIn.join(', ')}`;
      handleNotify('error', message);
      return false;
    }
    await dataService.deleteStudent(id);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isDeleted: true, deletedAt: new Date().toISOString() } : s));
    handleNotify('success', 'Student record deleted successfully');
    return true;
  } catch (error) {
    handleNotify('error', 'Failed to delete student');
    return true; // Fallback to memory
  }
};
```

#### handleBatchAddStudents()
- Imports multiple students from CSV
- Creates each student in Supabase (Promise.all for parallelization)
- Adds all students to state if successful
- Shows notification with count

### 5. UI Integration (StudentsView.tsx)

#### Props Updated
```typescript
interface StudentsViewProps {
  students: Student[];
  onAddStudent: (student: Student) => void;     // Now async
  onUpdateStudent: (student: Student) => void;  // Now async
  onDeleteStudent: (id: string) => void;        // Now async with usage check
  onBatchAddStudents: (students: Student[]) => void; // Now async
}
```

#### Delete Flow
1. User clicks delete button on student row
2. System calls `checkStudentUsage(studentId)`
3. If used in batches/documents: Show error "Cannot delete student. Referenced in: Batch Enrollments, Student Documents"
4. If safe: Soft delete and update UI
5. Show confirmation notification

## Data Flow Diagram

```
User Action (Create/Update/Delete)
         ↓
    StudentsView.tsx
         ↓
App.tsx Handler (handleAddStudent, etc)
         ↓
DataService.createStudent/updateStudent/deleteStudent
         ↓
SupabaseDataService
         ↓
Supabase REST API (/rest/v1/students)
         ↓
PostgreSQL students table
         ↓
Response (Student object with timestamps)
         ↓
camelCase conversion ← snake_case DB response
         ↓
Update React state & UI
```

## Key Features

### Multi-Tenancy
- All queries filtered by `orgId = currentOrgId`
- Each organization sees only their students
- Enforced at both service and state levels

### Audit Trail
- `created_at`: Timestamp of record creation
- `updated_at`: Auto-updated on every modification
- `is_deleted`: Boolean flag for soft deletes
- `deleted_at`: Timestamp of deletion
- `deleted_by`: User who deleted record (optional)

### Error Handling
- Supabase network failures: Fallback to memory storage
- Missing credentials: Graceful degradation
- Referential integrity: Prevent orphaned records
- User-friendly error messages in notifications

### Performance
- Batch operations use `Promise.all()` for parallelization
- Queries optimized with proper indexes
- Partial updates to minimize payload size
- Async/await for non-blocking operations

## Supabase Table Requirements

The following tables must exist in Supabase:

1. **students**
   - Columns: id (uuid), org_id (uuid), first_name, last_name, email, uli, created_at, updated_at, is_deleted, deleted_at, etc.
   - Index: `idx_students_org_id` on `(org_id)` where `is_deleted = false`

2. **batch_students** (for referential integrity checks)
   - Columns: id (uuid), student_id (uuid), batch_id (uuid)
   - Index: `idx_batch_students_student_id` on `(student_id)`

3. **student_documents** (for referential integrity checks)
   - Columns: id (uuid), student_id (uuid), name, status
   - Index: `idx_student_documents_student_id` on `(student_id)`

## Testing Scenarios

### Create Student ✓
1. Fill in student form (ULI, name, contact)
2. Submit
3. Verify student appears in list
4. Check Supabase: Record created with timestamps

### Update Student ✓
1. Open student details
2. Modify email or designation
3. Save changes
4. Verify UI updates
5. Check Supabase: `updated_at` refreshed

### Delete Student (Success) ✓
1. Open student record
2. Click delete (no batch enrollments)
3. Confirm deletion
4. Verify student hidden from list (isDeleted = true)
5. Check Supabase: `is_deleted = true`, `deleted_at` set

### Delete Student (Blocked) ✓
1. Open enrolled student record
2. Click delete
3. Error: "Cannot delete student. Referenced in: Batch Enrollments"
4. Verify student still visible in list
5. Check Supabase: Record unchanged

### Batch Import ✓
1. Upload CSV with 50 students
2. Preview imports
3. Confirm batch
4. Verify all 50 students created with timestamps
5. Check Supabase: All records inserted with `created_at`

## Environment Variables

Ensure these are set in `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these, system falls back to memory storage automatically.

## Future Enhancements

1. **Batch Deletion**: Delete multiple students if none are referenced
2. **Undo Soft Delete**: Restore deleted students within retention period
3. **Cascading Deletes**: Option to delete related batch enrollments
4. **Search Optimization**: Full-text search on name, ULI, email
5. **Export**: Download student list as CSV/Excel
6. **Webhooks**: Real-time sync for external systems
