import React, { useState, useMemo } from 'react';
import { Vendor, VendorType, VendorStatus, ChartOfAccount, JournalLine, AccountClass } from '../types';
import EmptyState from '../components/EmptyState';
import { 
  Search, Plus, Truck, Mail, Phone, Trash2, X, 
  Edit, AlertCircle, MapPin, Building, Filter, Link as LinkIcon,
  CreditCard, Globe, Calendar, Banknote, FileText, ChevronDown,
  CheckCircle, XCircle, Archive, Eye
} from 'lucide-react';

interface VendorsViewProps {
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  lines: JournalLine[];
  onAddVendor?: (vendor: Vendor) => void;
  onUpdateVendor?: (id: string, updates: Partial<Vendor>) => void;
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

const STATUS_CONFIG: Record<VendorStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: CheckCircle },
  blocked: { label: 'Blocked', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: XCircle },
  archived: { label: 'Archived', color: 'text-slate-500', bgColor: 'bg-slate-100', icon: Archive },
};

const VendorsView: React.FC<VendorsViewProps> = ({ 
  vendors, accounts, lines, onAddVendor, onUpdateVendor, onDeleteVendor, onNotify 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<Partial<Vendor> | null>(null);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);

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

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.tin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [vendors, searchTerm, statusFilter]);

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

  const handleSubmit = (e: React.FormEvent) => {
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

    onAddVendor?.(newVendor);
    setShowModal(false);
    resetForm();
    onNotify?.('success', 'Vendor created successfully.');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !onUpdateVendor) return;
    if (!editingVendor.name || !editingVendor.email || !editingVendor.apAccountId) {
      onNotify?.('error', 'Validation Error: Name, email, and AP account are required.');
      return;
    }

    onUpdateVendor(editingVendor.id!, {
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
    <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2">
      {/* Basic Info Section */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Basic Information</p>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Business Name / Legal Entity *</label>
          <input required placeholder="e.g. Acme Office Supplies Inc." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-bold text-slate-800"
            value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={12} /> TIN (Tax ID)
            </label>
            <input placeholder="000-000-000-000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-mono"
              value={data.tin || ''} onChange={e => setData({...data, tin: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Category</label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
              value={data.category || 'Supplies'} onChange={e => setData({...data, category: e.target.value})}>
              {VENDOR_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Globe size={12} /> Type
            </label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
              value={data.vendorType || 'local'} onChange={e => setData({...data, vendorType: e.target.value as VendorType})}>
              <option value="local">Local</option>
              <option value="foreign">Foreign</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Currency</label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
              value={data.currency || 'PHP'} onChange={e => setData({...data, currency: e.target.value})}>
              {CURRENCIES.map(cur => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Status</label>
            <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
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
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Contact Information</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Mail size={12} /> Billing Email *
            </label>
            <input required type="email" placeholder="billing@vendor.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
              value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Phone size={12} /> Contact Number
            </label>
            <input placeholder="Official Phone" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
              value={data.contactNumber || ''} onChange={e => setData({...data, contactNumber: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <MapPin size={12} /> Business Address
          </label>
          <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium resize-none"
            value={data.address || ''} onChange={e => setData({...data, address: e.target.value})} />
        </div>
      </div>

      {/* Accounting Section */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-2">Accounting Settings</p>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
            <LinkIcon size={12} /> Default G/L Payables Account *
          </label>
          <select 
            required
            className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-bold text-indigo-700 appearance-none"
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
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} /> Payment Terms
          </label>
          <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
            value={data.paymentTermsDays ?? 30} onChange={e => setData({...data, paymentTermsDays: parseInt(e.target.value)})}>
            {PAYMENT_TERMS.map(term => (
              <option key={term.value} value={term.value}>{term.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bank Info Section */}
      <div className="space-y-4">
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2 flex items-center gap-1.5">
          <Banknote size={12} /> Bank Details (for Payments)
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bank Name</label>
            <input placeholder="e.g. BDO, BPI, Metrobank" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
              value={data.bankName || ''} onChange={e => setData({...data, bankName: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Branch</label>
            <input placeholder="e.g. Makati Main" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
              value={data.bankBranch || ''} onChange={e => setData({...data, bankBranch: e.target.value})} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <CreditCard size={12} /> Account Number
          </label>
          <input placeholder="Bank Account Number" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-mono"
            value={data.bankAccountNumber || ''} onChange={e => setData({...data, bankAccountNumber: e.target.value})} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Truck className="text-indigo-600" size={28} />
            Vendor Master Registry
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage procurement partners, payment terms, and track outstanding payables.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Supplier
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Vendors</p>
              <p className="text-2xl font-black mt-1 text-slate-800">{summaryMetrics.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
              <Building className="text-slate-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active</p>
              <p className="text-2xl font-black mt-1 text-emerald-600">{summaryMetrics.active}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="text-emerald-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blocked</p>
              <p className="text-2xl font-black mt-1 text-rose-600">{summaryMetrics.blocked}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
              <XCircle className="text-rose-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Payables</p>
              <p className="text-2xl font-black mt-1 text-amber-600">{"\u20B1"}{formatCurrency(summaryMetrics.totalPayables)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <CreditCard className="text-amber-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, TIN, email, or category..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VendorStatus | 'all')}
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredVendors.length}</span> of {vendors.length} vendors
        </p>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Vendor & G/L Link</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">TIN / Category</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Terms / Currency</th>
              <th className="px-6 py-4 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Unpaid Balance</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVendors.length > 0 ? filteredVendors.map(vendor => {
              const linkedAcc = accounts.find(a => a.id === vendor.apAccountId);
              const balance = vendorApBalances[vendor.id] || 0;
              const statusConfig = STATUS_CONFIG[vendor.status || 'active'];
              const StatusIcon = statusConfig.icon;
              
              return (
                <tr key={vendor.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm shrink-0">
                        {vendor.vendorType === 'foreign' ? <Globe size={20} /> : <Building size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 leading-tight">{vendor.name}</div>
                        <div className="text-[9px] font-bold text-indigo-500 mt-1 uppercase tracking-tighter flex items-center gap-1">
                          <LinkIcon size={10} /> {linkedAcc ? `[${linkedAcc.code}] ${linkedAcc.name}` : 'No G/L Linked'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      {vendor.tin && (
                        <span className="text-xs font-mono text-slate-600">{vendor.tin}</span>
                      )}
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded w-fit border border-slate-200">
                        {vendor.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600">
                        {PAYMENT_TERMS.find(t => t.value === vendor.paymentTermsDays)?.label || `Net ${vendor.paymentTermsDays || 30}`}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{vendor.currency || 'PHP'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                      <StatusIcon size={12} /> {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-mono font-bold ${balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {"\u20B1"}{formatCurrency(balance)}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-400 uppercase">Accounts Payable</div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openViewModal(vendor)}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        title="View details">
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => openEditModal(vendor)}
                        className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                        title="Edit vendor">
                        <Edit size={16} />
                      </button>
                      {confirmDelete === vendor.id ? (
                        <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-1">
                           <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Cancel</button>
                           <button onClick={() => handleDeleteVendor(vendor.id)} className="px-2 py-1 text-[10px] font-semibold uppercase text-rose-600 bg-rose-50 rounded">Confirm</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(vendor.id)} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="px-6 py-12">
                <EmptyState 
                  title="No suppliers found"
                  description={searchTerm || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Add your first vendor to your procurement master registry.'}
                  actionLabel="Add Supplier"
                  onAction={() => { resetForm(); setShowModal(true); }}
                  icon={<Truck size={48} className="text-slate-300" />}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Truck size={20} /></div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Onboard Supplier</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <VendorFormFields data={formData} setData={setFormData} />

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3 mt-5">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   Ensure vendor details are accurate for proper AP accounting and withholding tax compliance.
                 </p>
              </div>

              <div className="pt-4 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Create Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingVendor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Edit size={20} /></div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Edit Vendor</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6">
              <VendorFormFields data={editingVendor} setData={setEditingVendor} />

              <div className="pt-4 flex gap-3 mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingVendor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  {viewingVendor.vendorType === 'foreign' ? <Globe size={20} /> : <Building size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{viewingVendor.name}</h3>
                  <p className="text-xs text-slate-500">{viewingVendor.category} • {viewingVendor.vendorType === 'foreign' ? 'Foreign' : 'Local'}</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Balance */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase rounded-full ${STATUS_CONFIG[viewingVendor.status || 'active'].bgColor} ${STATUS_CONFIG[viewingVendor.status || 'active'].color}`}>
                  {React.createElement(STATUS_CONFIG[viewingVendor.status || 'active'].icon, { size: 14 })}
                  {STATUS_CONFIG[viewingVendor.status || 'active'].label}
                </span>
                <div className="text-right">
                  <p className="text-2xl font-black text-amber-600">{"\u20B1"}{formatCurrency(vendorApBalances[viewingVendor.id] || 0)}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Outstanding Balance</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {viewingVendor.tin && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TIN</p>
                    <p className="text-slate-700 font-mono">{viewingVendor.tin}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Payment Terms</p>
                  <p className="text-slate-700">{PAYMENT_TERMS.find(t => t.value === viewingVendor.paymentTermsDays)?.label || `Net ${viewingVendor.paymentTermsDays || 30}`}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Currency</p>
                  <p className="text-slate-700 font-semibold">{viewingVendor.currency || 'PHP'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">AP Account</p>
                  <p className="text-slate-700 text-xs">{accounts.find(a => a.id === viewingVendor.apAccountId)?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-slate-700">{viewingVendor.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-slate-700">{viewingVendor.contactNumber || 'N/A'}</p>
                </div>
                {viewingVendor.address && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</p>
                    <p className="text-slate-700">{viewingVendor.address}</p>
                  </div>
                )}
              </div>

              {/* Bank Info */}
              {(viewingVendor.bankName || viewingVendor.bankAccountNumber) && (
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Banknote size={12} /> Bank Details
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {viewingVendor.bankName && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Bank</p>
                        <p className="text-slate-700 font-medium">{viewingVendor.bankName}</p>
                      </div>
                    )}
                    {viewingVendor.bankBranch && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Branch</p>
                        <p className="text-slate-700 font-medium">{viewingVendor.bankBranch}</p>
                      </div>
                    )}
                    {viewingVendor.bankAccountNumber && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Account #</p>
                        <p className="text-slate-700 font-mono">{viewingVendor.bankAccountNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowViewModal(false)} 
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => { setShowViewModal(false); openEditModal(viewingVendor); }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Edit Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorsView;
