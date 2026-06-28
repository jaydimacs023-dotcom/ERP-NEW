import React, { useState, useMemo } from 'react';
import { Vendor, VendorType, VendorStatus, ChartOfAccount, JournalLine, AccountClass } from '../types';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';
import { 
  Search, Plus, Truck, Mail, Phone, Trash2, X, 
  Edit, AlertCircle, MapPin, Building, Link as LinkIcon,
  CreditCard, Globe, Calendar, Banknote, FileText, ChevronDown,
  CheckCircle, XCircle, Archive, Eye, RotateCcw, ArrowLeft, Save
} from 'lucide-react';

interface VendorsViewProps {
  orgId: string;
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  lines: JournalLine[];
  onAddVendor?: (vendor: Vendor) => Vendor | Promise<Vendor>;
  onUpdateVendor?: (id: string, updates: Partial<Vendor>) => Vendor | Promise<Vendor>;
  onDeleteVendor?: (id: string) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

const VENDOR_CATEGORIES = [
  'Supplies', 'Utilities', 'Services', 'Hardware', 'Rent', 
  'Professional Services', 'Contractor', 'Government', 'Other'
];

const CURRENCIES = ['PHP', 'USD', 'EUR', 'SGD', 'JPY', 'GBP', 'AUD'];

const PAYMENT_TERMS = [
  { value: 0, label: 'Due on Receipt' },
  { value: 7, label: 'Net 7' },
  { value: 15, label: 'Net 15' },
  { value: 30, label: 'Net 30' },
  { value: 45, label: 'Net 45' },
  { value: 60, label: 'Net 60' },
  { value: 90, label: 'Net 90' },
];

const PAGE_SIZE = 10;
const VENDOR_COLUMNS = 'id,org_id,name,category,email,contact_number,address,ap_account_id,payment_terms_days,created_at,updated_at';

const STATUS_CONFIG: Record<VendorStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-brand', bgColor: 'bg-brand/10', icon: CheckCircle },
  blocked: { label: 'Blocked', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: XCircle },
  archived: { label: 'Archived', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: Archive },
};

const VendorsView: React.FC<VendorsViewProps> = ({ 
  orgId, vendors, accounts, lines, onAddVendor, onUpdateVendor, onDeleteVendor, onNotify 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverVendors, setServerVendors] = useState<Vendor[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');

  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    category: 'Supplies',
    email: '',
    contactNumber: '',
    address: '',
    apAccountId: '',
    tin: '',
    vendorType: 'local',
    currency: 'PHP',
    status: 'active',
    paymentTermsDays: 30,
    bankName: '',
    bankAccountNumber: '',
    bankBranch: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Supplies',
      email: '',
      contactNumber: '',
      address: '',
      apAccountId: '',
      tin: '',
      vendorType: 'local',
      currency: 'PHP',
      status: 'active',
      paymentTermsDays: 30,
      bankName: '',
      bankAccountNumber: '',
      bankBranch: '',
    });
  };

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, debouncedSearchTerm, orgId, statusFilter]);

  const vendorFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    }
    if (categoryFilter !== 'all') {
      filters.push({ column: 'category', operator: 'eq', value: categoryFilter });
    }
    return filters;
  }, [categoryFilter, orgId]);

  React.useEffect(() => {
    if (!orgId || statusFilter !== 'all') return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Vendor>('vendors', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: VENDOR_COLUMNS,
      filters: vendorFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['name', 'category', 'email', 'contact_number', 'address'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: [{ column: 'name', ascending: true }]
    })
      .then(result => {
        if (!isActive) return;
        setServerVendors(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[VendorsView] Failed to load vendor page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load vendors.');
        setServerVendors([]);
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
  }, [currentPage, debouncedSearchTerm, orgId, refreshKey, statusFilter, vendorFilters]);

  const filteredVendors = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return vendors
      .filter(v => {
        const vendorStatus = v.status || 'active';
        const searchableText = [
          v.name,
          v.category,
          v.tin || '',
          v.email || '',
          v.contactNumber || '',
          v.address || '',
          v.bankName || '',
          v.currency || '',
          v.vendorType || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || vendorStatus === statusFilter;
        const matchesCategory = categoryFilter === 'all' || v.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, debouncedSearchTerm, statusFilter, categoryFilter]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedVendors,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(filteredVendors, [debouncedSearchTerm, statusFilter, categoryFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError || statusFilter !== 'all';
  const paginatedVendors = useFallbackRows ? fallbackPaginatedVendors : serverVendors;
  const totalItems = useFallbackRows ? filteredVendors.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverVendors.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

  // Filter possible AP accounts from COA (Liabilities, code 21xx)
  const apAccounts = accounts.filter(a => 
    !a.isHeader && 
    a.class === AccountClass.LIABILITY && 
    (a.name.toLowerCase().includes('payable') || a.code.startsWith('21'))
  );

  // Calculate Vendor Payable Balances (Subsidiary Ledger)
  const vendorApBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    lines.forEach(line => {
      if (line.contactId && line.contactType === 'VENDOR') {
        const acc = accounts.find(a => a.id === line.accountId);
        if (!acc || acc.class !== AccountClass.LIABILITY || !acc.name.toLowerCase().includes('payable')) return;
        
        const val = line.credit - line.debit;
        balances[line.contactId] = (balances[line.contactId] || 0) + val;
      }
    });
    return balances;
  }, [lines, accounts]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.status === 'active' || !v.status).length;
    const blocked = vendors.filter(v => v.status === 'blocked').length;
    const totalPayables = Object.values(vendorApBalances).reduce((sum, bal) => sum + Math.max(0, bal), 0);
    return { total, active, blocked, totalPayables };
  }, [vendors, vendorApBalances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.apAccountId) {
      onNotify?.('error', 'Validation Error: Name, email, and AP account are required.');
      return;
    }

    const newVendor: Vendor = {
      id: '',
      orgId: 'temp',
      name: formData.name || '',
      category: formData.category || 'Other',
      email: formData.email || '',
      contactNumber: formData.contactNumber || '',
      address: formData.address || '',
      apAccountId: formData.apAccountId,
      tin: formData.tin,
      vendorType: formData.vendorType,
      currency: formData.currency,
      status: formData.status || 'active',
      paymentTermsDays: formData.paymentTermsDays,
      bankName: formData.bankName,
      bankAccountNumber: formData.bankAccountNumber,
      bankBranch: formData.bankBranch,
      createdAt: new Date().toISOString()
    };

    if (!onAddVendor) return;

    const createdVendor = await onAddVendor(newVendor);
    setServerVendors(current => [
      createdVendor,
      ...current.filter(vendor => vendor.id !== createdVendor.id)
    ].slice(0, PAGE_SIZE));
    setServerTotal(total => total + 1);
    setRefreshKey(key => key + 1);
    setShowModal(false);
    resetForm();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !onUpdateVendor) return;
    if (!editingVendor.name || !editingVendor.email || !editingVendor.apAccountId) {
      onNotify?.('error', 'Validation Error: Name, email, and AP account are required.');
      return;
    }

    const updatedVendor = await onUpdateVendor(editingVendor.id!, {
      name: editingVendor.name,
      category: editingVendor.category,
      email: editingVendor.email,
      contactNumber: editingVendor.contactNumber,
      address: editingVendor.address,
      apAccountId: editingVendor.apAccountId,
      tin: editingVendor.tin,
      vendorType: editingVendor.vendorType,
      currency: editingVendor.currency,
      status: editingVendor.status,
      paymentTermsDays: editingVendor.paymentTermsDays,
      bankName: editingVendor.bankName,
      bankAccountNumber: editingVendor.bankAccountNumber,
      bankBranch: editingVendor.bankBranch,
      updatedAt: new Date().toISOString()
    });
    setServerVendors(current => current.map(vendor =>
      vendor.id === updatedVendor.id ? updatedVendor : vendor
    ));
    setRefreshKey(key => key + 1);
    setShowEditModal(false);
    setEditingVendor(null);
    onNotify?.('success', 'Vendor updated successfully.');
  };

  const handleDeleteVendor = (id: string) => {
    const balance = vendorApBalances[id] || 0;
    if (balance > 0) {
      onNotify?.('error', 'Cannot delete vendor with outstanding balance.');
      setConfirmDelete(null);
      return;
    }
    onDeleteVendor?.(id);
    setRefreshKey(key => key + 1);
    setConfirmDelete(null);
    onNotify?.('success', 'Vendor deleted successfully.');
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor({...vendor});
    setShowEditModal(true);
  };

  const openViewModal = (vendor: Vendor) => {
    setViewingVendor(vendor);
    setShowViewModal(true);
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Vendor Form Component (used for both Create and Edit)
  const VendorFormFields = ({ data, setData }: { data: Partial<Vendor>; setData: (d: Partial<Vendor>) => void }) => (
    <div className="space-y-8">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide border-b pb-2">Basic Information</p>
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business Name / Legal Entity *</label>
          <input required placeholder="e.g. Acme Office Supplies Inc." className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-bold text-gray-800"
            value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <FileText size={12} /> TIN (Tax ID)
            </label>
            <input inputMode="numeric" autoComplete="off" placeholder="000-000-000-000" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-mono"
              value={data.tin || ''} onChange={e => setData({...data, tin: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
            <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
              value={data.category || 'Supplies'} onChange={e => setData({...data, category: e.target.value})}>
              {VENDOR_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Globe size={12} /> Type
            </label>
            <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
              value={data.vendorType || 'local'} onChange={e => setData({...data, vendorType: e.target.value as VendorType})}>
              <option value="local">Local</option>
              <option value="foreign">Foreign</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Currency</label>
            <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
              value={data.currency || 'PHP'} onChange={e => setData({...data, currency: e.target.value})}>
              {CURRENCIES.map(cur => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
            <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
              value={data.status || 'active'} onChange={e => setData({...data, status: e.target.value as VendorStatus})}>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contact Info Section */}
      <div className="space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide border-b pb-2">Contact Information</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Mail size={12} /> Billing Email *
            </label>
            <input required type="email" placeholder="billing@vendor.com" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
              value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Phone size={12} /> Contact Number
            </label>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Official Phone" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
              value={data.contactNumber || ''} onChange={e => setData({...data, contactNumber: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin size={12} /> Business Address
          </label>
          <textarea rows={2} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium resize-none"
            value={data.address || ''} onChange={e => setData({...data, address: e.target.value})} />
        </div>
      </div>

      {/* Accounting Section */}
      <div className="space-y-4">
        <p className="text-xs font-bold text-brand uppercase tracking-wide border-b border-brand-light pb-2">Accounting Settings</p>
        
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-brand flex items-center gap-1.5">
            <LinkIcon size={12} /> Default G/L Payables Account *
          </label>
          <select 
            required
            className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded outline-none focus:border-brand text-sm font-bold text-brand appearance-none"
            value={data.apAccountId || ''} 
            onChange={e => setData({...data, apAccountId: e.target.value})}
          >
            <option value="">Select AP Account...</option>
            {apAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={12} /> Payment Terms
          </label>
          <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium appearance-none"
            value={data.paymentTermsDays ?? 30} onChange={e => setData({...data, paymentTermsDays: parseInt(e.target.value)})}>
            {PAYMENT_TERMS.map(term => (
              <option key={term.value} value={term.value}>{term.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bank Info Section */}
      <div className="space-y-4">
        <p className="text-xs font-bold text-brand uppercase tracking-wide border-b border-brand-light pb-2 flex items-center gap-1.5">
          <Banknote size={12} /> Bank Details (for Payments)
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Name</label>
            <input placeholder="e.g. BDO, BPI, Metrobank" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
              value={data.bankName || ''} onChange={e => setData({...data, bankName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Branch</label>
            <input placeholder="e.g. Makati Main" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
              value={data.bankBranch || ''} onChange={e => setData({...data, bankBranch: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard size={12} /> Account Number
          </label>
          <input inputMode="numeric" autoComplete="off" placeholder="Bank Account Number" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-mono"
            value={data.bankAccountNumber || ''} onChange={e => setData({...data, bankAccountNumber: e.target.value})} />
        </div>
      </div>
    </div>
  );

  if (showModal || (showEditModal && editingVendor)) {
    const isEditing = showEditModal && !!editingVendor;
    const activeData = isEditing ? editingVendor : formData;
    const setActiveData = isEditing ? setEditingVendor : setFormData;
    const closeFormPage = () => {
      setShowModal(false);
      setShowEditModal(false);
      setEditingVendor(null);
      resetForm();
    };

    return (
      <div className="min-h-full pb-20 animate-in fade-in slide-in-from-right-2 duration-300">
        <div className="max-w-6xl mx-auto space-y-6">
          <button
            type="button"
            onClick={closeFormPage}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-brand transition-colors group"
          >
            <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-1" />
            Back to Vendor Registry
          </button>

          <header className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-900 px-7 py-8 text-white shadow-sm">
            <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-brand/30 to-transparent" />
            <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full border border-white/10" />
            <div className="relative max-w-2xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                Vendor Master Data
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {isEditing ? `Edit ${activeData.name || 'Vendor'}` : 'Onboard a New Supplier'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                Maintain the supplier identity, payment defaults, and banking details used throughout accounts payable.
              </p>
            </div>
          </header>

          <form onSubmit={isEditing ? handleEditSubmit : handleSubmit}>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <main className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm md:p-8">
                {VendorFormFields({ data: activeData, setData: setActiveData })}
              </main>

              <aside className="space-y-4 lg:sticky lg:top-6">
                <div className="rounded-lg border border-brand/20 bg-brand/5 p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded bg-brand text-white">
                    <AlertCircle size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-800">Before you save</h3>
                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    Confirm the legal name, billing email, AP account, and payment terms. These values flow into payable transactions.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Required fields</p>
                  <ul className="mt-3 space-y-2 text-xs text-gray-600">
                    <li>Business name</li>
                    <li>Billing email</li>
                    <li>Default G/L payables account</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-brand px-5 py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition-all hover:bg-brand-hover active:scale-[0.98]"
                  >
                    <Save size={17} />
                    {isEditing ? 'Save Changes' : 'Create Vendor'}
                  </button>
                  <button
                    type="button"
                    onClick={closeFormPage}
                    className="w-full rounded px-5 py-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Vendor Master Registry
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage procurement partners, payment terms, and track outstanding payables.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Supplier
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Vendors</p>
              <p className="text-lg font-semibold mt-1 text-gray-800">{summaryMetrics.total}</p>
            </div>
            <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
              <Building className="text-gray-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Active</p>
              <p className="text-lg font-semibold mt-1 text-brand">{summaryMetrics.active}</p>
            </div>
            <div className="w-12 h-12 rounded bg-brand/10 border border-brand-light flex items-center justify-center">
              <CheckCircle className="text-brand" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Blocked</p>
              <p className="text-lg font-semibold mt-1 text-rose-600">{summaryMetrics.blocked}</p>
            </div>
            <div className="w-12 h-12 rounded bg-rose-100 flex items-center justify-center">
              <XCircle className="text-rose-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Payables</p>
              <p className="text-lg font-semibold mt-1 text-amber-600">{"\u20B1"}{formatCurrency(summaryMetrics.totalPayables)}</p>
            </div>
            <div className="w-12 h-12 rounded bg-amber-100 flex items-center justify-center">
              <CreditCard className="text-amber-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search vendors..." 
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VendorStatus | 'all')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[160px]"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[190px]"
            >
              <option value="all">All</option>
              {VENDOR_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching vendor{totalItems !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Vendor & G/L Link</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">TIN / Category</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Terms / Currency</th>
              <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Unpaid Balance</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingPage && !useFallbackRows ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Truck size={40} className="mx-auto mb-2 text-gray-300" />
                  Loading vendors...
                </td>
              </tr>
            ) : totalItems > 0 ? paginatedVendors.map(vendor => {
              const linkedAcc = accounts.find(a => a.id === vendor.apAccountId);
              const balance = vendorApBalances[vendor.id] || 0;
              const statusConfig = STATUS_CONFIG[vendor.status || 'active'];
              const StatusIcon = statusConfig.icon;
              
              return (
                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-brand border border-brand-light shadow-sm shrink-0">
                        {vendor.vendorType === 'foreign' ? <Globe size={20} /> : <Building size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800 leading-tight">{vendor.name}</div>
                        <div className="text-xs font-bold text-brand mt-1 uppercase tracking-tighter flex items-center gap-1">
                          <LinkIcon size={10} /> {linkedAcc ? `[${linkedAcc.code}] ${linkedAcc.name}` : 'No G/L Linked'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {vendor.tin && (
                        <span className="text-xs font-mono text-gray-600">{vendor.tin}</span>
                      )}
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-100 px-1.5 py-0.5 rounded w-fit border border-gray-200">
                        {vendor.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600">
                        {PAYMENT_TERMS.find(t => t.value === vendor.paymentTermsDays)?.label || `Net ${vendor.paymentTermsDays ?? 30}`}
                      </span>
                      <span className="text-xs font-bold text-gray-400">{vendor.currency || 'PHP'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                      <StatusIcon size={12} /> {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-mono font-bold ${balance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {"\u20B1"}{formatCurrency(balance)}
                      </div>
                      <div className="text-xs font-semibold text-gray-400 uppercase">Accounts Payable</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openViewModal(vendor)}
                        className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                        title="View details">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => openEditModal(vendor)}
                        className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors"
                        title="Edit vendor">
                        <Edit size={16} />
                      </button>
                      {confirmDelete === vendor.id ? (
                        <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-1">
                           <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-xs font-semibold uppercase text-gray-400">Cancel</button>
                           <button onClick={() => handleDeleteVendor(vendor.id)} className="px-2 py-1 text-xs font-semibold uppercase text-rose-600 bg-rose-50 rounded">Confirm</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(vendor.id)} className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <Truck size={40} className="mx-auto mb-2 text-gray-300" />
                  {pageLoadError
                    ? 'Unable to load vendors from Supabase.'
                    : hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'Add your first vendor to your procurement master registry.'}
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
          itemLabel="vendors"
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><Truck size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Onboard Supplier</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {VendorFormFields({ data: formData, setData: setFormData })}

              <div className="bg-amber-50 p-4 rounded border border-amber-100 flex gap-3 mt-5">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-xs text-amber-800 leading-relaxed font-medium">
                   Ensure vendor details are accurate for proper AP accounting and withholding tax compliance.
                 </p>
              </div>

              <div className="pt-4 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-brand text-white rounded text-sm font-bold shadow-lg shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all">Create Vendor</button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Edit Modal */}
      {showEditModal && editingVendor && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><Edit size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Edit Vendor</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6">
              {VendorFormFields({ data: editingVendor, setData: setEditingVendor })}

              <div className="pt-4 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 bg-brand text-white rounded text-sm font-bold shadow-lg shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* View Modal */}
      {showViewModal && viewingVendor && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20">
                  {viewingVendor.vendorType === 'foreign' ? <Globe size={20} /> : <Building size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{viewingVendor.name}</h3>
                  <p className="text-xs text-gray-500">{viewingVendor.category} • {viewingVendor.vendorType === 'foreign' ? 'Foreign' : 'Local'}</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Balance */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-full ${STATUS_CONFIG[viewingVendor.status || 'active'].bgColor} ${STATUS_CONFIG[viewingVendor.status || 'active'].color}`}>
                  {React.createElement(STATUS_CONFIG[viewingVendor.status || 'active'].icon, { size: 14 })}
                  {STATUS_CONFIG[viewingVendor.status || 'active'].label}
                </span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-amber-600">{"\u20B1"}{formatCurrency(vendorApBalances[viewingVendor.id] || 0)}</p>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Outstanding Balance</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {viewingVendor.tin && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">TIN</p>
                    <p className="text-gray-700 font-mono">{viewingVendor.tin}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Payment Terms</p>
                  <p className="text-gray-700">{PAYMENT_TERMS.find(t => t.value === viewingVendor.paymentTermsDays)?.label || `Net ${viewingVendor.paymentTermsDays ?? 30}`}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Currency</p>
                  <p className="text-gray-700 font-semibold">{viewingVendor.currency || 'PHP'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">AP Account</p>
                  <p className="text-gray-700 text-xs">{accounts.find(a => a.id === viewingVendor.apAccountId)?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Email</p>
                  <p className="text-gray-700">{viewingVendor.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-gray-700">{viewingVendor.contactNumber || 'N/A'}</p>
                </div>
                {viewingVendor.address && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Address</p>
                    <p className="text-gray-700">{viewingVendor.address}</p>
                  </div>
                )}
              </div>

              {/* Bank Info */}
              {(viewingVendor.bankName || viewingVendor.bankAccountNumber) && (
                <div className="bg-emerald-50 rounded p-4 border border-emerald-100">
                  <p className="text-xs font-bold text-brand uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Banknote size={12} /> Bank Details
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {viewingVendor.bankName && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Bank</p>
                        <p className="text-gray-700 font-medium">{viewingVendor.bankName}</p>
                      </div>
                    )}
                    {viewingVendor.bankBranch && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Branch</p>
                        <p className="text-gray-700 font-medium">{viewingVendor.bankBranch}</p>
                      </div>
                    )}
                    {viewingVendor.bankAccountNumber && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Account #</p>
                        <p className="text-gray-700 font-mono">{viewingVendor.bankAccountNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowViewModal(false)} 
                  className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => { setShowViewModal(false); openEditModal(viewingVendor); }}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Edit Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default VendorsView;

