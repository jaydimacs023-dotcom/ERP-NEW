import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Vendor, NonStockItem } from '../types';
import ModalPortal from '../components/ModalPortal';
import {
  FileStack, Plus, Search, X, Save, Trash2,
  ChevronRight, CheckCircle, Clock, Box,
  ShoppingCart, ShieldCheck, Database, ChevronDown,
  RotateCcw, CheckSquare
} from 'lucide-react';

interface PurchaseOrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  items: NonStockItem[];
  onCreatePO: (po: PurchaseOrder) => void;
  onUpdateStatus: (id: string, status: PurchaseOrderStatus) => void;
  onConvertToBill: (po: PurchaseOrder) => void;
}

const formatRegistryDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const getTodayDateValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ 
  purchaseOrders, vendors, items, onCreatePO, onUpdateStatus, onConvertToBill 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    vendorId: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    memo: '',
    lines: [{ id: '1', itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
  });

  const filteredPOs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const todayValue = getTodayDateValue();
    const currentMonthValue = todayValue.slice(0, 7);

    return purchaseOrders
      .filter(po => {
        const vendor = vendors.find(v => v.id === po.vendorId);
        const searchableText = [
          po.reference,
          po.glEntryNumber || '',
          vendor?.name || '',
          po.memo || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
        const matchesVendor = vendorFilter === 'ALL' || po.vendorId === vendorFilter;

        const poDateValue = po.date?.slice(0, 10) || '';
        let matchesDate = true;
        if (dateFilterMode === 'TODAY') {
          matchesDate = poDateValue === todayValue;
        } else if (dateFilterMode === 'THIS_MONTH') {
          matchesDate = poDateValue.slice(0, 7) === currentMonthValue;
        } else if (dateFilterMode === 'CUSTOM') {
          matchesDate =
            (!dateFrom || poDateValue >= dateFrom) &&
            (!dateTo || poDateValue <= dateTo);
        }

        return matchesSearch && matchesStatus && matchesVendor && matchesDate;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [purchaseOrders, vendors, searchTerm, statusFilter, vendorFilter, dateFilterMode, dateFrom, dateTo]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'ALL' ||
    vendorFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const getStatusStyle = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.DRAFT: return 'bg-gray-100 text-gray-600 border-gray-200';
      case PurchaseOrderStatus.PENDING_APPROVAL: return 'bg-amber-50 text-amber-700 border-amber-200';
      case PurchaseOrderStatus.APPROVED: return 'bg-brand/10 text-brand border-brand-light';
      case PurchaseOrderStatus.REJECTED: return 'bg-rose-50 text-rose-700 border-rose-200';
      case PurchaseOrderStatus.BILLED: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case PurchaseOrderStatus.CLOSED: return 'bg-gray-700 text-white border-gray-800';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusLabel = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.PENDING_APPROVAL:
        return 'PENDING APPROVAL';
      case PurchaseOrderStatus.BILLED:
        return 'FULLY BILLED';
      default:
        return status.replace(/_/g, ' ');
    }
  };

  const calculateLineTotal = (line: Partial<PurchaseOrderLine>) => {
    return (line.qty || 0) * (line.unitPrice || 0);
  };

  const poTotal = useMemo(() => {
    return (formData.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  }, [formData.lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorId || !formData.lines?.length) return;

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      orgId: 'temp',
      vendorId: formData.vendorId!,
      date: formData.date!,
      reference: formData.reference!,
      status: PurchaseOrderStatus.DRAFT,
      lines: formData.lines as PurchaseOrderLine[],
      totalAmount: poTotal,
      memo: formData.memo,
      createdAt: new Date().toISOString()
    };

    onCreatePO(newPO);
    setShowModal(false);
    setFormData({
      vendorId: '',
      date: new Date().toISOString().split('T')[0],
      reference: '',
      memo: '',
      lines: [{ id: '1', itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Procurement Intelligence</h2>
          <p className="text-sm text-gray-500 font-normal italic">Authorized purchase commitments and vendor fulfillment tracking.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded font-semibold text-xs uppercase tracking-wide shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Initialize PO
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Active Commitments</p>
            <div className="flex items-end justify-between">
               <p className="text-xl font-semibold text-gray-800 tracking-tight">{purchaseOrders.filter(p => p.status === PurchaseOrderStatus.APPROVED).length}</p>
               <div className="p-3 bg-brand/10 rounded text-brand border border-brand-light"><CheckCircle size={20} /></div>
            </div>
         </div>
         <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Awaiting Approval</p>
            <div className="flex items-end justify-between">
               <p className="text-xl font-semibold text-gray-800 tracking-tight">{purchaseOrders.filter(p => p.status === PurchaseOrderStatus.PENDING_APPROVAL).length}</p>
               <div className="p-3 bg-amber-50 rounded text-amber-600"><Clock size={20} /></div>
            </div>
         </div>
         <div className="bg-gray-800 p-8 rounded-md border border-gray-700 shadow-sm col-span-2 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 text-gray-800 opacity-20 group-hover:scale-110 transition-transform">
               <ShoppingCart size={160} />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Total Open Obligation</p>
            <div className="flex items-end justify-between relative z-10">
               <p className="text-xl font-semibold text-white tracking-tight leading-none pt-1">
                  PHP {purchaseOrders.reduce((sum, p) => sum + (p.status !== PurchaseOrderStatus.CLOSED ? p.totalAmount : 0), 0).toLocaleString()}
               </p>
               <div className="p-3 bg-white/5 rounded text-brand border border-white/10"><ShieldCheck size={20} /></div>
            </div>
         </div>
      </div>

      <div className="bg-white border-y px-4 py-2 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search purchase orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | 'ALL')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="ALL">All</option>
              <option value={PurchaseOrderStatus.DRAFT}>Draft</option>
              <option value={PurchaseOrderStatus.PENDING_APPROVAL}>Pending Approval</option>
              <option value={PurchaseOrderStatus.APPROVED}>Approved</option>
              <option value={PurchaseOrderStatus.REJECTED}>Rejected</option>
              <option value={PurchaseOrderStatus.BILLED}>Fully Billed</option>
              <option value={PurchaseOrderStatus.CLOSED}>Closed</option>
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
              <option value="ALL">All</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
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
                  <div className="p-1">
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                    >
                      Remove Quick Filter
                    </button>
                  </div>

                  <div className="border-t border-gray-100 p-1">
                    <button
                      onClick={() => setDateFilterMode('CUSTOM')}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                    </button>
                  </div>

                  <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-4 py-1 bg-brand hover:bg-brand-hover rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
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
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setVendorFilter('ALL');
              setDateFilterMode('ALL');
              setDateFrom('');
              setDateTo('');
              setShowDateDropdown(false);
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <p className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredPOs.length}</span> of {purchaseOrders.length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">PO Reference</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">GL Entry #</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Supplier / Vendor</th>
                <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Value (PHP)</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
                <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Navigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPOs.length > 0 ? filteredPOs.map(po => {
                const vendor = vendors.find(v => v.id === po.vendorId);
                return (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {formatRegistryDate(po.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-light group-hover:text-brand transition-all border border-gray-200 shadow-sm">
                            <FileStack size={18} />
                         </div>
                         <div className="text-sm font-semibold text-gray-900 font-mono tracking-tight">{po.reference}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono font-bold text-emerald-600">
                        {(po.glEntryNumber || '').trim() || <span className="text-gray-300 italic font-normal">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                         <div className="text-sm font-semibold text-gray-800 leading-none">{vendor?.name || 'Unknown Vendor'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-brand text-sm">
                       {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 border rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusStyle(po.status)}`}>
                        {getStatusLabel(po.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                       <button 
                        onClick={() => setViewPO(po)}
                        className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-brand rounded transition-all shadow-sm hover:shadow-md"
                       >
                          <ChevronRight size={18} />
                       </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <FileStack size={40} className="mx-auto mb-2 text-gray-300" />
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'No purchase commitments identified in the current index.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white rounded border border-gray-100 shadow-sm text-brand"><Database size={24} /></div>
               <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-2">Obligation State</p>
                  <p className="text-xs font-bold text-gray-600">Total of {purchaseOrders.length} purchase orders recorded in the current lifecycle.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-brand" /> PROCUREMENT_VERIFIED</p>
               <p className="text-xs font-semibold text-gray-300 italic mt-2 uppercase tracking-tighter">Verified Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
      </div>

      {/* Initialize PO Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand/10 rounded-lg text-brand border border-brand-light">
                  <FileStack size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Initialize Purchase Order</h3>
                  <p className="text-xs text-gray-500 italic">Create a new procurement commitment</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.vendorId || ''}
                    onChange={e => setFormData({ ...formData, vendorId: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    PO Reference <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.reference || ''}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="e.g., PO-2026-0001"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Memo
                  </label>
                  <input
                    type="text"
                    value={formData.memo || ''}
                    onChange={e => setFormData({ ...formData, memo: e.target.value })}
                    placeholder="Optional notes..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                    <Box size={14} className="text-brand" />
                    Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      lines: [...(formData.lines || []), { id: `${Date.now()}`, itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
                    })}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-light rounded transition-all"
                  >
                    <Plus size={14} /> Add Line
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.lines || []).map((line, idx) => (
                    <div key={line.id || idx} className="flex gap-3 items-start bg-white p-3 rounded border border-gray-100">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Description"
                          value={line.description || ''}
                          onChange={e => {
                            const newLines = [...(formData.lines || [])];
                            newLines[idx] = { ...newLines[idx], description: e.target.value };
                            setFormData({ ...formData, lines: newLines });
                          }}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-brand outline-none"
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={line.qty || ''}
                          onChange={e => {
                            const newLines = [...(formData.lines || [])];
                            newLines[idx] = { ...newLines[idx], qty: parseInt(e.target.value) || 0 };
                            setFormData({ ...formData, lines: newLines });
                          }}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-brand outline-none text-center"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Unit Price"
                          step="0.01"
                          min="0"
                          value={line.unitPrice || ''}
                          onChange={e => {
                            const newLines = [...(formData.lines || [])];
                            newLines[idx] = { ...newLines[idx], unitPrice: parseFloat(e.target.value) || 0 };
                            setFormData({ ...formData, lines: newLines });
                          }}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-brand outline-none text-right"
                        />
                      </div>
                      <div className="w-28 text-right py-2 text-sm font-bold text-gray-700">
                        {calculateLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      {(formData.lines || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newLines = (formData.lines || []).filter((_, i) => i !== idx);
                            setFormData({ ...formData, lines: newLines });
                          }}
                          className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                  <div className="text-right">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Amount</p>
                    <p className="text-xl font-bold text-gray-800">PHP {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand text-white rounded-lg font-semibold text-sm uppercase tracking-wide shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Save size={16} />
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default PurchaseOrdersView;

