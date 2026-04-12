import React, { useState } from 'react';
import { NonStockItem, ChartOfAccount, AccountClass, TaxCategory, WHTCategory } from '../types';
import { Search, Plus, Box, Trash2, X, Tag, CreditCard, ShieldCheck, Filter, Edit2, ChevronRight, Link as LinkIcon, AlertCircle, Percent, Info, Database, Layers } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

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
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Non-Stock Catalog</h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage services, fees, and standard recurring charges.</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingItem(null); setShowModal(true); }}
          className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded font-semibold text-xs uppercase tracking-wide shadow-sm shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Define Specification
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tag size={120} />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Total Definitions</p>
          <div className="flex items-end justify-between relative z-10">
            <p className="text-xl font-semibold text-gray-800 tracking-tight">{items.length}</p>
            <div className="p-3 bg-gray-50 rounded text-gray-400 border border-gray-100"><Layers size={20} /></div>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-md border border-gray-200 shadow-sm relative overflow-hidden group">
           <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1.5">Taxable Nodes</p>
           <div className="flex items-end justify-between relative z-10">
              <p className="text-xl font-semibold text-gray-800 tracking-tight">{items.filter(i => i.taxCategoryId).length}</p>
              <div className="p-3 bg-brand/10 rounded text-brand border border-brand-light"><Percent size={20} /></div>
           </div>
        </div>

        <div className="bg-gray-800 p-8 rounded-md border border-gray-700 shadow-md relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 text-gray-800 opacity-20 group-hover:scale-110 transition-transform">
            <LinkIcon size={120} />
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Integration Mappings</p>
          <div className="flex items-end justify-between relative z-10">
            <p className="text-xl font-semibold text-white tracking-tight leading-none">{items.filter(i => i.incomeAccountId || i.expenseAccountId).length}</p>
            <div className="p-3 bg-white/5 rounded text-brand border border-white/10"><ShieldCheck size={20} /></div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 opacity-5">
            <Info size={120} />
         </div>
         <div className="flex items-center gap-8 relative z-10">
             <div className="p-6 bg-brand/10 rounded-md text-brand border border-brand-light">
                <ShieldCheck size={40} />
             </div>
             <div>
                <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">Direct recognition policy</h4>
                <p className="text-sm text-gray-500 font-medium leading-relaxed italic max-w-4xl">
                   Note: This ledger utilizes a Non-Valuated Item Model. Services and assets recorded here do not track physical stock metrics. 
                   All catalog items are direct G/L triggers upon invoicing, ensuring instantaneous revenue and expense recognition.
                </p>
             </div>
         </div>
      </div>

      <div className="p-6 bg-white rounded border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-6 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Query catalog indices by nomenclature or SKU code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent rounded text-sm font-bold text-gray-800 focus:bg-white focus:border-brand-light outline-none transition-all"
          />
        </div>
        <div className="px-6 py-2 bg-gray-100 rounded-full text-xs font-semibold text-gray-500 uppercase tracking-wide">
           {filteredItems.length} active nodes
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reference & Identity</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pricing Structure</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Topology</th>
                <th className="px-6 py-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tax Mapping</th>
                <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">System Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-gray-400 italic">
                    The non-stock catalog is currently void. Initialize a new definition to begin.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const incomeAcc = accounts.find(a => a.id === item.incomeAccountId);
                  const expenseAcc = accounts.find(a => a.id === item.expenseAccountId);

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-6">
                        <div className="flex items-center gap-5">
                           <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-brand-light group-hover:text-brand transition-all border border-gray-200">
                              <Tag size={20} />
                           </div>
                           <div>
                              <div className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-tight mb-1">{item.code}</div>
                              <div className="text-sm font-semibold text-gray-900 tracking-tight leading-none mb-1">{item.name}</div>
                              {item.description && <div className="text-xs text-gray-500 italic mt-1 line-clamp-1">{item.description}</div>}
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-sm font-semibold text-gray-800 font-mono tracking-tight bg-gray-100 px-3 py-1.5 rounded-lg w-fit">
                          PHP {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                         <div className="space-y-2 border-l-2 border-gray-100 pl-4">
                            {incomeAcc && (
                              <div className="flex items-center gap-2">
                                 <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase leading-none">INC</span>
                                 <span className="text-xs font-semibold text-gray-600 truncate max-w-[150px]">{incomeAcc.name}</span>
                              </div>
                            )}
                            {expenseAcc && (
                              <div className="flex items-center gap-2">
                                 <span className="text-xs font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase leading-none">EXP</span>
                                 <span className="text-xs font-semibold text-gray-600 truncate max-w-[150px]">{expenseAcc.name}</span>
                              </div>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-6">
                         {item.taxCategoryId ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-semibold uppercase tracking-wide border border-brand-light">
                               <Percent size={10} /> VAT_ACTIVE
                            </span>
                         ) : (
                            <span className="text-xs text-gray-400 italic font-semibold uppercase tracking-wide border border-gray-100 px-2 py-1 rounded-full">EXEMPT</span>
                         )}
                      </td>
                      <td className="px-5 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setFormData(item);
                              setShowModal(true);
                            }}
                            className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-brand rounded transition-all shadow-sm hover:shadow-md"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-rose-600 rounded transition-all shadow-sm hover:shadow-md"
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

        <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center no-print">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white rounded border border-gray-100 shadow-sm text-brand"><Database size={24} /></div>
               <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-2">Non-Stock Registry Status</p>
                  <p className="text-xs font-bold text-gray-600">Total of {filteredItems.length} active service definitions mapped to G/L nodes.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-2"><ShieldCheck size={14} className="text-brand" /> CATALOG_ATTESTED</p>
               <p className="text-xs font-semibold text-gray-300 italic mt-2 uppercase tracking-tighter">Verified Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
      </div>

      {/* Define Specification Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand/10 rounded-lg text-brand border border-brand-light">
                  <Box size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingItem ? 'Modify Specification' : 'Define New Specification'}
                  </h3>
                  <p className="text-xs text-gray-500 italic">Configure non-stock item parameters and G/L mappings</p>
                </div>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Item Code <span className="text-gray-300">(SKU)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., SVC-001"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Unit Price <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">PHP</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitPrice || ''}
                      onChange={e => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Training Fee, Assessment Fee, Registration Fee"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Optional description for this item..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 focus:border-brand outline-none transition-all resize-none"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <LinkIcon size={14} className="text-brand" />
                  G/L Account Mapping
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Income Account <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.incomeAccountId || ''}
                      onChange={e => setFormData({ ...formData, incomeAccountId: e.target.value })}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                    >
                      <option value="">Select income account...</option>
                      {accounts
                        .filter(a => a.class === 'REVENUE' && !a.isHeader)
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Expense Account
                    </label>
                    <select
                      value={formData.expenseAccountId || ''}
                      onChange={e => setFormData({ ...formData, expenseAccountId: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-brand outline-none transition-all"
                    >
                      <option value="">Select expense account (optional)...</option>
                      {accounts
                        .filter(a => a.class === 'EXPENSE' && !a.isHeader)
                        .map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand text-white rounded-lg font-semibold text-sm uppercase tracking-wide shadow-sm shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                >
                  <ShieldCheck size={16} />
                  {editingItem ? 'Update Specification' : 'Register Specification'}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default ItemsView;

