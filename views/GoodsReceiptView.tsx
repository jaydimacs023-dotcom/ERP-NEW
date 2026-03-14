import React, { useState, useMemo } from 'react';
import {
  GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus, PurchaseOrder,
  Vendor, ChartOfAccount, JournalEntry, JournalLine
} from '../types';
import EmptyState from '../components/EmptyState';
import ModalPortal from '../components/ModalPortal';
import {
  Package, Plus, Search, Filter, ChevronDown, X, CheckCircle,
  Clock, XCircle, Eye, Edit, Trash2, AlertCircle, FileText,
  Truck, Calendar, Building, ArrowRight, Link, Unlink, Layers, ShoppingCart
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
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_CONFIG: Record<GoodsReceiptStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <FileText size={14} /> },
  POSTED: { label: 'Posted', color: 'text-[#F47721]', bgColor: 'bg-emerald-50', icon: <CheckCircle size={14} /> },
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
        const lines: JournalLine[] = [
          {
            id: `jl-${Date.now()}-1`,
            journalEntryId: '',
            orgId,
            accountId: inventoryAccount.id,
            description: `Inventory receipt - ${gr.grNumber}`,
            debit: gr.totalValue,
            credit: 0,
            goodsReceiptId: gr.id,
          },
          {
            id: `jl-${Date.now()}-2`,
            journalEntryId: '',
            orgId,
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Goods Receipt (GR/IR)</h2>
          <p className="text-sm text-gray-500 font-normal italic">Receive goods against Purchase Orders with GR/IR clearing integration.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-[#F47721] text-white rounded font-semibold text-xs uppercase tracking-wide shadow-lg shadow-gray-300/30 hover:bg-[#E06610] hover:-translate-y-0.5 transition-all"
        >
          <Plus size={18} /> New Goods Receipt
        </button>
      </header>

      {/* GR/IR Explanation Card */}
      <div className="bg-gradient-to-r from-orange-50 to-cyan-50 border border-orange-200 rounded-md p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-100 rounded">
            <Link className="text-[#F47721]" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-800 mb-1 uppercase tracking-tight">GR/IR Clearing Account</h3>
            <p className="text-sm text-orange-700 leading-relaxed font-medium">
              When goods are received, the system debits <strong className="font-semibold">Inventory</strong> and credits <strong className="font-semibold">GR/IR Clearing</strong>.
              When the vendor invoice is posted, it debits <strong className="font-semibold">GR/IR Clearing</strong> and credits <strong className="font-semibold">Accounts Payable</strong>.
              This ensures proper matching between receipts and invoices.
            </p>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-orange-200/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100/50 flex items-center justify-center">
                  <Package size={14} className="text-orange-700" />
                </div>
                <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Goods Receipt</span>
              </div>
              <ArrowRight size={14} className="text-orange-400" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100/50 flex items-center justify-center">
                  <FileText size={14} className="text-orange-700" />
                </div>
                <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Invoice Match</span>
              </div>
              <ArrowRight size={14} className="text-orange-400" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#F47721] text-white flex items-center justify-center shadow-lg shadow-gray-300/20">
                  <CheckCircle size={14} />
                </div>
                <span className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Clearing Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-orange-200 transition-all">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Clock size={12} className="text-gray-400" /> Draft Index
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-semibold text-gray-900 tracking-tighter">
                {summaryMetrics.draftCount}
              </p>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">PENDING_POST</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-600 font-mono">
                {"\u20B1"}{formatCurrency(summaryMetrics.draftValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-md shadow-sm shadow-gray-300/20 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#F47721]/10 rounded-full -mr-8 -mt-8 blur-2xl" />
          <p className="text-xs font-semibold text-orange-400/80 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <CheckCircle size={12} className="text-orange-400" /> Posted Ledger
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-semibold text-white tracking-tighter">
                {summaryMetrics.postedCount}
              </p>
              <p className="text-xs font-bold text-orange-500 uppercase mt-1">CLEARED_RECORDS</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-orange-400 font-mono">
                {"\u20B1"}{formatCurrency(summaryMetrics.postedValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex flex-col justify-between group hover:border-orange-200 transition-all">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Layers size={12} className="text-[#F47721]" /> Total Lines
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-semibold text-gray-900 tracking-tighter">
                {summaryMetrics.totalLineItems}
              </p>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">RECEIPT_ENTRIES</p>
            </div>
          </div>
        </div>

        <div className="bg-[#F47721] p-6 rounded-md shadow-sm shadow-gray-300/30 flex flex-col justify-between group">
          <p className="text-xs font-semibold text-orange-100 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <ShoppingCart size={12} className="text-orange-100" /> Open POs
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-semibold text-white tracking-tighter">
                {orgPOs.length}
              </p>
              <p className="text-xs font-bold text-orange-200 uppercase mt-1">ELIGIBLE_FOR_GR</p>
            </div>
          </div>
        </div>
      </div>

      {/* Registry Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-md border border-gray-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search goods receipts..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative font-bold">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as GoodsReceiptStatus | 'all')}
              className="pl-10 pr-10 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-xs font-semibold uppercase tracking-wide text-gray-600 appearance-none min-w-[160px]"
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      {/* GRs Table */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">GR Number</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">PO / Vendor</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Receipt Date</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Lines</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Value</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredGRs.length > 0 ? (
              filteredGRs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(gr => {
                  const statusConfig = STATUS_CONFIG[gr.status];

                  return (
                    <tr key={gr.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-[#F47721]">{gr.grNumber}</span>
                        {gr.deliveryNote && (
                          <p className="text-xs text-gray-400 mt-0.5">DN: {gr.deliveryNote}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-700">{getPONumber(gr.purchaseOrderId)}</p>
                        <p className="text-xs text-gray-400">{getVendorName(gr.vendorId)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{gr.receiptDate}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono font-semibold text-gray-600">{gr.lines.length}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-semibold text-gray-700">{"\u20B1"}{formatCurrency(gr.totalValue)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setSelectedGR(gr); setShowDetailModal(true); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {gr.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handlePost(gr)}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg text-[#F47721] transition-colors"
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
                    icon={<Package className="text-gray-300" size={48} />}
                    title="No goods receipts found"
                    description="Create a goods receipt from an approved Purchase Order."
                  />
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-4 border-gray-800">
            <tr className="bg-gray-50">
              <td colSpan={4} className="px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#F47721] animate-pulse" />
                  <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Institutional Receipt Intelligence Active</p>
                </div>
              </td>
              <td className="px-6 py-6 text-right">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Aggregated Valuation</p>
                  <p className="text-xl font-semibold text-gray-900 font-mono">
                    {"\u20B1"}{formatCurrency(filteredGRs.reduce((sum, gr) => sum + gr.totalValue, 0))}
                  </p>
                </div>
              </td>
              <td colSpan={2} className="px-8 py-6 text-right">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Records</p>
                  <p className="text-sm font-semibold text-gray-900 uppercase">{filteredGRs.length} TRANSACTIONS</p>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F47721] text-white rounded shadow-md">
                  <Package size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">New Goods Receipt</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Order *</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium"
                    value={formData.purchaseOrderId}
                    onChange={e => handlePOSelect(e.target.value)}
                  >
                    <option value="">Select Purchase Order...</option>
                    {orgPOs.map(po => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} - {getVendorName(po.vendorId)} ({"\u20B1"}{formatCurrency(po.totalAmount || 0)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.receiptDate}
                    onChange={e => setFormData({ ...formData, receiptDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery Note #</label>
                  <input
                    type="text"
                    placeholder="Vendor's delivery note number..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.deliveryNote}
                    onChange={e => setFormData({ ...formData, deliveryNote: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Warehouse Location</label>
                  <input
                    type="text"
                    placeholder="Where goods are stored..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.warehouseLocation}
                    onChange={e => setFormData({ ...formData, warehouseLocation: e.target.value })}
                  />
                </div>
              </div>

              {/* Line Items */}
              {formData.lines.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Receipt Lines ({formData.lines.length} items)
                  </label>
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Item</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Ordered</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Received *</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-700">{line.itemDescription}</p>
                              {line.itemCode && (
                                <p className="text-xs text-gray-400">{line.itemCode}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-sm text-gray-600">{line.orderedQuantity}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={line.orderedQuantity}
                                className="w-20 px-2 py-1 text-center font-mono text-sm bg-white border border-gray-200 rounded-lg"
                                value={line.receivedQuantity || 0}
                                onChange={e => handleLineQuantityChange(idx, parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm text-gray-600">{"\u20B1"}{formatCurrency(line.unitPrice || 0)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono font-semibold text-sm text-gray-700">{"\u20B1"}{formatCurrency(line.totalValue || 0)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-600">Total:</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                            {"\u20B1"}{formatCurrency(formData.lines.reduce((sum, l) => sum + (l.totalValue || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {!formData.purchaseOrderId && (
                <div className="bg-amber-50 border border-amber-200 rounded p-4 text-center">
                  <p className="text-sm text-amber-700">Select a Purchase Order to load items for receipt.</p>
                </div>
              )}
            </form>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate as any}
                disabled={!formData.purchaseOrderId || formData.lines.length === 0}
                className="flex-1 py-3 bg-[#F47721] text-white rounded text-sm font-bold shadow-lg shadow-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Goods Receipt
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGR && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#F47721] text-white rounded shadow-md">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{selectedGR.grNumber}</h3>
                  <p className="text-xs text-gray-500">PO: {getPONumber(selectedGR.purchaseOrderId)} • {getVendorName(selectedGR.vendorId)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* GR Info */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase">Receipt Date</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{selectedGR.receiptDate}</p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase">Delivery Note</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{selectedGR.deliveryNote || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase">Warehouse</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{selectedGR.warehouseLocation || '-'}</p>
                </div>
              </div>

              {/* Lines */}
              <h4 className="text-sm font-bold text-gray-700 mb-3">Received Items</h4>
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Item</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedGR.lines.map(line => (
                      <tr key={line.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-700">{line.itemDescription}</p>
                          {line.itemCode && <p className="text-xs text-gray-400">{line.itemCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-sm">{line.receivedQuantity}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm">{"\u20B1"}{formatCurrency(line.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">{"\u20B1"}{formatCurrency(line.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-600">Total:</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                        {"\u20B1"}{formatCurrency(selectedGR.totalValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Audit Info */}
              {selectedGR.status === 'POSTED' && (
                <div className="mt-6 bg-emerald-50 border border-orange-200 rounded p-4">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Posted</p>
                  <p className="text-sm text-[#F47721]">
                    {selectedGR.postedAt && new Date(selectedGR.postedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Close
              </button>
              {selectedGR.status === 'DRAFT' && (
                <button
                  onClick={() => { handlePost(selectedGR); setShowDetailModal(false); }}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Post GR
                </button>
              )}
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
                <h3 className="text-lg font-bold text-gray-800">Delete Goods Receipt?</h3>
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
    </div>
  );
};

export default GoodsReceiptView;

