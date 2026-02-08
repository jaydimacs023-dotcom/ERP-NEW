import React, { useMemo } from 'react';
import { TransactionSummary, AccountClass, JournalLine, ChartOfAccount } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, BarChart3, LineChart as LucideLineChart, Printer } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, AreaChart, Area
} from 'recharts';

interface DashboardProps {
  summaries: TransactionSummary[];
  currency?: string;
  lines: JournalLine[];
  accounts: ChartOfAccount[];
}

const Dashboard: React.FC<DashboardProps> = ({ summaries, currency = 'USD', lines, accounts }) => {
  const assets = summaries.filter(s => s.accountClass === AccountClass.ASSET).reduce((sum, s) => sum + s.balance, 0);
  const liabilities = summaries.filter(s => s.accountClass === AccountClass.LIABILITY).reduce((sum, s) => sum + s.balance, 0);
  const revenue = summaries.filter(s => s.accountClass === AccountClass.REVENUE).reduce((sum, s) => sum + s.balance, 0);
  const expenses = summaries.filter(s => s.accountClass === AccountClass.EXPENSE).reduce((sum, s) => sum + s.balance, 0);
  
  const netIncome = revenue - expenses;
  const currentRatio = liabilities > 0 ? (assets / liabilities).toFixed(2) : 'N/A';

  // Analytical Data for Charts
  const classDistributionData = [
    { name: 'Assets', value: Math.abs(assets), color: '#0d9488' }, // Teal
    { name: 'Liabilities', value: Math.abs(liabilities), color: '#f43f5e' }, // Rose
    { name: 'Equity', value: Math.abs(assets - liabilities), color: '#10b981' }, // Emerald
  ];

  // Simulated Time-Series Data for Trend analysis
  const trendData = [
    { month: 'Jan', revenue: revenue * 0.7, expense: expenses * 0.8 },
    { month: 'Feb', revenue: revenue * 0.8, expense: expenses * 0.85 },
    { month: 'Mar', revenue: revenue * 0.9, expense: expenses * 0.9 },
    { month: 'Apr', revenue: revenue * 1.0, expense: expenses * 1.0 },
  ];

  const formatCurrency = (val: number) => {
    // Explicitly handle symbols to avoid "PHP" glitch
    const symbol = currency === 'PHP' ? '\u20B1' : currency === 'USD' ? '$' : '';
    const formatted = Math.abs(val).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    return `${val < 0 ? '-' : ''}${symbol}${formatted}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Print Only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
         <h1 className="text-2xl font-black uppercase tracking-tight">Institutional Performance Briefing</h1>
         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
         </p>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Institutional Performance Console</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">Real-time analytical oversight and liquidity metrics.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="no-print flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
        >
          <Printer size={16} /> Print Briefing
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Gross Assets" value={formatCurrency(assets)} icon={<DollarSign size={18} />} color="teal" />
        <StatCard title="Net Income" value={formatCurrency(netIncome)} icon={<TrendingUp size={18} />} color="emerald" />
        <StatCard title="Liabilities" value={formatCurrency(liabilities)} icon={<TrendingDown size={18} />} color="rose" />
        <StatCard title="Current Ratio" value={currentRatio} icon={<Activity size={18} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytical Graph: Performance Trend */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Revenue vs Expense Trend</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Fiscal Year Performance Matrix</p>
            </div>
            <div className="p-2.5 bg-brand-light text-brand rounded-xl shadow-sm no-print">
              <BarChart3 size={18} />
            </div>
          </div>
          
          <div className="h-[350px] w-full min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  labelStyle={{ fontWeight: 900, fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" name="Gross Revenue" />
                <Area type="monotone" dataKey="expense" stroke="#e11d48" strokeWidth={4} fillOpacity={1} fill="url(#colorExp)" name="Op. Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col text-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-slate-100 no-print">
             <LucideLineChart size={100} />
          </div>
          <div className="relative z-10">
             <h3 className="text-base font-black tracking-tight mb-6">Asset Liquidity Mix</h3>
             <div className="h-[220px] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                  <BarChart data={classDistributionData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '12px', color: '#1e293b' }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={30}>
                       {classDistributionData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             
             <div className="space-y-4 mt-6">
                {classDistributionData.map((item, i) => (
                   <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.name}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-slate-900">{formatCurrency(item.value)}</span>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Balance Sheet Matrix</h3>
           <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] no-print">Aggregated GL Summary</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Classification</th>
                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Total Debit</th>
                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Total Credit</th>
                <th className="px-6 py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[AccountClass.ASSET, AccountClass.LIABILITY, AccountClass.EQUITY, AccountClass.REVENUE, AccountClass.EXPENSE].map(cls => {
                const s = summaries.filter(sum => sum.accountClass === cls);
                const d = s.reduce((acc, val) => acc + val.totalDebit, 0);
                const c = s.reduce((acc, val) => acc + val.totalCredit, 0);
                const b = s.reduce((acc, val) => acc + val.balance, 0);
                return (
                  <tr key={cls} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-black text-slate-600 uppercase tracking-tight">{cls}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">{d.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">{c.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono font-black text-slate-900">{b.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 group hover:border-brand transition-all">
    <div className={`w-10 h-10 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center mb-3 border border-${color}-100 transition-all group-hover:scale-110 no-print`}>
      {icon}
    </div>
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</div>
    <div className="text-xl font-black text-slate-900 tracking-tight">{value}</div>
  </div>
);

export default Dashboard;
