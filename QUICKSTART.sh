#!/bin/bash
# Quick Start Guide: AT-ERP with Supabase

echo "=========================================="
echo "AT-ERP Supabase Setup Checklist"
echo "=========================================="
echo ""

echo "✓ Step 1: Update .env.local with Supabase credentials"
echo "  Location: .env.local"
echo "  Update these:"
echo "    VITE_SUPABASE_URL=https://your-project.supabase.co"
echo "    VITE_SUPABASE_ANON_KEY=your-anon-key-here"
echo ""

echo "✓ Step 2: Create Supabase tables"
echo "  1. Go to supabase.com and create project"
echo "  2. Dashboard → SQL Editor → New Query"
echo "  3. Copy schema.sql and execute"
echo ""

echo "✓ Step 3: Install and run"
echo ""
echo "  npm install"
echo "  npm run dev"
echo ""

echo "=========================================="
echo "Useful Commands"
echo "=========================================="
echo ""

echo "Development with mock data (default):"
echo "  npm run dev"
echo ""

echo "Production build:"
echo "  npm run build"
echo ""

echo "Preview production:"
echo "  npm run preview"
echo ""

echo "=========================================="
echo "Browser Console Commands"
echo "=========================================="
echo ""

echo "Switch to Supabase:"
echo "  localStorage.setItem('AT_ERP_DATA_SOURCE', 'CLOUD');"
echo "  window.location.reload();"
echo ""

echo "Switch to mock data:"
echo "  localStorage.setItem('AT_ERP_DATA_SOURCE', 'MOCK');"
echo "  window.location.reload();"
echo ""

echo "=========================================="
echo "Documentation"
echo "=========================================="
echo ""
echo "- Detailed setup: SUPABASE_SETUP.md"
echo "- Migration summary: MIGRATION_SUMMARY.md"
echo "- Development guide: .github/copilot-instructions.md"
echo ""
