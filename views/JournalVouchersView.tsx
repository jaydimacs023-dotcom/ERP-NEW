import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, BookCheck, ChevronLeft, ChevronRight, Eye, FilePlus2,
  Link2, Pencil, Plus, Printer, Save, Search, Send, Trash2
} from 'lucide-react';
import { AccountingPeriod, ChartOfAccount, JournalVoucher, JournalVoucherLine, User } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';

interface Props {
  orgId: string;
  accounts: ChartOfAccount[];
  periods: AccountingPeriod[];
  users: User[];
  currentUser: User;
  brandColor: string;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onPosted: () => Promise<void> | void;
  onNavigate: (target: 'ledger' | 'audit') => void;
}

type DraftLine = Omit<JournalVoucherLine, 'id' | 'journalVoucherId'>;

const emptyLine = (): DraftLine => ({ coaId: '', debit: 0, credit: 0, lineDescription: '' });
const today = () => new Date().toISOString().slice(0, 10);
const VOUCHERS_PER_PAGE = 7;

const JournalVouchersView: React.FC<Props> = ({
  orgId, accounts, periods, users, currentUser, brandColor, onNotify, onPosted, onNavigate
}) => {
  const service = useMemo(() => DataServiceFactory.getService(), []);
  const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ON_HOLD' | 'POSTED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<JournalVoucher | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [form, setForm] = useState({
    journalDate: today(), accountingPeriodId: '', description: '', referenceNo: '',
    remarks: '', attachmentName: '', attachmentUrl: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVouchers(await service.getJournalVouchersByOrg(orgId));
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Failed to load journal vouchers.');
    } finally {
      setLoading(false);
    }
  }, [orgId, onNotify, service]);

  useEffect(() => { void load(); }, [load]);

  const auditAction = (voucher: JournalVoucher, action: 'VIEWED' | 'PRINTED') => {
    void service.createAuditLog({
      orgId,
      userId: currentUser.id,
      action,
      entityType: 'JOURNAL_VOUCHER',
      entityId: voucher.id,
      details: `${action === 'VIEWED' ? 'Viewed' : 'Printed'} ${voucher.jvNumber}`,
      createdAt: new Date().toISOString()
    }).catch(error => console.warn(`[JournalVouchers] Could not record ${action.toLowerCase()} action`, error));
  };

  const openPeriodForDate = (date: string) =>
    periods.find(period => period.orgId === orgId && period.status === 'OPEN'
      && date >= period.startDate && date <= period.endDate);

  useEffect(() => {
    if (!open || selected || !form.journalDate) return;
    const periodId = openPeriodForDate(form.journalDate)?.id || '';
    setForm(current => current.accountingPeriodId === periodId
      ? current
      : { ...current, accountingPeriodId: periodId });
  }, [open, selected, form.journalDate, periods, orgId]);

  const newVoucher = () => {
    const date = today();
    setSelected(null);
    setViewOnly(false);
    setLines([emptyLine(), emptyLine()]);
    setForm({
      journalDate: date,
      accountingPeriodId: openPeriodForDate(date)?.id || '',
      description: '', referenceNo: '', remarks: '', attachmentName: '', attachmentUrl: ''
    });
    setOpen(true);
  };

  const openVoucher = async (voucher: JournalVoucher, forceView = false) => {
    try {
      const detailLines = await service.getJournalVoucherLines(voucher.id);
      const attachment = voucher.attachments?.[0];
      setSelected(voucher);
      setViewOnly(forceView || voucher.status === 'POSTED');
      setLines(detailLines.map(({ coaId, debit, credit, lineDescription, costCenterId, projectId }) => ({
        coaId, debit, credit, lineDescription, costCenterId, projectId
      })));
      setForm({
        journalDate: voucher.journalDate,
        accountingPeriodId: voucher.accountingPeriodId,
        description: voucher.description,
        referenceNo: voucher.referenceNo || '',
        remarks: voucher.remarks || '',
        attachmentName: attachment?.name || '',
        attachmentUrl: attachment?.url || ''
      });
      setOpen(true);
      auditAction(voucher, 'VIEWED');
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Failed to open voucher.');
    }
  };

  const totals = useMemo(() => lines.reduce((sum, line) => ({
    debit: sum.debit + Number(line.debit || 0),
    credit: sum.credit + Number(line.credit || 0)
  }), { debit: 0, credit: 0 }), [lines]);
  const balanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.005;

  const validate = () => {
    if (!form.description.trim() || !form.accountingPeriodId) {
      onNotify('error', 'Journal date, accounting period, and description are required.');
      return false;
    }
    if (lines.length < 2 || lines.some(line => !line.coaId || (Number(line.debit) <= 0 && Number(line.credit) <= 0))) {
      onNotify('error', 'Enter at least two complete journal lines.');
      return false;
    }
    if (!balanced) {
      onNotify('error', 'Total debits and credits must be equal and greater than zero.');
      return false;
    }
    return true;
  };

  const save = async (): Promise<JournalVoucher | null> => {
    if (!validate()) return null;
    setSaving(true);
    try {
      const attachments = form.attachmentUrl.trim()
        ? [{ name: form.attachmentName.trim() || 'Supporting document', url: form.attachmentUrl.trim() }]
        : [];
      const payload = {
        orgId,
        companyId: orgId,
        journalDate: form.journalDate,
        accountingPeriodId: form.accountingPeriodId,
        description: form.description.trim(),
        referenceNo: form.referenceNo.trim() || undefined,
        status: 'ON_HOLD' as const,
        preparedBy: currentUser.id,
        remarks: form.remarks.trim() || undefined,
        attachments
      };
      const voucher = selected
        ? await service.updateJournalVoucher(selected.id, payload)
        : await service.createJournalVoucher(payload);
      await service.replaceJournalVoucherLines(voucher.id, lines);
      setSelected(voucher);
      await load();
      onNotify('success', `${voucher.jvNumber} saved On Hold.`);
      return voucher;
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Failed to save journal voucher.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const post = async () => {
    const voucher = await save();
    if (!voucher) return;
    if (!window.confirm(`Post ${voucher.jvNumber}? Posted financial values cannot be edited or deleted.`)) return;
    setSaving(true);
    try {
      const posted = await service.postJournalVoucher(voucher.id, currentUser.id);
      setSelected(posted);
      setViewOnly(true);
      await Promise.all([load(), Promise.resolve(onPosted())]);
      onNotify('success', `${posted.jvNumber} posted as ${posted.glReference}.`);
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Posting failed and was rolled back.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (voucher: JournalVoucher) => {
    if (!window.confirm(`Delete On Hold voucher ${voucher.jvNumber}?`)) return;
    try {
      await service.deleteJournalVoucher(voucher.id);
      await load();
      onNotify('success', `${voucher.jvNumber} deleted.`);
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Failed to delete voucher.');
    }
  };

  const visible = vouchers.filter(voucher => {
    const haystack = `${voucher.jvNumber} ${voucher.glReference || ''} ${voucher.description} ${voucher.referenceNo || ''}`.toLowerCase();
    return (status === 'ALL' || voucher.status === status) && haystack.includes(search.toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / VOUCHERS_PER_PAGE));
  const pageStart = (currentPage - 1) * VOUCHERS_PER_PAGE;
  const paginatedVouchers = visible.slice(pageStart, pageStart + VOUCHERS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, orgId]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const userName = (id?: string) => users.find(user => user.id === id)?.name || id || '—';
  const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const printVoucher = (voucher?: JournalVoucher | null) => {
    if (voucher) auditAction(voucher, 'PRINTED');
    window.print();
  };

  return (
    <div className="space-y-5">
      {!open && (
        <>
      <section>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Journal Vouchers</h2>
            <p className="text-sm italic text-gray-500">Prepare, review, and post manual accounting transactions</p>
          </div>
          <button
            onClick={newVoucher}
            className="flex items-center gap-2 rounded px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <FilePlus2 size={18} /> New Journal Voucher
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['All vouchers', vouchers.length],
            ['On Hold', vouchers.filter(v => v.status === 'ON_HOLD').length],
            ['Posted', vouchers.filter(v => v.status === 'POSTED').length]
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded border border-gray-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-xl font-semibold text-gray-800 tracking-tight">{value}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search JV number, GL reference, or description" className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-slate-400" />
          </label>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold">
            <option value="ALL">All statuses</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-white" style={{ backgroundColor: brandColor }}>
              <tr><th className="px-5 py-3">Voucher</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">GL reference</th><th className="px-5 py-3">Prepared by</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedVouchers.map(voucher => (
                <tr key={voucher.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-bold text-slate-900">{voucher.jvNumber}</td>
                  <td className="px-5 py-4 text-slate-600">{new Date(`${voucher.journalDate}T00:00:00`).toLocaleDateString()}</td>
                  <td className="max-w-xs px-5 py-4 text-slate-700"><div className="truncate">{voucher.description}</div></td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-700">{voucher.glReference || 'Not generated'}</td>
                  <td className="px-5 py-4 text-slate-600">{userName(voucher.preparedBy)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${voucher.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${voucher.status === 'POSTED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {voucher.status === 'POSTED' ? 'Posted' : 'On Hold'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => void openVoucher(voucher, voucher.status === 'POSTED')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={voucher.status === 'POSTED' ? 'View' : 'Edit'}>{voucher.status === 'POSTED' ? <Eye size={17} /> : <Pencil size={17} />}</button>
                      <button onClick={() => { void openVoucher(voucher, true); setTimeout(() => printVoucher(voucher), 250); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Print"><Printer size={17} /></button>
                      {voucher.status === 'ON_HOLD' && <button onClick={() => void remove(voucher)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title="Delete"><Trash2 size={17} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500"><BookCheck className="mx-auto mb-3 text-slate-300" size={42} /><p className="font-semibold">No journal vouchers found.</p></td></tr>}
              {loading && <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500">Loading journal vouchers…</td></tr>}
            </tbody>
          </table>
        </div>
        {!loading && visible.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t bg-gray-50 px-5 py-3 text-[13px] text-gray-600 sm:flex-row">
            <div className="font-medium">
              Showing {pageStart + 1}-{Math.min(pageStart + VOUCHERS_PER_PAGE, visible.length)} of {visible.length} journal vouchers
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-20 text-center font-semibold text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
        </>
      )}

      {open && (
        <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 print:hidden"
                  title="Back to Journal Vouchers"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{viewOnly ? 'Journal Voucher' : selected ? 'Edit Journal Voucher' : 'Create Journal Voucher'}</h2>
                  <p className="text-sm italic text-gray-500">{selected?.jvNumber || 'Prepare a balanced manual accounting transaction'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selected && <span className={`rounded-full px-3 py-1 text-xs font-bold ${selected.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{selected.status === 'POSTED' ? 'Posted' : 'On Hold'}</span>}
              </div>
            </header>
            <div className="p-6">
              {selected?.status === 'POSTED' && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-emerald-800">Official GL reference: <span className="font-mono">{selected.glReference}</span></span>
                  <span className="text-emerald-700">Posted by {userName(selected.postedBy)} · {selected.postedAt ? new Date(selected.postedAt).toLocaleString() : ''}</span>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-4">
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Journal date</span><input disabled={viewOnly} type="date" value={form.journalDate} onChange={e => { const date = e.target.value; setForm(f => ({ ...f, journalDate: date, accountingPeriodId: openPeriodForDate(date)?.id || '' })); }} className="h-10 w-full rounded-lg border px-3 disabled:bg-slate-50" /></label>
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Accounting period <span className="font-medium normal-case tracking-normal text-slate-400">(automatic)</span></span><select disabled value={form.accountingPeriodId} className="h-10 w-full rounded-lg border bg-slate-50 px-3 text-slate-700"><option value="">No open period for this date</option>{periods.filter(p => p.orgId === orgId && p.status === 'OPEN').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label className="space-y-1.5 md:col-span-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">External reference (optional)</span><input disabled={viewOnly} value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} className="h-10 w-full rounded-lg border px-3 disabled:bg-slate-50" placeholder="Check, memo, or document number" /></label>
                <label className="space-y-1.5 md:col-span-4"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Description</span><input disabled={viewOnly} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-10 w-full rounded-lg border px-3 disabled:bg-slate-50" placeholder="Purpose of this journal voucher" /></label>
              </div>
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-white" style={{ backgroundColor: brandColor }}><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Line description</th><th className="w-40 px-4 py-3 text-right">Debit</th><th className="w-40 px-4 py-3 text-right">Credit</th>{!viewOnly && <th className="w-12" />}</tr></thead>
                  <tbody className="divide-y">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="p-2"><select disabled={viewOnly} value={line.coaId} onChange={e => setLines(all => all.map((item, i) => i === index ? { ...item, coaId: e.target.value } : item))} className="h-10 w-full min-w-56 rounded-lg border bg-white px-2 disabled:bg-slate-50"><option value="">Select account</option>{accounts.filter(a => a.isActive && !a.isHeader).map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></td>
                        <td className="p-2"><input disabled={viewOnly} value={line.lineDescription || ''} onChange={e => setLines(all => all.map((item, i) => i === index ? { ...item, lineDescription: e.target.value } : item))} className="h-10 w-full rounded-lg border px-3 disabled:bg-slate-50" /></td>
                        <td className="p-2"><input disabled={viewOnly} type="number" min="0" step="0.01" value={line.debit || ''} onChange={e => setLines(all => all.map((item, i) => i === index ? { ...item, debit: Number(e.target.value), credit: Number(e.target.value) > 0 ? 0 : item.credit } : item))} className="h-10 w-full rounded-lg border px-3 text-right font-mono disabled:bg-slate-50" /></td>
                        <td className="p-2"><input disabled={viewOnly} type="number" min="0" step="0.01" value={line.credit || ''} onChange={e => setLines(all => all.map((item, i) => i === index ? { ...item, credit: Number(e.target.value), debit: Number(e.target.value) > 0 ? 0 : item.debit } : item))} className="h-10 w-full rounded-lg border px-3 text-right font-mono disabled:bg-slate-50" /></td>
                        {!viewOnly && <td className="p-2"><button disabled={lines.length <= 2} onClick={() => setLines(all => all.filter((_, i) => i !== index))} className="rounded p-2 text-rose-500 disabled:opacity-30"><Trash2 size={16} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 bg-slate-50 font-bold"><tr><td className="px-4 py-3" colSpan={2}>Control totals</td><td className="px-4 py-3 text-right font-mono">{money(totals.debit)}</td><td className="px-4 py-3 text-right font-mono">{money(totals.credit)}</td>{!viewOnly && <td />}</tr></tfoot>
                </table>
              </div>
              {!viewOnly && <button onClick={() => setLines(all => [...all, emptyLine()])} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:border-slate-500"><Plus size={16} /> Add line</button>}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Remarks</span><textarea disabled={viewOnly} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="min-h-24 w-full rounded-lg border p-3 disabled:bg-slate-50" /></label>
                <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Link2 size={15} /> Supporting document</div>
                  <input disabled={viewOnly} value={form.attachmentName} onChange={e => setForm(f => ({ ...f, attachmentName: e.target.value }))} className="h-9 w-full rounded-lg border px-3 disabled:bg-slate-50" placeholder="Document name" />
                  <input disabled={viewOnly} type="url" value={form.attachmentUrl} onChange={e => setForm(f => ({ ...f, attachmentUrl: e.target.value }))} className="h-9 w-full rounded-lg border px-3 disabled:bg-slate-50" placeholder="https://…" />
                  {viewOnly && form.attachmentUrl && <a href={form.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600"><Link2 size={15} /> Open attachment</a>}
                </div>
              </div>
              {!viewOnly && !balanced && <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800"><AlertCircle size={17} /> Voucher must balance before it can be saved or posted.</div>}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-6 py-4 print:hidden">
              <div className="text-xs text-slate-500">{selected ? `Prepared by ${userName(selected.preparedBy)}` : `Prepared by ${currentUser.name}`}</div>
              <div className="flex gap-2">
                {selected?.status === 'POSTED' && <button onClick={() => onNavigate('ledger')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold text-slate-700"><BookCheck size={16} /> General Journal / Ledger</button>}
                {selected?.status === 'POSTED' && <button onClick={() => onNavigate('audit')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold text-slate-700"><Eye size={16} /> Audit Trail</button>}
                <button onClick={() => printVoucher(selected)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700"><Printer size={16} /> Print {viewOnly ? '' : 'Preview'}</button>
                {!viewOnly && <button disabled={saving || !balanced} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"><Save size={16} /> Save On Hold</button>}
                {!viewOnly && <button disabled={saving || !balanced} onClick={() => void post()} style={{ backgroundColor: brandColor }} className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50"><Send size={16} /> Post</button>}
              </div>
            </footer>
        </section>
      )}
    </div>
  );
};

export default JournalVouchersView;
