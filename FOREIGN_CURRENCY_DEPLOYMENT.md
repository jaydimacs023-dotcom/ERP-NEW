# Foreign Currency - Deployment Instructions

## Objective
Implement complete foreign currency and exchange rate support in AT-ERP.

**Status:** ✅ Ready to Deploy

---

## Pre-Deployment Checklist

- [ ] Reviewed `FOREIGN_CURRENCY_IMPLEMENTATION.md`
- [ ] Reviewed `FOREIGN_CURRENCY_QUICK_REFERENCE.md`
- [ ] Supabase account ready
- [ ] Database credentials available
- [ ] Git branch ready (optional)

---

## Step 1: Deploy Database Migration

### 1.1 Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### 1.2 Copy and Execute Migration

1. Open file: `EXCHANGE_RATES_TABLE.sql`
2. Copy entire contents (182 lines)
3. Paste into Supabase SQL Editor
4. Click **Run** button (or Ctrl+Enter)
5. Wait for success message

**Expected Output:**
```
Query succeeded! (0 rows)
```

### 1.3 Verify Table Creation

Run verification query in SQL Editor:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'exchange_rates' 
ORDER BY ordinal_position;
```

**Expected: 15 columns**
- id (UUID)
- org_id (UUID)
- from_currency (VARCHAR)
- to_currency (VARCHAR)
- rate (DECIMAL)
- effective_date (DATE)
- source (VARCHAR)
- is_manual (BOOLEAN)
- notes (TEXT)
- created_by (UUID)
- created_at (TIMESTAMP)
- updated_by (UUID)
- updated_at (TIMESTAMP)
- is_deleted (BOOLEAN)
- deleted_by (UUID)
- deleted_at (TIMESTAMP)

### 1.4 Verify Indexes

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'exchange_rates' 
ORDER BY indexname;
```

**Expected: 4 indexes**
1. exchange_rates_pkey
2. idx_exchange_rates_org_id
3. idx_exchange_rates_currency_pair
4. idx_exchange_rates_effective_date
5. idx_exchange_rates_created_at

### 1.5 Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'exchange_rates';
```

**Expected:**
```
exchange_rates | true
```

### 1.6 Verify RLS Policies

```sql
SELECT policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'exchange_rates' 
ORDER BY policyname;
```

**Expected: 4 policies**
- exchange_rates_delete_org
- exchange_rates_insert_org
- exchange_rates_update_org
- exchange_rates_view_org

---

## Step 2: Verify Application Code

### 2.1 Check File Updates

Verify these files exist and are updated:

```bash
# In project root, run:
ls -la services/ExchangeRateService.ts
ls -la EXCHANGE_RATES_TABLE.sql
ls -la FOREIGN_CURRENCY_IMPLEMENTATION.md
ls -la FOREIGN_CURRENCY_QUICK_REFERENCE.md
ls -la FOREIGN_CURRENCY_COMPLETION.md
```

### 2.2 Verify TypeScript Compilation

```bash
npm run build 2>&1 | grep -i "error\|exchange"
```

**Expected:** No TypeScript errors related to exchange rates

### 2.3 Check Types Are Defined

```bash
grep -n "interface ExchangeRate" src/types.ts
grep -n "class ExchangeRateService" services/ExchangeRateService.ts
```

**Expected:** Both found with correct line numbers

---

## Step 3: Test in Development

### 3.1 Start Development Server

```bash
npm run dev
```

**Expected Output:**
```
  VITE v7.0.0  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 3.2 Open Browser Console

1. Open http://localhost:5173
2. Press F12 (DevTools)
3. Go to **Console** tab

### 3.3 Test ExchangeRateService

Paste each test into console:

**Test 1: Validate a rate**
```javascript
const validation = window.ExchangeRateService?.validateRate({
  fromCurrency: 'USD',
  toCurrency: 'PHP',
  rate: 56.50,
  effectiveDate: '2024-01-31'
});

console.log('Validation result:', validation);
// Expected: { isValid: true, errors: [] }
```

**Test 2: Convert amount**
```javascript
const conversion = window.ExchangeRateService?.convert(1000, 'USD', 'PHP', 56.50);
console.log('Conversion:', conversion);
// Expected: convertedAmount = 56500
```

**Test 3: Calculate unrealized G/L**
```javascript
const gapl = window.ExchangeRateService?.calculateUnrealizedGainLoss(
  1000, 50.00, 56.50, 'PHP'
);
console.log('Unrealized G/L:', gapl);
// Expected: unrealizedGainLoss = 6500, isGain = true
```

### 3.4 Test Data Service

**Test 4: Check IDataService has methods**
```javascript
const service = window.dataService; // From App context
console.log('Has createExchangeRate:', typeof service.createExchangeRate);
console.log('Has getExchangeRatesByOrg:', typeof service.getExchangeRatesByOrg);
// Expected: both return 'function'
```

---

## Step 4: Create Test Data

### 4.1 Add Sample Exchange Rates

**In Supabase SQL Editor, run:**

```sql
-- Insert test rates (replace 'YOUR-ORG-ID' with actual org UUID)
INSERT INTO exchange_rates (org_id, from_currency, to_currency, rate, effective_date, source, is_manual, created_by)
VALUES
  ('YOUR-ORG-ID', 'USD', 'PHP', 56.50, '2024-01-31', 'MANUAL', true, auth.uid()),
  ('YOUR-ORG-ID', 'USD', 'PHP', 55.75, '2024-01-30', 'MANUAL', true, auth.uid()),
  ('YOUR-ORG-ID', 'EUR', 'PHP', 61.25, '2024-01-31', 'MANUAL', true, auth.uid()),
  ('YOUR-ORG-ID', 'JPY', 'PHP', 0.3820, '2024-01-31', 'MANUAL', true, auth.uid());
```

### 4.2 Verify Data Inserted

```sql
SELECT org_id, from_currency, to_currency, rate, effective_date 
FROM exchange_rates 
WHERE org_id = 'YOUR-ORG-ID'
ORDER BY effective_date DESC, from_currency;
```

**Expected: 4 rows inserted**

### 4.3 Test RLS Policy

```javascript
// In app, fetch rates
const rates = await dataService.getExchangeRatesByOrg(currentOrgId);
console.log('Fetched rates:', rates.length);
// Expected: 4 rates
```

---

## Step 5: Production Deployment

### 5.1 Build Production Bundle

```bash
npm run build
```

**Expected:**
```
✓ 1234 modules transformed
dist/index.html
dist/assets/index-xxxxx.js
[and other asset files]
```

### 5.2 Deploy to Production

**Option A: Vercel/Netlify**
```bash
git add .
git commit -m "feat: add foreign currency exchange rates support"
git push  # Automatically deploys
```

**Option B: Manual Deployment**
```bash
# Upload dist/ folder to your hosting
# Ensure Supabase credentials in environment variables
# Test at production URL
```

### 5.3 Verify in Production

1. Go to production URL
2. Open DevTools Console
3. Run tests from Step 3.3
4. Verify rates load from Supabase

---

## Step 6: Create UI for Rate Management (Optional)

### 6.1 Create ExchangeRatesView Component

Create file: `views/ExchangeRatesView.tsx`

```typescript
import React, { useState } from 'react';
import { ExchangeRate } from '../types';
import { ExchangeRateService } from '../services/ExchangeRateService';

interface ExchangeRatesViewProps {
  exchangeRates: ExchangeRate[];
  onAdd: (rate: ExchangeRate) => void;
  onUpdate: (id: string, updates: Partial<ExchangeRate>) => void;
  onDelete: (id: string) => void;
}

export default function ExchangeRatesView({
  exchangeRates,
  onAdd,
  onUpdate,
  onDelete
}: ExchangeRatesViewProps) {
  const [formData, setFormData] = useState({
    fromCurrency: 'USD',
    toCurrency: 'PHP',
    rate: 0,
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  const handleAddRate = async () => {
    const validation = ExchangeRateService.validateRate(formData);
    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }

    const newRate = {
      ...formData,
      id: `rate-${Date.now()}`,
      orgId: 'current-org-id',
      source: 'MANUAL',
      isManual: true,
      createdAt: new Date().toISOString()
    };

    onAdd(newRate as ExchangeRate);
    setFormData({
      fromCurrency: 'USD',
      toCurrency: 'PHP',
      rate: 0,
      effectiveDate: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Exchange Rates</h2>

      {/* Add Rate Form */}
      <div className="bg-white p-6 rounded-lg border space-y-4">
        <h3 className="font-semibold">Add Exchange Rate</h3>
        
        <div className="grid grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="FROM (e.g., USD)"
            maxLength={3}
            value={formData.fromCurrency}
            onChange={e => setFormData({...formData, fromCurrency: e.target.value.toUpperCase()})}
            className="px-4 py-2 border rounded-lg"
          />
          
          <input
            type="text"
            placeholder="TO (e.g., PHP)"
            maxLength={3}
            value={formData.toCurrency}
            onChange={e => setFormData({...formData, toCurrency: e.target.value.toUpperCase()})}
            className="px-4 py-2 border rounded-lg"
          />
          
          <input
            type="number"
            step="0.00000001"
            placeholder="Rate"
            value={formData.rate}
            onChange={e => setFormData({...formData, rate: parseFloat(e.target.value)})}
            className="px-4 py-2 border rounded-lg"
          />
          
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={e => setFormData({...formData, effectiveDate: e.target.value})}
            className="px-4 py-2 border rounded-lg"
          />
        </div>

        <button
          onClick={handleAddRate}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Add Rate
        </button>
      </div>

      {/* Rates Table */}
      <div className="bg-white p-6 rounded-lg border overflow-x-auto">
        <h3 className="font-semibold mb-4">Exchange Rates</h3>
        
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4">From</th>
              <th className="text-left py-2 px-4">To</th>
              <th className="text-right py-2 px-4">Rate</th>
              <th className="text-left py-2 px-4">Effective Date</th>
              <th className="text-center py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exchangeRates.map(rate => (
              <tr key={rate.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-4 font-mono">{rate.fromCurrency}</td>
                <td className="py-2 px-4 font-mono">{rate.toCurrency}</td>
                <td className="py-2 px-4 font-mono text-right">{rate.rate.toFixed(8)}</td>
                <td className="py-2 px-4">{rate.effectiveDate}</td>
                <td className="py-2 px-4 text-center">
                  <button
                    onClick={() => onDelete(rate.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 6.2 Add to App.tsx Sidebar

In App.tsx, add menu item:
```typescript
{activeTab === 'settings' && (
  <>
    <button 
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-indigo-50"
      onClick={() => setActiveTab('exchangeRates')}
    >
      <DollarSign size={20} /> Exchange Rates
    </button>
  </>
)}
```

### 6.3 Add to Main View Selector

In App.tsx render section:
```typescript
{activeTab === 'exchangeRates' && (
  <ExchangeRatesView 
    exchangeRates={exchangeRates}
    onAdd={handleAddExchangeRate}
    onUpdate={handleUpdateExchangeRate}
    onDelete={handleDeleteExchangeRate}
  />
)}
```

---

## Troubleshooting

### Issue: "Table 'exchange_rates' doesn't exist"
**Solution:**
- Verify SQL migration ran successfully in Supabase
- Check Supabase project is correct
- Re-run migration if needed

### Issue: "Column 'from_currency' not recognized"
**Solution:**
- Check column names in SQL (snake_case: from_currency, not fromCurrency)
- Verify dataService.camelToSnake() is converting correctly

### Issue: RLS policy blocking inserts
**Solution:**
- Ensure user.org_id is set in users table
- Verify auth.uid() returns correct user ID
- Check RLS policy references correct user/org fields

### Issue: Rates not appearing in getExchangeRatesByOrg()
**Solution:**
- Check is_deleted = false (soft delete filtering)
- Verify org_id matches query parameter
- Confirm rates were actually inserted

### Issue: "Cannot find ExchangeRateService"
**Solution:**
- Verify file exists: `services/ExchangeRateService.ts`
- Check TypeScript compilation: `npm run build`
- Verify import path is correct

---

## Post-Deployment Validation

### Checklist

- [ ] Database migration completed successfully
- [ ] All 4 RLS policies active
- [ ] All 4 indexes created
- [ ] TypeScript compilation successful
- [ ] No console errors in browser
- [ ] ExchangeRateService methods work
- [ ] Sample rates inserted
- [ ] Data service CRUD operations work
- [ ] Rates queryable by organization
- [ ] Soft delete works (is_deleted flag)
- [ ] Audit logs created for rate changes
- [ ] Production deployment tested
- [ ] Documentation reviewed and archived

---

## Next Steps

1. **Monitor Production**
   - Check error logs in Supabase
   - Monitor rate query performance
   - Track audit trail for changes

2. **Implement UI** (Optional)
   - Create ExchangeRatesView component
   - Add to admin/settings section
   - Link to period closing for revaluations

3. **Integrate with Transactions**
   - Link rates to payables
   - Link rates to receivables
   - Enable multi-currency posting

4. **Automation** (Future)
   - Schedule external API rate pulls
   - Auto-generate period-end revaluations
   - Alert on rate changes >1%

---

## Support

For issues or questions:
1. Review `FOREIGN_CURRENCY_IMPLEMENTATION.md`
2. Check SQL in `EXCHANGE_RATES_TABLE.sql`
3. Review service code in `ExchangeRateService.ts`
4. Check browser console for JavaScript errors
5. Verify Supabase RLS policies and database logs

---

## Summary

✅ **Deployment Complete Checklist:**
- [x] Database migration created
- [x] Service layer implemented
- [x] Type definitions added
- [x] Data persistence complete
- [x] Documentation comprehensive
- [x] Ready for production

**Status: Ready to Deploy** ✅
