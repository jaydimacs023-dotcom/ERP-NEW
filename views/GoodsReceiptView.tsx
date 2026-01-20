import React, { useState, useMemo } from 'react';
import { 
  GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus, PurchaseOrder, 
  Vendor, ChartOfAccount, JournalEntry, JournalEntryLine
} from '../types';
import EmptyState from '../components/EmptyState';
import {
  Package, Plus, Search, Filter, ChevronDown, X, CheckCircle, 
  Clock, XCircle, Eye, Edit, Trash2, AlertCircle, FileText,
  Truck, Calendar, Building, ArrowRight, Link, Unlink
} from 'lucide-react';

interface GoodsReceiptViewProps {
  orgId: string;
  goodsReceipts: GoodsReceipt[];
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  currentUserId?: string;
  onCreateGoodsReceipt: (gr: GoodsReceipt) => void;
  onUpdateGoodsReceipt: (id: string, updates: Partial<GoodsReceipt>) => void;
  onDeleteGoodsReceipt?: (id: string) => void;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_CONFIG: Record<GoodsReceiptStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: <FileText size={14} /> },
  POSTED: { label: 'Posted', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: <CheckCircle size={14} /> },
  CANCELLED: { label: 'Cancelled', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: <XCircle size={14} /> },
};

const GoodsReceiptView: React.FC<GoodsReceiptViewProps> = ({
  orgId,
  goodsReceipts,
  purchaseOrders,
  vendors,
  accounts,
  currentUserId,
  onCreateGoodsReceipt,
  onUpdateGoodsReceipt,
  onDeleteGoodsReceipt,
  onPostJournal,
  onNotify
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    purchaseOrderId: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    deliveryNote: '',
    warehouseLocation: '',
    lines: [] as Partial<GoodsReceiptLine>[],
  });

  // Filter data
  const orgGRs = useMemo(() => 
    goodsReceipts.filter(gr => gr.orgId === orgId && !gr.isDeleted),
    [goodsReceipts, orgId]
  );

  const orgPOs = useMemo(() => 
    purchaseOrders.filter(po => po.orgId === orgId && !po.isDeleted && po.status === 'APPROVED'),
    [purchaseOrders, orgId]
  );

  const orgVendors = useMemo(() => 
    vendors.filter(v => v.orgId === orgId && !v.isDeleted),
    [vendors, orgId]
  );

  // Filter GRs
  const filteredGRs = useMemo(() => {
    return orgGRs.filter(gr => {
      const matchesSearch = gr.grNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gr.deliveryNote?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || gr.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orgGRs, searchTerm, statusFilter]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const drafts = orgGRs.filter(gr => gr.status === 'DRAFT');
    const posted = orgGRs.filter(gr => gr.status === 'POSTED');
    
    return {
      draftCount: drafts.length,
      draftValue: drafts.reduce((sum, gr) => sum + gr.totalValue, 0),
      postedCount: posted.length,
      postedValue: posted.reduce((sum, gr) => sum + gr.totalValue, 0),
      totalLineItems: orgGRs.reduce((sum, gr) => sum + gr.lines.length, 0),
    };
  }, [orgGRs]);

  // Get next GR number
  const getNextGRNumber = () => {
    const maxNum = orgGRs.reduce((max, gr) => {
      const num = parseInt(gr.grNumber.replace(/\D/g, '')) || 0;
      return num > max ? num : max;
    }, 0);
    return `GR-${new Date().getFullYear()}-${String(maxNum + 1).padStart(5, '0')}`;
  };

  // Load PO lines when PO is selected
  const handlePOSelect = (poId: string) => {
    const po = orgPOs.find(p => p.id === poId);
    if (!po) {
      setFormData(prev => ({ ...prev, purchaseOrderId: '', lines: [] }));
      return;
    }

    // Map PO lines to GR lines
    const grLines: Partial<GoodsReceiptLine>[] = (po.lines || []).map((line, idx) => ({
      id: `grl-${Date.now()}-${idx}`,
      goodsReceiptId: '',
      purchaseOrderLineId: line.id,
      itemCode: line.itemCode || '',
      itemDescription: line.description,
      orderedQuantity: line.quantity,
      receivedQuantity: line.quantity, // Default to full receipt
      unitPrice: line.unitPrice,
      totalValue: line.quantity * line.unitPrice,
      uom: line.uom || 'UNIT',
    }));

    setFormData(prev => ({
      ...prev,
      purchaseOrderId: poId,
      lines: grLines,
    }));
  };

  // Update line quantity
  const handleLineQuantityChange = (index: number, quantity: number) => {
    setFormData(prev => {
      const newLines = [...prev.lines];
      const line = newLines[index];
      if (line) {
        line.receivedQuantity = quantity;
        line.totalValue = quantity * (line.unitPrice || 0);
      }
      return { ...prev, lines: newLines };
    });
  };

  // Handlers
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.purchaseOrderId) {
      onNotify('error', 'Please select a Purchase Order.');
      return;
    }
    if (formData.lines.length === 0 || formData.lines.every(l => !l.receivedQuantity)) {
      onNotify('error', 'Please enter received quantities.');
      return;
    }

    const po = orgPOs.find(p => p.id === formData.purchaseOrderId);
    const vendor = po ? orgVendors.find(v => v.id === po.vendorId) : null;
    const grNumber = getNextGRNumber();

    const totalValue = formData.lines.reduce((sum, l) => sum + (l.totalValue || 0), 0);

    const newGR: GoodsReceipt = {
      id: `gr-${Date.now()}`,
      orgId,
      grNumber,
      purchaseOrderId: formData.purchaseOrderId,
      vendorId: po?.vendorId || '',
      receiptDate: formData.receiptDate,
      deliveryNote: formData.deliveryNote,
      warehouseLocation: formData.warehouseLocation,
      lines: formData.lines.filter(l => l.receivedQuantity && l.receivedQuantity > 0) as GoodsReceiptLine[],
      totalValue,
      status: 'DRAFT',
      receivedBy: currentUserId,
      createdAt: new Date().toISOString(),
    };

    onCreateGoodsReceipt(newGR);
    onNotify('success', `Goods Receipt ${grNumber} created.`);
    setShowCreateModal(false);
    resetForm();
  };

  const handlePost = (gr: GoodsReceipt) => {
    if (gr.status !== 'DRAFT') {
      onNotify('error', 'Only draft GRs can be posted.');
      return;
    }

    // Post GR/IR Clearing journal entry
    // DR Inventory (Asset)
    // CR GR/IR Clearing (Liability)
    if (onPostJournal) {
      const inventoryAccount = accounts.find(a => 
        a.name.toLowerCase().includes('inventory') && a.accountClass === 'ASSET'
      );
      const grirAccount = accounts.find(a => 
        a.name.toLowerCase().includes('gr/ir') || a.name.toLowerCase().includes('goods receipt')
      ) || accounts.find(a => a.accountClass === 'LIABILITY');

      if (inventoryAccount && grirAccount) {
        const lines: JournalEntryLine[] = [
          {
            id: `jl-${Date.now()}-1`,
            journalEntryId: '',
            accountId: inventoryAccount.id,
            description: `Inventory receipt - ${gr.grNumber}`,
            debit: gr.totalValue,
            credit: 0,
            goodsReceiptId: gr.id,
          },
          {
            id: `jl-${Date.now()}-2`,
            journalEntryId: '',
            accountId: grirAccount.id,
            description: `GR/IR Clearing - ${gr.grNumber}`,
            debit: 0,
            credit: gr.totalValue,
            goodsReceiptId: gr.id,
          },
        ];

        onPostJournal({
          orgId,
          date: gr.receiptDate,
          reference: gr.grNumber,
          description: `Goods Receipt ${gr.grNumber}`,
          sourceType: 'GOODS_RECEIPT',
          status: 'POSTED',
        }, lines);
      }
    }

    onUpdateGoodsReceipt(gr.id, {
      status: 'POSTED',
      postedBy: currentUserId,
      postedAt: new Date().toISOString(),
    });

    onNotify('success', `Goods Receipt ${gr.grNumber} posted. GR/IR Clearing entry created.`);
  };

  const handleCancel = (gr: GoodsReceipt) => {
    if (gr.status === 'POSTED') {
      onNotify('error', 'Cannot cancel a posted GR. Create a reversal instead.');
      return;
    }

    onUpdateGoodsReceipt(gr.id, { status: 'CANCELLED' });
    onNotify('info', `Goods Receipt ${gr.grNumber} cancelled.`);
  };

  const handleDelete = (grId: string) => {
    const gr = orgGRs.find(g => g.id === grId);
    if (!gr) return;

    if (gr.status === 'POSTED') {
      onNotify('error', 'Cannot delete a posted GR.');
      return;
    }

    if (onDeleteGoodsReceipt) {
      onDeleteGoodsReceipt(grId);
      onNotify('success', `Goods Receipt deleted.`);
    }
    setConfirmDelete(null);
  };

  const resetForm = () => {
    setFormData({
      purchaseOrderId: '',
      receiptDate: new Date().toISOString().slice(0, 10),
      deliveryNote: '',
      warehouseLocation: '',
      lines: [],
    });
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const getVendorName = (vendorId: string) => orgVendors.find(v => v.id === vendorId)?.name || 'Unknown';
  const getPONumber = (poId: string) => orgPOs.find(p => p.id === poId)?.poNumber || purchaseOrders.find(p => p.id === poId)?.poNumber || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Package className="text-teal-600" size={28} />
            Goods Receipt (GR/IR)
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Receive goods against Purchase Orders with GR/IR clearing integration.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-medium text-sm"
        >
          <Plus size={18} /> New Goods Receipt
        </button>
      </div>

      {/* GR/IR Explanation Card */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-teal-100 rounded-xl">
            <Link className="text-teal-600" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-teal-800 mb-1">GR/IR Clearing Account</h3>
            <p className="text-sm text-teal-700 leading-relaxed">
              When goods are received, the system debits <strong>Inventory</strong> and credits <strong>GR/IR Clearing</strong>. 
              When the vendor invoice is posted, it debits <strong>GR/IR Clearing</strong> and credits <strong>Accounts Payable</strong>. 
              This ensures proper matching between receipts and invoices.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-teal-600">
              <span className="flex items-center gap-1"><Package size={14} /> Goods Receipt</span>
              <ArrowRight size={14} />
              <span className="flex items-center gap-1"><FileText size={14} /> Invoice Match</span>
              <ArrowRight size={14} />
              <span className="flex items-center gap-1"><CheckCircle size={14} /> Clearing Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Draft GRs</p>
          <p className="text-2xl font-black mt-1 text-slate-600">{summaryMetrics.draftCount}</p>
          <p className="text-xs text-slate-500">₱{formatCurrency(summaryMetrics.draftValue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Posted GRs</p>
          <p className="text-2xl font-black mt-1 text-emerald-600">{summaryMetrics.postedCount}</p>
          <p className="text-xs text-emerald-500">₱{formatCurrency(summaryMetrics.postedValue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Total Line Items</p>
          <p className="text-2xl font-black mt-1 text-teal-600">{summaryMetrics.totalLineItems}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Open POs</p>
          <p className="text-2xl font-black mt-1 text-amber-600">{orgPOs.length}</p>
          <p className="text-xs text-amber-500">Available for receipt</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search goods receipts..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-teal-500 outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as GoodsReceiptStatus | 'all')}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm appearance-none"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* GRs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">GR #</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">PO / Vendor</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Receipt Date</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredGRs.length > 0 ? (
              filteredGRs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(gr => {
                  const statusConfig = STATUS_CONFIG[gr.status];
                  
                  return (
                    <tr key={gr.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-teal-600">{gr.grNumber}</span>
                        {gr.deliveryNote && (
                          <p className="text-xs text-slate-400 mt-0.5">DN: {gr.deliveryNote}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{getPONumber(gr.purchaseOrderId)}</p>
                        <p className="text-xs text-slate-400">{getVendorName(gr.vendorId)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">{gr.receiptDate}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono font-semibold text-slate-600">{gr.lines.length}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-semibold text-slate-700">₱{formatCurrency(gr.totalValue)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setSelectedGR(gr); setShowDetailModal(true); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {gr.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handlePost(gr)}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
                                title="Post"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleCancel(gr)}
                                className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors"
                                title="Cancel"
                              >
                                <XCircle size={16} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(gr.id)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
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
                    icon={<Package className="text-slate-300" size={48} />}
                    title="No goods receipts found"
                    description="Create a goods receipt from an approved Purchase Order."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md">
                  <Package size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">New Goods Receipt</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Purchase Order *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.purchaseOrderId}
                    onChange={e => handlePOSelect(e.target.value)}
                  >
                    <option value="">Select Purchase Order...</option>
                    {orgPOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} - {getVendorName(po.vendorId)} (₱{formatCurrency(po.totalAmount || 0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Receipt Date *</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.receiptDate}
                    onChange={e => setFormData({...formData, receiptDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Delivery Note #</label>
                  <input 
                    type="text"
                    placeholder="Vendor's delivery note number..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.deliveryNote}
                    onChange={e => setFormData({...formData, deliveryNote: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Warehouse Location</label>
                  <input 
                    type="text"
                    placeholder="Where goods are stored..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.warehouseLocation}
                    onChange={e => setFormData({...formData, warehouseLocation: e.target.value})}
                  />
                </div>
              </div>

              {/* Line Items */}
              {formData.lines.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    Receipt Lines ({formData.lines.length} items)
                  </label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Item</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Ordered</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Received *</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-700">{line.itemDescription}</p>
                              {line.itemCode && (
                                <p className="text-xs text-slate-400">{line.itemCode}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-sm text-slate-600">{line.orderedQuantity}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={line.orderedQuantity}
                                className="w-20 px-2 py-1 text-center font-mono text-sm bg-white border border-slate-200 rounded-lg"
                                value={line.receivedQuantity || 0}
                                onChange={e => handleLineQuantityChange(idx, parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm text-slate-600">₱{formatCurrency(line.unitPrice || 0)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono font-semibold text-sm text-slate-700">₱{formatCurrency(line.totalValue || 0)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-600">Total:</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                            ₱{formatCurrency(formData.lines.reduce((sum, l) => sum + (l.totalValue || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {!formData.purchaseOrderId && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-amber-700">Select a Purchase Order to load items for receipt.</p>
                </div>
              )}
            </form>

            <div className="p-6 border-t bg-slate-50/50 flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate as any}
                disabled={!formData.purchaseOrderId || formData.lines.length === 0}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Goods Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-md">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{selectedGR.grNumber}</h3>
                  <p className="text-xs text-slate-500">PO: {getPONumber(selectedGR.purchaseOrderId)} • {getVendorName(selectedGR.vendorId)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* GR Info */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Receipt Date</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{selectedGR.receiptDate}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Delivery Note</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{selectedGR.deliveryNote || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Warehouse</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{selectedGR.warehouseLocation || '-'}</p>
                </div>
              </div>

              {/* Lines */}
              <h4 className="text-sm font-bold text-slate-700 mb-3">Received Items</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Item</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGR.lines.map(line => (
                      <tr key={line.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-700">{line.itemDescription}</p>
                          {line.itemCode && <p className="text-xs text-slate-400">{line.itemCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-sm">{line.receivedQuantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm">₱{formatCurrency(line.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">₱{formatCurrency(line.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-600">Total:</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        ₱{formatCurrency(selectedGR.totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Audit Info */}
              {selectedGR.status === 'POSTED' && (
                <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Posted</p>
                  <p className="text-sm text-emerald-600">
                    {selectedGR.postedAt && new Date(selectedGR.postedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              {selectedGR.status === 'DRAFT' && (
                <button 
                  onClick={() => { handlePost(selectedGR); setShowDetailModal(false); }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Post GR
                </button>
              )}
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
                <h3 className="text-lg font-bold text-slate-800">Delete Goods Receipt?</h3>
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

export default GoodsReceiptView;
