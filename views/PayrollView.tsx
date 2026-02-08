
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, PayrollRun, PayrollLine, ChartOfAccount, BankAccount, JournalEntry, JournalLine, PayFrequency, OvertimeType } from '../types';
import { AccountingService } from '../accountingService';
import { TaxBracketService } from '../services/TaxBracketService';
import { ContributionService } from '../services/ContributionService';
import { PayrollCalculationService } from '../services/PayrollCalculationService';
import { 
  UserCheck, Plus, Search, Calendar, ChevronRight, X, Play,
  ShieldCheck, Calculator, AlertCircle, TrendingUp, DollarSign,
  Briefcase, Landmark, History, Printer, Save, Info,
  CheckCircle2, ArrowRight, Eye, FileText, Download, Building2,
  Receipt
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
}

const PayrollView: React.FC<PayrollViewProps> = ({ 
  employees, payrollRuns, payrollLines, accounts, bankAccounts, entries, orgName = "AccounTech ERP", onPostPayroll 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [viewingRunId, setViewingRunId] = useState<string | null>(null);
  const [viewingPaystub, setViewingPaystub] = useState<{run: PayrollRun, line: PayrollLine} | null>(null);
  
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
      { id: `l1-${entryId}`, journalEntryId: entryId, accountId: salariesExpId, debit: currentRunSummary.gross, credit: 0, memo: `Gross Payroll: ${periodStart} to ${periodEnd}` },
      { id: `l2-${entryId}`, journalEntryId: entryId, accountId: bank.glAccountId, debit: 0, credit: currentRunSummary.net, memo: `Net Disbursement: ${periodStart} to ${periodEnd}` },
      { id: `l3-${entryId}`, journalEntryId: entryId, accountId: taxPayId || '', debit: 0, credit: currentRunSummary.depr, memo: `Payroll Deductions: ${periodStart} to ${periodEnd}` }
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

  const viewingRun = useMemo(() => payrollRuns.find(r => r.id === viewingRunId), [payrollRuns, viewingRunId]);
  const viewingLines = useMemo(() => payrollLines.filter(l => l.payrollRunId === viewingRunId), [payrollLines, viewingRunId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Payroll Processing Console</h2>
          <p className="text-sm text-slate-500 font-normal italic">Automated salary disbursement and statutory liability recognition.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-xs"
        >
          <Play size={16} fill="currentColor" /> Initiate Payroll Run
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatWidget label="Headcount" value={employees.filter(e => e.isActive).length.toString()} icon={<Briefcase size={18} />} color="teal" />
        <StatWidget label="Total Gross (YTD)" value={formatCurrency(payrollRuns.reduce((s, r) => s + r.totalGross, 0))} icon={<TrendingUp size={18} />} color="emerald" />
        <StatWidget label="Active Benefits" value="4" icon={<ShieldCheck size={18} />} color="teal" />
        <StatWidget label="Next Pay Cycle" value="30 Jun 2024" icon={<Calendar size={18} />} color="amber" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-600 text-white rounded-xl"><History size={18} /></div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Recent Payroll History</h3>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
             <thead className="bg-slate-50">
                <tr>
                   <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Pay Period</th>
                   <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Disbursement</th>
                   <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Statutory Holds</th>
                   <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payable</th>
                   <th className="px-10 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {payrollRuns.length > 0 ? [...payrollRuns].reverse().map(run => (
                  <tr key={run.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-10 py-6">
                        <div className="text-sm font-bold text-slate-800">{run.periodStart} to {run.periodEnd}</div>
                        <div className="text-[9px] font-mono text-slate-400 uppercase mt-1">BATCH_ID: {run.id.slice(-8)}</div>
                     </td>
                     <td className="px-10 py-6 text-right font-mono text-sm font-bold text-slate-600">{formatCurrency(run.totalGross)}</td>
                     <td className="px-10 py-6 text-right font-mono text-sm font-bold text-rose-500">({formatCurrency(run.totalDeductions)})</td>
                     <td className="px-10 py-6 text-right font-mono text-sm font-black text-slate-900">{formatCurrency(run.totalNet)}</td>
                     <td className="px-10 py-6 text-center">
                        <button 
                          onClick={() => setViewingRunId(run.id)}
                          className="px-4 py-1.5 bg-teal-50 text-teal-600 border border-teal-100 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-600 hover:text-white transition-all mx-auto"
                        >
                           <Eye size={12} /> View Advice
                        </button>
                     </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-24 text-center text-slate-300 italic font-medium">No payroll runs initiated in the current fiscal year.</td></tr>
                )}
             </tbody>
          </table>
        </div>
      </div>

      {/* Payroll Run Details Modal (Employee List) */}
      {viewingRunId && viewingRun && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 flex flex-col h-[80vh]">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl"><FileText size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Run Details: {viewingRun.periodStart} to {viewingRun.periodEnd}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Staff Processed: {viewingLines.length}</p>
                  </div>
               </div>
               <button onClick={() => setViewingRunId(null)} className="text-slate-400 hover:text-slate-600"><X size={28} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
               <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/80 sticky top-0 z-10">
                    <tr>
                      <th className="px-10 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductions</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Pay</th>
                      <th className="px-10 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {viewingLines.map(line => {
                      const emp = employees.find(e => e.id === line.employeeId);
                      const deductionsTotal = (Object.values(line.deductions) as number[]).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={line.id} className="hover:bg-slate-50/50">
                          <td className="px-10 py-5">
                            <div className="text-sm font-bold text-slate-800 uppercase">{emp?.lastName}, {emp?.firstName}</div>
                            <div className="text-[9px] font-mono text-slate-400">{emp?.designation}</div>
                          </td>
                          <td className="px-10 py-5 text-right font-mono text-xs font-bold text-slate-600">{formatCurrency(line.grossPay)}</td>
                          <td className="px-10 py-5 text-right font-mono text-xs font-bold text-rose-500">({formatCurrency(deductionsTotal)})</td>
                          <td className="px-10 py-5 text-right font-mono text-sm font-black text-slate-900">{formatCurrency(line.netPay)}</td>
                          <td className="px-10 py-5 text-right">
                             <button 
                                onClick={() => setViewingPaystub({ run: viewingRun, line: line })}
                                className="p-2 hover:bg-teal-50 text-teal-600 rounded-xl transition-all"
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
            <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
               <div className="flex gap-10">
                  <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Run Gross</p><p className="text-xl font-mono font-black">{formatCurrency(viewingRun.totalGross)}</p></div>
                  <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Disbursements</p><p className="text-xl font-mono font-black text-emerald-400">{formatCurrency(viewingRun.totalNet)}</p></div>
               </div>
               <button className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all">
                  <Download size={14} /> Export Register
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Individual Paystub Modal */}
      {viewingPaystub && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 my-8 flex flex-col no-print">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100"><Receipt size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Pay Advice Preview</h3>
               </div>
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => window.print()}
                   className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-md font-bold text-xs"
                 >
                   <Printer size={16} /> Print Payslip
                 </button>
                 <button onClick={() => setViewingPaystub(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"><X size={28} /></button>
               </div>
            </div>
            
            <div className="flex-1 p-12 bg-white">
               <div className="border-4 border-slate-900 p-10 space-y-10 rounded-[2rem]">
                  <div className="flex justify-between items-start">
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{orgName}</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Official Payment Advice</p>
                     </div>
                     <div className="text-right">
                        <div className="inline-block p-2 bg-teal-600 text-white rounded-xl mb-2"><Building2 size={24}/></div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Generated</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10 border-y border-slate-200 py-8">
                     <div className="space-y-4">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recipient</p>
                           <p className="text-lg font-black text-slate-900 uppercase">
                              {employees.find(e => e.id === viewingPaystub.line.employeeId)?.lastName}, {employees.find(e => e.id === viewingPaystub.line.employeeId)?.firstName}
                           </p>
                           <p className="text-xs font-bold text-teal-600 uppercase tracking-tight">{employees.find(e => e.id === viewingPaystub.line.employeeId)?.designation}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <PayDetail label="SSS #" value={employees.find(e => e.id === viewingPaystub.line.employeeId)?.sss || 'N/A'} />
                           <PayDetail label="PhilHealth" value={employees.find(e => e.id === viewingPaystub.line.employeeId)?.philhealth || 'N/A'} />
                        </div>
                     </div>
                     <div className="space-y-4 text-right">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pay Period</p>
                           <p className="text-sm font-black text-slate-800">{viewingPaystub.run.periodStart} to {viewingPaystub.run.periodEnd}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-left">
                           <PayDetail label="Employee ID" value={viewingPaystub.line.employeeId.slice(-6).toUpperCase()} />
                           <PayDetail label="Disbursement Date" value={new Date(viewingPaystub.run.createdAt).toISOString().split('T')[0]} />
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-20">
                     <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b-2 border-slate-900 pb-2">Earnings</h4>
                        <div className="space-y-3">
                           <EarningsRow label="Monthly Basic Salary" value={viewingPaystub.line.grossPay - (viewingPaystub.line.deductions.other || 0)} />
                           {viewingPaystub.line.deductions.other < 0 && <EarningsRow label="Overtime / Bonus" value={Math.abs(viewingPaystub.line.deductions.other)} />}
                           <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-900 uppercase tracking-widest">
                              <span>Gross Earnings</span>
                              <span>{formatCurrency(viewingPaystub.line.grossPay)}</span>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b-2 border-slate-900 pb-2">Deductions</h4>
                        <div className="space-y-3">
                           <EarningsRow label="Income Tax (WHT)" value={viewingPaystub.line.deductions.tax} isDeduction />
                           <EarningsRow label="SSS Contribution" value={viewingPaystub.line.deductions.sss} isDeduction />
                           <EarningsRow label="PhilHealth" value={viewingPaystub.line.deductions.philhealth} isDeduction />
                           <EarningsRow label="Pag-IBIG" value={viewingPaystub.line.deductions.pagibig} isDeduction />
                           <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-900 uppercase tracking-widest">
                              <span>Total Deductions</span>
                              <span className="text-rose-600">({formatCurrency((Object.values(viewingPaystub.line.deductions) as number[]).reduce((a, b) => a + b, 0))})</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-slate-950 p-10 rounded-[2.5rem] flex justify-between items-center text-white shadow-2xl relative overflow-hidden">
                     <div className="relative z-10">
                        <p className="text-[11px] font-black text-brand uppercase tracking-[0.3em] mb-2">Net Take Home Pay</p>
                        <h2 className="text-4xl font-mono font-black tracking-tighter">{"\u20B1"} {formatCurrency(viewingPaystub.line.netPay)}</h2>
                     </div>
                     <div className="relative z-10 text-right">
                        <div className="p-3 bg-white/10 rounded-2xl border border-white/10 inline-block mb-2"><CheckCircle2 size={32} className="text-emerald-400" /></div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Disbursement Cleared</p>
                     </div>
                     <div className="absolute top-0 right-0 p-12 opacity-5"><ShieldCheck size={120}/></div>
                  </div>

                  <div className="pt-10 grid grid-cols-2 gap-20">
                     <div className="border-t border-slate-300 pt-3">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verified By (Institutional Controller)</p>
                     </div>
                     <div className="border-t border-slate-300 pt-3 text-right">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Acknowledged By (Employee)</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="hidden print:block bg-white p-10 w-full">
            <div className="border-4 border-black p-8 space-y-8">
              <div className="flex justify-between items-center">
                 <div>
                    <h2 className="text-xl font-black uppercase">{orgName}</h2>
                    <p className="text-xs font-bold">PAY ADVICE / PAYSLIP</p>
                 </div>
                 <p className="text-xs font-mono">ID: {viewingPaystub.line.id}</p>
              </div>

              <div className="grid grid-cols-2 border-y-2 border-black py-4">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase">NAME: {employees.find(e => e.id === viewingPaystub.line.employeeId)?.lastName}, {employees.find(e => e.id === viewingPaystub.line.employeeId)?.firstName}</p>
                    <p className="text-[10px] font-bold uppercase">POSITION: {employees.find(e => e.id === viewingPaystub.line.employeeId)?.designation}</p>
                 </div>
                 <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold uppercase">PERIOD: {viewingPaystub.run.periodStart} - {viewingPaystub.run.periodEnd}</p>
                    <p className="text-[10px] font-bold uppercase">PAY DATE: {new Date(viewingPaystub.run.createdAt).toLocaleDateString()}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-10">
                 <div>
                    <p className="text-[10px] font-black border-b border-black mb-2 uppercase">Earnings</p>
                    <div className="space-y-1 text-[10px]">
                       <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(viewingPaystub.line.grossPay - (viewingPaystub.line.deductions.other || 0))}</span></div>
                       <div className="flex justify-between font-black pt-2 border-t border-black"><span>TOTAL GROSS</span><span>{formatCurrency(viewingPaystub.line.grossPay)}</span></div>
                    </div>
                 </div>
                 <div>
                    <p className="text-[10px] font-black border-b border-black mb-2 uppercase">Deductions</p>
                    <div className="space-y-1 text-[10px]">
                       <div className="flex justify-between"><span>WHT Tax</span><span>{formatCurrency(viewingPaystub.line.deductions.tax)}</span></div>
                       <div className="flex justify-between"><span>SSS</span><span>{formatCurrency(viewingPaystub.line.deductions.sss)}</span></div>
                       <div className="flex justify-between"><span>PhilHealth</span><span>{formatCurrency(viewingPaystub.line.deductions.philhealth)}</span></div>
                       <div className="flex justify-between"><span>Pag-IBIG</span><span>{formatCurrency(viewingPaystub.line.deductions.pagibig)}</span></div>
                       <div className="flex justify-between font-black pt-2 border-t border-black"><span>TOTAL DEDUCTIONS</span><span>{formatCurrency((Object.values(viewingPaystub.line.deductions) as number[]).reduce((a, b) => a + b, 0))}</span></div>
                    </div>
                 </div>
              </div>

              <div className="border-2 border-black p-4 text-center">
                 <p className="text-xs font-black uppercase tracking-widest">NET PAY: {"\u20B1"} {formatCurrency(viewingPaystub.line.netPay)}</p>
              </div>

              <div className="pt-20 grid grid-cols-2 gap-20 text-[10px]">
                 <div className="border-t border-black pt-1">Prepared By</div>
                 <div className="border-t border-black pt-1">Employee Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[90] overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8 flex flex-col h-full max-h-[90vh]">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50 shrink-0">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl"><Calculator size={24} /></div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">New Payroll Execution</h3>
               </div>
               <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
               <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide border-r border-slate-100">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Period Commencement</label>
                        <input type="date" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Period Termination</label>
                        <input type="date" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Active Staff Selection</h4>
                     <div className="space-y-3">
                        {employees.filter(e => e.isActive).map(emp => (
                           <div key={emp.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0">
                                    {emp.lastName[0]}{emp.firstName[0]}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-800">{emp.lastName}, {emp.firstName}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Base: {emp.basicSalary.toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase block">Add OT / Bonus</label>
                                    <input type="number" className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg text-right text-xs font-mono font-bold" 
                                      value={adjustments[emp.id]?.ot || ''} placeholder="0.00" onChange={e => setAdjustments({...adjustments, [emp.id]: { ...(adjustments[emp.id] || {other:0}), ot: Number(e.target.value)}})} />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase block">Other Ded.</label>
                                    <input type="number" className="w-24 px-3 py-1 bg-white border border-slate-200 rounded-lg text-right text-xs font-mono font-bold" 
                                      value={adjustments[emp.id]?.other || ''} placeholder="0.00" onChange={e => setAdjustments({...adjustments, [emp.id]: { ...(adjustments[emp.id] || {ot:0}), other: Number(e.target.value)}})} />
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="w-full md:w-[400px] bg-slate-50 p-10 flex flex-col shrink-0">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-8">
                     <ShieldCheck size={18} className="text-teal-600" />
                     Execution Summary
                  </h4>

                  <div className="space-y-6">
                     <div className="space-y-1 mb-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Register Reference</label>
                        <p className="text-sm font-black text-teal-700 font-mono bg-teal-50 px-3 py-1 rounded-lg border border-teal-100">{payrollRef}</p>
                     </div>
                     <SummaryRow label="Gross Labor Cost" value={currentRunSummary.gross} />
                     <SummaryRow label="Statutory Liabilities" value={currentRunSummary.depr} isNegative />
                     <div className="pt-6 border-t-2 border-slate-200 mt-4 flex justify-between items-end">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest">NET PAYABLE</span>
                        <span className="text-2xl font-mono font-black text-teal-700">{"\u20B1"} {currentRunSummary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                     </div>
                  </div>

                  <div className="mt-12 space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disbursement Source</label>
                     <select className="w-full px-5 py-3.5 bg-white border-2 border-teal-100 rounded-2xl font-black text-sm text-teal-700 outline-none" value={bankId} onChange={e => setBankId(e.target.value)}>
                        <option value="">Select Treasury...</option>
                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>)}
                     </select>
                  </div>

                  <div className="bg-teal-50 p-6 rounded-[2rem] border border-teal-100 flex gap-4 mt-8">
                     <Info size={24} className="text-teal-600 shrink-0" />
                     <p className="text-[10px] text-teal-900 leading-relaxed font-bold">
                        Executing this run will generate an automatic Journal Entry. Salaries Expense will be debited, while Benefits Payables and Cash will be credited.
                     </p>
                  </div>

                  <div className="mt-auto pt-10">
                     <button 
                       onClick={handlePostRun}
                       disabled={!periodStart || !periodEnd || !bankId || activeEmployees.length === 0}
                       className="w-full py-5 bg-teal-600 text-white rounded-3xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                     >
                        Confirm & Post Ledger
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatWidget: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
    <div className={`w-12 h-12 rounded-2xl bg-${color}-50 text-${color}-600 flex items-center justify-center border border-${color}-100 shrink-0 shadow-sm`}>
       {icon}
    </div>
    <div>
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  </div>
);

const SummaryRow: React.FC<{ label: string, value: number, isNegative?: boolean }> = ({ label, value, isNegative }) => (
  <div className="flex justify-between items-center">
     <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
     <span className={`font-mono font-black ${isNegative ? 'text-rose-500' : 'text-slate-800'}`}>
        {isNegative ? '-' : ''} {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
     </span>
  </div>
);

const PayDetail: React.FC<{ label: string, value: string }> = ({ label, value }) => (
   <div>
      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-bold text-slate-700">{value}</p>
   </div>
);

const EarningsRow: React.FC<{ label: string, value: number, isDeduction?: boolean }> = ({ label, value, isDeduction }) => (
   <div className="flex justify-between items-center text-xs">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`font-mono ${isDeduction ? 'text-rose-500 font-bold' : 'text-slate-800 font-bold'}`}>
         {isDeduction ? '-' : ''}{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
   </div>
);

export default PayrollView;
