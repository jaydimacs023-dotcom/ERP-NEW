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

  const filteredPOs = purchaseOrders.filter(po => 
    po.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status: PurchaseOrderStatus) => {
    switch (status) {
      case PurchaseOrderStatus.DRAFT: return 'bg-slate-100 text-slate-600 border-slate-200';
      case PurchaseOrderStatus.PENDING_APPROVAL: return 'bg-amber-50 text-amber-700 border-amber-200';
      case PurchaseOrderStatus.APPROVED: return 'bg-teal-50 text-teal-700 border-teal-200';
      case PurchaseOrderStatus.REJECTED: return 'bg-rose-50 text-rose-700 border-rose-200';
      case PurchaseOrderStatus.BILLED: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case PurchaseOrderStatus.CLOSED: return 'bg-slate-800 text-white border-slate-900';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
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
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Procurement Intelligence</h2>
          <p className="text-sm text-slate-500 font-normal italic">Authorized purchase commitments and vendor fulfillment tracking.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-900/10 hover:bg-teal-700 hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Initialize PO
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Active Commitments</p>
            <div className="flex items-end justify-between">
               <p className="text-4xl font-black text-slate-800 tracking-tight">{purchaseOrders.filter(p => p.status === PurchaseOrderStatus.APPROVED).length}</p>
               <div className="p-3 bg-teal-50 rounded-xl text-teal-600"><CheckCircle size={20} /></div>
            </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Awaiting Approval</p>
            <div className="flex items-end justify-between">
               <p className="text-4xl font-black text-slate-800 tracking-tight">{purchaseOrders.filter(p => p.status === PurchaseOrderStatus.PENDING_APPROVAL).length}</p>
               <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock size={20} /></div>
            </div>
         </div>
         <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl col-span-2 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 text-slate-800 opacity-20 group-hover:scale-110 transition-transform">
               <ShoppingCart size={160} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Open Obligation</p>
            <div className="flex items-end justify-between relative z-10">
               <p className="text-4xl font-black text-white tracking-tight leading-none pt-1">
                  PHP {purchaseOrders.reduce((sum, p) => sum + (p.status !== PurchaseOrderStatus.CLOSED ? p.totalAmount : 0), 0).toLocaleString()}
               </p>
               <div className="p-3 bg-white/5 rounded-xl text-teal-400 border border-white/10"><ShieldCheck size={20} /></div>
            </div>
         </div>
      </div>

      <div className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search obligations by reference, vendor, or project code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-sm font-bold text-slate-800 focus:bg-white focus:border-teal-500/10 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl">
           <button className="p-2.5 text-slate-500 hover:text-teal-600 bg-white rounded-xl shadow-sm border border-slate-200"><Filter size={18} /></button>
           <div className="w-[1px] h-6 bg-slate-200" />
           <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{filteredPOs.length} Records</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">PO Reference</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier / Vendor</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issuance Date</th>
                <th className="px-6 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Value (PHP)</th>
                <th className="px-6 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Internal Status</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Navigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px] font-bold">
              {filteredPOs.length > 0 ? filteredPOs.reverse().map(po => {
                const vendor = vendors.find(v => v.id === po.vendorId);
                return (
                  <tr key={po.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all border border-slate-200 shadow-sm">
                            <FileStack size={18} />
                         </div>
                         <div className="text-sm font-black text-slate-900 font-mono tracking-tight">{po.reference}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                         <div className="text-sm font-black text-slate-800 leading-none">{vendor?.name || 'Unknown Vendor'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-slate-500">{po.date}</td>
                    <td className="px-6 py-6 text-right font-mono font-black text-slate-900 text-sm">
                       {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`px-3 py-1 border rounded-full text-[9px] font-black uppercase tracking-widest ${
                        po.status === 'APPROVED' ? 'bg-teal-50 border-teal-200 text-teal-700' :
                        po.status === 'PENDING_APPROVAL' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {po.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                       <button 
                        onClick={() => setViewPO(po)}
                        className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-teal-600 rounded-xl transition-all shadow-sm hover:shadow-md"
                       >
                          <ChevronRight size={18} />
                       </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="py-32 text-center text-slate-400 italic font-medium">No purchase commitments identified in the current index.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center no-print">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-teal-600"><Database size={24} /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Obligation State</p>
                  <p className="text-xs font-bold text-slate-600">Total of {purchaseOrders.length} purchase orders recorded in the current lifecycle.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-teal-600" /> PROCUREMENT_VERIFIED</p>
               <p className="text-[9px] font-black text-slate-300 italic mt-2 uppercase tracking-tighter">Verified Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrdersView;
