import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Printer,
  RotateCcw,
  Search,
  User as UserIcon,
  Wallet
} from 'lucide-react';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { Payment, PaymentMethod, PaymentStatus, Sponsor, Student, User } from '../types';

interface ARCollectionReportViewProps {
  payments: Payment[];
  students: Student[];
  sponsors: Sponsor[];
  users?: User[];
  currency: string;
  brandColor?: string;
  orgName?: string;
  preparedBy?: string;
  onViewJournal?: (journalEntryId: string) => void;
}

type PeriodFilter = 'ALL' | 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
type PayorTypeFilter = 'ALL' | 'SPONSOR' | 'STUDENT';
type MethodFilter = 'ALL' | PaymentMethod;
type StatusFilter = 'ALL' | 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOIDED';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'LIST' | 'PREVIEW';

interface CollectionReportRow {
  payment: Payment;
  collectionDate: string;
  postPeriod: string;
  payorType: PayorTypeFilter;
  payorName: string;
  method: PaymentMethod;
  referenceNo: string;
  amountReceived: number;
  amountApplied: number;
  unappliedBalance: number;
  statusLabel: string;
  glReferenceNo: string;
  createdBy: string;
}

interface PreviewContext {
  rows: CollectionReportRow[];
  period: PeriodFilter;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
}

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' }
];

const methodOptions: Array<{ value: MethodFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'EWALLET', label: 'E-Wallet' },
  { value: 'OFFSET', label: 'Offset' }
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'On Hold' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'VOIDED', label: 'Voided' }
];

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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayKey = () => toDateKey(new Date());

const parseDateKey = (value?: string) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const getPeriodDateRange = (period: PeriodFilter, anchorDate?: string, currentFrom = '', currentTo = '') => {
  const anchorKey = anchorDate || currentFrom || currentTo || getTodayKey();
  const anchor = parseDateKey(anchorKey);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;

  switch (period) {
    case 'ALL':
      return { from: '', to: '' };
    case 'DAILY': {
      const from = currentFrom || anchorKey;
      const to = currentTo || from;
      return { from, to };
    }
    case 'MONTHLY':
      return {
        from: toDateKey(new Date(year, month, 1)),
        to: toDateKey(new Date(year, month + 1, 0))
      };
    case 'QUARTERLY':
      return {
        from: toDateKey(new Date(year, quarterStartMonth, 1)),
        to: toDateKey(new Date(year, quarterStartMonth + 3, 0))
      };
    case 'YEARLY':
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };
    default:
      return { from: currentFrom, to: currentTo };
  }
};

const getStatusLabel = (status: PaymentStatus) => {
  switch (status) {
    case 'DRAFT':
      return 'ON HOLD';
    case 'OPEN':
    case 'POSTED':
      return 'OPEN';
    case 'CLOSED':
      return 'CLOSED';
    case 'VOIDED':
      return 'VOIDED';
    default:
      return status;
  }
};

const getMethodLabel = (method: PaymentMethod) =>
  method
    .split('_')
    .map(part => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

const getReportPeriodLabel = (period: PeriodFilter) => {
  switch (period) {
    case 'DAILY':
      return 'Daily Collection Report';
    case 'MONTHLY':
      return 'Monthly Collection Report';
    case 'QUARTERLY':
      return 'Quarterly Collection Report';
    case 'YEARLY':
      return 'Yearly Collection Report';
    default:
      return 'Collection Report';
  }
};

const getReportDateLabel = (period: PeriodFilter, dateFrom: string, dateTo: string) => {
  if (period === 'DAILY' && dateFrom && dateTo && dateFrom !== dateTo) {
    return `${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
  }
  return formatDate(dateTo || dateFrom);
};

const escapeCsv = (value: any) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const escapeHtml = (value: any): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ARCollectionReportView: React.FC<ARCollectionReportViewProps> = ({
  payments,
  students,
  sponsors,
  users = [],
  currency,
  brandColor = '#4f46e5',
  orgName = 'Institution',
  preparedBy = 'AR Specialist',
  onViewJournal
}) => {
  const initialDateRange = getPeriodDateRange('MONTHLY');
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [previewContext, setPreviewContext] = useState<PreviewContext | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('MONTHLY');
  const [dateFrom, setDateFrom] = useState(initialDateRange.from);
  const [dateTo, setDateTo] = useState(initialDateRange.to);
  const [payorTypeFilter, setPayorTypeFilter] = useState<PayorTypeFilter>('ALL');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showPayorDropdown, setShowPayorDropdown] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({ key: 'collectionDate', direction: 'desc' });

  const formatCurrency = (amount: number) =>
    `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getPayorName = (payment: Payment) => {
    if (payment.sponsorId) {
      return sponsors.find(sponsor => sponsor.id === payment.sponsorId)?.name || 'Unknown Sponsor';
    }
    if (payment.studentId) {
      const student = students.find(item => item.id === payment.studentId);
      return student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
    }
    return 'Unassigned Payor';
  };

  const getPayorType = (payment: Payment): PayorTypeFilter =>
    payment.sponsorId ? 'SPONSOR' : payment.studentId ? 'STUDENT' : 'ALL';

  const getCreatedByName = (createdBy?: string) => {
    const creator = String(createdBy || '').trim();
    if (!creator) return '-';
    if (creator.toLowerCase() === 'system') return 'System';
    const user = users.find(item => item.id === creator || item.email === creator || item.name === creator);
    return user?.name || user?.email || creator;
  };

  const getGlReference = (payment: Payment) => {
    const ref = String(payment.glEntryNumber || '').trim();
    if (!ref) return payment.status === 'DRAFT' ? '-' : 'Pending';
    const match = ref.match(/^GL(?:\s*No\.?)?[\s-]*(\d+)$/i);
    return match ? `GL${match[1].padStart(8, '0')}` : ref;
  };

  const reportRows = useMemo<CollectionReportRow[]>(() => {
    return payments
      .filter(payment => !payment.isDeleted)
      .map(payment => ({
        payment,
        collectionDate: payment.paymentDate,
        postPeriod: formatPostPeriod(payment.paymentDate),
        payorType: getPayorType(payment),
        payorName: getPayorName(payment),
        method: payment.paymentMethod,
        referenceNo: payment.refNo || payment.checkNumber || '-',
        amountReceived: Number(payment.amountReceived || 0) + Number(payment.ewtAmountCertified || 0),
        amountApplied: Number(payment.totalApplied || 0),
        unappliedBalance: Math.max(Number(payment.customerDepositBalance || 0), 0),
        statusLabel: getStatusLabel(payment.status),
        glReferenceNo: getGlReference(payment),
        createdBy: getCreatedByName(payment.createdBy || payment.postedBy)
      }));
  }, [payments, sponsors, students, users]);

  const getFilteredRows = (from: string, to: string) => {
    const term = searchTerm.trim().toLowerCase();

    return reportRows
      .filter(row => {
        const paymentDate = row.payment.paymentDate?.slice(0, 10) || '';
        const matchesSearch =
          !term ||
          row.payment.paymentNo.toLowerCase().includes(term) ||
          (row.payment.crNo || '').toLowerCase().includes(term) ||
          row.payorName.toLowerCase().includes(term) ||
          getMethodLabel(row.method).toLowerCase().includes(term) ||
          row.referenceNo.toLowerCase().includes(term) ||
          row.glReferenceNo.toLowerCase().includes(term) ||
          row.createdBy.toLowerCase().includes(term);

        const matchesDates = (!from || paymentDate >= from) && (!to || paymentDate <= to);
        const matchesPayor = payorTypeFilter === 'ALL' || row.payorType === payorTypeFilter;
        const matchesMethod = methodFilter === 'ALL' || row.method === methodFilter;
        const matchesStatus =
          statusFilter === 'ALL'
            ? row.payment.status !== 'DRAFT' && row.payment.status !== 'VOIDED'
            : (statusFilter === 'OPEN' ? row.payment.status === 'OPEN' || row.payment.status === 'POSTED' : row.payment.status === statusFilter);

        return matchesSearch && matchesDates && matchesPayor && matchesMethod && matchesStatus;
      })
      .sort((a, b) => {
        const getSortValue = (row: CollectionReportRow) => {
          switch (sortConfig.key) {
            case 'collectionDate':
              return row.collectionDate || '';
            case 'postPeriod':
              return row.collectionDate || '';
            case 'paymentNo':
              return row.payment.paymentNo || '';
            case 'crNo':
              return row.payment.crNo || '';
            case 'payorType':
              return row.payorType;
            case 'payorName':
              return row.payorName;
            case 'method':
              return row.method;
            case 'referenceNo':
              return row.referenceNo;
            case 'amountReceived':
              return row.amountReceived;
            case 'amountApplied':
              return row.amountApplied;
            case 'unappliedBalance':
              return row.unappliedBalance;
            case 'status':
              return row.statusLabel;
            case 'glReferenceNo':
              return row.glReferenceNo;
            case 'createdBy':
              return row.createdBy;
            default:
              return '';
          }
        };

        const valueA = getSortValue(a);
        const valueB = getSortValue(b);
        const comparison =
          typeof valueA === 'number' && typeof valueB === 'number'
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' });

        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
  };

  const filteredRows = useMemo(
    () => getFilteredRows(dateFrom, dateTo),
    [dateFrom, dateTo, methodFilter, payorTypeFilter, reportRows, searchTerm, sortConfig, statusFilter]
  );

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows,
    setCurrentPage
  } = usePaginatedRows(filteredRows, [searchTerm, periodFilter, dateFrom, dateTo, payorTypeFilter, methodFilter, statusFilter, sortConfig]);

  const summary = useMemo(() => ({
    totalCollections: filteredRows.reduce((sum, row) => sum + row.amountReceived, 0),
    totalApplied: filteredRows.reduce((sum, row) => sum + row.amountApplied, 0),
    totalUnapplied: filteredRows.reduce((sum, row) => sum + row.unappliedBalance, 0),
    paymentCount: filteredRows.length
  }), [filteredRows]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    periodFilter !== 'MONTHLY' ||
    !!dateFrom ||
    !!dateTo ||
    payorTypeFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const clearFilters = () => {
    const range = getPeriodDateRange('MONTHLY');
    setSearchTerm('');
    setPeriodFilter('MONTHLY');
    setDateFrom(range.from);
    setDateTo(range.to);
    setPayorTypeFilter('ALL');
    setMethodFilter('ALL');
    setStatusFilter('CLOSED');
    setShowPeriodDropdown(false);
    setShowPayorDropdown(false);
    setShowMethodDropdown(false);
    setShowStatusDropdown(false);
  };

  const handlePeriodChange = (period: PeriodFilter) => {
    const range = getPeriodDateRange(period, dateFrom || dateTo || getTodayKey(), dateFrom, dateTo);
    setPeriodFilter(period);
    setDateFrom(range.from);
    setDateTo(range.to);
    setShowPeriodDropdown(false);
  };

  const handleDateFromChange = (value: string) => {
    if (periodFilter === 'MONTHLY' || periodFilter === 'QUARTERLY' || periodFilter === 'YEARLY') {
      const range = getPeriodDateRange(periodFilter, value || dateTo || getTodayKey());
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }

    setDateFrom(value);
    if (periodFilter === 'DAILY' && (!dateTo || dateTo < value)) {
      setDateTo(value);
    }
  };

  const handleDateToChange = (value: string) => {
    if (periodFilter === 'MONTHLY' || periodFilter === 'QUARTERLY' || periodFilter === 'YEARLY') {
      const range = getPeriodDateRange(periodFilter, value || dateFrom || getTodayKey());
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }

    setDateTo(value);
  };

  const handleGenerate = () => {
    const range = getPeriodDateRange(periodFilter, dateFrom || dateTo || getTodayKey(), dateFrom, dateTo);
    const generatedAtValue = new Date().toISOString();
    setDateFrom(range.from);
    setDateTo(range.to);
    setGeneratedAt(generatedAtValue);
    setPreviewContext({
      rows: getFilteredRows(range.from, range.to),
      period: periodFilter,
      dateFrom: range.from,
      dateTo: range.to,
      generatedAt: generatedAtValue
    });
    setViewMode('PREVIEW');
    setShowPeriodDropdown(false);
    setShowPayorDropdown(false);
    setShowMethodDropdown(false);
    setShowStatusDropdown(false);
  };

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown size={12} className="ml-1 text-white/50 opacity-0 transition-opacity group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-white" />
      : <ChevronDown size={12} className="ml-1 text-white" />;
  };

  const exportToCsv = (rowsToExport = filteredRows) => {
    const headers = [
      'Collection Date',
      'Post Period',
      'Payment No.',
      'C.R. No.',
      'Payor Type',
      'Payor Name',
      'Method',
      'Reference No.',
      'Amount Received',
      'Amount Applied',
      'Unapplied Balance',
      'Status',
      'GL Reference No.',
      'Created By'
    ];

    const rows = rowsToExport.map(row => [
      formatDate(row.collectionDate),
      row.postPeriod,
      row.payment.paymentNo || '-',
      row.payment.crNo || '-',
      row.payorType === 'ALL' ? '-' : row.payorType,
      row.payorName,
      getMethodLabel(row.method),
      row.referenceNo,
      row.amountReceived.toFixed(2),
      row.amountApplied.toFixed(2),
      row.unappliedBalance.toFixed(2),
      row.statusLabel,
      row.glReferenceNo,
      row.createdBy
    ]);

    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Collection_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPreviewExcel = () => {
    const context = previewContext;
    if (!context) return;
    const rows = context.rows;
    const methodSummary = getMethodSummary(rows);
    const esc = (value: any) =>
      String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
    const total = rows.reduce((sum, row) => sum + row.amountReceived, 0);
    const reportDate = getReportDateLabel(context.period, context.dateFrom, context.dateTo);

    let html = '<html><head><meta charset="utf-8"/><style>';
    html += 'body{font-family:Inter,"Open Sans","Segoe UI",Arial,sans-serif;color:#111}table{border-collapse:collapse;width:100%}th{background:#047a3b;color:#fff;font-weight:700}td,th{border:1px solid #d7dee8;padding:8px 10px;font-size:12px}td.num{text-align:right}h1,h2,h3{text-align:center;margin:4px 0}.summary{margin-top:14px;width:360px}.sign{margin-top:34px;width:100%}.line{border-bottom:1px solid #111;height:24px}';
    html += '</style></head><body>';
    html += `<h1>${esc(orgName)}</h1><h2>Collection Report</h2><h3>${esc(getReportPeriodLabel(context.period))}</h3>`;
    html += `<p style="text-align:center"><b>Date:</b> ${esc(reportDate)}</p>`;
    html += '<table><tr><th>SN</th><th>Payment No.</th><th>C.R. No.</th><th>Payor Type</th><th>Payor Name</th><th>Method</th><th>Reference No.</th><th>Amount Received</th><th>G.L. Reference</th></tr>';
    rows.forEach((row, index) => {
      html += `<tr><td>${index + 1}</td><td>${esc(row.payment.paymentNo || '-')}</td><td>${esc(row.payment.crNo || '-')}</td><td>${esc(row.payorType === 'SPONSOR' ? 'Sponsor' : row.payorType === 'STUDENT' ? 'Student' : '-')}</td><td>${esc(row.payorName)}</td><td>${esc(getMethodLabel(row.method).toUpperCase())}</td><td>${esc(row.referenceNo)}</td><td class="num">${esc(formatCurrency(row.amountReceived))}</td><td>${esc(row.glReferenceNo)}</td></tr>`;
    });
    html += `<tr><td colspan="7"></td><td><b>Grand Total Amount Received:</b></td><td class="num"><b>${esc(formatCurrency(total))}</b></td></tr></table>`;
    html += '<p><b>Total Collection per Payment Method</b></p><table class="summary"><tr><th>Method</th><th>Amount</th></tr>';
    methodSummary.forEach(item => {
      html += `<tr><td>${esc(item.label)}</td><td class="num">${esc(formatCurrency(item.amount))}</td></tr>`;
    });
    html += `<tr><td><b>Total</b></td><td class="num"><b>${esc(formatCurrency(total))}</b></td></tr></table>`;
    html += `<table class="sign"><tr><td style="border:none;width:50%"><table><tr><td style="border:none;width:100px;vertical-align:top;padding-top:4px">Prepared By:</td><td style="border:none;width:260px"><div class="line"></div><div style="text-align:center">${esc(preparedBy)}</div></td></tr></table></td><td style="border:none;width:50%"><table><tr><td style="border:none;width:100px;vertical-align:top;padding-top:4px">Reviewed By:</td><td style="border:none;width:260px"><div class="line"></div><div style="text-align:center">&nbsp;</div></td></tr></table></td></tr></table>`;
    html += '</body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Collection_Report_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (viewMode === 'PREVIEW') {
      window.print();
      return;
    }
    printPreviewReport();
  };

  const methodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'CHECK':
        return <CheckSquare size={14} className="text-slate-500" />;
      case 'BANK_TRANSFER':
        return <Landmark size={14} className="text-slate-500" />;
      case 'CREDIT_CARD':
        return <CreditCard size={14} className="text-slate-500" />;
      default:
        return <Wallet size={14} className="text-slate-500" />;
    }
  };

  const getMethodSummary = (rows: CollectionReportRow[]) => {
    const check = rows
      .filter(row => row.method === 'CHECK')
      .reduce((sum, row) => sum + row.amountReceived, 0);
    const cash = rows
      .filter(row => row.method === 'CASH')
      .reduce((sum, row) => sum + row.amountReceived, 0);
    const bankTransfer = rows
      .filter(row => row.method === 'BANK_TRANSFER')
      .reduce((sum, row) => sum + row.amountReceived, 0);
    const others = rows
      .filter(row => !['CHECK', 'CASH', 'BANK_TRANSFER'].includes(row.method))
      .reduce((sum, row) => sum + row.amountReceived, 0);

    return [
      { label: 'CHECK', amount: check },
      { label: 'CASH', amount: cash },
      { label: 'BANK TRANSFER', amount: bankTransfer },
      { label: 'OTHERS', amount: others }
    ];
  };

  const printPreviewReport = () => {
    const context = previewContext;
    if (!context) return;

    const rows = context.rows;
    const methodSummary = getMethodSummary(rows);
    const total = rows.reduce((sum, row) => sum + row.amountReceived, 0);
    const reportDate = getReportDateLabel(context.period, context.dateFrom, context.dateTo);
    const voucherAccent = '#006b2d';
    const reportTitle = getReportPeriodLabel(context.period);

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Collection Report</title><style>
      @page { size: A4; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing:border-box; }
      body { margin:0; font-family: Inter, "Open Sans", "Segoe UI", Arial, sans-serif; color:#111827; background:#fff; }
      .page { position:relative; width:210mm; min-height:297mm; margin:0 auto; padding:16mm; overflow:hidden; background:#fff; display:flex; flex-direction:column; }
      .muted, .sub { color:#6b7280; font-size:12px; }
      table { width:100%; border-collapse:collapse; font-size:10px; table-layout:fixed; }
      .band { background:${voucherAccent} !important; color:#fff !important; font-weight:700; }
      .print-box { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:1 1 auto; display:flex; flex-direction:column; margin-top:18px; }
      .summary { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:18px; }
      .section { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; }
      .section-title { background:${voucherAccent} !important; color:#fff !important; font-size:12px; font-weight:700; text-transform:uppercase; padding:6px 8px; }
      .section-body { padding:8px; }
      .row { display:flex; justify-content:space-between; gap:14px; padding:4px 0; font-size:12px; }
      .row span:first-child { color:#374151; }
      .row span:last-child { font-weight:700; text-align:right; }
      th { padding:6px 5px; text-align:left; font-size:9px; }
      td { padding:6px 5px; border-bottom:1px solid #d1d5db; vertical-align:top; word-break:break-word; }
      td.num, th.num { text-align:right; white-space:nowrap; }
      td.center, th.center { text-align:center; }
      .nothing-follows { flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#6b7280; font-size:11px; font-style:italic; letter-spacing:.08em; padding:12px 8px; }
      .method-grid { display:grid; grid-template-columns: minmax(0, 1fr) 230px; gap:18px; margin-top:18px; align-items:start; }
      .signatures { margin-top:18px; display:grid; grid-template-columns:repeat(3,1fr); border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:0 0 auto; }
      .sign-box { min-height:112px; display:flex; flex-direction:column; border-right:1px solid ${voucherAccent}; }
      .sign-box:last-child { border-right:0; }
      .sign-label { padding:10px 12px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .sign-space { flex:1; margin:42px 28px 18px; border-bottom:1px solid #111827; }
      .sign-name { text-align:center; font-size:11px; font-weight:700; margin-top:-14px; min-height:14px; }
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
            <div style="font-size:28px;font-weight:800;">${escapeHtml(orgName)}</div>
            <div style="margin-top:8px;font-size:13px;">${escapeHtml(orgName)}</div>
          </div>
          <div style="text-align:left;min-width:300px;">
            <div style="font-size:18px;font-weight:700;line-height:1;margin-bottom:8px;color:${voucherAccent};">Collection Report</div>
            <table style="font-size:14px;table-layout:auto;">
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Report Type:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(reportTitle)}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Date:</td><td style="padding:2px 0;text-align:right;border:0;">${escapeHtml(reportDate)}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Payments:</td><td style="padding:2px 0;text-align:right;border:0;">${rows.length}</td></tr>
            </table>
            <div class="muted" style="text-align:right;margin-top:6px;">Printed ${escapeHtml(new Date().toLocaleString('en-US'))}</div>
          </div>
        </div>

        <div class="summary">
          <div class="section">
            <div class="section-title">Report Filters</div>
            <div class="section-body">
              <div class="row"><span>Period</span><span>${escapeHtml(reportTitle)}</span></div>
              <div class="row"><span>Date From</span><span>${escapeHtml(formatDate(context.dateFrom))}</span></div>
              <div class="row"><span>Date To</span><span>${escapeHtml(formatDate(context.dateTo))}</span></div>
              <div class="row"><span>Status</span><span>${escapeHtml(activeStatusLabel)}</span></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Collection Summary</div>
            <div class="section-body">
              <div class="row"><span>No. of Payments</span><span>${rows.length}</span></div>
              <div class="row"><span>Total Collections</span><span>${formatCurrency(total)}</span></div>
              <div class="row"><span>Payor Type</span><span>${escapeHtml(activePayorLabel)}</span></div>
              <div class="row"><span>Method</span><span>${escapeHtml(activeMethodLabel)}</span></div>
            </div>
          </div>
        </div>

        <div class="print-box">
          <table>
            <thead>
              <tr class="band">
                <th style="width:28px;" class="center">SN</th>
                <th style="width:88px;">Payment No.</th>
                <th style="width:84px;">C.R. No.</th>
                <th style="width:58px;">Payor Type</th>
                <th>Payor Name</th>
                <th style="width:62px;">Method</th>
                <th style="width:76px;">Reference No.</th>
                <th style="width:82px;" class="num">Amount Received</th>
                <th style="width:82px;">G.L. Reference</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `<tr>
                <td class="center">${index + 1}</td>
                <td>${escapeHtml(row.payment.paymentNo || '-')}</td>
                <td>${escapeHtml(row.payment.crNo || '-')}</td>
                <td>${escapeHtml(row.payorType === 'SPONSOR' ? 'Sponsor' : row.payorType === 'STUDENT' ? 'Student' : '-')}</td>
                <td>${escapeHtml(row.payorName)}</td>
                <td>${escapeHtml(getMethodLabel(row.method).toUpperCase())}</td>
                <td>${escapeHtml(row.referenceNo)}</td>
                <td class="num">${formatCurrency(row.amountReceived)}</td>
                <td>${escapeHtml(row.glReferenceNo)}</td>
              </tr>`).join('') || `<tr><td colspan="9" class="center" style="padding:24px;color:#6b7280;font-style:italic;">No collections found for the generated filters.</td></tr>`}
              <tr>
                <td colspan="7" style="font-weight:800;text-align:right;">Grand Total Amount Received</td>
                <td class="num" style="font-weight:800;">${formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div class="nothing-follows">*** NOTHING FOLLOWS ***</div>
        </div>

        <div class="method-grid">
          <div class="section">
            <div class="section-title">Prepared Report Notes</div>
            <div class="section-body" style="min-height:86px;">Collection report generated from posted AR payment records using the selected filters.</div>
          </div>
          <div class="section">
            <div class="section-title">Payment Method Totals</div>
            <table>
              <tbody>
                ${methodSummary.map(item => `<tr><td>${escapeHtml(item.label)}</td><td class="num">${formatCurrency(item.amount)}</td></tr>`).join('')}
                <tr><td style="font-weight:800;">Total</td><td class="num" style="font-weight:800;">${formatCurrency(total)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="signatures">
          ${[
            { label: 'Prepared By:', name: preparedBy },
            { label: 'Reviewed By:', name: '' },
            { label: 'Approved By:', name: '' }
          ].map(item => `
            <div class="sign-box">
              <div class="sign-label">${escapeHtml(item.label)}</div>
              <div class="sign-space"></div>
              <div class="sign-name">${escapeHtml(item.name || '')}</div>
              <div class="sign-footer">NAME &amp; SIGNATURE</div>
            </div>
          `).join('')}
        </div>
        <div class="footer">Generated by ${escapeHtml(orgName)}</div>
      </div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const statusBadge = (status: PaymentStatus, label: string) => {
    const className =
      status === 'VOIDED'
        ? 'bg-rose-50 text-rose-700 border-rose-100'
        : status === 'DRAFT'
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : status === 'CLOSED'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : 'bg-blue-50 text-blue-700 border-blue-100';

    return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${className}`}>{label}</span>;
  };

  const columns = [
    { key: 'collectionDate', label: 'Collection Date', align: 'text-left' },
    { key: 'postPeriod', label: 'Post Period', align: 'text-left' },
    { key: 'paymentNo', label: 'Payment No.', align: 'text-left' },
    { key: 'crNo', label: 'C.R. No.', align: 'text-left' },
    { key: 'payorType', label: 'Payor Type', align: 'text-left' },
    { key: 'payorName', label: 'Payor Name', align: 'text-left' },
    { key: 'method', label: 'Method', align: 'text-left' },
    { key: 'referenceNo', label: 'Reference No.', align: 'text-left' },
    { key: 'amountReceived', label: 'Amount Received', align: 'text-right' },
    { key: 'amountApplied', label: 'Amount Applied', align: 'text-right' },
    { key: 'unappliedBalance', label: 'Unapplied Balance', align: 'text-right' },
    { key: 'status', label: 'Status', align: 'text-left' },
    { key: 'glReferenceNo', label: 'GL Reference No.', align: 'text-left' },
    { key: 'createdBy', label: 'Created By', align: 'text-left' }
  ];

  const activePeriodLabel = periodOptions.find(option => option.value === periodFilter)?.label || 'Monthly';
  const activeMethodLabel = methodOptions.find(option => option.value === methodFilter)?.label || 'All';
  const activeStatusLabel = statusOptions.find(option => option.value === statusFilter)?.label || 'All';
  const activePayorLabel = payorTypeFilter === 'ALL' ? 'All' : payorTypeFilter === 'SPONSOR' ? 'Sponsor' : 'Student';

  if (viewMode === 'PREVIEW' && previewContext) {
    const previewRows = previewContext.rows;
    const previewTotal = previewRows.reduce((sum, row) => sum + row.amountReceived, 0);
    const methodSummary = getMethodSummary(previewRows);
    const reportDateLabel = getReportDateLabel(previewContext.period, previewContext.dateFrom, previewContext.dateTo);

    return (
      <div className="space-y-5 pb-20 animate-in fade-in duration-500 print:pb-0">
        <style>{`
          .collection-report-voucher-page {
            box-sizing: border-box;
            width: 297mm;
            height: 210mm;
            margin: 0 auto;
            padding: 12mm 16mm;
            background: #fff;
            overflow: hidden;
          }
          .collection-report-voucher-table-wrap {
            border: 1px solid #d7dee8;
            border-radius: 6px;
            overflow: hidden;
          }
          .collection-report-voucher-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
            font-size: 13px;
          }
          .collection-report-voucher-table th {
            background: #006b2d;
            color: #fff;
            padding: 8px 10px;
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            border: 1px solid #d7dee8;
          }
          .collection-report-voucher-table td {
            padding: 9px 11px;
            border: 1px solid #d7dee8;
            vertical-align: middle;
            word-break: break-word;
          }
          @page { size: A4 landscape; margin: 0; }
          @media print {
            html,
            body {
              width: 297mm !important;
              min-height: 210mm !important;
              margin: 0 !important;
              background: #fff !important;
            }
            body * {
              visibility: hidden !important;
            }
            .collection-report-print-area,
            .collection-report-print-area * {
              visibility: visible !important;
            }
            .collection-report-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              box-sizing: border-box !important;
              width: 297mm !important;
              height: 210mm !important;
              padding: 9mm 12mm !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: 0 !important;
              border-radius: 0 !important;
              overflow: hidden !important;
            }
            .collection-report-header h1 {
              font-size: 18px !important;
              line-height: 1.15 !important;
              margin: 0 !important;
            }
            .collection-report-header h2,
            .collection-report-header h3 {
              font-size: 15px !important;
              line-height: 1.15 !important;
              margin-top: 5px !important;
            }
            .collection-report-date-line {
              margin-top: 9mm !important;
              gap: 8mm !important;
              font-size: 12px !important;
            }
            .collection-report-main-table {
              margin-top: 8mm !important;
            }
            .collection-report-print-table {
              min-width: 0 !important;
              width: 100% !important;
            }
            .collection-report-voucher-table {
              font-size: 10px !important;
            }
            .collection-report-voucher-table th {
              background: #006b2d !important;
              color: #fff !important;
              padding: 5px 6px !important;
              font-size: 10px !important;
              line-height: 1.15 !important;
            }
            .collection-report-voucher-table td {
              padding: 6px 7px !important;
              line-height: 1.2 !important;
            }
            .collection-report-method-summary {
              margin-top: 5mm !important;
              max-width: 78mm !important;
            }
            .collection-report-method-summary h3 {
              margin-bottom: 2mm !important;
              font-size: 11px !important;
            }
            .collection-report-signature-row {
              margin-top: 5mm !important;
              gap: 28mm !important;
              font-size: 10px !important;
            }
            .collection-report-signature-line {
              margin-top: 8mm !important;
            }
          }
        `}</style>
        {/* <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 print:hidden">
          <ArrowLeft size={18} />
          <span style={{ color: brandColor }}>Accounts Receivable</span>
          <ChevronDown size={16} className="-rotate-90 text-slate-300" />
          <button type="button" onClick={() => setViewMode('LIST')} className="font-semibold" style={{ color: brandColor }}>
            Collection Report
          </button>
          <ChevronDown size={16} className="-rotate-90 text-slate-300" />
          <span className="text-slate-900">Report Preview</span>
        </div> */}

        <div className="mx-auto flex w-full max-w-[297mm] flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
            Back to Collection Report
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-gray-50"
            >
              <FileText size={18} className="text-red-600" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={exportPreviewExcel}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-gray-50"
            >
              <FileSpreadsheet size={18} className="text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-gray-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Printer size={18} style={{ color: brandColor }} />
              Print
            </button>
          </div>
        </div>

        <section className="collection-report-print-area collection-report-voucher-page rounded-lg border border-gray-200 shadow-sm print:border-0 print:shadow-none">
          <div className="collection-report-header text-center text-black">
            <h1 className="text-2xl font-bold leading-tight">{orgName}</h1>
            <h2 className="mt-3 text-xl font-bold leading-tight">Collection Report</h2>
            <h3 className="mt-3 text-xl font-bold leading-tight">{getReportPeriodLabel(previewContext.period)}</h3>
          </div>

          <div className="collection-report-date-line mt-8 flex items-center gap-8">
            <div className="h-0.5 flex-1 bg-blue-500"></div>
            <div className="whitespace-nowrap text-base font-bold text-[#06146f]">Date: {reportDateLabel}</div>
            <div className="h-0.5 flex-1 bg-blue-500"></div>
          </div>

          <div className="collection-report-main-table collection-report-voucher-table-wrap mt-8">
            <table className="collection-report-print-table collection-report-voucher-table">
              <thead>
                <tr>
                  {['SN', 'Payment No.', 'C.R. No.', 'Payor Type', 'Payor Name', 'Method', 'Reference No.', 'Amount Received', 'G.L. Reference'].map(label => (
                    <th key={label} className={label === 'Amount Received' ? 'text-right' : label === 'SN' ? 'text-center' : ''}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={row.payment.id}>
                    <td className="text-center">{index + 1}</td>
                    <td className="text-center">{row.payment.paymentNo || '-'}</td>
                    <td className="text-center">{row.payment.crNo || '-'}</td>
                    <td className="text-center">{row.payorType === 'SPONSOR' ? 'Sponsor' : row.payorType === 'STUDENT' ? 'Student' : '-'}</td>
                    <td className="text-center">{row.payorName}</td>
                    <td className="text-center">{getMethodLabel(row.method).toUpperCase()}</td>
                    <td className="text-center">{row.referenceNo}</td>
                    <td className="text-right font-bold">{formatCurrency(row.amountReceived)}</td>
                    <td className="text-center">{row.glReferenceNo}</td>
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center italic text-slate-400">No collections found for the generated filters.</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5}></td>
                  <td colSpan={2} className="text-center font-extrabold">Grand Total Amount Received:</td>
                  <td className="text-right font-extrabold">{formatCurrency(previewTotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="collection-report-method-summary mt-5 w-full max-w-sm">
            <h3 className="mb-1 text-base font-semibold text-black">Total Collection per Payment Method</h3>
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="collection-report-voucher-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {methodSummary.map(item => (
                    <tr key={item.label}>
                      <td>{item.label}</td>
                      <td className="text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-extrabold">Total</td>
                    <td className="text-right font-extrabold">{formatCurrency(previewTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="collection-report-signature-row mt-8 grid grid-cols-2 gap-48 text-sm font-semibold text-black">
            <div className="flex items-end gap-4">
              <span className="whitespace-nowrap">Prepared By:</span>
              <div className="flex-1 text-center">
                <div className="collection-report-signature-line border-b border-black"></div>
                <div className="mt-2">{preparedBy || 'AR Specialist'}</div>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <span className="whitespace-nowrap">Reviewed By:</span>
              <div className="collection-report-signature-line flex-1 border-b border-black"></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 print:pb-0">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Collection Report</h2>
        <p className="text-sm text-gray-500 font-normal italic">Monitor actual collections received and their application to accounts receivable.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Collections</p>
          <p className="mt-6 text-2xl font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalCollections)}</p>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount Applied</p>
          <p className="mt-6 text-2xl font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalApplied)}</p>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Unapplied Balance</p>
          <p className="mt-6 text-2xl font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalUnapplied)}</p>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">No. of Payments</p>
          <p className="mt-6 text-2xl font-bold" style={{ color: brandColor }}>{summary.paymentCount}</p>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex h-10 w-full items-center rounded border border-gray-200 bg-white px-3 transition-colors hover:bg-gray-50 sm:w-72">
            <Search size={14} className="mr-2 text-gray-400" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="flex-1 border-none bg-transparent text-[13px] font-medium text-gray-700 outline-none placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <DropdownFilter
            label="Period"
            value={activePeriodLabel}
            isOpen={showPeriodDropdown}
            onToggle={() => setShowPeriodDropdown(prev => !prev)}
            onClose={() => setShowPeriodDropdown(false)}
          >
            {periodOptions.map(option => (
              <FilterOption
                key={option.value}
                active={periodFilter === option.value}
                brandColor={brandColor}
                onClick={() => handlePeriodChange(option.value)}
              >
                {option.label}
              </FilterOption>
            ))}
          </DropdownFilter>

          <div className="relative flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-3">
            <span className="text-[13px] font-medium text-slate-500">Date From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={event => handleDateFromChange(event.target.value)}
              className="w-32 border-none bg-transparent text-[13px] font-bold text-slate-800 outline-none"
            />
          </div>

          <div className="relative flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-3">
            <span className="text-[13px] font-medium text-slate-500">Date To</span>
            <input
              type="date"
              value={dateTo}
              onChange={event => handleDateToChange(event.target.value)}
              className="w-32 border-none bg-transparent text-[13px] font-bold text-slate-800 outline-none"
            />
          </div>

          <DropdownFilter
            label="Payor Type"
            value={activePayorLabel}
            isOpen={showPayorDropdown}
            onToggle={() => setShowPayorDropdown(prev => !prev)}
            onClose={() => setShowPayorDropdown(false)}
          >
            {(['ALL', 'SPONSOR', 'STUDENT'] as PayorTypeFilter[]).map(option => (
              <FilterOption
                key={option}
                active={payorTypeFilter === option}
                brandColor={brandColor}
                onClick={() => { setPayorTypeFilter(option); setShowPayorDropdown(false); }}
              >
                {option === 'ALL' ? 'All Payors' : option === 'SPONSOR' ? 'Sponsor' : 'Student'}
              </FilterOption>
            ))}
          </DropdownFilter>

          <DropdownFilter
            label="Method"
            value={activeMethodLabel}
            isOpen={showMethodDropdown}
            onToggle={() => setShowMethodDropdown(prev => !prev)}
            onClose={() => setShowMethodDropdown(false)}
          >
            {methodOptions.map(option => (
              <FilterOption
                key={option.value}
                active={methodFilter === option.value}
                brandColor={brandColor}
                onClick={() => { setMethodFilter(option.value); setShowMethodDropdown(false); }}
              >
                {option.label}
              </FilterOption>
            ))}
          </DropdownFilter>

          <DropdownFilter
            label="Status"
            value={activeStatusLabel}
            isOpen={showStatusDropdown}
            onToggle={() => setShowStatusDropdown(prev => !prev)}
            onClose={() => setShowStatusDropdown(false)}
          >
            {statusOptions.map(option => (
              <FilterOption
                key={option.value}
                active={statusFilter === option.value}
                brandColor={brandColor}
                onClick={() => { setStatusFilter(option.value); setShowStatusDropdown(false); }}
              >
                {option.label}
              </FilterOption>
            ))}
          </DropdownFilter>

          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 w-10 items-center justify-center rounded text-slate-400 transition-colors hover:bg-gray-50"
            style={hasActiveFilters ? { color: brandColor } : undefined}
            title="Clear filters"
          >
            <RotateCcw size={17} />
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-bold text-white shadow-sm transition-all"
            style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -14px ${brandColor}` }}
          >
            <BarChart3 size={16} />
            Generate
          </button>

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setShowExportDropdown(prev => !prev)}
              className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-4 text-[13px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Export
              <Download size={14} className="text-slate-400" />
            </button>
            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)}></div>
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setShowExportDropdown(false); exportToCsv(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:bg-gray-50"
                  >
                    <Download size={15} style={{ color: brandColor }} />
                    Export as CSV
                  </button>
                </div>
              </>
            )}
          </div>

          {/* <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-white px-4 text-[13px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Printer size={17} />
            
          </button> */}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] font-sans">
            <thead style={{ backgroundColor: brandColor }}>
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    className={`group select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors ${column.align}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={`flex w-full cursor-pointer items-center text-[13px] font-bold text-white ${column.align === 'text-right' ? 'justify-end' : ''}`}
                    >
                      {column.label} <SortIndicator columnKey={column.key} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.map(row => (
                <tr
                  key={row.payment.id}
                  className="transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{formatDate(row.collectionDate)}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.postPeriod}</td>
                  <td className="px-4 py-4 text-xs font-bold" style={{ color: brandColor }}>{row.payment.paymentNo || '-'}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.payment.crNo || '-'}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.payorType === 'ALL' ? '-' : row.payorType === 'SPONSOR' ? 'Sponsor' : 'Student'}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-2">
                      {row.payorType === 'SPONSOR' ? <Building2 size={14} className="text-slate-400" /> : <UserIcon size={14} className="text-slate-400" />}
                      {row.payorName}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-2">{methodIcon(row.method)} {getMethodLabel(row.method)}</span>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.referenceNo}</td>
                  <td className="px-4 py-4 text-right text-xs font-bold text-slate-800">{formatCurrency(row.amountReceived)}</td>
                  <td className="px-4 py-4 text-right text-xs font-bold text-slate-800">{formatCurrency(row.amountApplied)}</td>
                  <td className="px-4 py-4 text-right text-xs font-bold text-slate-800">{formatCurrency(row.unappliedBalance)}</td>
                  <td className="px-4 py-4">{statusBadge(row.payment.status, row.statusLabel)}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">
                    {row.payment.journalEntryId && onViewJournal ? (
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          onViewJournal(row.payment.journalEntryId!);
                        }}
                        className="font-bold hover:underline"
                        style={{ color: brandColor }}
                      >
                        {row.glReferenceNo}
                      </button>
                    ) : (
                      row.glReferenceNo
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slate-700">{row.createdBy}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-20 text-center text-sm italic text-gray-400">No collections found for the current search and filters.</td>
                </tr>
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-left text-sm font-bold text-slate-700">Grand Totals:</td>
                  <td className="px-4 py-4 text-right text-sm font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalCollections)}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalApplied)}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold" style={{ color: brandColor }}>{formatCurrency(summary.totalUnapplied)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="collections"
        />
      </section>

      <div className="hidden text-xs text-slate-500 print:block">Generated: {formatDate(generatedAt)}</div>

    </div>
  );
};

interface DropdownFilterProps {
  label: string;
  value: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

const DropdownFilter: React.FC<DropdownFilterProps> = ({ label, value, isOpen, onToggle, onClose, children }) => (
  <div className="relative">
    <button
      type="button"
      onClick={onToggle}
      className="relative flex h-10 min-w-[150px] items-center rounded border border-gray-200 bg-white px-3 text-left transition-colors hover:bg-gray-50"
    >
      <span className="mr-1 truncate text-[13px] text-gray-500">{label}:</span>
      <span className="truncate pr-5 text-[13px] font-bold text-gray-800">{value}</span>
      <ChevronDown size={14} className="absolute right-2 text-gray-400" />
    </button>
    {isOpen && (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose}></div>
        <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
          <div className="p-1">{children}</div>
        </div>
      </>
    )}
  </div>
);

interface FilterOptionProps {
  active: boolean;
  brandColor: string;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterOption: React.FC<FilterOptionProps> = ({ active, brandColor, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded px-3 py-2 text-left text-[13px] transition-colors ${active ? 'font-bold text-white' : 'font-semibold text-slate-700 hover:bg-gray-100'}`}
    style={active ? { backgroundColor: brandColor } : undefined}
  >
    {children}
  </button>
);

export default ARCollectionReportView;
