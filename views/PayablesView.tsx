import React, { useMemo, useState, useEffect } from 'react';
import { 
  Vendor, Payable, PayableCategory, PayableStatus, InvoiceType, PaymentMethod,
  WithholdingType, ChartOfAccount, JournalEntry, JournalEntryLine, AccountClass, BankAccount, PurchaseOrder
} from '../types';
import { AccountingService } from '../accountingService';
import EmptyState from '../components/EmptyState';
import { 
  Search, Calculator, Building, Coins, AlertCircle, Calendar, 
  X, Plus, FileText, Edit, Trash2, Eye, CheckCircle, Clock,
  DollarSign, Filter, ChevronDown, RefreshCw, CreditCard,
  BookOpen, Landmark, Receipt, TrendingUp, ArrowRight,
  Percent, Banknote, BarChart3, PieChart, Download, Printer
} from 'lucide-react';

interface PayablesViewProps {
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  bankAccounts?: BankAccount[];
  purchaseOrders?: PurchaseOrder[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  currentUserId?: string;
  onCreatePayable: (payable: Payable) => void;
  onUpdatePayable: (id: string, updates: Partial<Payable>) => void;
  onDeletePayable: (id: string) => void;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
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
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

const INVOICE_TYPES: { value: InvoiceType; label: string; color: string }[] = [
  { value: 'standard', label: 'Standard Invoice', color: 'text-slate-600' },
  { value: 'prepayment', label: 'Prepayment/Advance', color: 'text-violet-600' },
  { value: 'credit_memo', label: 'Credit Memo', color: 'text-emerald-600' },
  { value: 'debit_memo', label: 'Debit Memo', color: 'text-rose-600' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'auto_debit', label: 'Auto Debit' },
  { value: 'ewallet', label: 'E-Wallet' },
];

const STATUS_CONFIG: Record<PayableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  for_approval: { label: 'For Approval', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  approved: { label: 'Approved', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  paid: { label: 'Paid', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  partially_paid: { label: 'Partially Paid', color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' },
};

const PayablesView: React.FC<PayablesViewProps> = ({ 
  orgId, 
  payables, 
  vendors, 
  accounts, 
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
  const [activeTab, setActiveTab] = useState<APTab>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayableStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPostGLModal, setShowPostGLModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);

  // Form state for Create/Edit
  const [formData, setFormData] = useState<Partial<Payable>>({
    vendorId: '',
    payableNumber: '',
    category: 'general',
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
    paymentMethod: 'bank_transfer' as PaymentMethod,
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountPaid: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

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
  useEffect(() => {
    if (showCreateModal && !formData.payableNumber) {
      const prefix = formData.invoiceType === 'credit_memo' ? 'CM' : formData.invoiceType === 'debit_memo' ? 'DM' : 'BILL';
      const nextRef = AccountingService.getNextReference(orgEntries, prefix);
      setFormData(prev => ({ ...prev, payableNumber: nextRef }));
    }
  }, [showCreateModal, orgEntries, formData.payableNumber, formData.invoiceType]);

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
    return orgPayables.filter(p => {
      const matchesSearch = 
        p.payableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        orgVendors.find(v => v.id === p.vendorId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesVendor = vendorFilter === 'all' || p.vendorId === vendorFilter;
      
      return matchesSearch && matchesStatus && matchesVendor;
    });
  }, [orgPayables, searchTerm, statusFilter, vendorFilter, orgVendors]);

  // ============================================================================
  // SUMMARY METRICS
  // ============================================================================
  const summaryMetrics = useMemo(() => {
    const openPayables = orgPayables.filter(p => p.status !== 'paid' && p.status !== 'cancelled');
    const total = openPayables.reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    const forApproval = orgPayables.filter(p => p.status === 'for_approval').reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    const approved = orgPayables.filter(p => p.status === 'approved').reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    const paid = orgPayables.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoon = openPayables.filter(p => 
      new Date(p.dueDate) <= sevenDaysFromNow
    ).reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    
    const overdue = openPayables.filter(p => new Date(p.dueDate) < today)
      .reduce((sum, p) => sum + (p.netPayable || p.amount), 0);
    
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
      const amount = p.netPayable || p.amount;
      
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
        const amount = p.netPayable || p.amount;
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
      category: 'general',
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
      paymentMethod: 'bank_transfer',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: 0,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const openEditModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setFormData({
      vendorId: payable.vendorId,
      payableNumber: payable.payableNumber,
      category: payable.category,
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

  const openViewModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowViewModal(true);
  };

  const openPaymentModal = (payable: Payable) => {
    setSelectedPayable(payable);
    const remainingAmount = (payable.netPayable || payable.amount) - (payable.paidAmount || 0);
    setPaymentData({
      paymentMethod: 'bank_transfer',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: remainingAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const openPostGLModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowPostGLModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
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
      payableNumber: formData.payableNumber || AccountingService.getNextReference(orgEntries, 'BILL'),
      category: formData.category as PayableCategory || 'general',
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
      paidAmount: 0,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    onCreatePayable(newPayable);
    onNotify('success', `${INVOICE_TYPES.find(t => t.value === formData.invoiceType)?.label || 'Payable'} ${newPayable.payableNumber} created successfully.`);
    setShowCreateModal(false);
    resetForm();
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

    const updates: Partial<Payable> = {
      vendorId: formData.vendorId,
      payableNumber: formData.payableNumber,
      category: formData.category as PayableCategory,
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
    onNotify('success', `Payable ${formData.payableNumber} updated successfully.`);
    setShowEditModal(false);
    setSelectedPayable(null);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const payable = orgPayables.find(p => p.id === id);
    if (payable?.status === 'paid') {
      onNotify('error', 'Cannot delete a paid payable.');
      return;
    }
    if (payable?.journalEntryId) {
      onNotify('error', 'Cannot delete a payable that has been posted to GL. Reverse the journal entry first.');
      return;
    }
    
    onDeletePayable(id);
    onNotify('success', 'Payable deleted successfully.');
    setConfirmDelete(null);
  };

  const handleStatusChange = (id: string, newStatus: PayableStatus) => {
    const payable = orgPayables.find(p => p.id === id);
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
      updates.paidAmount = payable.netPayable || payable.amount;
    }

    onUpdatePayable(id, updates);
    onNotify('success', `Payable status updated to ${STATUS_CONFIG[newStatus].label}.`);
  };

  // ============================================================================
  // POST TO GL HANDLER
  // ============================================================================
  const handlePostToGL = () => {
    if (!selectedPayable || !onPostJournal) {
      onNotify('error', 'Cannot post to GL.');
      return;
    }

    const vendor = orgVendors.find(v => v.id === selectedPayable.vendorId);
    const expenseAccount = orgAccounts.find(a => a.id === selectedPayable.expenseAccountId);
    const apAccount = orgAccounts.find(a => a.id === selectedPayable.glAccountId) || apControlAccount;
    
    if (!apAccount) {
      onNotify('error', 'AP Control Account not found. Please set up your chart of accounts.');
      return;
    }
    if (!expenseAccount && selectedPayable.invoiceType === 'standard') {
      onNotify('error', 'Expense Account not selected.');
      return;
    }

    const lines: JournalEntryLine[] = [];
    const amount = selectedPayable.amount;
    const withholdingAmount = selectedPayable.withholdingAmount || 0;
    const inputVat = selectedPayable.inputVatAmount || 0;
    const netPayable = selectedPayable.netPayable || amount;
    const isCreditMemo = selectedPayable.invoiceType === 'credit_memo';

    if (isCreditMemo) {
      // Credit Memo Entry (reverse of standard):
      // DR Accounts Payable
      // CR Expense
      lines.push({
        id: `jl-${Date.now()}-1`,
        journalEntryId: '',
        accountId: apAccount.id,
        description: `Credit Memo from ${vendor?.name}`,
        debit: Math.abs(netPayable),
        credit: 0,
        contactId: selectedPayable.vendorId,
        contactType: 'VENDOR',
      });
      
      if (expenseAccount) {
        lines.push({
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          accountId: expenseAccount.id,
          description: `Credit Memo - ${selectedPayable.description}`,
          debit: 0,
          credit: amount,
          contactId: selectedPayable.vendorId,
          contactType: 'VENDOR',
        });
      }
    } else {
      // Standard Invoice Entry:
      // DR Expense
      if (expenseAccount) {
        lines.push({
          id: `jl-${Date.now()}-1`,
          journalEntryId: '',
          accountId: expenseAccount.id,
          description: `${selectedPayable.description}`,
          debit: amount,
          credit: 0,
          contactId: selectedPayable.vendorId,
          contactType: 'VENDOR',
        });
      }

      // DR Input VAT (if applicable)
      if (inputVat > 0 && inputVatAccount) {
        lines.push({
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          accountId: inputVatAccount.id,
          description: `Input VAT - ${selectedPayable.payableNumber}`,
          debit: inputVat,
          credit: 0,
        });
      }

      // CR Withholding Tax Payable (if applicable)
      if (withholdingAmount > 0 && withholdingTaxAccount) {
        lines.push({
          id: `jl-${Date.now()}-3`,
          journalEntryId: '',
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
        accountId: apAccount.id,
        description: `Payable to ${vendor?.name}`,
        debit: 0,
        credit: netPayable,
        contactId: selectedPayable.vendorId,
        contactType: 'VENDOR',
      });
    }

    const journalEntry: Partial<JournalEntry> = {
      orgId,
      date: selectedPayable.billDate,
      reference: selectedPayable.payableNumber,
      description: `${isCreditMemo ? 'Credit Memo' : 'Vendor Bill'}: ${selectedPayable.description}`,
      sourceType: isCreditMemo ? 'CREDIT_MEMO' : 'BILL',
      status: 'POSTED',
    };

    onPostJournal(journalEntry, lines);
    
    // Update payable with journal entry reference
    onUpdatePayable(selectedPayable.id, {
      journalEntryId: 'POSTED',
      status: 'approved',
      approvedBy: currentUserId,
      approvedAt: new Date().toISOString(),
    });

    onNotify('success', `Journal entry posted for ${selectedPayable.payableNumber}`);
    setShowPostGLModal(false);
    setSelectedPayable(null);
  };

  // ============================================================================
  // PAYMENT HANDLER
  // ============================================================================
  const handleProcessPayment = () => {
    if (!selectedPayable || !onPostJournal) {
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
    const apAccount = orgAccounts.find(a => a.id === selectedPayable.glAccountId) || apControlAccount;
    const vendor = orgVendors.find(v => v.id === selectedPayable.vendorId);

    if (!cashAccount) {
      onNotify('error', 'Cash/Bank account not found.');
      return;
    }
    if (!apAccount) {
      onNotify('error', 'AP Account not found.');
      return;
    }

    // Payment Entry:
    // DR Accounts Payable
    // CR Cash/Bank
    const lines: JournalEntryLine[] = [
      {
        id: `jl-${Date.now()}-1`,
        journalEntryId: '',
        accountId: apAccount.id,
        description: `Payment to ${vendor?.name}`,
        debit: paymentData.amountPaid,
        credit: 0,
        contactId: selectedPayable.vendorId,
        contactType: 'VENDOR',
      },
      {
        id: `jl-${Date.now()}-2`,
        journalEntryId: '',
        accountId: cashAccount.id,
        description: `Payment - ${selectedPayable.payableNumber}${paymentData.checkNumber ? ` (Check #${paymentData.checkNumber})` : ''}`,
        debit: 0,
        credit: paymentData.amountPaid,
      },
    ];

    const journalEntry: Partial<JournalEntry> = {
      orgId,
      date: paymentData.paymentDate,
      reference: AccountingService.getNextReference(orgEntries, 'PV'),
      description: `Payment to ${vendor?.name} for ${selectedPayable.payableNumber}`,
      sourceType: 'PAYMENT',
      status: 'POSTED',
    };

    onPostJournal(journalEntry, lines);

    // Update payable status
    const totalPaid = (selectedPayable.paidAmount || 0) + paymentData.amountPaid;
    const totalDue = selectedPayable.netPayable || selectedPayable.amount;
    const newStatus: PayableStatus = totalPaid >= totalDue ? 'paid' : 'partially_paid';

    onUpdatePayable(selectedPayable.id, {
      status: newStatus,
      paidAmount: totalPaid,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      paymentBankAccountId: paymentData.bankAccountId,
      checkNumber: paymentData.checkNumber,
      checkDate: paymentData.checkDate,
      paidBy: currentUserId,
      paidAt: new Date().toISOString(),
    });

    onNotify('success', `Payment of ₱${formatCurrency(paymentData.amountPaid)} processed for ${selectedPayable.payableNumber}`);
    setShowPaymentModal(false);
    setSelectedPayable(null);
    resetPaymentForm();
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const getVendorName = (vendorId: string) => orgVendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor';
  
  const getCategoryLabel = (category: PayableCategory) => PAYABLE_CATEGORIES.find(c => c.value === category)?.label || category;

  // ============================================================================
  // RENDER: SUMMARY CARDS
  // ============================================================================
  const SummaryCard = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className={`text-2xl font-black mt-1 ${color}`}>₱{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')} flex items-center justify-center`}>
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
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search payables..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PayableStatus | 'all')}
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Vendors</option>
              {orgVendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredPayables.length}</span> of {orgPayables.length}
        </p>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doc # / Type</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / Due</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPayables.length > 0 ? (
              filteredPayables
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(payable => {
                  const statusConfig = STATUS_CONFIG[payable.status];
                  const isOverdue = payable.status !== 'paid' && payable.status !== 'cancelled' && new Date(payable.dueDate) < new Date();
                  const invoiceTypeConfig = INVOICE_TYPES.find(t => t.value === payable.invoiceType);
                  const remainingBalance = (payable.netPayable || payable.amount) - (payable.paidAmount || 0);
                  const isPosted = !!payable.journalEntryId;
                  
                  return (
                    <tr key={payable.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold text-xs">
                            {getVendorName(payable.vendorId).charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{getVendorName(payable.vendorId)}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[180px]">{payable.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono font-semibold text-indigo-600">{payable.payableNumber}</span>
                          <span className={`text-[10px] font-semibold ${invoiceTypeConfig?.color || 'text-slate-500'}`}>
                            {invoiceTypeConfig?.label || 'Standard'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-600">{payable.billDate}</span>
                          <span className={`text-xs ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                            Due: {payable.dueDate} {isOverdue && '⚠️'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-sm text-slate-700">₱{formatCurrency(payable.amount)}</span>
                          {payable.withholdingAmount > 0 && (
                            <span className="text-[10px] text-emerald-600">-₱{formatCurrency(payable.withholdingAmount)} WHT</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-semibold">
                        <span className={remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          ₱{formatCurrency(remainingBalance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                            {statusConfig.label}
                          </span>
                          {isPosted && (
                            <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                              <BookOpen size={10} /> GL Posted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openViewModal(payable)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {payable.status !== 'paid' && payable.status !== 'cancelled' && (
                            <>
                              {!isPosted && (
                                <button
                                  onClick={() => openEditModal(payable)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-blue-500 transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              {!isPosted && (
                                <button
                                  onClick={() => setConfirmDelete(payable.id)}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              {payable.status === 'for_approval' && !isPosted && onPostJournal && (
                                <button
                                  onClick={() => openPostGLModal(payable)}
                                  className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
                                  title="Post to GL"
                                >
                                  <BookOpen size={16} />
                                </button>
                              )}
                              {payable.status === 'for_approval' && (
                                <button
                                  onClick={() => handleStatusChange(payable.id, 'approved')}
                                  className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {(payable.status === 'approved' || payable.status === 'partially_paid') && onPostJournal && (
                                <button
                                  onClick={() => openPaymentModal(payable)}
                                  className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
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
                <td colSpan={7} className="py-16 text-center">
                  <EmptyState 
                    icon={<Coins className="text-slate-300" size={48} />}
                    title="No payables found"
                    description={searchTerm || statusFilter !== 'all' || vendorFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first payable to get started'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderAgingTab = () => (
    <div className="space-y-6">
      {/* Vendor Filter for Aging */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Vendors</option>
            {orgVendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
        <span className="text-sm text-slate-500">As of {new Date().toLocaleDateString()}</span>
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
          <div key={bucket.key} className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm`}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bucket.label}</p>
            <p className={`text-2xl font-black mt-2 text-${bucket.color}-600`}>
              ₱{formatCurrency(bucket.data.amount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{bucket.data.count} invoice{bucket.data.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="text-indigo-600" size={20} />
          Aging Summary by Vendor
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Vendor</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Current</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">1-30</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">31-60</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">61-90</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">90+</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Total</th>
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
                const amount = p.netPayable || p.amount;
                
                if (daysOverdue <= 0) buckets.current += amount;
                else if (daysOverdue <= 30) buckets.d30 += amount;
                else if (daysOverdue <= 60) buckets.d60 += amount;
                else if (daysOverdue <= 90) buckets.d90 += amount;
                else buckets.d120 += amount;
              });
              
              return (
                <tr key={vendor.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 text-sm font-medium text-slate-700">{vendor.name}</td>
                  <td className="py-3 text-right text-sm font-mono text-emerald-600">{buckets.current > 0 ? formatCurrency(buckets.current) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-blue-600">{buckets.d30 > 0 ? formatCurrency(buckets.d30) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-amber-600">{buckets.d60 > 0 ? formatCurrency(buckets.d60) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-orange-600">{buckets.d90 > 0 ? formatCurrency(buckets.d90) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-rose-600">{buckets.d120 > 0 ? formatCurrency(buckets.d120) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono font-bold text-slate-800">{formatCurrency(balance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td className="py-3 text-sm font-bold text-slate-800">TOTAL</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-emerald-600">{formatCurrency(agingBuckets.current.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-blue-600">{formatCurrency(agingBuckets.days30.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-amber-600">{formatCurrency(agingBuckets.days60.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-orange-600">{formatCurrency(agingBuckets.days90.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-rose-600">{formatCurrency(agingBuckets.days120Plus.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-black text-indigo-600">{formatCurrency(totalApSubledger)}</td>
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <PieChart className="text-indigo-600" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">AP Subledger Total</h3>
          </div>
          <p className="text-3xl font-black text-indigo-600">₱{formatCurrency(totalApSubledger)}</p>
          <p className="text-xs text-slate-500 mt-2">Sum of all vendor balances</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <BookOpen className="text-emerald-600" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">AP Control Account</h3>
          </div>
          <p className="text-3xl font-black text-emerald-600">
            ₱{formatCurrency(apControlAccount ? summaryMetrics.total : 0)}
          </p>
          <p className="text-xs text-slate-500 mt-2">{apControlAccount?.name || 'Not configured'}</p>
        </div>
      </div>

      {/* Vendor Balances */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Building className="text-indigo-600" size={20} />
          Vendor Balances (Subledger)
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Vendor</th>
              <th className="py-3 text-left text-[10px] font-bold text-slate-400 uppercase">TIN</th>
              <th className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Invoices</th>
              <th className="py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody>
            {vendorBalances.map(({ vendor, balance, invoiceCount }) => (
              <tr key={vendor.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                      {vendor.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{vendor.name}</span>
                  </div>
                </td>
                <td className="py-3 text-sm font-mono text-slate-500">{vendor.tin || '-'}</td>
                <td className="py-3 text-center text-sm text-slate-600">{invoiceCount}</td>
                <td className={`py-3 text-right text-sm font-mono font-semibold ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  ₱{formatCurrency(balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={3} className="py-3 text-sm font-bold text-slate-800">TOTAL SUBLEDGER</td>
              <td className="py-3 text-right text-sm font-mono font-black text-indigo-600">₱{formatCurrency(totalApSubledger)}</td>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Coins className="text-indigo-600" size={28} />
            Accounts Payable
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage vendor invoices, process payments, and track aging.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
          >
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'list', label: 'Invoice List', icon: FileText },
          { key: 'aging', label: 'Aging Report', icon: BarChart3 },
          { key: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as APTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key 
                ? 'text-indigo-600 border-indigo-600' 
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total Open" value={formatCurrency(summaryMetrics.total)} color="text-indigo-600" icon={Coins} />
        <SummaryCard label="For Approval" value={formatCurrency(summaryMetrics.forApproval)} color="text-amber-600" icon={Clock} />
        <SummaryCard label="Approved" value={formatCurrency(summaryMetrics.approved)} color="text-blue-600" icon={CheckCircle} />
        <SummaryCard label="Due Soon (7d)" value={formatCurrency(summaryMetrics.dueSoon)} color="text-violet-600" icon={Calendar} />
        <SummaryCard label="Overdue" value={formatCurrency(summaryMetrics.overdue)} color="text-rose-600" icon={AlertCircle} />
        <SummaryCard label="Total Paid" value={formatCurrency(summaryMetrics.paid)} color="text-emerald-600" icon={CreditCard} />
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && renderListTab()}
      {activeTab === 'aging' && renderAgingTab()}
      {activeTab === 'reconciliation' && renderReconciliationTab()}

      {/* Create Modal */}
      {showCreateModal && (
        <PayableFormModal
          title="Create Invoice / Bill"
          formData={formData}
          setFormData={setFormData}
          vendors={orgVendors}
          accounts={orgAccounts}
          expenseAccounts={expenseAccounts}
          liabilityAccounts={liabilityAccounts}
          onSubmit={handleCreate}
          onClose={() => { setShowCreateModal(false); resetForm(); }}
          submitLabel="Create"
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPayable && (
        <PayableFormModal
          title={`Edit: ${selectedPayable.payableNumber}`}
          formData={formData}
          setFormData={setFormData}
          vendors={orgVendors}
          accounts={orgAccounts}
          expenseAccounts={expenseAccounts}
          liabilityAccounts={liabilityAccounts}
          onSubmit={handleUpdate}
          onClose={() => { setShowEditModal(false); setSelectedPayable(null); resetForm(); }}
          submitLabel="Save Changes"
          isEdit
        />
      )}

      {/* View Modal */}
      {showViewModal && selectedPayable && (
        <PayableDetailModal
          payable={selectedPayable}
          vendor={orgVendors.find(v => v.id === selectedPayable.vendorId)}
          accounts={orgAccounts}
          onClose={() => { setShowViewModal(false); setSelectedPayable(null); }}
          onApprove={() => { handleStatusChange(selectedPayable.id, 'approved'); setShowViewModal(false); }}
          onProcessPayment={() => { setShowViewModal(false); openPaymentModal(selectedPayable); }}
          onPostGL={() => { setShowViewModal(false); openPostGLModal(selectedPayable); }}
          canPost={!!onPostJournal && !selectedPayable.journalEntryId && selectedPayable.status === 'for_approval'}
          canPay={!!onPostJournal && (selectedPayable.status === 'approved' || selectedPayable.status === 'partially_paid')}
        />
      )}

      {/* Post to GL Modal */}
      {showPostGLModal && selectedPayable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <BookOpen className="text-emerald-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Post to General Ledger</h3>
                <p className="text-sm text-slate-500">{selectedPayable.payableNumber}</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <p className="font-semibold text-slate-700">Journal Entry Preview:</p>
              <div className="space-y-1 font-mono text-xs">
                {selectedPayable.invoiceType !== 'credit_memo' ? (
                  <>
                    <p className="text-slate-600">DR {orgAccounts.find(a => a.id === selectedPayable.expenseAccountId)?.name || 'Expense'} ... ₱{formatCurrency(selectedPayable.amount)}</p>
                    {selectedPayable.inputVatAmount > 0 && (
                      <p className="text-slate-600">DR Input VAT ... ₱{formatCurrency(selectedPayable.inputVatAmount)}</p>
                    )}
                    {selectedPayable.withholdingAmount > 0 && (
                      <p className="text-slate-600 pl-4">CR Withholding Tax Payable ... ₱{formatCurrency(selectedPayable.withholdingAmount)}</p>
                    )}
                    <p className="text-slate-600 pl-4">CR Accounts Payable ... ₱{formatCurrency(selectedPayable.netPayable || selectedPayable.amount)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-600">DR Accounts Payable ... ₱{formatCurrency(Math.abs(selectedPayable.netPayable || selectedPayable.amount))}</p>
                    <p className="text-slate-600 pl-4">CR {orgAccounts.find(a => a.id === selectedPayable.expenseAccountId)?.name || 'Expense'} ... ₱{formatCurrency(selectedPayable.amount)}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPostGLModal(false); setSelectedPayable(null); }}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePostToGL}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                Post to GL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPayable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Process Payment</h3>
                  <p className="text-xs text-slate-500">{selectedPayable.payableNumber} • {getVendorName(selectedPayable.vendorId)}</p>
                </div>
              </div>
              <button onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Outstanding Balance */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-amber-800">Outstanding Balance</span>
                  <span className="text-xl font-black text-amber-600">
                    ₱{formatCurrency((selectedPayable.netPayable || selectedPayable.amount) - (selectedPayable.paidAmount || 0))}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Method</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium appearance-none"
                  value={paymentData.paymentMethod}
                  onChange={e => setPaymentData({...paymentData, paymentMethod: e.target.value as PaymentMethod})}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Bank Account */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Pay From (Bank Account)</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium appearance-none"
                  value={paymentData.bankAccountId}
                  onChange={e => setPaymentData({...paymentData, bankAccountId: e.target.value})}
                >
                  <option value="">Select Bank Account...</option>
                  {orgBankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                  ))}
                </select>
              </div>

              {/* Check Details (if check payment) */}
              {paymentData.paymentMethod === 'check' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Check Number</label>
                    <input 
                      type="text"
                      placeholder="Check #"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono"
                      value={paymentData.checkNumber}
                      onChange={e => setPaymentData({...paymentData, checkNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Check Date</label>
                    <input 
                      type="date"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                      value={paymentData.checkDate}
                      onChange={e => setPaymentData({...paymentData, checkDate: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Amount</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                    value={paymentData.amountPaid}
                    onChange={e => setPaymentData({...paymentData, amountPaid: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={paymentData.paymentDate}
                    onChange={e => setPaymentData({...paymentData, paymentDate: e.target.value})}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); resetPaymentForm(); }}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProcessPayment}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Landmark size={16} /> Process Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="text-rose-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Delete Payable?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PAYABLE FORM MODAL COMPONENT
// ============================================================================
interface PayableFormModalProps {
  title: string;
  formData: Partial<Payable>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Payable>>>;
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  expenseAccounts: ChartOfAccount[];
  liabilityAccounts: ChartOfAccount[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
  isEdit?: boolean;
}

const PayableFormModal: React.FC<PayableFormModalProps> = ({
  title,
  formData,
  setFormData,
  vendors,
  accounts,
  expenseAccounts,
  liabilityAccounts,
  onSubmit,
  onClose,
  submitLabel,
  isEdit = false,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <Calculator size={20} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Invoice Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Document Type</label>
            <div className="flex gap-2">
              {INVOICE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, invoiceType: type.value }))}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    formData.invoiceType === type.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Building size={12} /> Vendor *
            </label>
            <select 
              required
              disabled={isEdit}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none disabled:opacity-60"
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
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Document # *</label>
              <input 
                type="text"
                required
                placeholder="BILL-2026-00001"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-mono"
                value={formData.payableNumber || ''}
                onChange={e => setFormData(prev => ({ ...prev, payableNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar size={12} /> Invoice Date *
              </label>
              <input 
                type="date"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={formData.billDate || ''}
                onChange={e => setFormData(prev => ({ ...prev, billDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Due Date *</label>
              <input 
                type="date"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={formData.dueDate || ''}
                onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Expense Account & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">Expense Account *</label>
              <select 
                required={formData.invoiceType === 'standard'}
                className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
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
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Category</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
                value={formData.category || 'general'}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as PayableCategory }))}
              >
                {PAYABLE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Description</label>
            <input 
              type="text"
              placeholder="Brief description of the invoice..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Amount & VAT */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Gross Amount *</label>
              <input 
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Input VAT</label>
              <input 
                type="number"
                step="0.01"
                min="0"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                value={formData.inputVatAmount || ''}
                onChange={e => setFormData(prev => ({ ...prev, inputVatAmount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest">Withholding Type</label>
              <select 
                className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl outline-none text-sm appearance-none"
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
            <div className="grid grid-cols-3 gap-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Rate (%)</label>
                <input 
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-mono text-sm"
                  value={formData.appliedRatePercent || ''}
                  onChange={e => setFormData(prev => ({ ...prev, appliedRatePercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">WHT Amount</label>
                <input 
                  type="text"
                  readOnly
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                  value={(formData.withholdingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest">Net Payable</label>
                <input 
                  type="text"
                  readOnly
                  className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl outline-none font-mono text-sm font-bold text-indigo-700"
                  value={(formData.netPayable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                />
              </div>
            </div>
          )}

          {/* Reference Document & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Reference Document</label>
              <input 
                type="text"
                placeholder="Vendor Invoice #, OR #, etc."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={formData.referenceDocument || ''}
                onChange={e => setFormData(prev => ({ ...prev, referenceDocument: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Notes</label>
              <input 
                type="text"
                placeholder="Additional notes..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                value={formData.notes || ''}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* Status (Edit mode) */}
          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Status</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
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
          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all"
            >
              {submitLabel}
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
  const remainingBalance = (payable.netPayable || payable.amount) - (payable.paidAmount || 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{payable.payableNumber}</h3>
              <p className="text-xs text-slate-500">{vendor?.name || 'Unknown Vendor'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
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
              <p className="text-2xl font-black text-slate-800">₱{formatCurrency(payable.netPayable || payable.amount)}</p>
              {remainingBalance !== (payable.netPayable || payable.amount) && (
                <p className="text-xs text-amber-600 font-semibold">Balance: ₱{formatCurrency(remainingBalance)}</p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category</p>
              <p className="text-slate-700 font-medium">{PAYABLE_CATEGORIES.find(c => c.value === payable.category)?.label || payable.category}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expense Account</p>
              <p className="text-slate-700 font-medium">{expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Invoice Date</p>
              <p className="text-slate-700 font-medium">{payable.billDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
              <p className="text-slate-700 font-medium">{payable.dueDate}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Amount</p>
              <p className="text-slate-700 font-mono">₱{formatCurrency(payable.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Input VAT</p>
              <p className="text-slate-700 font-mono">₱{formatCurrency(payable.inputVatAmount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Withholding</p>
              <p className="text-slate-700 font-mono">₱{formatCurrency(payable.withholdingAmount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paid Amount</p>
              <p className="text-emerald-600 font-mono font-semibold">₱{formatCurrency(payable.paidAmount || 0)}</p>
            </div>
            {payable.referenceDocument && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reference Document</p>
                <p className="text-slate-700 font-medium">{payable.referenceDocument}</p>
              </div>
            )}
            {payable.description && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</p>
                <p className="text-slate-700">{payable.description}</p>
              </div>
            )}
          </div>

          {/* GL Status */}
          {payable.journalEntryId && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2">
                <BookOpen className="text-emerald-600" size={16} />
                <span className="text-sm font-semibold text-emerald-700">Posted to General Ledger</span>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
            <p>Created: {new Date(payable.createdAt).toLocaleString()}</p>
            {payable.approvedAt && <p>Approved: {new Date(payable.approvedAt).toLocaleString()}</p>}
            {payable.paidAt && <p>Paid: {new Date(payable.paidAt).toLocaleString()}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={onClose} 
              className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Close
            </button>
            {canPost && (
              <button 
                onClick={onPostGL} 
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen size={16} /> Post to GL
              </button>
            )}
            {payable.status === 'for_approval' && !canPost && (
              <button 
                onClick={onApprove} 
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Approve
              </button>
            )}
            {canPay && (
              <button 
                onClick={onProcessPayment} 
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Landmark size={16} /> Pay
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayablesView;
