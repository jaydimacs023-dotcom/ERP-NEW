<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AT-ERP: Educational Institution Management System

A comprehensive React + TypeScript ERP system for educational institutions, combining training management, student lifecycle, payroll, accounting, and financial operations into a single UI.

## Run Locally

**Prerequisites:** Node.js 18+

### Development with Mock Data (No Supabase Required)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:5173 in your browser

The app will use mock data by default if Supabase credentials are not configured.

### Production with Supabase Cloud Database

1. Create a Supabase project at [supabase.com](https://supabase.com)

2. Create `.env.local` in the project root:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   > Find these values in your Supabase project settings under **API** section

3. **Initialize Supabase Tables:**
   - Go to your Supabase dashboard → SQL Editor
   - Copy the SQL from `schema.sql` in this repository
   - Execute the SQL to create all required tables
   - Seed initial data using the mock data from `db.ts`

4. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

5. Preview production build:
   ```bash
   npm run preview
   ```

## Switching Between Data Sources

### At Runtime (No Rebuild Required)
Open browser DevTools console and run:
```javascript
// Switch to mock data
localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK');
window.location.reload();

// Switch to Supabase cloud
localStorage.setItem('AT_ERP_DATA_SOURCE', 'CLOUD');
window.location.reload();

// Clear override and use default
localStorage.removeItem('AT_ERP_DATA_SOURCE');
window.location.reload();
```

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `VITE_FORCE_SUPABASE`: Set to `'true'` to force cloud mode in development (optional)

## Project Structure

- **views/**: Feature-specific React components (Dashboard, Students, Ledger, etc.)
- **services/**: Data abstraction layer (IDataService, MockDataService, SupabaseDataService)
- **components/**: Reusable UI components (JournalForm, etc.)
- **config/**: Application configuration and environment setup
- **types.ts**: TypeScript interfaces and enums for all entities
- **accountingService.ts**: Double-entry accounting calculations
- **db.ts**: Mock data and initial values
- **schema.sql**: Supabase table definitions

## Tech Stack

- **React 19** + **TypeScript 5.8**: Type-safe UI components
- **Vite 7**: Fast bundler and dev server
- **Recharts**: Financial data visualization
- **Lucide React**: Icon library
- **Supabase**: Cloud database backend (optional)

## Features

- Multi-tenant organization management
- Student lifecycle and batch management
- Trainer scheduling and payroll
- Double-entry accounting with Chart of Accounts
- Financial reporting and ledger views
- Purchase order and vendor management
- Asset tracking
- Audit trail logging
- Role-based access control
