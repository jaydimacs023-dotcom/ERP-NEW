import React, { useState } from 'react';
import { NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory } from '../types';
import { Search, Plus, Box, Trash2, X, Tag, CreditCard, ShieldCheck, Filter, Edit2, ChevronRight, Link as LinkIcon, AlertCircle, Percent, Info, Database, Layers } from 'lucide-react';

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
        expenseAccountId: formData.expenseAccountId || '',
        taxCategoryId: formData.taxCategoryId || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false
      };
      onAddItem(newItem);
    }
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Non-Stock Catalog</h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage services, fees, and standard recurring charges.</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-8 py-3 bg-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-teal-900/10 hover:bg-teal-700 hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Define Specification
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tag size={120} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Definitions</p>
          <div className="flex items-end justify-between relative z-10">
            <p className="text-4xl font-black text-slate-800 tracking-tight">{items.length}</p>
            <div className="p-3 bg-slate-50 rounded-xl text-slate-400 border border-slate-100"><Layers size={20} /></div>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
           <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1.5">Taxable Nodes</p>
           <div className="flex items-end justify-between relative z-10">
              <p className="text-4xl font-black text-slate-800 tracking-tight">{items.filter(i => i.taxCategoryId).length}</p>
              <div className="p-3 bg-teal-50 rounded-xl text-teal-600 border border-teal-100"><Percent size={20} /></div>
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-slate-800 opacity-20 group-hover:scale-110 transition-transform">
            <LinkIcon size={120} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Integration Mappings</p>
          <div className="flex items-end justify-between relative z-10">
            <p className="text-4xl font-black text-white tracking-tight leading-none">{items.filter(i => i.incomeAccountId || i.expenseAccountId).length}</p>
            <div className="p-3 bg-white/5 rounded-xl text-teal-400 border border-white/10"><ShieldCheck size={20} /></div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <Info size={120} />
         </div>
         <div className="flex items-center gap-8 relative z-10">
             <div className="p-6 bg-teal-50 rounded-3xl text-teal-600 border border-teal-100">
                <ShieldCheck size={40} />
             </div>
             <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-2">Direct recognition policy</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed italic max-w-4xl">
                   Note: This ledger utilizes a Non-Valuated Item Model. Services and assets recorded here do not track physical stock metrics. 
                   All catalog items are direct G/L triggers upon invoicing, ensuring instantaneous revenue and expense recognition.
                </p>
             </div>
         </div>
      </div>

      <div className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Query catalog indices by nomenclature or SKU code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-sm font-bold text-slate-800 focus:bg-white focus:border-teal-500/10 outline-none transition-all"
          />
        </div>
        <div className="px-6 py-2 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
           {filteredItems.length} active nodes
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference & Identity</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing Structure</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Topology</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax Mapping</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">System Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center text-slate-400 italic">
                    The non-stock catalog is currently void. Initialize a new definition to begin.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const incomeAcc = accounts.find(a => a.id === item.incomeAccountId);
                  const expenseAcc = accounts.find(a => a.id === item.expenseAccountId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all border border-slate-200">
                              <Tag size={20} />
                           </div>
                           <div>
                              <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tight mb-1">{item.code}</div>
                              <div className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1">{item.name}</div>
                              {item.description && <div className="text-[10px] text-slate-500 italic mt-1 line-clamp-1">{item.description}</div>}
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-sm font-black text-slate-800 font-mono tracking-tight bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
                          PHP {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="space-y-2 border-l-2 border-slate-100 pl-4">
                            {incomeAcc && (
                              <div className="flex items-center gap-2">
                                 <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase leading-none">INC</span>
                                 <span className="text-[10px] font-black text-slate-600 truncate max-w-[150px]">{incomeAcc.name}</span>
                              </div>
                            )}
                            {expenseAcc && (
                              <div className="flex items-center gap-2">
                                 <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase leading-none">EXP</span>
                                 <span className="text-[10px] font-black text-slate-600 truncate max-w-[150px]">{expenseAcc.name}</span>
                              </div>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-6">
                         {item.taxCategoryId ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                               <Percent size={10} /> VAT_ACTIVE
                            </span>
                         ) : (
                            <span className="text-[9px] text-slate-400 italic font-black uppercase tracking-widest border border-slate-100 px-2 py-1 rounded-full">EXEMPT</span>
                         )}
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setFormData(item);
                              setShowModal(true);
                            }}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-teal-600 rounded-xl transition-all shadow-sm hover:shadow-md"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm hover:shadow-md"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
            </tbody>
          </table>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-between items-center no-print">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-teal-600"><Database size={24} /></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Non-Stock Registry Status</p>
                  <p className="text-xs font-bold text-slate-600">Total of {filteredItems.length} active service definitions mapped to G/L nodes.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-teal-600" /> CATALOG_ATTESTED</p>
               <p className="text-[9px] font-black text-slate-300 italic mt-2 uppercase tracking-tighter">Verified Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ItemsView;
