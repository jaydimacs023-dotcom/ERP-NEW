
import React, { useState, useMemo } from 'react';
import { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Vendor, NonStockItem, TaxCategory } from '../types';
import { 
  FileStack, Plus, Search, Filter, X, Save, Trash2, 
  ChevronRight, ArrowUpRight, CheckCircle, Clock, AlertCircle,
  Building2, Box, CreditCard, ShoppingCart, Printer, Send,
  ShieldCheck, ShieldAlert, CheckCircle2, Ban
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

  // PO Form State
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    vendorId: '',
    date: new Date().toISOString().split('T')[0],
    reference: `PO-${Date.now().toString().slice(-6)}`,
    memo: '',
    lines: [{ id: '1', itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
  });

  const filteredPOs = purchaseOrders.filter(po => 
    po.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.DRAFT: return 'bg-slate-100 text-slate-600 border-slate-200';
      // Corrected PEND_APPROVAL to PENDING_APPROVAL
      case PurchaseOrderStatus.PENDING_APPROVAL: return 'bg-amber-50 text-amber-700 border-amber-100';
      case PurchaseOrderStatus.APPROVED: return 'bg-teal-50 text-teal-700 border-teal-100';
      case PurchaseOrderStatus.REJECTED: return 'bg-rose-50 text-rose-700 border-rose-100';
      case PurchaseOrderStatus.BILLED: return 'bg-emerald-50 text-teal-700 border-emerald-100';
      case PurchaseOrderStatus.CLOSED: return 'bg-slate-200 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const calculateLineTotal = (line: Partial<PurchaseOrderLine>) => {
    return (line.qty || 0) * (line.unitPrice || 0);
  };

  const poTotal = useMemo(() => {
    return (formData.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0);
  }, [formData.lines]);

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...(formData.lines || []), { id: Date.now().toString(), itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
    });
  };

  const removeLine = (id: string) => {
    if ((formData.lines || []).length <= 1) return;
    setFormData({ ...formData, lines: (formData.lines || []).filter(l => l.id !== id) });
  };

  const updateLine = (id: string, updates: Partial<PurchaseOrderLine>) => {
    const nextLines = (formData.lines || []).map(l => {
      if (l.id !== id) return l;
      const newLine = { ...l, ...updates };
      if (updates.itemId) {
        const item = items.find(i => i.id === updates.itemId);
        if (item) {
          newLine.description = item.name;
          newLine.unitPrice = item.unitPrice;
          newLine.taxAmount = item.taxCategoryId ? (item.unitPrice * 0.12) : 0; // VAT if tax category assigned
        }
      }
      return newLine;
    });
    setFormData({ ...formData, lines: nextLines });
  };

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
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vendorId: '',
      date: new Date().toISOString().split('T')[0],
      reference: `PO-${Date.now().toString().slice(-6)}`,
      memo: '',
      lines: [{ id: '1', itemId: '', description: '', qty: 1, unitPrice: 0, taxAmount: 0 }]
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            Procurement & POs
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Authorized purchase commitments for vendor fulfillment.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> New Purchase Order
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
           <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                placeholder="Search POs..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-teal-600"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 text-xs font-bold">
              <Filter size={14} /> Filter Status
           </button>
        </div>
        
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">PO Reference</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Issued</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPOs.length > 0 ? filteredPOs.reverse().map(po => {
              const vendor = vendors.find(v => v.id === po.vendorId);
              return (
                <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="text-sm font-black text-teal-600 font-mono">{po.reference}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-400 flex items-center justify-center font-bold text-[10px]">V</div>
                       <div className="text-sm font-bold text-slate-800">{vendor?.name || 'Unknown Vendor'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs text-slate-500 font-medium">{po.date}</td>
                  <td className="px-6 py-5 text-right font-mono font-bold text-slate-900">{po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black uppercase ${getStatusStyle(po.status)}`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                        onClick={() => setViewPO(po)}
                        className="p-2 hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-xl transition-all"
                       >
                          <ChevronRight size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="py-24 text-center text-slate-400 italic">No purchase orders found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PO Detail View Modal */}
      {viewPO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 flex flex-col h-[85vh]">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100"><FileStack size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Purchase Order Detail</h3>
                    <p className="text-xs font-mono font-bold text-teal-600">{viewPO.reference}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><Printer size={20} /></button>
                  <button onClick={() => setViewPO(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={24} /></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-white">
               <div className="grid grid-cols-2 gap-20 mb-12">
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Information</p>
                     <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <h4 className="text-lg font-black text-slate-800">{vendors.find(v => v.id === viewPO.vendorId)?.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{vendors.find(v => v.id === viewPO.vendorId)?.address}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Commitment Terms</p>
                     <div className="space-y-2 text-right">
                        <div className="flex justify-end gap-10">
                           <span className="text-xs text-slate-400 font-bold uppercase">Issued On</span>
                           <span className="text-xs text-slate-800 font-black">{viewPO.date}</span>
                        </div>
                        <div className="flex justify-end gap-10">
                           <span className="text-xs text-slate-400 font-bold uppercase">Approval Status</span>
                           <span className={`px-2 py-0.5 border rounded-lg text-[9px] font-black uppercase ${getStatusStyle(viewPO.status)}`}>{viewPO.status.replace('_', ' ')}</span>
                        </div>
                     </div>
                  </div>
               </div>

               <table className="min-w-full mb-10">
                  <thead>
                     <tr className="border-b-2 border-slate-900">
                        <th className="py-4 text-left text-[10px] font-black text-slate-900 uppercase">Item Description</th>
                        <th className="py-4 text-center text-[10px] font-black text-slate-900 uppercase">Qty</th>
                        <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase">Unit Price</th>
                        <th className="py-4 text-right text-[10px] font-black text-slate-900 uppercase">Total</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {viewPO.lines.map((line, i) => (
                        <tr key={i}>
                           <td className="py-5">
                              <div className="text-sm font-bold text-slate-800">{items.find(it => it.id === line.itemId)?.name || line.description}</div>
                              <div className="text-[10px] text-slate-400 font-mono">CODE: {items.find(it => it.id === line.itemId)?.code || 'N/A'}</div>
                           </td>
                           <td className="py-5 text-center text-sm font-bold text-slate-600">{line.qty}</td>
                           <td className="py-5 text-right text-sm font-mono font-medium text-slate-600">{line.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                           <td className="py-5 text-right text-sm font-mono font-black text-slate-900">{(line.qty * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>

               <div className="flex justify-end pt-6 border-t-4 border-double border-slate-200">
                  <div className="w-64 space-y-3">
                     <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        <span>Total Commit</span>
                        <span className="text-slate-900 text-lg font-black font-mono">PHP {viewPO.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-3">
                  <AlertCircle className="text-teal-500" size={20} />
                  <p className="text-[11px] text-slate-500 font-medium">Internal approval controls authorized spend levels.</p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  {viewPO.status === PurchaseOrderStatus.DRAFT && (
                    <button 
                      onClick={() => { onUpdateStatus(viewPO.id, PurchaseOrderStatus.PENDING_APPROVAL); setViewPO(null); }}
                      className="flex-1 px-8 py-3 bg-teal-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-teal-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <Send size={18} /> Submit for Approval
                    </button>
                  )}

                  {viewPO.status === PurchaseOrderStatus.PENDING_APPROVAL && (
                    <>
                      <button 
                        onClick={() => { onUpdateStatus(viewPO.id, PurchaseOrderStatus.APPROVED); setViewPO(null); }}
                        className="flex-1 px-8 py-3 bg-teal-600 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-teal-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                         <ShieldCheck size={18} /> Approve PO
                      </button>
                      <button 
                        onClick={() => { onUpdateStatus(viewPO.id, PurchaseOrderStatus.REJECTED); setViewPO(null); }}
                        className="flex-1 px-8 py-3 bg-white border border-rose-200 text-rose-600 rounded-2xl text-sm font-black hover:bg-rose-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                         <Ban size={18} /> Reject
                      </button>
                    </>
                  )}

                  {viewPO.status === PurchaseOrderStatus.APPROVED && (
                    <button 
                      onClick={() => onConvertToBill(viewPO)}
                      className="flex-1 px-8 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       <CreditCard size={18} /> Convert to Bill
                    </button>
                  )}

                  {viewPO.status === PurchaseOrderStatus.REJECTED && (
                    <button 
                      onClick={() => { onUpdateStatus(viewPO.id, PurchaseOrderStatus.DRAFT); setViewPO(null); }}
                      className="flex-1 px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                       <X size={18} /> Reset to Draft
                    </button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100"><ShoppingCart size={24} /></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Draft Purchase Order</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-10">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Vendor / Partner</label>
                    <select 
                       required 
                       className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none text-sm font-bold text-slate-800 appearance-none"
                       value={formData.vendorId}
                       onChange={e => setFormData({...formData, vendorId: e.target.value})}
                    >
                       <option value="">Choose Supplier...</option>
                       {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Order Date</label>
                    <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm"
                      value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Reference #</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-mono font-black text-sm text-teal-600"
                      value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-4 mb-10">
                  <div className="grid grid-cols-12 gap-4 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     <div className="col-span-5">Procurement Item / Description</div>
                     <div className="col-span-2 text-center">Quantity</div>
                     <div className="col-span-2 text-right">Unit Price</div>
                     <div className="col-span-2 text-right">Subtotal</div>
                     <div className="col-span-1"></div>
                  </div>

                  {(formData.lines || []).map((line) => (
                    <div key={line.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-white rounded-2xl border border-slate-100 hover:border-teal-200 transition-colors shadow-sm">
                       <div className="col-span-5">
                          <select 
                            required 
                            className="w-full px-3 py-2 bg-teal-50 border border-teal-100 rounded-xl text-xs font-bold text-teal-700 outline-none appearance-none"
                            value={line.itemId}
                            onChange={e => updateLine(line.id!, { itemId: e.target.value })}
                          >
                             <option value="">Select Catalog Item...</option>
                             {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                       </div>
                       <div className="col-span-2">
                          <input type="number" min="1" className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs font-black outline-none"
                            value={line.qty} onChange={e => updateLine(line.id!, { qty: Number(e.target.value) })} />
                       </div>
                       <div className="col-span-2">
                          <input type="number" step="0.01" className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-right text-xs font-mono font-bold outline-none"
                            value={line.unitPrice} onChange={e => updateLine(line.id!, { unitPrice: Number(e.target.value) })} />
                       </div>
                       <div className="col-span-2 text-right font-mono font-black text-sm text-slate-800">
                          {calculateLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                       </div>
                       <div className="col-span-1 flex justify-center">
                          <button type="button" onClick={() => removeLine(line.id!)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                       </div>
                    </div>
                  ))}

                  <button type="button" onClick={addLine} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-teal-600 hover:bg-teal-50 rounded-xl transition-colors border-2 border-dashed border-teal-100"><Plus size={14} /> Add Line Item</button>
               </div>

               <div className="p-10 bg-slate-900 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl">
                  <div className="flex-1 space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Order Notes / Terms</label>
                     <textarea rows={2} placeholder="Specify delivery conditions, lead times, or project tags..." className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-3xl outline-none text-slate-200 text-sm font-medium resize-none"
                        value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} />
                  </div>
                  <div className="w-full md:w-64 text-right">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Commit Value</p>
                     <p className="text-4xl font-mono font-black text-white tracking-tighter">PHP {poTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                     <div className="pt-8 flex gap-4">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">Discard</button>
                        <button type="submit" className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-500/20 active:scale-95 transition-all">Authorize PO</button>
                     </div>
                  </div>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersView;
