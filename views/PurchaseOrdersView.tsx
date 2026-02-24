import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Vendor, NonStockItem, TaxCategory } from '../types';
import { 
  FileStack, Plus, Search, Filter, X, Save, Trash2, 
  ChevronRight, ArrowUpRight, CheckCircle, Clock, AlertCircle,
  Building2, Box, CreditCard, ShoppingCart, Printer, Send,
  ShieldCheck, ShieldAlert, CheckCircle2, Ban, Database, Layers, Check, Zap, Target
} from 'lucide-react';

interface PurchaseOrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  items: NonStockItem[];
  onCreatePO: (po: PurchaseOrder) => void;
  onUpdateStatus: (id: string, status: PurchaseOrderStatus) => void;
  onConvertToBill: (po: PurchaseOrder) => void;
}

const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ 
  purchaseOrders, vendors, items, onCreatePO, onUpdateStatus, onConvertToBill 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    vendorId: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    memo: '',
    lines: [{ id: '1', itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
  });

  const filteredPOs = purchaseOrders.filter(po => {
    const vendor = vendors.find(v => v.id === po.vendorId);
    const searchLower = searchTerm.toLowerCase();
    return po.reference.toLowerCase().includes(searchLower) ||
      (po.glEntryNumber && po.glEntryNumber.toLowerCase().includes(searchLower)) ||
      (vendor?.name && vendor.name.toLowerCase().includes(searchLower));
  });

  const getStatusStyle = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.DRAFT: return 'bg-gray-100 text-gray-600 border-gray-200';
      case PurchaseOrderStatus.PENDING_APPROVAL: return 'bg-amber-50 text-amber-700 border-amber-200';
      case PurchaseOrderStatus.APPROVED: return 'bg-orange-50 text-orange-700 border-orange-200';
      case PurchaseOrderStatus.REJECTED: return 'bg-rose-50 text-rose-700 border-rose-200';
      case PurchaseOrderStatus.BILLED: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case PurchaseOrderStatus.CLOSED: return 'bg-gray-700 text-white border-gray-800';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
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
          className="flex items-center gap-2 px-8 py-3 bg-[#F47721] text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-gray-300/10 hover:bg-[#E06610] hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Initialize PO
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Active Commitments</p>
            <div className="flex items-end justify-between">
               <p className="text-xl font-semibold text-gray-800 tracking-tight">{purchaseOrders.filter(p => p.status === PurchaseOrderStatus.APPROVED).length}</p>
               <div className="p-3 bg-orange-50 rounded text-[#F47721]"><CheckCircle size={20} /></div>
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
               <div className="p-3 bg-white/5 rounded text-orange-400 border border-white/10"><ShieldCheck size={20} /></div>
            </div>
         </div>
      </div>

      <div className="p-6 bg-white rounded border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search obligations by reference, vendor, or project code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded text-sm font-bold text-gray-800 focus:bg-white focus:border-orange-400/10 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3 bg-gray-100 p-2 rounded">
           <button className="p-2.5 text-gray-500 hover:text-[#F47721] bg-white rounded shadow-sm border border-gray-200"><Filter size={18} /></button>
           <div className="w-[1px] h-6 bg-gray-200" />
           <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{filteredPOs.length} Records</p>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">PO Reference</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">GL Entry #</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Supplier / Vendor</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Issuance Date</th>
                <th className="px-6 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Value (PHP)</th>
                <th className="px-6 py-6 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Internal Status</th>
                <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Navigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs font-bold">
              {filteredPOs.length > 0 ? filteredPOs.reverse().map(po => {
                const vendor = vendors.find(v => v.id === po.vendorId);
                return (
                  <tr key={po.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-[#F47721] transition-all border border-gray-200 shadow-sm">
                            <FileStack size={18} />
                         </div>
                         <div className="text-sm font-semibold text-gray-900 font-mono tracking-tight">{po.reference}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="text-xs font-mono font-bold text-emerald-600">
                        {(po.glEntryNumber || '').trim() || <span className="text-gray-300 italic font-normal">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                         <div className="text-sm font-semibold text-gray-800 leading-none">{vendor?.name || 'Unknown Vendor'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-gray-500">{po.date}</td>
                    <td className="px-6 py-6 text-right font-mono font-semibold text-gray-900 text-sm">
                       {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`px-3 py-1 border rounded-full text-xs font-semibold uppercase tracking-wide ${
                        po.status === 'APPROVED' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        po.status === 'PENDING_APPROVAL' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-6 text-right">
                       <button 
                        onClick={() => setViewPO(po)}
                        className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-[#F47721] rounded transition-all shadow-sm hover:shadow-md"
                       >
                          <ChevronRight size={18} />
                       </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400 italic font-medium">No purchase commitments identified in the current index.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white rounded border border-gray-100 shadow-sm text-[#F47721]"><Database size={24} /></div>
               <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-2">Obligation State</p>
                  <p className="text-xs font-bold text-gray-600">Total of {purchaseOrders.length} purchase orders recorded in the current lifecycle.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-[#F47721]" /> PROCUREMENT_VERIFIED</p>
               <p className="text-xs font-semibold text-gray-300 italic mt-2 uppercase tracking-tighter">Verified Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
      </div>

      {/* Initialize PO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F47721]/10 rounded-lg text-[#F47721]">
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-[#F47721] focus:ring-2 focus:ring-[#F47721]/20 outline-none transition-all"
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-[#F47721] focus:ring-2 focus:ring-[#F47721]/20 outline-none transition-all"
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-[#F47721] focus:ring-2 focus:ring-[#F47721]/20 outline-none transition-all"
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-[#F47721] focus:ring-2 focus:ring-[#F47721]/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                    <Box size={14} className="text-[#F47721]" />
                    Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      lines: [...(formData.lines || []), { id: `${Date.now()}`, itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
                    })}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#F47721] hover:bg-orange-50 rounded transition-all"
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
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-[#F47721] outline-none"
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
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-[#F47721] outline-none text-center"
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
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium focus:border-[#F47721] outline-none text-right"
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
                  className="px-8 py-3 bg-[#F47721] text-white rounded-lg font-semibold text-sm uppercase tracking-wide shadow-sm hover:bg-[#E06610] hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Save size={16} />
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersView;
