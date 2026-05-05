
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChartOfAccount, Student, Trainer, Sponsor, Batch, NonStockItem,
  JournalLine, JournalEntry, AccountClass, Qualification, Invoice, Payment
} from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { AccountingService } from '../accountingService';
import { X, Plus, Trash2, AlertCircle, Save, CheckCircle2, RotateCcw, CheckCircle, Printer, CornerUpLeft, Scissors, FileSpreadsheet } from 'lucide-react';

interface JournalFormProps {
  accounts: ChartOfAccount[];
  students: Student[];
  trainers: Trainer[];
  sponsors: Sponsor[];
  batches: Batch[];
  items: NonStockItem[];
  qualifications: Qualification[];
  entries: JournalEntry[];
  payments?: Payment[];
  entryToEdit?: JournalEntry;
  linesToEdit?: JournalLine[];
  mode?: 'new' | 'edit' | 'view';
  onSubmit: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onReverse?: () => void | Promise<void>;
  onClose: () => void;
}

const getWriteOffReferenceNo = (entry: Partial<JournalEntry>): string => {
  const reference = String(entry.reference || '').trim();
  const sourceType = String(entry.sourceType || '').toUpperCase();
  const description = String(entry.description || '').toUpperCase();
  const isWriteOff =
    /^WO-\d{4}-\d+/i.test(reference) ||
    ((sourceType === 'MANUAL' || sourceType === 'JOURNAL') &&
      (
        description.includes('[WRITE OFF]') ||
        description.includes('WRITE-OFF') ||
        description.includes('WRITE OFF')
      ));

  return isWriteOff ? reference : '';
};

const getCreditDebitMemoReferenceNo = (entry: Partial<JournalEntry>): string => {
  const reference = String(entry.reference || '').trim();
  const sourceType = String(entry.sourceType || '').toUpperCase();
  const description = String(entry.description || '').toUpperCase();
  const isCreditDebitMemo =
    /^((CM|DM)-\d{4}-\d+|(CDM|DBM)-)/i.test(reference) ||
    sourceType === 'CREDIT_MEMO' ||
    description.includes('CREDIT MEMO') ||
    description.includes('DEBIT MEMO');

  return isCreditDebitMemo ? reference : '';
};

const JournalForm: React.FC<JournalFormProps> = ({
  accounts = [], students = [], trainers = [], sponsors = [], batches = [], items = [], qualifications = [], entries = [], payments = [], entryToEdit, linesToEdit, mode = 'new', onSubmit, onReverse, onClose
}) => {
  const brandColor = '#F47721';
  const buildEmptyEntry = (): Partial<JournalEntry> => ({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    sourceType: 'JOURNAL',
    status: 'ON_HOLD'
  });

  const [entry, setEntry] = useState<Partial<JournalEntry>>(buildEmptyEntry());

  useEffect(() => {
    if (mode !== 'new') return;
    const nextRef = AccountingService.getNextReference(entries, 'JV');
    setEntry(prev => ({ ...prev, reference: nextRef }));
  }, [mode, entries]);

  useEffect(() => {
    if (mode !== 'new' && entryToEdit) {
      const editedEntry = { ...entryToEdit, displaySourceRef: entryToEdit.sourceRef };
      setEntry(editedEntry);
      setLines((linesToEdit || []).map(l => ({ ...l })));
      setControlTotal((linesToEdit || []).reduce((sum, l) => sum + (l.debit || 0), 0));
    }
  }, [mode, entryToEdit, linesToEdit]);

  const [displaySourceRef, setDisplaySourceRef] = useState('');
  const dataService = DataServiceFactory.getService();
  const isViewMode = mode === 'view';
  const normalizedStatus = String(entry.status || '').toUpperCase();
  const isReversalEntry = String(entry.sourceType || '').toUpperCase() === 'REVERSAL' || Boolean(entry.originalEntryId);
  const hasExistingReversal = Boolean(entry.id && entries.some(existingEntry => existingEntry.originalEntryId === entry.id));
  const canReverseViewedEntry = isViewMode && Boolean(entry.id) && normalizedStatus === 'POSTED' && !isReversalEntry && !hasExistingReversal;
  const writeOffReferenceNo = useMemo(() => getWriteOffReferenceNo(entry), [entry.reference, entry.sourceType, entry.description]);
  const creditDebitMemoReferenceNo = useMemo(() => getCreditDebitMemoReferenceNo(entry), [entry.reference, entry.sourceType, entry.description]);

  const getQualificationCodeById = (qualificationId?: string) => {
    const id = String(qualificationId || '').trim();
    if (!id) return '';
    if (id === '0000-0000') return '0000-0000';
    if (id === DEFAULT_RECEIVABLE_CLASSIFICATION_CODE) return DEFAULT_RECEIVABLE_CLASSIFICATION_CODE;
    return qualifications.find(q => q.id === id)?.code || '';
  };

  const DEFAULT_RECEIVABLE_CLASSIFICATION_CODE = '00000-00000';

  const isDefaultClassificationAccount = (account?: ChartOfAccount | null): boolean =>
    !!account && !account.isHeader && account.class !== AccountClass.REVENUE && account.class !== AccountClass.EXPENSE;

  const resolveClassificationCodeForAccount = (line: Partial<JournalLine> & { qualificationId?: string }, account?: ChartOfAccount | null): string => {
    if (!account) {
      return String((line as any).classificationCode || '').trim();
    }

    if (isDefaultClassificationAccount(account)) {
      return DEFAULT_RECEIVABLE_CLASSIFICATION_CODE;
    }

    if (account.class === AccountClass.REVENUE || account.class === AccountClass.EXPENSE) {
      const selectedQualId = String((line as any).qualificationId || account.qualificationId || '').trim();
      const selectedQualCode = getQualificationCodeById(selectedQualId);
      if (selectedQualCode) return selectedQualCode;

      const existingCode = String((line as any).classificationCode || '').trim();
      if (existingCode && existingCode !== DEFAULT_RECEIVABLE_CLASSIFICATION_CODE) {
        return existingCode;
      }
      return '';
    }

    return String((line as any).classificationCode || '').trim();
  };

  const formatClassificationCode = (code: string, account?: ChartOfAccount | null): string => {
    if (isDefaultClassificationAccount(account)) {
      return `${DEFAULT_RECEIVABLE_CLASSIFICATION_CODE} (Default)`;
    }
    return code;
  };

  useEffect(() => {
    const loadDisplayRef = async () => {
      const sourceType = String(entry.sourceType || '').toUpperCase();
      if (sourceType === 'REVERSAL') {
        const originalEntry = entries.find(existingEntry =>
          String(existingEntry.id || '').trim() === String(entry.originalEntryId || '').trim()
        );
        const originalReferenceNo = String(
          originalEntry?.glEntryNumber || originalEntry?.reference || entry.sourceRef || ''
        ).trim();
        setDisplaySourceRef(originalReferenceNo);
        return;
      }

      if (sourceType === 'PAYMENT') {
        const paymentJournalRef = String(entry.reference || '').trim();
        const sourcePaymentId = String(entry.sourceRef || '').trim();
        const payment = payments.find(p =>
          (sourcePaymentId && String(p.id || '').trim() === sourcePaymentId) ||
          (String(p.journalEntryId || '').trim() === String(entry.id || '').trim()) ||
          (paymentJournalRef && String(p.glEntryNumber || '').trim() === paymentJournalRef)
        );
        if (payment?.paymentNo) {
          setDisplaySourceRef(payment.paymentNo);
          return;
        }
        if (/^PAY-/i.test(paymentJournalRef)) {
          setDisplaySourceRef(paymentJournalRef);
          return;
        }
        setDisplaySourceRef(sourcePaymentId || paymentJournalRef);
        return;
      }

      if (sourceType === 'APPLICATION') {
        const applicationReferenceNo = String(entry.reference || '').trim();
        setDisplaySourceRef(applicationReferenceNo || String(entry.sourceRef || '').trim());
        return;
      }

      const writeOffReferenceNo = getWriteOffReferenceNo(entry);
      if (writeOffReferenceNo) {
        setDisplaySourceRef(writeOffReferenceNo);
        return;
      }

      const creditDebitMemoReferenceNo = getCreditDebitMemoReferenceNo(entry);
      if (creditDebitMemoReferenceNo) {
        setDisplaySourceRef(creditDebitMemoReferenceNo);
        return;
      }

      if (!entry.sourceRef || sourceType !== 'INVOICE') {
        setDisplaySourceRef('');
        return;
      }
      try {
        const invoice = await dataService.getInvoiceById(entry.sourceRef);
        setDisplaySourceRef(invoice?.invoiceNo || entry.sourceRef);
      } catch (error) {
        console.error('Error loading invoice number:', error);
        setDisplaySourceRef(entry.sourceRef);
      }
    };
    loadDisplayRef();
  }, [entry.sourceRef, entry.reference, entry.sourceType, entry.id, entry.originalEntryId, entries, payments]);

  const buildDefaultLines = (): Partial<JournalLine>[] => ([]);

  const [lines, setLines] = useState<Partial<JournalLine>[]>(buildDefaultLines());

  const [controlTotal, setControlTotal] = useState<number>(0);

  const resetForm = () => {
    setEntry(buildEmptyEntry());
    const nextRef = AccountingService.getNextReference(entries, 'JV');
    setEntry(prev => ({ ...prev, reference: nextRef }));
    setLines(buildDefaultLines());
    setControlTotal(0);
  };

  const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0), [lines]);
const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0), [lines]);

  const formatAmount = (value: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;
  const canPost = isBalanced;

  // Line items table drag/resize/order state (mirror Invoice line items behavior)
  const defaultLineColOrder = [
    'lineNumber', 'accountNo', 'account', 'description', 'class', 'debit', 'credit', 'actions'
  ];
  const [lineColOrder, setLineColOrder] = useState<string[]>(defaultLineColOrder);
  const [draggedLineColIdx, setDraggedLineColIdx] = useState<number | null>(null);
  const [lineColWidths, setLineColWidths] = useState<Record<string, number>>({});
  const lineResizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  const exportLineItemsToExcel = () => {
    if (lines.length === 0) {
      alert('No line items to export.');
      return;
    }

    const esc = (v: any) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const sourceType = String(entry.sourceType || '').toUpperCase();
    const sourceIsInvoice = sourceType === 'INVOICE';

    const rows = lines.map((line, idx) => {
      const account = accounts.find(a => a.id === line.accountId);
      const invoiceClassCode = (line as any).classificationCode?.trim() || '';
      const resolvedClassCode = resolveClassificationCodeForAccount(line, account);
      const displayClassCode = resolvedClassCode
        ? formatClassificationCode(resolvedClassCode, account)
        : (isDefaultClassificationAccount(account) ? `${DEFAULT_RECEIVABLE_CLASSIFICATION_CODE} (Default)` : 'None');
      return {
        '#': idx + 1,
        'Account No.': account?.code || '',
        'Account': account ? `${account.code} - ${account.name}` : '',
        'Transaction Description': line.memo || '',
        'Class': displayClassCode || '',
        'Debit Amount': Number(line.debit) || 0,
        'Credit Amount': Number(line.credit) || 0,
      };
    });

    const headers = ['#', 'Account No.', 'Account', 'Transaction Description', 'Class', 'Debit Amount', 'Credit Amount'];

    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:\"#,##0.00\"}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      headers.forEach(h => {
        const val = (r as any)[h];
        const isNum = typeof val === 'number';
        const value = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Journal_Line_Items_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addLine = () => {
    setLines(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      accountId: '',
      debit: 0,
      credit: 0,
      memo: '',
      contactId: '',
      contactType: 'OTHER',
      batchId: '',
      itemId: ''
    }]);
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<JournalLine> & { qualificationId?: string }) => {
    setLines(lines.map(l => {
      if (l.id !== id) return l;
      
      const newLine = { ...l, ...updates };
      const account = accounts.find(a => a.id === newLine.accountId);
      if (Object.prototype.hasOwnProperty.call(updates, 'qualificationId')) {
        const qualificationId = String((updates as any).qualificationId || '').trim();
        (newLine as any).qualificationId = qualificationId;
        (newLine as any).classificationCode = resolveClassificationCodeForAccount(newLine, account);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'accountId')) {
        if (isDefaultClassificationAccount(account)) {
          (newLine as any).qualificationId = '';
        }
        (newLine as any).classificationCode = resolveClassificationCodeForAccount(newLine, account);
      }

      if (!Object.prototype.hasOwnProperty.call(updates, 'qualificationId') && !Object.prototype.hasOwnProperty.call(updates, 'accountId')) {
        (newLine as any).classificationCode = resolveClassificationCodeForAccount(newLine, account);
      }

      if (updates.itemId) {
        const item = items.find(i => i.id === updates.itemId);
        if (item) {
          // Use expenseAccountId for debits (expenses/purchases), incomeAccountId for credits (revenue)
          newLine.accountId = newLine.debit > 0 ? item.expenseAccountId : item.incomeAccountId;
          const acc = accounts.find(a => a.id === newLine.accountId);
          if (acc?.class === AccountClass.REVENUE) {
            newLine.credit = item.unitPrice;
            newLine.debit = 0;
          } else if (acc?.class === AccountClass.ASSET) {
            newLine.debit = item.unitPrice;
            newLine.credit = 0;
          }
          if (!newLine.memo) newLine.memo = item.name;
        }
      }

      if (updates.batchId) {
        const batch = batches.find(b => b.id === updates.batchId);
        if (batch) {
          if (batch.sponsorId) {
            newLine.contactType = 'SPONSOR';
            newLine.contactId = batch.sponsorId;
          } else {
            newLine.contactType = 'STUDENT';
            newLine.contactId = ''; 
          }
        }
      }

      return newLine;
    }));
  };

  const finalizeSubmit = (status: JournalEntry['status']) => {
    if (!canPost) return;

    const entryId = entry.id || `je-${Date.now()}`;
    const finalizedLines: JournalLine[] = lines.map(l => ({
      id: l.id || `l-${Math.random().toString(36).substr(2, 9)}`,
      journalEntryId: entryId,
      accountId: l.accountId!,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || entry.description,
      contactId: l.contactId,
      contactType: l.contactType,
      batchId: l.batchId,
      itemId: l.itemId,
      qualificationId: (() => {
        const account = accounts.find(a => a.id === l.accountId);
        if (isDefaultClassificationAccount(account)) return '';
        return (l as any).qualificationId || account?.qualificationId || '';
      })(),
      classificationCode: resolveClassificationCodeForAccount(l, accounts.find(a => a.id === l.accountId))
    } as JournalLine & { qualificationId?: string; classificationCode?: string }));

    onSubmit({ ...entry, id: entryId, status, createdAt: entry.createdAt || new Date().toISOString() }, finalizedLines);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    finalizeSubmit(entry.status || 'DRAFT');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col w-full min-h-[calc(100vh-12rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between p-4 border-b" style={{ backgroundColor: `${brandColor}10` }}>
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {mode === 'edit'
                ? `Edit Journal Entry: ${(entry.glEntryNumber || entry.reference || '').trim()}`
                : mode === 'view'
                  ? `Journal Entry Details: ${(entry.glEntryNumber || entry.reference || '').trim()}`
                  : 'New Journal Entry'}
            </h3>
            <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider mt-1">{writeOffReferenceNo || creditDebitMemoReferenceNo || displaySourceRef || entry.sourceRef || ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
          <button
            title={isViewMode ? 'Close Journal Entry' : 'Discard Changes and Close'}
            onClick={onClose}
            type="button"
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <RotateCcw size={20} />
          </button>
          {!isViewMode && (
            <>
              <button
                title="Save as Draft"
                onClick={() => finalizeSubmit('ON_HOLD')}
                type="button"
                disabled={!canPost}
                className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={20} />
              </button>
              <button
                title="Approve"
                onClick={() => finalizeSubmit('POSTED')}
                type="button"
                disabled={!canPost}
                className="p-2 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle size={20} />
              </button>
              <button
                title="Add New Record"
                onClick={resetForm}
                type="button"
                className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Plus size={20} />
              </button>
            </>
          )}
          <button
            title={isViewMode ? 'Close Journal Entry' : 'Cancel'}
            onClick={onClose}
            type="button"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
          <div className="h-6 w-px bg-gray-200 mx-2" />
          <button
            title={
              !isViewMode
                ? 'Reverse'
                : canReverseViewedEntry
                  ? 'Reverse Journal Entry'
                  : hasExistingReversal
                    ? 'This journal entry has already been reversed'
                    : normalizedStatus !== 'POSTED'
                      ? 'Only posted journal entries can be reversed'
                      : 'Reversal is not available for this journal entry'
            }
            type="button"
            onClick={() => {
              if (!canReverseViewedEntry) return;
              void onReverse?.();
            }}
            disabled={!canReverseViewedEntry}
            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CornerUpLeft size={20} />
          </button>
          <button
            title="Print"
            type="button"
            onClick={() => alert('Print coming soon...')}
            className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Printer size={20} />
          </button>
          <button
            title={isViewMode ? 'Reclassify Journal Entry' : 'Reclassify'}
            type="button"
            onClick={() => alert('Reclassify coming soon...')}
            className="p-2 text-gray-500 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
          >
            <Scissors size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Transaction Date</label>
              <input
                type="date"
                required
                disabled={isViewMode}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                value={entry.date}
                onChange={e => setEntry({...entry, date: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Journal Voucher No.</label>
              <input
                readOnly={mode !== 'new'}
                className={`w-full mt-1 px-3 py-2 border rounded-lg text-gray-900 ${mode !== 'new' ? 'bg-gray-50' : ''}`}
                value={(entry.glEntryNumber || entry.reference || '').trim()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Reference No.</label>
              <input
                  readOnly
                  className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-900"
                  value={writeOffReferenceNo || creditDebitMemoReferenceNo || displaySourceRef || entry.sourceRef || ''}
                  title={writeOffReferenceNo
                    ? 'Write-Off Number from journal entry reference.'
                    : creditDebitMemoReferenceNo
                    ? 'Credit/Debit Memo Number from journal entry reference.'
                    : String(entry.sourceType || '').toUpperCase() === 'PAYMENT'
                    ? 'payment_no from payments.id = sourceRef (UUID). Shows Payment No.'
                    : String(entry.sourceType || '').toUpperCase() === 'APPLICATION'
                      ? 'Payment Application Number from journal entry reference.'
                      : 'invoice_no from invoices.id = sourceRef (UUID). Shows formatted #INV-XXXXX'}
                />           
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Transaction Description</label>
              <input
                required
                placeholder="Transaction Description"
                disabled={isViewMode}
                className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                value={entry.description}
                onChange={e => setEntry({...entry, description: e.target.value})}
              />
            </div>
                        <div className="flex items-end gap-6 col-span-4">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Post Period</label>
                            <input
                              type="text"
                              className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200"
                              value={(() => {
                                // MM-YYYY formatting
                                if (entry.date) {
                                  const d = new Date(entry.date);
                                  if (!isNaN(d.getTime())) {
                                    return `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                  }
                                }
                                return '';
                              })()}
                              readOnly
                            />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Debit Total</label>
                            <input
                              readOnly
                              className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-900"
                              value={totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Credit Total</label>
                            <input
                              readOnly
                              className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-900"
                              value={totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <label className="text-xs font-medium text-gray-500">Status</label>
                            <select
                              disabled
                              className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-900"
                              value={(entry.status || 'DRAFT') === 'DRAFT' ? 'ON_HOLD' : (entry.status as string)}
                            >
                              <option value="POSTED">POSTED</option>
                              <option value="ON_HOLD">ON HOLD</option>
                              <option value="REVERSED">REVERSED</option>
                            </select>
                          </div>
                        </div>
   <input type="hidden" value={controlTotal || ''} />
          </div>
          {!isBalanced && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[13px] font-medium">
              <AlertCircle size={16} />
              Debit Total and Credit Total must be balanced before you can save or post.
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">Line Items</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportLineItemsToExcel}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                >
                  <FileSpreadsheet size={16} /> Export Line Items
                </button>
                {!isViewMode && (
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-dashed hover:bg-gray-50"
                  >
                    <Plus size={16} /> Add Line
                  </button>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm" style={{ fontFamily: 'Arial, sans-serif', fontSize: 'var(--app-text-size-13)' }}>
                <thead className="bg-gray-50">
                  <tr>
                        {(() => {
                      const lineColDefs = {
                        lineNumber: { key: 'lineNumber', label: '#', align: 'text-left', width: 40 },
                        accountNo: { key: 'accountNo', label: 'Account No.', align: 'text-left', width: 120 },
                        account: { key: 'account', label: 'Account *', align: 'text-left', width: 200 },
                        description: { key: 'description', label: 'Transaction Description', align: 'text-left', width: 220 },
                        class: { key: 'class', label: 'Class', align: 'text-left', width: 120 },
                        debit: { key: 'debit', label: 'Debit Amount', align: 'text-right', width: 130 },
                        credit: { key: 'credit', label: 'Credit Amount', align: 'text-right', width: 130 },
                        actions: { key: 'actions', label: '', align: 'text-center', width: 40 },
                      };

                      return lineColOrder.map((colKey, idx) => {
                        const col = lineColDefs[colKey as keyof typeof lineColDefs];
                        return (
                          <th
                            key={col.key}
                            className={`px-3 py-2 ${col.align} relative select-none ${draggedLineColIdx === idx ? 'bg-gray-100 border-dashed border-2 border-gray-300 opacity-50' : ''}`}
                            style={lineColWidths[col.key] ? { width: lineColWidths[col.key], minWidth: lineColWidths[col.key] } : { minWidth: col.width, width: col.width }}
                            draggable={!isViewMode && col.key !== 'actions'}
                            onDragStart={e => {
                              if (isViewMode || col.key === 'actions') return;
                              setDraggedLineColIdx(idx);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedLineColIdx(null)}
                            onDragOver={e => {
                              if (isViewMode || col.key === 'actions') return;
                              e.preventDefault();
                            }}
                            onDrop={e => {
                              if (isViewMode || col.key === 'actions' || draggedLineColIdx === null || draggedLineColIdx === idx) return;
                              e.preventDefault();
                              const newOrder = [...lineColOrder];
                              const [draggedKey] = newOrder.splice(draggedLineColIdx, 1);
                              newOrder.splice(idx, 0, draggedKey);
                              setLineColOrder(newOrder);
                              setDraggedLineColIdx(null);
                            }}
                            title={!isViewMode && col.key !== 'actions' ? 'Drag to reorder column' : undefined}
                          >
                          <div className="flex items-center">
                            <span>{col.label}</span>
                              {!isViewMode && col.key !== 'actions' && (
                                <div
                                  onMouseDown={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const th = e.currentTarget.parentElement?.parentElement;
                                    if (!th) return;
                                    const startWidth = th.getBoundingClientRect().width;
                                    lineResizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                                    const onMouseMove = (ev: MouseEvent) => {
                                      if (!lineResizeRef.current) return;
                                      const diff = ev.clientX - lineResizeRef.current.startX;
                                      const newWidth = Math.max(40, lineResizeRef.current.startWidth + diff);
                                      setLineColWidths(prev => ({ ...prev, [lineResizeRef.current!.colKey]: newWidth }));
                                    };
                                    const onMouseUp = () => {
                                      lineResizeRef.current = null;
                                      document.removeEventListener('mousemove', onMouseMove);
                                      document.removeEventListener('mouseup', onMouseUp);
                                      document.body.style.cursor = '';
                                      document.body.style.userSelect = '';
                                    };
                                    document.addEventListener('mousemove', onMouseMove);
                                    document.addEventListener('mouseup', onMouseUp);
                                    document.body.style.cursor = 'col-resize';
                                    document.body.style.userSelect = 'none';
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-orange-400 transition-colors z-10"
                                  title="Drag to resize column"
                                  draggable={false}
                                />
                              )}
                            </div>
                          </th>
                        );
                      });
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={lineColOrder.length} className="px-3 py-8 text-center text-gray-400">
                        No line items. Click "Add Line" to add items.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, idx) => {
                      const account = accounts.find(a => a.id === line.accountId);
                      return (
                        <tr key={line.id || idx} className="border-t">
                          {lineColOrder.map(colKey => {
                            let qualCode = '';
                            let qualId = '';
                            const invoiceClassCode = (line as any).classificationCode?.trim() || '';
                            const invoiceQualId = invoiceClassCode
                              ? qualifications.find(q => q.code === invoiceClassCode)?.id || ''
                              : '';
                            const sourceType = String(entry.sourceType || '').toUpperCase();
                            const sourceIsInvoice = sourceType === 'INVOICE';
                            const fallbackClassCode = isDefaultClassificationAccount(account) ? DEFAULT_RECEIVABLE_CLASSIFICATION_CODE : '';
                            const defaultSelectClassCode = isDefaultClassificationAccount(account)
                              ? DEFAULT_RECEIVABLE_CLASSIFICATION_CODE
                              : '0000-0000';
                            const isBalanceSheetAccount = isDefaultClassificationAccount(account);
                            if (line.accountId) {
                              const acc = accounts.find(a => a.id === line.accountId);
                              if (acc) {
                                if (isDefaultClassificationAccount(acc)) {
                                  qualCode = DEFAULT_RECEIVABLE_CLASSIFICATION_CODE;
                                } else if (acc.class === AccountClass.REVENUE || acc.class === AccountClass.EXPENSE) {
                                  qualId = (line as any).qualificationId || acc.qualificationId || '';
                                  const qual = qualifications.find(q => q.id === qualId);
                                  qualCode = qual?.code || '';
                                } else {
                                  qualCode = '0000-0000';
                                }
                              }
                            }
                            const displayClassCode = sourceIsInvoice
                              ? (invoiceClassCode || fallbackClassCode)
                                ? formatClassificationCode(invoiceClassCode || fallbackClassCode, account)
                                : 'None'
                              : formatClassificationCode(invoiceClassCode || qualCode || fallbackClassCode || '0000-0000', account);
                            switch (colKey) {
                              case 'lineNumber':
                                return <td key={colKey} className="px-3 py-2 text-gray-400">{idx + 1}</td>;
                              case 'accountNo':
                                return <td key={colKey} className="px-3 py-2 text-gray-700">{account?.code || '—'}</td>;
                              case 'account':
                                return (
                                  <td key={colKey} className="px-3 py-2">
                                    <select
                                      value={line.accountId || ''}
                                      disabled={isViewMode}
                                      onChange={e => updateLine(line.id!, { accountId: e.target.value })}
                                      className="w-full px-2 py-1 rounded text-[13px] font-normal text-gray-700 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                                    >
                                      <option value="">-- Select --</option>
                                      {accounts.filter(a => !a.isHeader).map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              case 'description':
                                return (
                                  <td key={colKey} className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={line.memo || ''}
                                      disabled={isViewMode}
                                      onChange={e => updateLine(line.id!, { memo: e.target.value })}
                                      className="w-full px-2 py-1 rounded text-[13px] font-normal text-gray-700 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                                    />
                                  </td>
                                );
                              case 'class':
                                return (
                                  <td key={colKey} className="px-3 py-2">
                                    {isViewMode || isBalanceSheetAccount ? (
                                      <span className="inline-flex min-h-[28px] w-full items-center rounded bg-gray-50 px-2 py-1 text-[13px] font-normal text-gray-700">
                                        {displayClassCode}
                                      </span>
                                    ) : (
                                      <select
                                        value={sourceIsInvoice
                                          ? (invoiceQualId || qualId || defaultSelectClassCode)
                                          : (qualId || defaultSelectClassCode)}
                                        disabled={sourceIsInvoice ? false : qualCode === defaultSelectClassCode}
                                        onChange={e => updateLine(line.id!, { qualificationId: e.target.value })}
                                        className="w-full px-2 py-1 rounded text-[13px] font-normal text-gray-700 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                                      >
                                        <option value={defaultSelectClassCode}>
                                          {defaultSelectClassCode === DEFAULT_RECEIVABLE_CLASSIFICATION_CODE ? '00000-00000 (Default)' : '0000-0000'}
                                        </option>
                                        {qualifications.map(q => (
                                          <option key={q.id} value={q.id}>{q.code}</option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                );
                              case 'debit':
                                return (
                                  <td key={colKey} className="px-3 py-2 text-right">
                                    <div className="flex items-center gap-1 justify-end">
                                      <span className="text-[13px] font-normal text-gray-500">₱</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9,]*"
                                        value={formatAmount(Number(line.debit) || 0)}
                                        disabled={isViewMode}
                                        onChange={e => updateLine(line.id!, { debit: parseFloat(e.target.value.replace(/,/g, '')) || 0, credit: 0 })}
                                        className="w-full px-2 py-1 rounded text-right text-[13px] font-normal text-gray-700 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </td>
                                );
                              case 'credit':
                                return (
                                  <td key={colKey} className="px-3 py-2 text-right">
                                    <div className="flex items-center gap-1 justify-end">
                                      <span className="text-[13px] font-normal text-gray-500">₱</span>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9,]*"
                                        value={formatAmount(Number(line.credit) || 0)}
                                        disabled={isViewMode}
                                        onChange={e => updateLine(line.id!, { credit: parseFloat(e.target.value.replace(/,/g, '')) || 0, debit: 0 })}
                                        className="w-full px-2 py-1 rounded text-right text-[13px] font-normal text-gray-700 disabled:bg-gray-50 disabled:text-gray-700 disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </td>
                                );
                              case 'actions':
                                return (
                                  <td key={colKey} className="px-3 py-2 text-center">
                                    {!isViewMode && (
                                      <button
                                        type="button"
                                        onClick={() => removeLine(line.id!)}
                                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </td>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </form>
    </div>
  );
};

export default JournalForm;
