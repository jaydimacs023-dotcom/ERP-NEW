import React, { useState, useMemo } from 'react';
import { 
  AccountingPeriod, PeriodStatus, Payable, JournalEntry, JournalEntryLine,
  ChartOfAccount, AccountClass
} from '../types';
import { AccountingService } from '../accountingService';
import EmptyState from '../components/EmptyState';
import {
  Calendar, Lock, Unlock, CheckCircle, AlertCircle, Clock,
  X, Plus, ChevronRight, FileText, BookOpen, RotateCcw,
  Shield, XCircle, CheckSquare, Square, ArrowRight, Zap,
  CalendarDays, CalendarRange, History, Activity, Filter
} from 'lucide-react';

interface PeriodClosingViewProps {
  orgId: string;
  periods: AccountingPeriod[];
  payables: Payable[];
  entries: JournalEntry[];
  lines: JournalEntryLine[];
  accounts: ChartOfAccount[];
  currentUserId?: string;
  onCreatePeriod: (period: AccountingPeriod) => void;
  onUpdatePeriod: (id: string, updates: Partial<AccountingPeriod>) => void;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalEntryLine[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const STATUS_CONFIG: Record<PeriodStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  OPEN: { label: 'Open', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: Unlock },
  SOFT_CLOSE: { label: 'Soft Close', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
  HARD_CLOSE: { label: 'Hard Close', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: Shield },
  LOCKED: { label: 'Locked', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: Lock },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PeriodClosingView: React.FC<PeriodClosingViewProps> = ({
  orgId,
  periods,
  payables,
  entries,
  lines,
  accounts,
  currentUserId,
  onCreatePeriod,
  onUpdatePeriod,
  onPostJournal,
  onNotify
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);
  const [showClosingWizard, setShowClosingWizard] = useState(false);
  const [showAccrualModal, setShowAccrualModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());

  // Form state for new period
  const [formData, setFormData] = useState({
    fiscalYear: new Date().getFullYear(),
    periodType: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    periodNumber: new Date().getMonth() + 1,
  });

  // Accrual form
  const [accrualData, setAccrualData] = useState({
    accountId: '',
    amount: 0,
    description: '',
    autoReverse: true,
  });

  // Filter periods by org and year
  const orgPeriods = useMemo(() => 
    periods.filter(p => p.orgId === orgId && p.fiscalYear === yearFilter && !p.isDeleted)
      .sort((a, b) => a.periodNumber - b.periodNumber),
    [periods, orgId, yearFilter]
  );

  const orgPayables = useMemo(() => 
    payables.filter(p => p.orgId === orgId && !p.isDeleted),
    [payables, orgId]
  );

  const orgEntries = useMemo(() => 
    entries.filter(e => e.orgId === orgId),
    [entries, orgId]
  );

  const expenseAccounts = useMemo(() => 
    accounts.filter(a => a.orgId === orgId && a.class === AccountClass.EXPENSE && !a.isHeader),
    [accounts, orgId]
  );

  const liabilityAccounts = useMemo(() => 
    accounts.filter(a => a.orgId === orgId && a.class === AccountClass.LIABILITY && !a.isHeader),
    [accounts, orgId]
  );

  // Get current open period
  const currentPeriod = useMemo(() => 
    orgPeriods.find(p => p.status === 'OPEN'),
    [orgPeriods]
  );

  // Available years for filter
  const availableYears = useMemo(() => {
    const years = new Set(periods.filter(p => p.orgId === orgId).map(p => p.fiscalYear));
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    years.add(currentYear + 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [periods, orgId]);

  // Period statistics
  const getPeriodStats = (period: AccountingPeriod) => {
    const periodPayables = orgPayables.filter(p => {
      const billDate = new Date(p.billDate);
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      return billDate >= startDate && billDate <= endDate;
    });

    const periodEntries = orgEntries.filter(e => {
      const entryDate = new Date(e.date);
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      return entryDate >= startDate && entryDate <= endDate;
    });

    const unpaidPayables = periodPayables.filter(p => p.status !== 'paid' && p.status !== 'cancelled');
    const unpostedPayables = periodPayables.filter(p => !p.journalEntryId && p.status !== 'cancelled');

    return {
      totalPayables: periodPayables.length,
      unpaidCount: unpaidPayables.length,
      unpaidAmount: unpaidPayables.reduce((sum, p) => sum + (p.netPayable || p.amount), 0),
      unpostedCount: unpostedPayables.length,
      journalCount: periodEntries.length,
      draftEntries: periodEntries.filter(e => e.status === 'DRAFT').length,
    };
  };

  // Closing checklist for selected period
  const getClosingChecklist = (period: AccountingPeriod) => {
    const stats = getPeriodStats(period);
    return [
      {
        id: 'unposted',
        label: 'All AP invoices posted to GL',
        description: `${stats.unpostedCount} unposted invoices remaining`,
        isComplete: stats.unpostedCount === 0,
        canClose: stats.unpostedCount === 0,
      },
      {
        id: 'drafts',
        label: 'No draft journal entries',
        description: `${stats.draftEntries} draft entries remaining`,
        isComplete: stats.draftEntries === 0,
        canClose: stats.draftEntries === 0,
      },
      {
        id: 'ap_review',
        label: 'AP aging reviewed',
        description: 'Review and verify all outstanding payables',
        isComplete: period.apClosed,
        canClose: true,
      },
      {
        id: 'accruals',
        label: 'Accruals posted',
        description: 'Post month-end accrual entries',
        isComplete: period.apClosed,
        canClose: true,
      },
      {
        id: 'reconciled',
        label: 'Bank accounts reconciled',
        description: 'Complete bank reconciliation for all accounts',
        isComplete: period.apClosed && period.arClosed,
        canClose: true,
      },
    ];
  };

  // Generate period dates
  const generatePeriodDates = (year: number, type: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL', periodNum: number) => {
    if (type === 'MONTHLY') {
      const startDate = new Date(year, periodNum - 1, 1);
      const endDate = new Date(year, periodNum, 0);
      return {
        name: `${MONTHS[periodNum - 1]} ${year}`,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      };
    } else if (type === 'QUARTERLY') {
      const startMonth = (periodNum - 1) * 3;
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, startMonth + 3, 0);
      return {
        name: `Q${periodNum} ${year}`,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      };
    } else {
      return {
        name: `FY ${year}`,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }
  };

  // Handle create period
  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    
    const existing = orgPeriods.find(p => 
      p.fiscalYear === formData.fiscalYear && 
      p.periodType === formData.periodType && 
      p.periodNumber === formData.periodNumber
    );
    
    if (existing) {
      onNotify('error', 'This period already exists.');
      return;
    }

    const dates = generatePeriodDates(formData.fiscalYear, formData.periodType, formData.periodNumber);

    const newPeriod: AccountingPeriod = {
      id: `period-${Date.now()}`,
      orgId,
      name: dates.name,
      periodType: formData.periodType,
      fiscalYear: formData.fiscalYear,
      periodNumber: formData.periodNumber,
      startDate: dates.startDate,
      endDate: dates.endDate,
      status: 'OPEN',
      apClosed: false,
      arClosed: false,
      glClosed: false,
      createdAt: new Date().toISOString(),
    };

    onCreatePeriod(newPeriod);
    onNotify('success', `Period ${dates.name} created successfully.`);
    setShowCreateModal(false);
  };

  // Handle AP closing
  const handleCloseAP = () => {
    if (!selectedPeriod) return;
    
    onUpdatePeriod(selectedPeriod.id, {
      apClosed: true,
      apClosedBy: currentUserId,
      apClosedAt: new Date().toISOString(),
    });
    onNotify('success', 'AP module closed for this period.');
  };

  // Handle period soft close
  const handleSoftClose = () => {
    if (!selectedPeriod) return;
    
    const checklist = getClosingChecklist(selectedPeriod);
    const blockingItems = checklist.filter(c => !c.isComplete && !c.canClose);
    
    if (blockingItems.length > 0) {
      onNotify('error', 'Cannot soft close. Please complete all required items.');
      return;
    }

    onUpdatePeriod(selectedPeriod.id, {
      status: 'SOFT_CLOSE',
      apClosed: true,
      apClosedBy: currentUserId,
      apClosedAt: new Date().toISOString(),
      arClosed: true,
      arClosedBy: currentUserId,
      arClosedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onNotify('success', 'Period soft closed. Adjusting entries still allowed.');
  };

  // Handle hard close
  const handleHardClose = () => {
    if (!selectedPeriod) return;
    
    if (selectedPeriod.status !== 'SOFT_CLOSE') {
      onNotify('error', 'Period must be soft closed first.');
      return;
    }

    onUpdatePeriod(selectedPeriod.id, {
      status: 'HARD_CLOSE',
      glClosed: true,
      glClosedBy: currentUserId,
      glClosedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onNotify('success', 'Period hard closed. No more entries allowed.');
  };

  // Handle lock
  const handleLockPeriod = () => {
    if (!selectedPeriod) return;
    
    if (selectedPeriod.status !== 'HARD_CLOSE') {
      onNotify('error', 'Period must be hard closed before locking.');
      return;
    }

    onUpdatePeriod(selectedPeriod.id, {
      status: 'LOCKED',
      lockedBy: currentUserId,
      lockedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onNotify('success', 'Period locked permanently.');
  };

  // Handle reopen (only from SOFT_CLOSE or HARD_CLOSE, not LOCKED)
  const handleReopenPeriod = () => {
    if (!selectedPeriod) return;
    
    if (selectedPeriod.status === 'LOCKED') {
      onNotify('error', 'Cannot reopen a locked period.');
      return;
    }

    onUpdatePeriod(selectedPeriod.id, {
      status: 'OPEN',
      apClosed: false,
      arClosed: false,
      glClosed: false,
      updatedAt: new Date().toISOString(),
    });
    onNotify('success', 'Period reopened.');
  };

  // Handle post accrual
  const handlePostAccrual = () => {
    if (!selectedPeriod || !onPostJournal) return;
    
    if (!accrualData.accountId || !accrualData.amount) {
      onNotify('error', 'Please fill all required fields.');
      return;
    }

    const expenseAccount = accounts.find(a => a.id === accrualData.accountId);
    const accrualAccount = liabilityAccounts.find(a => 
      a.name.toLowerCase().includes('accrued') || 
      a.name.toLowerCase().includes('accrual')
    ) || liabilityAccounts[0];

    if (!accrualAccount) {
      onNotify('error', 'Accrued liability account not found.');
      return;
    }

    const accrualLines: JournalEntryLine[] = [
      {
        id: `jl-${Date.now()}-1`,
        journalEntryId: '',
        accountId: accrualData.accountId,
        description: accrualData.description,
        debit: accrualData.amount,
        credit: 0,
      },
      {
        id: `jl-${Date.now()}-2`,
        journalEntryId: '',
        accountId: accrualAccount.id,
        description: `Accrual: ${accrualData.description}`,
        debit: 0,
        credit: accrualData.amount,
      },
    ];

    const accrualEntry: Partial<JournalEntry> = {
      orgId,
      periodId: selectedPeriod.id,
      date: selectedPeriod.endDate,
      reference: AccountingService.getNextReference(orgEntries, 'ACC'),
      description: `Accrual: ${accrualData.description}`,
      sourceType: 'ACCRUAL',
      status: 'POSTED',
    };

    onPostJournal(accrualEntry, accrualLines);

    // If auto-reverse, create reversal for next period
    if (accrualData.autoReverse) {
      const nextPeriod = orgPeriods.find(p => 
        p.periodNumber === selectedPeriod.periodNumber + 1 ||
        (selectedPeriod.periodNumber === 12 && p.periodNumber === 1 && p.fiscalYear === selectedPeriod.fiscalYear + 1)
      );

      if (nextPeriod) {
        const reversalLines: JournalEntryLine[] = [
          {
            id: `jl-${Date.now()}-3`,
            journalEntryId: '',
            accountId: accrualAccount.id,
            description: `Reversal: ${accrualData.description}`,
            debit: accrualData.amount,
            credit: 0,
          },
          {
            id: `jl-${Date.now()}-4`,
            journalEntryId: '',
            accountId: accrualData.accountId,
            description: `Reversal: ${accrualData.description}`,
            debit: 0,
            credit: accrualData.amount,
          },
        ];

        const reversalEntry: Partial<JournalEntry> = {
          orgId,
          periodId: nextPeriod.id,
          date: nextPeriod.startDate,
          reference: AccountingService.getNextReference(orgEntries, 'REV'),
          description: `Reversal: ${accrualData.description}`,
          sourceType: 'REVERSAL',
          status: 'POSTED',
        };

        onPostJournal(reversalEntry, reversalLines);
        onNotify('success', 'Accrual posted with auto-reversal scheduled.');
      } else {
        onNotify('success', 'Accrual posted. Create next period to schedule reversal.');
      }
    } else {
      onNotify('success', 'Accrual posted successfully.');
    }

    setShowAccrualModal(false);
    setAccrualData({ accountId: '', amount: 0, description: '', autoReverse: true });
  };

  // Generate all periods for a year
  const handleGenerateYear = () => {
    const year = formData.fiscalYear;
    let created = 0;
    
    for (let month = 1; month <= 12; month++) {
      const existing = orgPeriods.find(p => 
        p.fiscalYear === year && 
        p.periodType === 'MONTHLY' && 
        p.periodNumber === month
      );
      
      if (!existing) {
        const dates = generatePeriodDates(year, 'MONTHLY', month);
        const newPeriod: AccountingPeriod = {
          id: `period-${Date.now()}-${month}`,
          orgId,
          name: dates.name,
          periodType: 'MONTHLY',
          fiscalYear: year,
          periodNumber: month,
          startDate: dates.startDate,
          endDate: dates.endDate,
          status: 'OPEN',
          apClosed: false,
          arClosed: false,
          glClosed: false,
          createdAt: new Date().toISOString(),
        };
        onCreatePeriod(newPeriod);
        created++;
      }
    }
    
    onNotify('success', `Created ${created} periods for ${year}.`);
    setShowCreateModal(false);
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <CalendarRange className="text-indigo-600" size={28} />
            Period Closing & Cutoff
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage accounting periods, AP closing, accruals, and period locking.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-white rounded-xl border px-3 py-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={yearFilter}
              onChange={e => setYearFilter(Number(e.target.value))}
              className="outline-none text-sm font-medium text-slate-700 bg-transparent"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium text-sm"
          >
            <Plus size={18} /> New Period
          </button>
        </div>
      </div>

      {/* Current Period Card */}
      {currentPeriod && (
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Current Open Period</p>
              <p className="text-3xl font-black mt-1">{currentPeriod.name}</p>
              <p className="text-sm text-indigo-200 mt-1">
                {currentPeriod.startDate} — {currentPeriod.endDate}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setSelectedPeriod(currentPeriod); setShowAccrualModal(true); }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Post Accrual
              </button>
              <button
                onClick={() => { setSelectedPeriod(currentPeriod); setShowClosingWizard(true); }}
                className="px-4 py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Lock size={16} /> Close Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Periods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orgPeriods.length > 0 ? (
          orgPeriods.map(period => {
            const stats = getPeriodStats(period);
            const statusConfig = STATUS_CONFIG[period.status];
            const StatusIcon = statusConfig.icon;
            
            return (
              <div 
                key={period.id}
                className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                  selectedPeriod?.id === period.id ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => setSelectedPeriod(period)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800">{period.name}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                    <StatusIcon size={12} />
                    {statusConfig.label}
                  </span>
                </div>
                
                <p className="text-xs text-slate-400 mb-3">
                  {period.startDate} — {period.endDate}
                </p>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400 font-medium">Invoices</p>
                    <p className="font-bold text-slate-700">{stats.totalPayables}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400 font-medium">Journals</p>
                    <p className="font-bold text-slate-700">{stats.journalCount}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-amber-600 font-medium">Unpaid</p>
                    <p className="font-bold text-amber-700">{stats.unpaidCount}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2">
                    <p className="text-rose-600 font-medium">Unposted</p>
                    <p className="font-bold text-rose-700">{stats.unpostedCount}</p>
                  </div>
                </div>

                {/* Closing Status */}
                <div className="mt-3 flex gap-2">
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${period.apClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    AP {period.apClosed ? '✓' : '○'}
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${period.arClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    AR {period.arClosed ? '✓' : '○'}
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${period.glClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    GL {period.glClosed ? '✓' : '○'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16">
            <EmptyState 
              icon={<CalendarDays className="text-slate-300" size={48} />}
              title="No periods for this year"
              description="Create accounting periods to track and close your financial activities."
            />
          </div>
        )}
      </div>

      {/* Create Period Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                  <Calendar size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Create Accounting Period</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Fiscal Year</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                  value={formData.fiscalYear}
                  onChange={e => setFormData({...formData, fiscalYear: Number(e.target.value)})}
                >
                  {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Period Type</label>
                <div className="flex gap-2">
                  {(['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, periodType: type, periodNumber: type === 'ANNUAL' ? 1 : formData.periodNumber})}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                        formData.periodType === type
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {formData.periodType === 'MONTHLY' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Month</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.periodNumber}
                    onChange={e => setFormData({...formData, periodNumber: Number(e.target.value)})}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.periodType === 'QUARTERLY' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Quarter</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.periodNumber}
                    onChange={e => setFormData({...formData, periodNumber: Number(e.target.value)})}
                  >
                    <option value={1}>Q1 (Jan-Mar)</option>
                    <option value={2}>Q2 (Apr-Jun)</option>
                    <option value={3}>Q3 (Jul-Sep)</option>
                    <option value={4}>Q4 (Oct-Dec)</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleGenerateYear}
                  className="flex-1 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors"
                >
                  Generate Year
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closing Wizard Modal */}
      {showClosingWizard && selectedPeriod && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl shadow-md">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Close Period</h3>
                  <p className="text-xs text-slate-500">{selectedPeriod.name}</p>
                </div>
              </div>
              <button onClick={() => setShowClosingWizard(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Checklist */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Closing Checklist</p>
                {getClosingChecklist(selectedPeriod).map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${item.isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    {item.isComplete ? (
                      <CheckSquare className="text-emerald-600" size={18} />
                    ) : (
                      <Square className="text-amber-500" size={18} />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${item.isComplete ? 'text-emerald-700' : 'text-amber-700'}`}>{item.label}</p>
                      <p className={`text-xs ${item.isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Current Status */}
              <div className="bg-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Current Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase rounded-full ${STATUS_CONFIG[selectedPeriod.status].bgColor} ${STATUS_CONFIG[selectedPeriod.status].color}`}>
                    {STATUS_CONFIG[selectedPeriod.status].label}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4">
                {selectedPeriod.status === 'OPEN' && (
                  <>
                    {!selectedPeriod.apClosed && (
                      <button
                        onClick={handleCloseAP}
                        className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16} /> Close AP Module
                      </button>
                    )}
                    <button
                      onClick={handleSoftClose}
                      className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Shield size={16} /> Soft Close Period
                    </button>
                  </>
                )}
                
                {selectedPeriod.status === 'SOFT_CLOSE' && (
                  <>
                    <button
                      onClick={handleHardClose}
                      className="w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Lock size={16} /> Hard Close Period
                    </button>
                    <button
                      onClick={handleReopenPeriod}
                      className="w-full py-3 border-2 border-slate-300 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Unlock size={16} /> Reopen Period
                    </button>
                  </>
                )}

                {selectedPeriod.status === 'HARD_CLOSE' && (
                  <>
                    <button
                      onClick={handleLockPeriod}
                      className="w-full py-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Lock size={16} /> Lock Period Permanently
                    </button>
                    <button
                      onClick={handleReopenPeriod}
                      className="w-full py-3 border-2 border-slate-300 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Unlock size={16} /> Reopen Period
                    </button>
                  </>
                )}

                {selectedPeriod.status === 'LOCKED' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                    <Lock className="mx-auto text-rose-500 mb-2" size={24} />
                    <p className="text-sm font-semibold text-rose-700">This period is permanently locked</p>
                    <p className="text-xs text-rose-600 mt-1">No changes are allowed</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accrual Modal */}
      {showAccrualModal && selectedPeriod && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Post Accrual Entry</h3>
                  <p className="text-xs text-slate-500">{selectedPeriod.name}</p>
                </div>
              </div>
              <button onClick={() => setShowAccrualModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Expense Account *</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                  value={accrualData.accountId}
                  onChange={e => setAccrualData({...accrualData, accountId: e.target.value})}
                >
                  <option value="">Select Expense Account...</option>
                  {expenseAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Amount *</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                  value={accrualData.amount || ''}
                  onChange={e => setAccrualData({...accrualData, amount: parseFloat(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Description *</label>
                <input 
                  type="text"
                  placeholder="e.g., Accrued utilities expense"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                  value={accrualData.description}
                  onChange={e => setAccrualData({...accrualData, description: e.target.value})}
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-100">
                <input 
                  type="checkbox"
                  id="autoReverse"
                  checked={accrualData.autoReverse}
                  onChange={e => setAccrualData({...accrualData, autoReverse: e.target.checked})}
                  className="w-4 h-4 accent-violet-600"
                />
                <label htmlFor="autoReverse" className="text-sm text-violet-700">
                  <span className="font-semibold">Auto-reverse in next period</span>
                  <p className="text-xs text-violet-600">Creates reversal entry on the first day of next period</p>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAccrualModal(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePostAccrual}
                  className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-100 flex items-center justify-center gap-2"
                >
                  <BookOpen size={16} /> Post Accrual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodClosingView;
