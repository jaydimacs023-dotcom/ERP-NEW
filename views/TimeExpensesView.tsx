import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { ChartOfAccount, Payable, TimeExpense, Vendor } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import ModalPortal from '../components/ModalPortal';

interface Props {
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  currency: string;
  currentUserId?: string;
  onCreatePayable: (payable: Payable) => Payable | Promise<Payable>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const emptyForm = { rfqCode: '', transactionDate: new Date().toISOString().slice(0, 10), description: '', quantity: '1', unitCost: '', expenseAccountId: '', supplierName: '', claimedBy: '' };
const normalizeGroupValue = (value: string) => value.trim().toLocaleLowerCase();

const TimeExpensesView: React.FC<Props> = ({ orgId, payables, vendors, accounts, currency, currentUserId, onCreatePayable, onNotify }) => {
  const service = DataServiceFactory.getService();
  const [rows, setRows] = useState<TimeExpense[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const openRows = useMemo(() => rows.filter(row => row.status === 'open'), [rows]);
  const selectedRows = useMemo(() => openRows.filter(row => selected.includes(row.id)), [openRows, selected]);
  const total = selectedRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const selectedSupplier = selectedRows[0]?.supplierName;
  const selectedClaimant = selectedRows[0]?.claimedBy;
  const expenseAccounts = accounts.filter(account => !account.isHeader && account.class === 'EXPENSE');
  const calculatedAmount = Math.round(Number(form.quantity) * Number(form.unitCost) * 100) / 100;

  useEffect(() => {
    service.getTimeExpensesByOrg(orgId).then(setRows).catch(() => onNotify('error', 'Unable to load time and expense records.'));
  }, [orgId]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (row: TimeExpense) => {
    if (row.status !== 'open') return;
    setEditingId(row.id);
    setForm({
      rfqCode: row.rfqCode,
      transactionDate: row.transactionDate,
      description: row.description,
      quantity: String(row.quantity),
      unitCost: String(row.unitCost),
      expenseAccountId: row.expenseAccountId || '',
      supplierName: row.supplierName || vendors.find(vendor => vendor.id === row.supplierId)?.name || '',
      claimedBy: row.claimedBy,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const expenseOrgId = orgId;

    if (!expenseOrgId) {
      onNotify('error', 'Select an organization before creating an expense.');
      return;
    }

    setSaving(true);
    try {
      const values = {
        ...form, orgId: expenseOrgId, quantity: Number(form.quantity), unitCost: Number(form.unitCost),
        amount: calculatedAmount,
      };
      if (editingId) {
        const updated = await service.updateTimeExpense(editingId, values);
        setRows(previous => previous.map(row => row.id === editingId ? updated : row));
        onNotify('success', 'Expense record updated successfully.');
      } else {
        const saved = await service.createTimeExpense({
          ...values, id: '', status: 'open', createdBy: currentUserId,
          createdAt: new Date().toISOString()
        } as TimeExpense);
        setRows(previous => [saved, ...previous]);
        onNotify('success', 'Expense record created.');
      }
      closeForm();
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Unable to create expense record.');
    } finally { setSaving(false); }
  };

  const toggle = (row: TimeExpense) => {
    if (selected.length && !selected.includes(row.id) && normalizeGroupValue(selectedClaimant || '') !== normalizeGroupValue(row.claimedBy)) {
      onNotify('info', 'One AP Bill can only combine expenses claimed by the same employee.');
      return;
    }
    setSelected(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id]);
  };

  const consolidate = async () => {
    if (!selectedRows.length) return onNotify('info', 'Select at least one expense first.');
    const vendor = vendors.find(item => normalizeGroupValue(item.name) === normalizeGroupValue(selectedSupplier || ''));
    if (!vendor) return onNotify('error', `No vendor record matches supplier "${selectedSupplier}". Add the supplier to Vendors before creating the AP Bill.`);
    setSaving(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const matcher = new RegExp(`^BILL-${year}-(\\d+)$`, 'i');
      const highestSequence = payables
        .filter(payable => payable.orgId === orgId)
        .reduce((highest, payable) => {
          const match = payable.payableNumber?.match(matcher);
          return match ? Math.max(highest, Number(match[1])) : highest;
        }, 0);
      const payableNumber = `BILL-${year}-${String(highestSequence + 1).padStart(5, '0')}`;
      const bill = await onCreatePayable({
        id: '', orgId, vendorId: vendor.id, payableNumber,
        category: 'other', description: `Consolidated expenses: ${selectedRows.map(row => row.rfqCode).join(', ')}`,
        amount: total, netPayable: total, paidAmount: 0, billDate: now.toISOString().slice(0, 10),
        dueDate: new Date(now.getTime() + (vendor.paymentTermsDays || 30) * 86400000).toISOString().slice(0, 10),
        currency, status: 'for_approval', referenceDocument: selectedRows.map(row => row.rfqCode).join(', '),
        expenseAllocations: selectedRows.map(row => ({
          expenseAccountId: row.expenseAccountId!,
          amount: Number(row.amount),
          description: `${row.rfqCode} — ${row.description}`,
          sourceExpenseId: row.id,
        })),
        claimedBy: [...new Set(selectedRows.map(row => row.claimedBy.trim()).filter(Boolean))].join(', '),
        glAccountId: vendor.apAccountId, notes: `Reimburse: ${[...new Set(selectedRows.map(row => row.claimedBy))].join(', ')}`,
        createdBy: currentUserId, createdAt: now.toISOString()
      } as Payable);
      const updates = await Promise.all(selectedRows.map(row => service.updateTimeExpense(row.id, { status: 'billed', payableId: bill.id })));
      const updatedById = new Map(updates.map(row => [row.id, row]));
      setRows(previous => previous.map(row => updatedById.get(row.id) || row));
      setSelected([]);
      onNotify('success', `AP Bill ${bill.payableNumber} created successfully for ${vendor.name} — ${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
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
      <button onClick={openCreateForm} className="flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={17}/> New Expense</button>
    </div>

    {selectedRows.length > 0 && <div className="flex flex-col gap-4 rounded-xl border border-brand-light bg-brand/5 p-4 lg:flex-row lg:items-center">
      <div className="min-w-48"><p className="text-xs font-bold uppercase tracking-wider text-brand">Selected for billing</p><p className="text-xl font-bold text-slate-900">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
      <p className="flex-1 text-sm text-slate-600"><span className="font-semibold text-slate-900">{selectedClaimant}</span> · {selectedRows.length} expense record{selectedRows.length === 1 ? '' : 's'} will be consolidated regardless of supplier, with individual account tags preserved.</p>
      <button disabled={saving} onClick={consolidate} className="flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><ReceiptText size={17}/> Create AP Bill</button>
    </div>}

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4"></th><th className="p-4">RFQ Code</th><th className="p-4">Transaction Date</th><th className="p-4">Description</th><th className="p-4">Supplier</th><th className="p-4">Claimed By</th><th className="p-4">Expense Account</th><th className="p-4 text-right">Amount</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{openRows.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="p-4"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row)}/></td><td className="p-4 font-semibold text-brand">{row.rfqCode}</td><td className="p-4 text-slate-600">{row.transactionDate}</td><td className="p-4 text-slate-800">{row.description}</td><td className="p-4">{row.supplierName || vendors.find(v => v.id === row.supplierId)?.name || '—'}</td><td className="p-4 text-slate-600">{row.claimedBy}</td><td className="p-4 text-slate-600">{expenseAccounts.find(account => account.id === row.expenseAccountId)?.name || '—'}</td><td className="p-4 text-right font-mono font-semibold">{currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="p-4"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Open</span></td><td className="p-4"><div className="flex items-center gap-3"><button onClick={() => openEditForm(row)} className="text-slate-400 hover:text-brand" aria-label={`Edit expense ${row.rfqCode}`}><Pencil size={16}/></button><button onClick={() => remove(row)} className="text-slate-400 hover:text-rose-600" aria-label={`Delete expense ${row.rfqCode}`}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!openRows.length && <div className="p-12 text-center text-sm text-slate-500">No unbilled expense records.</div>}</div></div>

    {showForm && <ModalPortal><div className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"><form onSubmit={saveExpense} className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-semibold">{editingId ? 'Edit Cost Record' : 'New Cost Record'}</h3><p className="text-sm text-slate-500">{editingId ? 'Update this unbilled expense record.' : 'Record the supporting RFQ and expense details.'}</p></div><button type="button" onClick={closeForm}><X size={20}/></button></div><div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">RFQ Code<input required value={form.rfqCode} onChange={e => setForm({...form, rfqCode:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Transaction Date<input required type="date" value={form.transactionDate} onChange={e => setForm({...form, transactionDate:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium md:col-span-2">Description<textarea required value={form.description} onChange={e => setForm({...form, description:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" rows={3}/></label>
      <label className="text-sm font-medium">Quantity<input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Unit Cost<input required min="0.01" step="0.01" type="number" value={form.unitCost} onChange={e => setForm({...form, unitCost:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Amount<input readOnly value={calculatedAmount ? calculatedAmount.toFixed(2) : ''} className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-700" aria-label="Calculated amount"/></label>
      <label className="text-sm font-medium">Supplier<input required value={form.supplierName} onChange={e => setForm({...form, supplierName:e.target.value})} placeholder="Supplier or merchant name" className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/></label>
      <label className="text-sm font-medium">Claimed By<input required value={form.claimedBy} onChange={e => setForm({...form, claimedBy:e.target.value})} placeholder="e.g. Ranil D. Melgo" className="mt-1 w-full rounded border border-slate-300 px-3 py-2"/><span className="mt-1 block text-xs font-normal text-slate-500">Employee who will be reimbursed.</span></label>
      <label className="text-sm font-medium md:col-span-2">Expense Account<select required value={form.expenseAccountId} onChange={e => setForm({...form, expenseAccountId:e.target.value})} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"><option value="">Select expense account</option>{expenseAccounts.map(account => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
    </div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editingId ? 'Update Expense' : 'Save Expense'}</button></div></form></div></ModalPortal>}
  </div>;
};

export default TimeExpensesView;
