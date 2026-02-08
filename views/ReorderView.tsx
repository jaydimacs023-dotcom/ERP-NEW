import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Check, AlertTriangle, Zap, Truck, Target, Clock, ShieldCheck, FileText, Search, Package, ArrowRight, BarChart3 } from 'lucide-react';
import { ReorderPoint, StockItem, InventoryLevel } from '../types';

interface ReorderViewProps {
  reorderPoints: ReorderPoint[];
  items: StockItem[];
  levels: InventoryLevel[];
  onAdd: (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, point: Partial<ReorderPoint>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
}

interface FormData {
  stockItemId: string;
  minimumLevel: number;
  maximumLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  economicOrderQuantity: number;
  isActive: boolean;
}

const INITIAL_FORM: FormData = {
  stockItemId: '',
  minimumLevel: 0,
  maximumLevel: 0,
  reorderQuantity: 0,
  leadTimeDays: 0,
  economicOrderQuantity: 0,
  isActive: true,
};

export const ReorderView: React.FC<ReorderViewProps> = ({
  reorderPoints,
  items,
  levels,
  onAdd,
  onUpdate,
  onDelete,
  currency,
  isLoading = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const stockItems = useMemo(
    () => items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM'),
    [items]
  );

  const itemsNeedingReorder = useMemo(() => {
    return reorderPoints
      .filter((rp) => !rp.isDeleted)
      .map((rp) => {
        const item = stockItems.find((i) => i.id === rp.stockItemId);
        const itemLevels = levels.filter((l) => l.stockItemId === rp.stockItemId && !l.isDeleted);
        const currentQty = itemLevels.reduce((sum, l) => sum + (l.quantityOnHand || 0), 0);
        const needsReorder = currentQty <= rp.minimumLevel;

        return {
          reorderPoint: rp,
          item,
          currentQuantity: currentQty,
          needsReorder,
        };
      })
      .filter(entry => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return entry.item?.name.toLowerCase().includes(term) || entry.item?.code.toLowerCase().includes(term);
      });
  }, [reorderPoints, stockItems, levels, searchTerm]);

  const summaries = useMemo(() => ({
     total: itemsNeedingReorder.length,
     critical: itemsNeedingReorder.filter(i => i.needsReorder).length,
     pending: itemsNeedingReorder.filter(i => !i.needsReorder && i.currentQuantity < i.reorderPoint.minimumLevel * 1.2).length
  }), [itemsNeedingReorder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await onUpdate(editingId, formData);
        setSuccess('Reorder logic recalibrated successfully.');
      } else {
        await onAdd(formData);
        setSuccess('New procurement threshold deployed.');
      }
      setShowForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await onDelete(id);
      setSuccess('Procurement rule decommissioned.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Procurement Intelligence</h2>
          <p className="text-sm text-slate-500 font-normal italic">Automated equilibrium tracking and safety stock thresholding.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setEditingId(null);
              setFormData(INITIAL_FORM);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-teal-900/20 hover:bg-teal-700 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Define Threshold
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
             <Target size={12} className="text-teal-600" /> Active Rules
          </p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-slate-800 tracking-tight">{summaries.total}</p>
            <ShieldCheck className="text-slate-100 group-hover:text-teal-500/10 transition-colors" size={40} />
          </div>
        </div>

        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
             <AlertTriangle size={12} /> Critical Violations
          </p>
          <p className="text-3xl font-black text-rose-600 tracking-tight">{summaries.critical}</p>
        </div>

        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
             <Clock size={12} /> Near Threshold
          </p>
          <p className="text-3xl font-black text-amber-600 tracking-tight">{summaries.pending}</p>
        </div>
      </div>

      <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
         <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Threshold Surveillance</label>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Identify active reorder points..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                  />
               </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Object</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Current Stock</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Min / Max Level</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Dynamics</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {itemsNeedingReorder.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic font-medium">
                      No reorder definitions found.
                   </td>
                </tr>
              ) : (
                itemsNeedingReorder.map((entry) => (
                  <tr key={entry.reorderPoint.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${entry.needsReorder ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                             <Zap size={18} />
                          </div>
                          <div>
                             <p className="text-xs font-black text-slate-900 tracking-tight uppercase">{entry.item?.code}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{entry.item?.name}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="space-y-0.5">
                          <p className="text-sm font-black font-mono">
                             {entry.currentQuantity.toLocaleString()}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">ON_HAND_UNITS</p>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <p className="text-xs font-black text-slate-700 font-mono">
                          {entry.reorderPoint.minimumLevel} / {entry.reorderPoint.maximumLevel}
                       </p>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase italic">
                             <Truck size={12} className="text-teal-600" /> {entry.reorderPoint.leadTimeDays}d
                          </div>
                          {entry.needsReorder && (
                             <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[8px] font-black animate-pulse">REORDER_NOW</span>
                          )}
                       </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                               setEditingId(entry.reorderPoint.id);
                               setFormData({
                                  stockItemId: entry.reorderPoint.stockItemId,
                                  minimumLevel: entry.reorderPoint.minimumLevel,
                                  maximumLevel: entry.reorderPoint.maximumLevel,
                                  reorderQuantity: entry.reorderPoint.reorderQuantity,
                                  leadTimeDays: entry.reorderPoint.leadTimeDays,
                                  economicOrderQuantity: entry.reorderPoint.economicOrderQuantity,
                                  isActive: entry.reorderPoint.isActive,
                               });
                               setShowForm(true);
                            }}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.reorderPoint.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm"><ShieldCheck size={16} className="text-teal-600" /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Procurement Integrity</p>
                  <p className="text-xs font-bold text-slate-600">Continuous monitoring of safety stock and replenishment cycles.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1.5 font-mono">SYSTEM_VERIFIED</p>
               <p className="text-[9px] font-bold text-slate-300 italic mt-1 uppercase">Next sync: {new Date(Date.now() + 600000).toLocaleTimeString()}</p>
            </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-[0.2em] mb-1">Logic Definition</p>
                  <h3 className="text-xl font-black text-slate-800">{editingId ? 'Recalibrate Threshold' : 'New Equilibrium Point'}</h3>
               </div>
               <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
            </header>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Item (Target SKU)</label>
                  <select
                    required
                    value={formData.stockItemId}
                    onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                  >
                    <option value="">Select Item...</option>
                    {stockItems.map(item => (
                      <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                    ))}
                  </select>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Level (Lower Bound)</label>
                     <input
                       type="number"
                       required
                       min="0"
                       value={formData.minimumLevel}
                       onChange={(e) => setFormData({ ...formData, minimumLevel: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Level (Upper Bound)</label>
                     <input
                       type="number"
                       required
                       min="0"
                       value={formData.maximumLevel}
                       onChange={(e) => setFormData({ ...formData, maximumLevel: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reorder Qty</label>
                     <input
                       type="number"
                       required
                       min="1"
                       value={formData.reorderQuantity}
                       onChange={(e) => setFormData({ ...formData, reorderQuantity: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lead Time (Days)</label>
                     <input
                       type="number"
                       required
                       min="1"
                       value={formData.leadTimeDays}
                       onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                     />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">EOQ Target</label>
                     <input
                       type="number"
                       value={formData.economicOrderQuantity}
                       onChange={(e) => setFormData({ ...formData, economicOrderQuantity: Number(e.target.value) })}
                       className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-teal-500/20 focus:bg-white transition-all text-sm font-bold text-slate-800"
                     />
                  </div>
               </div>

               <button
                 type="submit"
                 disabled={submitting}
                 className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-slate-900/20 hover:bg-black hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
               >
                 {submitting ? 'PROCESSING_LOGIC...' : editingId ? 'DEPLOY_RECALIBRATION' : 'INITIALIZE_THRESHOLD'}
               </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReorderView;
