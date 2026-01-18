# Fix: "age" Field Error in Student Creation

## Problem
When creating a student, Supabase was throwing error:
```
record "new" has no field "age"
```

This occurred because the filter was being applied to **camelCase** data, but the whitelist contained **snake_case** column names.

## Root Cause Analysis

### Data Flow (Before Fix)
```
StudentsView creates student with: { age, firstName, lastName, ... }  ← camelCase
                                ↓
App.handleAddStudent() 
                                ↓
SupabaseDataService.createStudent() 
                                ↓
filterToTableSchema('students', student)  ← Still camelCase!
  - Looking for: 'id', 'org_id', 'date_of_birth', etc. (snake_case in whitelist)
  - Data has: 'age', 'firstName', 'lastName', etc. (camelCase keys)
  - Result: age NOT filtered out because keys don't match whitelist
                                ↓
insertToSupabase() applies camelToSnake()
  - 'age' → 'age' (no change, invalid field!)
  - 'firstName' → 'first_name' (valid field)
                                ↓
POST to Supabase with { age: 25, first_name: "John", ... }
                                ↓
❌ Supabase rejects: age column doesn't exist
```

## Solution

### Key Fix: Convert to snake_case BEFORE filtering

**Updated Data Flow:**
```
StudentsView creates student with: { age, firstName, lastName, ... }  ← camelCase
                                ↓
App.handleAddStudent()
                                ↓
SupabaseDataService.createStudent()
                                ↓
camelToSnake(student) ← NEW STEP
  Result: { age: 25, first_name: "John", ... }  ← snake_case
                                ↓
filterToTableSchema('students', snakeCaseStudent) ← Now matches whitelist!
  - Looking for: 'id', 'org_id', 'date_of_birth', etc.
  - Data has: 'age', 'first_name', 'date_of_birth', etc.
  - Result: age IS filtered out ✅
  - Kept: { id, org_id, first_name, date_of_birth, ... }
                                ↓
Add timestamps (created_at, updated_at)
                                ↓
insertToSupabaseRaw() - NO camelToSnake() needed
  - Data already snake_case, send directly
                                ↓
POST to Supabase with valid fields only ✅
```

## Implementation Changes

### 1. createStudent() - Line 378-417
```typescript
async createStudent(student: any): Promise<any> {
  // Convert camelCase input to snake_case FIRST
  const snakeCaseStudent = this.camelToSnake(student);
  
  // Validate org_id
  if (!snakeCaseStudent.org_id) {
    console.warn('[Supabase] Warning: student missing org_id');
  }

  // Convert documents array
  if (snakeCaseStudent.documents && Array.isArray(snakeCaseStudent.documents)) {
    snakeCaseStudent.documents = snakeCaseStudent.documents
      .map((doc: any) => typeof doc === 'string' ? doc : doc.name || doc.id)
      .filter(Boolean);
  }

  // Filter to only valid columns (NOW WORKS because data is snake_case)
  let filteredStudent = this.filterToTableSchema('students', snakeCaseStudent);
  
  // Remove invalid UUIDs
  if (filteredStudent.id && !this.isValidUUID(filteredStudent.id)) {
    delete filteredStudent.id;
  }

  // Add timestamps
  const now = new Date().toISOString();
  filteredStudent.created_at = now;
  filteredStudent.updated_at = now;
  
  console.debug('[Supabase] Filtered student data ready for POST:', {
    keys: Object.keys(filteredStudent),
    hasAge: 'age' in filteredStudent,      ← Will show false ✅
    data: filteredStudent
  });
  
  // Use Raw insert (no double-conversion)
  return this.insertToSupabaseRaw('students', filteredStudent);
}
```

### 2. insertToSupabaseRaw() - NEW METHOD - Line 420-462
```typescript
private async insertToSupabaseRaw<T>(table: string, data: T): Promise<T> {
  // No camelToSnake() call - data is already snake_case
  // Directly POST snake_case data to Supabase
  const response = await fetch(url, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify(data),  // ← Already snake_case, send as-is
  });
  
  // Convert response back to camelCase for app
  const camelCaseResult = this.snakeToCamel(result[0] || result);
  return camelCaseResult;
}
```

### 3. updateStudent() - Line 463-506
```typescript
async updateStudent(id: string, updates: Partial<any>): Promise<any> {
  // Convert updates to snake_case FIRST (same pattern as create)
  let snakeCaseUpdates = this.camelToSnake(updates);
  
  // Set timestamp
  snakeCaseUpdates.updated_at = new Date().toISOString();
  
  // Convert documents array
  if (snakeCaseUpdates.documents && Array.isArray(snakeCaseUpdates.documents)) {
    snakeCaseUpdates.documents = snakeCaseUpdates.documents
      .map((doc: any) => typeof doc === 'string' ? doc : doc.name || doc.id)
      .filter(Boolean);
  }

  // Filter to only valid columns (data is now snake_case)
  const filteredUpdates = this.filterToTableSchema('students', snakeCaseUpdates);
  
  console.debug('[Supabase] Filtered student updates ready for PATCH:', {
    keys: Object.keys(filteredUpdates),
    hasAge: 'age' in filteredUpdates,      ← Will show false ✅
    data: filteredUpdates
  });
  
  return this.updateInSupabaseRaw('students', id, filteredUpdates);
}
```

### 4. updateInSupabaseRaw() - NEW METHOD - Line 509-550
```typescript
private async updateInSupabaseRaw<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
  // No camelToSnake() call - data is already snake_case
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ... },
    body: JSON.stringify(updates),  // ← Already snake_case, send as-is
  });
  
  // Convert response back to camelCase for app
  const camelCaseResult = this.snakeToCamel(result[0] || result);
  return camelCaseResult;
}
```

## Valid Snake_case Columns (Students Table)

The whitelist now correctly filters:
```
Valid: id, org_id, uli, last_name, first_name, middle_name, extension,
       sex, date_of_birth, birth_region, birth_province, birth_city,
       civil_status, educational_attainment, nationality, email, contact_number,
       street, barangay, city, district, province, guardian,
       location_id, sponsor_id, documents, created_at, updated_at

Invalid (filtered out): age, age_of_birth, isEnrollmentOverridden, 
                        complianceNotes, is_deleted, deleted_at, etc.
```

## Debug Output

When creating a student, browser console will show:
```javascript
[Supabase] Filtered student data ready for POST: {
  keys: ["id", "org_id", "first_name", "date_of_birth", "email", ...],
  hasAge: false,  // ✅ Confirms age was filtered out
  data: { 
    org_id: "12345...", 
    first_name: "John",
    date_of_birth: "1990-01-15",
    // ... no age field
  }
}
```

## Testing

1. Create a student with age field in UI
2. Open browser DevTools (F12) → Console
3. Look for `[Supabase] Filtered student data ready for POST`
4. Verify: `hasAge: false` ✅
5. Check that student is created in Supabase without errors

## Summary

| Issue | Before | After |
|-------|--------|-------|
| Input | camelCase keys | camelCase keys |
| Step 1 | (none) | ✅ Convert to snake_case |
| Step 2 | filterToTableSchema(camelCase) ✗ | filterToTableSchema(snakeCase) ✅ |
| Filter result | age NOT removed | age removed ✅ |
| POST to Supabase | invalid fields sent | only valid fields sent ✅ |
| Error | "age" field not found | (none) ✅ |

The fix ensures schema validation works correctly by normalizing data format BEFORE filtering against the whitelist.
