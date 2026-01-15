import React, { useState } from 'react';
import { NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory } from '../types';
import { Search, Plus, Box, Trash2, X, Tag, CreditCard, ShieldCheck, Filter, Edit2, ChevronRight, Link as LinkIcon, AlertCircle, Percent } from 'lucide-react';

interface ItemsViewProps {
  items: NonStockItem[];
  accounts: ChartOfAccount[];
  onAddItem: (item: NonStockItem) => void;
  onUpdateItem: (item: NonStockItem) => void;
  onDeleteItem: (id: string) => void;
}

const ItemsView: React.FC<ItemsViewProps> = ({ items, accounts, onAddItem, onUpdateItem, onDeleteItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NonStockItem | null>(null);

  const [formData, setFormData] = useState<Partial<NonStockItem>>({
    code: '',
    name: '',
    type: 'FEE',
    defaultAccountId: '',
    unitPrice: 0,
    taxCategory: TaxCategory.VAT,
    whtRate: WHTCategory.NONE,
    isActive: true
  });

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ code: '', name: '', type: 'FEE', defaultAccountId: '', unitPrice: 0, taxCategory: TaxCategory.VAT, whtRate: WHTCategory.NONE, isActive: true });
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.defaultAccountId) return;

    if (editingItem) {
      onUpdateItem({ ...editingItem, ...formData } as NonStockItem);
    } else {
      const newItem: NonStockItem = {
        id: `item-${Date.now()}`,
        orgId: 'temp',
        code: formData.code || `ITEM-${Date.now()}`,
        name: formData.name,
        type: formData.type as any,
        defaultAccountId: formData.defaultAccountId,
        unitPrice: Number(formData.unitPrice) || 0,
        taxCategory: formData.taxCategory || TaxCategory.VAT,
        whtRate: Number(formData.whtRate) || WHTCategory.NONE,
        isActive: true,
        createdAt: new Date().toISOString()
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
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Box className="text-indigo-600" size={28} />
            Institutional Catalog
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Define non-stock items and services with automated G/L and Tax mappings.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> New Item or Service
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search catalog by code or name..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-sm font-medium">
          <Filter size={16} /> Filter Category
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Service Item</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Tax & G/L Mapping</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">WHT</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Standard Rate</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length > 0 ? filteredItems.map(item => {
              const acc = accounts.find(a => a.id === item.defaultAccountId);
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors shadow-sm ${
                        item.taxCategory === TaxCategory.VAT ? 'bg-indigo-50 text-indigo-500 border-indigo-100' :
                        item.taxCategory === TaxCategory.VAT_EXEMPT ? 'bg-emerald-50 text-emerald-500 border-emerald-100' :
                        'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <Tag size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 leading-tight">{item.name}</div>
                        <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter mt-1">{item.code} • {item.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                       <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                         <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest ${
                           item.taxCategory === TaxCategory.VAT ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                         }`}>{item.taxCategory}</span>
                         {acc?.name}
                       </div>
                       <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">G/L: {acc?.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border uppercase tracking-tight">{(item.whtRate * 100).toFixed(0)}%</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-sm font-mono font-black text-slate-800">{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic font-medium">No items or services defined in the catalog.</td></tr>
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
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">{editingItem ? 'Edit Definition' : 'Define New Service/Item'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Unique Code</label>
                    <input required placeholder="TUITION-01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs font-bold text-indigo-600 uppercase"
                      value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '-')})} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Item Description</label>
                    <input required placeholder="e.g. NCII Assessment Fee" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800 text-sm"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Percent size={12} /> Tax Category
                    </label>
                    <select className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl outline-none text-sm font-bold text-indigo-700"
                      value={formData.taxCategory} onChange={e => setFormData({...formData, taxCategory: e.target.value as any})}>
                      <option value={TaxCategory.VAT}>VAT (12%)</option>
                      <option value={TaxCategory.NON_VAT}>Non-VAT (0%)</option>
                      <option value={TaxCategory.VAT_EXEMPT}>VAT Exempt (0%)</option>
                      <option value={TaxCategory.ZERO_RATED}>Zero Rated (0%)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck size={12} /> Withholding Tax
                    </label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-700"
                      value={formData.whtRate} onChange={e => setFormData({...formData, whtRate: Number(e.target.value)})}>
                      <option value={WHTCategory.NONE}>None (0%)</option>
                      <option value={WHTCategory.GOODS}>Goods (1%)</option>
                      <option value={WHTCategory.SERVICES}>Services (2%)</option>
                      <option value={WHTCategory.RENTAL}>Rental (5%)</option>
                      <option value={WHTCategory.PROFESSIONAL}>Professional (10%)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">G/L Destination Mapping</label>
                  <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-800 appearance-none"
                    value={formData.defaultAccountId} onChange={e => setFormData({...formData, defaultAccountId: e.target.value})}>
                    <option value="">Choose G/L...</option>
                    {accounts.filter(a => !a.isHeader).map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Classification</label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-700"
                      value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                      <option value="FEE">Standard Fee</option>
                      <option value="SERVICE">Service</option>
                      <option value="MATERIAL">Material</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Base Unit Price</label>
                    <input type="number" step="0.01" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-black text-slate-900"
                      value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
                 <AlertCircle className="text-indigo-600 shrink-0" size={20} />
                 <p className="text-[10px] text-indigo-800 leading-relaxed font-medium">
                   Philippine Standard: VAT is 12%. Creditable Withholding Tax (CWT) is usually deducted by the customer if they are a Top Withholding Agent.
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Establish Definition</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsView;