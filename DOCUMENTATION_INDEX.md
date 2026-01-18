# 📖 AT-ERP Documentation Index

## Quick Navigation

### 🚀 Getting Started
- **[README.md](README.md)** - Project overview and quick start
- **[README_SUPABASE.md](README_SUPABASE.md)** - Complete Supabase migration guide (START HERE!)
- **[SUPABASE_MIGRATION_COMPLETE.md](SUPABASE_MIGRATION_COMPLETE.md)** - What was done, next steps

### ⚙️ Setup & Configuration
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Step-by-step Supabase setup with troubleshooting
- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - 50-point verification checklist
- **[.env.local](.env.local)** - Environment variables (update with your Supabase credentials)

### 📋 Development & Architecture
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - Architecture patterns, code conventions, development workflows
- **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** - What changed from Gemini to Supabase
- **[QUICKSTART.sh](QUICKSTART.sh)** - Command reference cheat sheet

### 💾 Database
- **[schema.sql](schema.sql)** - SQL schema for all 20 tables (execute in Supabase)
- **[db.ts](db.ts)** - Mock data and initial values

---

## 📚 Reading Guide by Role

### 👤 **New Developer/Setup**
1. Start: [README_SUPABASE.md](README_SUPABASE.md) (15 min)
2. Setup: [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (20 min)
3. Verify: [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) (5 min)
4. Learn: [.github/copilot-instructions.md](.github/copilot-instructions.md) (15 min)

### 🏗️ **Architect/System Designer**
1. Start: [README.md](README.md) + [README_SUPABASE.md](README_SUPABASE.md)
2. Architecture: [.github/copilot-instructions.md](.github/copilot-instructions.md)
3. Deep Dive: [schema.sql](schema.sql) + [types.ts](types.ts)
4. Migration Context: [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)

### 🛠️ **DevOps/Infrastructure**
1. Overview: [README_SUPABASE.md](README_SUPABASE.md) - Switching Between Data Sources section
2. Setup: [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Troubleshooting section
3. Database: [schema.sql](schema.sql)
4. Credentials: [.env.local](.env.local)

### 🤖 **AI Coding Agent (Claude/Copilot)**
1. **Must Read First**: [.github/copilot-instructions.md](.github/copilot-instructions.md)
2. Reference: [types.ts](types.ts) - All entity definitions
3. Services: [services/DataServiceFactory.ts](services/DataServiceFactory.ts) - Data abstraction
4. Examples: [views/Dashboard.tsx](views/Dashboard.tsx) - Component patterns

---

## 🎯 Common Tasks

### I need to...

| Task | Document | Section |
|------|----------|---------|
| Set up Supabase for first time | [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Complete guide |
| Verify everything is configured | [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) | All checkpoints |
| Switch between mock and cloud data | [README_SUPABASE.md](README_SUPABASE.md) | 🔄 Data Source Switching |
| Understand the architecture | [.github/copilot-instructions.md](.github/copilot-instructions.md) | Architecture Patterns |
| Add a new view/feature | [.github/copilot-instructions.md](.github/copilot-instructions.md) | Common Tasks |
| Query the database directly | [schema.sql](schema.sql) | Table definitions |
| Understand data flow | [README_SUPABASE.md](README_SUPABASE.md) | 📊 Architecture |
| Troubleshoot errors | [SUPABASE_SETUP.md](SUPABASE_SETUP.md) | Troubleshooting |
| Build for production | [README.md](README.md) | Build & Run |
| See what changed from Gemini | [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) | Complete summary |

---

## 🚀 Setup Timeline

```
Time        Task                           Document
────────────────────────────────────────────────────────
0 min       Read intro                     README_SUPABASE.md (first 5 min)
5 min       Create Supabase project        SUPABASE_SETUP.md - Step 1
8 min       Get credentials                SUPABASE_SETUP.md - Step 2
10 min      Update .env.local              .env.local
12 min      Create database tables         SUPABASE_SETUP.md - Step 3
15 min      Install dependencies           npm install
17 min      Start dev server               npm run dev
20 min      Verify data loads              Browser console
22 min      Test data switching            localStorage commands
25 min      🎉 Complete!
```

---

## 📊 File Organization

```
AT-ERP/
├── README.md                              ← Project overview
├── README_SUPABASE.md                     ← START HERE for setup
├── SUPABASE_SETUP.md                      ← Detailed guide
├── SUPABASE_MIGRATION_COMPLETE.md         ← What was done
├── SETUP_CHECKLIST.md                     ← Verification
├── MIGRATION_SUMMARY.md                   ← Gemini → Supabase changes
├── QUICKSTART.sh                          ← Command reference
├── .env.local                             ← Your credentials (UPDATE ME!)
├── schema.sql                             ← Database schema
├── types.ts                               ← Entity definitions
├── accountingService.ts                   ← Accounting logic
├── db.ts                                  ← Mock data
│
├── .github/
│   └── copilot-instructions.md            ← Architecture & patterns
│
├── services/
│   ├── DataServiceFactory.ts              ← Smart data source selection
│   ├── IDataService.ts                    ← Interface
│   ├── MockDataService.ts                 ← Test data provider
│   └── SupabaseDataService.ts             ← Cloud API integration
│
├── views/                                 ← React components (20+ views)
├── components/                            ← Reusable components
└── config/
    └── app.ts                             ← Environment config
```

---

## ✅ Key Concepts

### Data Source Selection
- **Factory Pattern** (DataServiceFactory) automatically chooses between Mock and Supabase
- **Automatic Fallback** if Supabase is down or credentials missing
- **Runtime Switching** via browser localStorage (no rebuild required)

### Entity Model
- All entities extend **BaseEntity** (id, isDeleted, deletedAt, deletedBy)
- Use **AccountClass** enum for accounting entities
- Status fields use string unions (type safety)

### View Architecture
- **Props Drilling** from App.tsx to views
- Views are **stateless** (all state in App.tsx)
- Each view receives only the data it needs

### Multi-Tenancy
- Filter by **orgId** for organization data isolation
- Currency from **Organization** entity for formatting

---

## 🔗 External Resources

- **Supabase Documentation**: [docs.supabase.com](https://docs.supabase.com)
- **React 19**: [react.dev](https://react.dev)
- **TypeScript**: [typescriptlang.org](https://www.typescriptlang.org)
- **Vite**: [vitejs.dev](https://vitejs.dev)
- **Recharts**: [recharts.org](http://recharts.org)

---

## 📞 Support Quick Links

**Setup Issues?**
→ [SUPABASE_SETUP.md](SUPABASE_SETUP.md#troubleshooting)

**Code Questions?**
→ [.github/copilot-instructions.md](.github/copilot-instructions.md)

**Database Schema?**
→ [schema.sql](schema.sql)

**Troubleshooting?**
→ [README_SUPABASE.md](README_SUPABASE.md#-troubleshooting)

---

## ✨ Next Steps

1. ✅ Read [README_SUPABASE.md](README_SUPABASE.md)
2. ✅ Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
3. ✅ Verify with [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)
4. ✅ Study [.github/copilot-instructions.md](.github/copilot-instructions.md)
5. ✅ Start coding!

---

## 🔧 Recent Fix: "age" Field Error (January 2024)

### Problem
When creating students in Supabase, the system threw error: `record "new" has no field "age"`

### Solution
Applied normalized data pipeline: camelCase → snake_case → schema filter → validate → POST

### Key Documents (New)
- **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** - Problem, solution, and status (5 min read)
- **[AGE_FIELD_FIX.md](AGE_FIELD_FIX.md)** - Technical root cause and implementation details (10 min read)
- **[VISUAL_ARCHITECTURE.md](VISUAL_ARCHITECTURE.md)** - Data flow diagrams and visual explanations (10 min read)
- **[FIX_VERIFICATION_GUIDE.md](FIX_VERIFICATION_GUIDE.md)** - Testing and deployment guide (15 min read)
- **[STUDENT_CRUD_COMPLETE.md](STUDENT_CRUD_COMPLETE.md)** - Complete CRUD implementation reference (20 min read)
- **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - Verification and deployment checklist (10 min read)

### What Was Fixed
- ✅ All CRUD methods now properly filter invalid fields
- ✅ Student, Organization, User, Batch entities all updated
- ✅ New `insertToSupabaseRaw()` and `updateInSupabaseRaw()` methods added
- ✅ Comprehensive debug logging for troubleshooting
- ✅ Complete documentation for maintenance

### Quick Start Testing
1. Open http://localhost:5174
2. Go to Students view
3. Create student with age field
4. Check browser console for `[Supabase] Filtered student data ready for POST:`
5. Verify `hasAge: false` in debug output
6. See [FIX_VERIFICATION_GUIDE.md](FIX_VERIFICATION_GUIDE.md) for full testing

---

**Last Updated:** January 16, 2026  
**Version:** 1.1 - Supabase Integration + age Field Fix  
**Status:** ✅ Ready for Development & Testing

