# Setting Up SYSTEM_ADMIN in Supabase

## Quick Start: Create Initial SYSTEM_ADMIN User

Follow these steps to seed your Supabase database with the initial SYSTEM_ADMIN user:

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project: https://athhdmvhtfgnohwngqfv.supabase.co
2. Click on **SQL Editor** in the left sidebar
3. Click **+ New query**

### Step 2: Run the SQL Script
Copy and paste the contents of `SUPABASE_SEED_ADMIN.sql` into the SQL Editor:

```sql
-- 1. Insert Platform Organization
INSERT INTO organizations (id, name, currency, is_vat_registered, subscription_status, plan_type, created_at, primary_color)
VALUES (
  'org-system',
  'AccounTech Platform Host',
  'USD',
  true,
  'ACTIVE',
  'ENTERPRISE',
  '2023-01-01T00:00:00Z',
  '#e11d48'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert SYSTEM_ADMIN User
INSERT INTO users (id, name, email, password, role, org_id, created_at)
VALUES (
  'user-dev',
  'Lead Architect',
  'dev@accountech.io',
  'admin',
  'SYSTEM_ADMIN',
  'org-system',
  now()
)
ON CONFLICT (id) DO NOTHING;
```

Then click **Run** (or press Ctrl+Enter)

### Step 3: Verify the Data
You should see success messages. To verify the data was inserted:

```sql
SELECT id, name, email, role, org_id FROM users WHERE role = 'SYSTEM_ADMIN';
```

## Login Credentials

After seeding, you can login with:

| Field | Value |
|-------|-------|
| **Organization** | AccounTech Platform Host |
| **Email** | dev@accountech.io |
| **Password** | admin |
| **Role** | SYSTEM_ADMIN (Platform Administrator) |

## What This Creates

**Organization:** `org-system`
- Name: AccounTech Platform Host
- Currency: USD
- Status: ACTIVE
- Plan: ENTERPRISE
- Purpose: Platform-level administration

**User:** `user-dev`
- Name: Lead Architect
- Email: dev@accountech.io
- Password: admin
- Role: SYSTEM_ADMIN (can manage tenants, organizations, users, and system settings)

## Next Steps

After creating the SYSTEM_ADMIN user:

1. **Login to the app** at http://localhost:5174 with the credentials above
2. **Navigate to Tenant Management** (if visible in sidebar for SYSTEM_ADMIN role)
3. **Create additional organizations** for institutions/training centers
4. **Add users** for each organization with appropriate roles

## Table Column Mappings

If your Supabase columns have different names, adjust the SQL accordingly:

| Entity | Column Names |
|--------|--------------|
| **organizations** | id, name, currency, is_vat_registered, subscription_status, plan_type, created_at, primary_color |
| **users** | id, name, email, password, role, org_id, created_at |

## Troubleshooting

**Error: "relation 'organizations' does not exist"**
- Run your schema.sql file in Supabase SQL Editor first to create all tables
- See SUPABASE_SETUP.md for schema creation

**Error: "duplicate key value violates unique constraint"**
- The user/org already exists; run with `ON CONFLICT DO NOTHING` to skip duplicates
- Or delete the existing record and re-insert

**User doesn't appear in login page**
- Ensure the app is set to CLOUD mode (check console: should show SUPABASE_CLOUD)
- Check `.env.local` has `VITE_FORCE_SUPABASE=true`
- Refresh the browser (F5)
