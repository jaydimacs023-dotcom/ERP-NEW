# Supabase Setup Guide for AT-ERP

This guide walks you through migrating AT-ERP from Gemini to Supabase.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in/create account
2. Click **New Project**
3. Fill in:
   - **Project Name**: `AT-ERP` (or your choice)
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your location
4. Click **Create new project** and wait for provisioning (~2 minutes)

## Step 2: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. Create `.env.local` in your project root with:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 3: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and execute the SQL from `schema.sql` file in your project repository
   - This creates all required tables with proper structure and relationships
4. Verify tables are created in the **Database** → **Tables** section

## Step 4: Seed Initial Data (Optional for Testing)

To populate your database with sample data:

1. Go to **SQL Editor** → **New Query**
2. Run individual INSERT statements from `db.ts` to create test organizations, users, students, etc.

Or manually add data through Supabase's table editor for quick testing.

## Step 5: Configure Your Application

### Development Mode (Mock Data)
```bash
npm install
npm run dev
```
The app uses mock data by default. No Supabase credentials needed.

### Development Mode (Cloud Data)
1. Ensure `.env.local` has Supabase credentials
2. Optionally set `VITE_FORCE_SUPABASE=true` to use cloud in dev
3. Run `npm run dev`

### Production Build
```bash
npm run build
npm run preview
```

## Step 6: Switch Data Sources at Runtime

No rebuild needed! Open browser console:

```javascript
// Switch to Supabase
localStorage.setItem('AT_ERP_DATA_SOURCE', 'CLOUD');
window.location.reload();

// Switch back to mock data
localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK');
window.location.reload();
```

## Troubleshooting

### "Missing credentials" warning
- Verify `.env.local` exists with correct Supabase URL and key
- Restart dev server after creating `.env.local`
- Check Supabase Settings → API for correct credentials

### Tables not found (404 errors)
- Verify all tables exist in Supabase SQL Editor
- Run `schema.sql` completely to ensure all tables are created
- Check table names match what `SupabaseDataService.ts` expects

### Authentication errors (401)
- Verify `VITE_SUPABASE_ANON_KEY` is the public (anon) key, not the service role key
- Check credentials haven't been regenerated in Supabase settings

### Fetch errors but app doesn't crash
- The app gracefully falls back to mock data
- Check browser console for detailed error messages
- Verify Supabase project is active (not paused)

## Architecture Overview

The app uses a **Factory Pattern** for data abstraction:
- `IDataService`: Interface defining data contract
- `MockDataService`: Hardcoded test data (no persistence)
- `SupabaseDataService`: REST API calls to Supabase
- `DataServiceFactory`: Automatically chooses service based on config

### Data Flow
```
App.tsx (State)
    ↓
DataServiceFactory.getService()
    ↓
    ├─→ MockDataService (if no credentials)
    └─→ SupabaseDataService (if credentials present)
        ↓
        Supabase REST API → Database Tables
```

## Security Notes

- **Anon Key**: Used for public read/write operations (currently configured)
- **Service Role Key**: For admin operations (NOT included in `.env.local`)
- **RLS Policies**: Not yet implemented; all tables are public. Plan to add Row-Level Security based on `orgId`

## Next Steps

1. Test with sample data
2. Implement Row-Level Security (RLS) for multi-tenancy
3. Add CRUD operations beyond initial data fetch
4. Implement real-time subscriptions with Supabase PostgreSQL changes
5. Add authentication flow with Supabase Auth

## Support

For Supabase documentation, visit: [docs.supabase.com](https://docs.supabase.com)
