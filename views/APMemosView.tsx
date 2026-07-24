import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, FilePenLine, Plus, Printer,
  RotateCcw, Search, Send, XCircle
} from 'lucide-react';
import { APMemo, APMemoStatus, APMemoType, ChartOfAccount, Payable, UserRole, Vendor } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { AuditService } from '../services/AuditService';
import { canPerformAction } from '../config/permissions';

interface Props {
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole?: UserRole | string;
  currency: string;
  brandColor: string;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_STYLES: Record<APMemoStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  POSTED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-700',
  REVERSED: 'bg-violet-100 text-violet-700',
};
const emptyForm = {
  memoType: 'CREDIT' as APMemoType,
  payableId: '',
  memoDate: new Date().toISOString().slice(0, 10),
  amount: '',
  reason: '',
  reference: '',
  adjustmentAccountId: '',
};

const APMemosView: React.FC<Props> = ({
  orgId, payables, vendors, accounts, currentUserId, currentUserName, currentUserRole, currency, brandColor, onNotify
}) => {
  const service = DataServiceFactory.getService();
  const [memos, setMemos] = useState<APMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | APMemoStatus>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<APMemo | null>(null);
  const [viewing, setViewing] = useState<APMemo | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canCreate = canPerformAction(currentUserRole, 'ap-memos', 'create');
  const canEdit = canPerformAction(currentUserRole, 'ap-memos', 'edit');
  const canApprove = canPerformAction(currentUserRole, 'ap-memos', 'approve');
  const canPost = canPerformAction(currentUserRole, 'ap-memos', 'post');
  const canVoid = canPerformAction(currentUserRole, 'ap-memos', 'void');

  const load = async () => {
    setLoading(true);
    try {
      setMemos(await service.getAPMemosByOrg(orgId));
    } catch (error) {
      console.error('[APMemosView] Failed to load memos:', error);
      onNotify('error', 'Unable to load AP credit/debit memos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [orgId]);

  const effectiveBillBalance = (bill: Payable) => {
    const memoAdjustment = memos
      .filter(memo => memo.payableId === bill.id && memo.status === 'POSTED')
      .reduce((total, memo) => total + (memo.memoType === 'CREDIT' ? -Number(memo.amount) : Number(memo.amount)), 0);
    return Math.max(0, (bill.netPayable || bill.amount) + memoAdjustment - (bill.paidAmount || 0));
  };
  const eligibleBills = useMemo(() => payables.filter(bill =>
    bill.orgId === orgId && !!bill.vendorId && !!bill.journalEntryId &&
    ['approved', 'partially_paid', 'paid'].includes(bill.status) && effectiveBillBalance(bill) > 0 && !bill.isDeleted
  ), [payables, orgId, memos]);
  const selectedBill = payables.find(bill => bill.id === form.payableId);
  const selectedVendor = vendors.find(vendor => vendor.id === selectedBill?.vendorId);
  const previousAdjustments = selectedBill ? memos
    .filter(memo => memo.payableId === selectedBill.id && memo.status === 'POSTED')
    .reduce((total, memo) => total + (memo.memoType === 'CREDIT' ? -Number(memo.amount) : Number(memo.amount)), 0) : 0;
  const outstanding = selectedBill ? effectiveBillBalance(selectedBill) : 0;
  const proposed = Number(form.amount || 0);
  const projected = Math.max(0, outstanding + (form.memoType === 'CREDIT' ? -proposed : proposed));
  const adjustmentAccounts = accounts.filter(account =>
    account.orgId === orgId && !account.isHeader && (account.class === 'EXPENSE' || account.class === 'ASSET')
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memos.filter(memo => {
      const bill = payables.find(item => item.id === memo.payableId);
      const vendor = vendors.find(item => item.id === memo.vendorId);
      return (status === 'ALL' || memo.status === status) && (!query || [
        memo.memoNumber, memo.reason, memo.reference, bill?.payableNumber, vendor?.name
      ].some(value => String(value || '').toLowerCase().includes(query)));
    });
  }, [memos, payables, vendors, search, status]);

  const postedCredits = memos.filter(m => m.status === 'POSTED' && m.memoType === 'CREDIT').reduce((s, m) => s + Number(m.amount), 0);
  const postedDebits = memos.filter(m => m.status === 'POSTED' && m.memoType === 'DEBIT').reduce((s, m) => s + Number(m.amount), 0);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (memo: APMemo) => {
    if (memo.status !== 'DRAFT') return onNotify('error', 'Only draft memos can be edited.');
    setEditing(memo);
    setForm({
      memoType: memo.memoType, payableId: memo.payableId, memoDate: memo.memoDate,
      amount: String(memo.amount), reason: memo.reason, reference: memo.reference || '',
      adjustmentAccountId: memo.adjustmentAccountId,
    });
    setViewing(null);
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBill || !selectedVendor) return onNotify('error', 'Select an approved supplier bill.');
    if (!(proposed > 0) || proposed > outstanding + 0.005) return onNotify('error', 'Memo amount must not exceed the bill outstanding balance.');
    if (!form.adjustmentAccountId || !form.reason.trim()) return onNotify('error', 'Adjustment account and reason are required.');
    setSaving(true);
    try {
      if (editing) {
        const updated = await service.updateAPMemo(editing.id, {
          memoType: form.memoType, payableId: form.payableId, vendorId: selectedVendor.id,
          memoDate: form.memoDate, amount: proposed, reason: form.reason.trim(),
          reference: form.reference.trim() || undefined, adjustmentAccountId: form.adjustmentAccountId,
          updatedBy: currentUserId, updatedAt: new Date().toISOString(),
        });
        AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'UPDATE',
          entityType: 'PAYABLE', entityId: updated.id, entityName: updated.memoNumber, details: 'Updated draft AP memo.' });
      } else {
        const created = await service.createAPMemo({
          id: '', orgId, memoNumber: '', memoType: form.memoType, status: 'DRAFT',
          payableId: selectedBill.id, vendorId: selectedVendor.id, memoDate: form.memoDate,
          amount: proposed, reason: form.reason.trim(), reference: form.reference.trim() || undefined,
          adjustmentAccountId: form.adjustmentAccountId, createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        });
        AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'CREATE',
          entityType: 'PAYABLE', entityId: created.id, entityName: created.memoNumber, details: `Created AP ${form.memoType.toLowerCase()} memo.` });
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
      onNotify('success', editing ? 'Draft memo updated.' : 'AP memo created as draft.');
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Unable to save memo.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (memo: APMemo, action: 'submit' | 'post' | 'reverse' | 'cancel') => {
    try {
      if (action === 'submit') {
        await service.submitAPMemo(memo.id, currentUserId);
        AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'APPROVE',
          entityType: 'PAYABLE', entityId: memo.id, entityName: memo.memoNumber, details: 'Submitted AP memo for approval.' });
      } else if (action === 'post') {
        await service.postAPMemo(memo.id, currentUserId);
        AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'POST',
          entityType: 'PAYABLE', entityId: memo.id, entityName: memo.memoNumber, details: 'Posted AP memo and journal entry.' });
      } else {
        const reason = window.prompt(`${action === 'reverse' ? 'Reversal' : 'Cancellation'} reason:`)?.trim();
        if (!reason) return;
        if (action === 'reverse') {
          await service.reverseAPMemo(memo.id, currentUserId, reason);
          AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'REVERSE',
            entityType: 'PAYABLE', entityId: memo.id, entityName: memo.memoNumber, details: reason });
        } else {
          await service.cancelAPMemo(memo.id, currentUserId, reason);
          AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'VOID',
            entityType: 'PAYABLE', entityId: memo.id, entityName: memo.memoNumber, details: reason });
        }
      }
      setViewing(null);
      await load();
      onNotify('success', `Memo ${action === 'submit' ? 'submitted' : action === 'post' ? 'posted' : action === 'reverse' ? 'reversed' : 'cancelled'} successfully.`);
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : `Unable to ${action} memo.`);
    }
  };

  const printMemo = (memo: APMemo) => {
    const bill = payables.find(item => item.id === memo.payableId);
    const vendor = vendors.find(item => item.id === memo.vendorId);
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return onNotify('error', 'Allow pop-ups to print the memo.');
    popup.document.write(`<!doctype html><html><head><title>${memo.memoNumber}</title><style>
      body{font-family:Georgia,serif;color:#172033;padding:48px}h1{font-size:28px;margin:0;color:${brandColor}}.rule{border-top:3px solid ${brandColor};margin:18px 0}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 36px}.label{font:11px Arial;text-transform:uppercase;letter-spacing:.12em;color:#64748b}
      .value{font-size:15px;margin-top:4px}.amount{font-size:34px;text-align:right}.footer{margin-top:60px;border-top:1px solid #cbd5e1;padding-top:12px;font:11px Arial;color:#64748b}
    </style></head><body><h1>${memo.memoType === 'CREDIT' ? 'AP Credit Memo' : 'AP Debit Memo'}</h1>
    <div class="rule"></div><div class="grid"><div><div class="label">Memo Number</div><div class="value">${memo.memoNumber}</div></div>
    <div class="amount">${currency} ${Number(memo.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
    <div><div class="label">Supplier</div><div class="value">${vendor?.name || '—'}</div></div>
    <div><div class="label">Memo Date</div><div class="value">${memo.memoDate}</div></div>
    <div><div class="label">Referenced Bill</div><div class="value">${bill?.payableNumber || '—'}</div></div>
    <div><div class="label">Status</div><div class="value">${memo.status.replace('_',' ')}</div></div></div>
    <div style="margin-top:32px"><div class="label">Reason</div><div class="value">${memo.reason}</div></div>
    <div class="footer">Journal: ${memo.journalEntryId || 'Not posted'} · Printed ${new Date().toLocaleString()}</div>
    <script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
    AuditService.log({ orgId, userId: currentUserId, userName: currentUserName, action: 'PRINT',
      entityType: 'PAYABLE', entityId: memo.id, entityName: memo.memoNumber });
  };

  if (showForm) return (
    <div className="mx-auto max-w-6xl space-y-6">
      <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand">
        <ArrowLeft size={17}/> Back to memo register
      </button>
      <div className="overflow-hidden rounded-2xl border border-brand-light bg-white shadow-sm">
        <div className="px-8 py-7 text-white" style={{ backgroundColor: brandColor }}>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-white/70">Accounts Payable Adjustment</p>
          <h2 className="mt-2 text-2xl font-semibold">{editing ? `Edit ${editing.memoNumber}` : 'New Credit / Debit Memo'}</h2>
        </div>
        <form onSubmit={save} className="grid gap-8 p-8 lg:grid-cols-[1.4fr_.8fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Memo Type
              <select value={form.memoType} onChange={e=>setForm({...form,memoType:e.target.value as APMemoType})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5">
                <option value="CREDIT">AP Credit Memo</option><option value="DEBIT">AP Debit Memo</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Memo Date
              <input type="date" required value={form.memoDate} onChange={e=>setForm({...form,memoDate:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5"/>
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Approved Supplier Bill
              <select required value={form.payableId} onChange={e=>setForm({...form,payableId:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5">
                <option value="">Select approved bill…</option>
                {eligibleBills.map(bill=><option key={bill.id} value={bill.id}>{bill.payableNumber} · {vendors.find(v=>v.id===bill.vendorId)?.name} · Balance {currency} {effectiveBillBalance(bill).toLocaleString()}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Amount
              <input type="number" min=".01" step=".01" max={outstanding || undefined} required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono"/>
            </label>
            <label className="text-sm font-semibold text-slate-700">Expense / Asset Account
              <select required value={form.adjustmentAccountId} onChange={e=>setForm({...form,adjustmentAccountId:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5">
                <option value="">Select adjustment account…</option>{adjustmentAccounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Reason
              <textarea required rows={4} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5"/>
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">External Reference
              <input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5"/>
            </label>
          </div>
          <aside className="rounded-xl border border-brand-light bg-brand/5 p-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Bill impact</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{selectedVendor?.name || 'Select a supplier bill'}</h3>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between"><dt>Original bill</dt><dd className="font-mono">{currency} {Number(selectedBill?.netPayable || selectedBill?.amount || 0).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Previous adjustments</dt><dd className="font-mono">{currency} {previousAdjustments.toLocaleString()}</dd></div>
              <div className="flex justify-between border-t border-brand-light pt-4"><dt>Outstanding</dt><dd className="font-mono font-bold">{currency} {outstanding.toLocaleString()}</dd></div>
              <div className="flex justify-between text-brand"><dt>Projected payable</dt><dd className="font-mono text-lg font-bold">{currency} {projected.toLocaleString()}</dd></div>
            </dl>
            <button disabled={saving} style={{ backgroundColor: brandColor }} className="mt-8 w-full rounded-lg px-4 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save Draft Changes' : 'Create Draft Memo'}</button>
          </aside>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Credit / Debit Memos</h2>
          <p className="text-sm text-gray-500 font-normal">Controlled supplier bill adjustments with independent journals and reversal history.</p>
        </div>
        {canCreate && <button onClick={openCreate} style={{ backgroundColor: brandColor }} className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"><Plus size={17}/> New Memo</button>}
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Posted credits</p><p className="mt-2 font-mono text-2xl font-bold text-emerald-700">{currency} {postedCredits.toLocaleString()}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Posted debits</p><p className="mt-2 font-mono text-2xl font-bold text-rose-700">{currency} {postedDebits.toLocaleString()}</p></div>
        <div className="rounded-xl border border-brand-light bg-brand/5 p-5"><p className="text-xs font-bold uppercase tracking-wider text-brand">Net AP adjustment</p><p className="mt-2 font-mono text-2xl font-bold text-brand">{currency} {(postedDebits-postedCredits).toLocaleString()}</p></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search memo, bill, supplier or reference…" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3"/></label>
          <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="rounded-lg border border-slate-200 px-3 py-2.5"><option value="ALL">All statuses</option>{Object.keys(STATUS_STYLES).map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead style={{ backgroundColor: brandColor }} className="text-xs uppercase tracking-wider text-white"><tr><th className="p-4">Memo</th><th className="p-4">Supplier / Bill</th><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4 text-right">Amount</th><th className="p-4">Status</th><th className="p-4">Journal</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map(memo=>{const bill=payables.find(b=>b.id===memo.payableId);const vendor=vendors.find(v=>v.id===memo.vendorId);return <tr key={memo.id} onClick={()=>setViewing(memo)} className="cursor-pointer hover:bg-brand/5"><td className="p-4 font-bold text-brand">{memo.memoNumber}<div className="mt-1 max-w-[240px] truncate text-xs font-normal text-slate-500">{memo.reason}</div></td><td className="p-4"><div className="font-semibold text-slate-800">{vendor?.name||'—'}</div><div className="text-xs text-slate-500">{bill?.payableNumber||'—'}</div></td><td className="p-4 text-slate-600">{memo.memoDate}</td><td className="p-4"><span className={memo.memoType==='CREDIT'?'font-bold text-emerald-700':'font-bold text-rose-700'}>{memo.memoType}</span></td><td className="p-4 text-right font-mono font-bold">{currency} {Number(memo.amount).toLocaleString(undefined,{minimumFractionDigits:2})}</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[memo.status]}`}>{memo.status.replace('_',' ')}</span></td><td className="p-4 font-mono text-xs text-slate-500">{memo.journalEntryId?'Linked':'—'}</td></tr>})}</tbody></table></div>
        {loading&&<div className="p-10 text-center text-slate-500">Loading memo register…</div>}{!loading&&!filtered.length&&<div className="p-12 text-center text-slate-500">No credit or debit memos found.</div>}
      </section>
      {viewing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={()=>setViewing(null)}><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between border-b p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">{viewing.memoType} MEMO</p><h3 className="mt-1 text-xl font-bold">{viewing.memoNumber}</h3></div><button onClick={()=>setViewing(null)}><XCircle className="text-slate-400"/></button></div>
        <div className="grid gap-5 p-6 sm:grid-cols-2"><div><p className="text-xs uppercase text-slate-400">Supplier</p><p className="mt-1 font-semibold">{vendors.find(v=>v.id===viewing.vendorId)?.name}</p></div><div><p className="text-xs uppercase text-slate-400">Referenced bill</p><p className="mt-1 font-semibold">{payables.find(b=>b.id===viewing.payableId)?.payableNumber}</p></div><div><p className="text-xs uppercase text-slate-400">Amount</p><p className="mt-1 font-mono text-xl font-bold">{currency} {Number(viewing.amount).toLocaleString()}</p></div><div><p className="text-xs uppercase text-slate-400">Status</p><p className="mt-1 font-semibold">{viewing.status.replace('_',' ')}</p></div><div className="sm:col-span-2"><p className="text-xs uppercase text-slate-400">Reason</p><p className="mt-1">{viewing.reason}</p></div>{viewing.journalEntryId&&<div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 font-mono text-xs">Journal ID: {viewing.journalEntryId}</div>}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t p-5">
          <button onClick={()=>printMemo(viewing)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><Printer size={15}/> Print</button>
          {viewing.status==='DRAFT'&&canEdit&&<button onClick={()=>openEdit(viewing)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><FilePenLine size={15}/> Edit</button>}
          {viewing.status==='DRAFT'&&(canEdit||canApprove)&&<button onClick={()=>void runAction(viewing,'submit')} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white"><Send size={15}/> Submit</button>}
          {viewing.status==='PENDING_APPROVAL'&&canPost&&<button onClick={()=>void runAction(viewing,'post')} style={{ backgroundColor: brandColor }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-white"><CheckCircle2 size={15}/> Approve & Post</button>}
          {['DRAFT','PENDING_APPROVAL'].includes(viewing.status)&&canVoid&&<button onClick={()=>void runAction(viewing,'cancel')} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><XCircle size={15}/> Cancel</button>}
          {viewing.status==='POSTED'&&canVoid&&<button onClick={()=>void runAction(viewing,'reverse')} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700"><RotateCcw size={15}/> Reverse</button>}
        </div>
      </div></div>}
    </div>
  );
};

export default APMemosView;
