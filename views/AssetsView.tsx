import React, { useState, useMemo } from 'react';
import { FixedAsset, AssetCategory, ChartOfAccount, JournalLine, AccountClass, JournalEntry } from '../types';
import { 
  Box, Play, Trash2, Calendar, FileText, Plus, ShieldCheck, 
  TrendingDown, DollarSign, Activity, ChevronRight, X, Save,
  AlertCircle, History, Info, BarChart3, Layers, Search, Tag, CheckCircle
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AssetsViewProps {
  assets: FixedAsset[];
  accounts: ChartOfAccount[];
  lines: JournalLine[];
  entries: JournalEntry[];
  onDepreciate: (assetId: string) => void;
  onAddAsset: (asset: FixedAsset) => void;
  onUpdateAsset?: (id: string, updates: Partial<FixedAsset>) => void;
  onDeleteAsset?: (id: string) => void;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

type AssetTab = 'registry' | 'depreciation_log';

const AssetsView: React.FC<AssetsViewProps> = ({ assets, accounts, lines, entries, onDepreciate, onAddAsset, onUpdateAsset, onNotify }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('registry');
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}`;
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Form State
  const [formData, setFormData] = useState<Partial<FixedAsset>>({
    name: '',
    description: '',
    code: `FA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    category: 'Equipment',
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: 0,
    depreciationMethod: 'straight-line',
    usefulLifeYears: 5,
    glAccountId: ''
  });

  // Derived Financial Stats per Asset
  const assetFinancials = useMemo<Record<string, { accumulated: number, bookValue: number }>>(() => {
    const data: Record<string, { accumulated: number, bookValue: number }> = {};
    
    assets.forEach(asset => {
      // Use accumulatedDepreciation directly from asset (which comes from Supabase or is manually edited)
      const totalAccumulated = asset.accumulatedDepreciation || 0;
      
      data[asset.id] = {
        accumulated: totalAccumulated,
        bookValue: asset.purchaseCost - totalAccumulated
      };
    });
    
    return data;
  }, [assets, lines]);

  // Global Aggregate Stats
  const stats = useMemo(() => {
    const gross = assets.reduce((sum, a) => sum + a.purchaseCost, 0);
    const financialValues = Object.values(assetFinancials) as { accumulated: number, bookValue: number }[];
    const acc = financialValues.reduce((sum, f) => sum + f.accumulated, 0);
    return {
      grossValue: gross,
      accumulatedDepr: acc,
      netBookValue: gross - acc
    };
  }, [assets, assetFinancials]);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.glAccountId) return;

    const newAsset: FixedAsset = {
      ...formData,
      id: `asset-${Date.now()}`,
      orgId: 'temp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false
    } as FixedAsset;

    onAddAsset(newAsset);
    showToast(`Fixed asset "${formData.name}" created successfully`, 'success');
    setShowModal(false);
    setFormData({
      name: '',
      description: '',
      code: `FA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      category: 'Equipment',
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseCost: 0,
      depreciationMethod: 'straight-line',
      usefulLifeYears: 5,
      glAccountId: ''
    });
  };

  const getCategoryLabel = (cat: AssetCategory) => {
    return cat.replace(/_/g, ' ');
  };

  const handleEditAccumulated = (asset: FixedAsset) => {
    setEditingAsset({ ...asset });
    setShowEditModal(true);
  };

  const handleSaveAccumulated = () => {
    if (!editingAsset) return;
    onUpdateAsset?.(editingAsset.id, { accumulatedDepreciation: editingAsset.accumulatedDepreciation });
    showToast('Accumulated depreciation updated successfully', 'success');
    setShowEditModal(false);
    setEditingAsset(null);
  };

  return (
    <div className="space-y-8">
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded shadow-lg border flex items-center gap-2 animate-in slide-in-from-right duration-300 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-brand/10 text-brand border-brand-light'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle size={18} className="text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle size={18} className="text-rose-600" />
              ) : (
                <Info size={18} className="text-brand" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Fixed Asset Management
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">Monitor institutional capital investments and automated depreciation schedules.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-gray-100 p-1 rounded border border-gray-200">
             <button onClick={() => setActiveTab('registry')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'registry' ? 'bg-white text-brand shadow-sm border border-brand-light' : 'text-gray-500 hover:text-gray-700'}`}>
               <Layers size={14} className="inline mr-1.5" /> Registry
             </button>
             <button onClick={() => setActiveTab('depreciation_log')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'depreciation_log' ? 'bg-white text-brand shadow-sm border border-brand-light' : 'text-gray-500 hover:text-gray-700'}`}>
               <History size={14} className="inline mr-1.5" /> Depr. Log
             </button>
           </div>
           <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-sm active:scale-95"
          >
            <Plus size={18} /> Register Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard label="Gross Asset Cost" value={stats.grossValue} icon={<DollarSign size={20} />} color="gray" />
        <SummaryCard label="Accumulated Depreciation" value={stats.accumulatedDepr} icon={<TrendingDown size={20} />} color="rose" />
        <SummaryCard label="Net Book Value (NBV)" value={stats.netBookValue} icon={<Activity size={20} />} color="emerald" />
      </div>

      {activeTab === 'registry' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm flex items-center gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  placeholder="Search assets by code or description..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded text-sm focus:border-brand outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Asset & Class</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Initial Cost</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-rose-500 uppercase tracking-wide">Accum. Depr.</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-wide">Book Value</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Progress</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                  const fin = assetFinancials[asset.id] || { accumulated: 0, bookValue: asset.purchaseCost };
                  // Calculate depreciation percentage: accumulated depreciation / purchase cost * 100
                  const deprPercent = asset.purchaseCost > 0 ? (fin.accumulated / asset.purchaseCost) * 100 : 0;
                  
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shadow-sm shrink-0 group-hover:bg-brand-light group-hover:text-brand transition-all">
                            <Box size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-800 leading-tight truncate">{asset.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="text-xs font-mono text-gray-400 uppercase tracking-tighter">{asset.code}</div>
                               <span className="text-xs font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand-light uppercase tracking-tighter">
                                 {getCategoryLabel(asset.category)}
                               </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-xs text-gray-600">{asset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5 text-right font-mono text-xs text-rose-500 font-bold">({fin.accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td>
                      <td className="px-6 py-5 text-right font-mono text-sm text-gray-900 font-semibold">{fin.bookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-center">
                           <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-brand rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, deprPercent)}%` }}></div>
                           </div>
                           <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{Math.min(100, deprPercent).toFixed(0)}% Utilized</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button 
                            onClick={() => handleEditAccumulated(asset)}
                            className="p-2 bg-brand/10 text-brand rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm shadow-brand/20 active:scale-95"
                            title="Edit Accumulated Depreciation"
                          >
                             <AlertCircle size={16} />
                          </button>
                          <button 
                            onClick={() => onDepreciate(asset.id)}
                            className="p-2 bg-brand/10 text-brand rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm shadow-brand/20 active:scale-95"
                            title="Run Monthly Depreciation for this Asset"
                          >
                             <Play size={16} fill="currentColor" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="py-20 text-center text-gray-400 italic">No assets registered in the system.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'depreciation_log' && (
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
           <div className="p-6 border-b flex justify-between items-center bg-gray-50/20">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                <History size={16} className="text-brand" />
                Asset Depreciation Journal History
              </h3>
           </div>
           <table className="min-w-full divide-y divide-gray-100">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Entry Date</th>
                 <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Reference</th>
                 <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
                 <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Depr. Amount</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-100">
               {entries.filter(e => e.sourceType === 'DEPRECIATION').length > 0 ? 
                [...entries].filter(e => e.sourceType === 'DEPRECIATION').reverse().map(entry => {
                  const deprLine = lines.find(l => l.journalEntryId === entry.id && l.debit > 0);
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-xs text-gray-600">{entry.date}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-brand">{entry.reference}</td>
                      <td className="px-6 py-4 text-xs text-gray-600">{entry.description}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-rose-600">
                        {deprLine?.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={4} className="py-20 text-center text-gray-400 italic">No depreciation journals posted yet.</td></tr>
                )}
             </tbody>
           </table>
        </div>
      )}

      {/* Register Asset Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><Box size={20} /></div>
                <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">Register Capital Acquisition</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset Category</label>
                  <select 
                    required 
                    className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded text-sm font-bold text-brand outline-none appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Land">Land (Non-Depreciable)</option>
                    <option value="Building">Building & Improvements</option>
                    <option value="Furniture">Furniture & Fixtures</option>
                    <option value="Equipment">Office Equipment</option>
                    <option value="IT Equipment">IT & Server Equipment</option>
                    <option value="Vehicles">Service Vehicles</option>
                    <option value="Other">Other Fixed Assets</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset Code</label>
                  <input required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-mono font-bold text-brand" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset Description</label>
                  <input required placeholder="e.g. Training Server Dell PowerEdge" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-800" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                 <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acquisition Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-medium" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Initial Cost (Base)</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-mono font-bold" value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Depreciation Method</label>
                  <select required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold text-gray-700">
                    <option value="straight-line">Straight-Line</option>
                    <option value="declining-balance">Declining Balance</option>
                    <option value="units-produced">Units Produced</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Useful Life (Years)</label>
                  <input type="number" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-bold" value={formData.usefulLifeYears} onChange={e => setFormData({...formData, usefulLifeYears: Number(e.target.value)})} />
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <BarChart3 size={14} className="text-brand" /> General Ledger Mappings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">GL Account</label>
                    <select required className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-700" value={formData.glAccountId} onChange={e => setFormData({...formData, glAccountId: e.target.value})}>
                      <option value="">Select Account...</option>
                      {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Details / Notes</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded text-sm font-medium text-gray-700" placeholder="Additional details (optional)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="bg-brand/10 p-6 rounded-md border border-brand-light flex gap-4">
                 <Info className="text-brand shrink-0" size={24} />
                 <div>
                    <h5 className="text-xs font-bold text-brand uppercase tracking-tight mb-1">Depreciation Strategy</h5>
                    <p className="text-xs text-brand leading-relaxed font-medium">
                      System defaults to <strong>Straight-Line Depreciation</strong>. This configuration will automatically compute an annual charge of 
                      <span className="font-bold text-brand mx-1">
                        {(Number(formData.purchaseCost || 0) / Number(formData.usefulLifeYears || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      across the defined useful life.
                    </p>
                 </div>
              </div>

              <div className="pt-8 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-brand text-white rounded text-sm font-bold shadow-lg shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> Finish Registration
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Edit Accumulated Depreciation Modal */}
      {showEditModal && editingAsset && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><AlertCircle size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Edit Accumulated Depreciation</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-4">Asset: <span className="font-bold text-gray-800">{editingAsset.name}</span></p>
                <p className="text-sm text-gray-600 mb-4">Code: <span className="font-mono text-gray-800">{editingAsset.code}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purchase Cost</label>
                <input type="text" disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded text-sm font-mono font-bold text-gray-600" value={editingAsset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accumulated Depreciation</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full px-4 py-2.5 bg-brand/10 border border-brand-light rounded text-sm font-mono font-bold text-brand focus:border-brand outline-none"
                  value={editingAsset.accumulatedDepreciation || 0}
                  onChange={e => setEditingAsset({...editingAsset, accumulatedDepreciation: Number(e.target.value)})}
                />
              </div>

              <div className="bg-amber-50 p-4 rounded border border-amber-200 flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <div className="text-xs text-amber-800">
                  <p className="font-bold mb-1">Note:</p>
                  <p>Setting accumulated depreciation directly overwrites calculation from depreciation journal entries. Use this to catch up on missed periods.</p>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                <button type="button" onClick={handleSaveAccumulated} className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold shadow-lg shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string, value: number, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex items-center gap-5">
    <div className={`w-12 h-12 rounded bg-${color}-50 text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : 'gray-400'} flex items-center justify-center border border-${color}-100 shrink-0 shadow-sm`}>
       {icon}
    </div>
    <div>
       <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
       <p className={`text-xl font-mono font-semibold text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : 'gray-900'}`}>
         {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
       </p>
    </div>
  </div>
);

export default AssetsView;

