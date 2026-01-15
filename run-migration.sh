#!/bin/bash

# =====================================================
# AT-ERP AUTOMATED MIGRATION LAUNCHER
# Option A: Full Automation Migration
# =====================================================

echo "🚀 AT-ERP Automated Migration Starting..."
echo "=========================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Creating from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your Supabase credentials before continuing."
    echo "   Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
    read -p "Press Enter after editing .env.local..."
fi

# Source environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ Cannot load environment variables"
    exit 1
fi

# Check Supabase credentials
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Supabase credentials not found in .env.local"
    echo "   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Install dependencies
echo "📦 Installing migration dependencies..."
npm install @supabase/supabase-js uuid

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Create backup directories
echo "📁 Creating backup directories..."
mkdir -p backups migration-logs
echo "✅ Directories created"
echo ""

# Execute database schema first
echo "🗄️  Setting up database schema..."
echo "   Please execute comprehensive-database-schema.sql in Supabase SQL Editor"
echo "   Press Enter after schema is successfully executed..."
read -p ""

echo "✅ Database schema ready"
echo ""

# Run automated migration
echo "🔄 Starting automated migration..."
echo "=========================================="

node migration-automation.js

# Check migration result
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 MIGRATION COMPLETED SUCCESSFULLY!"
    echo "=========================================="
    echo ""
    echo "📊 Migration Summary:"
    echo "   - Check migration-logs/ for detailed logs"
    echo "   - Check backups/ for data backups"
    echo "   - Verify data in Supabase dashboard"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Test application: npm run dev"
    echo "   2. Verify all features work correctly"
    echo "   3. Update any remaining code if needed"
    echo ""
    echo "📞 If you encounter issues:"
    echo "   - Check migration logs for errors"
    echo "   - Verify Supabase connection"
    echo "   - Review MIGRATION-GUIDE.md for troubleshooting"
else
    echo ""
    echo "❌ MIGRATION FAILED!"
    echo "=========================================="
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   1. Check migration-logs/ for error details"
    echo "   2. Verify Supabase credentials in .env.local"
    echo "   3. Ensure database schema was executed successfully"
    echo "   4. Check network connectivity to Supabase"
    echo ""
    echo "📋 Common fixes:"
    echo "   - Re-execute database schema in Supabase"
    echo "   - Verify Supabase project is active"
    echo "   - Check RLS policies are not blocking operations"
    echo ""
    echo "🔄 To retry migration:"
    echo "   1. Fix the issues above"
    echo "   2. Run this script again"
fi

echo ""
echo "🏁 Migration launcher finished"
