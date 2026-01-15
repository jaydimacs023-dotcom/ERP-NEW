import React, { useState, useMemo } from 'react';
import { FixedAsset, AssetCategory, ChartOfAccount, JournalEntryLine, AccountClass, JournalEntry } from '../types';
import { 
  Box, Play, Trash2, Calendar, FileText, Plus, ShieldCheck, 
  TrendingDown, DollarSign, Activity, ChevronRight, X, Save,
  AlertCircle, History, Info, BarChart3, Layers, Search, Tag
} from 'lucide-react';

interface AssetsViewProps {
  assets: FixedAsset[];
  accounts: ChartOfAccount[];
  lines: JournalEntryLine[];
  entries: JournalEntry[];
  onDepreciate: (assetId: string) => void;
  onAddAsset: (asset: FixedAsset) => void;
}

type AssetTab = 'registry' | 'depreciation_log';

const AssetsView: React.FC<AssetsViewProps> = ({ assets, accounts, lines, entries, onDepreciate, onAddAsset }) => {
  const [activeTab, setActiveTab] = useState<AssetTab>('registry');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<FixedAsset>>({
    name: '',
    code: `FA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    category: AssetCategory.OFFICE_EQUIPMENT,
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: 0,
    salvageValue: 0,
    usefulLifeMonths: 60,
    assetAccountId: '',
    depreciationAccountId: '',
    expenseAccountId: ''
  });

  // Derived Financial Stats per Asset
  const assetFinancials = useMemo<Record<string, { accumulated: number, bookValue: number }>>(() => {
    const data: Record<string, { accumulated: number, bookValue: number }> = {};
    
    assets.forEach(asset => {
      // Find all credit entries to the Accumulated Depreciation account tagged with this assetId
      const assetLines = lines.filter(l => l.assetId === asset.id);
      
      const accDeprLines = assetLines.filter(l => l.accountId === asset.depreciationAccountId);
      const totalAccumulated = accDeprLines.reduce((sum, l) => sum + (l.credit - l.debit), 0);
      
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
    if (!formData.name || !formData.assetAccountId) return;

    const newAsset: FixedAsset = {
      ...formData as FixedAsset,
      id: `asset-${Date.now()}`,
      orgId: 'temp',
      status: 'ACTIVE'
    };

    onAddAsset(newAsset);
    setShowModal(false);
    setFormData({
      name: '',
      code: `FA-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      category: AssetCategory.OFFICE_EQUIPMENT,
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseCost: 0,
      salvageValue: 0,
      usefulLifeMonths: 60
    });
  };

  const getCategoryLabel = (cat: AssetCategory) => {
    return cat.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Box className="text-indigo-600" size={28} />
            Fixed Asset Management
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Monitor institutional capital investments and automated depreciation schedules.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             <button onClick={() => setActiveTab('registry')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'registry' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Layers size={14} className="inline mr-1.5" /> Registry
             </button>
             <button onClick={() => setActiveTab('depreciation_log')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'depreciation_log' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <History size={14} className="inline mr-1.5" /> Depr. Log
             </button>
           </div>
           <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold text-sm active:scale-95"
          >
            <Plus size={18} /> Register Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard label="Gross Asset Cost" value={stats.grossValue} icon={<DollarSign size={20} />} color="slate" />
        <SummaryCard label="Accumulated Depreciation" value={stats.accumulatedDepr} icon={<TrendingDown size={20} />} color="rose" />
        <SummaryCard label="Net Book Value (NBV)" value={stats.netBookValue} icon={<Activity size={20} />} color="emerald" />
      </div>

      {activeTab === 'registry' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  placeholder="Search assets by code or description..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-1 focus:ring-indigo-600 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset & Class</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Cost</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-rose-500 uppercase tracking-widest">Accum. Depr.</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-900 uppercase tracking-widest">Book Value</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.length > 0 ? filteredAssets.map(asset => {
                  const fin = assetFinancials[asset.id] || { accumulated: 0, bookValue: asset.purchaseCost };
                  const deprPercent = (fin.accumulated / (asset.purchaseCost - asset.salvageValue)) * 100;
                  
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <Box size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 leading-tight truncate">{asset.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{asset.code}</div>
                               <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                                 {getCategoryLabel(asset.category)}
                               </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-xs text-slate-600">{asset.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5 text-right font-mono text-xs text-rose-500 font-bold">({fin.accumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td>
                      <td className="px-6 py-5 text-right font-mono text-sm text-slate-900 font-black">{fin.bookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-center">
                           <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, deprPercent)}%` }}></div>
                           </div>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{Math.min(100, deprPercent).toFixed(0)}% Utilized</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => onDepreciate(asset.id)}
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                          title="Run Monthly Depreciation for this Asset"
                        >
                           <Play size={16} fill="currentColor" />
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-400 italic">No assets registered in the system.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'depreciation_log' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="p-6 border-b flex justify-between items-center bg-slate-50/20">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <History size={16} className="text-indigo-600" />
                Asset Depreciation Journal History
              </h3>
           </div>
           <table className="min-w-full divide-y divide-slate-100">
             <thead className="bg-slate-50">
               <tr>
                 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Date</th>
                 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference</th>
                 <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                 <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Depr. Amount</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {entries.filter(e => e.sourceType === 'DEPRECIATION').length > 0 ? 
                [...entries].filter(e => e.sourceType === 'DEPRECIATION').reverse().map(entry => {
                  const deprLine = lines.find(l => l.journalEntryId === entry.id && l.debit > 0);
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-xs text-slate-600">{entry.date}</td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-indigo-600">{entry.reference}</td>
                      <td className="px-6 py-4 text-xs text-slate-600">{entry.description}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs font-bold text-rose-600">
                        {deprLine?.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic">No depreciation journals posted yet.</td></tr>
                )}
             </tbody>
           </table>
        </div>
      )}

      {/* Register Asset Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Box size={20} /></div>
                <h3 className="text-xl font-semibold text-slate-800 uppercase tracking-tight">Register Capital Acquisition</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Asset Class / Category</label>
                  <select 
                    required 
                    className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as AssetCategory})}
                  >
                    <option value={AssetCategory.LAND}>Land (Non-Depreciable)</option>
                    <option value={AssetCategory.BUILDING_IMPROVEMENTS}>Building & Improvements</option>
                    <option value={AssetCategory.FURNITURE_FIXTURES}>Furniture & Fixtures</option>
                    <option value={AssetCategory.OFFICE_EQUIPMENT}>Office Equipment</option>
                    <option value={AssetCategory.IT_EQUIPMENT}>IT & Server Equipment</option>
                    <option value={AssetCategory.SERVICE_VEHICLES}>Service Vehicles</option>
                    <option value={AssetCategory.OTHER_ASSETS}>Other Fixed Assets</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Asset Code</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-indigo-600" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Asset Description</label>
                  <input required placeholder="e.g. Training Server Dell PowerEdge" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                 <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Acquisition Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Initial Cost (Base)</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold" value={formData.purchaseCost} onChange={e => setFormData({...formData, purchaseCost: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Salvage Value</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold" value={formData.salvageValue} onChange={e => setFormData({...formData, salvageValue: Number(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Useful Life (Months)</label>
                  <input type="number" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={formData.usefulLifeMonths} onChange={e => setFormData({...formData, usefulLifeMonths: Number(e.target.value)})} />
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 size={14} className="text-indigo-600" /> General Ledger Mappings
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Asset G/L Account</label>
                    <select required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700" value={formData.assetAccountId} onChange={e => setFormData({...formData, assetAccountId: e.target.value})}>
                      <option value="">Select Account...</option>
                      {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Accum. Depr. G/L</label>
                    <select required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700" value={formData.depreciationAccountId} onChange={e => setFormData({...formData, depreciationAccountId: e.target.value})}>
                      <option value="">Select Account...</option>
                      {accounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Depr. Expense G/L</label>
                    <select required className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700" value={formData.expenseAccountId} onChange={e => setFormData({...formData, expenseAccountId: e.target.value})}>
                      <option value="">Select Account...</option>
                      {accounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader).map(acc => <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex gap-4">
                 <Info className="text-blue-600 shrink-0" size={24} />
                 <div>
                    <h5 className="text-xs font-bold text-blue-900 uppercase tracking-tight mb-1">Depreciation Strategy</h5>
                    <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                      System defaults to <strong>Straight-Line Depreciation</strong>. This configuration will automatically compute a monthly charge of 
                      <span className="font-bold text-indigo-700 mx-1">
                        {((Number(formData.purchaseCost || 0) - Number(formData.salvageValue || 0)) / Number(formData.usefulLifeMonths || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      across the defined useful life.
                    </p>
                 </div>
              </div>

              <div className="pt-8 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> Finish Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string, value: number, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
    <div className={`w-12 h-12 rounded-2xl bg-${color}-50 text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : 'slate-400'} flex items-center justify-center border border-${color}-100 shrink-0 shadow-sm`}>
       {icon}
    </div>
    <div>
       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <p className={`text-xl font-mono font-black text-${color === 'emerald' ? 'emerald-600' : color === 'rose' ? 'rose-600' : 'slate-900'}`}>
         {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
       </p>
    </div>
  </div>
);

export default AssetsView;
