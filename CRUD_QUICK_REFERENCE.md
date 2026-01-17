# Quick Reference: CRUD Operations in AT-ERP

## Key Files Modified

| File | Changes |
|------|---------|
| `services/IDataService.ts` | Added CRUD interface methods |
| `services/SupabaseDataService.ts` | Implemented INSERT, PATCH, DELETE operations |
| `services/MockDataService.ts` | Added stub implementations with warnings |
| `App.tsx` | Added persistence handlers |

## Handler Functions Available in App.tsx

### Organization Operations
```typescript
// Create new organization (persists to Supabase)
handleAddOrganization(org: Organization)

// Update organization (brand color, subscription plan, etc.)
handleUpdateOrganization(id: string, updates: Partial<Organization>)

// Delete organization
handleDeleteOrganization(id: string)

// Register new tenant with admin user (persists both)
handleRegisterWithPersistence(org: Organization, admin: User)
```

## Supabase Configuration

### Enable Supabase Persistence
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Disable Supabase (Use Mock)
Either:
- Delete `.env.local` 
- Or run in browser console:
```javascript
localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK')
location.reload()
```

## REST API Endpoints Used

### POST - Create
```
POST /rest/v1/organizations
```

### PATCH - Update
```
PATCH /rest/v1/organizations?id=eq.{id}
```

### DELETE - Delete
```
DELETE /rest/v1/organizations?id=eq.{id}
```

## Error Handling

All operations:
1. ✅ Try Supabase first
2. ⚠️ Log errors to console
3. 🔄 Fallback to memory storage
4. 📢 Show user notification

## Testing Checklist

- [ ] Create organization → Check Supabase database
- [ ] Update organization branding → Verify in DB
- [ ] Delete organization → Verify soft-delete
- [ ] Register new tenant → Check org + user in DB
- [ ] Disable Supabase → Verify memory fallback
- [ ] Refresh page → Verify persistence

## Supabase Table Requirements

Each entity needs a corresponding table. Required columns:
- `id` (PRIMARY KEY)
- `orgId` (for filtering by organization)
- `isDeleted` (for soft deletes)
- `deletedAt` (timestamp)
- `deletedBy` (user reference)
- Entity-specific fields

## Monitoring

### Console Logs to Watch
```
[Supabase] ☁️ Fetching data from Supabase...
[Supabase] ✅ Data loaded successfully
[Supabase] ✅ Inserted into organizations: {...}
[Supabase] ✅ Updated organizations: {...}
[App] Organization updated successfully
```

### Error Indicators
```
[Supabase] Missing credentials for table 'organizations'
[Supabase] Error inserting into organizations: 401 Unauthorized
[App] Error creating organization
```

## Next Steps

1. **Verify Supabase Tables Exist**
   - Check your Supabase dashboard
   - Ensure tables match entity names (lowercase)

2. **Test Operations**
   - Create an organization
   - Check Supabase database
   - Verify row was inserted

3. **Extend to Other Entities** (as needed)
   - Students, Batches, Trainers, etc.
   - Follow same pattern as Organizations

4. **Production Deployment**
   - Set Supabase env vars in your deployment
   - Verify database backups
   - Test fallback scenarios
