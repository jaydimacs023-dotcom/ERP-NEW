# Supabase Database Sync & Migration Guide
> **Comprehensive guide for syncing database schema and data between Supabase Cloud and Local Supabase (Docker).**

---

## Table of Contents
1. [Environment & Architecture Overview](#1-environment--architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [PART 1: Cloud ➔ Local (Cloning / Syncing Down)](#3-part-1-cloud--local-cloning--syncing-down)
4. [PART 2: Local ➔ Cloud (Pushing Schema & Data Up)](#4-part-2-local--cloud-pushing-schema--data-up)
5. [PART 3: Day-to-Day Local Development Commands](#5-part-3-day-to-day-local-development-commands)
6. [PART 4: Common Errors & Troubleshooting](#6-part-4-common-errors--troubleshooting)

---

## 1. Environment & Architecture Overview

| Component | Local Development (Docker) | Remote / Cloud (Production/Staging) |
| :--- | :--- | :--- |
| **Hosting** | Local machine via Docker | `supabase.com` Cloud |
| **PostgreSQL Port** | `127.0.0.1:55432` | `aws-0-*.pooler.supabase.com:6543` / `5432` |
| **API URL (Kong)** | `http://127.0.0.1:54321` | `https://<project-ref>.supabase.co` |
| **Studio UI** | `http://127.0.0.1:55433` | `https://supabase.com/dashboard/project/<project-ref>` |
| **Mailpit (Inbucket)**| `http://127.0.0.1:55434` | Managed Cloud SMTP |
| **Auth Keys** | Generated local keys (`sb_publishable_...`) | Project Dashboard API Keys |

---

## 2. Prerequisites

1. **Docker Desktop** installed and actively running.
2. **Supabase CLI** (installed in project `devDependencies`, use via `npx supabase`).
3. **Supabase Remote Project Reference ID** (found in your cloud URL: `https://supabase.com/dashboard/project/<project-ref>`).
4. **Remote Database Password** (set when you created the Supabase cloud project).

---

## 3. PART 1: Cloud ➔ Local (Cloning / Syncing Down)

Follow these steps whenever you want to bring the latest cloud schema and data to your local machine.

### Step 1: Login and Link to Cloud Project
```powershell
# 1. Log in to Supabase CLI (will open your browser)
npx supabase login

# 2. Link your local directory to your cloud project
npx supabase link --project-ref <your-remote-project-ref>
```
*(Enter your remote database password when prompted).*

---

### Step 2: Dump Cloud Schema & Data

```powershell
# 1. Dump full cloud schema into the base migration
npx supabase db dump --linked -f supabase/migrations/00000000000000_base_schema.sql

# 2. Dump all cloud table data into seed.sql
npx supabase db dump --linked --data-only -f supabase/seed.sql
```

> [!NOTE]
> `seed.sql` automatically includes `SET session_replication_role = replica;` at the top, which bypasses foreign key constraint checks during data loading.

---

### Step 3: Ensure Migrations Directory Cleanliness
Because `00000000000000_base_schema.sql` contains the complete schema, any older historical migration files with duplicate date prefixes should be archived to prevent primary key collisions:

```powershell
# Create archive folder if not already existing
mkdir supabase\migrations_archive

# Move older migrations into the archive
Get-ChildItem -Path supabase\migrations -Filter "*.sql" | Where-Object { $_.Name -ne "00000000000000_base_schema.sql" } | Move-Item -Destination supabase\migrations_archive
```

---

### Step 4: Start & Reset Local Supabase
```powershell
# Start Docker containers (if not running)
npx supabase start

# Re-run base schema and seed data cleanly
npx supabase db reset
```

---

### Step 5: Check Local Credentials & Update `.env.local`
Run:
```powershell
npx supabase status
```

Copy the values into your `.env.local`:
```env
VITE_APP_ENV=local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

---

### Step 6: Verify
- **Local App**: [http://localhost:5173](http://localhost:5173)
- **Local Studio**: [http://127.0.0.1:55433](http://127.0.0.1:55433)

---

## 4. PART 2: Local ➔ Cloud (Pushing Schema & Data Up)

Follow these steps when you develop new features, tables, columns, or triggers locally and want to deploy them to Supabase Cloud.

---

### Workflow A: Pushing New Schema Changes (Recommended Migration Workflow)

When you make schema changes locally (e.g. adding a table, adding a column):

#### 1. Generate a Diff Migration
Compare your local schema against your remote schema to automatically create a migration file:
```powershell
# Creates a new timestamped migration file in supabase/migrations/
npx supabase db diff --linked -f add_new_feature_name
```

#### 2. Review the Generated Migration
Open the newly created file in `supabase/migrations/<timestamp>_add_new_feature_name.sql` and verify the SQL statements.

#### 3. Test Locally First
```powershell
npx supabase db reset
```

#### 4. Push Migration to Cloud
```powershell
npx supabase db push
```
*(This safely executes only unapplied migrations on your remote Supabase cloud database).*

---

### Workflow B: Pushing Local Data / Seed to Cloud

If you entered data locally that you want to upload to Cloud:

#### Option 1: Via Supabase Cloud SQL Editor (Safest)
1. Dump your local data:
   ```powershell
   npx supabase db dump --local --data-only -f supabase/local_data_export.sql
   ```
2. Open **Supabase Cloud Dashboard** ➔ **SQL Editor**.
3. Copy the content of `local_data_export.sql` (or parts of it) and run it.

#### Option 2: Direct PSQL Insertion
```powershell
# Get your connection string from Cloud Dashboard -> Project Settings -> Database
psql "postgresql://postgres.<project-ref>:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" -f supabase/local_data_export.sql
```

---

## 5. PART 3: Day-to-Day Local Development Commands

| Task | Command |
| :--- | :--- |
| **Start Local Supabase** | `npx supabase start` |
| **Check Local Status & Keys** | `npx supabase status` |
| **Stop Local Supabase** | `npx supabase stop` |
| **Stop and Delete Local DB** | `npx supabase stop --no-backup` |
| **Rebuild DB from Migrations & Seed** | `npx supabase db reset` |
| **Create Empty Migration File** | `npx supabase migration new <name>` |
| **Generate Schema Diff Migration** | `npx supabase db diff --linked -f <name>` |
| **Deploy Migrations to Cloud** | `npx supabase db push` |

---

## 6. PART 4: Common Errors & Troubleshooting

### Error 1: `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)`
- **Cause:** Multiple migration files in `supabase/migrations/` share the same version prefix (e.g., `20260419_...`).
- **Fix:** Archive older migrations into `supabase/migrations_archive/` or ensure all filenames have unique 14-digit timestamps (`YYYYMMDDHHMMSS_name.sql`).

### Error 2: `ERROR: relation "public.users" does not exist (SQLSTATE 42P01)`
- **Cause:** Incremental patch migrations are running before the base schema is created.
- **Fix:** Dump the full remote schema as `00000000000000_base_schema.sql` so it executes first.

### Error 3: `pg_dump: warning: there are circular foreign-key constraints...`
- **Cause:** Tables like `chart_of_accounts` have recursive references (`parent_id -> id`).
- **Fix:** This warning is harmless because Supabase CLI automatically places `SET session_replication_role = replica;` at the beginning of `seed.sql`.

### Error 4: `[Config] Refusing to start: VITE_APP_ENV is local but VITE_SUPABASE_URL points to hosted Supabase`
- **Cause:** Safety check in [config/app.ts](file:///e:/ERP-NEW/config/app.ts) preventing accidental mutations between environments.
- **Fix:** In `.env.local`, ensure `VITE_SUPABASE_URL` is set to `http://127.0.0.1:54321` when `VITE_APP_ENV=local`.

### Error 5: `Journal voucher function secrets are not configured` (or Edge Function 500 error)
- **Cause:** Edge functions (e.g. `journal-vouchers`, `stock-adjustments-write`, `users-write`) require `AT_ERP_JWT_SECRET` to verify user auth tokens. In Cloud, this is set in Cloud Secrets, but locally it must be provided in `supabase/functions/.env`.
- **Fix:** Create `supabase/functions/.env` containing:
  ```env
  AT_ERP_JWT_SECRET=AT-ERP-JWT-SECRET-KEY-2024-CHANGE-IN-PRODUCTION
  ```
  Then restart local Supabase (`npx supabase stop` then `npx supabase start`).


