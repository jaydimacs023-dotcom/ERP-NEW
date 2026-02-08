# ✅ AT-ERP Supabase Migration Checklist

## Pre-Setup (Complete Before Running)

- [ ] Create Supabase account at [supabase.com](https://supabase.com)
- [ ] Create new Supabase project named "AT-ERP"
- [ ] Wait for project provisioning (2-3 minutes)
- [ ] Copy Project URL and Anon Key from Settings → API

## Configuration

- [ ] Update `.env.local` with your Supabase credentials:
  ```bash
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

## Database Setup

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Create new query
- [ ] Copy entire contents of `schema.sql` from this repository
- [ ] Execute SQL (creates all 20 tables)
- [ ] Verify tables appear in Database → Tables section

### Expected Tables Created:
- [ ] organizations
- [ ] users
- [ ] students
- [ ] qualifications
- [ ] trainers
- [ ] batches
- [ ] sponsors
- [ ] items
- [ ] vendors
- [ ] locations
- [ ] schedules
- [ ] employees
- [ ] bank_accounts
- [ ] chart_of_accounts
- [ ] journal_entries
- [ ] journal_lines
- [ ] payroll_runs
- [ ] payroll_lines
- [ ] audit_logs
- [ ] purchase_orders

## Application Setup

- [ ] Navigate to project directory: `cd e:\laragon\www\AT-ERP`
- [ ] Install dependencies: `npm install`
- [ ] Start development server: `npm run dev`
- [ ] Open browser at `http://localhost:5173`

## Verification

- [ ] App loads without errors
- [ ] Check browser console for "[Supabase] ☁️ Fetching data from Supabase..."
- [ ] Data displays in Dashboard and other views
- [ ] No "missing credentials" warnings

### If Using Mock Data Instead:
- [ ] App still works (graceful fallback)
- [ ] Console shows "[ERP System] Data Strategy: MOCK_LOCAL"
- [ ] You can add Supabase credentials later and switch at runtime

## Testing Data Switching

- [ ] Open browser DevTools (F12)
- [ ] Run in console: `localStorage.setItem('AT_ERP_DATA_SOURCE', 'CLOUD'); window.location.reload();`
- [ ] App reloads and uses Supabase
- [ ] Run in console: `localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK'); window.location.reload();`
- [ ] App reloads and uses mock data
- [ ] Verify console shows correct data strategy

## Initial Data (Optional)

- [ ] Create test organization via Supabase table editor
- [ ] Create test user linked to organization
- [ ] Create test student for training features
- Or populate via `schema.sql` INSERT statements

## Building for Production

- [ ] Run: `npm run build`
- [ ] Verify build completes without errors
- [ ] Output goes to `dist/` folder
- [ ] Deploy `dist/` to hosting (Netlify, Vercel, etc.)

## Production Deployment Preparation

- [ ] `.env.local` credentials work in production
- [ ] Database queries are optimized (no N+1 issues)
- [ ] Consider implementing Row-Level Security (RLS) on Supabase
- [ ] Set up monitoring/logging for data fetches

## Troubleshooting Checklist

- [ ] Credentials in `.env.local` are correct
- [ ] Dev server restarted after `.env.local` changes
- [ ] Supabase project is active (not paused)
- [ ] Using anon (public) key, not service role key
- [ ] All 20 tables exist in Supabase (not just some)
- [ ] Browser console shows specific error messages
- [ ] Network tab shows successful REST API calls

## Documentation Review

- [ ] Read `SUPABASE_SETUP.md` for detailed instructions
- [ ] Read `MIGRATION_SUMMARY.md` for what changed
- [ ] Read `.github/copilot-instructions.md` for development patterns
- [ ] Bookmark [docs.supabase.com](https://docs.supabase.com) for reference

## Next Steps After Setup

1. Add sample data to tables
2. Test all views load data correctly
3. Create backup of database structure
4. Plan implementation of Row-Level Security
5. Design data sync strategy (if needed)
6. Set up error monitoring/logging

---

**Status:** Ready for Supabase integration ✅
**Last Updated:** January 16, 2026
**Migrated From:** Gemini API
**Current State:** Test/Development Ready
