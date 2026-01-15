@echo off
REM =====================================================
REM AT-ERP AUTOMATED MIGRATION LAUNCHER (Windows)
REM Option A: Full Automation Migration
REM =====================================================

echo 🚀 AT-ERP Automated Migration Starting...
echo ==========================================

REM Check prerequisites
echo 📋 Checking prerequisites...

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16+ first.
    pause
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ❌ .env.local file not found. Creating from template...
    copy .env.example .env.local
    echo ⚠️  Please edit .env.local with your Supabase credentials before continuing.
    echo    Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
    pause
)

echo ✅ Prerequisites check passed
echo.

REM Install dependencies
echo 📦 Installing migration dependencies...
npm install @supabase/supabase-js uuid

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Create backup directories
echo 📁 Creating backup directories...
if not exist "backups" mkdir backups
if not exist "migration-logs" mkdir migration-logs
echo ✅ Directories created
echo.

REM Execute database schema first
echo 🗄️  Setting up database schema...
echo    Please execute comprehensive-database-schema.sql in Supabase SQL Editor
echo    Press Enter after schema is successfully executed...
pause

echo ✅ Database schema ready
echo.

REM Run automated migration
echo 🔄 Starting automated migration...
echo ==========================================

node migration-automation.js

REM Check migration result
if %errorlevel% equ 0 (
    echo.
    echo 🎉 MIGRATION COMPLETED SUCCESSFULLY!
    echo ==========================================
    echo.
    echo 📊 Migration Summary:
    echo    - Check migration-logs\ for detailed logs
    echo    - Check backups\ for data backups
    echo    - Verify data in Supabase dashboard
    echo.
    echo 🚀 Next Steps:
    echo    1. Test application: npm run dev
    echo    2. Verify all features work correctly
    echo    3. Update any remaining code if needed
    echo.
    echo 📞 If you encounter issues:
    echo    - Check migration logs for errors
    echo    - Verify Supabase connection
    echo    - Review MIGRATION-GUIDE.md for troubleshooting
) else (
    echo.
    echo ❌ MIGRATION FAILED!
    echo ==========================================
    echo.
    echo 🔍 Troubleshooting:
    echo    1. Check migration-logs\ for error details
    echo    2. Verify Supabase credentials in .env.local
    echo    3. Ensure database schema was executed successfully
    echo    4. Check network connectivity to Supabase
    echo.
    echo 📋 Common fixes:
    echo    - Re-execute database schema in Supabase
    echo    - Verify Supabase project is active
    echo    - Check RLS policies are not blocking operations
    echo.
    echo 🔄 To retry migration:
    echo    1. Fix the issues above
    echo    2. Run this script again
)

echo.
echo 🏁 Migration launcher finished
pause
