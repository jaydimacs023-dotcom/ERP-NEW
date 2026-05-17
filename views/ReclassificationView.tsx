import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Printer,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react';
import { AccountClass, ChartOfAccount, JournalEntry, JournalLine, Sponsor, Student, User } from '../types';
import ModalPortal from '../components/ModalPortal';

interface ReclassificationViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  sponsors: Sponsor[];
  students: Student[];
  currency: string;
  brandColor?: string;
  currentUser?: User | null;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onViewJournal?: (journalEntryId: string) => void;
  onNotify?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

type Scope = 'AR' | 'GL';
type ReclassType = 'AR_TO_AR' | 'ACCOUNT_TRANSFER' | 'CUSTOMER_TRANSFER' | 'CLASSIFICATION_CORRECTION';
type BasisType = 'TRANSACTION_NO' | 'TRANSACTION_TYPE' | 'GL_REFERENCE_NO';

interface SourceCandidate {
  line: JournalLine;
  entry: JournalEntry;
  account: ChartOfAccount;
  transactionNo: string;
  transactionType: string;
  glRefNo: string;
  date: string;
  originalAccount: string;
  payor: string;
  contactId?: string;
  contactType?: JournalLine['contactType'];
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ReclassificationDraft {
  id: string;
  reclassNo: string;
  status: 'DRAFT';
  reclassDate: string;
  scope: Scope;
  reclassType: ReclassType;
  payorType: 'SPONSOR' | 'STUDENT';
  sourceAccountId: string;
  targetAccountId: string;
  sourcePayorId: string;
  targetPayorId: string;
  basisType: BasisType;
  basisValue: string;
  loadedSourceId: string;
  amount: number;
  remarks: string;
  sourceTransactionNo: string;
  sourcePayor: string;
  sourceAccountName: string;
  targetAccountName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const todayKey = () => new Date().toISOString().split('T')[0];

const formatReclassNo = (year: number, sequence: number) =>
  `RC-${year}-${String(sequence).padStart(5, '0')}`;

const extractReclassSequence = (reference: string | undefined, year: number) => {
  const match = String(reference || '').trim().match(/^RC-(\d{4})-(\d+)$/i);
  if (!match || Number(match[1]) !== year) return 0;
  return Number(match[2]) || 0;
};

const formatPostPeriod = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
};

const getContactName = (
  contactType: JournalLine['contactType'] | undefined,
  contactId: string | undefined,
  sponsors: Sponsor[],
  students: Student[]
) => {
  if (!contactId) return '-';
  if (contactType === 'SPONSOR') return sponsors.find(item => item.id === contactId)?.name || contactId;
  if (contactType === 'STUDENT') {
    const student = students.find(item => item.id === contactId);
    return student ? `${student.lastName}, ${student.firstName}` : contactId;
  }
  return contactId;
};

const ReclassificationView: React.FC<ReclassificationViewProps> = ({
  entries,
  lines,
  accounts,
  sponsors,
  students,
  currency,
  brandColor = '#0b8f4d',
  currentUser,
  onPostJournal,
  onViewJournal,
  onNotify,
}) => {
  const [reclassNo, setReclassNo] = useState(() => {
    const year = new Date().getFullYear();
    const postedMax = entries.reduce((max, entry) => Math.max(max, extractReclassSequence(entry.reference, year)), 0);
    return formatReclassNo(year, postedMax + 1);
  });
  const [status, setStatus] = useState<'DRAFT' | 'POSTED'>('DRAFT');
  const [reclassDate, setReclassDate] = useState(todayKey());
  const [scope, setScope] = useState<Scope>('AR');
  const [reclassType, setReclassType] = useState<ReclassType>('AR_TO_AR');
  const [payorType, setPayorType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [sourcePayorId, setSourcePayorId] = useState('');
  const [targetPayorId, setTargetPayorId] = useState('');
  const [basisType, setBasisType] = useState<BasisType>('TRANSACTION_NO');
  const [basisValue, setBasisValue] = useState('');
  const [loadedSourceId, setLoadedSourceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [postedEntry, setPostedEntry] = useState<JournalEntry | null>(null);
  const [drafts, setDrafts] = useState<ReclassificationDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState('');
  const [showPostConfirm, setShowPostConfirm] = useState(false);

  const getNextReclassNo = (currentDrafts: ReclassificationDraft[]) => {
    const year = new Date().getFullYear();
    const postedMax = entries.reduce((max, entry) => Math.max(max, extractReclassSequence(entry.reference, year)), 0);
    const draftMax = currentDrafts.reduce((max, draft) => Math.max(max, extractReclassSequence(draft.reclassNo, year)), 0);
    return formatReclassNo(year, Math.max(postedMax, draftMax) + 1);
  };

  useEffect(() => {
    if (activeDraftId || status !== 'DRAFT') return;
    const nextNo = getNextReclassNo(drafts);
    setReclassNo(prev => prev === nextNo ? prev : nextNo);
  }, [activeDraftId, drafts, entries, status]);

  const formatCurrency = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const brandTint = (opacity: number) => {
    const match = brandColor.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return `rgb(249 250 251 / ${opacity})`;
    const [, r, g, b] = match;
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
  };

  const arAccounts = useMemo(() => accounts.filter(account =>
    account.class === AccountClass.ASSET &&
    !account.isHeader &&
    ((account.name || '').toLowerCase().includes('receivable') || account.code === '1200')
  ), [accounts]);

  const selectableAccounts = scope === 'AR' ? arAccounts : accounts.filter(account => !account.isHeader && account.isActive);
  const payors = payorType === 'SPONSOR'
    ? sponsors.filter(item => !item.isDeleted).map(item => ({ id: item.id, name: item.name, code: item.sponsorCode || item.id }))
    : students.filter(item => !item.isDeleted).map(item => ({ id: item.id, name: `${item.lastName}, ${item.firstName}`, code: item.uli || item.id }));

  const sourceCandidates = useMemo<SourceCandidate[]>(() => {
    const postedEntries = new Map(entries.filter(entry => entry.status === 'POSTED').map(entry => [entry.id, entry]));
    return lines
      .map(line => {
        const entry = postedEntries.get(line.journalEntryId);
        const account = accounts.find(item => item.id === line.accountId);
        if (!entry || !account) return null;
        if (scope === 'AR') {
          const isArAccount = arAccounts.some(item => item.id === account.id);
          if (!isArAccount || line.contactType !== payorType || !line.contactId) return null;
        }
        const balance = line.debit - line.credit;
        return {
          line,
          entry,
          account,
          transactionNo: entry.reference || entry.sourceRef || entry.glEntryNumber || entry.id,
          transactionType: entry.sourceType || 'JOURNAL',
          glRefNo: entry.glEntryNumber || entry.reference || '-',
          date: entry.date,
          originalAccount: `${account.code} - ${account.name}`,
          payor: getContactName(line.contactType, line.contactId, sponsors, students),
          contactId: line.contactId,
          contactType: line.contactType,
          description: entry.description || line.memo || line.description || 'Source transaction',
          debit: line.debit,
          credit: line.credit,
          balance,
        };
      })
      .filter((candidate): candidate is SourceCandidate => !!candidate && Math.abs(candidate.balance) > 0.01)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [accounts, arAccounts, entries, lines, payorType, scope, sponsors, students]);

  const loadedSource = sourceCandidates.find(candidate => candidate.line.id === loadedSourceId) || null;
  const sourceAccount = accounts.find(account => account.id === sourceAccountId) || loadedSource?.account || null;
  const targetAccount = accounts.find(account => account.id === targetAccountId) || null;
  const sourcePayor = payors.find(payor => payor.id === sourcePayorId) || null;
  const targetPayor = payors.find(payor => payor.id === targetPayorId) || null;
  const maxAmount = Math.abs(loadedSource?.balance || 0);
  const normalizedAmount = Math.min(Math.max(Number(amount) || 0, 0), maxAmount || Number(amount) || 0);
  const isSourceDebitBalance = (loadedSource?.balance || 0) >= 0;
  const balanceAfterReclass = Math.max(0, maxAmount - normalizedAmount);
  const isBalanced = normalizedAmount > 0 && !!sourceAccount && !!targetAccount;

  const matchingCandidates = useMemo(() => {
    const term = basisValue.trim().toLowerCase();
    if (!term) return sourceCandidates.slice(0, 8);
    return sourceCandidates.filter(candidate => {
      if (basisType === 'TRANSACTION_NO') return candidate.transactionNo.toLowerCase().includes(term);
      if (basisType === 'TRANSACTION_TYPE') return candidate.transactionType.toLowerCase().includes(term);
      return candidate.glRefNo.toLowerCase().includes(term);
    }).slice(0, 8);
  }, [basisType, basisValue, sourceCandidates]);

  const loadTransaction = () => {
    const match = matchingCandidates[0];
    if (!match) {
      onNotify?.('warning', 'No matching transaction found.');
      return;
    }
    setLoadedSourceId(match.line.id);
    setSourceAccountId(match.account.id);
    setSourcePayorId(match.contactId || '');
    setAmount(Math.abs(match.balance));
    if (!targetAccountId) setTargetAccountId(selectableAccounts.find(account => account.id !== match.account.id)?.id || '');
  };

  const buildJournalLines = (): JournalLine[] => {
    const lineBase = {
      orgId: loadedSource?.line.orgId || '',
      journalEntryId: '',
      batchId: loadedSource?.line.batchId,
      contactType: scope === 'AR' ? payorType : loadedSource?.contactType,
    };
    const sourceContactId = scope === 'AR' ? sourcePayorId || loadedSource?.contactId : loadedSource?.contactId;
    const targetContactId = scope === 'AR' ? targetPayorId || sourcePayorId || loadedSource?.contactId : loadedSource?.contactId;

    if (isSourceDebitBalance) {
      return [
        {
          ...lineBase,
          id: `rc-line-target-${Date.now()}`,
          accountId: targetAccountId,
          debit: normalizedAmount,
          credit: 0,
          contactId: targetContactId,
          memo: `Reclass target - ${reclassNo}`,
        } as JournalLine,
        {
          ...lineBase,
          id: `rc-line-source-${Date.now()}`,
          accountId: sourceAccount?.id || sourceAccountId,
          debit: 0,
          credit: normalizedAmount,
          contactId: sourceContactId,
          memo: `Reclass source - ${reclassNo}`,
        } as JournalLine,
      ];
    }

    return [
      {
        ...lineBase,
        id: `rc-line-source-${Date.now()}`,
        accountId: sourceAccount?.id || sourceAccountId,
        debit: normalizedAmount,
        credit: 0,
        contactId: sourceContactId,
        memo: `Reclass source - ${reclassNo}`,
      } as JournalLine,
      {
        ...lineBase,
        id: `rc-line-target-${Date.now()}`,
        accountId: targetAccountId,
        debit: 0,
        credit: normalizedAmount,
        contactId: targetContactId,
        memo: `Reclass target - ${reclassNo}`,
      } as JournalLine,
    ];
  };

  const buildEntry = (): Partial<JournalEntry> => ({
    date: reclassDate,
    reference: reclassNo,
    sourceRef: loadedSource?.transactionNo || reclassNo,
    sourceType: 'JOURNAL',
    description: remarks || `Reclassification ${reclassNo}`,
  });

  const validateReclassification = (action: 'saving' | 'posting') => {
    if (!isBalanced) {
      onNotify?.('error', `Complete the source, target, and amount before ${action}.`);
      return false;
    }
    if (!loadedSource) {
      onNotify?.('error', `Load a source transaction before ${action}.`);
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateReclassification('saving')) {
      return;
    }

    const now = new Date().toISOString();
    const userName = currentUser?.name || 'AR Specialist';
    const draft: ReclassificationDraft = {
      id: activeDraftId || `draft-${Date.now()}`,
      reclassNo,
      status: 'DRAFT',
      reclassDate,
      scope,
      reclassType,
      payorType,
      sourceAccountId: sourceAccount?.id || sourceAccountId,
      targetAccountId,
      sourcePayorId,
      targetPayorId,
      basisType,
      basisValue,
      loadedSourceId,
      amount: normalizedAmount,
      remarks,
      sourceTransactionNo: loadedSource?.transactionNo || '-',
      sourcePayor: loadedSource?.payor || sourcePayor?.name || '-',
      sourceAccountName: sourceAccount ? `${sourceAccount.code} - ${sourceAccount.name}` : '-',
      targetAccountName: targetAccount ? `${targetAccount.code} - ${targetAccount.name}` : '-',
      createdBy: drafts.find(item => item.id === activeDraftId)?.createdBy || userName,
      createdAt: drafts.find(item => item.id === activeDraftId)?.createdAt || now,
      updatedAt: now,
    };

    setDrafts(prev => activeDraftId
      ? prev.map(item => item.id === activeDraftId ? draft : item)
      : [draft, ...prev]);
    setActiveDraftId(draft.id);
    onNotify?.('success', 'Reclassification draft saved locally. It has not been posted to the journal.');
  };

  const requestPost = () => {
    if (!validateReclassification('posting')) {
      return;
    }
    setShowPostConfirm(true);
  };

  const handlePost = async () => {
    const posted = await onPostJournal(buildEntry(), buildJournalLines());
    if (posted) {
      setPostedEntry(posted);
      setStatus('POSTED');
      setDrafts(prev => prev.filter(item => item.id !== activeDraftId));
      setActiveDraftId('');
      setShowPostConfirm(false);
      onNotify?.('success', 'Reclassification posted successfully.');
    }
  };

  const resetForm = () => {
    setReclassNo(getNextReclassNo(drafts));
    setStatus('DRAFT');
    setReclassDate(todayKey());
    setScope('AR');
    setReclassType('AR_TO_AR');
    setPayorType('SPONSOR');
    setSourceAccountId('');
    setTargetAccountId('');
    setSourcePayorId('');
    setTargetPayorId('');
    setBasisType('TRANSACTION_NO');
    setBasisValue('');
    setLoadedSourceId('');
    setAmount(0);
    setRemarks('');
    setPostedEntry(null);
    setActiveDraftId('');
    setShowPostConfirm(false);
  };

  const loadDraft = (draft: ReclassificationDraft) => {
    setReclassNo(draft.reclassNo);
    setStatus('DRAFT');
    setReclassDate(draft.reclassDate);
    setScope(draft.scope);
    setReclassType(draft.reclassType);
    setPayorType(draft.payorType);
    setSourceAccountId(draft.sourceAccountId);
    setTargetAccountId(draft.targetAccountId);
    setSourcePayorId(draft.sourcePayorId);
    setTargetPayorId(draft.targetPayorId);
    setBasisType(draft.basisType);
    setBasisValue(draft.basisValue);
    setLoadedSourceId(draft.loadedSourceId);
    setAmount(draft.amount);
    setRemarks(draft.remarks);
    setPostedEntry(null);
    setActiveDraftId(draft.id);
  };

  const previewDebitTarget = isSourceDebitBalance;

  return (
    <div
      className="space-y-4 pb-10 font-sans text-slate-800"
      style={{
        '--reclass-brand': brandColor,
        '--reclass-brand-soft': brandTint(0.08),
        '--reclass-brand-line': brandTint(0.18),
      } as React.CSSProperties}
    >
      <style>{`
        .field-input {
          height: 42px;
          width: 100%;
          border-radius: 4px;
          border: 1px solid #f3f4f6;
          background: #f9fafb;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 700;
          color: #1f2937;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
        }
        .field-input:focus {
          border-color: var(--reclass-brand-line);
          background: #fff;
          box-shadow: 0 0 0 4px var(--reclass-brand-soft);
        }
        .field-input:disabled {
          background: #f8fafc;
          color: #64748b;
        }
        .field-textarea {
          min-height: 54px;
          width: 100%;
          border-radius: 4px;
          border: 1px solid #f3f4f6;
          background: #f9fafb;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #1f2937;
          outline: none;
          resize: vertical;
        }
        .field-textarea:focus {
          border-color: var(--reclass-brand-line);
          background: #fff;
          box-shadow: 0 0 0 4px var(--reclass-brand-soft);
        }
        .reclass-section-title {
          color: var(--reclass-brand);
        }
        .segmented-active {
          color: var(--reclass-brand);
        }
        .segmented-active-dot {
          border-color: var(--reclass-brand);
          background: var(--reclass-brand-soft);
        }
      `}</style>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tighter">New Reclassification</h2>
            <span className="text-xl font-semibold text-slate-900 tracking-tighter">{reclassNo}</span>
            <span className="rounded px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: brandTint(0.1), color: brandColor }}>{status}</span>
          </div>
          <p className="mt-1 text-sm italic font-medium text-slate-500">Transfer balances between accounts, customers, and classifications with a clear audit trail.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={resetForm} className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-3 text-xs font-bold shadow-sm">
              <RotateCcw size={18} />
            </button>
            <button type="button" onClick={handleSave} disabled={status === 'POSTED'} className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-4 text-xs font-bold shadow-sm disabled:opacity-50">
              <Save size={18} /> Save
            </button>
            <button type="button" onClick={requestPost} disabled={status === 'POSTED'} className="inline-flex h-10 items-center gap-2 rounded px-5 text-xs font-bold text-white shadow-sm disabled:opacity-50" style={{ backgroundColor: brandColor }}>
              <FileText size={18} /> Post Reclassification
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-4 text-xs font-bold shadow-sm">
              <Printer size={18} /> Print
            </button>
            <button type="button" onClick={resetForm} disabled={status === 'POSTED'} className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-4 text-xs font-bold shadow-sm disabled:opacity-50">
              <X size={18} /> Cancel
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: brandColor }}>Draft Reclassifications</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Saved drafts stay in this workspace and are posted to the journal only after confirmation.</p>
          </div>
          <span className="rounded px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: brandTint(0.1), color: brandColor }}>{drafts.length} Draft{drafts.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead className="bg-gray-50 text-xs uppercase text-slate-500">
              <tr>
                {['Reclass No.', 'Date', 'Scope', 'Source Transaction', 'Payor', 'From Account', 'To Account', 'Amount', 'Status', 'Last Updated', 'Action'].map(label => (
                  <th key={label} className="px-4 py-3 text-left font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drafts.length > 0 ? drafts.map(draft => (
                <tr key={draft.id} className={`font-semibold ${activeDraftId === draft.id ? 'bg-slate-50' : 'bg-white'}`}>
                  <td className="px-4 py-3 font-bold text-slate-900">{draft.reclassNo}</td>
                  <td className="px-4 py-3 text-slate-600">{draft.reclassDate}</td>
                  <td className="px-4 py-3 text-slate-600">{draft.scope}</td>
                  <td className="px-4 py-3 text-slate-700">{draft.sourceTransactionNo}</td>
                  <td className="px-4 py-3 text-slate-600">{draft.sourcePayor}</td>
                  <td className="max-w-[210px] truncate px-4 py-3 text-slate-600">{draft.sourceAccountName}</td>
                  <td className="max-w-[210px] truncate px-4 py-3 text-slate-600">{draft.targetAccountName}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(draft.amount)}</td>
                  <td className="px-4 py-3"><span className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: brandTint(0.1), color: brandColor }}>{draft.status}</span></td>
                  <td className="px-4 py-3 text-slate-500">{new Date(draft.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => loadDraft(draft)} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold shadow-sm" style={{ color: brandColor }}>
                      Open
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">No draft reclassifications yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="reclass-section-title mb-4 text-sm font-bold uppercase">Reclassification Information</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Field label="Reclass. No."><input value={reclassNo} readOnly className="field-input" /></Field>
              <Field label="Reclassification Scope" required>
                <Segmented
                  options={[['AR', 'AR Reclassification'], ['GL', 'GL Reclassification']]}
                  value={scope}
                  onChange={value => setScope(value as Scope)}
                />
              </Field>
              <Field label="From Account (Source)" required>
                <select value={sourceAccount?.id || sourceAccountId} onChange={event => setSourceAccountId(event.target.value)} className="field-input">
                  <option value="">Select source account</option>
                  {selectableAccounts.map(account => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </Field>
              <Field label="Reclass. Date" required><input type="date" value={reclassDate} onChange={event => setReclassDate(event.target.value)} className="field-input" /></Field>
              <Field label="Reclassification Type" required>
                <select value={reclassType} onChange={event => setReclassType(event.target.value as ReclassType)} className="field-input">
                  <option value="AR_TO_AR">AR to AR (Customer Transfer)</option>
                  <option value="ACCOUNT_TRANSFER">Account Transfer</option>
                  <option value="CUSTOMER_TRANSFER">Customer / Payor Correction</option>
                  <option value="CLASSIFICATION_CORRECTION">Classification Correction</option>
                </select>
              </Field>
              <Field label="To Account (Target)" required>
                <select value={targetAccountId} onChange={event => setTargetAccountId(event.target.value)} className="field-input">
                  <option value="">Select target account</option>
                  {selectableAccounts.map(account => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </Field>
              <Field label="Post Period"><input value={formatPostPeriod(reclassDate)} readOnly className="field-input" /></Field>
              <Field label="Payor Type" required>
                <select value={payorType} onChange={event => setPayorType(event.target.value as 'SPONSOR' | 'STUDENT')} disabled={scope === 'GL'} className="field-input">
                  <option value="SPONSOR">Sponsor</option>
                  <option value="STUDENT">Student</option>
                </select>
              </Field>
              <Field label="GL Reference No.">
                <div className="flex h-[42px] items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 text-xs font-bold" style={{ color: brandColor }}>
                  <span>{postedEntry?.glEntryNumber || loadedSource?.glRefNo || 'Pending'}</span>
                  {postedEntry && onViewJournal && (
                    <button type="button" onClick={() => onViewJournal(postedEntry.id)} className="text-xs font-bold" style={{ color: brandColor }}>View Journal Entry</button>
                  )}
                </div>
              </Field>
              <Field label="Status"><div className="field-input flex items-center"><span className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: brandTint(0.1), color: brandColor }}>{status}</span></div></Field>
              <Field label="Payor" required>
                <select value={sourcePayorId} onChange={event => setSourcePayorId(event.target.value)} disabled={scope === 'GL'} className="field-input">
                  <option value="">Select payor</option>
                  {payors.map(payor => <option key={payor.id} value={payor.id}>{payor.name}</option>)}
                </select>
              </Field>
              <Field label="Remarks / Explanation" required>
                <textarea value={remarks} onChange={event => setRemarks(event.target.value.slice(0, 500))} className="field-textarea" placeholder="Explain the reclassification reason." />
                <div className="text-right text-xs font-bold text-slate-500">{remarks.length} / 500</div>
              </Field>
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="reclass-section-title mb-4 text-sm font-bold uppercase">Basis of Reclassification</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,440px)_190px]">
              <Field label="Basis Type" required>
                <Segmented
                  options={[['TRANSACTION_NO', 'Transaction No.'], ['TRANSACTION_TYPE', 'Transaction Type'], ['GL_REFERENCE_NO', 'GL Reference No.']]}
                  value={basisType}
                  onChange={value => setBasisType(value as BasisType)}
                />
              </Field>
              <Field label="Transaction No." required>
                <div className="relative">
                  <input value={basisValue} onChange={event => setBasisValue(event.target.value)} className="field-input pr-10" placeholder="INV-2026-00005" />
                  <Search size={16} className="absolute right-3 top-3.5" style={{ color: brandColor }} />
                </div>
              </Field>
              <button type="button" onClick={loadTransaction} className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded border border-gray-200 bg-white px-4 text-xs font-bold shadow-sm">
                <Search size={16} /> Load Transaction
              </button>
            </div>
            {basisValue && matchingCandidates.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {matchingCandidates.slice(0, 4).map(candidate => (
                  <button key={candidate.line.id} type="button" onClick={() => {
                    setLoadedSourceId(candidate.line.id);
                    setSourceAccountId(candidate.account.id);
                    setSourcePayorId(candidate.contactId || '');
                    setAmount(Math.abs(candidate.balance));
                  }} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-gray-50">
                    {candidate.transactionNo} - {formatCurrency(Math.abs(candidate.balance))}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="reclass-section-title mb-4 text-sm font-bold uppercase">Source Transaction to Reclassify</h3>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-[980px] w-full text-xs">
                <thead className="bg-gray-50 text-xs uppercase" style={{ color: brandColor }}>
                  <tr>
                    {['Transaction No.', 'Transaction Type', 'GL Ref No.', 'Date', 'Original Account', 'Payor', 'Description', 'Debit', 'Credit', 'Current Balance'].map(label => (
                      <th key={label} className="px-3 py-3 text-left font-bold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadedSource ? (
                    <tr className="font-semibold">
                      <td className="px-3 py-3">{loadedSource.transactionNo}</td>
                      <td className="px-3 py-3">{loadedSource.transactionType}</td>
                      <td className="px-3 py-3">{loadedSource.glRefNo}</td>
                      <td className="px-3 py-3">{loadedSource.date}</td>
                      <td className="px-3 py-3">{loadedSource.originalAccount}</td>
                      <td className="px-3 py-3">{loadedSource.payor}</td>
                      <td className="px-3 py-3">{loadedSource.description}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(loadedSource.debit)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(loadedSource.credit)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(Math.abs(loadedSource.balance))}</td>
                    </tr>
                  ) : (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400">Load a transaction to begin reclassification.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_280px]">
              <Field label="Reclass Amount" required>
                <input type="number" min="0" max={maxAmount || undefined} value={amount || ''} onChange={event => setAmount(Number(event.target.value))} className="field-input text-right" />
                <div className="mt-1 text-xs font-semibold text-slate-500">Max. amount: {formatCurrency(maxAmount)}</div>
              </Field>
              <Field label="New Account (Target)" required>
                <select value={targetAccountId} onChange={event => setTargetAccountId(event.target.value)} className="field-input">
                  <option value="">Select target account</option>
                  {selectableAccounts.map(account => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
                <div className="mt-2 text-xs font-semibold text-slate-500">Account Description</div>
                <div className="text-xs font-bold">{targetAccount?.name || '-'}</div>
              </Field>
              <div className="rounded-md border p-4" style={{ borderColor: brandTint(0.22), backgroundColor: brandTint(0.08) }}>
                <div className="text-xs font-bold" style={{ color: brandColor }}>Balance After Reclass</div>
                <div className="mt-3 text-xl font-bold" style={{ color: brandColor }}>{formatCurrency(balanceAfterReclass)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="reclass-section-title mb-4 text-sm font-bold uppercase">Reclassification Summary</h3>
            <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-md border border-gray-200 md:grid-cols-4">
              <SummaryTile label="Original Amount" amount={maxAmount} currency={currency} brandColor={brandColor} brandTint={brandTint} />
              <SummaryTile label="Current Balance" amount={maxAmount} currency={currency} brandColor={brandColor} brandTint={brandTint} />
              <SummaryTile label="Reclass Amount" amount={normalizedAmount} currency={currency} brandColor={brandColor} brandTint={brandTint} />
              <SummaryTile label="Balance After Reclass" amount={balanceAfterReclass} currency={currency} brandColor={brandColor} brandTint={brandTint} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <h3 className="reclass-section-title text-sm font-bold uppercase">Reclassification Preview</h3>
              <Info size={17} style={{ color: brandColor }} />
            </div>
            <table className="w-full text-xs">
              <thead className="text-xs uppercase">
                <tr>
                  <th className="py-3 text-left">GL Account</th>
                  <th className="py-3 text-right">Debit</th>
                  <th className="py-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="border-y border-gray-200">
                <tr>
                  <td className="py-4 pr-3 font-bold">{targetAccount ? `${targetAccount.code} - ${targetAccount.name}` : 'Target account'}<div className="mt-1 font-semibold text-slate-500">(New Account)</div></td>
                  <td className="py-4 text-right font-bold">{formatCurrency(previewDebitTarget ? normalizedAmount : 0)}</td>
                  <td className="py-4 text-right font-bold">{formatCurrency(previewDebitTarget ? 0 : normalizedAmount)}</td>
                </tr>
                <tr>
                  <td className="py-4 pr-3 font-bold">{sourceAccount ? `${sourceAccount.code} - ${sourceAccount.name}` : 'Source account'}<div className="mt-1 font-semibold text-slate-500">(Original Account)</div></td>
                  <td className="py-4 text-right font-bold">{formatCurrency(previewDebitTarget ? 0 : normalizedAmount)}</td>
                  <td className="py-4 text-right font-bold">{formatCurrency(previewDebitTarget ? normalizedAmount : 0)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="py-4 font-bold">TOTAL</td>
                  <td className="py-4 text-right font-bold">{formatCurrency(normalizedAmount)}</td>
                  <td className="py-4 text-right font-bold" style={{ color: brandColor }}>{formatCurrency(normalizedAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <Notice tone="brand" title="The entry is balanced." body="Total Debit equals Total Credit." icon={<CheckCircle2 size={28} />} brandColor={brandColor} brandTint={brandTint} />
          <Notice tone="brand" title="This reclassification will transfer balance from the source account to the target account." body="No impact to income or expense accounts unless a P&L account is selected." icon={<Info size={28} />} brandColor={brandColor} brandTint={brandTint} />
          <Notice tone="warning" title="Important" body="Once posted, this reclassification cannot be edited. You may reverse the reclassification if needed." icon={<AlertTriangle size={28} />} />
        </aside>
      </div>

      {showPostConfirm && (
        <ModalPortal>
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-md border border-white/10 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: brandTint(0.12), color: brandColor }}>
                  <FileText size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold text-slate-900 tracking-tighter">Post Reclassification?</h3>
                  <p className="mt-1 text-sm italic font-medium text-slate-500">This will create the journal entry and remove the item from draft reclassifications.</p>
                </div>
              </div>
              <div className="mt-5 rounded-md border border-gray-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Reclass No.</div>
                    <div className="mt-1 font-bold text-slate-900">{reclassNo}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Amount</div>
                    <div className="mt-1 font-bold text-slate-900">{formatCurrency(normalizedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Source</div>
                    <div className="mt-1 truncate font-bold text-slate-900">{sourceAccount ? `${sourceAccount.code} - ${sourceAccount.name}` : '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Target</div>
                    <div className="mt-1 truncate font-bold text-slate-900">{targetAccount ? `${targetAccount.code} - ${targetAccount.name}` : '-'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowPostConfirm(false)} className="h-10 rounded border border-gray-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm">
                  Cancel
                </button>
                <button type="button" onClick={handlePost} className="h-10 rounded px-5 text-xs font-bold text-white shadow-sm" style={{ backgroundColor: brandColor }}>
                  Confirm Post
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label} {required && <span className="text-red-500">*</span>}</div>
    {children}
  </label>
);

const Segmented: React.FC<{ options: Array<[string, string]>; value: string; onChange: (value: string) => void }> = ({ options, value, onChange }) => (
  <div className="flex h-[42px] overflow-hidden rounded border border-gray-200 bg-white">
    {options.map(([optionValue, label]) => (
      <button
        key={optionValue}
        type="button"
        onClick={() => onChange(optionValue)}
        className={`flex flex-1 items-center justify-center gap-2 px-3 text-xs font-bold ${value === optionValue ? 'segmented-active' : 'text-slate-600'}`}
      >
        <span className={`h-3.5 w-3.5 rounded-full border-2 ${value === optionValue ? 'segmented-active-dot' : 'border-slate-400'}`}></span>
        {label}
      </button>
    ))}
  </div>
);

const SummaryTile: React.FC<{ label: string; amount: number; currency: string; brandColor: string; brandTint: (opacity: number) => string }> = ({ label, amount, currency, brandColor, brandTint }) => {
  return (
    <div className="flex items-center gap-3 border-r border-gray-200 p-4 last:border-r-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: brandTint(0.12), color: brandColor }}>
        <FileText size={17} />
      </div>
      <div>
        <div className="text-xs font-bold text-slate-600">{label}</div>
        <div className="mt-1.5 text-base font-bold text-slate-900">{currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="mt-1 text-xs font-bold" style={{ color: brandColor }}>(Debit)</div>
      </div>
    </div>
  );
};

const Notice: React.FC<{ tone: 'brand' | 'warning'; title: string; body: string; icon: React.ReactNode; brandColor?: string; brandTint?: (opacity: number) => string }> = ({ tone, title, body, icon, brandColor = '#0b8f4d', brandTint = () => 'rgba(11,143,77,0.08)' }) => {
  const styles = tone === 'warning' ? 'border-orange-200 bg-orange-50 text-orange-600' : '';
  const brandStyle = tone === 'brand'
    ? { borderColor: brandTint(0.22), backgroundColor: brandTint(0.08), color: brandColor }
    : undefined;
  return (
    <div className={`rounded-md border p-4 ${styles}`} style={brandStyle}>
      <div className="flex items-start gap-4">
        <div className="mt-1">{icon}</div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <p className="mt-2 text-xs font-semibold leading-5">{body}</p>
        </div>
      </div>
    </div>
  );
};

export default ReclassificationView;
