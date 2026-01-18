# Fix: "Failed to create student. Falling back to memory storage"

## Problem

When you try to create a student in the ERP UI, you see this error:

```
[ERP Notification: ERROR] Failed to create student. Falling back to memory storage.
```

This means:
- ❌ Student was NOT saved to Supabase database
- ⚠️ Student only exists in browser memory
- 🔄 Student will disappear on page refresh
- 🚫 Referential integrity checks won't work

---

## Root Causes (in order of likelihood)

### 1. **Students Table Doesn't Exist in Supabase** ⭐ Most Common

**Check:**
- Open Supabase Dashboard → SQL Editor
- Run: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'students');`
- If result is `false`, table doesn't exist

**Fix:**
1. Go to `CREATE_MISSING_TABLES.sql` in project root
2. Copy entire file contents
3. Open Supabase Dashboard → SQL Editor
4. Click "+ New Query"
5. Paste the SQL
6. Click "Run"
7. Wait for execution to complete
8. Check browser console for success message

### 2. **Supabase Credentials Missing**

**Check:**
- Open `.env.local` file in project root
- Look for these lines:
  ```
  VITE_SUPABASE_URL=https://...supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGc...
  ```
- If either is missing, that's the problem

**Fix - Option A: Set Credentials (Recommended)**
1. Open `.env.local`
2. Add these lines (replace with YOUR values from Supabase):
   ```
   VITE_SUPABASE_URL=https://athhdmvhtfgnohwngqfv.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
   ```
3. Save file
4. Restart dev server: Stop current terminal, run `npm run dev` again

**Fix - Option B: Get Credentials from Supabase**
1. Go to https://supabase.com/dashboard
2. Click your project (athhdmvhtfgnohwngqfv)
3. Click "Settings" → "API"
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
5. Paste into `.env.local`

### 3. **Credentials Invalid/Expired**

**Check:**
- Open browser DevTools (F12)
- Go to Console tab
- Look for errors like:
  - `401 Unauthorized`
  - `403 Forbidden`
  - `Invalid API key`

**Fix:**
1. Go to Supabase Dashboard → Settings → API
2. Click "Generate new key" for anon key (if worried it's exposed)
3. Update `.env.local` with new key
4. Restart dev server

### 4. **Network/CORS Issue**

**Check:**
- Open browser DevTools (F12)
- Go to Network tab
- Look for failed POST to `https://...supabase.co/rest/v1/students`
- Check response status: 
  - `0` = Network blocked
  - `401` = Invalid key
  - `403` = Permissions issue
  - `500` = Server error

**Fix:**
1. Verify firewall isn't blocking Supabase (try `ping api.supabase.io`)
2. Check VPN/proxy settings
3. Try incognito browser window
4. Verify credentials are correct (see above)

---

## Diagnostic Steps

### Step 1: Verify Credentials Are Loaded
```javascript
// Open browser console (F12) and paste:
import.meta.env.VITE_SUPABASE_URL
import.meta.env.VITE_SUPABASE_ANON_KEY
```
Both should return values (not `undefined`)

### Step 2: Test Direct API Call
```javascript
// Open browser console and paste:
fetch('https://athhdmvhtfgnohwngqfv.supabase.co/rest/v1/students?limit=1', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(d => console.log('Success:', d))
.catch(e => console.error('Error:', e))
```

**Expected outcomes:**
- ✅ Returns `[]` (empty array) = Table exists, credentials work
- ❌ Returns `404` = Table doesn't exist
- ❌ Returns `401` = Credentials invalid
- ❌ Returns `CORS error` = Network issue

### Step 3: Check Logs in Supabase
1. Open Supabase Dashboard
2. Click "Logs" in left sidebar
3. Filter by "API" or "Database"
4. Look for POST requests to `/students`
5. Check response codes:
   - `201` = Success (table created record)
   - `404` = Table not found
   - `401` = Auth failed
   - `400` = Bad request (check column names)

---

## Complete Solution Checklist

- [ ] **Step 1**: Create students table
  ```
  Open CREATE_MISSING_TABLES.sql
  Copy all content
  Paste in Supabase SQL Editor
  Click Run
  Wait for "✓" success indicator
  ```

- [ ] **Step 2**: Verify table exists
  ```
  Supabase Dashboard → Table Editor
  Look for "students" in left sidebar
  Click on it - should show 42 columns
  ```

- [ ] **Step 3**: Set environment variables
  ```
  Open .env.local
  Add VITE_SUPABASE_URL
  Add VITE_SUPABASE_ANON_KEY
  Save file
  ```

- [ ] **Step 4**: Restart dev server
  ```
  Stop current terminal (Ctrl+C)
  Run: npm run dev
  Open http://localhost:5174
  ```

- [ ] **Step 5**: Test create student
  ```
  Go to Students tab
  Click "+ Register New Student"
  Fill in form (ULI, name, contact)
  Click Save
  Check browser console for "✅ Inserted into students"
  ```

- [ ] **Step 6**: Verify in Supabase
  ```
  Supabase Dashboard → Table Editor
  Click "students" table
  New row should appear with your data
  Check created_at has current timestamp
  ```

---

## Expected Success Flow

### Browser Console Output (F12)
```
[Supabase] Uploading to students: {first_name: "Juan", last_name: "Dela Cruz", ...}
[Supabase] ✅ Inserted into students: {id: "550e8400-...", created_at: "2026-01-17T..."}
[App] Student "Juan Dela Cruz" registered successfully
```

### UI Notification
```
✓ Student "Juan Dela Cruz" registered successfully
```

### In Supabase Dashboard
- New row appears in `students` table
- `created_at` shows current time
- `org_id` matches your organization
- `uli` has unique student ID

---

## Fallback Behavior (When It Works)

Even if Supabase fails, the system will:

1. Show error notification
2. Fall back to **memory storage** (state only)
3. Student appears in UI temporarily
4. Student disappears on page refresh
5. Referential integrity checks disabled
6. Creates don't persist

This is by design - the app remains usable even if database is down.

---

## Quick Commands

### Restart Everything
```bash
# Terminal 1: Kill dev server
Ctrl+C

# Terminal 1: Start fresh
npm run dev

# Terminal 2: Check for errors
npm run build  # Verify no TypeScript errors
```

### Reset Database
```bash
# Warning: This will DELETE all data!
# Supabase Dashboard → Settings → Database
# Click "Reset Database" (dangerous - use with caution!)
```

### Check Current Config
```javascript
// Paste in browser console:
console.log({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  mode: import.meta.env.MODE
})
```

---

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **API Reference**: https://supabase.com/docs/guides/api
- **Database Logs**: Supabase Dashboard → Logs
- **SQL Editor**: Supabase Dashboard → SQL Editor

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `404 Not Found` | Table doesn't exist | Run SQL from CREATE_MISSING_TABLES.sql |
| `401 Unauthorized` | Invalid API key | Check .env.local has correct ANON_KEY |
| `403 Forbidden` | Permission denied | Ensure user has INSERT permission on table |
| `CORS error` | Browser blocked request | Check firewall/VPN, try different network |
| `Network timeout` | Server unreachable | Check internet, Supabase status page |
| `Duplicate key` | ULI already exists | Make ULI unique per organization |
| `Foreign key violation` | Organization doesn't exist | Ensure org_id is valid |

---

## Next Steps

1. **Deploy tables**: Run SQL from CREATE_MISSING_TABLES.sql
2. **Test create**: Try registering student, check for "✅ Inserted" in console
3. **Test delete**: Enroll student in batch, verify "Cannot delete" error
4. **Test batch import**: Upload CSV with multiple students
5. **Monitor logs**: Supabase Dashboard → Logs for any API errors

Your students are now saved to Supabase! 🎉
