
import React, { useState, useMemo } from 'react';
import { ChartOfAccount, TransactionSummary, AccountClass, Budget, BudgetLine } from '../types';
import ModalPortal from '../components/ModalPortal';
import { 
  PieChart, Plus, Target, TrendingUp, TrendingDown, 
  ChevronRight, AlertCircle, Save, X, Calculator,
  Activity, ArrowUpRight, ArrowDownRight, Info, Search,
  BarChart3, Scale, ShieldCheck
} from 'lucide-react';

interface BudgetViewProps {
  accounts: ChartOfAccount[];
  summaries: TransactionSummary[];
  budgets: Budget[];
  budgetLines: BudgetLine[];
  onSaveBudget: (budget: Partial<Budget>, lines: Partial<BudgetLine>[]) => void;
}

const BudgetView: React.FC<BudgetViewProps> = ({ 
  accounts, summaries, budgets, budgetLines, onSaveBudget 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(budgets[0]?.id || '');
  
  // New Budget Form State
  const [budgetName, setBudgetName] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [editingLines, setEditingLines] = useState<Record<string, number>>({});

  const activeBudget = useMemo(() => budgets.find(b => b.id === selectedBudgetId), [budgets, selectedBudgetId]);
  const activeLines = useMemo(() => budgetLines.filter(l => l.budgetId === selectedBudgetId), [budgetLines, selectedBudgetId]);

  const budgetStats = useMemo(() => {
    const revenueAccounts = accounts.filter(a => a.class === AccountClass.REVENUE && !a.isHeader);
    const expenseAccounts = accounts.filter(a => a.class === AccountClass.EXPENSE && !a.isHeader);

    const getBudgetTotal = (accIds: string[]) => 
      activeLines.filter(l => accIds.includes(l.accountId)).reduce((s, l) => s + l.budgetedAmount, 0);

    const getActualTotal = (accIds: string[]) =>
      summaries.filter(s => accIds.includes(s.accountId)).reduce((s, su) => s + su.balance, 0);

    const revIds = revenueAccounts.map(a => a.id);
    const expIds = expenseAccounts.map(a => a.id);

    return {
      revenueBudget: getBudgetTotal(revIds),
      revenueActual: getActualTotal(revIds),
      expenseBudget: getBudgetTotal(expIds),
      expenseActual: getActualTotal(expIds)
    };
  }, [accounts, activeLines, summaries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetId = `bud-${Date.now()}`;
    const budgetObj: Partial<Budget> = {
      id: budgetId,
      name: budgetName,
      fiscalYear,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    // Fix: Cast 'amt' to number to resolve type mismatch with BudgetLine.budgetedAmount
    const linesObj: Partial<BudgetLine>[] = Object.entries(editingLines).map(([accId, amt]) => ({
      id: `bl-${Math.random().toString(36).slice(-6)}`,
      budgetId,
      accountId: accId,
      budgetedAmount: amt as number
    }));

    onSaveBudget(budgetObj, linesObj);
    setShowModal(false);
    setSelectedBudgetId(budgetId);
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Fiscal Oversight & Budgeting</h2>
          <p className="text-sm text-gray-500 font-normal italic">Monitor institutional performance targets and actual ledger utilization.</p>
        </div>
        <div className="flex gap-3">
          {budgets.length > 0 && (
            <select 
              className="px-4 py-2.5 bg-white border border-brand-light rounded text-xs font-semibold uppercase text-brand outline-none focus:border-brand"
              value={selectedBudgetId}
              onChange={e => setSelectedBudgetId(e.target.value)}
            >
              {budgets.map(b => <option key={b.id} value={b.id}>{b.name} (FY {b.fiscalYear})</option>)}
            </select>
          )}
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-xs"
          >
            <Plus size={16} /> Define New Budget
          </button>
        </div>
      </header>

      {activeBudget ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SummaryWidget 
              label="Revenue Performance" 
              budget={budgetStats.revenueBudget} 
              actual={budgetStats.revenueActual} 
              type="REVENUE"
              color="emerald"
            />
            <SummaryWidget 
              label="Expense Utilization" 
              budget={budgetStats.expenseBudget} 
              actual={budgetStats.expenseActual} 
              type="EXPENSE"
              color="rose"
            />
          </div>

          <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-brand/10 text-brand border border-brand-light rounded"><BarChart3 size={18} /></div>
                   <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Detailed Variance Analysis</h3>
                </div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                   Reporting Period: Full Fiscal Year {activeBudget.fiscalYear}
                </div>
             </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                   <thead className="bg-gray-50/80">
                      <tr>
                         <th className="px-5 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Title</th>
                         <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Budgeted Target</th>
                         <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actual Posting</th>
                         <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Variance Amount</th>
                         <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {activeLines.map(line => {
                        const acc = accounts.find(a => a.id === line.accountId);
                        const actual = summaries.find(s => s.accountId === line.accountId)?.balance || 0;
                        const variance = actual - line.budgetedAmount;
                        const percentUsed = (actual / line.budgetedAmount) * 100;
                        const isRev = acc?.class === AccountClass.REVENUE;
                        // For Revenue, surplus (+ variance) is Good. For Expense, surplus (+ variance) is Bad.
                        const isFavorable = isRev ? variance >= 0 : variance <= 0;

                        return (
                          <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                             <td className="px-5 py-6">
                                <div className="text-sm font-bold text-gray-800 uppercase tracking-tight">{acc?.name}</div>
                                <div className="text-xs font-mono text-gray-400 mt-0.5">CODE: {acc?.code}</div>
                             </td>
                             <td className="px-5 py-6 text-right font-mono text-xs font-bold text-gray-600">{formatCurrency(line.budgetedAmount)}</td>
                             <td className="px-5 py-6 text-right font-mono text-xs font-semibold text-gray-900">{formatCurrency(actual)}</td>
                             <td className={`px-5 py-6 text-right font-mono text-xs font-semibold ${isFavorable ? 'text-brand' : 'text-rose-600'}`}>
                                {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                             </td>
                             <td className="px-5 py-6 text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                   <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-1000 ${isFavorable ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                        style={{ width: `${Math.min(100, Math.abs(percentUsed))}%` }} 
                                      />
                                   </div>
                                   <span className={`text-xs font-semibold uppercase tracking-wide ${isFavorable ? 'text-brand' : 'text-rose-600'}`}>
                                      {percentUsed.toFixed(1)}% Usage
                                   </span>
                                </div>
                             </td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-md border border-dashed border-gray-200">
           <Calculator size={48} className="mx-auto mb-4 text-gray-200" />
           <h3 className="text-lg font-semibold text-gray-400 uppercase tracking-tight">No Active Budgets Found</h3>
           <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Establish fiscal targets to unlock automated variance analysis and utilization monitoring.</p>
           <button 
             onClick={() => setShowModal(true)}
             className="mt-8 px-8 py-3 bg-brand text-white rounded text-xs font-semibold uppercase tracking-wide shadow-sm shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all"
           >
              Create FY {fiscalYear} Target
           </button>
        </div>
      )}

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-md shadow-md w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 flex flex-col h-[85vh]">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand/10 text-brand border border-brand-light rounded shadow-sm"><Target size={24} /></div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Budget Definition</h3>
               </div>
               <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-12">
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Budget Internal Title</label>
                     <input 
                       required autoFocus placeholder="e.g. FY 2024 Core Operations"
                       className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-800 outline-none focus:border-brand"
                       value={budgetName} onChange={e => setBudgetName(e.target.value)}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Fiscal Year Targeting</label>
                     <input 
                       type="number" className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-brand outline-none focus:border-brand"
                       value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}
                     />
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                     <Scale size={16} className="text-brand" />
                     Nominal Account Targets
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                     {accounts.filter(a => (a.class === AccountClass.REVENUE || a.class === AccountClass.EXPENSE) && !a.isHeader).map(acc => (
                       <div key={acc.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded border border-gray-100 group hover:border-brand-light transition-all">
                          <div className="min-w-0">
                             <p className="text-xs font-semibold text-gray-400 uppercase truncate">{acc.name}</p>
                             <p className="text-xs font-mono text-brand uppercase mt-0.5">{acc.class}</p>
                          </div>
                          <div className="relative shrink-0">
                             <input 
                               type="number"
                               placeholder="0.00"
                               className="w-32 pl-8 pr-4 py-2 bg-white border border-gray-200 rounded text-right text-xs font-mono font-semibold outline-none focus:border-brand"
                               value={editingLines[acc.id] || ''}
                               onChange={e => setEditingLines({...editingLines, [acc.id]: Number(e.target.value)})}
                             />
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-300">{"\u20B1"}</span>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 bg-gray-800 border-t flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-3">
                  {/* Fixed: ShieldCheck was not imported from lucide-react */}
                  <ShieldCheck className="text-brand" size={24} />
                  <p className="text-xs text-gray-400 leading-relaxed font-bold">
                    This budget will serve as the benchmark for financial compliance reports and executive dashboards. Targets can be revised until the period is formally CLOSED.
                  </p>
               </div>
               <div className="flex gap-4 w-full md:w-auto">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-8 py-3 text-sm font-semibold text-gray-400 hover:text-white transition-colors">Discard</button>
                  <button 
                    onClick={handleSubmit}
                    disabled={!budgetName || Object.keys(editingLines).length === 0}
                    className="flex-1 px-5 py-3 bg-brand text-white rounded text-sm font-semibold shadow-sm shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                     Commit Targets
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

const SummaryWidget: React.FC<{ label: string, budget: number, actual: number, type: 'REVENUE' | 'EXPENSE', color: string }> = ({ label, budget, actual, type, color }) => {
  const percent = budget > 0 ? (actual / budget) * 100 : 0;
  const isRevenue = type === 'REVENUE';
  const variance = actual - budget;
  
  // Status Logic: Revenue surplus is good (surplus = favorable). Expense surplus is bad (surplus = unfavorable).
  const isFavorable = isRevenue ? variance >= 0 : variance <= 0;
  const varianceDisplay = Math.abs(variance).toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-md p-8 border border-gray-200 shadow-sm relative overflow-hidden group">
       <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-start">
             <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</h4>
                <p className="text-lg font-semibold text-gray-900 tracking-tight">{"\u20B1"} {actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
             </div>
             <div className={`p-3 rounded bg-${color}-50 text-${color}-600 border border-${color}-100`}>
                {isRevenue ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
             </div>
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span>Utilization ({percent.toFixed(0)}%)</span>
                <span>Goal: {budget.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
             </div>
             <div className="w-full h-3 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${isFavorable ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                  style={{ width: `${Math.min(100, Math.abs(percent))}%` }} 
                />
             </div>
          </div>

          <div className={`p-4 rounded flex items-center justify-between border ${isFavorable ? 'bg-brand/5 border-brand-light' : 'bg-rose-50/50 border-rose-100'}`}>
             <div className="flex items-center gap-2">
                {isFavorable ? <ArrowUpRight size={18} className="text-brand" /> : <ArrowDownRight size={18} className="text-rose-600" />}
                <span className={`text-xs font-semibold uppercase tracking-wide ${isFavorable ? 'text-brand' : 'text-rose-700'}`}>
                   {isFavorable ? 'Favorable' : 'Over-Limit'} Variance
                </span>
             </div>
             <span className={`text-xs font-mono font-semibold ${isFavorable ? 'text-brand' : 'text-rose-700'}`}>
                {variance >= 0 ? '+' : '-'}{"\u20B1"} {varianceDisplay}
             </span>
          </div>
       </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean, label: string, onClick: () => void, icon: React.ReactNode }> = ({ active, label, onClick, icon }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-2 rounded text-xs font-semibold uppercase tracking-wide transition-all ${active ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-400 hover:text-gray-600'}`}>{icon} {label}</button>
);

export default BudgetView;

