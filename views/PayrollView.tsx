
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, PayrollRun, PayrollLine, ChartOfAccount, BankAccount, JournalEntry, JournalLine, PayFrequency, OvertimeType } from '../types';
import { AccountingService } from '../accountingService';
import { TaxBracketService } from '../services/TaxBracketService';
import { ContributionService } from '../services/ContributionService';
import { PayrollCalculationService } from '../services/PayrollCalculationService';
import ModalPortal from '../components/ModalPortal';
import {
   Search, Calendar, X, Play,
   ShieldCheck, Calculator, AlertCircle, TrendingUp,
   Briefcase, Landmark, History, Printer, Info,
   CheckCircle2, Eye, FileText, Download, Building2,
   Receipt, ChevronDown, RotateCcw, CheckSquare
} from 'lucide-react';

interface PayrollViewProps {
   employees: Employee[];
   payrollRuns: PayrollRun[];
   payrollLines: PayrollLine[];
   accounts: ChartOfAccount[];
   bankAccounts: BankAccount[];
   entries: JournalEntry[];
   orgName?: string;
   onPostPayroll: (run: Partial<PayrollRun>, lines: Partial<PayrollLine>[], entry: Partial<JournalEntry>, entryLines: JournalLine[]) => void;
   orgId: string;
}

const formatRegistryDate = (value?: string) => {
   if (!value) return '-';

   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return value;

   return new Intl.DateTimeFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
   }).format(date);
};

const getTodayDateValue = () => {
   const now = new Date();
   const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
   return local.toISOString().slice(0, 10);
};

const PayrollView: React.FC<PayrollViewProps> = ({
   employees, payrollRuns, payrollLines, accounts, bankAccounts, entries, orgName = "AccounTech ERP", onPostPayroll,
   orgId
}) => {
   const [showModal, setShowModal] = useState(false);
   const [viewingRunId, setViewingRunId] = useState<string | null>(null);
   const [viewingPaystub, setViewingPaystub] = useState<{ run: PayrollRun, line: PayrollLine } | null>(null);
   const [historySearchTerm, setHistorySearchTerm] = useState('');
   const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | PayrollRun['status']>('ALL');
   const [historyDateFrom, setHistoryDateFrom] = useState('');
   const [historyDateTo, setHistoryDateTo] = useState('');
   const [historyDateFilterMode, setHistoryDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
   const [showHistoryDateDropdown, setShowHistoryDateDropdown] = useState(false);

   const [periodStart, setPeriodStart] = useState('');
   const [periodEnd, setPeriodEnd] = useState('');
   const [bankId, setBankId] = useState('');
   const [payrollRef, setPayrollRef] = useState('');

   // Selection state for employees in the current run
   const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(employees.filter(e => e.isActive).map(e => e.id));
   const [adjustments, setAdjustments] = useState<Record<string, { ot: number, other: number }>>({});

   // Generate next PR reference
   useEffect(() => {
      if (showModal) {
         setPayrollRef(AccountingService.getNextReference(entries, 'PR'));
      }
   }, [showModal, entries]);

   const activeEmployees = useMemo(() => employees.filter(e => selectedEmpIds.includes(e.id)), [employees, selectedEmpIds]);

   const currentRunSummary = useMemo(() => {
      let gross = 0;
      let depr = 0;
      let net = 0;

      const lines = activeEmployees.map(emp => {
         const basic = emp.basicSalary;
         const adj = adjustments[emp.id] || { ot: 0, other: 0, otHours: 0, otType: 'REGULAR_OT' as OvertimeType };

         // Calculate daily and hourly rates using PayrollCalculationService
         const dailyRate = PayrollCalculationService.calculateDailyRate(basic);
         const hourlyRate = PayrollCalculationService.calculateHourlyRate(dailyRate);

         // Calculate overtime pay using DOLE-mandated rates
         let overtimePay = adj.ot; // Use direct amount if provided
         if ((adj as any).otHours && (adj as any).otHours > 0) {
            const otResult = PayrollCalculationService.calculateOvertimePay(
               hourlyRate,
               (adj as any).otHours,
               (adj as any).otType || 'REGULAR_OT'
            );
            overtimePay = otResult.amount;
         }

         const empGross = basic + overtimePay + adj.other;

         // Statutory deductions using 2024 contribution tables
         const contributions = ContributionService.calculateAllContributions(empGross);
         const sss = contributions.sssEmployeeShare;
         const ph = contributions.philHealthEmployeeShare;
         const pi = contributions.pagIBIGEmployeeShare;

         // BIR withholding tax using configurable brackets
         // Default: Monthly pay frequency with BIR 2024 tax table
         const payFrequency: PayFrequency = 'MONTHLY';
         const taxResult = TaxBracketService.calculateWithDefault(empGross, payFrequency);
         const tax = taxResult.totalWithholdingTax;

         const empDeductions = sss + ph + pi + tax;
         const empNet = empGross - empDeductions;

         gross += empGross;
         depr += empDeductions;
         net += empNet;

         return { emp, empGross, empDeductions, empNet, sss, ph, pi, tax, overtimePay, dailyRate, hourlyRate };
      });

      return { lines, gross, depr, net };
   }, [activeEmployees, adjustments]);

   const filteredPayrollRuns = useMemo(() => {
      const normalizedSearch = historySearchTerm.trim().toLowerCase();
      const todayValue = getTodayDateValue();
      const currentMonthValue = todayValue.slice(0, 7);

      return payrollRuns
         .filter(run => {
            const employeeSearchText = payrollLines
               .filter(line => line.payrollRunId === run.id)
               .map(line => {
                  const employee = employees.find(e => e.id === line.employeeId);
                  return `${employee?.firstName || ''} ${employee?.lastName || ''} ${employee?.designation || ''}`;
               })
               .join(' ')
               .toLowerCase();

            const searchableText = [
               run.id,
               run.periodStart,
               run.periodEnd,
               run.status,
               run.createdAt,
               employeeSearchText,
            ].join(' ').toLowerCase();

            const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
            const matchesStatus = historyStatusFilter === 'ALL' || run.status === historyStatusFilter;

            const runDateValue = (run.periodEnd || run.createdAt || '').slice(0, 10);
            let matchesDate = true;
            if (historyDateFilterMode === 'TODAY') {
               matchesDate = runDateValue === todayValue;
            } else if (historyDateFilterMode === 'THIS_MONTH') {
               matchesDate = runDateValue.slice(0, 7) === currentMonthValue;
            } else if (historyDateFilterMode === 'CUSTOM') {
               matchesDate =
                  (!historyDateFrom || runDateValue >= historyDateFrom) &&
                  (!historyDateTo || runDateValue <= historyDateTo);
            }

            return matchesSearch && matchesStatus && matchesDate;
         })
         .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''));
   }, [payrollRuns, payrollLines, employees, historySearchTerm, historyStatusFilter, historyDateFilterMode, historyDateFrom, historyDateTo]);

   const hasActiveHistoryFilters =
      historySearchTerm.trim() !== '' ||
      historyStatusFilter !== 'ALL' ||
      historyDateFilterMode !== 'ALL' ||
      !!historyDateFrom ||
      !!historyDateTo;

   const handlePostRun = (e: React.FormEvent) => {
      e.preventDefault();
      if (!periodStart || !periodEnd || !bankId) return;

      const runId = `pr-${Date.now()}`;
      const bank = bankAccounts.find(b => b.id === bankId);

      const salariesExpId = accounts.find(a => a.name.includes('Salaries'))?.id;
      const taxPayId = accounts.find(a => a.name.includes('Accrued Payroll'))?.id;

      if (!salariesExpId || !bank) return;

      const newRun: Partial<PayrollRun> = {
         id: runId,
         periodStart,
         periodEnd,
         status: 'POSTED',
         totalGross: currentRunSummary.gross,
         totalDeductions: currentRunSummary.depr,
         totalNet: currentRunSummary.net,
         createdAt: new Date().toISOString()
      };

      const newLines: Partial<PayrollLine>[] = currentRunSummary.lines.map(l => ({
         id: `pl-${Math.random().toString(36).slice(-6)}`,
         payrollRunId: runId,
         employeeId: l.emp.id,
         grossPay: l.empGross,
         netPay: l.empNet,
         deductions: { tax: l.tax, sss: l.sss, philhealth: l.ph, pagibig: l.pi, other: 0 }
      }));

      const entryId = `je-pr-${Date.now()}`;
      const journalLines: JournalLine[] = [
         { id: `l1-${entryId}`, journalEntryId: entryId, orgId, accountId: salariesExpId, debit: currentRunSummary.gross, credit: 0, memo: `Gross Payroll: ${periodStart} to ${periodEnd}` },
         { id: `l2-${entryId}`, journalEntryId: entryId, orgId, accountId: bank.glAccountId, debit: 0, credit: currentRunSummary.net, memo: `Net Disbursement: ${periodStart} to ${periodEnd}` },
         { id: `l3-${entryId}`, journalEntryId: entryId, orgId, accountId: taxPayId || '', debit: 0, credit: currentRunSummary.depr, memo: `Payroll Deductions: ${periodStart} to ${periodEnd}` }
      ].filter(l => l.accountId !== '');

      onPostPayroll(newRun, newLines, {
         id: entryId,
         date: new Date().toISOString().split('T')[0],
         reference: payrollRef,
         description: `Payroll Run: ${periodStart} to ${periodEnd}`,
         sourceType: 'PAYROLL',
         status: 'POSTED'
      }, journalLines);

      setShowModal(false);
   };

   const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

   const getRunStatusBadge = (status: PayrollRun['status']) => {
      if (status === 'POSTED') {
         return (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-xs font-semibold text-brand border border-brand-light">
               Posted
            </span>
         );
      }

      return (
         <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
            Draft
         </span>
      );
   };

   const viewingRun = useMemo(() => payrollRuns.find(r => r.id === viewingRunId), [payrollRuns, viewingRunId]);
   const viewingLines = useMemo(() => payrollLines.filter(l => l.payrollRunId === viewingRunId), [payrollLines, viewingRunId]);

   return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
         <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
               <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Payroll Processing Console</h2>
               <p className="text-sm text-gray-500 font-normal italic">Automated salary disbursement and statutory liability recognition.</p>
            </div>
            <button
               onClick={() => setShowModal(true)}
               className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-xs"
            >
               <Play size={16} fill="currentColor" /> Initiate Payroll Run
            </button>
         </header>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatWidget label="Headcount" value={employees.filter(e => e.isActive).length.toString()} icon={<Briefcase size={18} />} color="brand" />
            <StatWidget label="Total Gross (YTD)" value={formatCurrency(payrollRuns.reduce((s, r) => s + r.totalGross, 0))} icon={<TrendingUp size={18} />} color="emerald" />
            <StatWidget label="Active Benefits" value="4" icon={<ShieldCheck size={18} />} color="brand" />
            <StatWidget label="Next Pay Cycle" value="30 Jun 2024" icon={<Calendar size={18} />} color="amber" />
         </div>

         <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-brand/10 text-brand border border-brand-light rounded"><History size={18} /></div>
               <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Recent Payroll History</h3>
            </div>

            <div className="bg-white border-y px-4 py-2">
               <div className="flex flex-wrap items-center gap-3">
                  <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
                     <Search size={14} className="text-gray-400 mr-2" />
                     <input
                        type="text"
                        placeholder="Search payroll runs..."
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                     />
                  </div>

                  <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
                     <span className="text-[13px] text-gray-500 mr-1">Status:</span>
                     <select
                        value={historyStatusFilter}
                        onChange={(e) => setHistoryStatusFilter(e.target.value as 'ALL' | PayrollRun['status'])}
                        className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
                     >
                        <option value="ALL">All</option>
                        <option value="DRAFT">Draft</option>
                        <option value="POSTED">Posted</option>
                     </select>
                     <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                  </div>

                  <div className="relative">
                     <div
                        onClick={() => setShowHistoryDateDropdown(!showHistoryDateDropdown)}
                        className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                     >
                        <span className="text-[13px] text-gray-500 mr-1">Date:</span>
                        <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                           {historyDateFilterMode === 'ALL' ? 'All' : historyDateFilterMode === 'TODAY' ? 'Today' : historyDateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
                        </span>
                        <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                     </div>

                     {showHistoryDateDropdown && (
                        <>
                           <div className="fixed inset-0 z-40" onClick={() => setShowHistoryDateDropdown(false)}></div>
                           <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                              <div className="p-1">
                                 <button
                                    onClick={() => { setHistoryDateFilterMode('ALL'); setHistoryDateFrom(''); setHistoryDateTo(''); setShowHistoryDateDropdown(false); }}
                                    className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                                 >
                                    Remove Quick Filter
                                 </button>
                              </div>

                              <div className="border-t border-gray-100 p-1">
                                 <button
                                    onClick={() => setHistoryDateFilterMode('CUSTOM')}
                                    className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${historyDateFilterMode === 'CUSTOM' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                                 >
                                    {historyDateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                                 </button>
                                 <button
                                    onClick={() => { setHistoryDateFilterMode('TODAY'); setShowHistoryDateDropdown(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${historyDateFilterMode === 'TODAY' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                                 >
                                    {historyDateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                                 </button>
                                 <button
                                    onClick={() => { setHistoryDateFilterMode('THIS_MONTH'); setShowHistoryDateDropdown(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${historyDateFilterMode === 'THIS_MONTH' ? 'font-bold text-brand bg-brand/10' : 'text-gray-700 hover:bg-gray-100'}`}
                                 >
                                    {historyDateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                                 </button>
                              </div>

                              <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                                 <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                                    <input
                                       type="date"
                                       value={historyDateFrom}
                                       onChange={(e) => { setHistoryDateFrom(e.target.value); if (historyDateFilterMode !== 'CUSTOM') setHistoryDateFilterMode('CUSTOM'); }}
                                       className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                                    />
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                                    <input
                                       type="date"
                                       value={historyDateTo}
                                       onChange={(e) => { setHistoryDateTo(e.target.value); if (historyDateFilterMode !== 'CUSTOM') setHistoryDateFilterMode('CUSTOM'); }}
                                       className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-brand"
                                    />
                                 </div>
                                 <div className="flex justify-end items-center gap-2 pt-1">
                                    <button
                                       onClick={() => setShowHistoryDateDropdown(false)}
                                       className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                                    >
                                       Cancel
                                    </button>
                                    <button
                                       onClick={() => setShowHistoryDateDropdown(false)}
                                       className="px-4 py-1 bg-brand hover:bg-brand-hover rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                                    >
                                       OK
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </>
                     )}
                  </div>

                  <button
                     onClick={() => {
                        setHistorySearchTerm('');
                        setHistoryStatusFilter('ALL');
                        setHistoryDateFilterMode('ALL');
                        setHistoryDateFrom('');
                        setHistoryDateTo('');
                        setShowHistoryDateDropdown(false);
                     }}
                     className={`p-2 transition-colors ${hasActiveHistoryFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
                     title="Clear all filters"
                  >
                     <RotateCcw size={16} />
                  </button>

                  <p className="ml-auto text-xs text-gray-500">
                     Showing <span className="font-semibold text-gray-700">{filteredPayrollRuns.length}</span> of {payrollRuns.length}
                  </p>
               </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                  <table className="w-full font-sans">
                     <thead className="bg-brand border-b">
                        <tr>
                           <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
                           <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Pay Period</th>
                           <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Gross Disbursement</th>
                           <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Statutory Holds</th>
                           <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Net Payable</th>
                           <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
                           <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Audit</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {filteredPayrollRuns.length > 0 ? filteredPayrollRuns.map(run => (
                           <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatRegistryDate(run.createdAt)}</td>
                              <td className="px-4 py-3">
                                 <div className="text-sm font-bold text-gray-800">{formatRegistryDate(run.periodStart)} to {formatRegistryDate(run.periodEnd)}</div>
                                 <div className="text-xs font-mono text-gray-400 uppercase mt-1">BATCH_ID: {run.id.slice(-8)}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-brand">{formatCurrency(run.totalGross)}</td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-bold text-rose-500">({formatCurrency(run.totalDeductions)})</td>
                              <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-900">{formatCurrency(run.totalNet)}</td>
                              <td className="px-4 py-3">{getRunStatusBadge(run.status)}</td>
                              <td className="px-4 py-3 text-right">
                                 <button
                                    onClick={() => setViewingRunId(run.id)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-light bg-brand/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition-all hover:bg-brand hover:text-white"
                                 >
                                    <Eye size={12} /> View Advice
                                 </button>
                              </td>
                           </tr>
                        )) : (
                           <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                 <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                                 {hasActiveHistoryFilters
                                    ? 'Try adjusting your search or filters.'
                                    : 'No payroll runs initiated in the current fiscal year.'}
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>

         {/* Payroll Run Details Modal (Employee List) */}
         {viewingRunId && viewingRun && (
            <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
               <div className="bg-white rounded-md shadow-md w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 flex flex-col h-[80vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand/10 text-brand border border-brand-light rounded shadow-sm"><FileText size={24} /></div>
                        <div>
                           <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">Run Details: {viewingRun.periodStart} to {viewingRun.periodEnd}</h3>
                           <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Staff Processed: {viewingLines.length}</p>
                        </div>
                     </div>
                     <button onClick={() => setViewingRunId(null)} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-0">
                     <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/80 sticky top-0 z-10">
                           <tr>
                              <th className="px-5 py-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Employee</th>
                              <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Gross</th>
                              <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Deductions</th>
                              <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Pay</th>
                              <th className="px-5 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {viewingLines.map(line => {
                              const emp = employees.find(e => e.id === line.employeeId);
                              const deductionsTotal = (Object.values(line.deductions) as number[]).reduce((a, b) => a + b, 0);
                              return (
                                 <tr key={line.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-5">
                                       <div className="text-sm font-bold text-gray-800 uppercase">{emp?.lastName}, {emp?.firstName}</div>
                                       <div className="text-xs font-mono text-gray-400">{emp?.designation}</div>
                                    </td>
                                    <td className="px-5 py-5 text-right font-mono text-xs font-bold text-gray-600">{formatCurrency(line.grossPay)}</td>
                                    <td className="px-5 py-5 text-right font-mono text-xs font-bold text-rose-500">({formatCurrency(deductionsTotal)})</td>
                                    <td className="px-5 py-5 text-right font-mono text-sm font-semibold text-gray-900">{formatCurrency(line.netPay)}</td>
                                    <td className="px-5 py-5 text-right">
                                       <button
                                          onClick={() => setViewingPaystub({ run: viewingRun, line: line })}
                                          className="p-2 hover:bg-brand/10 text-brand rounded transition-all"
                                       >
                                          <Printer size={18} />
                                       </button>
                                    </td>
                                 </tr>
                              )
                           })}
                        </tbody>
                     </table>
                  </div>
                  <div className="p-8 bg-gray-800 flex justify-between items-center text-white">
                     <div className="flex gap-5">
                        <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Run Gross</p><p className="text-xl font-mono font-semibold">{formatCurrency(viewingRun.totalGross)}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Disbursements</p><p className="text-xl font-mono font-semibold text-emerald-400">{formatCurrency(viewingRun.totalNet)}</p></div>
                     </div>
                     <button className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded text-xs font-semibold uppercase tracking-wide transition-all">
                        <Download size={14} /> Export Register
                     </button>
                  </div>
               </div>
            </div>
</ModalPortal>
         )}

         {/* Detailed Individual Paystub Modal */}
         {viewingPaystub && (
            <ModalPortal>
<div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
               <div className="bg-white rounded-md shadow-md w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200 my-8 flex flex-col no-print">
                  <div className="p-8 border-b bg-gray-50 flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand/10 text-brand border border-brand-light rounded shadow-sm shadow-brand/10"><Receipt size={24} /></div>
                        <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">Pay Advice Preview</h3>
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           onClick={() => window.print()}
                           className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 text-white rounded hover:bg-black transition-all shadow-md font-bold text-xs"
                        >
                           <Printer size={16} /> Print Payslip
                        </button>
                        <button onClick={() => setViewingPaystub(null)} className="p-2 hover:bg-gray-200 rounded transition-colors text-gray-400"><X size={28} /></button>
                     </div>
                  </div>

                  <div className="flex-1 p-12 bg-white">
                     <div className="border-4 border-gray-800 p-5 space-y-10 rounded">
                        <div className="flex justify-between items-start">
                           <div>
                              <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">{orgName}</h2>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Official Payment Advice</p>
                           </div>
                           <div className="text-right">
                              <div className="inline-block p-2 bg-brand/10 text-brand border border-brand-light rounded mb-2"><Building2 size={24} /></div>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">System Generated</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5 border-y border-gray-200 py-8">
                           <div className="space-y-4">
                              <div>
                                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipient</p>
                                 <p className="text-lg font-semibold text-gray-900 uppercase">
                                    {employees.find(e => e.id === viewingPaystub.line.employeeId)?.lastName}, {employees.find(e => e.id === viewingPaystub.line.employeeId)?.firstName}
                                 </p>
                                 <p className="text-xs font-bold text-brand uppercase tracking-tight">{employees.find(e => e.id === viewingPaystub.line.employeeId)?.designation}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                 <PayDetail label="SSS #" value={employees.find(e => e.id === viewingPaystub.line.employeeId)?.sss || 'N/A'} />
                                 <PayDetail label="PhilHealth" value={employees.find(e => e.id === viewingPaystub.line.employeeId)?.philhealth || 'N/A'} />
                              </div>
                           </div>
                           <div className="space-y-4 text-right">
                              <div>
                                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pay Period</p>
                                 <p className="text-sm font-semibold text-gray-800">{viewingPaystub.run.periodStart} to {viewingPaystub.run.periodEnd}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-left">
                                 <PayDetail label="Employee ID" value={viewingPaystub.line.employeeId.slice(-6).toUpperCase()} />
                                 <PayDetail label="Disbursement Date" value={new Date(viewingPaystub.run.createdAt).toISOString().split('T')[0]} />
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-20">
                           <div className="space-y-6">
                              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide border-b-2 border-gray-800 pb-2">Earnings</h4>
                              <div className="space-y-3">
                                 <EarningsRow label="Monthly Basic Salary" value={viewingPaystub.line.grossPay - (viewingPaystub.line.deductions.other || 0)} />
                                 {viewingPaystub.line.deductions.other < 0 && <EarningsRow label="Overtime / Bonus" value={Math.abs(viewingPaystub.line.deductions.other)} />}
                                 <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs font-semibold text-gray-900 uppercase tracking-wide">
                                    <span>Gross Earnings</span>
                                    <span>{formatCurrency(viewingPaystub.line.grossPay)}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-6">
                              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide border-b-2 border-gray-800 pb-2">Deductions</h4>
                              <div className="space-y-3">
                                 <EarningsRow label="Income Tax (WHT)" value={viewingPaystub.line.deductions.tax} isDeduction />
                                 <EarningsRow label="SSS Contribution" value={viewingPaystub.line.deductions.sss} isDeduction />
                                 <EarningsRow label="PhilHealth" value={viewingPaystub.line.deductions.philhealth} isDeduction />
                                 <EarningsRow label="Pag-IBIG" value={viewingPaystub.line.deductions.pagibig} isDeduction />
                                 <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs font-semibold text-gray-900 uppercase tracking-wide">
                                    <span>Total Deductions</span>
                                    <span className="text-rose-600">({formatCurrency((Object.values(viewingPaystub.line.deductions) as number[]).reduce((a, b) => a + b, 0))})</span>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="bg-gray-900 p-5 rounded-md flex justify-between items-center text-white shadow-md relative overflow-hidden">
                           <div className="relative z-10">
                              <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-2">Net Take Home Pay</p>
                              <h2 className="text-xl font-mono font-semibold tracking-tighter">{"\u20B1"} {formatCurrency(viewingPaystub.line.netPay)}</h2>
                           </div>
                           <div className="relative z-10 text-right">
                              <div className="p-3 bg-white/10 rounded border border-white/10 inline-block mb-2"><CheckCircle2 size={32} className="text-emerald-400" /></div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disbursement Cleared</p>
                           </div>
                           <div className="absolute top-0 right-0 p-12 opacity-5"><ShieldCheck size={120} /></div>
                        </div>

                        <div className="pt-10 grid grid-cols-2 gap-20">
                           <div className="border-t border-gray-300 pt-3">
                              <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide">Verified By (Institutional Controller)</p>
                           </div>
                           <div className="border-t border-gray-300 pt-3 text-right">
                              <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide">Acknowledged By (Employee)</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="hidden print:block bg-white p-5 w-full">
                  <div className="border-4 border-black p-8 space-y-8">
                     <div className="flex justify-between items-center">
                        <div>
                           <h2 className="text-xl font-semibold uppercase">{orgName}</h2>
                           <p className="text-xs font-bold">PAY ADVICE / PAYSLIP</p>
                        </div>
                        <p className="text-xs font-mono">ID: {viewingPaystub.line.id}</p>
                     </div>

                     <div className="grid grid-cols-2 border-y-2 border-black py-4">
                        <div className="space-y-1">
                           <p className="text-xs font-bold uppercase">NAME: {employees.find(e => e.id === viewingPaystub.line.employeeId)?.lastName}, {employees.find(e => e.id === viewingPaystub.line.employeeId)?.firstName}</p>
                           <p className="text-xs font-bold uppercase">POSITION: {employees.find(e => e.id === viewingPaystub.line.employeeId)?.designation}</p>
                        </div>
                        <div className="text-right space-y-1">
                           <p className="text-xs font-bold uppercase">PERIOD: {viewingPaystub.run.periodStart} - {viewingPaystub.run.periodEnd}</p>
                           <p className="text-xs font-bold uppercase">PAY DATE: {new Date(viewingPaystub.run.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-5">
                        <div>
                           <p className="text-xs font-semibold border-b border-black mb-2 uppercase">Earnings</p>
                           <div className="space-y-1 text-xs">
                              <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(viewingPaystub.line.grossPay - (viewingPaystub.line.deductions.other || 0))}</span></div>
                              <div className="flex justify-between font-semibold pt-2 border-t border-black"><span>TOTAL GROSS</span><span>{formatCurrency(viewingPaystub.line.grossPay)}</span></div>
                           </div>
                        </div>
                        <div>
                           <p className="text-xs font-semibold border-b border-black mb-2 uppercase">Deductions</p>
                           <div className="space-y-1 text-xs">
                              <div className="flex justify-between"><span>WHT Tax</span><span>{formatCurrency(viewingPaystub.line.deductions.tax)}</span></div>
                              <div className="flex justify-between"><span>SSS</span><span>{formatCurrency(viewingPaystub.line.deductions.sss)}</span></div>
                              <div className="flex justify-between"><span>PhilHealth</span><span>{formatCurrency(viewingPaystub.line.deductions.philhealth)}</span></div>
                              <div className="flex justify-between"><span>Pag-IBIG</span><span>{formatCurrency(viewingPaystub.line.deductions.pagibig)}</span></div>
                              <div className="flex justify-between font-semibold pt-2 border-t border-black"><span>TOTAL DEDUCTIONS</span><span>{formatCurrency((Object.values(viewingPaystub.line.deductions) as number[]).reduce((a, b) => a + b, 0))}</span></div>
                           </div>
                        </div>
                     </div>

                     <div className="border-2 border-black p-4 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide">NET PAY: {"\u20B1"} {formatCurrency(viewingPaystub.line.netPay)}</p>
                     </div>

                     <div className="pt-20 grid grid-cols-2 gap-20 text-xs">
                        <div className="border-t border-black pt-1">Prepared By</div>
                        <div className="border-t border-black pt-1">Employee Signature</div>
                     </div>
                  </div>
               </div>
            </div>
</ModalPortal>
         )}

         {showModal && (
            <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
               <div className="bg-white rounded-md shadow-md w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8 flex flex-col h-full max-h-[90vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-gray-50 shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand/10 text-brand border border-brand-light rounded shadow-sm"><Calculator size={24} /></div>
                        <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">New Payroll Execution</h3>
                     </div>
                     <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                     <div className="flex-1 overflow-y-auto p-5 space-y-10 scrollbar-hide border-r border-gray-100">
                        <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-2">
                              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Period Commencement</label>
                              <input type="date" required className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded font-bold text-sm" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Period Termination</label>
                              <input type="date" required className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded font-bold text-sm" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Active Staff Selection</h4>
                           <div className="space-y-3">
                              {employees.filter(e => e.isActive).map(emp => (
                                 <div key={emp.id} className="p-4 bg-gray-50 rounded border border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 rounded bg-gray-200 text-gray-500 flex items-center justify-center font-bold text-xs shrink-0">
                                          {emp.lastName[0]}{emp.firstName[0]}
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold text-gray-800">{emp.lastName}, {emp.firstName}</p>
                                          <p className="text-xs font-semibold text-gray-400 uppercase">Base: {emp.basicSalary.toLocaleString()}</p>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                       <div className="space-y-1">
                                          <label className="text-xs font-semibold text-gray-400 uppercase block">Add OT / Bonus</label>
                                          <input type="number" className="w-24 px-3 py-1 bg-white border border-gray-200 rounded-lg text-right text-xs font-mono font-bold"
                                             value={adjustments[emp.id]?.ot || ''} placeholder="0.00" onChange={e => setAdjustments({ ...adjustments, [emp.id]: { ...(adjustments[emp.id] || { other: 0 }), ot: Number(e.target.value) } })} />
                                       </div>
                                       <div className="space-y-1">
                                          <label className="text-xs font-semibold text-gray-400 uppercase block">Other Ded.</label>
                                          <input type="number" className="w-24 px-3 py-1 bg-white border border-gray-200 rounded-lg text-right text-xs font-mono font-bold"
                                             value={adjustments[emp.id]?.other || ''} placeholder="0.00" onChange={e => setAdjustments({ ...adjustments, [emp.id]: { ...(adjustments[emp.id] || { ot: 0 }), other: Number(e.target.value) } })} />
                                       </div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="w-full md:w-[400px] bg-gray-50 p-5 flex flex-col shrink-0">
                        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-8">
                           <ShieldCheck size={18} className="text-brand" />
                           Execution Summary
                        </h4>

                        <div className="space-y-6">
                           <div className="space-y-1 mb-4">
                              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Register Reference</label>
                              <p className="text-sm font-semibold text-brand font-mono bg-brand/5 px-3 py-1 rounded-lg border border-brand-light">{payrollRef}</p>
                           </div>
                           <SummaryRow label="Gross Labor Cost" value={currentRunSummary.gross} />
                           <SummaryRow label="Statutory Liabilities" value={currentRunSummary.depr} isNegative />
                           <div className="pt-6 border-t-2 border-gray-200 mt-4 flex justify-between items-end">
                              <span className="text-xs font-semibold text-gray-800 uppercase tracking-wide">NET PAYABLE</span>
                              <span className="text-lg font-mono font-semibold text-brand">{"\u20B1"} {currentRunSummary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                           </div>
                        </div>

                        <div className="mt-12 space-y-4">
                           <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Disbursement Source</label>
                           <select className="w-full px-5 py-3.5 bg-white border-2 border-brand-light rounded font-semibold text-sm text-brand outline-none focus:border-brand" value={bankId} onChange={e => setBankId(e.target.value)}>
                              <option value="">Select Treasury...</option>
                              {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>)}
                           </select>
                        </div>

                        <div className="bg-brand/5 p-6 rounded border border-brand-light flex gap-4 mt-8">
                           <Info size={24} className="text-brand shrink-0" />
                           <p className="text-xs text-gray-900 leading-relaxed font-bold">
                              Executing this run will generate an automatic Journal Entry. Salaries Expense will be debited, while Benefits Payables and Cash will be credited.
                           </p>
                        </div>

                        <div className="mt-auto pt-10">
                           <button
                              onClick={handlePostRun}
                              disabled={!periodStart || !periodEnd || !bankId || activeEmployees.length === 0}
                              className="w-full py-5 bg-brand text-white rounded-md text-xs font-semibold uppercase tracking-wide shadow-sm shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                           >
                              Confirm & Post Ledger
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
</ModalPortal>
         )}
      </div>
   );
};

const StatWidget: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => {
   const palette = color === 'brand'
      ? 'bg-brand/10 text-brand border-brand-light'
      : color === 'emerald'
         ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
         : color === 'amber'
            ? 'bg-amber-50 text-amber-600 border-amber-100'
            : 'bg-gray-50 text-gray-600 border-gray-200';

   return (
      <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm flex items-center gap-5">
         <div className={`w-12 h-12 rounded flex items-center justify-center border shrink-0 shadow-sm ${palette}`}>
            {icon}
         </div>
         <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-semibold text-gray-900 tracking-tight">{value}</p>
         </div>
      </div>
   );
};

const SummaryRow: React.FC<{ label: string, value: number, isNegative?: boolean }> = ({ label, value, isNegative }) => (
   <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`font-mono font-semibold ${isNegative ? 'text-rose-500' : 'text-gray-800'}`}>
         {isNegative ? '-' : ''} {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
   </div>
);

const PayDetail: React.FC<{ label: string, value: string }> = ({ label, value }) => (
   <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-bold text-gray-700">{value}</p>
   </div>
);

const EarningsRow: React.FC<{ label: string, value: number, isDeduction?: boolean }> = ({ label, value, isDeduction }) => (
   <div className="flex justify-between items-center text-xs">
      <span className="font-bold text-gray-500">{label}</span>
      <span className={`font-mono ${isDeduction ? 'text-rose-500 font-bold' : 'text-gray-800 font-bold'}`}>
         {isDeduction ? '-' : ''}{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
   </div>
);

export default PayrollView;

