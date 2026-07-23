import React, { useMemo, useState, useEffect } from 'react';
import {
  Vendor, Payable, PayableCategory, PayableStatus, InvoiceType, PaymentMethod,
  PayablePaymentMethod, WithholdingType, ChartOfAccount, JournalEntry, JournalLine, AccountClass, BankAccount, PurchaseOrder, Qualification
} from '../types';
import { AccountingService } from '../accountingService';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';
import {
  Search, Calculator, Building, Coins, AlertCircle, Calendar,
  X, Plus, FileText, Edit, Trash2, Eye, CheckCircle, Clock,
  DollarSign, ChevronDown, RefreshCw, CreditCard,
  BookOpen, Landmark, Receipt, TrendingUp, ArrowRight,
  Percent, Banknote, BarChart3, PieChart, Download, Printer, RotateCcw
} from 'lucide-react';

interface PayablesViewProps {
  view?: 'bills' | 'aging';
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  qualifications: Qualification[];
  entries: JournalEntry[];
  bankAccounts?: BankAccount[];
  purchaseOrders?: PurchaseOrder[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  currentUserId?: string;
  onCreatePayable: (payable: Payable) => Payable | Promise<Payable>;
  onUpdatePayable: (id: string, updates: Partial<Payable>) => void;
  onDeletePayable: (id: string) => void;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => JournalEntry | null | Promise<JournalEntry | null>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type APTab = 'list' | 'aging' | 'reconciliation';

const PAYABLE_CATEGORIES: { value: PayableCategory; label: string }[] = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'training_materials', label: 'Training Materials' },
  { value: 'contractor_services', label: 'Contractor Services' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'government_obligations', label: 'Government Obligations' },
  { value: 'scholarship_advances', label: 'Scholarship Advances' },
  { value: 'employee_reimbursements', label: 'Employee Reimbursements' },
  { value: 'other', label: 'Other' },
];

const INVOICE_TYPES: { value: InvoiceType; label: string; color: string }[] = [
  { value: 'standard', label: 'Standard Invoice', color: 'text-gray-600' },
  { value: 'prepayment', label: 'Prepayment/Advance', color: 'text-violet-600' },
  { value: 'credit_memo', label: 'Credit Memo', color: 'text-brand' },
  { value: 'debit_memo', label: 'Debit Memo', color: 'text-rose-600' },
];

const PAYMENT_METHODS: { value: PayablePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'AUTO_DEBIT', label: 'Auto Debit' },
  { value: 'EWALLET', label: 'E-Wallet' },
];

const STATUS_CONFIG: Record<PayableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  for_approval: { label: 'For Approval', color: 'text-brand', bgColor: 'bg-brand/10', borderColor: 'border-brand-light' },
  approved: { label: 'Approved', color: 'text-brand', bgColor: 'bg-brand/10', borderColor: 'border-brand-light' },
  paid: { label: 'Paid', color: 'text-brand', bgColor: 'bg-brand/10', borderColor: 'border-brand-light' },
  partially_paid: { label: 'Partially Paid', color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
};

const formatPayableDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const PAGE_SIZE = 10;
const PAYABLE_COLUMNS = 'id,org_id,vendor_id,payable_number,category,qualification_id,description,amount,bill_date,due_date,payment_date,currency,status,reference_document,journal_entry_id,gl_account_id,expense_account_id,notes,withholding_type,atc_item_id,atc_rate_id,applied_rate_percent,withholding_amount,net_payable,paid_amount,created_by,approved_by,paid_by,created_at,updated_at,approved_at,paid_at,is_deleted,deleted_at,deleted_by';

const getPayableOutstanding = (payable: Payable) => Math.max(0, (payable.netPayable || payable.amount) - (payable.paidAmount || 0));

const PayablesView: React.FC<PayablesViewProps> = ({
  view = 'bills',
  orgId,
  payables,
  vendors,
  accounts,
  qualifications = [],
  entries,
  bankAccounts = [],
  purchaseOrders = [],
  vendorTaxSettings = [],
  atcCategories = [],
  atcItems = [],
  atcRates = [],
  currentUserId,
  onCreatePayable,
  onUpdatePayable,
  onDeletePayable,
  onPostJournal,
  onNotify
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [activeTab, setActiveTab] = useState<APTab>(view === 'aging' ? 'aging' : 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayableStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPostGLModal, setShowPostGLModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [paymentPayables, setPaymentPayables] = useState<Payable[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<Record<string, number>>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverPayables, setServerPayables] = useState<Payable[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');
  const [isSavingPayable, setIsSavingPayable] = useState(false);

  // Form state for Create/Edit
  const [formData, setFormData] = useState<Partial<Payable>>({
    vendorId: '',
    payableNumber: '',
    category: 'other',
    qualificationId: '',
    description: '',
    amount: 0,
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    currency: 'PHP',
    status: 'for_approval',
    referenceDocument: '',
    glAccountId: '',
    expenseAccountId: '',
    notes: '',
    withholdingType: undefined,
    appliedRatePercent: 0,
    withholdingAmount: 0,
    netPayable: 0,
    invoiceType: 'standard',
    inputVatAmount: 0,
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'BANK_TRANSFER' as PayablePaymentMethod,
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountPaid: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const allocatedPaymentTotal = Object.values(paymentAllocations).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const vendorPaymentOutstanding = paymentPayables.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0);

  // ============================================================================
  // MULTI-TENANT FILTERING
  // ============================================================================
  const orgPayables = useMemo(() =>
    payables.filter(p => p.orgId === orgId && !p.isDeleted),
    [payables, orgId]
  );

  const orgVendors = useMemo(() =>
    vendors.filter(v => v.orgId === orgId && !v.isDeleted),
    [vendors, orgId]
  );

  const orgAccounts = useMemo(() =>
    accounts.filter(a => a.orgId === orgId && !a.isDeleted),
    [accounts, orgId]
  );

  const orgEntries = useMemo(() =>
    entries.filter(e => e.orgId === orgId && e.status !== 'REVERSED'),
    [entries, orgId]
  );

  const orgBankAccounts = useMemo(() =>
    bankAccounts.filter(b => b.orgId === orgId && !b.isDeleted),
    [bankAccounts, orgId]
  );

  const orgVendorTaxSettings = useMemo(() =>
    vendorTaxSettings.filter((s: any) => s.orgId === orgId),
    [vendorTaxSettings, orgId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, statusFilter, vendorFilter]);

  const payableFilters = useMemo(() => {
    const filters: PageFilter[] = [
      { column: 'org_id', operator: 'eq', value: orgId },
      { column: 'is_deleted', operator: 'eq', value: false }
    ];

    if (statusFilter !== 'all') {
      filters.push({ column: 'status', operator: 'eq', value: statusFilter });
    }
    if (vendorFilter !== 'all') {
      filters.push({ column: 'vendor_id', operator: 'eq', value: vendorFilter });
    }

    return filters;
  }, [orgId, statusFilter, vendorFilter]);

  useEffect(() => {
    if (!orgId || activeTab !== 'list') return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Payable>('payables', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: PAYABLE_COLUMNS,
      filters: payableFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['payable_number', 'description', 'reference_document'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: [{ column: 'bill_date', ascending: false }, { column: 'created_at', ascending: false }]
    })
      .then(result => {
        if (!isActive) return;
        setServerPayables(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[PayablesView] Failed to load payable page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load payables.');
        setServerPayables([]);
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
  }, [activeTab, currentPage, debouncedSearchTerm, orgId, payableFilters, refreshKey]);

  // Get expense and liability accounts for dropdown
  const expenseAccounts = useMemo(() =>
    orgAccounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader),
    [orgAccounts]
  );

  const liabilityAccounts = useMemo(() =>
    orgAccounts.filter(a => a.class === AccountClass.LIABILITY && !a.isHeader),
    [orgAccounts]
  );

  const assetAccounts = useMemo(() =>
    orgAccounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader),
    [orgAccounts]
  );

  // Find AP control account and withholding tax payable account
  const apControlAccount = useMemo(() =>
    liabilityAccounts.find(a => a.code?.startsWith('2100') || a.name.toLowerCase().includes('accounts payable')),
    [liabilityAccounts]
  );

  const withholdingTaxAccount = useMemo(() =>
    liabilityAccounts.find(a => a.name.toLowerCase().includes('withholding') || a.code?.startsWith('2150')),
    [liabilityAccounts]
  );

  const inputVatAccount = useMemo(() =>
    assetAccounts.find(a => a.name.toLowerCase().includes('input vat') || a.name.toLowerCase().includes('input tax') || a.code?.startsWith('1170')),
    [assetAccounts]
  );

  // ============================================================================
  // AUTO-GENERATE REFERENCE NUMBER
  // ============================================================================
  const nextPayableNumber = useMemo(() => {
    const prefix = formData.invoiceType === 'credit_memo'
      ? 'CM'
      : formData.invoiceType === 'debit_memo'
        ? 'DM'
        : 'BILL';
    const year = new Date().getFullYear();
    const matcher = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
    const highestSequence = payables
      .filter(payable => payable.orgId === orgId)
      .reduce((highest, payable) => {
      const match = payable.payableNumber?.match(matcher);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);

    return `${prefix}-${year}-${String(highestSequence + 1).padStart(5, '0')}`;
  }, [formData.invoiceType, orgId, payables]);

  useEffect(() => {
    if (showCreateModal) {
      setFormData(prev => prev.payableNumber === nextPayableNumber
        ? prev
        : { ...prev, payableNumber: nextPayableNumber });
    }
  }, [showCreateModal, nextPayableNumber]);

  // ============================================================================
  // AUTO-RESOLVE WITHHOLDING FROM VENDOR TAX SETTINGS
  // ============================================================================
  useEffect(() => {
    if (!formData.vendorId) {
      setFormData(prev => ({
        ...prev,
        withholdingType: undefined,
        appliedRatePercent: 0,
        withholdingAmount: 0,
      }));
      return;
    }

    const setting = orgVendorTaxSettings.find((s: any) => s.vendorId === formData.vendorId && s.isActive);
    if (!setting) {
      setFormData(prev => ({
        ...prev,
        withholdingType: undefined,
        appliedRatePercent: 0,
        withholdingAmount: 0,
      }));
      return;
    }

    setFormData(prev => ({ ...prev, withholdingType: setting.withholdingType }));

    // Resolve rate from atcRates
    let rateRow: any | undefined = undefined;
    if (setting.atcRateId) {
      rateRow = atcRates.find((r: any) => r.id === setting.atcRateId);
    } else if (setting.atcItemId && setting.withholdingType) {
      const candidates = atcRates.filter((r: any) => r.atcItemId === setting.atcItemId && r.withholdingType === setting.withholdingType);
      candidates.sort((a: any, b: any) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
      rateRow = candidates[0];
    }

    const rate = rateRow?.ratePercent ?? 0;
    setFormData(prev => ({ ...prev, appliedRatePercent: rate }));
  }, [formData.vendorId, orgVendorTaxSettings, atcRates]);

  // ============================================================================
  // AUTO-CALCULATE WITHHOLDING & NET PAYABLE
  // ============================================================================
  useEffect(() => {
    const amount = formData.amount || 0;
    const rate = formData.appliedRatePercent || 0;
    const inputVat = formData.inputVatAmount || 0;
    const withholdingAmount = Number((amount * rate).toFixed(2));
    // For credit memos, net payable is negative
    const multiplier = formData.invoiceType === 'credit_memo' ? -1 : 1;
    const netPayable = Number(((amount + inputVat - withholdingAmount) * multiplier).toFixed(2));

    setFormData(prev => ({
      ...prev,
      withholdingAmount,
      netPayable,
    }));
  }, [formData.amount, formData.appliedRatePercent, formData.inputVatAmount, formData.invoiceType]);

  // Auto-calculate due date based on vendor payment terms
  useEffect(() => {
    if (formData.vendorId && formData.billDate) {
      const vendor = orgVendors.find(v => v.id === formData.vendorId);
      if (vendor?.paymentTermsDays !== undefined) {
        const billDate = new Date(formData.billDate);
        billDate.setDate(billDate.getDate() + vendor.paymentTermsDays);
        setFormData(prev => ({ ...prev, dueDate: billDate.toISOString().slice(0, 10) }));
      }
    }
  }, [formData.vendorId, formData.billDate, orgVendors]);

  // ============================================================================
  // FILTERING & SEARCHING
  // ============================================================================
  const filteredPayables = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return orgPayables
      .filter(p => {
        const vendorName = orgVendors.find(v => v.id === p.vendorId)?.name || '';
        const statusLabel = STATUS_CONFIG[p.status]?.label || '';
        const qualification = qualifications.find(q => q.id === p.qualificationId);
        const categoryLabel = qualification ? `${qualification.code} ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === p.category)?.label || p.category);
        const searchableText = [
          p.payableNumber,
          p.description,
          vendorName,
          p.referenceDocument || '',
          p.billDate,
          p.dueDate,
          categoryLabel,
          statusLabel,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        const matchesVendor = vendorFilter === 'all' || p.vendorId === vendorFilter;

        return matchesSearch && matchesStatus && matchesVendor;
      })
      .sort((a, b) => (b.billDate || '').localeCompare(a.billDate || ''));
  }, [orgPayables, debouncedSearchTerm, statusFilter, vendorFilter, orgVendors, qualifications]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedPayables,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(filteredPayables, [debouncedSearchTerm, statusFilter, vendorFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError;
  const paginatedPayables = useFallbackRows ? fallbackPaginatedPayables : serverPayables;
  const totalItems = useFallbackRows ? filteredPayables.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverPayables.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;
  const payablePaymentEligible = (payable: Payable) => payable.status === 'approved' || payable.status === 'partially_paid';
  const eligiblePagePayables = paginatedPayables.filter(payablePaymentEligible);
  const allEligiblePageSelected = eligiblePagePayables.length > 0 && eligiblePagePayables.every(payable => selectedPaymentIds.includes(payable.id));

  const togglePagePaymentSelection = () => {
    const pageIds = eligiblePagePayables.map(payable => payable.id);
    setSelectedPaymentIds(current => allEligiblePageSelected
      ? current.filter(id => !pageIds.includes(id))
      : Array.from(new Set([...current, ...pageIds]))
    );
  };

  useEffect(() => {
    setSelectedPaymentIds([]);
  }, [activePage, debouncedSearchTerm, statusFilter, vendorFilter, orgId]);

  const hasActiveListFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    vendorFilter !== 'all';

  // ============================================================================
  // SUMMARY METRICS
  // ============================================================================
  const summaryMetrics = useMemo(() => {
    const openPayables = orgPayables.filter(p => p.status !== 'paid' && p.status !== 'cancelled');
    const total = openPayables.reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const forApproval = orgPayables.filter(p => p.status === 'for_approval').reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const approved = orgPayables.filter(p => p.status === 'approved' || p.status === 'partially_paid').reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const paid = orgPayables.reduce((sum, p) => sum + (p.paidAmount || (p.status === 'paid' ? (p.netPayable || p.amount) : 0)), 0);

    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoon = openPayables.filter(p =>
      new Date(p.dueDate) <= sevenDaysFromNow
    ).reduce((sum, p) => sum + getPayableOutstanding(p), 0);

    const overdue = openPayables.filter(p => new Date(p.dueDate) < today)
      .reduce((sum, p) => sum + getPayableOutstanding(p), 0);

    return { total, forApproval, approved, paid, dueSoon, overdue };
  }, [orgPayables]);

  // ============================================================================
  // AGING BUCKETS
  // ============================================================================
  const agingBuckets = useMemo(() => {
    const today = new Date();
    const buckets = {
      current: { count: 0, amount: 0 },
      days30: { count: 0, amount: 0 },
      days60: { count: 0, amount: 0 },
      days90: { count: 0, amount: 0 },
      days120Plus: { count: 0, amount: 0 }
    };

    const openPayables = orgPayables.filter(p =>
      p.status !== 'paid' && p.status !== 'cancelled' &&
      (vendorFilter === 'all' || p.vendorId === vendorFilter)
    );

    openPayables.forEach(p => {
      const dueDate = new Date(p.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = getPayableOutstanding(p);

      if (daysOverdue <= 0) {
        buckets.current.count++;
        buckets.current.amount += amount;
      } else if (daysOverdue <= 30) {
        buckets.days30.count++;
        buckets.days30.amount += amount;
      } else if (daysOverdue <= 60) {
        buckets.days60.count++;
        buckets.days60.amount += amount;
      } else if (daysOverdue <= 90) {
        buckets.days90.count++;
        buckets.days90.amount += amount;
      } else {
        buckets.days120Plus.count++;
        buckets.days120Plus.amount += amount;
      }
    });

    return buckets;
  }, [orgPayables, vendorFilter]);

  // ============================================================================
  // VENDOR BALANCES FOR RECONCILIATION
  // ============================================================================
  const vendorBalances = useMemo(() => {
    const balances: Record<string, { vendor: Vendor; balance: number; invoiceCount: number }> = {};

    orgPayables.filter(p => p.status !== 'cancelled').forEach(p => {
      if (!balances[p.vendorId]) {
        const vendor = orgVendors.find(v => v.id === p.vendorId);
        if (vendor) {
          balances[p.vendorId] = { vendor, balance: 0, invoiceCount: 0 };
        }
      }
      if (balances[p.vendorId]) {
        const amount = getPayableOutstanding(p);
        if (p.status === 'paid') {
          // Paid invoices don't add to balance
        } else if (p.invoiceType === 'credit_memo') {
          balances[p.vendorId].balance -= Math.abs(amount);
        } else {
          balances[p.vendorId].balance += amount;
        }
        balances[p.vendorId].invoiceCount++;
      }
    });

    return Object.values(balances).sort((a, b) => b.balance - a.balance);
  }, [orgPayables, orgVendors]);

  // Total AP Subledger
  const totalApSubledger = useMemo(() =>
    vendorBalances.reduce((sum, v) => sum + v.balance, 0),
    [vendorBalances]
  );

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================
  const resetForm = () => {
    setFormData({
      vendorId: '',
      payableNumber: '',
      category: 'other',
      qualificationId: '',
      description: '',
      amount: 0,
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      currency: 'PHP',
      status: 'for_approval',
      referenceDocument: '',
      glAccountId: '',
      expenseAccountId: '',
      notes: '',
      withholdingType: undefined,
      appliedRatePercent: 0,
      withholdingAmount: 0,
      netPayable: 0,
      invoiceType: 'standard',
      inputVatAmount: 0,
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: 0,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const populateEditForm = (payable: Payable) => {
    setSelectedPayable(payable);
    setFormData({
      vendorId: payable.vendorId,
      payableNumber: payable.payableNumber,
      category: payable.category,
      qualificationId: payable.qualificationId || '',
      description: payable.description,
      amount: payable.amount,
      billDate: payable.billDate,
      dueDate: payable.dueDate,
      currency: payable.currency || 'PHP',
      status: payable.status,
      referenceDocument: payable.referenceDocument || '',
      glAccountId: payable.glAccountId || '',
      expenseAccountId: payable.expenseAccountId || '',
      notes: payable.notes || '',
      withholdingType: payable.withholdingType,
      appliedRatePercent: payable.appliedRatePercent || 0,
      withholdingAmount: payable.withholdingAmount || 0,
      netPayable: payable.netPayable || payable.amount,
      invoiceType: payable.invoiceType || 'standard',
      inputVatAmount: payable.inputVatAmount || 0,
    });
    setShowEditModal(true);
  };

  const openEditModal = async (payable: Payable) => {
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 1,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'id', operator: 'eq', value: payable.id },
          { column: 'org_id', operator: 'eq', value: orgId }
        ]
      });
      populateEditForm(result.rows[0] || payable);
    } catch (error) {
      console.error('[PayablesView] Failed to refresh payable for editing:', error);
      populateEditForm(payable);
      onNotify('info', 'Using the currently loaded bill details because the latest record could not be refreshed.');
    }
  };

  const openViewModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowViewModal(true);
  };

  const openPaymentModal = async (payable: Payable) => {
    let vendorPayables = orgPayables.filter(candidate =>
      candidate.vendorId === payable.vendorId &&
      (candidate.status === 'approved' || candidate.status === 'partially_paid') &&
      getPayableOutstanding(candidate) > 0
    );
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 200,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'org_id', operator: 'eq', value: orgId },
          { column: 'vendor_id', operator: 'eq', value: payable.vendorId },
          { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
          { column: 'is_deleted', operator: 'eq', value: false }
        ],
        orderBy: [{ column: 'due_date', ascending: true }, { column: 'bill_date', ascending: true }]
      });
      vendorPayables = result.rows.filter(candidate => getPayableOutstanding(candidate) > 0);
    } catch (error) {
      console.error('[PayablesView] Failed to load vendor payables for payment:', error);
    }
    setSelectedPayable(payable);
    setPaymentPayables(vendorPayables);
    const remainingAmount = getPayableOutstanding(payable);
    setPaymentAllocations(allocatePaymentOldestFirst(vendorPayables, remainingAmount));
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: remainingAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const allocatePaymentOldestFirst = (payablesToAllocate: Payable[], paymentAmount: number) => {
    let remaining = Math.max(0, paymentAmount);
    return [...payablesToAllocate]
      .sort((a, b) => (a.dueDate || a.billDate).localeCompare(b.dueDate || b.billDate))
      .reduce<Record<string, number>>((allocations, payable) => {
        const allocated = Math.min(getPayableOutstanding(payable), remaining);
        allocations[payable.id] = Math.round(allocated * 100) / 100;
        remaining = Math.round((remaining - allocated) * 100) / 100;
        return allocations;
      }, {});
  };

  const openMultiplePaymentModal = async () => {
    const selected = paginatedPayables.filter(payable =>
      selectedPaymentIds.includes(payable.id) &&
      (payable.status === 'approved' || payable.status === 'partially_paid')
    );
    if (selected.length === 0) {
      onNotify('error', 'Select at least one approved payable to process.');
      return;
    }
    const vendorIds = Array.from(new Set(selected.map(payable => payable.vendorId)));
    if (vendorIds.length !== 1) {
      onNotify('error', 'Multiple payments can only be processed for one vendor at a time.');
      return;
    }
    let vendorPayables = orgPayables.filter(payable =>
      payable.vendorId === vendorIds[0] && payablePaymentEligible(payable) && getPayableOutstanding(payable) > 0
    );
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 200,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'org_id', operator: 'eq', value: orgId },
          { column: 'vendor_id', operator: 'eq', value: vendorIds[0] },
          { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
          { column: 'is_deleted', operator: 'eq', value: false }
        ],
        orderBy: [{ column: 'due_date', ascending: true }, { column: 'bill_date', ascending: true }]
      });
      vendorPayables = result.rows.filter(payable => getPayableOutstanding(payable) > 0);
    } catch (error) {
      console.error('[PayablesView] Failed to load vendor payables for allocation:', error);
    }
    const totalOutstanding = vendorPayables.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0);
    const initialPayment = Math.min(
      selected.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0),
      totalOutstanding
    );
    setSelectedPayable(null);
    setPaymentPayables(vendorPayables);
    setPaymentAllocations(allocatePaymentOldestFirst(vendorPayables, initialPayment));
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: initialPayment,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const openPostGLModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowPostGLModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vendorId) {
      onNotify('error', 'Please select a vendor.');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      onNotify('error', 'Please enter a valid amount.');
      return;
    }
    if (!formData.expenseAccountId && formData.invoiceType === 'standard') {
      onNotify('error', 'Please select an expense account.');
      return;
    }
    if (!formData.qualificationId) {
      onNotify('error', 'Please select a class.');
      return;
    }

    const selectedVendor = orgVendors.find(v => v.id === formData.vendorId);
    if (!selectedVendor) {
      onNotify('error', 'Selected vendor not found.');
      return;
    }

    const apAccountId = formData.glAccountId || selectedVendor.apAccountId || apControlAccount?.id;

    const newPayable: Payable = {
      id: `pay-${Date.now()}`,
      orgId,
      vendorId: formData.vendorId!,
      payableNumber: nextPayableNumber,
      category: 'other',
      qualificationId: formData.qualificationId,
      description: formData.description || `Payable from ${selectedVendor.name}`,
      amount: formData.amount!,
      billDate: formData.billDate!,
      dueDate: formData.dueDate!,
      paymentDate: undefined,
      currency: formData.currency || 'PHP',
      status: 'for_approval',
      referenceDocument: formData.referenceDocument,
      journalEntryId: undefined,
      glAccountId: apAccountId,
      expenseAccountId: formData.expenseAccountId,
      notes: formData.notes,
      withholdingType: formData.withholdingType,
      atcItemId: undefined,
      atcRateId: undefined,
      appliedRatePercent: formData.appliedRatePercent,
      withholdingAmount: formData.withholdingAmount,
      netPayable: formData.netPayable,
      invoiceType: formData.invoiceType,
      inputVatAmount: formData.inputVatAmount,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    setIsSavingPayable(true);
    try {
      const savedPayable = await onCreatePayable(newPayable);
      setServerPayables(current => [
        savedPayable,
        ...current.filter(payable => payable.id !== savedPayable.id),
      ].slice(0, PAGE_SIZE));
      setServerTotal(total => total + 1);
      setCurrentPage(1);
      setShowCreateModal(false);
      resetForm();
      setRefreshKey(key => key + 1);
    } finally {
      setIsSavingPayable(false);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPayable) return;

    if (!formData.vendorId) {
      onNotify('error', 'Please select a vendor.');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      onNotify('error', 'Please enter a valid amount.');
      return;
    }
    if (!formData.qualificationId) {
      onNotify('error', 'Please select a class.');
      return;
    }

    const updates: Partial<Payable> = {
      vendorId: formData.vendorId,
      payableNumber: formData.payableNumber,
      category: formData.category as PayableCategory,
      qualificationId: formData.qualificationId,
      description: formData.description,
      amount: formData.amount,
      billDate: formData.billDate,
      dueDate: formData.dueDate,
      currency: formData.currency,
      status: formData.status as PayableStatus,
      referenceDocument: formData.referenceDocument,
      glAccountId: formData.glAccountId,
      expenseAccountId: formData.expenseAccountId,
      notes: formData.notes,
      withholdingType: formData.withholdingType,
      appliedRatePercent: formData.appliedRatePercent,
      withholdingAmount: formData.withholdingAmount,
      netPayable: formData.netPayable,
      invoiceType: formData.invoiceType,
      inputVatAmount: formData.inputVatAmount,
      updatedAt: new Date().toISOString(),
    };

    onUpdatePayable(selectedPayable.id, updates);
    setRefreshKey(key => key + 1);
    onNotify('success', `Payable ${formData.payableNumber} updated successfully.`);
    setShowEditModal(false);
    setSelectedPayable(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const payable = [...serverPayables, ...orgPayables].find(p => p.id === id);
    if (payable?.status === 'paid') {
      onNotify('error', 'Cannot delete a paid payable.');
      return;
    }
    if (payable?.journalEntryId) {
      onNotify('error', 'Cannot delete a payable that has been posted to GL. Reverse the journal entry first.');
      return;
    }

    onDeletePayable(id);
    setRefreshKey(key => key + 1);
    onNotify('success', 'Payable deleted successfully.');
    setConfirmDelete(null);
  };

  const handleStatusChange = (id: string, newStatus: PayableStatus) => {
    const payable = [...serverPayables, ...orgPayables].find(p => p.id === id);
    if (!payable) return;

    const updates: Partial<Payable> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'approved') {
      updates.approvedBy = currentUserId;
      updates.approvedAt = new Date().toISOString();
    } else if (newStatus === 'paid') {
      updates.paidBy = currentUserId;
      updates.paidAt = new Date().toISOString();
      updates.paymentDate = new Date().toISOString().slice(0, 10);
    }

    onUpdatePayable(id, updates);
    setRefreshKey(key => key + 1);
    onNotify('success', `Payable status updated to ${STATUS_CONFIG[newStatus].label}.`);
  };

  // ============================================================================
  // POST TO GL HANDLER
  // ============================================================================
  const handleApprovePayable = async (payableToPost: Payable) => {
    if (!onPostJournal) {
      onNotify('error', 'Cannot approve this payable because GL posting is unavailable.');
      return;
    }

    const vendor = orgVendors.find(v => v.id === payableToPost.vendorId);
    const expenseAccount = orgAccounts.find(a => a.id === payableToPost.expenseAccountId);
    const apAccount = orgAccounts.find(a => a.id === payableToPost.glAccountId) || apControlAccount;

    if (!apAccount) {
      onNotify('error', 'AP Control Account not found. Please set up your chart of accounts.');
      return;
    }
    if (!expenseAccount && payableToPost.invoiceType === 'standard') {
      onNotify('error', 'Expense Account not selected.');
      return;
    }

    const lines: JournalLine[] = [];
    const amount = payableToPost.amount;
    const withholdingAmount = payableToPost.withholdingAmount || 0;
    const inputVat = payableToPost.inputVatAmount || 0;
    const netPayable = payableToPost.netPayable || amount;
    const isCreditMemo = payableToPost.invoiceType === 'credit_memo';

    if (isCreditMemo) {
      // Credit Memo Entry (reverse of standard):
      // DR Accounts Payable
      // CR Expense
      lines.push({
        id: `jl-${Date.now()}-1`,
        journalEntryId: '',
        orgId,
        accountId: apAccount.id,
        description: `Credit Memo from ${vendor?.name}`,
        debit: Math.abs(netPayable),
        credit: 0,
        contactId: payableToPost.vendorId,
        contactType: 'VENDOR',
      });

      if (expenseAccount) {
        lines.push({
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          orgId,
          accountId: expenseAccount.id,
          description: `Credit Memo - ${payableToPost.description}`,
          debit: 0,
          credit: amount,
          contactId: payableToPost.vendorId,
          contactType: 'VENDOR',
          classificationCode: qualifications.find(q => q.id === payableToPost.qualificationId)?.code,
        });
      }
    } else {
      // Standard Invoice Entry:
      // DR Expense
      if (expenseAccount) {
        lines.push({
          id: `jl-${Date.now()}-1`,
          journalEntryId: '',
          orgId,
          accountId: expenseAccount.id,
          description: `${payableToPost.description}`,
          debit: amount,
          credit: 0,
          contactId: payableToPost.vendorId,
          contactType: 'VENDOR',
          classificationCode: qualifications.find(q => q.id === payableToPost.qualificationId)?.code,
        });
      }

      // DR Input VAT (if applicable)
      if (inputVat > 0 && inputVatAccount) {
        lines.push({
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          orgId,
          accountId: inputVatAccount.id,
          description: `Input VAT - ${payableToPost.payableNumber}`,
          debit: inputVat,
          credit: 0,
        });
      }

      // CR Withholding Tax Payable (if applicable)
      if (withholdingAmount > 0 && withholdingTaxAccount) {
        lines.push({
          id: `jl-${Date.now()}-3`,
          journalEntryId: '',
          orgId,
          accountId: withholdingTaxAccount.id,
          description: `Withholding Tax - ${vendor?.name}`,
          debit: 0,
          credit: withholdingAmount,
        });
      }

      // CR Accounts Payable
      lines.push({
        id: `jl-${Date.now()}-4`,
        journalEntryId: '',
        orgId,
        accountId: apAccount.id,
        description: `Payable to ${vendor?.name}`,
        debit: 0,
        credit: netPayable,
        contactId: payableToPost.vendorId,
        contactType: 'VENDOR',
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      orgId,
      date: payableToPost.billDate,
      reference: payableToPost.payableNumber,
      description: `${isCreditMemo ? 'Credit Memo' : 'Vendor Bill'}: ${payableToPost.description}`,
      sourceType: isCreditMemo ? 'CREDIT_MEMO' : 'BILL',
      status: 'POSTED',
    };

    const postedEntry = await onPostJournal(journalEntry, lines);
    if (!postedEntry) {
      onNotify('error', 'Approval stopped because the journal entry could not be posted.');
      return;
    }

    await onUpdatePayable(payableToPost.id, {
      journalEntryId: postedEntry.id,
      status: 'approved',
      approvedBy: currentUserId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setRefreshKey(key => key + 1);

    onNotify('success', `Journal entry posted for ${payableToPost.payableNumber}.`);
    setShowPostGLModal(false);
    setSelectedPayable(null);
  };

  // ============================================================================
  // PAYMENT HANDLER
  // ============================================================================
  const handleProcessPayment = async () => {
    if (paymentPayables.length === 0 || !onPostJournal || isProcessingPayment) {
      onNotify('error', 'Cannot process payment.');
      return;
    }

    if (!paymentData.amountPaid || paymentData.amountPaid <= 0) {
      onNotify('error', 'Please enter a valid payment amount.');
      return;
    }

    const bankAccount = orgBankAccounts.find(b => b.id === paymentData.bankAccountId);
    const cashAccount = orgAccounts.find(a => a.id === bankAccount?.glAccountId) ||
      assetAccounts.find(a => a.name.toLowerCase().includes('cash'));

    if (!cashAccount) {
      onNotify('error', 'Cash/Bank account not found.');
      return;
    }
    const payableAmounts = paymentPayables
      .map(payable => ({
      payable,
      amount: Math.max(0, paymentAllocations[payable.id] || 0),
      apAccount: orgAccounts.find(a => a.id === payable.glAccountId) || apControlAccount
      }))
      .filter(item => item.amount > 0);
    if (payableAmounts.length === 0) {
      onNotify('error', 'Allocate the payment to at least one invoice.');
      return;
    }
    if (payableAmounts.some(item => item.amount - getPayableOutstanding(item.payable) > 0.005)) {
      onNotify('error', 'An allocation cannot exceed its invoice outstanding balance.');
      return;
    }
    if (payableAmounts.some(item => !item.apAccount)) {
      onNotify('error', 'AP Account not found for one or more selected payables.');
      return;
    }
    const totalPayment = payableAmounts.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(paymentData.amountPaid - totalPayment) > 0.005) {
      onNotify('error', 'The payment amount must equal the total outstanding balance of the selected bills.');
      return;
    }

    // Payment Entry:
    // DR Accounts Payable
    // CR Cash/Bank
    const timestamp = Date.now();
    const lines: JournalLine[] = [
      ...payableAmounts.map(({ payable, amount, apAccount }, index) => ({
        id: `jl-${timestamp}-${index + 1}`,
        journalEntryId: '',
        orgId,
        accountId: apAccount!.id,
        description: `Payment to ${getVendorName(payable.vendorId)} - ${payable.payableNumber}`,
        debit: amount,
        credit: 0,
        contactId: payable.vendorId,
        contactType: 'VENDOR',
      } as JournalLine)),
      {
        id: `jl-${timestamp}-bank`,
        journalEntryId: '',
        orgId,
        accountId: cashAccount.id,
        description: `Payment - ${paymentPayables.map(payable => payable.payableNumber).join(', ')}${paymentData.checkNumber ? ` (Check #${paymentData.checkNumber})` : ''}`,
        debit: 0,
        credit: totalPayment,
      },
    ];

    const journalEntry: Partial<JournalEntry> = {
      orgId,
      date: paymentData.paymentDate,
      reference: AccountingService.getNextReference(orgEntries, 'PV'),
      description: paymentPayables.length === 1
        ? `Payment for ${paymentPayables[0].payableNumber}`
        : `Batch payment for ${paymentPayables.length} bills`,
      sourceType: 'PAYMENT',
      status: 'POSTED',
    };

    setIsProcessingPayment(true);
    try {
      await onPostJournal(journalEntry, lines);
      await Promise.all(payableAmounts.map(({ payable, amount }) => {
        const paidAmount = Math.round(((payable.paidAmount || 0) + amount) * 100) / 100;
        const totalDue = payable.netPayable || payable.amount;
        const status: PayableStatus = totalDue - paidAmount <= 0.005 ? 'paid' : 'partially_paid';
        return Promise.resolve(onUpdatePayable(payable.id, {
        status,
        paidAmount,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        paymentBankAccountId: paymentData.bankAccountId,
        checkNumber: paymentData.checkNumber,
        checkDate: paymentData.checkDate,
        paidBy: currentUserId,
        paidAt: status === 'paid' ? new Date().toISOString() : undefined,
      }));
      }));
      setRefreshKey(key => key + 1);
      onNotify('success', `Payment of \u20B1${formatCurrency(totalPayment)} allocated across ${payableAmounts.length} bill${payableAmounts.length === 1 ? '' : 's'}.`);
      setShowPaymentModal(false);
      setSelectedPayable(null);
      setPaymentPayables([]);
      setPaymentAllocations({});
      setSelectedPaymentIds([]);
      resetPaymentForm();
    } catch (error) {
      console.error('[PayablesView] Failed to process payment:', error);
      onNotify('error', 'Payment processing failed. Please review the journal and payable statuses before retrying.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getVendorName = (vendorId: string) => orgVendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor';

  const getCategoryLabel = (payable: Payable) => {
    const qualification = qualifications.find(q => q.id === payable.qualificationId);
    return qualification ? `${qualification.code} - ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === payable.category)?.label || 'Unassigned');
  };

  // ============================================================================
  // RENDER: SUMMARY CARDS
  // ============================================================================
  const SummaryCard = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) => (
    <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className={`text-lg font-semibold mt-1 ${color}`}>{"\u20B1"}{value}</p>
        </div>
        <div className={`w-12 h-12 rounded ${color === 'text-brand' ? 'bg-brand/10' : color.replace('text-', 'bg-').replace('600', '100')} flex items-center justify-center`}>
          <Icon className={color} size={24} />
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: TAB CONTENT
  // ============================================================================
  const renderListTab = () => (
    <>
      {/* Filters & Search */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search payables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PayableStatus | 'all')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
            >
              <option value="all">All</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="all">All</option>
              {orgVendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setVendorFilter('all');
            }}
            className={`p-2 transition-colors ${hasActiveListFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          {selectedPaymentIds.length > 0 && (
            <button
              type="button"
              onClick={openMultiplePaymentModal}
              className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
            >
              <Landmark size={15} /> Process Selected ({selectedPaymentIds.length})
            </button>
          )}

          <p className="ml-auto text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching payable{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all payable bills eligible for payment on this page"
                  checked={allEligiblePageSelected}
                  onChange={togglePagePaymentSelection}
                  disabled={eligiblePagePayables.length === 0}
                  className="h-4 w-4 rounded border-white/60 accent-white disabled:opacity-40"
                />
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date / Due</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Doc # / Type</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Vendor</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Description</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Amount</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Balance</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingPage && !useFallbackRows ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  Loading payables...
                </td>
              </tr>
            ) : totalItems > 0 ? (
              paginatedPayables.map(payable => {
                  const statusConfig = STATUS_CONFIG[payable.status];
                  const isOverdue = payable.status !== 'paid' && payable.status !== 'cancelled' && new Date(payable.dueDate) < new Date();
                  const invoiceTypeConfig = INVOICE_TYPES.find(t => t.value === payable.invoiceType);
                  const remainingBalance = getPayableOutstanding(payable);
                  const isPosted = !!payable.journalEntryId;

                  return (
                    <tr key={payable.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${payable.payableNumber} for payment`}
                          checked={selectedPaymentIds.includes(payable.id)}
                          disabled={!payablePaymentEligible(payable)}
                          onChange={() => setSelectedPaymentIds(current => current.includes(payable.id)
                            ? current.filter(id => id !== payable.id)
                            : [...current, payable.id]
                          )}
                          className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-800">{formatPayableDate(payable.billDate)}</span>
                          <span className={`text-xs ${isOverdue ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                            Due: {formatPayableDate(payable.dueDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono font-semibold text-brand">{payable.payableNumber}</span>
                          <span className={`text-xs font-semibold ${invoiceTypeConfig?.color || 'text-gray-500'}`}>
                            {invoiceTypeConfig?.label || 'Standard'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand border border-brand-light flex items-center justify-center font-bold text-xs">
                            {getVendorName(payable.vendorId).charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{getVendorName(payable.vendorId)}</p>
                            <p className="text-xs text-gray-500">{getCategoryLabel(payable)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-800">{payable.description}</span>
                          <span className="text-xs text-gray-500">{payable.referenceDocument || 'No reference document'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-sm text-gray-700">{"\u20B1"}{formatCurrency(payable.amount)}</span>
                          {payable.withholdingAmount > 0 && (
                            <span className="text-xs text-brand">-{"\u20B1"}{formatCurrency(payable.withholdingAmount)} WHT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                        <span className="text-brand">
                          {"\u20B1"}{formatCurrency(remainingBalance)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                            {statusConfig.label}
                          </span>
                          {isPosted && (
                            <span className="text-xs text-brand font-semibold flex items-center gap-0.5">
                              <BookOpen size={10} /> GL Posted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openViewModal(payable)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {payable.status !== 'paid' && payable.status !== 'cancelled' && (
                            <>
                              {!isPosted && (
                                <button
                                  onClick={() => openEditModal(payable)}
                                  className="p-1.5 hover:bg-brand-light rounded-lg text-brand transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {!isPosted && (
                                <button
                                  onClick={() => setConfirmDelete(payable.id)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-rose-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              {payable.status === 'for_approval' && (
                                <button
                                  onClick={() => handleStatusChange(payable.id, 'approved')}
                                  className="p-1.5 hover:bg-brand-light rounded-lg text-brand transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {(payable.status === 'approved' || payable.status === 'partially_paid') && onPostJournal && (
                                <button
                                  onClick={() => openPaymentModal(payable)}
                                  className="p-1.5 hover:bg-brand-light rounded-lg text-brand transition-colors"
                                  title="Process Payment"
                                >
                                  <Landmark size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  {pageLoadError
                    ? 'Unable to load payables from Supabase.'
                    : hasActiveListFilters
                    ? 'Try adjusting your search or filters.'
                    : 'No payables found. Create your first payable to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="payables"
        />
      </div>
    </>
  );

  const renderAgingTab = () => (
    <div className="space-y-6">
      {/* Vendor Filter for Aging */}
      <div className="flex items-center gap-4 bg-white p-4 rounded border shadow-sm">
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded focus:border-brand outline-none text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Vendors</option>
            {orgVendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <span className="text-sm text-gray-500">As of {new Date().toLocaleDateString()}</span>
      </div>

      {/* Aging Buckets */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { key: 'current', label: 'Current', color: 'emerald', data: agingBuckets.current },
          { key: 'days30', label: '1-30 Days', color: 'blue', data: agingBuckets.days30 },
          { key: 'days60', label: '31-60 Days', color: 'amber', data: agingBuckets.days60 },
          { key: 'days90', label: '61-90 Days', color: 'orange', data: agingBuckets.days90 },
          { key: 'days120Plus', label: '90+ Days', color: 'rose', data: agingBuckets.days120Plus },
        ].map(bucket => (
          <div key={bucket.key} className={`bg-white rounded border border-gray-200 p-5 shadow-sm`}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{bucket.label}</p>
            <p className={`text-lg font-semibold mt-2 text-${bucket.color}-600`}>
              {"\u20B1"}{formatCurrency(bucket.data.amount)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{bucket.data.count} invoice{bucket.data.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="text-brand" size={20} />
          Aging Summary by Vendor
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">Vendor</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Current</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">1-30</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">31-60</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">61-90</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">90+</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendorBalances.filter(v => v.balance > 0).map(({ vendor, balance }) => {
              const vendorPayables = orgPayables.filter(p =>
                p.vendorId === vendor.id &&
                p.status !== 'paid' &&
                p.status !== 'cancelled'
              );
              const today = new Date();
              const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 };

              vendorPayables.forEach(p => {
                const dueDate = new Date(p.dueDate);
                const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                const amount = getPayableOutstanding(p);

                if (daysOverdue <= 0) buckets.current += amount;
                else if (daysOverdue <= 30) buckets.d30 += amount;
                else if (daysOverdue <= 60) buckets.d60 += amount;
                else if (daysOverdue <= 90) buckets.d90 += amount;
                else buckets.d120 += amount;
              });

              return (
                <tr key={vendor.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 text-sm font-medium text-gray-700">{vendor.name}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.current > 0 ? formatCurrency(buckets.current) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d30 > 0 ? formatCurrency(buckets.d30) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d60 > 0 ? formatCurrency(buckets.d60) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d90 > 0 ? formatCurrency(buckets.d90) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-rose-600">{buckets.d120 > 0 ? formatCurrency(buckets.d120) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono font-bold text-gray-800">{formatCurrency(balance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="py-3 text-sm font-bold text-gray-800">TOTAL</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.current.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days30.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days60.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days90.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-rose-600">{formatCurrency(agingBuckets.days120Plus.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-semibold text-brand">{formatCurrency(totalApSubledger)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderReconciliationTab = () => (
    <div className="space-y-6">
      {/* GL vs Subledger Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand/10 rounded border border-brand-light">
              <PieChart className="text-brand" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">AP Subledger Total</h3>
          </div>
          <p className="text-xl font-semibold text-brand">{"\u20B1"}{formatCurrency(totalApSubledger)}</p>
          <p className="text-xs text-gray-500 mt-2">Sum of all vendor balances</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand/10 rounded border border-brand-light">
              <BookOpen className="text-brand" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">AP Control Account</h3>
          </div>
          <p className="text-xl font-semibold text-brand">
            {"\u20B1"}{formatCurrency(apControlAccount ? summaryMetrics.total : 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">{apControlAccount?.name || 'Not configured'}</p>
        </div>
      </div>

      {/* Vendor Balances */}
      <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building className="text-brand" size={20} />
          Vendor Balances (Subledger)
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">Vendor</th>
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">TIN</th>
              <th className="py-3 text-center text-xs font-bold text-gray-400 uppercase">Invoices</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody>
            {vendorBalances.map(({ vendor, balance, invoiceCount }) => (
              <tr key={vendor.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                      {vendor.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{vendor.name}</span>
                  </div>
                </td>
                <td className="py-3 text-sm font-mono text-gray-500">{vendor.tin || '-'}</td>
                <td className="py-3 text-center text-sm text-gray-600">{invoiceCount}</td>
                <td className={`py-3 text-right text-sm font-mono font-semibold ${balance > 0 ? 'text-brand' : balance < 0 ? 'text-brand' : 'text-gray-400'}`}>
                  {"\u20B1"}{formatCurrency(balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={3} className="py-3 text-sm font-bold text-gray-800">TOTAL SUBLEDGER</td>
              <td className="py-3 text-right text-sm font-mono font-semibold text-brand">{"\u20B1"}{formatCurrency(totalApSubledger)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="space-y-8">
      {(showCreateModal || (showEditModal && selectedPayable)) ? (
        <PayableFormPage
          title={showCreateModal ? 'Create Bill' : `Edit: ${selectedPayable?.payableNumber}`}
          formData={formData}
          setFormData={setFormData}
          vendors={orgVendors}
          accounts={orgAccounts}
          expenseAccounts={expenseAccounts}
          liabilityAccounts={liabilityAccounts}
          qualifications={qualifications}
          onSubmit={showCreateModal ? handleCreate : handleUpdate}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedPayable(null);
            resetForm();
          }}
          submitLabel={showCreateModal ? 'Create Bill' : 'Save Changes'}
          isEdit={showEditModal}
          isSubmitting={isSavingPayable}
        />
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{view === 'aging' ? 'AP AGING REPORT' : 'AP BILLS'}</h2>
          <p className="text-sm text-gray-500 font-normal italic">{view === 'aging' ? 'Review outstanding vendor balances by aging period.' : 'Manage vendor invoices and process payments.'}</p>
        </div>
        {view === 'bills' && <div className="flex gap-3">
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-medium text-sm active:scale-95"
          >
            <Plus size={18} /> New Bill
          </button>
        </div>}
      </div>

      {/* Tabs */}
      {view === 'bills' && <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'list', label: 'Bill List', icon: FileText },
          { key: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as APTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.key
              ? 'text-brand border-brand'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total Open" value={formatCurrency(summaryMetrics.total)} color="text-brand" icon={Coins} />
        <SummaryCard label="For Approval" value={formatCurrency(summaryMetrics.forApproval)} color="text-brand" icon={Clock} />
        <SummaryCard label="Approved" value={formatCurrency(summaryMetrics.approved)} color="text-brand" icon={CheckCircle} />
        <SummaryCard label="Due Soon (7d)" value={formatCurrency(summaryMetrics.dueSoon)} color="text-violet-600" icon={Calendar} />
        <SummaryCard label="Overdue" value={formatCurrency(summaryMetrics.overdue)} color="text-rose-600" icon={AlertCircle} />
        <SummaryCard label="Total Paid" value={formatCurrency(summaryMetrics.paid)} color="text-brand" icon={CreditCard} />
      </div>

      {/* Tab Content */}
      {view === 'aging' ? renderAgingTab() : (
        <>
          {activeTab === 'list' && renderListTab()}
          {activeTab === 'reconciliation' && renderReconciliationTab()}
        </>
      )}

      {/* View Modal */}
      {showViewModal && selectedPayable && (
        <PayableDetailModal
          payable={selectedPayable}
          vendor={orgVendors.find(v => v.id === selectedPayable.vendorId)}
          accounts={orgAccounts}
          qualifications={qualifications}
          onClose={() => { setShowViewModal(false); setSelectedPayable(null); }}
          onApprove={() => { handleStatusChange(selectedPayable.id, 'approved'); setShowViewModal(false); }}
          onProcessPayment={() => { setShowViewModal(false); openPaymentModal(selectedPayable); }}
          onPostGL={() => { setShowViewModal(false); openPostGLModal(selectedPayable); }}
          canPost={!!onPostJournal && !selectedPayable.journalEntryId && selectedPayable.status === 'for_approval'}
          canPay={!!onPostJournal && (selectedPayable.status === 'approved' || selectedPayable.status === 'partially_paid')}
        />
      )}

      {/* Post to GL Modal (available from payable details, not the list table) */}
      {showPostGLModal && selectedPayable && (
        <ModalPortal>
          <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded shadow-md w-full max-w-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand-light">
                  <BookOpen className="text-brand" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Post to General Ledger</h3>
                  <p className="text-sm text-gray-500">{selectedPayable.payableNumber}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-4">
                Confirm posting this payable to the general ledger.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowPostGLModal(false); setSelectedPayable(null); }}
                  className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleApprovePayable(selectedPayable)}
                  className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover"
                >
                  Post to GL
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentPayables.length > 0 && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-brand/20">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Vendor Payment Allocation</h3>
                  <p className="text-xs text-gray-500">
                    {paymentPayables.length > 1
                      ? `${getVendorName(paymentPayables[0].vendorId)} · ${paymentPayables.length} open bills`
                      : `${paymentPayables[0].payableNumber} • ${getVendorName(paymentPayables[0].vendorId)}`}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); setPaymentPayables([]); setPaymentAllocations({}); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Outstanding Balance */}
              <div className="bg-amber-50 rounded p-4 border border-amber-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-amber-800">Total Outstanding</span>
                  <span className="text-xl font-semibold text-brand">
                    {"\u20B1"}{formatCurrency(vendorPaymentOutstanding)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between border-t border-amber-100 pt-2 text-xs">
                  <span className="text-amber-700">Allocated: {"\u20B1"}{formatCurrency(allocatedPaymentTotal)}</span>
                  <span className={Math.abs(paymentData.amountPaid - allocatedPaymentTotal) <= 0.005 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-600'}>
                    Unallocated: {"\u20B1"}{formatCurrency(Math.max(0, paymentData.amountPaid - allocatedPaymentTotal))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Allocations · Oldest First</label>
                  <button
                    type="button"
                    onClick={() => setPaymentAllocations(allocatePaymentOldestFirst(paymentPayables, paymentData.amountPaid))}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Auto-allocate
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-100">
                  {paymentPayables.map(payable => (
                    <div key={payable.id} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-700">{payable.payableNumber}</p>
                        <p className="truncate text-xs text-gray-400">Due {formatPayableDate(payable.dueDate)} · Balance {"\u20B1"}{formatCurrency(getPayableOutstanding(payable))}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={getPayableOutstanding(payable)}
                        step="0.01"
                        aria-label={`Payment allocation for ${payable.payableNumber}`}
                        className="w-32 shrink-0 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-right font-mono text-sm outline-none focus:border-brand"
                        value={paymentAllocations[payable.id] || ''}
                        onChange={event => {
                          const value = Math.min(getPayableOutstanding(payable), Math.max(0, Number(event.target.value) || 0));
                          setPaymentAllocations(current => ({ ...current, [payable.id]: value }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium appearance-none"
                  value={paymentData.paymentMethod}
                  onChange={e => setPaymentData({ ...paymentData, paymentMethod: e.target.value as PaymentMethod })}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Bank Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pay From (Bank Account)</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium appearance-none"
                  value={paymentData.bankAccountId}
                  onChange={e => setPaymentData({ ...paymentData, bankAccountId: e.target.value })}
                >
                  <option value="">Select Bank Account...</option>
                  {orgBankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                  ))}
                </select>
              </div>

              {/* Check Details (if check payment) */}
              {paymentData.paymentMethod.toUpperCase() === 'CHECK' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Number</label>
                    <input
                      type="text"
                      placeholder="Check #"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-mono"
                      value={paymentData.checkNumber}
                      onChange={e => setPaymentData({ ...paymentData, checkNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                      value={paymentData.checkDate}
                      onChange={e => setPaymentData({ ...paymentData, checkDate: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={vendorPaymentOutstanding}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-sm focus:border-brand"
                    value={paymentData.amountPaid}
                    onChange={event => {
                      const amountPaid = Math.min(vendorPaymentOutstanding, Math.max(0, Number(event.target.value) || 0));
                      setPaymentData(current => ({ ...current, amountPaid }));
                      setPaymentAllocations(allocatePaymentOldestFirst(paymentPayables, amountPaid));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={paymentData.paymentDate}
                    onChange={e => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); setPaymentPayables([]); setPaymentAllocations({}); resetPaymentForm(); }}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPayment}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
                >
                  {isProcessingPayment ? <RefreshCw size={16} className="animate-spin" /> : <Landmark size={16} />}
                  {isProcessingPayment ? 'Processing…' : `Process ${paymentPayables.length} Payment${paymentPayables.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded shadow-md w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="text-rose-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Delete Payable?</h3>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
      </>
      )}
    </div>
  );
};

// ============================================================================
// PAYABLE FORM PAGE COMPONENT
// ============================================================================
interface PayableFormPageProps {
  title: string;
  formData: Partial<Payable>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Payable>>>;
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  expenseAccounts: ChartOfAccount[];
  liabilityAccounts: ChartOfAccount[];
  qualifications: Qualification[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

const PayableFormPage: React.FC<PayableFormPageProps> = ({
  title,
  formData,
  setFormData,
  vendors,
  accounts,
  expenseAccounts,
  liabilityAccounts,
  qualifications,
  onSubmit,
  onClose,
  submitLabel,
  isEdit = false,
  isSubmitting = false,
}) => {
  return (
    <div className="w-full animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="bg-white rounded-xl shadow-sm w-full overflow-hidden border border-gray-200">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand text-white rounded shadow-brand/20">
              <Calculator size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-brand transition-colors">
            <ArrowRight size={18} className="rotate-180" /> Back to bills
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-6">
          {/* Invoice Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Type</label>
            <div className="flex gap-2">
              {INVOICE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, invoiceType: type.value }))}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded border transition-all ${formData.invoiceType === type.value
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-light'
                    }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Building size={12} /> Vendor *
            </label>
            <select
              required
              disabled={isEdit}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none disabled:opacity-60"
              value={formData.vendorId || ''}
              onChange={e => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
            >
              <option value="">Select Vendor...</option>
              {vendors.filter(v => v.status !== 'blocked').map(v => (
                <option key={v.id} value={v.id}>{v.name} {v.tin ? `(${v.tin})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Reference & Date Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document # *</label>
              <input
                type="text"
                required
                readOnly
                aria-readonly="true"
                className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded outline-none text-sm font-mono font-semibold text-brand cursor-not-allowed"
                value={formData.payableNumber || ''}
              />
              {!isEdit && <p className="text-[11px] text-gray-400">Assigned automatically in sequence.</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar size={12} /> Invoice Date *
              </label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                value={formData.billDate || ''}
                onChange={e => setFormData(prev => ({ ...prev, billDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date *</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                value={formData.dueDate || ''}
                onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Expense Account & Class */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand uppercase tracking-wide">Expense Account *</label>
              <select
                required={formData.invoiceType === 'standard'}
                className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded outline-none focus:border-brand text-sm font-medium appearance-none"
                value={formData.expenseAccountId || ''}
                onChange={e => setFormData(prev => ({ ...prev, expenseAccountId: e.target.value }))}
              >
                <option value="">Select Expense Account...</option>
                {expenseAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class *</label>
              <select
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
                value={formData.qualificationId || ''}
                onChange={e => setFormData(prev => ({ ...prev, qualificationId: e.target.value }))}
              >
                <option value="">Select Class...</option>
                {qualifications.map(qualification => (
                  <option key={qualification.id} value={qualification.id}>
                    {qualification.code} - {qualification.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            <input
              type="text"
              placeholder="Brief description of the invoice..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Amount & VAT */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gross Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-sm"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Input VAT</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-sm"
                value={formData.inputVatAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, inputVatAmount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand uppercase tracking-wide">Withholding Type</label>
              <select
                className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded outline-none text-sm appearance-none"
                value={formData.withholdingType || ''}
                onChange={e => setFormData(prev => ({ ...prev, withholdingType: (e.target.value || undefined) as WithholdingType | undefined }))}
              >
                <option value="">None</option>
                <option value="EXPANDED">Expanded (2307)</option>
                <option value="FINAL">Final (2306)</option>
              </select>
            </div>
          </div>

          {/* Withholding Details */}
          {formData.withholdingType && (
            <div className="grid grid-cols-3 gap-4 bg-brand/10 p-4 rounded border border-brand-light">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate (%)</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded outline-none font-mono text-sm"
                  value={formData.appliedRatePercent || ''}
                  onChange={e => setFormData(prev => ({ ...prev, appliedRatePercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">WHT Amount</label>
                <input
                  type="text"
                  readOnly
                  className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded outline-none font-mono text-sm"
                  value={(formData.withholdingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand uppercase tracking-wide">Net Payable</label>
                <input
                  type="text"
                  readOnly
                  className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded outline-none font-mono text-sm font-bold text-brand"
                  value={(formData.netPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
              </div>
            </div>
          )}

          {/* Reference Document & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference Document</label>
              <input
                type="text"
                placeholder="Vendor Invoice #, OR #, etc."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                value={formData.referenceDocument || ''}
                onChange={e => setFormData(prev => ({ ...prev, referenceDocument: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
              <input
                type="text"
                placeholder="Additional notes..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                value={formData.notes || ''}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* Status (Edit mode) */}
          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
              <select
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
                value={formData.status || 'for_approval'}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as PayableStatus }))}
              >
                {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand text-white rounded text-sm font-semibold shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// PAYABLE DETAIL MODAL COMPONENT
// ============================================================================
interface PayableDetailModalProps {
  payable: Payable;
  vendor?: Vendor;
  accounts: ChartOfAccount[];
  qualifications: Qualification[];
  onClose: () => void;
  onApprove: () => void;
  onProcessPayment: () => void;
  onPostGL: () => void;
  canPost: boolean;
  canPay: boolean;
}

const PayableDetailModal: React.FC<PayableDetailModalProps> = ({
  payable,
  vendor,
  accounts,
  qualifications = [],
  onClose,
  onApprove,
  onProcessPayment,
  onPostGL,
  canPost,
  canPay,
}) => {
  const statusConfig = STATUS_CONFIG[payable.status];
  const expenseAccount = accounts.find(a => a.id === payable.expenseAccountId);
  const glAccount = accounts.find(a => a.id === payable.glAccountId);
  const invoiceTypeConfig = INVOICE_TYPES.find(t => t.value === payable.invoiceType);
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const remainingBalance = getPayableOutstanding(payable);

  return (
    <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-md shadow-md w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand text-white rounded shadow-brand/20">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{payable.payableNumber}</h3>
              <p className="text-xs text-gray-500">{vendor?.name || 'Unknown Vendor'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Status & Amount */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                {statusConfig.label}
              </span>
              <span className={`text-xs font-semibold ${invoiceTypeConfig?.color}`}>
                {invoiceTypeConfig?.label}
              </span>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-800">{"\u20B1"}{formatCurrency(payable.netPayable || payable.amount)}</p>
              {remainingBalance !== (payable.netPayable || payable.amount) && (
                <p className="text-xs text-brand font-semibold">Balance: {"\u20B1"}{formatCurrency(remainingBalance)}</p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Class</p>
              <p className="text-gray-700 font-medium">
                {(() => {
                  const qualification = qualifications.find(q => q.id === payable.qualificationId);
                  return qualification ? `${qualification.code} - ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === payable.category)?.label || 'Unassigned');
                })()}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Expense Account</p>
              <p className="text-gray-700 font-medium">{expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Invoice Date</p>
              <p className="text-gray-700 font-medium">{payable.billDate}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Due Date</p>
              <p className="text-gray-700 font-medium">{payable.dueDate}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Gross Amount</p>
              <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(payable.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Input VAT</p>
              <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(payable.inputVatAmount || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Withholding</p>
              <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(payable.withholdingAmount || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Paid Amount</p>
              <p className="text-brand font-mono font-semibold">{"\u20B1"}{formatCurrency(payable.amount || 0)}</p>
            </div>
            {payable.referenceDocument && (
              <div className="col-span-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Reference Document</p>
                <p className="text-gray-700 font-medium">{payable.referenceDocument}</p>
              </div>
            )}
            {payable.description && (
              <div className="col-span-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                <p className="text-gray-700">{payable.description}</p>
              </div>
            )}
          </div>

          {/* GL Status */}
          {payable.journalEntryId && (
            <div className="bg-brand/10 rounded p-4 border border-brand-light">
              <div className="flex items-center gap-2">
                <BookOpen className="text-brand" size={16} />
                <span className="text-sm font-semibold text-brand">Posted to General Ledger</span>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-gray-50 rounded p-4 text-xs text-gray-500 space-y-1">
            <p>Created: {new Date(payable.createdAt).toLocaleString()}</p>
            {payable.approvedAt && <p>Approved: {new Date(payable.approvedAt).toLocaleString()}</p>}
            {payable.paidAt && <p>Paid: {new Date(payable.paidAt).toLocaleString()}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
            >
              Close
            </button>
            {canPost && (
              <button
                onClick={onPostGL}
                className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen size={16} /> Post to GL
              </button>
            )}
            {payable.status === 'for_approval' && !canPost && (
              <button
                onClick={onApprove}
                className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Approve
              </button>
            )}
            {canPay && (
              <button
                onClick={onProcessPayment}
                className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
              >
                <Landmark size={16} /> Pay
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
</ModalPortal>
  );
};

export default PayablesView;

