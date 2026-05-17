import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  CornerUpLeft,
  Download,
  FileSpreadsheet,
  Printer,
  Plus,
  RotateCcw,
  Save,
  Search
} from 'lucide-react';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  Sponsor,
  Student,
  Invoice,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass,
  Organization,
  User
} from '../types';

interface ARCreditDebitMemoViewProps {
  orgId: string;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  invoices?: Invoice[];
  users?: User[];
  currency: string;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onSaveJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onUpdateJournal?: (entryId: string, entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onApproveJournal?: (entryId: string, referenceOverride?: string) => void | Promise<void>;
  onReverseJournal?: (entryId: string) => void | Promise<JournalEntry | null>;
  onViewJournal?: (journalEntryId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  organization?: Organization;
  brandColor?: string;
}

type MemoType = 'CREDIT' | 'DEBIT';
type ViewMode = 'LIST' | 'FORM';
type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';
type CustomerFilter = 'ALL' | 'SPONSOR' | 'STUDENT';
type MemoStatusFilter = 'ALL' | 'DRAFT' | 'POSTED' | 'REVERSED';

const ARCreditDebitMemoView: React.FC<ARCreditDebitMemoViewProps> = ({
  orgId,
  entries,
  lines,
  accounts,
  students,
  sponsors,
  invoices = [],
  users = [],
  currency,
  onPostJournal,
  onSaveJournal,
  onUpdateJournal,
  onApproveJournal,
  onReverseJournal,
  onViewJournal,
  onNotify,
  organization,
  brandColor = '#4f46e5'
}) => {
  const today = new Date().toISOString().split('T')[0];
  const getNextReference = (type: MemoType) => {
    const prefix = type === 'CREDIT' ? 'CM' : 'DM';
    const year = new Date().getFullYear();
    const sequence = entries.reduce((max, entry) => {
      const ref = String(entry.reference || '').trim();
      const match = ref.match(new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i'));
      return match ? Math.max(max, Number(match[1] || 0)) : max;
    }, 0) + 1;
    return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
  };

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [memoType, setMemoType] = useState<MemoType>('CREDIT');
  const [memoDate, setMemoDate] = useState(today);
  const [reference, setReference] = useState('');
  const [viewingRecordId, setViewingRecordId] = useState('');
  const [customerType, setCustomerType] = useState<'SPONSOR' | 'STUDENT'>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(0);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [invoiceMemoAmounts, setInvoiceMemoAmounts] = useState<Record<string, number>>({});
  const [arAccountId, setArAccountId] = useState('');
  const [offsetAccountId, setOffsetAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemoStatusFilter>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerFilter>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const isViewingExistingRecord = Boolean(viewingRecordId);

  useEffect(() => {
    if (isViewingExistingRecord) return;
    setReference(getNextReference(memoType));
  }, [entries, memoType, isViewingExistingRecord]);

  useEffect(() => {
    if (isViewingExistingRecord) return;
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }

    const defaultAr =
      accounts.find(a => a.code === '1200' && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id ||
      accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader)?.id;
    if (defaultAr) setArAccountId(defaultAr);
  }, [accounts, customerType, customerId, sponsors, isViewingExistingRecord]);

  useEffect(() => {
    if (isViewingExistingRecord) return;
    if (memoType === 'CREDIT') {
      const preferred = accounts.find(a =>
        a.class === AccountClass.REVENUE &&
        !a.isHeader &&
        (
          (a.name || '').toLowerCase().includes('sales return') ||
          (a.name || '').toLowerCase().includes('allowance') ||
          (a.name || '').toLowerCase().includes('contra')
        )
      )?.id;

      if (preferred) {
        setOffsetAccountId(preferred);
        return;
      }
    }

    const fallback =
      accounts.find(a => a.class === AccountClass.REVENUE && !a.isHeader)?.id ||
      accounts.find(a => a.class === AccountClass.EXPENSE && !a.isHeader)?.id;
    if (fallback) setOffsetAccountId(fallback);
  }, [accounts, memoType, isViewingExistingRecord]);

  const customerName = useMemo(() => {
    if (!customerId) return '';
    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }
    const student = students.find(x => x.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

  const arAccountIds = useMemo(
    () => new Set(
      accounts
        .filter(a =>
          a.class === AccountClass.ASSET &&
          !a.isHeader &&
          ((a.name || '').toLowerCase().includes('receivable') || a.code === '1200')
        )
        .map(a => a.id)
    ),
    [accounts]
  );

  const brandTint = (opacity: number) => {
    const normalized = brandColor.trim();
    const match = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return `rgb(249 250 251 / ${opacity})`;
    const [, r, g, b] = match;
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
  };

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const selectedMemoAmount = useMemo(
    () => Array.from(selectedInvoiceIds).reduce((sum, invoiceId) => sum + Number(invoiceMemoAmounts[invoiceId] || 0), 0),
    [invoiceMemoAmounts, selectedInvoiceIds]
  );

  const formMemoAmount = selectedMemoAmount > 0 ? selectedMemoAmount : amount;

  const selectedInvoiceCount = selectedInvoiceIds.size;

  const eligibleInvoices = useMemo(() => {
    if (!customerId) return [];

    return invoices
      .filter(invoice => {
        const matchesPayor =
          customerType === 'SPONSOR'
            ? invoice.sponsorId === customerId
            : invoice.studentId === customerId;
        return matchesPayor && invoice.status !== 'VOIDED' && Number(invoice.balanceDue || 0) > 0;
      })
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [customerId, customerType, invoices]);

  const getInvoiceArAccountId = (invoice?: Invoice) => {
    if (!invoice) return '';
    const entryIds = [invoice.journalEntryId, invoice.glEntryNumber].filter(Boolean);
    const invoiceLines = lines.filter(line =>
      entryIds.includes(line.journalEntryId) ||
      line.journalEntryId === invoice.id ||
      line.memo === invoice.invoiceNo
    );
    return invoiceLines.find(line => arAccountIds.has(line.accountId))?.accountId || '';
  };

  const getInvoiceRevenueAccountId = (invoice?: Invoice) => {
    if (!invoice) return '';
    const fromInvoiceLine = invoice.lines?.find(line => line.glAccountId)?.glAccountId;
    if (fromInvoiceLine) return fromInvoiceLine;

    const entryIds = [invoice.journalEntryId, invoice.glEntryNumber].filter(Boolean);
    const invoiceLines = lines.filter(line => entryIds.includes(line.journalEntryId));
    return invoiceLines.find(line => line.credit > 0 && !arAccountIds.has(line.accountId))?.accountId || '';
  };

  const getAccountLabel = (accountId?: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '-';
  };

  const selectedInvoices = useMemo(
    () => invoices.filter(invoice => selectedInvoiceIds.has(invoice.id)),
    [invoices, selectedInvoiceIds]
  );

  const displayedInvoices = useMemo(() => {
    if (!isViewingExistingRecord) return eligibleInvoices;
    const combined = [...selectedInvoices, ...eligibleInvoices];
    return combined.filter((invoice, index, list) => list.findIndex(item => item.id === invoice.id) === index);
  }, [eligibleInvoices, isViewingExistingRecord, selectedInvoices]);

  useEffect(() => {
    if (isViewingExistingRecord) return;
    const firstSelectedInvoice = selectedInvoices[0] || eligibleInvoices[0];
    const invoiceArAccount = getInvoiceArAccountId(firstSelectedInvoice);
    const invoiceRevenueAccount = getInvoiceRevenueAccountId(firstSelectedInvoice);

    if (invoiceArAccount) setArAccountId(invoiceArAccount);
    if (invoiceRevenueAccount) setOffsetAccountId(invoiceRevenueAccount);
  }, [eligibleInvoices, isViewingExistingRecord, selectedInvoices]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${month}-${day}-${parsed.getFullYear()}`;
  };

  const formatPostPeriod = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return `${String(parsed.getMonth() + 1).padStart(2, '0')}-${parsed.getFullYear()}`;
  };

  const getMemoStatusLabel = (status?: string) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'POSTED') return 'POSTED';
    if (normalized === 'REVERSED') return 'REVERSED';
    return 'DRAFT';
  };

  const getEntryGlReference = (entry: JournalEntry) => {
    const ref = String(entry.glEntryNumber || (entry as any).gl_entry_number || '').trim();
    if (!ref) return '-';
    const match = ref.match(/^GL(?:\s*No\.?)?[\s-]*(\d+)$/i);
    return match ? `GL${match[1].padStart(8, '0')}` : ref;
  };

  const getInvoiceReference = (entry: JournalEntry) => {
    const sourceRef = String(entry.sourceRef || '').trim();
    const descriptionRef = String(entry.description || '').match(/INV-\d{4}-\d{5}/i)?.[0] || '';
    const sourceTokens = sourceRef
      .split(',')
      .map(token => token.trim())
      .filter(Boolean);

    const resolvedInvoiceNos = sourceTokens
      .map(token => {
        const invoice = invoices.find(item =>
          item.id === token ||
          item.invoiceNo === token ||
          item.glEntryNumber === token ||
          item.journalEntryId === token
        );
        if (invoice?.invoiceNo) return invoice.invoiceNo;
        return /^INV-\d{4}-\d{5}$/i.test(token) ? token : '';
      })
      .filter(Boolean);

    if (resolvedInvoiceNos.length > 0) return resolvedInvoiceNos.join(', ');
    return descriptionRef || '-';
  };

  const getInvoiceIdsFromEntry = (entry: JournalEntry) => {
    const sourceTokens = String(entry.sourceRef || '')
      .split(',')
      .map(token => token.trim())
      .filter(Boolean);

    return sourceTokens
      .map(token => invoices.find(item =>
        item.id === token ||
        item.invoiceNo === token ||
        item.glEntryNumber === token ||
        item.journalEntryId === token
      )?.id)
      .filter((id): id is string => Boolean(id));
  };

  const getCreatedByLabel = (createdBy?: string) => {
    const creatorId = String(createdBy || '').trim();
    if (!creatorId) return '-';
    if (creatorId.toLowerCase() === 'system') return 'System';

    const user = users.find(item =>
      item.id === creatorId ||
      item.email === creatorId ||
      item.name === creatorId
    );
    return user?.name || user?.email || creatorId;
  };

  const getCustomerBalanceAfter = (recordDate: string, contactId?: string, contactType?: string) => {
    if (!contactId || (contactType !== 'SPONSOR' && contactType !== 'STUDENT')) return 0;
    const postedEntryIds = new Set(
      entries
        .filter(entry => entry.status === 'POSTED' && entry.date <= recordDate)
        .map(entry => entry.id)
    );

    return lines
      .filter(line =>
        postedEntryIds.has(line.journalEntryId) &&
        arAccountIds.has(line.accountId) &&
        line.contactId === contactId &&
        line.contactType === contactType
      )
      .reduce((sum, line) => sum + (Number(line.debit || 0) - Number(line.credit || 0)), 0);
  };

  const customerBalance = useMemo(() => {
    if (!customerId) return 0;
    return getCustomerBalanceAfter(memoDate, customerId, customerType);
  }, [customerId, customerType, memoDate, entries, lines, arAccountIds]);

  const balanceAfterMemo = memoType === 'CREDIT'
    ? Math.max(customerBalance - formMemoAmount, 0)
    : customerBalance + formMemoAmount;

  const memoEntries = useMemo(() => {
    return entries
      .filter(e =>
        ['DRAFT', 'ON_HOLD', 'POSTED', 'REVERSED', 'REVISION_REQUESTED'].includes(e.status) &&
        ((e.reference || '').match(/^(CM|DM|CDM|DBM)-/) ||
          (e.description || '').toUpperCase().includes('CREDIT MEMO') ||
          (e.description || '').toUpperCase().includes('DEBIT MEMO'))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  const memoRows = useMemo(() => {
    return memoEntries.map(entry => {
      const arLine = lines.find(line => line.journalEntryId === entry.id && (line.debit > 0 || line.credit > 0) && line.contactId);
      const amountVal = arLine ? Math.abs(arLine.debit - arLine.credit) : 0;
      const referenceText = String(entry.reference || '').toUpperCase();
      const descriptionText = String(entry.description || '').toUpperCase();
      const resolvedMemoType: MemoType =
        referenceText.startsWith('CM-') ||
        referenceText.startsWith('CDM-') ||
        descriptionText.includes('CREDIT MEMO')
          ? 'CREDIT'
          : 'DEBIT';

      let customerLabel = 'Unknown';
      let customerKind: CustomerFilter = 'ALL';
      if (arLine?.contactType === 'SPONSOR') {
        customerKind = 'SPONSOR';
        customerLabel = sponsors.find(s => s.id === arLine.contactId)?.name || 'Unknown Sponsor';
      } else if (arLine?.contactType === 'STUDENT') {
        customerKind = 'STUDENT';
        const student = students.find(s => s.id === arLine.contactId);
        customerLabel = student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
      }

      return {
        entry,
        amount: amountVal,
        memoType: resolvedMemoType,
        statusLabel: getMemoStatusLabel(entry.status),
        postPeriod: formatPostPeriod(entry.date),
        invoiceNo: getInvoiceReference(entry),
        glReference: getEntryGlReference(entry),
        customerLabel,
        customerKind,
        balanceAfter: getCustomerBalanceAfter(entry.date, arLine?.contactId, arLine?.contactType),
        createdBy: getCreatedByLabel(entry.createdBy),
        createdOn: formatDate(entry.createdAt || entry.date)
      };
    });
  }, [lines, memoEntries, sponsors, students, entries, arAccountIds, invoices, users]);

  const filteredMemoRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const todayDate = new Date();
    const currentMonth = todayDate.getMonth();
    const currentYear = todayDate.getFullYear();

    return memoRows.filter(row => {
      const matchesSearch =
        !term ||
        (row.entry.reference || '').toLowerCase().includes(term) ||
        row.invoiceNo.toLowerCase().includes(term) ||
        row.glReference.toLowerCase().includes(term) ||
        (row.entry.description || '').toLowerCase().includes(term) ||
        row.customerLabel.toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'ALL' || row.statusLabel === statusFilter;
      const matchesCustomerType = customerTypeFilter === 'ALL' || row.customerKind === customerTypeFilter;

      const rowDate = new Date(row.entry.date);
      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = row.entry.date === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear;
      } else if (dateFilterMode === 'CUSTOM') {
        const afterFrom = !dateFrom || row.entry.date >= dateFrom;
        const beforeTo = !dateTo || row.entry.date <= dateTo;
        matchesDate = afterFrom && beforeTo;
      }

      return matchesSearch && matchesStatus && matchesCustomerType && matchesDate;
    }).sort((a, b) => {
      const getSortValue = (row: typeof memoRows[number]) => {
        switch (sortConfig.key) {
          case 'date':
            return new Date(row.entry.date).getTime();
          case 'postPeriod': {
            const parsed = new Date(row.entry.date);
            return Number.isNaN(parsed.getTime()) ? 0 : parsed.getFullYear() * 100 + parsed.getMonth() + 1;
          }
          case 'memoNo':
            return row.entry.reference || '';
          case 'type':
            return row.memoType;
          case 'invoiceNo':
            return row.invoiceNo;
          case 'status':
            return row.statusLabel;
          case 'glReference':
            return row.glReference;
          case 'customer':
            return row.customerLabel;
          case 'memoAmount':
            return row.amount;
          case 'balanceAfter':
            return row.balanceAfter;
          case 'createdBy':
            return row.createdBy;
          case 'createdOn':
            return row.entry.createdAt ? new Date(row.entry.createdAt).getTime() : 0;
          default:
            return row.entry.date;
        }
      };

      const valueA = getSortValue(a);
      const valueB = getSortValue(b);
      const comparison =
        typeof valueA === 'string'
          ? valueA.localeCompare(String(valueB))
          : Number(valueA || 0) - Number(valueB || 0);

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [customerTypeFilter, dateFilterMode, dateFrom, dateTo, memoRows, searchTerm, sortConfig, statusFilter, today]);

  const summary = useMemo(() => {
    const totalAmount = filteredMemoRows.reduce((sum, row) => sum + row.amount, 0);
    const draftCount = filteredMemoRows.filter(row => row.statusLabel === 'DRAFT').length;
    const postedCount = filteredMemoRows.filter(row => row.statusLabel === 'POSTED').length;
    const reversedCount = filteredMemoRows.filter(row => row.statusLabel === 'REVERSED').length;
    return {
      count: filteredMemoRows.length,
      draftCount,
      postedCount,
      reversedCount,
      totalAmount
    };
  }, [filteredMemoRows]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedMemoRows,
    setCurrentPage
  } = usePaginatedRows(filteredMemoRows, [searchTerm, statusFilter, customerTypeFilter, dateFilterMode, dateFrom, dateTo, sortConfig]);

  const viewingEntry = entries.find(entry => entry.id === viewingRecordId);
  const formStatusLabel = isViewingExistingRecord ? getMemoStatusLabel(viewingEntry?.status) : 'DRAFT';
  const canUpdateViewingRecord = isViewingExistingRecord && formStatusLabel === 'DRAFT';
  const canPostViewingRecord = canUpdateViewingRecord;
  const canEditMemoForm = !isViewingExistingRecord || canUpdateViewingRecord;
  const formGlReference = viewingEntry ? getEntryGlReference(viewingEntry) : 'Pending on posting';

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency || 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(val || 0));

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    customerTypeFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCustomerTypeFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setShowStatusDropdown(false);
    setShowCustomerDropdown(false);
    setShowDateDropdown(false);
    setShowExportDropdown(false);
  };

  const exportToCsv = () => {
    if (filteredMemoRows.length === 0) {
      onNotify('info', 'No memos to export.');
      return;
    }

    const headers = ['Transaction Date', 'Post Period', 'Memo No.', 'Type', 'Invoice No.', 'Status', 'GL Reference No.', 'Customer', 'Memo Amount', 'Balance After', 'Created By', 'Created On'];
    const csvRows = filteredMemoRows.map(row => [
      formatDate(row.entry.date),
      row.postPeriod,
      row.entry.reference || '-',
      row.memoType,
      row.invoiceNo,
      row.statusLabel,
      row.glReference,
      row.customerLabel,
      row.amount.toFixed(2),
      row.balanceAfter.toFixed(2),
      row.createdBy,
      row.createdOn
    ]);

    const csv = [headers, ...csvRows]
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Credit_Debit_Memos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const TypeBadge = ({ type }: { type: MemoType }) => {
    const isCredit = type === 'CREDIT';
    return (
      <span
        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${
          isCredit ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
        }`}
      >
        {type}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const className =
      status === 'POSTED'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'REVERSED'
          ? 'bg-red-100 text-red-600'
          : 'bg-amber-100 text-amber-700';
    return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${className}`}>{status}</span>;
  };

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={12} className="ml-1 text-emerald-100 opacity-0 transition-opacity group-hover:opacity-100" />;
    }

    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-white" />
      : <ChevronDown size={12} className="ml-1 text-white" />;
  };

  const memoRegistryColumns = [
    { key: 'date', label: 'Transaction Date', sortKey: 'date', align: 'text-left' as const },
    { key: 'postPeriod', label: 'Post Period', sortKey: 'postPeriod', align: 'text-left' as const },
    { key: 'memoNo', label: 'Memo No.', sortKey: 'memoNo', align: 'text-left' as const },
    { key: 'type', label: 'Type', sortKey: 'type', align: 'text-left' as const },
    { key: 'invoiceNo', label: 'Invoice No.', sortKey: 'invoiceNo', align: 'text-left' as const },
    { key: 'status', label: 'Status', sortKey: 'status', align: 'text-left' as const },
    { key: 'glReference', label: 'GL Reference No.', sortKey: 'glReference', align: 'text-left' as const },
    { key: 'customer', label: 'Customer', sortKey: 'customer', align: 'text-left' as const },
    { key: 'memoAmount', label: 'Memo Amount', sortKey: 'memoAmount', align: 'text-right' as const },
    { key: 'balanceAfter', label: 'Balance After', sortKey: 'balanceAfter', align: 'text-right' as const },
    { key: 'createdBy', label: 'Created By', sortKey: 'createdBy', align: 'text-left' as const },
    { key: 'createdOn', label: 'Created On', sortKey: 'createdOn', align: 'text-left' as const }
  ];

  const resetFormState = (nextMemoType: MemoType = memoType) => {
    setMemoType(nextMemoType);
    setMemoDate(today);
    setReference(getNextReference(nextMemoType));
    setViewingRecordId('');
    setCustomerType('SPONSOR');
    setCustomerId('');
    setAmount(0);
    setSelectedInvoiceIds(new Set());
    setInvoiceMemoAmounts({});
    setReason('');
  };

  const openNewForm = () => {
    resetFormState(memoType);
    setViewMode('FORM');
  };

  const handleBackToList = () => {
    resetFormState(memoType);
    setViewMode('LIST');
  };

  const handleNewPostMemo = () => {
    resetFormState(memoType);
    setViewMode('FORM');
  };

  const handleViewJournalEntry = (entry?: JournalEntry | null) => {
    if (!entry || !onViewJournal) return;
    const target = entry.id || entry.glEntryNumber || (entry as any).gl_entry_number || entry.reference;
    if (!target) return;
    onViewJournal(target);
  };

  const openMemoRecord = (row: typeof memoRows[number]) => {
    const entryLines = lines.filter(line => line.journalEntryId === row.entry.id);
    const arLine = entryLines.find(line => line.contactId && arAccountIds.has(line.accountId));
    const offsetLine = entryLines.find(line => line.accountId !== arLine?.accountId && (line.debit > 0 || line.credit > 0));
    const invoiceIds = getInvoiceIdsFromEntry(row.entry);
    const allocationAmounts = invoiceIds.reduce<Record<string, number>>((next, invoiceId, index) => {
      const remaining = Math.max(row.amount - Object.values(next).reduce((sum, value) => sum + value, 0), 0);
      if (remaining <= 0) return next;
      const invoice = invoices.find(item => item.id === invoiceId);
      const currentBalance = Math.max(Number(invoice?.balanceDue || 0), 0);
      next[invoiceId] = index === invoiceIds.length - 1 ? remaining : Math.min(currentBalance || remaining, remaining);
      return next;
    }, {});

    setMemoType(row.memoType);
    setMemoDate(row.entry.date || today);
    setReference(row.entry.reference || '');
    setViewingRecordId(row.entry.id);
    setCustomerType(arLine?.contactType === 'STUDENT' ? 'STUDENT' : 'SPONSOR');
    setCustomerId(arLine?.contactId || '');
    setAmount(row.amount);
    setSelectedInvoiceIds(new Set(invoiceIds));
    setInvoiceMemoAmounts(allocationAmounts);
    setArAccountId(arLine?.accountId || '');
    setOffsetAccountId(offsetLine?.accountId || '');
    setReason(arLine?.memo || offsetLine?.memo || row.entry.description?.replace(/^\[(CREDIT|DEBIT) MEMO\]\s*/i, '').trim() || '');
    setViewMode('FORM');
  };

  const toggleInvoiceSelection = (invoice: Invoice) => {
    if (!canEditMemoForm) return;
    const balance = Math.max(0, Number(invoice.balanceDue || 0));
    const nextSelected = new Set(selectedInvoiceIds);
    const nextAmounts = { ...invoiceMemoAmounts };

    if (nextSelected.has(invoice.id)) {
      nextSelected.delete(invoice.id);
      delete nextAmounts[invoice.id];
    } else {
      nextSelected.add(invoice.id);
      nextAmounts[invoice.id] = balance;
    }

    setSelectedInvoiceIds(nextSelected);
    setInvoiceMemoAmounts(nextAmounts);
    setAmount(Object.values(nextAmounts).reduce((sum, value) => sum + Number(value || 0), 0));
  };

  const handleInvoiceMemoAmountChange = (invoice: Invoice, nextAmount: number) => {
    if (!canEditMemoForm) return;
    const cappedAmount = Math.min(Math.max(0, Number(nextAmount || 0)), Math.max(0, Number(invoice.balanceDue || 0)));
    const nextSelected = new Set(selectedInvoiceIds);
    const nextAmounts = { ...invoiceMemoAmounts, [invoice.id]: cappedAmount };

    if (cappedAmount > 0) {
      nextSelected.add(invoice.id);
    } else {
      nextSelected.delete(invoice.id);
      delete nextAmounts[invoice.id];
    }

    setSelectedInvoiceIds(nextSelected);
    setInvoiceMemoAmounts(nextAmounts);
    setAmount(Object.values(nextAmounts).reduce((sum, value) => sum + Number(value || 0), 0));
  };

  const buildJournalDraft = (status: 'POSTED' | 'ON_HOLD' = 'POSTED') => {
    if (!customerId) { onNotify('error', 'Please select a payor.'); return null; }
    if (!arAccountId) { onNotify('error', 'Please select an Accounts Receivable G/L account.'); return null; }
    if (!offsetAccountId) { onNotify('error', 'Please select a Contra / Revenue account.'); return null; }
    if (selectedInvoiceIds.size === 0) { onNotify('error', 'Please select at least one invoice for memo allocation.'); return null; }
    if (formMemoAmount <= 0) { onNotify('error', 'Total memo amount must be greater than zero.'); return null; }
    if (!reason.trim()) { onNotify('error', 'Please enter the reason / memo.'); return null; }

    const entryId = viewingRecordId || `je-memo-${Date.now()}`;
    const memoReference = reference || getNextReference(memoType);
    const selectedInvoiceIdList = Array.from(selectedInvoiceIds);
    const descPrefix = memoType === 'CREDIT' ? '[CREDIT MEMO]' : '[DEBIT MEMO]';
    const desc = `${descPrefix} ${customerName}${reason ? ` - ${reason}` : ''}`;
    const memoText = reason.trim();

    const journalLines: JournalLine[] = memoType === 'CREDIT'
      ? [
          {
            id: `l-cm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: formMemoAmount,
            credit: 0,
            memo: memoText
          },
          {
            id: `l-cm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: 0,
            credit: formMemoAmount,
            memo: memoText,
            contactId: customerId,
            contactType: customerType
          }
        ]
      : [
          {
            id: `l-dm-dr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: arAccountId,
            debit: formMemoAmount,
            credit: 0,
            memo: memoText,
            contactId: customerId,
            contactType: customerType
          },
          {
            id: `l-dm-cr-${Date.now()}`,
            journalEntryId: entryId,
            orgId,
            accountId: offsetAccountId,
            debit: 0,
            credit: formMemoAmount,
            memo: memoText
          }
        ];

    return {
      entry: {
        id: entryId,
        date: memoDate,
        reference: memoReference,
        description: desc,
        sourceType: 'CREDIT_MEMO',
        sourceRef: selectedInvoiceIdList[0],
        status
      },
      journalLines
    };
  };

  const handleSave = async () => {
    if (isViewingExistingRecord) {
      await handleUpdateMemo();
      return;
    }

    const draft = buildJournalDraft('ON_HOLD');
    if (!draft) return;
    if (!onSaveJournal) {
      onNotify('info', 'Saving memo drafts is not available in this workflow.');
      return;
    }

    const saved = await onSaveJournal(draft.entry, draft.journalLines);
    if (saved !== null) {
      onNotify('success', 'Memo saved as draft.');
      handleBackToList();
    }
  };

  const handleUpdateMemo = async (options: { silent?: boolean } = {}) => {
    if (!viewingRecordId) return null;
    if (!canUpdateViewingRecord) {
      onNotify('info', 'Only draft credit/debit memos can be updated.');
      return null;
    }
    if (!onUpdateJournal) {
      onNotify('info', 'Updating memo drafts is not available in this workflow.');
      return null;
    }

    const draft = buildJournalDraft('ON_HOLD');
    if (!draft) return null;

    const updated = await onUpdateJournal(viewingRecordId, draft.entry, draft.journalLines);
    if (updated !== null) {
      if (!options.silent) onNotify('success', 'Memo draft updated.');
      setReference(updated?.reference || reference);
    }
    return updated;
  };

  const handlePost = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isViewingExistingRecord) {
      if (!canPostViewingRecord) {
        onNotify('info', 'Only draft credit/debit memos can be posted.');
        return;
      }
      if (!onApproveJournal) {
        onNotify('info', 'Posting existing memo drafts is not available in this workflow.');
        return;
      }
      const updated = await handleUpdateMemo({ silent: true });
      if (!updated) return;
      await onApproveJournal(viewingRecordId, reference);
      handleBackToList();
      return;
    }
    const draft = buildJournalDraft('POSTED');
    if (!draft) return;

    const posted = await onPostJournal(draft.entry, draft.journalLines);
    if (posted !== null) {
      setViewingRecordId(posted?.id || '');
      onNotify('success', `${memoType === 'CREDIT' ? 'Credit' : 'Debit'} memo posted to General Ledger.`);
    }
  };

  const handleReverseMemo = async () => {
    if (!viewingRecordId) {
      onNotify('info', 'Open a posted memo before reversing.');
      return;
    }
    if (!onReverseJournal) {
      onNotify('info', 'Memo reversal is not available in this workflow.');
      return;
    }
    await onReverseJournal(viewingRecordId);
    handleBackToList();
  };

  const handlePrintMemo = () => {
    if (formMemoAmount <= 0) {
      onNotify('info', 'Enter a memo amount before printing.');
      return;
    }

    const orgName = organization?.name || 'Credit / Debit Memo Registry';
    const logoUrl = organization?.logoUrl || '';
    const voucherAccent = '#006b2d';
    const memoTitle = memoType === 'CREDIT' ? 'Credit Memo Voucher' : 'Debit Memo Voucher';
    const transactionDescription = reason || (memoType === 'CREDIT' ? 'Credit memo adjustment' : 'Debit memo adjustment');
    const viewingEntry = entries.find(entry => entry.id === viewingRecordId);
    const statusLabel = isViewingExistingRecord ? getMemoStatusLabel(viewingEntry?.status) : 'DRAFT';
    const glReference = viewingEntry ? getEntryGlReference(viewingEntry) : 'Pending on posting';
    const selectedRows = selectedInvoices.length > 0
      ? selectedInvoices
      : displayedInvoices.filter(invoice => selectedInvoiceIds.has(invoice.id));
    const printableInvoiceRows = selectedRows.length > 0
      ? selectedRows.map(invoice => {
          const applied = Number(invoiceMemoAmounts[invoice.id] || 0);
          const balance = Number(invoice.balanceDue || 0);
          const afterMemo = memoType === 'CREDIT' ? Math.max(balance - applied, 0) : balance + applied;
          return {
            invoiceNo: invoice.invoiceNo || invoice.id,
            invoiceDate: formatDate(invoice.invoiceDate),
            description: transactionDescription,
            balanceBefore: balance,
            memoAmount: applied,
            balanceAfter: afterMemo
          };
        })
      : [{
          invoiceNo: 'Unallocated AR balance',
          invoiceDate: '-',
          description: transactionDescription,
          balanceBefore: customerBalance,
          memoAmount: formMemoAmount,
          balanceAfter: balanceAfterMemo
        }];

    const journalRows = memoType === 'CREDIT'
      ? [
          { account: getAccountLabel(offsetAccountId), memo: transactionDescription, debit: formMemoAmount, credit: 0 },
          { account: getAccountLabel(arAccountId), memo: customerName || '-', debit: 0, credit: formMemoAmount }
        ]
      : [
          { account: getAccountLabel(arAccountId), memo: customerName || '-', debit: formMemoAmount, credit: 0 },
          { account: getAccountLabel(offsetAccountId), memo: transactionDescription, debit: 0, credit: formMemoAmount }
        ];

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(memoTitle)}</title><style>
      @page { size: A4; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing:border-box; }
      body { margin: 0; font-family: Inter, "Open Sans", "Segoe UI", Arial, sans-serif; color:#111827; background:#fff; }
      .page { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; overflow: hidden; background:#fff; display:flex; flex-direction:column; }
      .muted, .sub { color:#6b7280; font-size:12px; }
      table { width:100%; border-collapse: collapse; font-size:12px; }
      .band { background:${voucherAccent} !important; color:#fff !important; font-weight:700; }
      .print-box { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:1 1 auto; display:flex; flex-direction:column; }
      .summary { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:18px; }
      .section { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; }
      .section-title { background:${voucherAccent} !important; color:#fff !important; font-size:12px; font-weight:700; text-transform:uppercase; padding:6px 8px; }
      .section-body { padding:8px; }
      .row { display:flex; justify-content:space-between; gap:14px; padding:4px 0; font-size:12px; }
      .row span:first-child { color:#374151; }
      .row span:last-child { font-weight:700; text-align:right; }
      th { padding:6px 8px; text-align:left; font-size:12px; }
      td { padding:6px 8px; border-bottom:1px solid #d1d5db; vertical-align:top; }
      td.num, th.num { text-align:right; white-space:nowrap; }
      .nothing-follows { flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#6b7280; font-size:11px; font-style:italic; letter-spacing:.08em; padding:12px 8px; }
      .journal { margin-top:18px; border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; }
      .signatures { margin-top:18px; display:grid; grid-template-columns:repeat(3,1fr); border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:0 0 auto; }
      .sign-box { min-height:116px; display:flex; flex-direction:column; border-right:1px solid ${voucherAccent}; }
      .sign-box:last-child { border-right:0; }
      .sign-label { padding:10px 12px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .sign-space { flex:1; margin:44px 28px 22px; border-bottom:1px solid #111827; }
      .sign-footer { background:${voucherAccent} !important; color:#fff !important; text-align:center; font-weight:800; padding:7px; font-size:11px; }
      .footer { margin-top:18px; color:#6b7280; font-size:12px; text-align:right; }
      @media print {
        body { background:#fff !important; }
        .band, .section-title, .sign-footer { background:${voucherAccent} !important; color:#fff !important; }
      }
    </style></head><body>
      <div class="page">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
          <div>
            ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Tenant logo" style="max-width:300px;max-height:90px;object-fit:contain;" />` : `<div style="font-size:28px;font-weight:800;">${escapeHtml(orgName)}</div>`}
            <div style="margin-top:8px;font-size:13px;">${escapeHtml(orgName)}</div>
          </div>
          <div style="text-align:left;min-width:330px;">
            <div style="font-size:42px;font-weight:700;line-height:1;margin-bottom:8px;color:${voucherAccent};">${escapeHtml(memoTitle)}</div>
            <table style="font-size:14px;">
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Reference No.:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(reference || '-')}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Date:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(formatDate(memoDate))}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Status:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(statusLabel)}</td></tr>
            </table>
            <div class="muted" style="text-align:right;margin-top:6px;">Printed ${escapeHtml(new Date().toLocaleString('en-US'))}</div>
          </div>
        </div>

        <div class="summary">
          <div class="section">
            <div class="section-title">Memo Information</div>
            <div class="section-body">
              <div class="row"><span>Payor</span><span>${escapeHtml(customerName || '-')}</span></div>
              <div class="row"><span>Payor Type</span><span>${escapeHtml(customerType)}</span></div>
              <div class="row"><span>Memo Type</span><span>${escapeHtml(memoType === 'CREDIT' ? 'Credit Memo' : 'Debit Memo')}</span></div>
              <div class="row"><span>Post Period</span><span>${escapeHtml(formatPostPeriod(memoDate))}</span></div>
              <div class="row"><span>GL Reference No.</span><span>${escapeHtml(glReference)}</span></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Amount Summary</div>
            <div class="section-body">
              <div class="row"><span>Balance Before Memo</span><span>${formatCurrency(customerBalance)}</span></div>
              <div class="row"><span>Memo Amount</span><span>${formatCurrency(formMemoAmount)}</span></div>
              <div class="row"><span>Balance After Memo</span><span>${formatCurrency(balanceAfterMemo)}</span></div>
              <div class="row"><span>Invoices Affected</span><span>${printableInvoiceRows.length}</span></div>
              <div class="row"><span>Effect</span><span>${escapeHtml(memoType === 'CREDIT' ? 'Reduces AR' : 'Increases AR')}</span></div>
            </div>
          </div>
        </div>

        <div class="print-box" style="margin-top:18px;">
          <table>
            <thead>
              <tr class="band">
                <th>Invoice</th>
                <th>Invoice Date</th>
                <th>Transaction Description</th>
                <th class="num">Balance Before</th>
                <th class="num">Memo Amount</th>
                <th class="num">Balance After</th>
              </tr>
            </thead>
            <tbody>
              ${printableInvoiceRows.map(row => `<tr>
                <td>${escapeHtml(row.invoiceNo)}</td>
                <td>${escapeHtml(row.invoiceDate)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td class="num">${formatCurrency(row.balanceBefore)}</td>
                <td class="num">${formatCurrency(row.memoAmount)}</td>
                <td class="num">${formatCurrency(row.balanceAfter)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div class="nothing-follows">*** NOTHING FOLLOWS ***</div>
        </div>

        <div class="journal">
          <div class="section-title">GL Journal Entry Preview</div>
          <table>
            <thead>
              <tr>
                <th>GL Account</th>
                <th>Memo</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              ${journalRows.map(row => `<tr>
                <td>${escapeHtml(row.account)}</td>
                <td>${escapeHtml(row.memo)}</td>
                <td class="num">${row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                <td class="num">${row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
              </tr>`).join('')}
              <tr>
                <td colspan="2" style="font-weight:800;text-align:right;">Total</td>
                <td class="num" style="font-weight:800;">${formatCurrency(formMemoAmount)}</td>
                <td class="num" style="font-weight:800;">${formatCurrency(formMemoAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section" style="margin-top:18px;">
          <div class="section-title">Reason / Memo</div>
          <div class="section-body" style="min-height:42px;">${escapeHtml(transactionDescription)}</div>
        </div>

        <div class="signatures">
          ${['Prepared By:', 'Reviewed By:', 'Approved By:'].map(label => `
            <div class="sign-box">
              <div class="sign-label">${label}</div>
              <div class="sign-space"></div>
              <div class="sign-footer">NAME &amp; SIGNATURE</div>
            </div>
          `).join('')}
        </div>
        <div class="footer">Generated by ${escapeHtml(orgName)}</div>
      </div>
    </body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onNotify('error', 'Please allow popups to print the memo.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Credit / Debit Memo</h2>
              <p className="text-sm text-gray-500 font-normal italic">Adjust customer balances with credit or debit memos.</p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition-all shadow-md font-bold text-sm"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
            >
              <Plus size={16} /> New Memo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Draft</p>
              <p className="mt-3 text-2xl font-bold text-gray-900">{summary.draftCount}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Posted</p>
              <p className="mt-3 text-2xl font-bold text-emerald-600">{summary.postedCount}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reversed</p>
              <p className="mt-3 text-2xl font-bold text-rose-600">{summary.reversedCount}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Memo Amount</p>
              <p className="mt-3 text-2xl font-bold text-emerald-700">{formatCurrency(summary.totalAmount)}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full sm:w-72">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search memos..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowStatusDropdown(prev => !prev)}
                  className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none min-w-[160px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Status:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {statusFilter === 'ALL' ? 'All' : statusFilter}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showStatusDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        {(['ALL', 'DRAFT', 'POSTED', 'REVERSED'] as MemoStatusFilter[]).map(option => (
                          <button
                            key={option}
                            onClick={() => { setStatusFilter(option); setShowStatusDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                              statusFilter === option ? 'font-bold bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {option === 'ALL' ? 'All Statuses' : option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowCustomerDropdown(prev => !prev)}
                  className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[240px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Customer:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {customerTypeFilter === 'ALL' ? 'All' : customerTypeFilter === 'SPONSOR' ? 'Sponsors' : 'Students'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showCustomerDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCustomerDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        {(['ALL', 'SPONSOR', 'STUDENT'] as CustomerFilter[]).map(option => (
                          <button
                            key={option}
                            onClick={() => { setCustomerTypeFilter(option); setShowCustomerDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${customerTypeFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                            style={customerTypeFilter === option ? { backgroundColor: brandColor } : undefined}
                          >
                            {option === 'ALL' ? 'All Customers' : option === 'SPONSOR' ? 'Sponsors' : 'Students'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowDateDropdown(prev => !prev)}
                  className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                >
                  <span className="text-[13px] text-gray-500 mr-1">Date:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                    {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showDateDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="border-b border-gray-100 p-1">
                        <button
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 rounded"
                        >
                          All Dates
                        </button>
                        <button
                          onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'TODAY' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                          style={dateFilterMode === 'TODAY' ? { backgroundColor: brandColor } : undefined}
                        >
                          Today
                        </button>
                        <button
                          onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'THIS_MONTH' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                          style={dateFilterMode === 'THIS_MONTH' ? { backgroundColor: brandColor } : undefined}
                        >
                          This Month
                        </button>
                      </div>

                      <div className="p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowDateDropdown(false)}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDateDropdown(false)}
                            className="px-4 py-1 rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                            style={{ backgroundColor: brandColor }}
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="p-2 text-gray-400 transition-colors"
                style={hasActiveFilters ? { color: brandColor } : undefined}
                title="Clear all filters"
              >
                <RotateCcw size={16} />
              </button>

              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(prev => !prev)}
                  className="flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm select-none"
                >
                  <Download size={16} />
                  <span>Export</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {showExportDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)}></div>
                    <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button
                          onClick={() => { setShowExportDropdown(false); exportToCsv(); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileSpreadsheet size={16} className="text-emerald-600" />
                          Export as CSV
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] font-sans">
              <thead style={{ backgroundColor: brandColor }}>
                <tr>
                  {memoRegistryColumns.map(col => (
                    <th
                      key={col.key}
                      className={`group select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 hover:border-emerald-200 ${col.align}`}
                    >
                      <button
                        type="button"
                        className={`flex w-full items-center text-[13px] font-bold text-white ${col.align === 'text-right' ? 'justify-end' : ''} cursor-pointer hover:text-gray-100`}
                        onClick={() => handleSort(col.sortKey)}
                      >
                        {col.label} <SortIndicator columnKey={col.sortKey} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedMemoRows.map(row => (
                  <tr
                    key={row.entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openMemoRecord(row)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMemoRecord(row);
                      }
                    }}
                    className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{formatDate(row.entry.date)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{row.postPeriod}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: brandColor }}>{row.entry.reference || '-'}</td>
                    <td className="px-4 py-3"><TypeBadge type={row.memoType} /></td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: brandColor }}>{row.invoiceNo}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.statusLabel} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {row.glReference !== '-' && onViewJournal ? (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            handleViewJournalEntry(row.entry);
                          }}
                          className="font-bold hover:underline"
                          style={{ color: brandColor }}
                          title="View Journal Entry"
                        >
                          {row.glReference}
                        </button>
                      ) : (
                        row.glReference
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{row.customerLabel}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold ${row.memoType === 'CREDIT' ? 'text-red-500' : 'text-blue-600'}`}>
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">{formatCurrency(row.balanceAfter)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{row.createdBy}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{row.createdOn}</td>
                  </tr>
                ))}
                {filteredMemoRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-gray-400 italic">No memos found for the current search and filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredMemoRows.length}
              pageStartIndex={pageStartIndex}
              pageEndIndex={pageEndIndex}
              onPageChange={setCurrentPage}
              itemLabel="memos"
            />
          </div>
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[80vh]">
            <div className="px-4 py-4 border-b" style={{ backgroundColor: brandTint(0.08) }}>
              <h3 className="text-xl font-bold text-gray-900">
                {isViewingExistingRecord ? 'Credit / Debit Memo Details' : 'New Credit / Debit Memo'} : {reference}
              </h3>
              <p className="mt-1 text-xs font-medium text-gray-500">Allocate memo amounts to open invoice balances and post one balanced journal entry.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white">
              <button
                type="button"
                title="Discard Changes and Close"
                aria-label="Discard Changes and Close"
                onClick={handleBackToList}
                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <CornerUpLeft size={20} />
              </button>
              <button
                type="button"
                title="New Post Memo"
                aria-label="New Post Memo"
                onClick={handleNewPostMemo}
                className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Plus size={20} /> 
              </button>
              <button
                type="button"
                title={isViewingExistingRecord ? 'Update Memo' : 'Save'}
                aria-label={isViewingExistingRecord ? 'Update Memo' : 'Save'}
                onClick={handleSave}
                disabled={isViewingExistingRecord && !canUpdateViewingRecord}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={20} />
              </button>
              <button
                type="button"
                title="Post Memo"
                aria-label="Post Memo"
                onClick={() => handlePost()}
                disabled={isViewingExistingRecord && !canPostViewingRecord}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-md text-sm font-bold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -14px ${brandColor}` }}
              >
                <CheckCircle size={17} /> Post Memo
              </button>
              <button
                type="button"
                title="Print"
                aria-label="Print"
                onClick={handlePrintMemo}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Printer size={20} />
              </button>
              <button
                type="button"
                title="Reverse"
                aria-label="Reverse"
                onClick={handleReverseMemo}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <RotateCcw size={20} />
              </button>
            </div>

            <form onSubmit={handlePost} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4 p-4">
              <div className="space-y-4 min-w-0">
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="mb-4 text-sm font-bold uppercase text-emerald-700">Memo Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Memo Type *</label>
                      <select className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={memoType} onChange={e => { setMemoType(e.target.value as MemoType); setSelectedInvoiceIds(new Set()); setInvoiceMemoAmounts({}); setAmount(0); }} disabled={!canEditMemoForm}>
                        <option value="CREDIT">Credit Memo</option>
                        <option value="DEBIT">Debit Memo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Memo No.</label>
                      <input className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 font-mono outline-none" value={reference} readOnly />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Post Period</label>
                      <input className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 outline-none" value={formatPostPeriod(memoDate)} readOnly />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Memo Date *</label>
                      <input type="date" className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={memoDate} onChange={e => setMemoDate(e.target.value)} disabled={!canEditMemoForm} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Payor Type *</label>
                      <select className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={customerType} onChange={e => { setCustomerType(e.target.value as 'SPONSOR' | 'STUDENT'); setCustomerId(''); setSelectedInvoiceIds(new Set()); setInvoiceMemoAmounts({}); setAmount(0); }} disabled={!canEditMemoForm}>
                        <option value="SPONSOR">Sponsor</option>
                        <option value="STUDENT">Student</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Payor *</label>
                      <select className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={customerId} onChange={e => { setCustomerId(e.target.value); setSelectedInvoiceIds(new Set()); setInvoiceMemoAmounts({}); setAmount(0); }} disabled={!canEditMemoForm}>
                        <option value="">Select payor...</option>
                        {customerType === 'SPONSOR' && sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        {customerType === 'STUDENT' && students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">AR Account *</label>
                      <select className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={arAccountId} onChange={e => setArAccountId(e.target.value)} disabled={!canEditMemoForm}>
                        <option value="">Select AR account...</option>
                        {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader && ((a.name || '').toLowerCase().includes('receivable') || a.code === '1200')).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Contra / Revenue Account *</label>
                      <select className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={offsetAccountId} onChange={e => setOffsetAccountId(e.target.value)} disabled={!canEditMemoForm}>
                        <option value="">Select account...</option>
                        {accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.EXPENSE) && !a.isHeader).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-xs font-medium text-gray-500">Transaction Description *</label>
                      <input className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={reason} onChange={e => setReason(e.target.value)} disabled={!canEditMemoForm} placeholder="Pricing adjustment or billing correction" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Status</label>
                      <input className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 font-semibold outline-none" value={isViewingExistingRecord ? getMemoStatusLabel(entries.find(e => e.id === viewingRecordId)?.status) : 'DRAFT'} readOnly />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">GL Reference No.</label>
                      <button
                        type="button"
                        disabled={!isViewingExistingRecord || formGlReference === '-' || formGlReference === 'Pending on posting' || !onViewJournal}
                        onClick={() => handleViewJournalEntry(viewingEntry)}
                        className="w-full mt-1 px-3 py-2 border rounded-lg font-semibold flex items-center justify-between gap-3 disabled:cursor-not-allowed disabled:opacity-70"
                        style={{ color: brandColor, borderColor: brandTint(0.32), backgroundColor: brandTint(0.08) }}
                        title={formGlReference !== '-' && formGlReference !== 'Pending on posting' ? 'View Journal Entry' : undefined}
                      >
                        <span className="truncate">{formGlReference}</span>
                        <span className="text-xs whitespace-nowrap">-&gt; View Journal Entry</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="mb-4 text-sm font-bold uppercase text-emerald-700">Memo Allocation To Invoice Balance</h4>
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="w-full min-w-[960px] text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="w-12 px-3 py-2 text-center"></th>
                          <th className="px-3 py-2 text-left">Invoice No.</th>
                          <th className="px-3 py-2 text-left">Invoice Date</th>
                          <th className="px-3 py-2 text-right">Original Amount</th>
                          <th className="px-3 py-2 text-right">Paid Amount</th>
                          <th className="px-3 py-2 text-right">Current Balance</th>
                          <th className="px-3 py-2 text-right">Memo Applied Amount</th>
                          <th className="px-3 py-2 text-right">Balance After Memo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedInvoices.length === 0 ? (
                          <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">Select a payor with open invoice balances.</td></tr>
                        ) : displayedInvoices.map(invoice => {
                          const isSelected = selectedInvoiceIds.has(invoice.id);
                          const originalAmount = Number(invoice.netAmountDue ?? invoice.grandTotal ?? 0);
                          const paidAmount = Number(invoice.amountPaid || 0);
                          const balance = Number(invoice.balanceDue || 0);
                          const applied = Number(invoiceMemoAmounts[invoice.id] || 0);
                          const afterMemo = memoType === 'CREDIT' ? Math.max(balance - applied, 0) : balance + applied;
                          return (
                            <tr key={invoice.id} className={isSelected ? 'bg-emerald-50/40' : undefined}>
                              <td className="px-3 py-2 text-center"><input type="checkbox" checked={isSelected} onChange={() => toggleInvoiceSelection(invoice)} disabled={!canEditMemoForm} className="h-4 w-4 rounded border-gray-300 accent-emerald-600" /></td>
                              <td className="px-3 py-2 font-semibold text-emerald-700">{invoice.invoiceNo}</td>
                              <td className="px-3 py-2 font-medium text-gray-800">{formatDate(invoice.invoiceDate)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(originalAmount)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(paidAmount)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(balance)}</td>
                              <td className="px-3 py-2 text-right"><input type="number" min="0" max={balance} step="0.01" value={invoiceMemoAmounts[invoice.id] ?? 0} onChange={e => handleInvoiceMemoAmountChange(invoice, Number(e.target.value))} disabled={!canEditMemoForm} className="w-36 rounded-md border border-gray-200 px-2 py-1.5 text-right font-semibold outline-none focus:border-brand" /></td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(afterMemo)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={6} className="px-3 py-3 text-right text-sm font-bold uppercase text-slate-600">Total Memo Applied</td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatCurrency(formMemoAmount)}</td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatCurrency(displayedInvoices.reduce((sum, invoice) => selectedInvoiceIds.has(invoice.id) ? sum + (memoType === 'CREDIT' ? Math.max(Number(invoice.balanceDue || 0) - Number(invoiceMemoAmounts[invoice.id] || 0), 0) : Number(invoice.balanceDue || 0) + Number(invoiceMemoAmounts[invoice.id] || 0)) : sum, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-3 rounded-md bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2"><CheckCircle size={16} /> Total memo applied amount is {formatCurrency(formMemoAmount)}.</span>
                    <span>Selected Invoices: {selectedInvoiceCount}</span>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="mb-4 text-sm font-bold uppercase text-emerald-700">Memo Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-xs font-medium text-gray-500">AR Account *</label><input className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 outline-none" value={getAccountLabel(arAccountId)} readOnly /></div>
                    <div><label className="text-xs font-medium text-gray-500">Contra / Revenue Account *</label><input className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 outline-none" value={getAccountLabel(offsetAccountId)} readOnly /></div>
                  </div>
                  <div className="mt-4"><label className="text-xs font-medium text-gray-500">Remarks / Explanation *</label><input className="w-full mt-1 px-3 py-2 border rounded-lg outline-none" value={reason} onChange={e => setReason(e.target.value)} disabled={!canEditMemoForm} placeholder="Adjustment reason, approval, or billing correction details" /></div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                  <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-gray-200"><p className="text-xs font-bold uppercase text-slate-500">Customer Outstanding Balance</p><p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(customerBalance)}</p></div>
                  <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-gray-200"><p className="text-xs font-bold uppercase text-slate-500">Total Memo Applied</p><p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(formMemoAmount)}</p><p className="text-xs font-semibold text-slate-500">Total of {selectedInvoiceCount} invoice(s)</p></div>
                  <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-gray-200"><p className="text-xs font-bold uppercase text-slate-500">Balance After Memo</p><p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(balanceAfterMemo)}</p><p className="text-xs font-semibold text-slate-500">{memoType === 'CREDIT' ? 'Credit memo reduces AR' : 'Debit memo increases AR'}</p></div>
                  <div className="px-5 py-4"><p className="text-xs font-bold uppercase text-slate-500">Invoices Affected</p><p className="mt-1 text-lg font-bold text-gray-900">{selectedInvoiceCount} invoice{selectedInvoiceCount === 1 ? '' : 's'}</p></div>
                </div>
              </div>

              <aside className="rounded-lg border border-gray-200 bg-white p-5 h-fit space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-4">GL Journal Entry Preview</h4>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 text-xs font-bold uppercase text-slate-500 border-b pb-2"><span>GL Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span></div>
                  {memoType === 'CREDIT' ? (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900"><span>{getAccountLabel(offsetAccountId)}</span><span className="text-right">{formatCurrency(formMemoAmount)}</span><span className="text-right">-</span></div>
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900"><span>{getAccountLabel(arAccountId)}</span><span className="text-right">-</span><span className="text-right">{formatCurrency(formMemoAmount)}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900"><span>{getAccountLabel(arAccountId)}</span><span className="text-right">{formatCurrency(formMemoAmount)}</span><span className="text-right">-</span></div>
                      <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900"><span>{getAccountLabel(offsetAccountId)}</span><span className="text-right">-</span><span className="text-right">{formatCurrency(formMemoAmount)}</span></div>
                    </>
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 pt-3 text-sm font-bold text-gray-900"><span>Total</span><span className="text-right">{formatCurrency(formMemoAmount)}</span><span className="text-right">{formatCurrency(formMemoAmount)}</span></div>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Posting this memo will {memoType === 'CREDIT' ? 'reduce Accounts Receivable and recognize a revenue adjustment' : 'increase Accounts Receivable and recognize revenue'} in the General Ledger.
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 flex gap-2">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>Once posted, this memo cannot be edited. You may reverse it if adjustment is needed.</span>
                </div>
              </aside>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default ARCreditDebitMemoView;
