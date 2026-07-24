import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Pencil, Plus, ReceiptText, Save, Search, Trash2, X } from 'lucide-react';
import { ChartOfAccount, Payable, Qualification, TaxCategoryEntry, TimeExpense, User, Vendor } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';

interface Props {
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  qualifications?: Qualification[];
  taxCategories?: TaxCategoryEntry[];
  employees?: User[];
  currency: string;
  currentUserId?: string;
  onCreatePayable: (payable: Payable) => Payable | Promise<Payable>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const emptyForm = { rfqCode: '', transactionDate: new Date().toISOString().slice(0, 10), description: '', quantity: '1', unitCost: '', expenseAccountId: '', qualificationId: '', taxCategoryId: '', supplierName: '', employeeId: '' };
const normalizeGroupValue = (value: string) => value.trim().toLocaleLowerCase();
const calculateTaxAmount = (amount: number, category?: TaxCategoryEntry) => {
  const rate = Number(category?.rate || 0);
  if (!(amount > 0) || !(rate > 0)) return 0;
  const tax = category?.isInclusive
    ? amount * rate / (100 + rate)
    : amount * rate / 100;
  return Math.round(tax * 100) / 100;
};

const TimeExpensesView: React.FC<Props> = ({ orgId, payables, vendors, accounts, qualifications = [], taxCategories = [], employees = [], currency, currentUserId, onCreatePayable, onNotify }) => {
  const service = DataServiceFactory.getService();
  const claimableEmployees = useMemo(() => employees.filter(employee => employee.role !== 'STUDENT'), [employees]);
  const [rows, setRows] = useState<TimeExpense[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRow, setViewingRow] = useState<TimeExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TimeExpense['status']>('all');
  const openRows = useMemo(() => rows.filter(row => row.status === 'open'), [rows]);
  const selectedRows = useMemo(() => openRows.filter(row => selected.includes(row.id)), [openRows, selected]);
  const total = selectedRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const selectedClaimant = selectedRows[0]?.claimedBy;
  const selectedEmployeeId = selectedRows[0]?.employeeId;
  const expenseAccounts = useMemo(
    () => accounts.filter(account => !account.isHeader && account.class === 'EXPENSE'),
    [accounts]
  );
  const calculatedAmount = Math.round(Number(form.quantity) * Number(form.unitCost) * 100) / 100;
  const selectedTaxCategory = taxCategories.find(category => category.id === form.taxCategoryId);
  const calculatedTax = calculateTaxAmount(calculatedAmount, selectedTaxCategory);
  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return rows.filter(row => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSearch = !query || [
        row.rfqCode, row.transactionDate, row.description,
        row.supplierName || vendors.find(vendor => vendor.id === row.supplierId)?.name,
        row.claimedBy,
        expenseAccounts.find(account => account.id === row.expenseAccountId)?.name,
        taxCategories.find(category => category.id === row.taxCategoryId)?.code,
        taxCategories.find(category => category.id === row.taxCategoryId)?.description,
        qualifications.find(qualification => qualification.id === row.qualificationId)?.code,
        qualifications.find(qualification => qualification.id === row.qualificationId)?.name,
        row.status,
      ].some(value => String(value || '').toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [rows, searchTerm, statusFilter, expenseAccounts, taxCategories, qualifications, vendors]);
  const { currentPage, totalPages, pageStartIndex, pageEndIndex, paginatedRows, setCurrentPage } =
    usePaginatedRows(filteredRows, [searchTerm, statusFilter], 7);

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
      qualificationId: row.qualificationId || '',
      taxCategoryId: row.taxCategoryId || '',
      supplierName: row.supplierName || vendors.find(vendor => vendor.id === row.supplierId)?.name || '',
      employeeId: row.employeeId || employees.find(employee => employee.name === row.claimedBy)?.id || '',
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
      const employee = claimableEmployees.find(item => item.id === form.employeeId);
      if (!employee) {
        onNotify('error', 'Select an employee from this organization.');
        return;
      }
      const values = {
        ...form, orgId: expenseOrgId, quantity: Number(form.quantity), unitCost: Number(form.unitCost),
        amount: calculatedAmount, claimedBy: employee.name,
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
    const hasDifferentEmployee = selectedEmployeeId && row.employeeId
      ? selectedEmployeeId !== row.employeeId
      : normalizeGroupValue(selectedClaimant || '') !== normalizeGroupValue(row.claimedBy);
    if (selected.length && !selected.includes(row.id) && hasDifferentEmployee) {
      onNotify('info', 'One AP Bill can only combine expenses claimed by the same employee.');
      return;
    }
    setSelected(previous => previous.includes(row.id) ? previous.filter(id => id !== row.id) : [...previous, row.id]);
  };

  const consolidate = async () => {
    if (!selectedRows.length) return onNotify('info', 'Select at least one expense first.');
    if (!selectedEmployeeId) return onNotify('error', 'The selected expenses must have an employee claimant.');
    const apControlAccount = accounts.find(account =>
      !account.isHeader &&
      account.class === 'LIABILITY' &&
      (account.code?.startsWith('2100') || account.name.toLocaleLowerCase().includes('accounts payable'))
    );
    if (!apControlAccount) return onNotify('error', 'Configure an Accounts Payable control account before consolidating expenses.');
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
      const merchantNames = [...new Set(selectedRows.map(row => row.supplierName?.trim()).filter(Boolean))];
      const bill = await onCreatePayable({
        id: '', orgId, vendorId: undefined, payableNumber,
        category: 'employee_reimbursements', description: `Employee reimbursement for ${selectedClaimant}: ${selectedRows.map(row => row.rfqCode).join(', ')}`,
        amount: total, netPayable: total, paidAmount: 0, billDate: now.toISOString().slice(0, 10),
        dueDate: new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        currency, status: 'for_approval', referenceDocument: selectedRows.map(row => row.rfqCode).join(', '),
        expenseAllocations: selectedRows.map(row => ({
          expenseAccountId: row.expenseAccountId!,
          qualificationId: row.qualificationId,
          amount: Number(row.amount),
          description: `${row.rfqCode} — ${row.description}`,
          sourceExpenseId: row.id,
        })),
        claimedBy: [...new Set(selectedRows.map(row => row.claimedBy.trim()).filter(Boolean))].join(', '),
        employeeId: selectedRows[0].employeeId,
        glAccountId: apControlAccount.id,
        notes: `Reimburse ${selectedClaimant}. Merchants: ${merchantNames.join(', ') || 'Not specified'}`,
        createdBy: currentUserId, createdAt: now.toISOString()
      } as Payable);
      await service.postPayableBill(bill.id, currentUserId);
      const updates = await Promise.all(selectedRows.map(row => service.updateTimeExpense(row.id, { status: 'released', payableId: bill.id })));
      const updatedById = new Map(updates.map(row => [row.id, row]));
      setRows(previous => previous.map(row => updatedById.get(row.id) || row));
      setSelected([]);
      onNotify('success', `AP Bill ${bill.payableNumber} created successfully for reimbursement to ${selectedClaimant} — ${currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
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

  const openRowDetails = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    const tableRow = target.closest('tbody tr');
    if (!tableRow) return;
    const row = rows.find(item => item.id === tableRow.getAttribute('data-row-id'));
    if (row) setViewingRow(row);
  };

  if (showForm) {
    const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10';
    return <div className="animate-in fade-in slide-in-from-right-2 space-y-5 duration-200">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative border-b border-slate-100 bg-[linear-gradient(115deg,#f8fafc_50%,color-mix(in_srgb,var(--acm-primary)_10%,white))] px-6 py-5">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-brand"/>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/20"><Calculator size={21}/></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Time & Expenses</p><h2 className="text-xl font-semibold text-slate-900">{editingId ? 'Edit Cost Record' : 'New Cost Record'}</h2><p className="text-sm text-slate-500">{editingId ? 'Update this unbilled expense and its accounting class.' : 'Record the claimant, class, and supporting cost details.'}</p></div>
            </div>
            <button type="button" onClick={closeForm} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-light hover:text-brand"><ArrowLeft size={17}/> Back to Expenses</button>
          </div>
        </div>

        <form onSubmit={saveExpense} className="p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-slate-200 p-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-brand">Document details</p><p className="mt-1 text-sm text-slate-500">Reference and transaction information.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">RFQ Code<input required value={form.rfqCode} onChange={e => setForm({...form, rfqCode:e.target.value})} className={fieldClass}/></label>
                <label className="text-sm font-semibold text-slate-700">Transaction Date<input required type="date" value={form.transactionDate} onChange={e => setForm({...form, transactionDate:e.target.value})} className={fieldClass}/></label>
              </div>
              <label className="block text-sm font-semibold text-slate-700">Description<textarea required value={form.description} onChange={e => setForm({...form, description:e.target.value})} className={fieldClass} rows={4}/></label>
              <label className="block text-sm font-semibold text-slate-700">Supplier<input required value={form.supplierName} onChange={e => setForm({...form, supplierName:e.target.value})} placeholder="Supplier or merchant name" className={fieldClass}/></label>
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 p-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-brand">Claim & classification</p><p className="mt-1 text-sm text-slate-500">Assign the employee and the same class structure used by AP Bills.</p></div>
              <label className="block text-sm font-semibold text-slate-700">Claimed By<select required value={form.employeeId} onChange={e => setForm({...form, employeeId:e.target.value})} className={fieldClass}><option value="">Select employee</option>{claimableEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} — {employee.role === 'ADMIN' ? 'Tenant Admin' : employee.role.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Class<select required value={form.qualificationId} onChange={e => setForm({...form, qualificationId:e.target.value})} className={fieldClass}><option value="">Select Class...</option>{qualifications.map(qualification => <option key={qualification.id} value={qualification.id}>{qualification.code} - {qualification.name}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Supplier Tax Category<select required value={form.taxCategoryId} onChange={e => setForm({...form, taxCategoryId:e.target.value})} className={fieldClass}><option value="">Select tax category...</option>{taxCategories.map(category => <option key={category.id} value={category.id}>{category.code} - {category.description} ({Number(category.rate).toLocaleString()}%)</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700">Expense Account<select required value={form.expenseAccountId} onChange={e => setForm({...form, expenseAccountId:e.target.value})} className={fieldClass}><option value="">Select expense account</option>{expenseAccounts.map(account => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
            </section>
          </div>

          <section className="mt-5 rounded-xl border border-brand-light bg-brand/5 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold text-slate-700">Quantity<input required min="0.01" step="0.01" type="number" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})} className={fieldClass}/></label>
              <label className="text-sm font-semibold text-slate-700">Unit Cost<input required min="0.01" step="0.01" type="number" value={form.unitCost} onChange={e => setForm({...form, unitCost:e.target.value})} className={fieldClass}/></label>
              <label className="text-sm font-semibold text-slate-700">Calculated Amount<input readOnly value={calculatedAmount ? `${currency} ${calculatedAmount.toFixed(2)}` : ''} className={`${fieldClass} bg-white font-mono text-base font-bold text-brand`} aria-label="Calculated amount"/></label>
              <label className="text-sm font-semibold text-slate-700">Tax {selectedTaxCategory ? `(${Number(selectedTaxCategory.rate).toLocaleString()}%)` : ''}<input readOnly value={form.taxCategoryId ? `${currency} ${calculatedTax.toFixed(2)}` : ''} className={`${fieldClass} bg-white font-mono text-base font-bold text-brand`} aria-label="Calculated tax"/><span className="mt-1 block text-xs font-normal text-slate-500">{selectedTaxCategory?.isInclusive ? 'Tax included in the expense amount.' : selectedTaxCategory ? 'Tax calculated on top of the expense amount.' : 'Select a tax category.'}</span></label>
            </div>
          </section>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-hover disabled:opacity-50"><Save size={17}/>{editingId ? 'Update Expense' : 'Save Expense'}</button>
          </div>
        </form>
      </div>
    </div>;
  }

  return <div className="space-y-8">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Time & Expenses</h2>
        <p className="text-sm text-gray-500 font-normal">Capture reimbursable costs and consolidate them into supplier bills.</p>
      </div>
      <button onClick={openCreateForm} className="flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"><Plus size={17}/> New Expense</button>
    </div>

    {selectedRows.length > 0 && <div className="flex flex-col gap-4 rounded-xl border border-brand-light bg-brand/5 p-4 lg:flex-row lg:items-center">
      <div className="min-w-48"><p className="text-xs font-bold uppercase tracking-wider text-brand">Selected for billing</p><p className="text-xl font-bold text-slate-900">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
      <p className="flex-1 text-sm text-slate-600"><span className="font-semibold text-slate-900">{selectedClaimant}</span> · {selectedRows.length} expense record{selectedRows.length === 1 ? '' : 's'} will be consolidated regardless of supplier, with individual account tags preserved.</p>
      <button disabled={saving} onClick={consolidate} className="flex items-center justify-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-hover disabled:opacity-50"><ReceiptText size={17}/> Approve</button>
    </div>}

    <div onClick={openRowDetails} className="[&_tbody_tr]:cursor-pointer">
    <div className="overflow-hidden rounded-xl border border-brand-light bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/>
          <input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search RFQ, description, supplier, claimant or account..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand"/>
        </label>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="released">Released</option>
          <option value="billed">Billed</option>
        </select>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-brand text-xs uppercase tracking-wider text-white"><tr><th className="p-4"></th><th className="p-4">RFQ Code</th><th className="p-4">Transaction Date</th><th className="p-4">Description</th><th className="p-4">Supplier</th><th className="p-4">Tax Category</th><th className="p-4 text-right">Tax</th><th className="p-4">Claimed By</th><th className="p-4">Expense Account</th><th className="p-4 text-right">Amount</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{paginatedRows.map(row => { const taxCategory = taxCategories.find(category => category.id === row.taxCategoryId); const taxAmount = calculateTaxAmount(Number(row.amount), taxCategory); const isOpen = row.status === 'open'; const isBilled = row.status === 'billed'; const isSelected = isOpen && selected.includes(row.id); return <tr key={row.id} data-row-id={row.id} className={isSelected ? 'bg-brand/5' : isOpen ? 'hover:bg-brand/5' : isBilled ? 'bg-blue-50/30' : 'bg-emerald-50/30'}><td className="p-4"><input type="checkbox" disabled={!isOpen} checked={isSelected} onChange={() => toggle(row)} className="h-4 w-4 rounded border-slate-300 accent-[var(--brand)] disabled:opacity-40"/></td><td className="p-4 font-semibold text-brand">{row.rfqCode}</td><td className="p-4 text-slate-600">{row.transactionDate}</td><td className="p-4 text-slate-800">{row.description}</td><td className="p-4">{row.supplierName || vendors.find(v => v.id === row.supplierId)?.name || '—'}</td><td className="p-4"><span className="inline-flex rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">{taxCategory ? `${taxCategory.code} · ${Number(taxCategory.rate).toLocaleString()}%` : '—'}</span></td><td className="p-4 text-right font-mono text-slate-700">{taxCategory ? `${currency} ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td><td className="p-4 text-slate-600">{row.claimedBy}</td><td className="p-4 text-slate-600">{expenseAccounts.find(account => account.id === row.expenseAccountId)?.name || '—'}</td><td className="p-4 text-right font-mono font-semibold">{currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isOpen ? 'bg-amber-50 text-amber-700' : isBilled ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{isOpen ? 'Open' : isBilled ? 'Billed' : 'Released'}</span></td><td className="p-4">{isOpen && <div className="flex items-center gap-3"><button onClick={() => openEditForm(row)} className="text-slate-400 hover:text-brand" aria-label={`Edit expense ${row.rfqCode}`}><Pencil size={16}/></button><button onClick={() => remove(row)} className="text-slate-400 hover:text-rose-600" aria-label={`Delete expense ${row.rfqCode}`}><Trash2 size={16}/></button></div>}</td></tr>; })}</tbody></table>{!filteredRows.length && <div className="p-12 text-center text-sm text-slate-500">{rows.length ? 'No expense records match the current filters.' : 'No expense records.'}</div>}</div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={filteredRows.length} pageStartIndex={pageStartIndex} pageEndIndex={pageEndIndex} onPageChange={setCurrentPage} itemLabel="expenses"/>
    </div>
    </div>

    {viewingRow && <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setViewingRow(null)}>
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-light bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="relative flex items-start justify-between border-b border-brand-light bg-[linear-gradient(115deg,#fff_50%,color-mix(in_srgb,var(--acm-primary)_10%,white))] px-6 py-5">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-brand"/>
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Expense details</p><h3 className="mt-1 text-xl font-semibold text-slate-900">{viewingRow.rfqCode}</h3><p className="mt-1 text-sm text-slate-500">{viewingRow.transactionDate}</p></div>
            <button onClick={() => setViewingRow(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-brand/10 hover:text-brand" aria-label="Close expense details"><X size={19}/></button>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p><p className="mt-1 text-sm leading-6 text-slate-800">{viewingRow.description}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier</p><p className="mt-1 text-sm font-semibold text-slate-800">{viewingRow.supplierName || vendors.find(vendor => vendor.id === viewingRow.supplierId)?.name || '—'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Claimed By</p><p className="mt-1 text-sm font-semibold text-slate-800">{viewingRow.claimedBy}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Class</p><p className="mt-1 text-sm text-slate-700">{qualifications.find(item => item.id === viewingRow.qualificationId)?.name || '—'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Expense Account</p><p className="mt-1 text-sm text-slate-700">{expenseAccounts.find(account => account.id === viewingRow.expenseAccountId)?.name || '—'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tax Category</p><p className="mt-1 text-sm text-slate-700">{taxCategories.find(item => item.id === viewingRow.taxCategoryId)?.description || '—'}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Quantity × Unit Cost</p><p className="mt-1 font-mono text-sm text-slate-700">{Number(viewingRow.quantity).toLocaleString()} × {currency} {Number(viewingRow.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
          </div>
          <div className="flex items-center justify-between border-t border-brand-light bg-brand/5 px-6 py-4">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${viewingRow.status === 'open' ? 'bg-amber-50 text-amber-700' : viewingRow.status === 'billed' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{viewingRow.status === 'open' ? 'Open' : viewingRow.status === 'billed' ? 'Billed' : 'Released'}</span>
            <div className="text-right"><p className="text-xs font-bold uppercase tracking-wider text-brand">Expense Amount</p><p className="font-mono text-xl font-bold text-slate-900">{currency} {Number(viewingRow.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
          </div>
        </div>
      </div>
    </ModalPortal>}

  </div>;
};

export default TimeExpensesView;
