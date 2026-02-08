import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Search, AlertCircle, Package, ShieldCheck, Database, Info, Filter, Tag, Zap, Target } from 'lucide-react';
import { StockItem, InventoryValuationMethod } from '../types';

interface StockItemsViewProps {
  items: StockItem[];
  accounts: any[];
  onAdd: (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, item: Partial<StockItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currency: string;
  isLoading?: boolean;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  type: 'STOCK_ITEM' | 'NON_STOCK_ITEM';
  unitOfMeasure: string;
  valuationMethod: InventoryValuationMethod;
  reorderLevel: number;
  reorderQuantity: number;
  safetyStock: number;
  isActive: boolean;
}

const VALUATION_METHODS: InventoryValuationMethod[] = ['FIFO', 'LIFO', 'WEIGHTED_AVERAGE', 'STANDARD_COST'];
const UNITS = ['PCS', 'BOX', 'KG', 'L', 'M', 'HOUR', 'SERVICE'];

const INITIAL_FORM: FormData = {
  code: '',
  name: '',
  description: '',
  type: 'STOCK_ITEM',
  unitOfMeasure: 'PCS',
  valuationMethod: 'FIFO',
  reorderLevel: 0,
  reorderQuantity: 0,
  safetyStock: 0,
  isActive: true,
};

export const StockItemsView: React.FC<StockItemsViewProps> = ({
  items,
  accounts,
  onAdd,
  onUpdate,
  onDelete,
  currency,
  isLoading = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
    setShowForm(true);
  };

  const handleEditClick = (item: StockItem) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      name: item.name,
      description: item.description || '',
      type: item.type,
      unitOfMeasure: item.unitOfMeasure,
      valuationMethod: item.valuationMethod,
      reorderLevel: item.reorderLevel,
      reorderQuantity: item.reorderQuantity,
      safetyStock: item.safetyStock,
      isActive: item.isActive,
    });
    setError(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.code.trim()) {
      setError('Code is required');
      return false;
    }
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }

    const duplicateCode = items.some(
      (item) => item.code === formData.code.trim() && item.id !== editingId && !item.isDeleted
    );
    if (duplicateCode) {
      setError('An item with this code already exists');
      return false;
    }

    if (formData.reorderLevel < 0 || formData.reorderQuantity < 0 || formData.safetyStock < 0) {
      setError('Quantities cannot be negative');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        unitOfMeasure: formData.unitOfMeasure,
        valuationMethod: formData.valuationMethod,
        reorderLevel: formData.reorderLevel,
        reorderQuantity: formData.reorderQuantity,
        safetyStock: formData.safetyStock,
        isActive: formData.isActive,
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        setSuccess('Item updated successfully');
      } else {
        await onAdd(payload);
        setSuccess('Item added successfully');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(INITIAL_FORM);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (deleting === id) {
      setDeleting(null);
      setSubmitting(true);
      try {
        await onDelete(id);
        setSuccess('Item deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete item';
        setError(message);
      } finally {
        setSubmitting(false);
      }
    } else {
      setDeleting(id);
    }
  };

  const activeItems = items.filter((item) => !item.isDeleted);
  const filteredItems = activeItems.filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Stock Item Registry</h2>
          <p className="text-sm text-slate-500 font-normal italic">Physical inventory master data, valuation methods, and replenishment SKU tracking.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleAddClick}
            disabled={isLoading || submitting}
            className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-teal-100 font-black text-xs active:scale-95 uppercase tracking-[0.2em]"
          >
            <Plus className="w-5 h-5" />
            Define Stock Item
          </button>
        )}
      </header>

      {/* Constraints & Policy Banner */}
      {!showForm && (
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden no-print border border-slate-800">
          <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4">
            <ShieldCheck size={240} />
          </div>
          <div className="flex items-center gap-8 relative z-10">
            <div className="p-6 bg-teal-500/10 rounded-3xl border border-teal-500/20 text-teal-400">
               <Package size={40} />
            </div>
            <div>
               <h4 className="text-xl font-black uppercase tracking-tight">Valuation Control Active</h4>
               <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl italic">
                  Inventory units are valuated using precise algorithmic models. Calibrate unit measurements and safety levels to maintain operational integrity in the production pipeline.
               </p>
            </div>
          </div>
          <div className="shrink-0 relative z-10 px-8 py-4 bg-teal-600/10 border border-teal-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-teal-400 flex items-center gap-3">
             <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" /> SYSTEM_PROTECTED
          </div>
        </div>
      )}

      {/* Messaging Nodes */}
      {(error || success) && (
        <div className="space-y-4">
          {error && (
            <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-4">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><AlertCircle size={20} /></div>
              <div className="flex-1">
                <p className="text-sm font-black text-rose-800 uppercase tracking-widest">System Alert</p>
                <p className="text-xs text-rose-600 font-bold mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-rose-300 hover:text-rose-600 transition-colors"><X size={20} /></button>
            </div>
          )}
          {success && (
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-4">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Check size={20} /></div>
              <div className="flex-1">
                <p className="text-sm font-black text-emerald-800 uppercase tracking-widest">Entry Verified</p>
                <p className="text-xs text-emerald-600 font-bold mt-1">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-emerald-300 hover:text-emerald-600 transition-colors"><X size={20} /></button>
            </div>
          )}
        </div>
      )}

      {!showForm && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Query stock index by code, SKU, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-sm font-bold text-slate-800 focus:bg-white focus:border-teal-500/20 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100">
            <button className="p-2.5 text-slate-400 hover:text-teal-600 transiton-colors"><Filter size={18} /></button>
            <div className="w-[1px] h-6 bg-slate-200" />
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{filteredItems.length} Indices Found</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-w-5xl mx-auto">
          <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-teal-900/10">
                    <Database size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                        {editingId ? 'Modify Inventory Specification' : 'Initialize Stock Item Entry'}
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Logistics Architecture & Valuation Calibration</p>
                </div>
            </div>
            <button onClick={handleCancel} className="p-4 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-800"><X size={24} /></button>
          </div>

          <form onSubmit={handleSubmit} className="p-12 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                 <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Tag size={14} className="text-teal-600" /> Identity Attributes
                    </h3>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Universal Item ID / SKU</label>
                          <input required type="text" placeholder="e.g. LAB-COAT-XL" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 focus:ring-4 focus:ring-teal-500/10 transition-all uppercase"
                            value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Official Nomenclature</label>
                          <input required type="text" placeholder="e.g. Protective Laboratory Gear" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800 focus:ring-4 focus:ring-teal-500/10 transition-all"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Zap size={14} className="text-teal-600" /> Measurement Dynamics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit System</label>
                          <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800"
                            value={formData.unitOfMeasure} onChange={e => setFormData({...formData, unitOfMeasure: e.target.value})}>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Valuation Logic</label>
                          <select className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none font-black text-slate-800"
                            value={formData.valuationMethod} onChange={e => setFormData({...formData, valuationMethod: e.target.value as any})}>
                            {VALUATION_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                          </select>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl space-y-6">
                    <h3 className="text-xs font-black text-teal-400 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Target size={14} /> Threshold Surveillance
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2 text-white">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reorder Edge</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none font-black text-white focus:ring-4 focus:ring-teal-500/20"
                            value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: parseFloat(e.target.value) || 0})} />
                       </div>
                       <div className="space-y-2 text-white">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Standard Lot</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none font-black text-white focus:ring-4 focus:ring-teal-500/20"
                            value={formData.reorderQuantity} onChange={e => setFormData({...formData, reorderQuantity: parseFloat(e.target.value) || 0})} />
                       </div>
                       <div className="col-span-2 space-y-2 text-white">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Strategic Safety Buffer</label>
                          <input type="number" step="0.01" className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none font-black text-white focus:ring-4 focus:ring-teal-500/20"
                            value={formData.safetyStock} onChange={e => setFormData({...formData, safetyStock: parseFloat(e.target.value) || 0})} />
                          <p className="text-[9px] text-slate-500 italic mt-2">This buffer is excluded from ATP (Available-to-Promise) calculations.</p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Deployment Status</p>
                       <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Activate for logistics pipelines</p>
                    </div>
                    <button type="button" onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                      className={`w-14 h-8 rounded-full transition-all flex items-center px-1 ${formData.isActive ? 'bg-teal-600' : 'bg-slate-300'}`}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${formData.isActive ? 'translate-x-6' : ''}`} />
                    </button>
                 </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
               <button type="button" onClick={handleCancel} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Cancel Specification
               </button>
               <button type="submit" disabled={submitting} className="flex-[2] py-4 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-teal-700 shadow-xl shadow-teal-900/10 transition-all disabled:opacity-50">
                  {submitting ? 'PROCESSING RECAPITULATION...' : 'REALIZE ITEM INDEX'}
               </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Index / SKU</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic & Metrics</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thresholds</th>
                  <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">System Nodes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-32 text-center text-slate-400 font-medium italic">
                       The inventory index is currently void for the specified criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all border border-slate-200 shadow-sm">
                             <Package size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-tight mb-1">{item.code}</p>
                            <p className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">SKU_REF: {item.id.substring(0,8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                               {item.valuationMethod}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest underline decoration-teal-500 decoration-2">
                               {item.unitOfMeasure}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-6 border-x border-slate-100">
                         <div className="flex justify-center gap-4">
                            <div className="text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">REORDER</p>
                               <p className="text-[11px] font-black text-slate-800">{item.reorderLevel.toLocaleString()}</p>
                            </div>
                            <div className="text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">BUFFER</p>
                               <p className="text-[11px] font-black text-slate-800">{item.safetyStock.toLocaleString()}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${item.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{item.isActive ? 'Active' : 'Archived'}</span>
                         </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditClick(item)} 
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-200 rounded-xl transition-all shadow-sm hover:shadow-md">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteClick(item.id)}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-xl transition-all shadow-sm hover:shadow-md">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm text-teal-600"><Database size={20} /></div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Master Index State</p>
                    <p className="text-xs font-bold text-slate-600">Total of {filteredItems.length} logistics definitions active for simulation.</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-teal-600" /> STOCK_INTEGRITY_SHIELD</p>
                 <p className="text-[9px] font-black text-slate-300 italic mt-2 uppercase tracking-tighter">System Pulse: {new Date().toISOString()}</p>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockItemsView;
