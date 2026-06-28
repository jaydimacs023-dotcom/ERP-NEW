import React, { useState } from 'react';
import { Boxes, Check, Edit2, Plus, X } from 'lucide-react';
import { ChartOfAccount, InventoryClass, Organization, WarehouseLocation } from '../types';

interface Props {
  classes: InventoryClass[];
  accounts: ChartOfAccount[];
  warehouses: WarehouseLocation[];
  organization?: Organization;
  onSave: (value: Partial<InventoryClass>) => Promise<void>;
}

const emptyClass: Partial<InventoryClass> = {
  code: '',
  name: '',
  valuationMethod: 'WEIGHTED_AVERAGE',
  isActive: true,
};

export default function InventoryClassesView({ classes, accounts, warehouses, organization, onSave }: Props) {
  const brandColor = organization?.primaryColor || '#F47721';
  const [editing, setEditing] = useState<Partial<InventoryClass> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeAccounts = accounts.filter(account => account.isActive && !account.isHeader);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await onSave(editing);
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save inventory class');
    } finally {
      setSaving(false);
    }
  };

  const accountField = (label: string, key: keyof InventoryClass, required = false) => (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}{required ? ' *' : ''}</span>
      <select
        required={required}
        value={String(editing?.[key] || '')}
        onChange={event => setEditing(current => ({ ...current, [key]: event.target.value }))}
        className="w-full h-11 px-3 rounded border border-gray-200 bg-white text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
      >
        <option value="">Select account...</option>
        {activeAccounts.map(account => (
          <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Inventory Classes</h2>
          <p className="text-sm text-gray-500">Centralized valuation and General Ledger mappings.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(emptyClass)} className="flex items-center gap-2 px-5 py-3 text-white rounded text-xs font-semibold uppercase shadow-sm transition-opacity hover:opacity-90" style={{ backgroundColor: brandColor }}>
            <Plus size={16} /> New Class
          </button>
        )}
      </header>

      {editing && (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 text-white flex items-center justify-between" style={{ backgroundColor: brandColor }}>
            <div className="flex items-center gap-3"><Boxes size={20} /><span className="font-semibold">{editing.id ? 'Edit' : 'Create'} Inventory Class</span></div>
            <button type="button" onClick={() => setEditing(null)}><X size={20} /></button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-gray-500">Code *</span>
              <input required value={editing.code || ''} onChange={event => setEditing({ ...editing, code: event.target.value.toUpperCase() })} className="w-full h-11 px-3 rounded border outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase text-gray-500">Name *</span>
              <input required value={editing.name || ''} onChange={event => setEditing({ ...editing, name: event.target.value })} className="w-full h-11 px-3 rounded border outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
            </label>
            {accountField('Inventory Asset', 'inventoryAssetAccountId', true)}
            {accountField('Cost of Goods Sold', 'cogsAccountId', true)}
            {accountField('Inventory Adjustment', 'adjustmentAccountId', true)}
            {accountField('Write-Off Expense', 'writeOffAccountId')}
            {accountField('Opening Balance Equity', 'openingBalanceEquityAccountId')}
            {accountField('Purchase Price Variance', 'purchasePriceVarianceAccountId')}
            {accountField('Inventory In Transit', 'inTransitAccountId')}
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-gray-500">Default Warehouse</span>
              <select value={editing.defaultWarehouseId || ''} onChange={event => setEditing({ ...editing, defaultWarehouseId: event.target.value })} className="w-full h-11 px-3 rounded border outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
                <option value="">None</option>
                {warehouses.filter(w => w.isActive && !w.isDeleted).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-gray-500">Valuation Method</span>
              <select value={editing.valuationMethod} onChange={event => setEditing({ ...editing, valuationMethod: event.target.value as InventoryClass['valuationMethod'] })} className="w-full h-11 px-3 rounded border outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
                <option value="WEIGHTED_AVERAGE">Moving Average</option>
                <option value="STANDARD_COST">Standard Cost</option>
              </select>
            </label>
          </div>
          {error && <p className="px-6 pb-3 text-sm text-red-600">{error}</p>}
          <div className="px-6 py-4 border-t flex justify-end">
            <button disabled={saving} className="px-6 py-3 text-white rounded text-xs font-semibold uppercase shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: brandColor }}>
              {saving ? 'Saving…' : 'Save Class'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="text-white" style={{ backgroundColor: brandColor }}><tr><th className="px-4 py-3 text-left">Class</th><th className="px-4 py-3 text-left">Valuation</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y">
            {classes.map(value => (
              <tr key={value.id}>
                <td className="px-4 py-3"><p className="font-semibold">{value.code}</p><p className="text-xs text-gray-500">{value.name}</p></td>
                <td className="px-4 py-3 text-sm">{value.valuationMethod.replace('_', ' ')}</td>
                <td className="px-4 py-3">{value.isActive ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold"><Check size={13}/> Active</span> : 'Inactive'}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => setEditing(value)} className="p-2 transition-opacity hover:opacity-70" style={{ color: brandColor }}><Edit2 size={16}/></button></td>
              </tr>
            ))}
            {!classes.length && <tr><td colSpan={4} className="p-10 text-center text-gray-500">Create an inventory class before assigning stock items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
