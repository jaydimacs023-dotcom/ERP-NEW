# 📝 Code Changes Reference

## Summary of Implementations

### 1. IDataService.ts - New Interface Methods

```typescript
// Organization CRUD
createOrganization(org: Organization): Promise<Organization>;
updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
deleteOrganization(id: string): Promise<void>;

// User CRUD
createUser(user: User): Promise<User>;
updateUser(id: string, updates: Partial<User>): Promise<User>;
deleteUser(id: string): Promise<void>;

// Student CRUD
createStudent(student: Student): Promise<Student>;
updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
deleteStudent(id: string): Promise<void>;

// Batch CRUD
createBatch(batch: Batch): Promise<Batch>;
updateBatch(id: string, updates: Partial<Batch>): Promise<Batch>;
deleteBatch(id: string): Promise<void>;

// Generic CRUD
createEntity<T>(table: string, entity: T): Promise<T>;
updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
deleteEntity(table: string, id: string): Promise<void>;
```

### 2. SupabaseDataService.ts - Core Implementation

```typescript
// Helper methods for REST API operations
private async insertToSupabase<T>(table: string, data: T): Promise<T>
private async updateInSupabase<T>(table: string, id: string, updates: Partial<T>): Promise<T>
private async deleteFromSupabase(table: string, id: string): Promise<void>

// Organization CRUD
async createOrganization(org: any): Promise<any>
async updateOrganization(id: string, updates: Partial<any>): Promise<any>
async deleteOrganization(id: string): Promise<void>

// User CRUD
async createUser(user: any): Promise<any>
async updateUser(id: string, updates: Partial<any>): Promise<any>
async deleteUser(id: string): Promise<void>

// Student CRUD
async createStudent(student: any): Promise<any>
async updateStudent(id: string, updates: Partial<any>): Promise<any>
async deleteStudent(id: string): Promise<void>

// Batch CRUD
async createBatch(batch: any): Promise<any>
async updateBatch(id: string, updates: Partial<any>): Promise<any>
async deleteBatch(id: string): Promise<void>

// Generic CRUD
async createEntity<T>(table: string, entity: T): Promise<T>
async updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>
async deleteEntity(table: string, id: string): Promise<void>
```

### 3. MockDataService.ts - Stub Implementations

```typescript
// All methods follow pattern:
async createOrganization(org: Organization): Promise<Organization> {
  console.warn('[MockDataService] Organizations persist to memory only...');
  return org;
}

// Similar for all other entity types
// Pattern: 1. Log warning, 2. Return entity unchanged
// Allows seamless switching between Mock and Supabase
```

### 4. App.tsx - Persistence Handlers

```typescript
// Data service reference
const [dataService] = useState(() => DataServiceFactory.getService());

// Handler functions
const handleAddOrganization = async (org: Organization) => {
  try {
    const savedOrg = await dataService.createOrganization(org);
    setOrganizations(prev => [...prev, savedOrg]);
    handleNotify('success', `Organization "${org.name}" created successfully`);
  } catch (error) {
    handleNotify('error', 'Failed to create organization...');
    setOrganizations(prev => [...prev, org]); // Fallback to memory
  }
}

const handleUpdateOrganization = async (id: string, updates: Partial<Organization>) => {
  try {
    const updated = await dataService.updateOrganization(id, updates);
    setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
    handleNotify('success', 'Organization updated successfully');
  } catch (error) {
    handleNotify('error', 'Failed to update organization...');
    setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o)); // Fallback
  }
}

const handleDeleteOrganization = async (id: string) => {
  try {
    await dataService.deleteOrganization(id);
    setOrganizations(prev => prev.filter(o => o.id !== id));
    handleNotify('success', 'Organization deleted successfully');
  } catch (error) {
    handleNotify('error', 'Failed to delete organization...');
    setOrganizations(prev => prev.filter(o => o.id !== id)); // Fallback
  }
}

const handleRegisterWithPersistence = async (org: Organization, admin: User) => {
  try {
    const savedOrg = await dataService.createOrganization(org);
    setOrganizations(p => [...p, savedOrg]);
    
    const savedAdmin = await dataService.createUser(admin);
    setUsers(p => [...p, savedAdmin]);
    
    setCurrentUser(savedAdmin);
    setCurrentOrgId(savedOrg.id);
    setActiveTab('dashboard');
    handleNotify('success', `Welcome! Organization "${org.name}" registered successfully`);
  } catch (error) {
    handleNotify('error', 'Registration failed...');
    // Fallback to memory
    setOrganizations(p => [...p, org]);
    setUsers(p => [...p, admin]);
    setCurrentUser(admin);
    setCurrentOrgId(org.id);
  }
}
```

### 5. View Integration in App.tsx

```typescript
// Updated LoginView to use persistence
<LoginView 
  onLogin={handleLogin} 
  onRegister={handleRegisterWithPersistence} 
  organizations={organizations} 
  users={users} 
/>

// Updated TenantManagementView
<TenantManagementView 
  organizations={organizations} 
  onAddTenant={handleAddOrganization} 
  onUpdateTenant={o => handleUpdateOrganization(o.id, o)} 
/>

// Updated BrandingView
<BrandingView 
  organization={currentOrg} 
  onUpdate={o => handleUpdateOrganization(o.id, o)} 
/>

// Updated SubscriptionView
<SubscriptionView 
  organization={currentOrg} 
  onUpdate={o => handleUpdateOrganization(o.id, o)} 
/>
```

---

## REST API Calls Made

### Insert (POST)
```
POST /rest/v1/organizations HTTP/1.1
Authorization: Bearer {ANON_KEY}
Content-Type: application/json
Prefer: return=representation

{"id": "org-123", "name": "Acme", ...}
```

### Update (PATCH)
```
PATCH /rest/v1/organizations?id=eq.org-123 HTTP/1.1
Authorization: Bearer {ANON_KEY}
Content-Type: application/json
Prefer: return=representation

{"name": "Acme Corporation"}
```

### Delete (DELETE)
```
DELETE /rest/v1/organizations?id=eq.org-123 HTTP/1.1
Authorization: Bearer {ANON_KEY}
```

---

## Error Handling Pattern

```typescript
try {
  // 1. Attempt Supabase operation
  const result = await dataService.operation(...);
  
  // 2. Update React state
  setState(prev => [...prev, result]);
  
  // 3. Show success notification
  handleNotify('success', 'Operation completed');
  
} catch (error) {
  // 1. Log error to console
  console.error('[App] Error:', error);
  
  // 2. Show error notification
  handleNotify('error', 'Operation failed. Using memory storage.');
  
  // 3. Fallback to memory state update
  setState(prev => [...prev, localData]);
}
```

---

## Configuration Required

### Environment Variables
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Tables Schema (Example)
```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT,
  isVatRegistered BOOLEAN,
  subscriptionStatus TEXT,
  planType TEXT,
  primaryColor TEXT,
  logoUrl TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  licenseExpiry TEXT,
  isDeleted BOOLEAN DEFAULT false,
  deletedAt TIMESTAMP,
  deletedBy TEXT
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT,
  role TEXT,
  orgId TEXT,
  studentId TEXT,
  trainerId TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  isDeleted BOOLEAN DEFAULT false,
  FOREIGN KEY (orgId) REFERENCES organizations(id)
);
```

---

## Testing Code Snippets

### Browser Console
```javascript
// Check if Supabase is configured
localStorage.getItem('AT_ERP_DATA_SOURCE')

// Force mock mode
localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK')

// Force Supabase mode
localStorage.setItem('AT_ERP_DATA_SOURCE', 'CLOUD')

// Refresh to apply
location.reload()
```

### Console Monitoring
```javascript
// Filter for Supabase logs
// In browser console, search for: [Supabase]

// Filter for App logs
// In browser console, search for: [App]

// Watch real-time
// Keep console open and create an organization
// Should see: [Supabase] ✅ Inserted into organizations
```

---

## Performance Impact

- **Load time:** No additional overhead (operations happen after initial load)
- **Bundle size:** No increase (no new dependencies)
- **Network:** One additional API call per create/update/delete operation
- **Memory:** Same as before (state management unchanged)

---

## Security Considerations

1. **API Keys:** Supabase ANON_KEY has limited permissions
2. **Row Level Security:** Should be enabled in Supabase
3. **CORS:** Supabase handles automatically
4. **Data validation:** Should be added in future

---

## Monitoring & Logging

### Console Logs to Watch
```
[Supabase] ☁️ Fetching data from Supabase...
[Supabase] ✅ Inserted into organizations: {...}
[Supabase] Error inserting into organizations: 401
[App] Organization updated successfully
[App] Error creating organization: {...}
```

### Log Levels
- **Info:** `[Supabase] ✅`, `[App]` with success message
- **Warn:** `[Supabase]` missing credentials, `[MockDataService]`
- **Error:** `[Supabase] Error`, `[App] Error`

---

## Backward Compatibility

✅ Works with existing mock mode
✅ Works if Supabase env vars not set
✅ No changes to existing components
✅ No breaking API changes
✅ Graceful fallback to memory

---

**Implementation complete and ready for deployment!**
