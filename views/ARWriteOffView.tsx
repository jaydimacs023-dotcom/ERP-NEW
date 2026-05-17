import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CornerUpLeft,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search
} from 'lucide-react';
import { AccountingService } from '../accountingService';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  Invoice,
  Sponsor,
  Student,
  JournalEntry,
  JournalLine,
  ChartOfAccount,
  AccountClass,
  Organization,
  User as AppUser
} from '../types';

interface ARWriteOffViewProps {
  orgId: string;
  entries: JournalEntry[];
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  students: Student[];
  sponsors: Sponsor[];
  invoices?: Invoice[];
  users?: AppUser[];
  currency: string;
  onPostJournal: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onSaveJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void | Promise<JournalEntry | null>;
  onApproveJournal?: (entryId: string) => void | Promise<void>;
  onViewJournal?: (journalEntryId: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  initialContext?: { invoice?: Invoice };
  onClearContext?: () => void;
  organization?: Organization;
  brandColor?: string;
}

type CustomerType = 'SPONSOR' | 'STUDENT';
type ViewMode = 'LIST' | 'FORM';
type CustomerTypeFilter = 'ALL' | CustomerType;
type WriteOffStatus = 'ON_HOLD' | 'POSTED' | 'REVERSED';
type WriteOffStatusFilter = 'ALL' | WriteOffStatus;

interface WriteOffRecord {
  entry: JournalEntry;
  amount: number;
  customerId: string;
  customerType: CustomerType | null;
  customerName: string;
  arAccountName: string;
  invoiceNo: string;
  balanceAfter: number;
}

const ARWriteOffView: React.FC<ARWriteOffViewProps> = ({
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
  onApproveJournal,
  onViewJournal,
  onNotify,
  initialContext,
  onClearContext,
  organization,
  brandColor = '#4f46e5'
}) => {
  const today = new Date().toISOString().split('T')[0];
  const getNextReference = () => AccountingService.getNextReference(entries, 'WO');

  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [viewingRecordId, setViewingRecordId] = useState('');
  const [writeOffDate, setWriteOffDate] = useState(today);
  const [reference, setReference] = useState(getNextReference());
  const [customerType, setCustomerType] = useState<CustomerType>('SPONSOR');
  const [customerId, setCustomerId] = useState('');
  const [sourceInvoiceId, setSourceInvoiceId] = useState('');
  const [sourceInvoiceNo, setSourceInvoiceNo] = useState('');
  const [amount, setAmount] = useState(0);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [invoiceWriteOffAmounts, setInvoiceWriteOffAmounts] = useState<Record<string, number>>({});
  const [arAccountId, setArAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<WriteOffStatusFilter>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'date',
    'postPeriod',
    'writeOffNo',
    'invoiceNo',
    'status',
    'glReference',
    'payer',
    'writeOffAmount',
    'balanceAfter',
    'createdBy',
    'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const isViewingExistingRecord = Boolean(viewingRecordId);

  const arAccounts = useMemo(
    () =>
      accounts.filter(
        a =>
          a.class === AccountClass.ASSET &&
          !a.isHeader &&
          ((a.name || '').toLowerCase().includes('receivable') || a.code === '1200')
      ),
    [accounts]
  );

  const expenseAccounts = useMemo(
    () => accounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader),
    [accounts]
  );

  const arAccountIds = useMemo(() => new Set(arAccounts.map(a => a.id)), [arAccounts]);

  const resetFormState = (nextCustomerType: CustomerType = 'SPONSOR') => {
    setWriteOffDate(today);
    setReference(getNextReference());
    setCustomerType(nextCustomerType);
    setCustomerId('');
    setSourceInvoiceId('');
    setSourceInvoiceNo('');
    setViewingRecordId('');
    setAmount(0);
    setSelectedInvoiceIds(new Set());
    setInvoiceWriteOffAmounts({});
    setReason('');
  };

  const openNewForm = () => {
    resetFormState();
    setViewMode('FORM');
  };

  const handleBackToList = () => {
    resetFormState(customerType);
    setViewingRecordId('');
    setViewMode('LIST');
  };

  useEffect(() => {
    if (!initialContext?.invoice) return;

    const { invoice } = initialContext;
    const nextCustomerType: CustomerType = invoice.sponsorId ? 'SPONSOR' : 'STUDENT';

    setViewMode('FORM');
    setWriteOffDate(today);
    setReference(getNextReference());
    setCustomerType(nextCustomerType);
    setCustomerId(invoice.sponsorId || invoice.studentId || '');
    setSourceInvoiceId(invoice.id || '');
    setSourceInvoiceNo(invoice.invoiceNo || '');
    setAmount(Math.max(0, Number(invoice.balanceDue || 0)));
    if (invoice.id) {
      setSelectedInvoiceIds(new Set([invoice.id]));
      setInvoiceWriteOffAmounts({ [invoice.id]: Math.max(0, Number(invoice.balanceDue || 0)) });
    }
    setReason('Write-off of uncollectible balance');

    onClearContext?.();
  }, [initialContext, onClearContext, entries, today]);

  useEffect(() => {
    if (customerType === 'SPONSOR' && customerId) {
      const sponsor = sponsors.find(s => s.id === customerId);
      if (sponsor?.arAccountId) {
        setArAccountId(sponsor.arAccountId);
        return;
      }
    }

    if (arAccounts[0]?.id) {
      setArAccountId(arAccounts[0].id);
    }
  }, [arAccounts, customerType, customerId, sponsors]);

  useEffect(() => {
    const preferred = expenseAccounts.find(
      a =>
        (a.name || '').toLowerCase().includes('bad debt') ||
        (a.name || '').toLowerCase().includes('write off') ||
        (a.name || '').toLowerCase().includes('write-off') ||
        (a.name || '').toLowerCase().includes('doubtful')
    )?.id;

    if (preferred) {
      setExpenseAccountId(preferred);
      return;
    }

    if (expenseAccounts[0]?.id) {
      setExpenseAccountId(expenseAccounts[0].id);
    }
  }, [expenseAccounts]);

  const customerBalance = useMemo(() => {
    if (!customerId) return 0;

    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED' && e.date <= writeOffDate).map(e => e.id));

    return lines
      .filter(
        l =>
          postedEntryIds.has(l.journalEntryId) &&
          arAccountIds.has(l.accountId) &&
          l.contactId === customerId &&
          l.contactType === customerType
      )
      .reduce((sum, l) => sum + (l.debit - l.credit), 0);
  }, [entries, lines, arAccountIds, customerId, customerType, writeOffDate]);

  const customerName = useMemo(() => {
    if (!customerId) return '';

    if (customerType === 'SPONSOR') {
      return sponsors.find(s => s.id === customerId)?.name || '';
    }

    const student = students.find(s => s.id === customerId);
    return student ? `${student.lastName}, ${student.firstName}` : '';
  }, [customerId, customerType, sponsors, students]);

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

  const selectedWriteOffAmount = useMemo(
    () =>
      Array.from(selectedInvoiceIds).reduce(
        (sum, invoiceId) => sum + Number(invoiceWriteOffAmounts[invoiceId] || 0),
        0
      ),
    [invoiceWriteOffAmounts, selectedInvoiceIds]
  );

  const formWriteOffAmount = selectedWriteOffAmount > 0 ? selectedWriteOffAmount : amount;

  const selectedInvoiceCount = selectedInvoiceIds.size;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency || 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(val || 0));

  const brandTint = (opacity: number) => {
    const normalized = brandColor.trim();
    const match = normalized.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return `rgb(249 250 251 / ${opacity})`;
    const [, r, g, b] = match;
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity})`;
  };

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

  const formatCreatedOn = (value?: string) => formatDate(value);

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getCreatedByName = (createdBy?: string) => {
    if (!createdBy) return '-';
    if (createdBy === 'system') return 'System';
    const user = users.find(u => u.id === createdBy);
    return user?.name || user?.email || createdBy;
  };

  const getAccountLabel = (accountId?: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '-';
  };

  const normalizeGlReference = (value?: string) => {
    const ref = String(value || '').trim();
    if (!ref) return '-';
    const match = ref.match(/^GL(?:\s*No\.?)?[\s-]*(\d+)$/i);
    if (!match) return ref.startsWith('GL') ? ref : '-';
    return `GL${match[1].padStart(8, '0')}`;
  };

  const extractGlSequence = (value?: string) => {
    const match = String(value || '').match(/GL(?:\s*No\.?)?[\s-]*(\d+)/i);
    return match ? Number(match[1]) : 0;
  };

  const getEntryGlReference = (entry?: JournalEntry | null) => {
    if (!entry) return '-';
    return normalizeGlReference(
      entry.glEntryNumber ||
      (entry as any).gl_entry_number ||
      (/^GL/i.test(String(entry.reference || '').trim()) ? entry.reference : '')
    );
  };

  const generateNextWriteOffGlReference = () => {
    const maxSequence = entries.reduce(
      (max, entry) => Math.max(
        max,
        extractGlSequence(entry.glEntryNumber || (entry as any).gl_entry_number || entry.reference)
      ),
      0
    );

    return `GL${String(maxSequence + 1).padStart(8, '0')}`;
  };

  const getWriteOffStatusLabel = (status?: string) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'ON_HOLD' || normalized === 'DRAFT') return 'ON HOLD';
    if (normalized === 'REVERSED') return 'REVERSED';
    return 'POSTED';
  };

  const getStatusBadge = (status?: string) => {
    const label = getWriteOffStatusLabel(status);
    const className =
      label === 'POSTED'
        ? 'bg-emerald-100 text-emerald-700'
        : label === 'REVERSED'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-600';
    const title = label === 'POSTED' ? 'Approved transaction posted to the General Ledger' : undefined;
    return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${className}`} title={title}>{label}</span>;
  };

  const getInvoiceForEntry = (entry: JournalEntry) => {
    const source = String(entry.sourceRef || '').trim();
    const description = String(entry.description || '');
    const parsedInvoiceNo = description.match(/INV-\d{4}-\d{5}/i)?.[0];

    return invoices.find(invoice =>
      invoice.id === source ||
      invoice.invoiceNo === source ||
      invoice.journalEntryId === source ||
      invoice.glEntryNumber === source ||
      (parsedInvoiceNo && invoice.invoiceNo === parsedInvoiceNo)
    );
  };

  const getComputedBalanceAfter = (recordDate: string, contactId: string, contactType: CustomerType | null) => {
    if (!contactId || !contactType) return 0;
    const postedEntryIds = new Set(
      entries
        .filter(entry => entry.status === 'POSTED' && entry.date <= recordDate)
        .map(entry => entry.id)
    );

    return lines
      .filter(
        line =>
          postedEntryIds.has(line.journalEntryId) &&
          arAccountIds.has(line.accountId) &&
          line.contactId === contactId &&
          line.contactType === contactType
      )
      .reduce((sum, line) => sum + (Number(line.debit || 0) - Number(line.credit || 0)), 0);
  };

  const writeOffRecords = useMemo<WriteOffRecord[]>(() => {
    return entries
      .filter(
        entry =>
          ['ON_HOLD', 'POSTED', 'REVERSED'].includes(entry.status) &&
          ((entry.reference || '').startsWith('WO-') ||
            (entry.description || '').toUpperCase().includes('[WRITE OFF]') ||
            (entry.description || '').toUpperCase().includes('WRITE-OFF') ||
            (entry.description || '').toUpperCase().includes('WRITE OFF'))
      )
      .map(entry => {
        const arLine = lines.find(
          line =>
            line.journalEntryId === entry.id &&
            line.credit > 0 &&
            (line.contactType === 'SPONSOR' || line.contactType === 'STUDENT')
        );

        const detectedCustomerType =
          arLine?.contactType === 'SPONSOR' || arLine?.contactType === 'STUDENT' ? arLine.contactType : null;
        const detectedCustomerId = arLine?.contactId || '';

        const detectedCustomerName =
          detectedCustomerType === 'SPONSOR'
            ? sponsors.find(s => s.id === detectedCustomerId)?.name || 'Unknown Sponsor'
            : detectedCustomerType === 'STUDENT'
              ? (() => {
                  const student = students.find(s => s.id === detectedCustomerId);
                  return student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
                })()
              : 'Unassigned Customer';

        const arAccountName = accounts.find(a => a.id === arLine?.accountId)?.name || 'Accounts Receivable';
        const invoice = getInvoiceForEntry(entry);
        const invoiceNo =
          invoice?.invoiceNo ||
          String(entry.description || '').match(/INV-\d{4}-\d{5}/i)?.[0] ||
          '-';

        return {
          entry,
          amount: Number(arLine?.credit || 0),
          customerId: detectedCustomerId,
          customerType: detectedCustomerType,
          customerName: detectedCustomerName,
          arAccountName,
          invoiceNo,
          balanceAfter: invoice ? Math.max(0, Number(invoice.balanceDue || 0)) : getComputedBalanceAfter(entry.date, detectedCustomerId, detectedCustomerType)
        };
      })
      .filter(record => statusFilter === 'ALL' || getWriteOffStatusLabel(record.entry.status).replace(' ', '_') === statusFilter)
      .filter(record => customerTypeFilter === 'ALL' || record.customerType === customerTypeFilter)
      .filter(record => {
        let matchesDate = true;
        const currentDay = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        if (dateFilterMode === 'TODAY') {
          matchesDate = record.entry.date === currentDay;
        } else if (dateFilterMode === 'THIS_MONTH') {
          matchesDate = record.entry.date >= firstDayOfMonth && record.entry.date <= currentDay;
        } else if (dateFilterMode === 'CUSTOM') {
          matchesDate =
            (!dateFrom || record.entry.date >= dateFrom) &&
            (!dateTo || record.entry.date <= dateTo);
        }

        return matchesDate;
      })
      .filter(record => {
        const haystack = [
          record.entry.reference || '',
          record.invoiceNo,
          record.entry.glEntryNumber || '',
          record.entry.description || '',
          record.customerName,
          record.customerType || '',
          record.arAccountName
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const getSortValue = (record: WriteOffRecord) => {
          switch (sortConfig.key) {
            case 'date':
              return new Date(record.entry.date).getTime();
            case 'postPeriod': {
              const parsed = new Date(record.entry.date);
              return Number.isNaN(parsed.getTime()) ? 0 : parsed.getFullYear() * 100 + parsed.getMonth() + 1;
            }
            case 'writeOffNo':
              return record.entry.reference || '';
            case 'invoiceNo':
              return record.invoiceNo;
            case 'status':
              return getWriteOffStatusLabel(record.entry.status);
            case 'glReference':
              return getEntryGlReference(record.entry);
            case 'payer':
              return record.customerName;
            case 'writeOffAmount':
              return record.amount;
            case 'balanceAfter':
              return record.balanceAfter;
            case 'createdBy':
              return getCreatedByName(record.entry.createdBy);
            case 'createdOn':
              return record.entry.createdAt ? new Date(record.entry.createdAt).getTime() : 0;
            default:
              return record.entry.date;
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
  }, [accounts, arAccountIds, customerTypeFilter, dateFilterMode, dateFrom, dateTo, entries, invoices, lines, searchTerm, sortConfig, sponsors, statusFilter, students, users]);

  const totalWriteOffAmount = useMemo(
    () => writeOffRecords.reduce((sum, record) => sum + record.amount, 0),
    [writeOffRecords]
  );

  const statusCounts = useMemo(() => ({
    onHold: writeOffRecords.filter(record => getWriteOffStatusLabel(record.entry.status) === 'ON HOLD').length,
    posted: writeOffRecords.filter(record => getWriteOffStatusLabel(record.entry.status) === 'POSTED').length,
    reversed: writeOffRecords.filter(record => getWriteOffStatusLabel(record.entry.status) === 'REVERSED').length
  }), [writeOffRecords]);

  const viewingEntry = useMemo(
    () => entries.find(entry => entry.id === viewingRecordId) || null,
    [entries, viewingRecordId]
  );

  const formStatusLabel = isViewingExistingRecord ? getWriteOffStatusLabel(viewingEntry?.status) : 'ON HOLD';
  const formGlReference = isViewingExistingRecord
    ? getEntryGlReference(viewingEntry)
    : 'Pending on posting';
  const canApproveViewingRecord = isViewingExistingRecord && getWriteOffStatusLabel(viewingEntry?.status) === 'ON HOLD';

  const displayedInvoices = useMemo(() => {
    if (!isViewingExistingRecord) return eligibleInvoices;

    const selectedIds = new Set(selectedInvoiceIds);
    const selectedInvoices = invoices.filter(invoice => selectedIds.has(invoice.id));
    const combined = [...selectedInvoices, ...eligibleInvoices];
    return combined.filter((invoice, index, list) => list.findIndex(item => item.id === invoice.id) === index);
  }, [eligibleInvoices, invoices, isViewingExistingRecord, selectedInvoiceIds]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedWriteOffRecords,
    setCurrentPage
  } = usePaginatedRows(writeOffRecords, [searchTerm, statusFilter, customerTypeFilter, dateFilterMode, dateFrom, dateTo, sortConfig]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCustomerTypeFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setShowDateDropdown(false);
    setShowCustomerDropdown(false);
    setShowStatusDropdown(false);
    setShowExportDropdown(false);
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

  const registryBaseColumns = [
    { key: 'date', label: 'Transaction Date', sortKey: 'date', width: 'w-32', align: 'text-left' as const, render: (record: WriteOffRecord) => formatDate(record.entry.date) },
    { key: 'postPeriod', label: 'Post Period', sortKey: 'postPeriod', width: 'w-32', align: 'text-left' as const, render: (record: WriteOffRecord) => formatPostPeriod(record.entry.date) },
    { key: 'writeOffNo', label: 'Write-Off No.', sortKey: 'writeOffNo', width: 'w-40', align: 'text-left' as const, render: (record: WriteOffRecord) => record.entry.reference || '-' },
    { key: 'invoiceNo', label: 'Invoice No.', sortKey: 'invoiceNo', width: 'w-40', align: 'text-left' as const, render: (record: WriteOffRecord) => record.invoiceNo },
    { key: 'status', label: 'Status', sortKey: 'status', width: 'w-28', align: 'text-left' as const, render: (record: WriteOffRecord) => getStatusBadge(record.entry.status) },
    { key: 'glReference', label: 'GL Reference No.', sortKey: 'glReference', width: 'w-40', align: 'text-left' as const, render: (record: WriteOffRecord) => getEntryGlReference(record.entry) },
    { key: 'payer', label: 'Sponsor/Student', sortKey: 'payer', width: 'w-56', align: 'text-left' as const, render: (record: WriteOffRecord) => record.customerName },
    { key: 'writeOffAmount', label: 'Write-Off Amount', sortKey: 'writeOffAmount', width: 'w-40', align: 'text-right' as const, render: (record: WriteOffRecord) => formatCurrency(record.amount) },
    { key: 'balanceAfter', label: 'Balance After', sortKey: 'balanceAfter', width: 'w-40', align: 'text-right' as const, render: (record: WriteOffRecord) => formatCurrency(record.balanceAfter) },
    { key: 'createdBy', label: 'Created By', sortKey: 'createdBy', width: 'w-40', align: 'text-left' as const, render: (record: WriteOffRecord) => getCreatedByName(record.entry.createdBy) },
    { key: 'createdOn', label: 'Created On', sortKey: 'createdOn', width: 'w-32', align: 'text-left' as const, render: (record: WriteOffRecord) => formatCreatedOn(record.entry.createdAt) }
  ];

  const registryColumns = columnOrder
    .map(key => registryBaseColumns.find(column => column.key === key))
    .filter(Boolean) as typeof registryBaseColumns;

  const getRegistryExportColumns = () => {
    const exportColumns = [
      { key: 'date', label: 'Transaction Date', value: (record: WriteOffRecord) => formatDate(record.entry.date) },
      { key: 'postPeriod', label: 'Post Period', value: (record: WriteOffRecord) => formatPostPeriod(record.entry.date) },
      { key: 'writeOffNo', label: 'Write-Off No.', value: (record: WriteOffRecord) => record.entry.reference || '-' },
      { key: 'invoiceNo', label: 'Invoice No.', value: (record: WriteOffRecord) => record.invoiceNo },
      { key: 'status', label: 'Status', value: (record: WriteOffRecord) => getWriteOffStatusLabel(record.entry.status) },
      { key: 'glReference', label: 'GL Reference No.', value: (record: WriteOffRecord) => getEntryGlReference(record.entry) },
      { key: 'payer', label: 'Sponsor/Student', value: (record: WriteOffRecord) => record.customerName },
      { key: 'writeOffAmount', label: 'Write-Off Amount', value: (record: WriteOffRecord) => record.amount },
      { key: 'balanceAfter', label: 'Balance After', value: (record: WriteOffRecord) => record.balanceAfter },
      { key: 'createdBy', label: 'Created By', value: (record: WriteOffRecord) => getCreatedByName(record.entry.createdBy) },
      { key: 'createdOn', label: 'Created On', value: (record: WriteOffRecord) => formatCreatedOn(record.entry.createdAt) }
    ];

    return columnOrder.map(key => exportColumns.find(column => column.key === key)).filter(Boolean) as typeof exportColumns;
  };

  const getExportRows = () => {
    const columns = getRegistryExportColumns();
    return writeOffRecords.map(record => {
      const row: Record<string, any> = {};
      columns.forEach(column => {
        row[column.label] = column.value(record);
      });
      return row;
    });
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No write-offs to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(column => column.label);
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:"#,##0.00"}</style></head><body><table>';
    html += '<tr>' + headers.map(header => `<th>${escapeHtml(header)}</th>`).join('') + '</tr>';
    rows.forEach(row => {
      html += '<tr>';
      columns.forEach(column => {
        const value = row[column.label];
        const isNumber = typeof value === 'number';
        const displayValue = isNumber ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : value;
        html += `<td${isNumber ? ' class="num"' : ''}>${escapeHtml(displayValue)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Write_Off_Registry_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No write-offs to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(column => column.label);
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Write-Off Registry</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Inter,"Open Sans","Segoe UI",Arial,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { color:#6b7280; font-size:12px; margin-bottom:16px; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      th { background:#059669; color:#fff; padding:8px 10px; text-align:left; font-weight:700; }
      td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
      tr:nth-child(even) { background:#f9fafb; }
      .num { text-align:right; }
      .footer { margin-top:16px; font-size:10px; color:#9ca3af; text-align:right; }
    </style></head><body>`;
    html += '<h2>Write-Off Registry</h2>';
    html += `<div class="subtitle">Write-Off Registry &mdash; Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &mdash; ${rows.length} record(s)</div>`;
    html += '<table><thead><tr>' + headers.map(header => `<th>${escapeHtml(header)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      headers.forEach(header => {
        const value = row[header];
        const isNumber = typeof value === 'number';
        const displayValue = isNumber ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) : value;
        html += `<td${isNumber ? ' class="num"' : ''}>${escapeHtml(displayValue)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="footer">Generated on ${new Date().toLocaleString('en-PH')}</div>`;
    html += '</body></html>';
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 400);
    }
  };

  const handlePrintWriteOff = () => {
    if (formWriteOffAmount <= 0) {
      onNotify('info', 'Enter a write-off amount before printing.');
      return;
    }

    const orgName = organization?.name || 'Write-Off Registry';
    const logoUrl = organization?.logoUrl || '';
    const voucherAccent = '#006b2d';
    const transactionDescription = reason || 'Accounts receivable write-off';
    const statusLabel = formStatusLabel;
    const dateLabel = formatDate(writeOffDate);
    const isPostedViewingRecord = isViewingExistingRecord && statusLabel === 'POSTED';
    const balanceBeforeWriteOff = isPostedViewingRecord
      ? Number(customerBalance || 0) + Number(formWriteOffAmount || 0)
      : Number(customerBalance || 0);
    const balanceAfterWriteOff = isPostedViewingRecord
      ? Math.max(0, Number(customerBalance || 0))
      : Math.max(0, Number(customerBalance || 0) - Number(formWriteOffAmount || 0));

    const selectedInvoiceRows = Array.from(selectedInvoiceIds)
      .map(invoiceId => {
        const invoice = invoices.find(item => item.id === invoiceId);
        if (!invoice) return null;
        const writeOffAmount = Number(invoiceWriteOffAmounts[invoice.id] || (selectedInvoiceIds.size === 1 ? formWriteOffAmount : 0));
        const currentBalance = Number(invoice.balanceDue || 0);
        const balanceBefore = isPostedViewingRecord ? currentBalance + writeOffAmount : currentBalance;
        const balanceAfter = isPostedViewingRecord ? currentBalance : Math.max(0, currentBalance - writeOffAmount);

        return {
          invoiceNo: invoice.invoiceNo || invoice.id,
          invoiceDate: formatDate(invoice.invoiceDate),
          description: transactionDescription,
          balanceBefore,
          writeOffAmount,
          balanceAfter
        };
      })
      .filter(Boolean) as Array<{
        invoiceNo: string;
        invoiceDate: string;
        description: string;
        balanceBefore: number;
        writeOffAmount: number;
        balanceAfter: number;
      }>;

    const printableInvoiceRows = selectedInvoiceRows.length > 0
      ? selectedInvoiceRows
      : [{
          invoiceNo: sourceInvoiceNo || 'Unapplied AR balance',
          invoiceDate: '-',
          description: transactionDescription,
          balanceBefore: balanceBeforeWriteOff,
          writeOffAmount: formWriteOffAmount,
          balanceAfter: balanceAfterWriteOff
        }];

    const journalRows = [
      {
        account: getAccountLabel(expenseAccountId),
        memo: transactionDescription,
        debit: formWriteOffAmount,
        credit: 0
      },
      {
        account: getAccountLabel(arAccountId),
        memo: customerName || '-',
        debit: 0,
        credit: formWriteOffAmount
      }
    ];

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Write-Off Voucher</title><style>
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
          <div style="text-align:left;min-width:310px;">
            <div style="font-size:44px;font-weight:700;line-height:1;margin-bottom:8px;color:${voucherAccent};">Write-Off Voucher</div>
            <table style="font-size:14px;">
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Reference No.:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(reference || '-')}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Date:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(dateLabel)}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Status:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(statusLabel)}</td></tr>
            </table>
            <div class="muted" style="text-align:right;margin-top:6px;">Printed ${escapeHtml(new Date().toLocaleString('en-US'))}</div>
          </div>
        </div>

        <div class="summary">
          <div class="section">
            <div class="section-title">Write-Off Information</div>
            <div class="section-body">
              <div class="row"><span>Payor</span><span>${escapeHtml(customerName || '-')}</span></div>
              <div class="row"><span>Payor Type</span><span>${escapeHtml(customerType)}</span></div>
              <div class="row"><span>Post Period</span><span>${escapeHtml(formatPostPeriod(writeOffDate))}</span></div>
              <div class="row"><span>GL Reference No.</span><span>${escapeHtml(formGlReference)}</span></div>
              <div class="row"><span>Prepared By</span><span>${escapeHtml(isViewingExistingRecord ? getCreatedByName(viewingEntry?.createdBy) : '-')}</span></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Amount Summary</div>
            <div class="section-body">
              <div class="row"><span>Balance Before Write-Off</span><span>${formatCurrency(balanceBeforeWriteOff)}</span></div>
              <div class="row"><span>Write-Off Amount</span><span>${formatCurrency(formWriteOffAmount)}</span></div>
              <div class="row"><span>Balance After Write-Off</span><span>${formatCurrency(balanceAfterWriteOff)}</span></div>
              <div class="row"><span>Invoices Affected</span><span>${printableInvoiceRows.length}</span></div>
              <div class="row"><span>Created On</span><span>${escapeHtml(isViewingExistingRecord ? formatCreatedOn(viewingEntry?.createdAt) : '-')}</span></div>
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
                <th class="num">Write-Off Amount</th>
                <th class="num">Balance After</th>
              </tr>
            </thead>
            <tbody>
              ${printableInvoiceRows.map(row => `<tr>
                <td>${escapeHtml(row.invoiceNo)}</td>
                <td>${escapeHtml(row.invoiceDate)}</td>
                <td>${escapeHtml(row.description)}</td>
                <td class="num">${formatCurrency(row.balanceBefore)}</td>
                <td class="num">${formatCurrency(row.writeOffAmount)}</td>
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
                <td class="num" style="font-weight:800;">${formatCurrency(formWriteOffAmount)}</td>
                <td class="num" style="font-weight:800;">${formatCurrency(formWriteOffAmount)}</td>
              </tr>
            </tbody>
          </table>
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
      onNotify('error', 'Please allow popups to print the write-off voucher.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const toggleInvoiceSelection = (invoice: Invoice) => {
    if (isViewingExistingRecord) return;

    const balance = Math.max(0, Number(invoice.balanceDue || 0));
    const nextSelected = new Set(selectedInvoiceIds);
    const nextAmounts = { ...invoiceWriteOffAmounts };

    if (nextSelected.has(invoice.id)) {
      nextSelected.delete(invoice.id);
      delete nextAmounts[invoice.id];
    } else {
      nextSelected.add(invoice.id);
      nextAmounts[invoice.id] = balance;
    }

    setSelectedInvoiceIds(nextSelected);
    setInvoiceWriteOffAmounts(nextAmounts);
    setSourceInvoiceId(nextSelected.size === 1 ? Array.from(nextSelected)[0] : '');
    const selectedInvoice = nextSelected.size === 1 ? invoices.find(inv => inv.id === Array.from(nextSelected)[0]) : null;
    setSourceInvoiceNo(selectedInvoice?.invoiceNo || '');
    setAmount(Object.values(nextAmounts).reduce((sum, value) => sum + Number(value || 0), 0));
  };

  const handleInvoiceWriteOffAmountChange = (invoice: Invoice, nextAmount: number) => {
    if (isViewingExistingRecord) return;

    const cappedAmount = Math.min(Math.max(0, Number(nextAmount || 0)), Math.max(0, Number(invoice.balanceDue || 0)));
    const nextSelected = new Set(selectedInvoiceIds);
    const nextAmounts = { ...invoiceWriteOffAmounts, [invoice.id]: cappedAmount };

    if (cappedAmount > 0) {
      nextSelected.add(invoice.id);
    } else {
      nextSelected.delete(invoice.id);
      delete nextAmounts[invoice.id];
    }

    setSelectedInvoiceIds(nextSelected);
    setInvoiceWriteOffAmounts(nextAmounts);
    setSourceInvoiceId(nextSelected.size === 1 ? Array.from(nextSelected)[0] : '');
    const selectedInvoice = nextSelected.size === 1 ? invoices.find(inv => inv.id === Array.from(nextSelected)[0]) : null;
    setSourceInvoiceNo(selectedInvoice?.invoiceNo || '');
    setAmount(Object.values(nextAmounts).reduce((sum, value) => sum + Number(value || 0), 0));
  };

  const buildJournalDraft = (status: WriteOffStatus = 'POSTED') => {
    if (!customerId) return onNotify('error', 'Please select a customer.');
    if (!arAccountId) return onNotify('error', 'Please select an Accounts Receivable G/L account.');
    if (!expenseAccountId) return onNotify('error', 'Please select a Write-Off (Expense) G/L account.');
    if (formWriteOffAmount <= 0) return onNotify('error', 'Write-off amount must be greater than zero.');
    if (formWriteOffAmount > customerBalance) return onNotify('error', 'Write-off amount exceeds customer outstanding balance.');

    const entryId = `je-wo-${Date.now()}`;
    const memo = reason || 'Accounts receivable write-off';
    const description = `[WRITE OFF] ${customerName}${reason ? ` - ${reason}` : ''}`;

    const journalLines: JournalLine[] = [
      {
        id: `l-wo-dr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: expenseAccountId,
        debit: formWriteOffAmount,
        credit: 0,
        memo
      },
      {
        id: `l-wo-cr-${Date.now()}`,
        journalEntryId: entryId,
        orgId,
        accountId: arAccountId,
        debit: 0,
        credit: formWriteOffAmount,
        memo,
        contactId: customerId,
        contactType: customerType
      }
    ];

    return {
      entry: {
        id: entryId,
        date: writeOffDate,
        reference,
        glEntryNumber: status === 'POSTED' ? generateNextWriteOffGlReference() : undefined,
        description,
        sourceType: 'MANUAL',
        sourceRef: sourceInvoiceId || sourceInvoiceNo || Array.from(selectedInvoiceIds).join(',') || undefined,
        status
      },
      journalLines
    };
  };

  const handleSave = async () => {
    const draft = buildJournalDraft('ON_HOLD');
    if (!draft) return;

    if (!onSaveJournal) {
      onNotify('info', 'Saving write-offs as ON HOLD is not available in this workflow.');
      return;
    }

    const saved = await onSaveJournal(draft.entry, draft.journalLines);
    if (saved !== null) {
      onNotify('success', 'Write-off saved as ON HOLD.');
      handleBackToList();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewingExistingRecord) return;

    const draft = buildJournalDraft('ON_HOLD');
    if (!draft) return;

    if (!onSaveJournal) {
      onNotify('info', 'Saving write-offs as ON HOLD is not available in this workflow.');
      return;
    }

    const saved = await onSaveJournal(draft.entry, draft.journalLines);
    if (saved !== null) {
      onNotify('success', 'Write-off saved as ON HOLD for approval.');
      handleBackToList();
    }
  };

  const handleApproveWriteOff = async () => {
    if (!viewingRecordId) return;
    if (!canApproveViewingRecord) {
      onNotify('info', 'Only ON HOLD write-offs can be approved.');
      return;
    }
    if (!onApproveJournal) {
      onNotify('info', 'Write-off approval is not available in this workflow.');
      return;
    }

    await onApproveJournal(viewingRecordId);
    handleBackToList();
  };

  const handleViewJournalEntry = (entry?: JournalEntry | null) => {
    if (!entry || !onViewJournal) return;
    const target = entry.id || entry.glEntryNumber || (entry as any).gl_entry_number || entry.reference;
    if (!target) return;
    onViewJournal(target);
  };

  const openWriteOffDetails = (record: WriteOffRecord) => {
    const recordLines = lines.filter(line => line.journalEntryId === record.entry.id);
    const arLine = recordLines.find(line =>
      line.credit > 0 &&
      (line.contactType === 'SPONSOR' || line.contactType === 'STUDENT')
    );
    const expenseLine = recordLines.find(line => line.debit > 0);
    const linkedInvoice =
      getInvoiceForEntry(record.entry) ||
      invoices.find(invoice => invoice.invoiceNo === record.invoiceNo);
    const nextCustomerType =
      arLine?.contactType === 'SPONSOR' || arLine?.contactType === 'STUDENT'
        ? arLine.contactType
        : record.customerType || 'SPONSOR';
    const writeOffAmount = Number(arLine?.credit || expenseLine?.debit || record.amount || 0);

    setViewingRecordId(record.entry.id);
    setViewMode('FORM');
    setWriteOffDate(record.entry.date || today);
    setReference(record.entry.reference || '');
    setCustomerType(nextCustomerType);
    setCustomerId(arLine?.contactId || record.customerId || '');
    setSourceInvoiceId(linkedInvoice?.id || '');
    setSourceInvoiceNo(linkedInvoice?.invoiceNo || record.invoiceNo || '');
    setAmount(writeOffAmount);
    setSelectedInvoiceIds(linkedInvoice?.id ? new Set([linkedInvoice.id]) : new Set());
    setInvoiceWriteOffAmounts(linkedInvoice?.id ? { [linkedInvoice.id]: writeOffAmount } : {});
    setArAccountId(arLine?.accountId || '');
    setExpenseAccountId(expenseLine?.accountId || '');
    setReason(String(record.entry.description || '').replace(/^\[WRITE OFF\]\s*/i, ''));
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {viewMode === 'LIST' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Write-Offs</h2>
              <p className="text-sm text-gray-500 font-normal italic">Track and post bad debt and uncollectible receivables.</p>
            </div>
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition-all shadow-md font-bold text-sm"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -10px ${brandColor}` }}
            >
              <Plus size={16} /> New Write-Off
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">On Hold</p>
              <p className="mt-3 text-2xl font-bold text-gray-900">{statusCounts.onHold}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Posted</p>
              <p className="mt-3 text-2xl font-bold text-emerald-600">{statusCounts.posted}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Reversed</p>
              <p className="mt-3 text-2xl font-bold text-rose-600">{statusCounts.reversed}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Write-Off</p>
              <p className="mt-3 text-2xl font-bold text-emerald-700">{formatCurrency(totalWriteOffAmount)}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full sm:w-72">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search write-offs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none min-w-[160px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Status:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {statusFilter === 'ALL' ? 'All' : getWriteOffStatusLabel(statusFilter)}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showStatusDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        {(['ALL', 'ON_HOLD', 'POSTED', 'REVERSED'] as WriteOffStatusFilter[]).map(status => (
                          <button
                            key={status}
                            onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                              statusFilter === status ? 'font-bold bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {status === 'ALL' ? 'All Statuses' : getWriteOffStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                  className="relative border border-gray-200 rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[240px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Sponsor/Student:</span>
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
                        <button
                          onClick={() => { setCustomerTypeFilter('ALL'); setShowCustomerDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                            customerTypeFilter === 'ALL' ? 'font-bold bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          All Customers
                        </button>
                        <button
                          onClick={() => { setCustomerTypeFilter('SPONSOR'); setShowCustomerDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                            customerTypeFilter === 'SPONSOR' ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          style={customerTypeFilter === 'SPONSOR' ? { backgroundColor: brandColor } : undefined}
                        >
                          Sponsors
                        </button>
                        <button
                          onClick={() => { setCustomerTypeFilter('STUDENT'); setShowCustomerDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                            customerTypeFilter === 'STUDENT' ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          style={customerTypeFilter === 'STUDENT' ? { backgroundColor: brandColor } : undefined}
                        >
                          Students
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <div
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
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
                style={{ color: searchTerm || statusFilter !== 'ALL' || customerTypeFilter !== 'ALL' || dateFilterMode !== 'ALL' ? brandColor : undefined }}
                title="Clear all filters"
              >
                <RotateCcw size={16} />
              </button>

              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm select-none"
                  title="Export"
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
                          onClick={() => { setShowExportDropdown(false); exportToExcel(); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileSpreadsheet size={16} className="text-emerald-600" />
                          Export as Excel
                        </button>
                        <button
                          onClick={() => { setShowExportDropdown(false); exportToPdf(); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileText size={16} className="text-red-500" />
                          Export as PDF
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
              <table className="w-full min-w-[1320px] font-sans">
                <thead style={{ backgroundColor: brandColor }}>
                  <tr>
                    {registryColumns.map((col, idx) => (
                      <th
                        key={col.key}
                        draggable
                        onDragStart={event => {
                          setDraggedColumnIdx(idx);
                          event.dataTransfer.effectAllowed = 'move';
                          if (event.target instanceof HTMLElement) {
                            event.target.style.opacity = '0.5';
                          }
                        }}
                        onDragEnd={event => {
                          setDraggedColumnIdx(null);
                          if (event.target instanceof HTMLElement) {
                            event.target.style.opacity = '1';
                          }
                        }}
                        onDragOver={event => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={event => {
                          event.preventDefault();
                          if (draggedColumnIdx === null || draggedColumnIdx === idx) return;
                          const nextOrder = [...columnOrder];
                          const [draggedKey] = nextOrder.splice(draggedColumnIdx, 1);
                          nextOrder.splice(idx, 0, draggedKey);
                          setColumnOrder(nextOrder);
                          setDraggedColumnIdx(null);
                        }}
                        className={`group relative cursor-move select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 hover:border-emerald-200 ${col.align} ${
                          draggedColumnIdx === idx ? 'border-2 border-dashed border-emerald-300 bg-emerald-700 opacity-50' : ''
                        }`}
                        style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                        title="Drag to reorder column"
                      >
                        <div
                          className={`flex items-center text-[13px] font-bold text-white ${col.align === 'text-right' ? 'justify-end' : ''} ${col.sortKey ? 'cursor-pointer hover:text-gray-100' : ''}`}
                          onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                        >
                          {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                        </div>
                        <div
                          onMouseDown={event => {
                            event.stopPropagation();
                            event.preventDefault();
                            const th = event.currentTarget.parentElement;
                            if (!th) return;
                            resizeRef.current = { colKey: col.key, startX: event.clientX, startWidth: th.getBoundingClientRect().width };

                            const onMouseMove = (moveEvent: MouseEvent) => {
                              if (!resizeRef.current) return;
                              const diff = moveEvent.clientX - resizeRef.current.startX;
                              const newWidth = Math.max(72, resizeRef.current.startWidth + diff);
                              setColumnWidths(prev => ({ ...prev, [resizeRef.current!.colKey]: newWidth }));
                            };

                            const onMouseUp = () => {
                              resizeRef.current = null;
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
                          className="absolute right-0 top-0 bottom-0 z-10 w-[4px] cursor-col-resize transition-colors hover:bg-emerald-300"
                          title="Drag to resize column"
                          draggable={false}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {writeOffRecords.length === 0 ? (
                    <tr>
                      <td colSpan={registryColumns.length} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <FileText size={28} className="opacity-40" />
                          <p className="text-sm font-medium">No write-offs found for the current search and filter.</p>
                          <button
                            type="button"
                            onClick={openNewForm}
                            className="mt-2 px-5 py-2 text-white rounded text-sm font-semibold transition-all"
                            style={{ backgroundColor: brandColor }}
                          >
                            Create First Write Off
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedWriteOffRecords.map(record => (
                      <tr
                        key={record.entry.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => openWriteOffDetails(record)}
                        title="Click to view write-off details"
                      >
                        {registryColumns.map(col => (
                          <td
                            key={col.key}
                            className={`px-4 py-3 text-sm ${col.align}`}
                            style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                          >
                            {col.key === 'writeOffNo' || col.key === 'invoiceNo' ? (
                              <span className="font-medium text-emerald-700">{col.render(record)}</span>
                            ) : col.key === 'payer' ? (
                              <div>
                                <div className="font-medium text-gray-800">{record.customerName}</div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  {record.customerType === 'SPONSOR' ? <Building2 size={11} /> : <GraduationCap size={11} />}
                                  {record.customerType || 'Unknown'}
                                </div>
                              </div>
                            ) : col.key === 'writeOffAmount' ? (
                              <span className="font-mono font-semibold text-gray-900">{col.render(record)}</span>
                            ) : col.key === 'balanceAfter' ? (
                              <span className="font-mono font-medium text-gray-800">{col.render(record)}</span>
                            ) : col.key === 'glReference' && getEntryGlReference(record.entry) !== '-' && onViewJournal ? (
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();
                                  handleViewJournalEntry(record.entry);
                                }}
                                className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                                title="View Journal Entry"
                              >
                                {col.render(record)}
                              </button>
                            ) : (
                              <span className="font-medium text-gray-800">{col.render(record)}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={writeOffRecords.length}
              pageStartIndex={pageStartIndex}
              pageEndIndex={pageEndIndex}
              onPageChange={setCurrentPage}
              itemLabel="write-offs"
            />
          </div>
        </>
      ) : (
        <>
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[80vh]">
            <div className="px-4 py-4 border-b" style={{ backgroundColor: brandTint(0.08) }}>
              <h3 className="text-xl font-bold text-gray-900">
                {isViewingExistingRecord ? 'Write-Off Details' : 'New Write-Off'} : {reference}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-white">
              {!isViewingExistingRecord && (
                <>
                  <button
                    type="button"
                    title="Discard Changes and Close"
                    onClick={() => resetFormState(customerType)}
                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    type="button"
                    title="Add New Record"
                    onClick={openNewForm}
                    className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                  <button
                    type="submit"
                    title="Save Write-Off as ON HOLD"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-md text-sm font-bold shadow-sm transition-all"
                    style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -14px ${brandColor}` }}
                  >
                    <FileText size={17} /> Save Write-Off
                  </button>
                  <button
                    type="button"
                    title="Save as ON HOLD"
                    onClick={handleSave}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Save size={20} />
                  </button>
                </>
              )}
              {canApproveViewingRecord && (
                <button
                  type="button"
                  title="Approve and post to Journal Entries"
                  onClick={handleApproveWriteOff}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-md text-sm font-bold shadow-sm transition-all"
                  style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -14px ${brandColor}` }}
                >
                  <CheckCircle size={17} /> Approve Write-Off
                </button>
              )}
              <button
                type="button"
                title="Print"
                onClick={handlePrintWriteOff}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Printer size={20} />
              </button>
              <button
                type="button"
                title="Back to registry"
                onClick={handleBackToList}
                className="p-2 text-slate-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <CornerUpLeft size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4 p-4">
              <div className="space-y-4 min-w-0">
                <div
                  className="rounded-lg p-4 border"
                  style={{ backgroundColor: brandTint(0.05), borderColor: brandTint(0.22) }}
                >
                  <h4 className="text-sm font-bold uppercase text-gray-900 mb-4">Write-Off Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Write-Off No.</label>
                      <input
                        type="text"
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none font-mono"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        disabled={isViewingExistingRecord}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Post Period</label>
                      <input
                        type="text"
                        value={formatPostPeriod(writeOffDate)}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 text-gray-900 outline-none"
                        style={{ borderColor: brandTint(0.24), backgroundColor: brandTint(0.07) }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Write-Off Date *</label>
                      <input
                        type="date"
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                        value={writeOffDate}
                        onChange={e => setWriteOffDate(e.target.value)}
                        disabled={isViewingExistingRecord}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Payor Type *</label>
                      <select
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none appearance-none"
                        value={customerType}
                        disabled={isViewingExistingRecord}
                        onChange={e => {
                          setCustomerType(e.target.value as CustomerType);
                          setCustomerId('');
                          setSelectedInvoiceIds(new Set());
                          setInvoiceWriteOffAmounts({});
                          setAmount(0);
                        }}
                      >
                        <option value="SPONSOR">Sponsor</option>
                        <option value="STUDENT">Student</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Payor *</label>
                      <select
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none appearance-none"
                        value={customerId}
                        disabled={isViewingExistingRecord}
                        onChange={e => {
                          setCustomerId(e.target.value);
                          setSelectedInvoiceIds(new Set());
                          setInvoiceWriteOffAmounts({});
                          setAmount(0);
                        }}
                      >
                        <option value="">Select payor...</option>
                        {customerType === 'SPONSOR' &&
                          sponsors.map(sponsor => (
                            <option key={sponsor.id} value={sponsor.id}>
                              {sponsor.name}
                            </option>
                          ))}
                        {customerType === 'STUDENT' &&
                          students.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.lastName}, {student.firstName}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] gap-4 mt-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Transaction Description *</label>
                      <input
                        type="text"
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        disabled={isViewingExistingRecord}
                        placeholder="Write-off of uncollectible balance"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Status</label>
                      <input value={formStatusLabel} readOnly className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 font-semibold text-gray-900 outline-none" />
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
                </div>

                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold uppercase text-gray-900 mb-4">Apply Write-Off To Invoices</h4>
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="w-12 px-3 py-2 text-center"></th>
                          <th className="px-3 py-2 text-left">Invoice No.</th>
                          <th className="px-3 py-2 text-left">Invoice Date</th>
                          <th className="px-3 py-2 text-right">Original Amount</th>
                          <th className="px-3 py-2 text-right">Paid Amount</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2 text-right">Write-Off Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
                              Select a payor with open invoice balances.
                            </td>
                          </tr>
                        ) : displayedInvoices.map(invoice => {
                          const isSelected = selectedInvoiceIds.has(invoice.id);
                          const originalAmount = Number(invoice.netAmountDue ?? invoice.grandTotal ?? 0);
                          const paidAmount = Number(invoice.amountPaid || 0);
                          const balance = Number(invoice.balanceDue || 0);
                          return (
                            <tr key={invoice.id} className={isSelected ? 'bg-emerald-50/40' : undefined}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleInvoiceSelection(invoice)}
                                  disabled={isViewingExistingRecord}
                                  className="h-4 w-4 rounded border-gray-300 accent-emerald-600 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-3 py-2 font-semibold text-emerald-700">{invoice.invoiceNo}</td>
                              <td className="px-3 py-2 font-medium text-gray-800">{formatDate(invoice.invoiceDate)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(originalAmount)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(paidAmount)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(balance)}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={balance}
                                  step="0.01"
                                  value={invoiceWriteOffAmounts[invoice.id] ?? 0}
                                  onChange={e => handleInvoiceWriteOffAmountChange(invoice, Number(e.target.value))}
                                  disabled={isViewingExistingRecord}
                                  className="w-36 rounded-md border border-gray-200 px-2 py-1.5 text-right font-semibold outline-none focus:border-brand"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={6} className="px-3 py-3 text-right text-sm font-bold uppercase text-slate-600">Total Write-Off Amount</td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatCurrency(formWriteOffAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <h4 className="text-sm font-bold uppercase text-gray-900 mb-4">Write-Off Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Write-Off Account (Debit) *</label>
                      <select
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none appearance-none"
                        value={expenseAccountId}
                        onChange={e => setExpenseAccountId(e.target.value)}
                        disabled={isViewingExistingRecord}
                      >
                        <option value="">Select expense account...</option>
                        {expenseAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">AR Account (Credit) *</label>
                      <select
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none appearance-none"
                        value={arAccountId}
                        onChange={e => setArAccountId(e.target.value)}
                        disabled={isViewingExistingRecord}
                      >
                        <option value="">Select AR account...</option>
                        {arAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Reason / Memo</label>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    disabled={isViewingExistingRecord}
                    placeholder="e.g., Uncollectible balance approved for write-off"
                  />
                </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                  <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-gray-200">
                    <p className="text-xs font-bold uppercase text-slate-500">Customer Outstanding Balance</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(customerBalance)}</p>
                  </div>
                  <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-gray-200">
                    <p className="text-xs font-bold uppercase text-slate-500">Balance After Write-Off</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(Math.max(customerBalance - formWriteOffAmount, 0))}</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Invoices Affected</p>
                    <p className="mt-1 text-lg font-bold text-gray-900">{selectedInvoiceCount} invoice{selectedInvoiceCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </div>
              <aside className="rounded-lg border border-gray-200 bg-white p-5 h-fit space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-4">GL Journal Entry Preview</h4>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 text-xs font-bold uppercase text-slate-500 border-b pb-2">
                    <span>GL Account</span>
                    <span className="text-right">Debit</span>
                    <span className="text-right">Credit</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900">
                    <span>{getAccountLabel(expenseAccountId)}</span>
                    <span className="text-right">{formatCurrency(formWriteOffAmount)}</span>
                    <span className="text-right">-</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 py-3 border-b text-sm font-semibold text-gray-900">
                    <span>{getAccountLabel(arAccountId)}</span>
                    <span className="text-right">-</span>
                    <span className="text-right">{formatCurrency(formWriteOffAmount)}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] gap-3 pt-3 text-sm font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-right">{formatCurrency(formWriteOffAmount)}</span>
                    <span className="text-right">{formatCurrency(formWriteOffAmount)}</span>
                  </div>
                </div>

                <div className="rounded-lg border p-4" style={{ borderColor: brandTint(0.24), backgroundColor: brandTint(0.08) }}>
                  <h4 className="text-xs font-bold uppercase mb-3" style={{ color: brandColor }}>GL Entry Details</h4>
                  <ul className="space-y-2 text-sm font-medium" style={{ color: brandColor }}>
                    <li>• Journal Entry Date: {formatDate(writeOffDate)}</li>
                    <li>• Reference: {reference}</li>
                    <li>• Customer: {customerName || '-'}</li>
                    <li>• Total Debit = Total Credit (balanced entry)</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                  Posting this entry will reduce Accounts Receivable and recognize a write-off expense in the General Ledger.
                </div>

                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 flex gap-2">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>Once posted, this write-off cannot be edited.</span>
                </div>
              </aside>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ARWriteOffView;
