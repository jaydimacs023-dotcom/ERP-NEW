import React from 'react';
import { TransactionSummary, AccountClass } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart } from 'lucide-react';

interface DashboardProps {
  summaries: TransactionSummary[];
  currency?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ summaries, currency = 'USD' }) => {
  const assets = summaries.filter(s => s.accountClass === AccountClass.ASSET).reduce((sum, s) => sum + s.balance, 0);
  const liabilities = summaries.filter(s => s.accountClass === AccountClass.LIABILITY).reduce((sum, s) => sum + s.balance, 0);
  const revenue = summaries.filter(s => s.accountClass === AccountClass.REVENUE).reduce((sum, s) => sum + s.balance, 0);
  const expenses = summaries.filter(s => s.accountClass === AccountClass.EXPENSE).reduce((sum, s) => sum + s.balance, 0);
  
  const netIncome = revenue - expenses;
  const currentRatio = liabilities > 0 ? (assets / liabilities).toFixed(2) : 'N/A';

  const formatCurrency = (val: number) => {
    return val.toLocaleString(undefined, { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-medium text-slate-800">Executive Summary</h2>
        <p className="text-sm text-slate-400">Financial performance and liquidity health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Assets" value={formatCurrency(assets)} icon={<DollarSign size={18} />} color="indigo" />
        <StatCard title="Net Income" value={formatCurrency(netIncome)} icon={<TrendingUp size={18} />} color="emerald" />
        <StatCard title="Liabilities" value={formatCurrency(liabilities)} icon={<TrendingDown size={18} />} color="rose" />
        <StatCard title="Current Ratio" value={currentRatio} icon={<Activity size={18} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-medium text-slate-800">Financial Matrix</h3>
            <span className="text-[10px] text-slate-400 uppercase font-normal tracking-wider">Account Class Summary</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-left font-normal text-slate-500 uppercase text-[10px]">Classification</th>
                  <th className="px-6 py-3 text-right font-normal text-slate-500 uppercase text-[10px]">Total Debit</th>
                  <th className="px-6 py-3 text-right font-normal text-slate-500 uppercase text-[10px]">Total Credit</th>
                  <th className="px-6 py-3 text-right font-normal text-slate-500 uppercase text-[10px]">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[AccountClass.ASSET, AccountClass.LIABILITY, AccountClass.EQUITY, AccountClass.REVENUE, AccountClass.EXPENSE].map(cls => {
                  const s = summaries.filter(sum => sum.accountClass === cls);
                  const d = s.reduce((acc, val) => acc + val.totalDebit, 0);
                  const c = s.reduce((acc, val) => acc + val.totalCredit, 0);
                  const b = s.reduce((acc, val) => acc + val.balance, 0);
                  return (
                    <tr key={cls} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-normal text-slate-600">{cls}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{d.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-slate-500">{c.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-800">{b.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col">
          <h3 className="text-base font-medium text-slate-800 mb-6">Key Ratios</h3>
          <div className="space-y-4 flex-1">
            <KPIItem label="Operating Margin" value={`${revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) : 0}%`} />
            <KPIItem label="Debt-to-Equity" value={assets - liabilities > 0 ? (liabilities / (assets - liabilities)).toFixed(2) : '0.00'} />
            <KPIItem label="Asset Turnover" value={(revenue / (assets || 1)).toFixed(2)} />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-50 text-[10px] text-slate-400 italic">
            Computed from current posted ledger entries.
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <div className={`w-8 h-8 rounded-lg bg-${color}-50 text-${color}-500 flex items-center justify-center mb-4`}>
      {icon}
    </div>
    <div className="text-[11px] font-normal text-slate-400 uppercase tracking-wider mb-1">{title}</div>
    <div className="text-lg font-medium text-slate-800">{value}</div>
  </div>
);

const KPIItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100 flex justify-between items-center">
    <div className="text-[11px] font-normal text-slate-500 uppercase tracking-wide">{label}</div>
    <div className="text-base font-medium text-slate-800">{value}</div>
  </div>
);

export default Dashboard;
