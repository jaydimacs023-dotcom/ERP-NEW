import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { ChartOfAccount, Payable, TimeExpense, Vendor } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';

interface Props {
  orgId: string;
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  currency: string;
  currentUserId?: string;
  onCreatePayable: (payable: Payable) => Payable | Promise<Payable>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const emptyForm = { rfqCode: '', transactionDate: new Date().toISOString().slice(0, 10), description: '', amount: '', supplierId: '', claimedBy: '' };

const TimeExpensesView: React.FC<Props> = ({ orgId, vendors, accounts, currency, currentUserId, onCreatePayable, onNotify }) => {
  const service = DataServiceFactory.getService();
  const [rows, setRows] = useState<TimeExpense[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const openRows = useMemo(() => rows.filter(row => row.status === 'open'), [rows]);
  const selectedRows = useMemo(() => openRows.filter(row => selected.includes(row.id)), [openRows, selected]);
  const total = selectedRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const selectedSupplier = selectedRows[0]?.supplierId;
  const expenseAccounts = accounts.filter(account => !account.isHeader && account.class === 'EXPENSE');

  useEffect(() => {
    service.getTimeExpensesByOrg(orgId).then(setRows).catch(() => onNotify('error', 'Unable to load time and expense records.'));
  }, [orgId]);

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await service.createTimeExpense({
        ...form, id: '', orgId, amount: Number(form.amount), status: 'open', createdBy: currentUserId,
        createdAt: new Date().toISOString()
      } as TimeExpense);
      setRows(previous => [saved, ...previous]);
      setForm(emptyForm);
      setShowForm(false);
      onNotify('success', 'Expense record created.');
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Unable to create expense record.');
    } finally { setSaving(false); }
  };

  const toggle = (row: TimeExpense) => {
    if (selected.length && selectedSupplier !== row.supplierId && !selected.includes(row.id)) {
      onNotify('info', 'Only expenses from the same supplier can be consolidated into one AP Bill.');
      return;
    }
    setSelected(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id]);
  };

  const consolidate = async () => {
    if (!selectedRows.length || !expenseAccountId) return onNotify('info', 'Select expenses and an expense account first.');
    const vendor = vendors.find(item => item.id === selectedSupplier);
    if (!vendor) return onNotify('error', 'The selected supplier is unavailable.');
    setSaving(true);
    try {
      const now = new Date();
      const bill = await onCreatePayable({
        id: '', orgId, vendorId: vendor.id, payableNumber: `TE-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
        category: 'general', description: `Consolidated expenses: ${selectedRows.map(row => row.rfqCode).join(', ')}`,
        amount: total, netPayable: total, paidAmount: 0, billDate: now.toISOString().slice(0, 10),
        dueDate: new Date(now.getTime() + (vendor.paymentTermsDays || 30) * 86400000).toISOString().slice(0, 10),
        currency, status: 'for_approval', referenceDocument: selectedRows.map(row => row.rfqCode).join(', '),
        expenseAccountId, glAccountId: vendor.apAccountId, notes: `Claimed by: ${[...new Set(selectedRows.map(row => row.claimedBy))].join(', ')}`,
        createdBy: currentUserId, createdAt: now.toISOString()
      } as Payable);
      const updates = await Promise.all(selectedRows.map(row => service.updateTimeExpense(row.id, { status: 'billed', payableId: bill.id })));
      const updatedById = new Map(updates.map(row => [row.id, row]));
      setRows(previous => previous.map(row => updatedById.get(row.id) || row));
      setSelected([]);
      setExpenseAccountId('');
      onNotify('success', `Created AP Bill ${bill.payableNumber} for ${currency} ${total.toLocaleString()}.`);
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Unable to consolidate expenses.');
    } finally { setSaving(false); }
  };

  const remove = async (row: TimeExpense) => {
    if (row.status !== 'open') return;
    await service.deleteTimeExpense(row.id);
    setRows(previous => previous.filter(item => item.id !== row.id));
    setSelected(previous => previous.filter(id => id !== row.id));
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Accounts Payable</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Time & Expenses</h2><p className="mt-1 text-sm text-slate-500">Capture reimbursable costs and consolidate them into supplier bills.</p></div>
      <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={17}/> New Expense</button>
    </div>

    {selectedRows.length > 0 && <div className="flex flex-col gap-4 rounded-xl border border-brand-light bg-brand/5 p-4 lg:flex-row lg:items-center">
      <div className="min-w-48"><p className="text-xs font-bold uppercase tracking-wider text-brand">Selected for billing</p><p className="text-xl font-bold text-slate-900">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
      <select value={expenseAccountId} onChange={event => setExpenseAccountId(event.target.value)} className="min-w-64 rounded border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Select expense account</option>{expenseAccounts.map(account => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select>
      <button disabled={saving || !expenseAccountId} onClick={consolidate} className="flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ReceiptText size={17}/> Create AP Bill</button>
    </div>}

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4"></th><th className="p-4">RFQ Code</th><th className="p-4">Transaction Date</th><th className="p-4">Description</th><th className="p-4">Supplier</th><th className="p-4">Claimed By</th><th className="p-4 text-right">Amount</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="p-4"><input type="checkbox" disabled={row.status === 'billed'} checked={selected.includes(row.id)} onChange={() => toggle(row)}/></td><td className="p-4 font-semibold text-brand">{row.rfqCode}</td><td className="p-4 text-slate-600">{row.transactionDate}</td><td className="p-4 text-slate-800">{row.description}</td><td className="p-4">{vendors.find(v => v.id === row.supplierId)?.name || '—'}</td><td className="p-4">{row.claimedBy}</td><td className="p-4 text-right font-mono font-semibold">{currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'billed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.status === 'billed' ? 'Billed' : 'Open'}</span></td><td className="p-4"><button disabled={row.status === 'billed'} onClick={() => remove(row)} className="text-slate-400 hover:text-rose-600 disabled:opacity-20"><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!rows.length && <div className="p-12 text-center text-sm text-slate-500">No expense records yet.</div>}</div></div>

    {showForm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={saveExpense} className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-semibold">New Cost Record</h3><p className="text-sm text-slate-500">Record the supporting RFQ and claimant.</p></div><button type="button" onClick={() => setShowForm(false)}><X size={20}/></button></div><div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">RFQ Code<input required value={form.rfqCode} onChange={e => setForm({...form, rfqCode:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Transaction Date<input required type="date" value={form.transactionDate} onChange={e => setForm({...form, transactionDate:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium md:col-span-2">Description<textarea required value={form.description} onChange={e => setForm({...form, description:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" rows={3}/></label>
      <label className="text-sm font-medium">Amount<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={e => setForm({...form, amount:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Supplier<select required value={form.supplierId} onChange={e => setForm({...form, supplierId:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"><option value="">Select supplier</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label className="text-sm font-medium md:col-span-2">Claimed By<input required value={form.claimedBy} onChange={e => setForm({...form, claimedBy:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" placeholder="Name of person claiming the expense"/></label>
    </div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Expense</button></div></form></div>}
  </div>;
};

export default TimeExpensesView;
