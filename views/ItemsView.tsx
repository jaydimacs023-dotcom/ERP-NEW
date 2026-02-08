
import React, { useState } from 'react';
import { NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory } from '../types';
import { Search, Plus, Box, Trash2, X, Tag, CreditCard, ShieldCheck, Filter, Edit2, ChevronRight, Link as LinkIcon, AlertCircle, Percent, Info } from 'lucide-react';

interface ItemsViewProps {
  items: NonStockItem[];
  accounts: ChartOfAccount[];
  onAddItem: (item: NonStockItem) => void;
  onUpdateItem: (id: string, updates: Partial<NonStockItem>) => void;
  onDeleteItem: (id: string) => void;
}

const ItemsView: React.FC<ItemsViewProps> = ({ items, accounts, onAddItem, onUpdateItem, onDeleteItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NonStockItem | null>(null);

  const [formData, setFormData] = useState<Partial<NonStockItem>>({
    code: '',
    name: '',
    description: '',
    unitPrice: 0,
    incomeAccountId: '',
    expenseAccountId: '',
    taxCategoryId: ''
  });

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ code: '', name: '', description: '', unitPrice: 0, incomeAccountId: '', expenseAccountId: '', taxCategoryId: '' });
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.incomeAccountId) return;

    if (editingItem) {
      onUpdateItem(editingItem.id, formData);
    } else {
      const newItem: NonStockItem = {
        id: `item-${Date.now()}`,
        orgId: 'temp',
        code: formData.code || `ITEM-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        unitPrice: Number(formData.unitPrice) || 0,
        incomeAccountId: formData.incomeAccountId || '',
        expenseAccountId: formData.expenseAccountId || '',        taxCategoryId: formData.taxCategoryId || '',        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false
      };
      onAddItem(newItem);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 uppercase">
            <Box className="text-indigo-600" size={32} />
            Service & Item Catalog
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Centralized registry for non-stock items and institutional fees.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Define New Item
        </button>
      </div>

      {/* Architectural Constraint Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldCheck size={120} />
         </div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/10 text-indigo-400">
               <Info size={32} />
            </div>
            <div>
               <h4 className="text-lg font-black uppercase tracking-tight">Direct Recognition Policy</h4>
               <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-xl">
                  AccounTech utilizes a <strong>Non-Valuated Item Model</strong>. There is no inventory tracking, stock valuation, or automated COGS. 
                  All items are treated as direct G/L triggers (Revenue or Expense) upon recognition.
               </p>
            </div>
         </div>
         <div className="shrink-0 relative z-10 px-6 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400">
            GAAP Compliant Service-Ledger
         </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by code or name..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item Description</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Income Account</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expense Account</th>              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taxation</th>              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unit Price</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length > 0 ? filteredItems.map(item => {
              const incomeAcc = accounts.find(a => a.id === item.incomeAccountId);
              const expenseAcc = accounts.find(a => a.id === item.expenseAccountId);
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shadow-sm bg-slate-50 text-slate-400 border-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600`}>
                        <Tag size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 leading-tight uppercase">{item.name}</div>
                        <div className="text-[9px] font-mono font-black text-indigo-600 uppercase tracking-tighter mt-1">{item.code}</div>
                        {item.description && <div className="text-[10px] text-slate-500 mt-1">{item.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                         {incomeAcc?.name || '-'}
                       </div>
                       {incomeAcc && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">CODE: {incomeAcc?.code}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                         {expenseAcc?.name || '-'}
                       </div>
                       {expenseAcc && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">CODE: {expenseAcc?.code}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <div className={`text-[10px] font-black px-2.5 py-1 rounded-full w-fit uppercase ${item.taxCategoryId === 'VAT' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                         {item.taxCategoryId || 'NON-TAX'}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-black text-slate-800">
                    {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { setEditingItem(item); setFormData(item); setShowModal(true); }} className="p-2 hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 rounded-lg transition-colors"><Edit2 size={16} /></button>
                       <button onClick={() => onDeleteItem(item.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic">No definitions found in the catalog.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Box size={20} /></div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{editingItem ? 'Modify Definition' : 'Define Catalog Item'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">SKU / Code</label>
                    <input required placeholder="NCII-01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs font-black text-indigo-600 uppercase"
                      value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '-')})} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Official Description</label>
                    <input required placeholder="e.g. NCII Assessment Fee" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-slate-800 text-sm"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Description (Optional)</label>
                  <textarea placeholder="Additional notes..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm text-slate-700" rows={2}
                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon size={14} /> Income Account (Revenue)
                  </label>
                  <select required className="w-full px-4 py-3 bg-white border-2 border-green-100 rounded-2xl outline-none text-sm font-black text-green-700 appearance-none"
                    value={formData.incomeAccountId} onChange={e => setFormData({...formData, incomeAccountId: e.target.value})}>
                    <option value="">Select Income Account...</option>
                    {accounts.filter(a => !a.isHeader && a.class === 'REVENUE').map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 italic">Revenue account for income recognition when this item is sold.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon size={14} /> Expense Account (Cost)
                  </label>
                  <select className="w-full px-4 py-3 bg-white border-2 border-rose-100 rounded-2xl outline-none text-sm font-black text-rose-700 appearance-none"
                    value={formData.expenseAccountId} onChange={e => setFormData({...formData, expenseAccountId: e.target.value})}>
                    <option value="">Select Expense Account (Optional)...</option>
                    {accounts.filter(a => !a.isHeader && a.class === 'EXPENSE').map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 italic">Expense account for cost recognition when this item is purchased.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    <Percent size={14} /> Tax Category
                  </label>
                  <select className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-2xl outline-none text-sm font-black text-indigo-700 appearance-none"
                    value={formData.taxCategoryId} onChange={e => setFormData({...formData, taxCategoryId: e.target.value})}>
                    <option value="">Non-Vatable / Exempt</option>
                    <option value="VAT">VAT (12%)</option>
                    <option value="VAT_EXEMPT">VAT Exempt</option>
                    <option value="ZERO_RATED">Zero Rated</option>
                  </select>
                  <p className="text-[9px] text-slate-400 italic">Determines if Output VAT is applied during sales invoicing.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Unit Price</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-black text-slate-900"
                    value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} />
                </div>
              </div>

              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-900 leading-relaxed font-bold">
                   Notice: This catalog does not support FIFO/LIFO tracking. Items are non-stock and trigger direct G/L entries.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Commit Definition</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsView;
