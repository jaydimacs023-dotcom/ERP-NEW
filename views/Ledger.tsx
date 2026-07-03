
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ChartOfAccount, JournalEntry, JournalLine, Student, Invoice, InvoiceLine, AccountClass,
  Payment,
  Trainer, Sponsor, Batch, NonStockItem, User, Qualification
} from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter, PageOrder } from '../services/IDataService';
import { Search, RotateCcw, BookText, Plus, X, ChevronDown, CheckSquare, Download, FileSpreadsheet, FileText, ArrowUpDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import JournalForm from '../components/JournalForm';
import { isEditableJournalStatus } from '../services/JournalWorkflowService';

const JOURNAL_ENTRIES_PER_PAGE = 7;
const JOURNAL_ENTRY_COLUMNS = 'id,org_id,period_id,date,description,reference,status,created_by,source_type,created_at,updated_at,approved_by,approved_at,gl_entry_number,review_comments,updated_by,source_ref,deposit_id,reversed_by,reversed_at,reversal_reason,original_entry_id';
const JOURNAL_LINE_COLUMNS = 'id,journal_entry_id,account_id,debit,credit,memo,contact_id,contact_type,batch_id,item_id,asset_id,is_cleared,created_at,description,classification_code,tax_category_id';

interface LedgerProps {
  orgId: string;
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  invoices?: Invoice[];
  payments?: Payment[];
  students: Student[];
  sponsors: Sponsor[];
  trainers: Trainer[];
  batches: Batch[];
  items: NonStockItem[];
  qualifications?: Qualification[];
  users?: User[];
  currentUser?: any;
  onPostEntry?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onApproveJournal?: (entryId: string) => void;
  onReverseJournal?: (entryId: string) => Promise<JournalEntry | null> | JournalEntry | null | void;
  initialSearchTerm?: string;
}

const getJournalEntryReferenceNo = (entry: JournalEntry): string => {
  const sourceType = String(entry.sourceType || '').toUpperCase();
  const sourceReference = String(entry.reference || '').trim();
  const glReference = String(entry.glEntryNumber || '').trim();
  const isCreditDebitMemo =
    sourceType === 'CREDIT_MEMO' ||
    /^((CM|DM)-\d{4}-\d+|(CDM|DBM)-)/i.test(sourceReference) ||
    String(entry.description || '').toUpperCase().includes('CREDIT MEMO') ||
    String(entry.description || '').toUpperCase().includes('DEBIT MEMO');

  if ((sourceType === 'APPLICATION' || isCreditDebitMemo) && sourceReference) {
    return sourceReference;
  }

  return glReference || sourceReference;
};

const formatPesoNumber = (amount: number) =>
  Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const renderAccountingAmount = (amount: number, className = '') => (
  <span className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 tabular-nums ${className}`}>
    <span className="text-left">₱</span>
    <span className="truncate text-right">{formatPesoNumber(amount)}</span>
  </span>
);

const Ledger: React.FC<LedgerProps> = ({
  orgId,
  accounts, entries, lines, invoices = [], payments = [], students, sponsors, trainers, batches, items, qualifications = [], users = [],
  currentUser, onPostEntry, onApproveJournal, onReverseJournal,
  initialSearchTerm = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_HOLD' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REVERSED'>('ALL');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('ALL');
  const [postPeriodFilter, setPostPeriodFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editingLines, setEditingLines] = useState<JournalLine[]>([]);
  const [entryFormMode, setEntryFormMode] = useState<'new' | 'edit' | 'view'>('new');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [serverEntries, setServerEntries] = useState<JournalEntry[]>([]);
  const [serverEntryLines, setServerEntryLines] = useState<JournalLine[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Column ordering and resize state
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'source', 'date', 'glReference', 'postPeriod', 'description', 'total', 'status', 'createdBy', 'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const entryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    lines.forEach(line => {
      const id = line.journalEntryId;
      totals.set(id, (totals.get(id) || 0) + (line.debit || 0));
    });
    return totals;
  }, [lines]);

  const reversedOriginalIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach(entry => {
      if (entry.originalEntryId) {
        ids.add(entry.originalEntryId);
      }
    });
    return ids;
  }, [entries]);

  const formatPeriod = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${format(d, 'MM')}-${format(d, 'yyyy')}`;
  };

  const transactionTypeOptions = useMemo(() => (
    Array.from(new Set(entries.map(entry => entry.sourceType).filter(Boolean))).sort()
  ), [entries]);

  const postPeriodOptions = useMemo(() => (
    Array.from(new Set(entries.map(entry => formatPeriod(entry.date)).filter(period => period !== '—'))).sort((a, b) => {
      const [aMonth, aYear] = a.split('-').map(Number);
      const [bMonth, bYear] = b.split('-').map(Number);

      if (aYear !== bYear) return bYear - aYear;
      return bMonth - aMonth;
    })
  ), [entries]);


  const parsePostPeriodRange = (period: string): { from: string; to: string } | null => {
    const [monthRaw, yearRaw] = period.split('-');
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (!month || !year) return null;
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = new Date(year, month, 0);
    const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
    return { from, to };
  };

  const serverSortKeyMap: Record<string, string> = {
    source: 'source_type',
    date: 'date',
    glReference: 'gl_entry_number',
    postPeriod: 'date',
    description: 'description',
    status: 'status',
    createdOn: 'created_at'
  };
  const serverSortColumn = serverSortKeyMap[sortConfig.key] || 'date';
  const serverFetchEnabled =
    Boolean(orgId) &&
    statusFilter !== 'ON_HOLD' &&
    sortConfig.key !== 'total' &&
    sortConfig.key !== 'createdBy' &&
    !/\d/.test(debouncedSearchTerm.trim());

  const serverFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    }
    if (statusFilter !== 'ALL') {
      filters.push({ column: 'status', operator: 'eq', value: statusFilter });
    }
    if (transactionTypeFilter !== 'ALL') {
      filters.push({ column: 'source_type', operator: 'eq', value: transactionTypeFilter });
    }

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    if (dateFilterMode === 'TODAY') {
      filters.push({ column: 'date', operator: 'eq', value: today });
    } else if (dateFilterMode === 'THIS_MONTH') {
      filters.push({ column: 'date', operator: 'gte', value: firstDayOfMonth });
      filters.push({ column: 'date', operator: 'lte', value: today });
    } else if (dateFilterMode === 'CUSTOM') {
      if (dateFrom) filters.push({ column: 'date', operator: 'gte', value: dateFrom });
      if (dateTo) filters.push({ column: 'date', operator: 'lte', value: dateTo });
    }

    if (postPeriodFilter !== 'ALL') {
      const range = parsePostPeriodRange(postPeriodFilter);
      if (range) {
        filters.push({ column: 'date', operator: 'gte', value: range.from });
        filters.push({ column: 'date', operator: 'lte', value: range.to });
      }
    }

    return filters;
  }, [dateFilterMode, dateFrom, dateTo, orgId, postPeriodFilter, statusFilter, transactionTypeFilter]);

  const serverOrderBy = useMemo<PageOrder[]>(() => {
    if (sortConfig.direction === 'none') {
      return [{ column: 'date', ascending: false }];
    }
    return [{ column: serverSortColumn, ascending: sortConfig.direction === 'asc' }];
  }, [serverSortColumn, sortConfig.direction]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, dateFilterMode, dateFrom, dateTo, orgId, postPeriodFilter, sortConfig, statusFilter, transactionTypeFilter]);

  useEffect(() => {
    if (!serverFetchEnabled) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<JournalEntry>('journal_entries', {
      page: currentPage,
      pageSize: JOURNAL_ENTRIES_PER_PAGE,
      columns: JOURNAL_ENTRY_COLUMNS,
      filters: serverFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['gl_entry_number', 'reference', 'description', 'source_ref'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: serverOrderBy
    })
      .then(async result => {
        if (!isActive) return;
        setServerEntries(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);

        const entryIds = result.rows.map(entry => entry.id).filter(Boolean);
        if (entryIds.length === 0) {
          setServerEntryLines([]);
          return;
        }

        const lineResult = await DataServiceFactory.getService().fetchPage<JournalLine>('journal_lines', {
          page: 1,
          pageSize: 200,
          columns: JOURNAL_LINE_COLUMNS,
          filters: [{ column: 'journal_entry_id', operator: 'in', value: `(${entryIds.join(',')})` }],
          orderBy: [{ column: 'journal_entry_id', ascending: true }]
        });
        if (isActive) {
          setServerEntryLines(lineResult.rows);
        }
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[Ledger] Failed to load journal entry page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load journal entries.');
        setServerEntries([]);
        setServerEntryLines([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPage(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, refreshKey, serverFetchEnabled, serverFilters, serverOrderBy]);
  const handleReverseOpenedEntry = async (): Promise<void> => {
    if (!editingEntry?.id || !onReverseJournal) return;

    const liveEntry = entries.find(entry => entry.id === editingEntry.id);
    if (!liveEntry) return;
    if (String(liveEntry.status || '').toUpperCase() !== 'POSTED') return;

    const reversed = await onReverseJournal(liveEntry.id);
    if (!reversed) return;

    setRefreshKey(key => key + 1);
    setShowEntryForm(false);
    setEditingEntry(null);
    setEditingLines([]);
    setEntryFormMode('new');
  };

  const filteredEntries = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    const hasLetters = /[a-z]/i.test(term);
    const hasNumbers = /\d/.test(term);
    const numericTerm = term.replace(/[, ]/g, '');

    return entries.filter(entry => {
      const entryStatus = (entry.status === 'DRAFT' ? 'ON_HOLD' : (entry.status || 'ON_HOLD')) as JournalEntry['status'] | 'ON_HOLD';
      const matchesStatus = statusFilter === 'ALL' || entryStatus === statusFilter;
      const matchesTransactionType = transactionTypeFilter === 'ALL' || entry.sourceType === transactionTypeFilter;
      const matchesPostPeriod = postPeriodFilter === 'ALL' || formatPeriod(entry.date) === postPeriodFilter;

      let matchesDate = true;
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const entryDate = entry.date;

      if (dateFilterMode === 'TODAY') {
        matchesDate = entryDate === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = entryDate >= firstDayOfMonth && entryDate <= today;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || entryDate >= dateFrom) &&
                      (!dateTo || entryDate <= dateTo);
      }

      if (!term) {
        return matchesStatus && matchesTransactionType && matchesPostPeriod && matchesDate;
      }

      const glRef = (entry.glEntryNumber || entry.reference || '').toLowerCase();
      const matchesGlRef = glRef.includes(term);

      const matchesOpenOnHoldDescription =
        hasLetters &&
        (entryStatus === 'POSTED' || entryStatus === 'ON_HOLD') &&
        (entry.description || '').toLowerCase().includes(term);

      const total = entryTotals.get(entry.id) || 0;
      const totalDigits = total
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .replace(/,/g, '');
      const matchesTotal = hasNumbers && totalDigits.includes(numericTerm);

      const matchesSearch = matchesGlRef || matchesOpenOnHoldDescription || matchesTotal;

      return matchesSearch && matchesStatus && matchesTransactionType && matchesPostPeriod && matchesDate;
    });
  }, [entries, entryTotals, debouncedSearchTerm, statusFilter, transactionTypeFilter, postPeriodFilter, dateFilterMode, dateFrom, dateTo]);

  const sortedEntries = useMemo(() => {
    if (sortConfig.direction === 'none') return filteredEntries;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const key = sortConfig.key;
    const getValue = (entry: JournalEntry) => {
      switch (key) {
        case 'source': return entry.sourceType || '';
        case 'date': return entry.date || '';
        case 'glReference': return (entry.glEntryNumber || entry.reference || '').trim();
        case 'postPeriod': return entry.date ? formatPeriod(entry.date) : '';
        case 'description': return entry.description || '';
        case 'total': return entryTotals.get(entry.id) || 0;
        case 'status': return entry.status || 'ON_HOLD';
        case 'createdBy': return getCreatedByName(entry.createdBy) || '';
        case 'createdOn': return entry.createdAt || '';
        default: return (entry as any)[key] ?? '';
      }
    };
    return [...filteredEntries].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredEntries, sortConfig, entryTotals]);

  const useFallbackRows = !serverFetchEnabled || !!pageLoadError;
  const totalItems = useFallbackRows ? sortedEntries.length : serverTotal;
  const totalPages = useFallbackRows ? Math.max(1, Math.ceil(sortedEntries.length / JOURNAL_ENTRIES_PER_PAGE)) : serverTotalPages;
  const pageStartIndex = (currentPage - 1) * JOURNAL_ENTRIES_PER_PAGE;
  const pageEndIndex = useFallbackRows
    ? Math.min(pageStartIndex + JOURNAL_ENTRIES_PER_PAGE, sortedEntries.length)
    : Math.min(pageStartIndex + serverEntries.length, serverTotal);

  const fallbackPaginatedEntries = useMemo(
    () => sortedEntries.slice(pageStartIndex, pageStartIndex + JOURNAL_ENTRIES_PER_PAGE),
    [sortedEntries, pageStartIndex]
  );
  const paginatedEntries = useFallbackRows ? fallbackPaginatedEntries : serverEntries;

  const serverEntryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    serverEntryLines.forEach(line => {
      const id = line.journalEntryId;
      totals.set(id, (totals.get(id) || 0) + (line.debit || 0));
    });
    return totals;
  }, [serverEntryLines]);
  const displayEntryTotals = useFallbackRows ? entryTotals : serverEntryTotals;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, transactionTypeFilter, postPeriodFilter, dateFilterMode, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(page => Math.min(Math.max(page, 1), totalPages));
  }, [totalPages]);

  const handleSort = (key: string) => {
    setCurrentPage(1);
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 text-emerald-200 opacity-70" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-white" />
      : <ChevronDown size={12} className="ml-1 text-white" />;
  };

  const formatEntryDate = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'MM-dd-yyyy');
  };

  const getCreatedByName = (createdBy?: string) => {
    if (!createdBy) return '—';
    if (createdBy === 'system') return 'System';
    const user = users.find(u => u.id === createdBy);
    return user?.name || user?.email || createdBy;
  };

  const DEFAULT_RECEIVABLE_CLASSIFICATION_CODE = '00000-00000';

  const isReceivableAccount = (account?: ChartOfAccount | null): boolean => {
    if (!account || account.class !== AccountClass.ASSET || account.isHeader) return false;
    const code = String(account.code || '').trim();
    const name = String(account.name || '').toLowerCase();
    return code === '1200' || code === '11100' || code === '11110' || name.includes('accounts receivable') || name.includes('receivable');
  };

  const getInvoiceLineClassificationCode = (invoice: Invoice | undefined, line: InvoiceLine): string => {
    const existingCode = String(line.classificationCode || '').trim();
    if (existingCode) return existingCode;

    const account = accounts.find(a => a.id === line.glAccountId);
    if (!account) return '';

    if (account.class === AccountClass.REVENUE || account.class === AccountClass.EXPENSE) {
      if (invoice?.batchId) {
        const batch = batches.find(b => b.id === invoice.batchId);
        if (batch) {
          const qual = qualifications.find(q => q.id === batch.qualificationId);
          return qual?.code || '';
        }
      }

      if (invoice?.studentId) {
        const student = students.find(s => s.id === invoice.studentId);
        if (student && (student as any).qualificationId) {
          const qual = qualifications.find(q => q.id === (student as any).qualificationId);
          return qual?.code || '';
        }
      }

      return '';
    }

    return '0000-0000';
  };

  const resolveJournalDisplayLines = (entry: JournalEntry): Array<JournalLine & { classificationCode?: string }> => {
    const serverLinesForEntry = serverEntryLines.filter(line => line.journalEntryId === entry.id);
    const baseLines = serverLinesForEntry.length > 0
      ? serverLinesForEntry
      : lines.filter(line => line.journalEntryId === entry.id);
    if (String(entry.sourceType || '').toUpperCase() !== 'INVOICE') {
      return baseLines.map(line => ({ ...line }));
    }

    const invoice = invoices.find(inv =>
      inv.orgId === (entry.orgId || '') &&
      (
        inv.id === entry.sourceRef ||
        inv.invoiceNo === entry.sourceRef ||
        inv.glEntryNumber === entry.sourceRef ||
        inv.journalEntryId === entry.id
      )
    );
    const invoiceLines = (invoice?.lines || [])
      .slice()
      .sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));
    if (invoiceLines.length === 0) {
      return baseLines.map(line => ({ ...line }));
    }

    let invoiceLineIndex = 0;
    return baseLines.map(line => {
      const account = accounts.find(a => a.id === line.accountId);
      const existingClassCode = String((line as any).classificationCode || '').trim();
      if (isReceivableAccount(account)) {
        return ({ ...line, classificationCode: existingClassCode || DEFAULT_RECEIVABLE_CLASSIFICATION_CODE } as JournalLine & { classificationCode?: string });
      }
      const isRevenueOrExpense = account?.class === AccountClass.REVENUE || account?.class === AccountClass.EXPENSE;
      if (!isRevenueOrExpense) {
        return { ...line };
      }

      const sourceInvoiceLine = invoiceLines[invoiceLineIndex];
      const classificationCode = existingClassCode || (sourceInvoiceLine ? getInvoiceLineClassificationCode(invoice, sourceInvoiceLine) : '');
      invoiceLineIndex += 1;

      return classificationCode
        ? ({ ...line, classificationCode } as JournalLine & { classificationCode?: string })
        : { ...line };
    });
  };

  const isLockedJournalEntry = (entry: JournalEntry) =>
    !isEditableJournalStatus(entry.status);

  const getDisplayStatusLabel = (status?: JournalEntry['status']) => {
    const map: Record<JournalEntry['status'], string> = {
      DRAFT: 'ON HOLD',
      ON_HOLD: 'ON HOLD',
      PENDING_APPROVAL: 'PENDING APPROVAL',
      APPROVED: 'APPROVED',
      POSTED: 'POSTED',
      REVERSED: 'REVERSED',
      REVISION_REQUESTED: 'REVISION REQUESTED'
    };
    return status ? (map[status] || status) : 'ON HOLD';
  };

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getRegistryExportColumns = () => ([
    { key: 'source', label: 'Memo / Source', value: (e: JournalEntry) => e.sourceType || '-' },
    { key: 'date', label: 'Transaction Date', value: (e: JournalEntry) => formatEntryDate(e.date) },
    { key: 'glReference', label: 'GL Reference No.', value: (e: JournalEntry) => (e.glEntryNumber || e.reference || '-').trim() },
    { key: 'description', label: 'Description', value: (e: JournalEntry) => e.description || '-' },
    { key: 'total', label: 'Transaction Total', value: (e: JournalEntry) => entryTotals.get(e.id) || 0 },
    { key: 'status', label: 'Status', value: (e: JournalEntry) => getDisplayStatusLabel(e.status || 'ON_HOLD') },
    { key: 'createdBy', label: 'Created By', value: (e: JournalEntry) => getCreatedByName(e.createdBy) },
    { key: 'createdOn', label: 'Created On', value: (e: JournalEntry) => formatEntryDate(e.createdAt) },
  ]);

  const getExportRows = () => {
    const columns = getRegistryExportColumns();
    return filteredEntries.map(entry => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        row[col.label] = col.value(entry);
      });
      return row;
    });
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No journal entries to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:\"#,##0.00\"}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const formattedNumber = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        const value = col.key === 'total' && isNum ? `₱${formattedNumber}` : formattedNumber;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Journal_Entries_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No journal entries to export.'); return; }
    const columns = getRegistryExportColumns();
    const cols = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Journal Entries</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Inter,"Open Sans","Segoe UI",Arial,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { font-size:12px; color:#6b7280; margin-bottom:12px; }
      table { width:100%; border-collapse:collapse; }
      th, td { border:1px solid #e5e7eb; padding:6px 8px; font-size:11px; }
      th { background:#059669; color:white; text-transform:uppercase; letter-spacing:.04em; }
      td.num { text-align:right; }
    </style></head><body>
      <h2>Journal Entries Registry</h2>
      <div class="subtitle">Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} — ${rows.length} record(s)</div>
      <table><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const formattedNumber = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        const value = col.key === 'total' && isNum ? `₱${formattedNumber}` : formattedNumber;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {!showEntryForm && !selectedEntry && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Journal Entries</h2>
          <p className="text-sm italic text-gray-500">Review and manage your financial transactions</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setEditingEntry(null);
              setEditingLines([]);
              setShowEntryForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300 shrink-0"
          >
            <Plus size={20} /> New Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar - Far Left */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-64">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search journal entries..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          {/* Status Filter */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Transaction Type Filter */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Transaction Type:</span>
            <select
              value={transactionTypeFilter}
              onChange={e => setTransactionTypeFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[150px]"
            >
              <option value="ALL">All</option>
              {transactionTypeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Post Period Filter */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Post Period:</span>
            <select
              value={postPeriodFilter}
              onChange={e => setPostPeriodFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="ALL">All</option>
              {postPeriodOptions.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
            >
              <span className="text-[13px] text-gray-500 mr-1">Date Range:</span>
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
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                    >
                      Remove Quick Filter
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                      disabled
                    >
                      Clear Filter
                    </button>
                  </div>

                  <div className="border-b border-gray-100 p-1">
                    <button
                      onClick={() => { setDateFilterMode('CUSTOM'); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                    </button>
                  </div>

                  <div className="p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setTransactionTypeFilter('ALL');
              setPostPeriodFilter('ALL');
              setDateFilterMode('ALL');
              setDateFrom('');
              setDateTo('');
            }}
            className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          {/* Export Dropdown */}
          <div className="relative ml-auto">
            <button
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
                      onClick={() => {
                        setShowExportDropdown(false);
                        exportToExcel();
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                    >
                      <FileSpreadsheet size={16} className="text-emerald-600" />
                      Export as Excel
                    </button>
                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        exportToPdf();
                      }}
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

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full font-sans text-[13px]">
          <thead className="bg-emerald-600 border-b">
            <tr>
              {(() => {
                const columns = {
                  source: { key: 'source', label: 'Transaction Type', align: 'text-left', width: 160, sortKey: 'source' },
                  date: { key: 'date', label: 'Transaction Date', align: 'text-left', width: 150, sortKey: 'date' },
                  glReference: { key: 'glReference', label: 'GL Reference No.', align: 'text-left', width: 170, sortKey: 'glReference' },
                  postPeriod: { key: 'postPeriod', label: 'Post Period', align: 'text-left', width: 130, sortKey: 'postPeriod' },
                  description: { key: 'description', label: 'Description', align: 'text-left', width: 180, sortKey: 'description' },
                  total: { key: 'total', label: 'Transaction Total', align: 'text-right', width: 150, sortKey: 'total' },
                  status: { key: 'status', label: 'Status', align: 'text-center', width: 120, sortKey: 'status' },
                  createdBy: { key: 'createdBy', label: 'Created By', align: 'text-left', width: 170, sortKey: 'createdBy' },
                  createdOn: { key: 'createdOn', label: 'Created On', align: 'text-left', width: 130, sortKey: 'createdOn' },
                };

                return columnOrder.map((colKey, idx) => {
                  const col = columns[colKey as keyof typeof columns];
                  return (
                    <th
                      key={col.key}
                      className={`px-4 py-3 ${col.align} cursor-move font-semibold text-white ${draggedColumnIdx === idx ? 'bg-emerald-700 border-dashed border-2 border-emerald-300 opacity-50' : ''} group select-none transition-colors border-x border-transparent hover:bg-emerald-700 hover:border-emerald-200 relative`}
                      style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : { minWidth: col.width, width: col.width }}
                      draggable
                      onDragStart={(e) => {
                        setDraggedColumnIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedColumnIdx(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedColumnIdx === null || draggedColumnIdx === idx) return;
                        const newOrder = [...columnOrder];
                        const [draggedKey] = newOrder.splice(draggedColumnIdx, 1);
                        newOrder.splice(idx, 0, draggedKey);
                        setColumnOrder(newOrder);
                        setDraggedColumnIdx(null);
                      }}
                      title="Drag to reorder column"
                    >
                      <div
                        className={`flex items-center ${col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : ''} text-[13px] font-bold text-white cursor-pointer`}
                        onClick={() => handleSort(col.sortKey)}
                      >
                        {col.label} <SortIndicator columnKey={col.sortKey} />
                      </div>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (!th) return;
                          const startWidth = th.getBoundingClientRect().width;
                          resizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                          const onMouseMove = (ev: MouseEvent) => {
                            if (!resizeRef.current) return;
                            const diff = ev.clientX - resizeRef.current.startX;
                            const newWidth = Math.max(60, resizeRef.current.startWidth + diff);
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
                        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-emerald-400 transition-colors z-10"
                        title="Drag to resize column"
                        draggable={false}
                      />
                    </th>
                  );
                });
              })()}
            </tr>
          </thead>
          <tbody className="divide-y">
            {totalItems === 0 ? (
              <tr>
                <td colSpan={columnOrder.length} className="px-4 py-12 text-center text-gray-500">
                  <div className="p-6 bg-white rounded shadow-sm inline-block mb-4 border border-gray-100">
                    <BookText size={48} className="text-gray-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">No Journal Records</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto italic font-medium">{isLoadingPage && !useFallbackRows ? 'Loading journal records...' : 'The ledger is currently empty. Manual entries or system-generated records will appear here once posted.'}</p>
                    <button
                      onClick={() => setShowEntryForm(true)}
                      className="mt-6 px-8 py-3 bg-gray-800 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-md active:scale-95 transition-all"
                    >
                      Create First Entry
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedEntries.map(entry => {
                const controlTotal = displayEntryTotals.get(entry.id) || 0;
                const statusLabel = entry.status || 'ON_HOLD';

                const cells: Record<string, React.ReactNode> = {
                  source: (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                      <span className="text-[13px] font-medium text-gray-700">{entry.sourceType}</span>
                    </div>
                  ),
                  date: <span className="font-medium text-gray-800">{formatEntryDate(entry.date)}</span>,
                  glReference: (
                    <span className="text-[13px] font-medium text-gray-900">
                      {(entry.glEntryNumber || entry.reference)?.trim() || '—'}
                    </span>
                  ),
                  postPeriod: <span className="font-medium text-gray-600">{formatPeriod(entry.date)}</span>,
                  description: <span className="font-medium text-gray-800 line-clamp-2">{entry.description}</span>,
                  total: (
                    <span className="font-medium text-gray-800">
                      <span className="mr-1 text-gray-500">₱</span>
                      {controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ),
                  status: (
                    <span className="font-medium text-gray-800">
                      {getDisplayStatusLabel(statusLabel)}
                    </span>
                  ),
                  createdBy: <span className="font-medium text-gray-600">{getCreatedByName(entry.createdBy)}</span>,
                  createdOn: <span className="font-medium text-gray-600">{formatEntryDate(entry.createdAt)}</span>,
                };

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => {
                      setEditingEntry(entry);
                      setEditingLines(resolveJournalDisplayLines(entry));
                      setEntryFormMode(isLockedJournalEntry(entry) ? 'view' : 'edit');
                      setShowEntryForm(true);
                    }}
                  >
                    {columnOrder.map(colKey => (
                      <td
                        key={colKey}
                        className={`px-4 py-3 ${
                          colKey === 'total' ? 'text-right' :
                          colKey === 'status' ? 'text-center' : 'text-left'
                        }`}
                        style={columnWidths[colKey] ? { width: columnWidths[colKey], minWidth: columnWidths[colKey] } : undefined}
                      >
                        {colKey === 'total' ? renderAccountingAmount(controlTotal, 'font-medium text-gray-800') : cells[colKey]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
            <div className="font-medium">
              Showing {pageStartIndex + 1}-{pageEndIndex} of {totalItems} journal entries
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
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
                  onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}

      {showEntryForm && (
        <JournalForm
          accounts={accounts}
          students={students}
          trainers={trainers}
          sponsors={sponsors}
          batches={batches}
          items={items}
          qualifications={qualifications}
          entries={entries}
          payments={payments}
          entryToEdit={editingEntry || undefined}
          linesToEdit={editingLines}
          mode={editingEntry ? entryFormMode : 'new'}
          canAuthorize={currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN'}
          onReverse={handleReverseOpenedEntry}
          onClose={() => {
            setShowEntryForm(false);
            setEditingEntry(null);
            setEditingLines([]);
            setEntryFormMode('new');
          }}
          onSubmit={(entry, lines) => {
            onPostEntry?.(entry, lines);
            setRefreshKey(key => key + 1);
            setShowEntryForm(false);
            setEditingEntry(null);
            setEditingLines([]);
            setEntryFormMode('new');
          }}
        />
      )}

      {selectedEntry && (
        <JournalEntryDetail
          entry={selectedEntry}
          lines={lines.filter(l => l.journalEntryId === selectedEntry.id)}
          accounts={accounts}
          createdByName={getCreatedByName(selectedEntry.createdBy)}
          statusLabel={getDisplayStatusLabel(selectedEntry.status || 'ON_HOLD')}
          hasExistingReversal={reversedOriginalIds.has(selectedEntry.id)}
          onClose={() => setSelectedEntry(null)}
          onApprove={onApproveJournal}
          onPost={() => onPostEntry?.(
            selectedEntry,
            lines.filter(line => line.journalEntryId === selectedEntry.id)
          )}
          onReverse={onReverseJournal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// --- Sub-component for Detail View ---
interface JournalEntryDetailProps {
  entry: JournalEntry;
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  createdByName: string;
  statusLabel: string;
  hasExistingReversal?: boolean;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onPost?: () => void | Promise<void>;
  onReverse?: (id: string) => Promise<JournalEntry | null> | JournalEntry | null | void;
  currentUser?: any;
}

const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({ 
  entry, lines, accounts, createdByName, statusLabel, hasExistingReversal = false, onClose, onApprove, onPost, onReverse, currentUser
}) => {
  const controlTotal = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const isReversalEntry = String(entry.sourceType || '').toUpperCase() === 'REVERSAL' || Boolean(entry.originalEntryId);
  const canReverse = entry.status === 'POSTED' && !isReversalEntry && !hasExistingReversal;
  const [isReversing, setIsReversing] = useState(false);

  const handleReverseClick = async () => {
    if (!canReverse || !onReverse || isReversing) return;

    setIsReversing(true);
    try {
      const result = await onReverse(entry.id);
      if (result) {
        onClose();
      }
    } finally {
      setIsReversing(false);
    }
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div
          className="p-6 border-b flex justify-between items-center"
          style={{
            backgroundColor: 'rgba(var(--acm-primary-rgb), 0.08)',
            borderColor: 'rgba(var(--acm-primary-rgb), 0.18)'
          }}
        >
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
              title="Back to Journal Entries"
            >
              <X size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div
              className="p-2 text-white rounded-xl shadow-md font-bold text-xs"
              style={{ backgroundColor: 'var(--acm-primary)' }}
            >
              VOUCHER
            </div>
            <div>
               <h3 className="text-lg font-bold text-slate-800 tracking-tight">Journal Entry Details</h3>
               <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{getJournalEntryReferenceNo(entry)}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Header Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <DetailItem label="Memo / Source" value={entry.description} icon={<BookText size={14} />} />
            <DetailItem label="Transaction Date" value={entry.date} />
            <DetailItem label="GL Reference" value={(entry.glEntryNumber || entry.reference || '—')} highlight />
            <DetailItem label="Source Type" value={entry.sourceType} />
            <DetailItem label="Transaction Total" value={renderAccountingAmount(controlTotal, 'font-mono')} />
            <DetailItem label="Status" value={
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                entry.status === 'REVERSED' ? 'bg-rose-100 text-rose-600' :
                'bg-blue-100 text-blue-700'
              }`}>
                {statusLabel}
              </span>
            } />
            <DetailItem label="Created By" value={createdByName} />
            <DetailItem label="Entry ID" value={entry.id} muted />
          </div>

          {/* Lines Table */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Account Code</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Account Title</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Memo</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Debit</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const acc = accounts.find(a => a.id === line.accountId);
                  return (
                    <tr key={line.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{acc?.code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{acc?.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-slate-600 italic line-clamp-1">{line.memo || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.debit > 0 ? renderAccountingAmount(line.debit) : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.credit > 0 ? renderAccountingAmount(line.credit) : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 font-black">
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="px-5 py-4 text-xs uppercase tracking-widest text-slate-400">Total Voucher Value</td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {renderAccountingAmount(controlTotal)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {renderAccountingAmount(lines.reduce((sum, l) => sum + (l.credit || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center bg-slate-50 -m-8 mt-4 p-8 border-t">
            <div className="flex gap-2">
               <button className="px-5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-slate-600 uppercase tracking-wide shadow-sm" onClick={() => window.print()}>Print Voucher</button>
            </div>
            <div className="flex gap-4">
               {(entry.status === 'DRAFT' || entry.status === 'ON_HOLD' || entry.status === 'PENDING_APPROVAL') && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                  <button onClick={() => { onApprove?.(entry.id); onClose(); }} className="px-10 py-3 bg-[#F47721] text-white rounded-2xl text-sm font-bold shadow-xl shadow-orange-100 hover:bg-[#E06610] active:scale-95 transition-all">Approve</button>
               )}
               {entry.status === 'APPROVED' && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                  <button onClick={() => { void onPost?.(); onClose(); }} className="px-10 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">Post to GL</button>
               )}
               {canReverse && (
                 <button
                   onClick={() => { void handleReverseClick(); }}
                   disabled={isReversing}
                   className="px-10 py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                 >
                    <RotateCcw size={16} /> Reverse Entry
                 </button>
               )}
               {entry.status === 'POSTED' && hasExistingReversal && !isReversalEntry && (
                 <span className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl">
                   Already Reversed
                 </span>
               )}
               <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-900 active:scale-95 transition-all">Back to List</button>
            </div>
          </div>
        </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; highlight?: boolean; mono?: boolean; muted?: boolean }> = ({ 
  label, value, icon, highlight, mono, muted 
}) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className={`text-sm font-bold ${highlight ? 'text-gray-900 cursor-default' : 'text-slate-800'} ${mono ? 'font-mono' : ''} ${muted ? 'text-slate-400 text-[11px]' : ''}`}>
      {value}
    </p>
  </div>
);

export default Ledger;

