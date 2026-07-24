import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building, Calendar, CheckCircle2, FilePenLine, LockKeyhole, Plus, RotateCcw, Search, Send, X, XCircle } from 'lucide-react';
import { APReclassification, APReclassificationStatus, ChartOfAccount, JournalEntry, JournalLine, Payable, Qualification, UserRole, Vendor } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { canPerformAction } from '../config/permissions';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';

interface Props {
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  qualifications: Qualification[];
  entries: JournalEntry[];
  lines: JournalLine[];
  currentUserId: string;
  currentUserRole?: UserRole | string;
  currency: string;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onJournalChanged?: () => void | Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = {
  payableId: '', reclassificationDate: today(), originalAccountId: '', targetAccountId: '',
  amount: '', reason: '', reference: '', departmentCode: '', costCenterCode: '', projectCode: '', branchCode: '',
};
const statusStyle: Record<APReclassificationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  POSTED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-rose-100 text-rose-700',
  REVERSED: 'bg-violet-100 text-violet-700',
};

const APReclassificationsView: React.FC<Props> = ({
  orgId, payables, vendors, accounts, qualifications, entries, lines, currentUserId, currentUserRole, currency, onNotify, onJournalChanged,
}) => {
  const service = DataServiceFactory.getService();
  const [records, setRecords] = useState<APReclassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | APReclassificationStatus>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<APReclassification | null>(null);
  const [viewing, setViewing] = useState<APReclassification | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canCreate = canPerformAction(currentUserRole, 'ap-reclassifications', 'create');
  const canEdit = canPerformAction(currentUserRole, 'ap-reclassifications', 'edit');
  const canApprove = canPerformAction(currentUserRole, 'ap-reclassifications', 'approve');
  const canPost = canPerformAction(currentUserRole, 'ap-reclassifications', 'post');
  const canVoid = canPerformAction(currentUserRole, 'ap-reclassifications', 'void');
  const classificationAccounts = useMemo(() => accounts.filter(account =>
    account.orgId === orgId && !account.isHeader && account.isActive !== false &&
    (account.class === 'EXPENSE' || account.class === 'ASSET')
  ), [accounts, orgId]);
  const eligibleBills = useMemo(() => payables.filter(bill =>
    bill.orgId === orgId && !bill.isDeleted && !!bill.journalEntryId &&
    ['approved', 'partially_paid', 'paid'].includes(bill.status)
  ), [payables, orgId]);
  const selectedBill = eligibleBills.find(bill => bill.id === form.payableId);
  const selectedEntry = entries.find(entry => entry.id === selectedBill?.journalEntryId);
  const billPartyName = (bill?: Payable) =>
    vendors.find(vendor => vendor.id === bill?.vendorId)?.name ||
    bill?.claimedBy ||
    (bill?.category === 'employee_reimbursements' ? 'Employee reimbursement' : 'No supplier assigned');
  const sourceAccounts = useMemo(() => {
    if (!selectedBill?.journalEntryId) return [];
    const totals = new Map<string, number>();
    lines.filter(line => line.journalEntryId === selectedBill.journalEntryId).forEach(line => {
      totals.set(line.accountId, (totals.get(line.accountId) || 0) + Math.max(Number(line.debit) - Number(line.credit), 0));
    });
    selectedBill.expenseAllocations?.forEach(allocation => {
      if (!totals.has(allocation.expenseAccountId)) {
        totals.set(allocation.expenseAccountId, Number(allocation.amount || 0));
      }
    });
    return classificationAccounts.filter(account => (totals.get(account.id) || 0) > 0.005)
      .map(account => {
        const allocation = selectedBill.expenseAllocations?.find(item => item.expenseAccountId === account.id);
        return {
          account,
          originalAmount: totals.get(account.id) || 0,
          qualificationId: allocation?.qualificationId || selectedBill.qualificationId,
          description: allocation?.description || selectedBill.description,
        };
      });
  }, [selectedBill, lines, classificationAccounts]);
  const selectedSource = sourceAccounts.find(item => item.account.id === form.originalAccountId);
  const alreadyReclassified = records.filter(record =>
    record.payableId === form.payableId && record.originalAccountId === form.originalAccountId && record.status === 'POSTED'
  ).reduce((sum, record) => sum + Number(record.amount), 0);
  const availableAmount = Math.max(0, Number(selectedSource?.originalAmount || 0) - alreadyReclassified);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try { setRecords(await service.getAPReclassificationsByOrg(orgId)); }
    catch (error) {
      setRecords([]);
      setLoadError(error instanceof Error ? error.message : 'The AP Reclassification backend is unavailable.');
    }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [orgId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter(record => {
      const bill = payables.find(item => item.id === record.payableId);
      const vendor = vendors.find(item => item.id === record.vendorId);
      const source = accounts.find(item => item.id === record.originalAccountId);
      const target = accounts.find(item => item.id === record.targetAccountId);
      return (filterStatus === 'ALL' || record.status === filterStatus) && (!query || [
        record.reclassificationNumber, record.reason, record.reference, bill?.payableNumber,
        vendor?.name, bill?.claimedBy, source?.code, source?.name, target?.code, target?.name,
      ].some(value => String(value || '').toLowerCase().includes(query)));
    });
  }, [records, search, filterStatus, payables, vendors, accounts]);
  const { currentPage, totalPages, pageStartIndex, pageEndIndex, paginatedRows, setCurrentPage } =
    usePaginatedRows(filtered, [search, filterStatus], 7);
  const hasActiveFilters = !!search.trim() || filterStatus !== 'ALL';

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, reclassificationDate: today() }); setShowForm(true); };
  const openEdit = (record: APReclassification) => {
    if (record.status !== 'DRAFT') return onNotify('error', 'Only draft reclassifications can be edited.');
    setEditing(record);
    setForm({
      payableId: record.payableId, reclassificationDate: record.reclassificationDate,
      originalAccountId: record.originalAccountId, targetAccountId: record.targetAccountId,
      amount: String(record.amount), reason: record.reason, reference: record.reference || '',
      departmentCode: record.departmentCode || '', costCenterCode: record.costCenterCode || '',
      projectCode: record.projectCode || '', branchCode: record.branchCode || '',
    });
    setViewing(null); setShowForm(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!selectedBill || !selectedSource) return onNotify('error', 'Select an approved bill and its original account.');
    if (form.originalAccountId === form.targetAccountId) return onNotify('error', 'Choose a different target account.');
    if (!(amount > 0) || amount > availableAmount + 0.005) return onNotify('error', `Amount cannot exceed ${currency} ${availableAmount.toLocaleString()}.`);
    setSaving(true);
    try {
      const values = {
        orgId, payableId: selectedBill.id, vendorId: selectedBill.vendorId,
        reclassificationDate: form.reclassificationDate, originalAccountId: form.originalAccountId,
        targetAccountId: form.targetAccountId, amount, reason: form.reason.trim(), reference: form.reference.trim() || undefined,
        departmentCode: form.departmentCode.trim() || undefined, costCenterCode: form.costCenterCode.trim() || undefined,
        projectCode: form.projectCode.trim() || undefined, branchCode: form.branchCode.trim() || undefined,
      };
      if (editing) await service.updateAPReclassification(editing.id, values);
      else await service.createAPReclassification({
        ...values, id: '', reclassificationNumber: '', status: 'DRAFT', createdBy: currentUserId, createdAt: new Date().toISOString(),
      } as APReclassification);
      setShowForm(false); setEditing(null); await load();
      onNotify('success', editing ? 'Draft reclassification updated.' : 'AP reclassification created as draft.');
    } catch (error) { onNotify('error', error instanceof Error ? error.message : 'Unable to save reclassification.'); }
    finally { setSaving(false); }
  };
  const runAction = async (record: APReclassification, action: 'submit' | 'post' | 'reverse' | 'cancel') => {
    try {
      if (action === 'submit') await service.submitAPReclassification(record.id, currentUserId);
      else if (action === 'post') await service.postAPReclassification(record.id, currentUserId);
      else {
        const reason = window.prompt(`${action === 'reverse' ? 'Reversal' : 'Cancellation'} reason:`)?.trim();
        if (!reason) return;
        if (action === 'reverse') await service.reverseAPReclassification(record.id, currentUserId, reason);
        else await service.cancelAPReclassification(record.id, currentUserId, reason);
      }
      setViewing(null); await load();
      if ((action === 'post' || action === 'reverse') && onJournalChanged) await onJournalChanged();
      onNotify('success', `Reclassification ${action === 'submit' ? 'submitted' : action === 'post' ? 'posted' : action === 'reverse' ? 'reversed' : 'cancelled'} successfully.`);
    } catch (error) { onNotify('error', error instanceof Error ? error.message : `Unable to ${action} reclassification.`); }
  };

  if (showForm) return <div className="space-y-5">
    <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand"><ArrowLeft size={17}/> Back to register</button>
    <form onSubmit={save} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-brand px-6 py-5 text-white"><h2 className="text-xl font-semibold">{editing ? `Edit ${editing.reclassificationNumber}` : 'New AP Reclassification'}</h2><p className="mt-1 text-sm text-white/75">Correct classification without changing the supplier bill, AP balance, or payment history.</p></div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Approved Supplier Bill" wide><select required value={form.payableId} onChange={event => setForm({ ...form, payableId: event.target.value, originalAccountId: '', amount: '' })}><option value="">Select bill...</option>{eligibleBills.map(bill => <option key={bill.id} value={bill.id}>{bill.payableNumber} — {billPartyName(bill)}{bill.category === 'employee_reimbursements' ? ' — Accumulated expenses' : ''}</option>)}</select></Field>
          {selectedBill && <section className="sm:col-span-2 space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-gray-500">Original Bill Information</p><p className="mt-1 text-xs text-gray-500">These AP Bill values are locked and cannot be changed by a reclassification.</p></div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"><LockKeyhole size={13}/> Read only</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Vendor / Supplier" icon={<Building size={12}/>} value={billPartyName(selectedBill)}/>
              <ReadOnlyField label="Claimed By" value={selectedBill.claimedBy || 'Not applicable'}/>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ReadOnlyField label="Document #" value={selectedBill.payableNumber} mono/>
              <ReadOnlyField label="Invoice Date" icon={<Calendar size={12}/>} value={selectedBill.billDate}/>
              <ReadOnlyField label="Due Date" value={selectedBill.dueDate}/>
            </div>
            <ReadOnlyField label="Description" value={selectedBill.description || 'No description'}/>
            <div className="grid gap-4 md:grid-cols-3">
              <ReadOnlyField label="Gross Amount" value={`${currency} ${Number(selectedBill.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} mono/>
              <ReadOnlyField label="Input VAT" value={`${currency} ${Number(selectedBill.inputVatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} mono/>
              <ReadOnlyField label="Net Payable" value={`${currency} ${Number(selectedBill.netPayable ?? selectedBill.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} mono brand/>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Reference Document" value={selectedBill.referenceDocument || 'None'}/>
              <ReadOnlyField label="Notes" value={selectedBill.notes || 'None'}/>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Original Expense / Asset Lines</p>
              <div className="mt-3 space-y-2">{sourceAccounts.map(source => {
                const qualification = qualifications.find(item => item.id === source.qualificationId);
                return <div key={source.account.id} className="grid gap-2 rounded border border-gray-100 p-3 text-sm md:grid-cols-[1fr_1.5fr_auto]"><span className="text-gray-500">{source.description || selectedBill.description || 'Bill expense'}</span><span className="font-semibold text-gray-800">{source.account.code} — {source.account.name}<small className="mt-0.5 block font-normal text-gray-500">Class: {qualification ? `${qualification.code} — ${qualification.name}` : 'Not assigned'}</small></span><span className="text-right font-mono font-semibold">{currency} {source.originalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>;
              })}</div>
            </div>
          </section>}
          <div className="sm:col-span-2 border-t border-gray-200 pt-2"><p className="text-xs font-bold uppercase tracking-wide text-brand">New Classification</p><p className="mt-1 text-xs text-gray-500">Only the correcting account, partial amount, and classification dimensions below will affect the new journal entry.</p></div>
          <Field label="Reclassification Date"><input required type="date" value={form.reclassificationDate} onChange={event => setForm({ ...form, reclassificationDate: event.target.value })}/></Field>
          <Field label="Original Expense / Asset Account"><select required value={form.originalAccountId} onChange={event => setForm({ ...form, originalAccountId: event.target.value, amount: '' })}><option value="">Select original account...</option>{sourceAccounts.map(({ account, originalAmount }) => <option key={account.id} value={account.id}>{account.code} — {account.name} ({currency} {originalAmount.toLocaleString()})</option>)}</select></Field>
          <Field label="New GL Account"><select required value={form.targetAccountId} onChange={event => setForm({ ...form, targetAccountId: event.target.value })}><option value="">Select target account...</option>{classificationAccounts.filter(account => account.id !== form.originalAccountId).map(account => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></Field>
          <Field label="Amount"><input required type="number" min=".01" step=".01" max={availableAmount || undefined} value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })}/></Field>
          <Field label="External Reference"><input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })}/></Field>
          <Field label="Department"><input value={form.departmentCode} onChange={event => setForm({ ...form, departmentCode: event.target.value })} placeholder="Optional code"/></Field>
          <Field label="Cost Center"><input value={form.costCenterCode} onChange={event => setForm({ ...form, costCenterCode: event.target.value })} placeholder="Optional code"/></Field>
          <Field label="Project"><input value={form.projectCode} onChange={event => setForm({ ...form, projectCode: event.target.value })} placeholder="Optional code"/></Field>
          <Field label="Branch"><input value={form.branchCode} onChange={event => setForm({ ...form, branchCode: event.target.value })} placeholder="Optional code"/></Field>
          <Field label="Reason" wide><textarea required rows={4} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })}/></Field>
        </div>
        <aside className="rounded-xl border border-brand-light bg-brand/5 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Journal preview</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{selectedBill ? billPartyName(selectedBill) : 'Select a supplier bill'}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Bill</dt><dd className="font-semibold">{selectedBill?.payableNumber || '—'}</dd></div>
            <div className="flex justify-between"><dt>Bill date</dt><dd>{selectedBill?.billDate || '—'}</dd></div>
            <div className="flex justify-between"><dt>Original entry</dt><dd className="font-mono text-xs">{selectedEntry?.glEntryNumber || selectedEntry?.reference || '—'}</dd></div>
            <div className="flex justify-between"><dt>Original amount</dt><dd>{currency} {Number(selectedSource?.originalAmount || 0).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt>Available</dt><dd className="font-bold">{currency} {availableAmount.toLocaleString()}</dd></div>
          </dl>
          <div className="mt-5 border-t border-brand-light pt-4 text-sm">
            <div className="flex justify-between text-emerald-700"><span>Debit target</span><strong>{currency} {Number(form.amount || 0).toLocaleString()}</strong></div>
            <div className="mt-2 flex justify-between text-rose-700"><span>Credit original</span><strong>{currency} {Number(form.amount || 0).toLocaleString()}</strong></div>
            <p className="mt-4 rounded bg-white p-3 text-xs leading-5 text-slate-500">No AP, cash, or bank account is included in this entry.</p>
          </div>
          <button disabled={saving} className="mt-5 w-full rounded bg-brand px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save Draft Changes' : 'Create Draft'}</button>
        </aside>
      </div>
    </form>
  </div>;

  return <div className="space-y-8">
    <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4"><div><h2 className="text-xl font-semibold text-gray-800 tracking-tight">AP Reclassifications</h2><p className="text-sm text-gray-500 font-normal">Correct approved supplier-bill classifications without changing AP or payment balances.</p></div>{canCreate && <button disabled={!!loadError} onClick={openCreate} className="inline-flex items-center gap-2 rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus size={17}/> New Reclassification</button>}</header>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search number, bill, supplier, account or reason..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3"/></label><select value={filterStatus} onChange={event => setFilterStatus(event.target.value as typeof filterStatus)} className="rounded-lg border border-slate-200 px-3">{['ALL', ...Object.keys(statusStyle)].map(value => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-brand text-xs uppercase tracking-wider text-white"><tr><th className="p-4">Reclassification</th><th className="p-4">Supplier / Bill</th><th className="p-4">Account Transfer</th><th className="p-4 text-right">Amount</th><th className="p-4">Status</th><th className="p-4">Journal</th></tr></thead><tbody className="divide-y">{paginatedRows.map(record => { const recordBill = payables.find(bill => bill.id === record.payableId); return <tr key={record.id} onClick={() => setViewing(record)} className="cursor-pointer hover:bg-brand/5"><td className="p-4 font-bold text-brand">{record.reclassificationNumber}<div className="text-xs font-normal text-slate-500">{record.reclassificationDate}</div></td><td className="p-4"><div className="font-semibold">{billPartyName(recordBill)}</div><div className="text-xs text-slate-500">{recordBill?.payableNumber || '—'}</div></td><td className="p-4 text-xs"><div>{accounts.find(a => a.id === record.originalAccountId)?.name || '—'}</div><div className="mt-1 text-brand">→ {accounts.find(a => a.id === record.targetAccountId)?.name || '—'}</div></td><td className="p-4 text-right font-mono font-bold">{currency} {Number(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[record.status]}`}>{record.status.replace('_', ' ')}</span></td><td className="p-4 font-mono text-xs">{record.journalEntryId ? 'Linked' : '—'}</td></tr>; })}</tbody></table>{loading && <div className="p-10 text-center text-slate-500">Loading reclassifications...</div>}{!loading && loadError && <div className="p-10 text-center"><XCircle className="mx-auto text-amber-500" size={34}/><p className="mt-3 font-semibold text-slate-800">AP Reclassification setup required</p><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Retry</button></div>}{!loading && !loadError && !filtered.length && <div className="m-5 flex flex-col items-center rounded-xl border border-dashed border-brand-light bg-brand/5 px-6 py-12 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand shadow-sm"><RotateCcw size={23}/></div><h3 className="mt-4 text-base font-semibold text-slate-800">{hasActiveFilters ? 'No matching reclassifications' : 'No AP reclassifications yet'}</h3><p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{hasActiveFilters ? 'No records match the current search or status filter.' : 'Create a reclassification when an approved supplier bill needs its expense or asset classification corrected.'}</p>{(hasActiveFilters || canCreate) && <button type="button" onClick={() => hasActiveFilters ? (setSearch(''), setFilterStatus('ALL')) : openCreate()} className="mt-5 inline-flex items-center gap-2 rounded bg-brand px-4 py-2.5 text-sm font-semibold text-white">{hasActiveFilters ? <Search size={16}/> : <Plus size={16}/>} {hasActiveFilters ? 'Clear filters' : 'Create first reclassification'}</button>}</div>}</div>
      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageStartIndex={pageStartIndex} pageEndIndex={pageEndIndex} onPageChange={setCurrentPage} itemLabel="reclassifications"/>
    </section>
    {viewing && <ModalPortal><div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setViewing(null)}><div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex justify-between border-b p-5"><div><p className="text-xs font-bold uppercase text-brand">AP Reclassification</p><h3 className="text-xl font-bold">{viewing.reclassificationNumber}</h3></div><button onClick={() => setViewing(null)}><X size={20}/></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Detail label="Supplier / Claimant" value={billPartyName(payables.find(bill => bill.id === viewing.payableId))}/><Detail label="Original Bill" value={payables.find(b => b.id === viewing.payableId)?.payableNumber}/><Detail label="Original Account" value={accounts.find(a => a.id === viewing.originalAccountId)?.name}/><Detail label="Target Account" value={accounts.find(a => a.id === viewing.targetAccountId)?.name}/><Detail label="Amount" value={`${currency} ${Number(viewing.amount).toLocaleString()}`}/><Detail label="Journal Entry" value={viewing.journalEntryId || 'Not posted'}/><div className="sm:col-span-2"><Detail label="Reason" value={viewing.reason}/></div></div><div className="flex flex-wrap justify-end gap-2 border-t p-4">{viewing.status === 'DRAFT' && canEdit && <button onClick={() => openEdit(viewing)} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-semibold"><FilePenLine size={15}/> Edit</button>}{viewing.status === 'DRAFT' && (canEdit || canApprove) && <button onClick={() => void runAction(viewing, 'submit')} className="inline-flex items-center gap-2 rounded bg-amber-500 px-3 py-2 text-sm font-bold text-white"><Send size={15}/> Submit</button>}{viewing.status === 'PENDING_APPROVAL' && canPost && <button onClick={() => void runAction(viewing, 'post')} className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-sm font-bold text-white"><CheckCircle2 size={15}/> Approve & Post</button>}{['DRAFT', 'PENDING_APPROVAL'].includes(viewing.status) && canVoid && <button onClick={() => void runAction(viewing, 'cancel')} className="inline-flex items-center gap-2 rounded border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><XCircle size={15}/> Cancel</button>}{viewing.status === 'POSTED' && canVoid && <button onClick={() => void runAction(viewing, 'reverse')} className="inline-flex items-center gap-2 rounded border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700"><RotateCcw size={15}/> Reverse</button>}</div></div></div></ModalPortal>}
  </div>;
};

const Field: React.FC<{ label: string; wide?: boolean; children: React.ReactElement }> = ({ label, wide, children }) => <label className={wide ? 'sm:col-span-2 text-sm font-semibold text-slate-700' : 'text-sm font-semibold text-slate-700'}>{label}{React.cloneElement(children, { className: 'mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-brand' })}</label>;
const Detail: React.FC<{ label: string; value?: string }> = ({ label, value }) => <div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p></div>;
const ReadOnlyField: React.FC<{ label: string; value: string; icon?: React.ReactNode; mono?: boolean; brand?: boolean }> = ({ label, value, icon, mono, brand }) => <div className="space-y-1.5"><p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${brand ? 'text-brand' : 'text-gray-500'}`}>{icon}{label}</p><div className={`min-h-[42px] rounded border px-4 py-2.5 text-sm ${brand ? 'border-brand-light bg-brand/10 font-bold text-brand' : 'border-gray-200 bg-gray-100 text-gray-700'} ${mono ? 'font-mono' : 'font-medium'}`}>{value}</div></div>;
export default APReclassificationsView;
