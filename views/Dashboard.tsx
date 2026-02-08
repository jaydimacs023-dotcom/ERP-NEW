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
    { name: 'Assets', value: Math.abs(assets), color: '#2563EB' },
    { name: 'Liabilities', value: Math.abs(liabilities), color: '#DC2626' },
    { name: 'Equity', value: Math.abs(assets - liabilities), color: '#059669' },
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
    <div className="space-y-6 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div className="no-print">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
          <p className="text-sm text-gray-500">Financial overview and key performance indicators</p>
        </div>
        <button 
          onClick={handlePrint}
          className="no-print flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Printer size={14} /> Print
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Assets" value={formatCurrency(assets)} icon={<DollarSign size={16} />} color="blue" />
        <StatCard title="Net Income" value={formatCurrency(netIncome)} icon={<TrendingUp size={16} />} color="green" />
        <StatCard title="Liabilities" value={formatCurrency(liabilities)} icon={<TrendingDown size={16} />} color="red" />
        <StatCard title="Current Ratio" value={currentRatio} icon={<Activity size={16} />} color="amber" />
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block border-b-2 border-gray-800 pb-3">
         <h1 className="text-xl font-bold">Financial Performance Report</h1>
         <p className="text-xs text-gray-500 mt-1">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
         </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Expense Trend */}
        <div className="lg:col-span-2 bg-white rounded-md shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Revenue vs Expense Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Fiscal Year Performance</p>
            </div>
            <div className="p-1.5 bg-gray-50 text-gray-400 rounded no-print">
              <BarChart3 size={16} />
            </div>
          </div>
          
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#9CA3AF' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '4px', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '10px', fontFamily: "'Open Sans', sans-serif" }}
                  labelStyle={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '11px', fontWeight: 600 }} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="expense" stroke="#DC2626" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 text-gray-300 no-print">
             <LucideLineChart size={80} />
          </div>
          <div className="relative z-10">
             <h3 className="text-sm font-semibold text-gray-800 mb-4">Asset Distribution</h3>
             <div className="h-[200px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                  <BarChart data={classDistributionData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#1F2937', fontFamily: "'Open Sans', sans-serif" }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={30}>
                       {classDistributionData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
             
             <div className="space-y-3 mt-4">
                {classDistributionData.map((item, i) => (
                   <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                         <span className="text-xs text-gray-500">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800 font-mono">{formatCurrency(item.value)}</span>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-sm font-semibold text-gray-800">Balance Sheet Summary</h3>
           <span className="text-xs text-gray-400 no-print">Aggregated GL Summary</span>
        </div>
        <div className="overflow-hidden rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Classification</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total Debit</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Total Credit</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[AccountClass.ASSET, AccountClass.LIABILITY, AccountClass.EQUITY, AccountClass.REVENUE, AccountClass.EXPENSE].map(cls => {
                const s = summaries.filter(sum => sum.accountClass === cls);
                const d = s.reduce((acc, val) => acc + val.totalDebit, 0);
                const c = s.reduce((acc, val) => acc + val.totalCredit, 0);
                const b = s.reduce((acc, val) => acc + val.balance, 0);
                return (
                  <tr key={cls} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-gray-700">{cls}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{d.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-500">{c.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{b.toLocaleString()}</td>
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
  <div className="bg-white p-4 rounded-md shadow-sm border border-gray-200">
    <div className={`w-8 h-8 rounded bg-${color}-50 text-${color}-600 flex items-center justify-center mb-2 no-print`}>
      {icon}
    </div>
    <div className="text-xs text-gray-500 mb-1">{title}</div>
    <div className="text-lg font-semibold text-gray-900">{value}</div>
  </div>
);

export default Dashboard;
