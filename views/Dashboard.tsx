
import React, { useMemo, useState } from 'react';
import { TransactionSummary, AccountClass, JournalLine, ChartOfAccount, User, Student, Sponsor, JournalEntry, Batch, BatchStatus, Qualification, Enrollment, Payment } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Activity, Banknote, FileClock, BarChart3, LineChart as LucideLineChart, Printer, Users, Calendar, AlertCircle, Layers, CheckCircle, Clock, Award, Handshake, UserRound } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, AreaChart, Area, PieChart, Pie
} from 'recharts';

interface DashboardProps {
  summaries: TransactionSummary[];
  currency?: string;
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  currentUser?: User;
  students?: Student[];
  sponsors?: Sponsor[];
  entries?: JournalEntry[];
  batches?: Batch[];
  qualifications?: Qualification[];
  enrollments?: Enrollment[];
  payments?: Payment[];
}

const ARDashboard: React.FC<DashboardProps> = ({ summaries, currency = 'USD', lines, accounts, students = [], sponsors = [], entries = [], batches = [], payments = [] }) => {
  const [dashboardMode, setDashboardMode] = useState<'sponsors' | 'students'>('sponsors');
  const activeContactType = dashboardMode === 'sponsors' ? 'SPONSOR' : 'STUDENT';

  const isFinalizedCollection = (payment: Payment) =>
    payment.status !== 'DRAFT' &&
    payment.status !== 'VOIDED' &&
    (
      payment.status === 'OPEN' ||
      payment.status === 'POSTED' ||
      payment.status === 'CLOSED' ||
      Boolean(payment.journalEntryId || payment.postedAt || payment.glEntryNumber)
    );

  const parseCollectionDate = (dateValue?: string) => {
    const raw = String(dateValue || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === 'USD' ? '$' : '\u20B1';
    const formatted = Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${val < 0 ? '-' : ''}${symbol}${formatted} `;
  };

  // Enterprise-grade Professional Palette (Blues, Teals, Muted Grays)
  const COLORS = [
    '#0EA5E9', // Sky 500
    '#2563EB', // Blue 600
    '#0F766E', // Teal 700
    '#F59E0B', // Amber 500
    '#64748B', // Slate 500
    '#6366F1', // Indigo 500
    '#10B981', // Emerald 500
    '#8B5CF6', // Violet 500
    '#F43F5E', // Rose 500
    '#94A3B8'  // Slate 400
  ];

  // 1. Total Collectibles (Outstanding AR)
  const arAccounts = accounts.filter(a => a.class === AccountClass.ASSET && a.name.toLowerCase().includes('receivable'));
  const totalCollectibles = summaries
    .filter(s => arAccounts.some(a => a.id === s.accountId))
    .reduce((sum, s) => sum + s.balance, 0);

  // 2. Receivables by Sponsor/Student
  const receivablesByCustomer = useMemo(() => {
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED').map(e => e.id));
    const arAccountIds = new Set(arAccounts.map(a => a.id));
    const balances: Record<string, number> = {};

    lines.filter(l => postedEntryIds.has(l.journalEntryId) && arAccountIds.has(l.accountId) && l.contactType === activeContactType && l.contactId).forEach(l => {
      balances[l.contactId!] = (balances[l.contactId!] || 0) + (l.debit - l.credit);
    });

    return Object.entries(balances)
      .map(([id, balance]) => ({
        name: activeContactType === 'SPONSOR'
          ? sponsors.find(s => s.id === id)?.name || 'Unknown Sponsor'
          : (() => {
              const student = students.find(s => s.id === id);
              return student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';
            })(),
        value: balance
      }))
      .filter(i => i.value > 1) // Filter out zero/negative balances or very small amounts
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  }, [lines, entries, sponsors, students, arAccounts, activeContactType]);

  const topCustomerTotal = receivablesByCustomer.reduce((sum, item) => sum + item.value, 0);

  // 3. AR Aging Summary
  const agingSummary = useMemo(() => {
    const postedEntryIds = new Set(entries.filter(e => e.status === 'POSTED').map(e => e.id));
    const arAccountIds = new Set(arAccounts.map(a => a.id));
    const today = new Date();

    let current = 0;
    let thirty = 0;
    let sixty = 0;
    let ninety = 0;
    let overNinety = 0;

    lines.filter(l => postedEntryIds.has(l.journalEntryId) && arAccountIds.has(l.accountId) && l.contactType === activeContactType).forEach(l => {
      const entry = entries.find(e => e.id === l.journalEntryId);
      if (!entry) return;

      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(today.getTime() - entryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const amount = l.debit - l.credit;

      if (diffDays <= 30) current += amount;
      else if (diffDays <= 60) thirty += amount;
      else if (diffDays <= 90) sixty += amount;
      else overNinety += amount; // Corrected logic: anything over 90 goes here
    });

    // 60-90 days bucket should be its own, currently > 90 is capturing everything else.
    // Wait, typical aging is 0-30, 31-60, 61-90, 90+.
    // My logic: <=30, <=60 (which includes <=30 if not checked first? No, if-else if handles it).
    // Correct.

    return [
      { name: 'Current', value: current, color: '#10B981' }, // Emerald
      { name: '1-30 Days', value: thirty, color: '#3B82F6' }, // Blue
      { name: '31-60 Days', value: sixty, color: '#F59E0B' }, // Amber
      { name: '> 60 Days', value: overNinety, color: '#EF4444' }, // Red
    ];
  }, [lines, entries, arAccounts, activeContactType]);

  // 4. Unbilled Batches Logic
  const unbilledBatches = useMemo(() => {
    // Candidates: Ongoing or Completed batches
    const candidates = batches.filter(b =>
      !b.isDeleted && (b.status === BatchStatus.ONGOING || b.status === BatchStatus.COMPLETED)
    );

    // Identify Invoiced Batches by looking for Batch Code in Invoice References/Descriptions
    // This is a heuristic since there isn't a direct hard-link yet.
    // Ideally, we'd check a link table, but for now we search strings.
    const invoicedBatchCodes = new Set<string>();

    const invoices = entries.filter(e => e.sourceType === 'INVOICE' && e.status !== 'REVERSED');

    invoices.forEach(inv => {
      const text = `${inv.reference} ${inv.description} `.toLowerCase();
      candidates.forEach(b => {
        if (b.batchCode && text.includes(b.batchCode.toLowerCase())) {
          invoicedBatchCodes.add(b.id);
        }
      });
    });

    return candidates
      .filter(b => dashboardMode === 'sponsors' ? Boolean(b.sponsorId) : (b.studentIds || []).length > 0)
      .filter(b => !invoicedBatchCodes.has(b.id));
  }, [batches, entries, dashboardMode]);

  // 5. Receivables by Income Source (using Revenue accounts from invoices)
  // This is tricky because AR lines don't map 1:1 to Revenue lines purely by account.
  // But we can approximate by looking at Revenue Account Balances.
  const revenueBySource = summaries
    .filter(s => s.accountClass === AccountClass.REVENUE)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
    .map(s => ({
      name: s.accountName,
      value: Math.abs(s.balance) // Revenue is normally Credit balance (negative in some systems, postive in others depending on signage. stored as abs usually in charts)
    }));

  // 6. Collections per Month (Bar Chart)
  const collectionsPerMonth = useMemo(() => {
    const today = new Date();
    const monthlyMap = new Map<string, number>();
    const months: any[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const year = String(d.getFullYear());
      monthlyMap.set(key, 0);
      months.push({ key, month, year, periodLabel: `${month} ${year}`, amount: 0 });
    }

    payments
      .filter(payment => !payment.isDeleted)
      .filter(isFinalizedCollection)
      .filter(payment => activeContactType === 'SPONSOR' ? Boolean(payment.sponsorId) : Boolean(payment.studentId))
      .forEach(payment => {
        (payment.applications || [])
          .filter(application => !application.isReversed)
          .forEach(application => {
            const d = parseCollectionDate(application.createdAt || payment.paymentDate);
            if (!d) return;
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (monthlyMap.has(key)) {
              monthlyMap.set(key, monthlyMap.get(key)! + Number(application.amountApplied || 0));
            }
          });
      });

    return months.map(m => ({
      month: m.month,
      year: m.year,
      periodLabel: m.periodLabel,
      amount: monthlyMap.get(m.key) || 0
    }));

  }, [payments, activeContactType]);

  const CollectionsMonthTick = ({ x = 0, y = 0, payload }: any) => {
    const [month, year] = String(payload?.value || '').split(' ');

    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="middle" fill="#64748B" fontSize={12} fontWeight={600}>
          <tspan x={0} dy={12}>{month}</tspan>
          <tspan x={0} dy={14} fill="#94A3B8" fontSize={10}>{year}</tspan>
        </text>
      </g>
    );
  };


  return (
    <div className="space-y-6 pb-10 font-sans">
      <header className="flex justify-between items-end border-b pb-4 border-gray-200">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tighter">
            Overview : {dashboardMode === 'sponsors' ? 'Billing and Collection' : 'Student Billing and Collection'}
          </h2>
          <p className="text-sm italic text-slate-500 font-medium mt-1">Specialist View &bull; {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">View</span>
          <button
            type="button"
            onClick={() => setDashboardMode('sponsors')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
              dashboardMode === 'sponsors' ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:bg-brand/10 hover:text-brand'
            }`}
          >
            <Handshake size={14} /> Sponsors
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('students')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
              dashboardMode === 'students' ? 'bg-brand text-white shadow-sm' : 'text-gray-500 hover:bg-brand/10 hover:text-brand'
            }`}
          >
            <UserRound size={14} /> Students
          </button>
        </div>
      </header>

      <div className="space-y-6">
        {/* Row 1: Receivables & Aging */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Receivables by Sponsor/Student Chart */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  Outstanding Receivables by {dashboardMode === 'sponsors' ? 'Sponsor' : 'Student'}
                </h3>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Total Outstanding</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCollectibles)}</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center h-full">
                {/* Left: Donut Chart */}
                <div className="w-full md:w-5/12 h-[260px] relative">
                  <div className="absolute inset-y-0 left-[40%] -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none z-0">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 10 Total</span>
                    <span className="text-xl font-bold text-gray-800 mt-0.5">{formatCurrency(topCustomerTotal)}</span>
                  </div>
                  <ResponsiveContainer width="99%" height={260}>
                    <PieChart>
                      <Pie
                        data={receivablesByCustomer}
                        cx="40%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {receivablesByCustomer.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Amount']}
                        contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '8px 12px' }}
                        itemStyle={{ color: '#1e293b', fontWeight: 600, fontSize: '13px' }}
                        labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Right: Detailed Customer List */}
                <div className="w-full md:w-7/12">
                  <div className="flex justify-between px-2 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
                    <span>Rank / {dashboardMode === 'sponsors' ? 'Sponsor' : 'Student'}</span>
                    <div className="text-right flex gap-8">
                      <span className="w-20">Amount</span>
                      <span className="w-10">% Total</span>
                    </div>
                  </div>
                  <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                    {receivablesByCustomer.map((item, index) => (
                      <div key={index} className="group flex justify-between items-center py-2.5 px-3 rounded-md hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {index + 1}
                          </span>
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-sm font-medium text-gray-700 truncate" title={item.name}>{item.name}</span>
                        </div>

                        <div className="flex gap-8 text-right flex-shrink-0">
                          <span className="text-sm font-semibold font-mono text-gray-900 w-20 block">{formatCurrency(item.value)}</span>
                          <span className="text-xs font-medium text-gray-500 w-10 block pt-0.5">{((item.value / totalCollectibles) * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            {/* AR Aging Summary */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileClock size={18} className="text-amber-500" /> Aging Summary
              </h3>
              <div className="space-y-4">
                {agingSummary.map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 font-medium">{item.name}</span>
                      <span className="font-bold text-gray-900">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${totalCollectibles > 0 ? (item.value / totalCollectibles) * 100 : 0}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Collections & Unbilled Batches */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Collections per Month Chart */}
          <div className="md:col-span-2">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Banknote size={20} className="text-emerald-500" /> Collections per Month
                </h3>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Total Collections</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(collectionsPerMonth.reduce((sum, item) => sum + item.amount, 0))}</p>
                </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="99%" height={250}>
                  <BarChart data={collectionsPerMonth} margin={{ top: 10, right: 10, left: 0, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="periodLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={<CollectionsMonthTick />}
                      height={42}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={(val) => `${currency === 'USD' ? '$' : '\u20B1'}${val / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Collected']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                      cursor={{ fill: '#F1F5F9' }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            {/* Unbilled Batches List */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full min-h-[300px]">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Layers size={18} className="text-[#F47721]" /> {dashboardMode === 'sponsors' ? 'Unbilled Batches' : 'Pending Student Billings'}
                </h3>
                <span className="bg-orange-100 text-[#F47721] text-xs font-bold px-2 py-0.5 rounded-full">{unbilledBatches.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                {unbilledBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <CheckCircle size={32} className="mb-2 text-emerald-100" />
                    <p className="text-xs font-medium uppercase tracking-wide">All batches billed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unbilledBatches.map(b => (
                      <div key={b.id} className="p-3 bg-gray-50 rounded border border-gray-100 hover:border-orange-200 transition-colors group">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-gray-700 group-hover:text-[#F47721] transition-colors">{b.batchCode}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${b.status === BatchStatus.ONGOING ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {b.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate mb-1" title={b.name}>{b.name}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">
                            {sponsors.find(s => s.id === b.sponsorId)?.name || 'Private / Unknown'}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                            <Users size={10} /> {b.currentStudents}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

const RegistrarDashboard: React.FC<DashboardProps> = ({ students = [], batches = [], qualifications = [], enrollments = [] }) => {
  // 1. Enrollment Distribution by Status (for simple stat Cards)
  const activeStudents = students.filter(s => !s.isDeleted).length;
  const activeBatches = batches.filter(b => b.status === BatchStatus.ONGOING).length;
  const plannedBatches = batches.filter(b => b.status === BatchStatus.PLANNED).length;
  const totalQualifications = qualifications.length;

  const pendingEnrollments = enrollments.filter(e => e.enrollmentStatus === 'ON_HOLD').length;

  const capacityUsage = useMemo(() => {
    const ongoingBatches = batches.filter(b => b.status === BatchStatus.ONGOING);
    const totalMax = ongoingBatches.reduce((sum, b) => sum + (b.maxStudents || 0), 0);
    const totalCurrent = ongoingBatches.reduce((sum, b) => sum + (b.currentStudents || 0), 0);
    return totalMax > 0 ? Math.round((totalCurrent / totalMax) * 100) : 0;
  }, [batches]);

  // 2. Batches by Status (Pie Chart)
  const batchesByStatus = useMemo(() => {
    const counts = {
      [BatchStatus.PLANNED]: 0,
      [BatchStatus.ONGOING]: 0,
      [BatchStatus.COMPLETED]: 0,
      [BatchStatus.CANCELLED]: 0
    };
    batches.forEach(b => {
      if (counts.hasOwnProperty(b.status)) {
        counts[b.status]++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [batches]);

  const STATUS_COLORS: Record<string, string> = {
    [BatchStatus.PLANNED]: '#F59E0B',   // Amber
    [BatchStatus.ONGOING]: '#3B82F6',   // Blue
    [BatchStatus.COMPLETED]: '#10B981', // Emerald
    [BatchStatus.CANCELLED]: '#EF4444'  // Rose
  };

  // 3. Batches by Qualification (Bar Chart)
  const batchesByQual = useMemo(() => {
    const qualMap: Record<string, number> = {};
    batches.forEach(b => {
      qualMap[b.qualificationId] = (qualMap[b.qualificationId] || 0) + 1;
    });

    return Object.entries(qualMap)
      .map(([id, count]) => ({
        name: qualifications.find(q => q.id === id)?.code || 'Unknown',
        fullName: qualifications.find(q => q.id === id)?.name || 'Unknown Qualification',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [batches, qualifications]);

  // 4. Monthly Enrollment Trends (Last 6 Months)
  const enrollmentTrends = useMemo(() => {
    const today = new Date();
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        count: 0,
        rawMonth: d.getMonth(),
        rawYear: d.getFullYear()
      });
    }

    students.forEach(s => {
      if (!s.createdAt) return;
      const d = new Date(s.createdAt);
      const match = months.find(m => m.rawMonth === d.getMonth() && m.rawYear === d.getFullYear());
      if (match) match.count++;
    });

    return months;
  }, [students]);

  return (
    <div className="space-y-6 pb-10 font-sans">
      <header className="flex justify-between items-end border-b pb-4 border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight text-orange-600">Operations Console : Registrar</h2>
          <p className="text-sm text-gray-500 mt-1">Registry Oversight &bull; {new Date().toLocaleDateString()}</p>
        </div>
      </header>

      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Learners" value={activeStudents.toLocaleString()} icon={<Users size={16} />} color="blue" />
        <StatCard title="Active Batches" value={activeBatches.toLocaleString()} icon={<Layers size={16} />} color="orange" />
        <StatCard title="Planned Batches" value={plannedBatches.toLocaleString()} icon={<Calendar size={16} />} color="amber" />
        <StatCard title="Qualifications" value={totalQualifications.toLocaleString()} icon={<Award size={16} />} color="indigo" />
        <StatCard title="Pending Enrollments" value={pendingEnrollments.toLocaleString()} icon={<Clock size={16} />} color="rose" />
        <StatCard title="Capacity Usage" value={`${capacityUsage}%`} icon={<Activity size={16} />} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollment Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" /> New Learner Registrations
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="99%" height={250}>
              <AreaChart data={enrollmentTrends}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="New Students" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Batch Status Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-orange-500" /> Training Batch Pipeline
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-[250px]">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="99%" height={250}>
                <PieChart>
                  <Pie
                    data={batchesByStatus}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {batchesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as string]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {batchesByStatus.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.name as string] }} />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Batches by Qualification */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <Award size={20} className="text-indigo-500" /> Program Distribution (Top 8)
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="99%" height={300}>
            <BarChart data={batchesByQual}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                formatter={(value, name, props) => [value, 'Batches']}
                labelFormatter={(value) => batchesByQual.find(b => b.name === value)?.fullName || value}
              />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={40}>
                {batchesByQual.map((entry, index) => (
                  <Cell key={`cell-${index}`} fillOpacity={0.8 - (index * 0.05)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { summaries, currency = 'USD', lines, accounts, currentUser } = props;

  // Conditional Render for AR Specialist
  if (currentUser?.role === 'AR_SPECIALIST') {
    return <ARDashboard {...props} />;
  }

  // Conditional Render for Registrar
  if (currentUser?.role === 'REGISTRAR') {
    return <RegistrarDashboard {...props} />;
  }

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
    return `${val < 0 ? '-' : ''}${symbol}${formatted} `;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div className="no-print">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
          <p className="text-sm text-gray-500 italic">Financial overview and key performance indicators</p>
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
            <ResponsiveContainer width="99%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#9CA3AF' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '4px', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '10px', fontFamily: '"Inter", "Open Sans", "Segoe UI", Arial, sans-serif' }}
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
              <ResponsiveContainer width="99%" height={200}>
                <BarChart data={classDistributionData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" hide />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '4px', color: '#1F2937', fontFamily: '"Inter", "Open Sans", "Segoe UI", Arial, sans-serif' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={30}>
                    {classDistributionData.map((entry, index) => (
                      <Cell key={`cell - ${index} `} fill={entry.color} />
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
    <div className={`w - 8 h - 8 rounded bg - ${color} -50 text - ${color} -600 flex items - center justify - center mb - 2 no - print`}>
      {icon}
    </div>
    <div className="text-xs text-gray-500 mb-1">{title}</div>
    <div className="text-lg font-semibold text-gray-900">{value}</div>
  </div>
);

export default Dashboard;

