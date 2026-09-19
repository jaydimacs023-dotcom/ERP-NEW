# Supabase Database Sync & Migration Guide
> **Comprehensive guide for syncing database schema and data between Supabase Cloud and Local Supabase (Docker).**

---

## Table of Contents
1. [Environment & Architecture Overview](#1-environment--architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [PART 1: Cloud ➔ Local (Cloning / Syncing Down)](#3-part-1-cloud--local-cloning--syncing-down)
4. [PART 2: Local ➔ Cloud (Pushing Schema & Data Up)](#4-part-2-local--cloud-pushing-schema--data-up)
5. [PART 3: Safe Parity Testing (Comparing Cloud vs Local without Data Loss)](#5-part-3-safe-parity-testing-comparing-cloud-vs-local-without-data-loss)
6. [PART 4: Day-to-Day Local Development Commands](#6-part-4-day-to-day-local-development-commands)
7. [PART 5: Common Errors & Troubleshooting](#7-part-5-common-errors--troubleshooting)

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

## 5. PART 3: Safe Parity Testing (Comparing Cloud vs Local without Data Loss)

When your cloud database is in **production**, you must **never** run commands that could mutate, lock, or wipe live tables. The methods below are **100% read-only** and guaranteed safe for production.

> [!IMPORTANT]
> **Production Safety Golden Rules:**
> 1. **DO NOT** run `npx supabase db push` when only inspecting or testing parity.
> 2. **DO NOT** run `npx supabase db reset` against a linked remote project. (`db reset` is intended for local Docker only).
> 3. **All commands in this section perform read-only catalog inspections and `SELECT` queries.** Cloud production data will not be modified or deleted.

---

### Method 1: CLI Migration History Check (Fastest)

Check which migration files are applied on Cloud vs your Local machine:

```powershell
npx supabase migration list
```

**How to interpret the output:**
- Both **LOCAL** and **REMOTE** columns will display migration timestamps and status.
- If all timestamps have checkmarks / match on both sides, **your migration history is completely in sync**.
- If REMOTE has entries missing locally, pull them down first before working.
- If LOCAL has unapplied migrations, those are pending changes waiting to be deployed.

---

### Method 2: Schema Drift & DDL Diff (CLI Read-Only)

Compare your local PostgreSQL schema against the linked Cloud database schema without applying anything:

```powershell
# Dry-run comparison: Prints the DDL differences directly to the terminal stdout
npx supabase db diff --linked
```

You can also output the diff to a temporary file for detailed inspection:
```powershell
npx supabase db diff --linked > schema_diff_report.sql
```

**How to interpret the result:**
- **No output / Empty file:** Schema is **100% identical** between Cloud and Local (all tables, columns, constraints, foreign keys, triggers, and RLS policies match).
- **Shows SQL statements (`CREATE TABLE`, `ALTER TABLE`, etc.):** Indicates schema drift. Inspect the statements to see exactly what differs without any risk to cloud production data. Delete `schema_diff_report.sql` after review.

---

### Method 3: Structural Parity via SQL (Table & Column Counts)

Run this read-only query in both **Cloud Studio SQL Editor** and **Local Studio SQL Editor** (`http://127.0.0.1:55433`):

```sql
-- Safe, read-only: Structural summary of public schema
SELECT 
    (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS total_tables,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public') AS total_columns,
    (SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY') AS total_primary_keys,
    (SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY') AS total_foreign_keys,
    (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS total_user_triggers,
    (SELECT count(*) FROM pg_policy) AS total_rls_policies;
```

**Verification:** If all numbers match between Cloud and Local, your database structure, constraints, triggers, and RLS security policies are fully aligned.

---

### Method 4: Data Parity Check (Table-by-Table Row Count)

To compare record counts across all tables between Cloud and Local without loading large datasets into memory, run this read-only script in both SQL Editors:

```sql
-- Safe, read-only: Exact row count for all public tables
DO $$
DECLARE
    rec RECORD;
    cnt BIGINT;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS temp_row_counts (
        table_name TEXT,
        row_count BIGINT
    ) ON COMMIT DROP;
    
    FOR rec IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    ) LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', rec.table_name) INTO cnt;
        INSERT INTO temp_row_counts VALUES (rec.table_name, cnt);
    END LOOP;
END $$;

SELECT table_name, row_count 
FROM temp_row_counts 
ORDER BY table_name;
```

**Verification:**
- Paste the results side-by-side or compare table rows (e.g. `users`, `organizations`, `chart_of_accounts`, `students`, `invoices`).
- If you recently did a [PART 1 Sync Down](#3-part-1-cloud--local-cloning--syncing-down), the row counts should be identical.

---

### Method 5: Master Data Hash / Checksum Verification (Deep Data Integrity)

For critical configuration or reference tables (e.g., `chart_of_accounts`, `roles`, `permissions`, `tax_types`), you can verify that the actual data values match byte-for-byte by calculating an MD5 hash:

```sql
-- Safe, read-only: Generates an MD5 fingerprint of table rows
SELECT md5(string_agg(t.*::text, '' ORDER BY id)) AS table_fingerprint
FROM (SELECT * FROM chart_of_accounts) t;
```

*(Repeat for any table by replacing `chart_of_accounts` with the target table name).*

**Verification:**
- Run the query on Cloud and Local.
- If the resulting 32-character hash is identical (e.g., `d41d8cd98f00b204e9800998ecf8427e`), the rows, columns, and data values are **guaranteed to be identical**.

---

## 6. PART 4: Day-to-Day Local Development Commands

| Task | Command |
| :--- | :--- |
| **Start Local Supabase** | `npx supabase start` |
| **Check Local Status & Keys** | `npx supabase status` |
| **Stop Local Supabase** | `npx supabase stop` |
| **Stop and Delete Local DB** | `npx supabase stop --no-backup` |
| **Rebuild DB from Migrations & Seed** | `npx supabase db reset` |
| **Check Migration Sync Status** | `npx supabase migration list` |
| **Preview Schema Diff (Read-Only)** | `npx supabase db diff --linked` |
| **Create Empty Migration File** | `npx supabase migration new <name>` |
| **Generate Schema Diff Migration** | `npx supabase db diff --linked -f <name>` |
| **Deploy Migrations to Cloud** | `npx supabase db push` |

---

## 7. PART 5: Common Errors & Troubleshooting

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



