import React, { useState, useMemo } from 'react';
import { TransactionSummary, ChartOfAccount, JournalEntry, JournalEntryLine, AccountClass, Qualification, Batch } from '../types';
import { AccountingService } from '../accountingService';
import { Printer, Download, Clock, Calendar, Award, CheckCircle2, AlertCircle, Info, ChevronRight, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Filter, Building2 } from 'lucide-react';

interface ReportsProps {
  summaries: TransactionSummary[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalEntryLine[];
  qualifications: Qualification[];
  batches: Batch[];
  orgName?: string;
  currency?: string;
  logoUrl?: string;
}

type ReportType = 'BS' | 'IS' | 'TB' | 'CFS';

const Reports: React.FC<ReportsProps> = ({ accounts, entries, lines, qualifications, batches, orgName = 'Institution Ledger', currency = 'USD', logoUrl }) => {
  const [reportType, setReportType] = useState<ReportType>('BS');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>('');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`; 
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; 
  });

  const reportSummariesBS = useMemo(() => {
    const filteredEntries = entries.filter(e => e.date <= endDate);
    const filteredEntryIds = new Set(filteredEntries.map(e => e.id));
    const filteredLines = lines.filter(l => filteredEntryIds.has(l.journalEntryId));
    return AccountingService.getLedgerSummaries(accounts, filteredLines);
  }, [accounts, entries, lines, endDate]);

  const reportSummariesIS = useMemo(() => {
    const dateFilteredEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);
    const dateFilteredEntryIds = new Set(dateFilteredEntries.map(e => e.id));
    let targetLines = lines.filter(l => dateFilteredEntryIds.has(l.journalEntryId));
    
    if (selectedQualificationId && reportType === 'IS') {
      const qualBatchIds = new Set(batches.filter(b => b.qualificationId === selectedQualificationId).map(b => b.id));
      const qualAccountIds = new Set(accounts.filter(a => a.qualificationId === selectedQualificationId).map(a => a.id));

      targetLines = targetLines.filter(line => {
        const isAttributedBatch = line.batchId && qualBatchIds.has(line.batchId);
        const isAttributedAccount = qualAccountIds.has(line.accountId);
        return isAttributedBatch || isAttributedAccount;
      });
    }

    return AccountingService.getLedgerSummaries(accounts, targetLines);
  }, [accounts, entries, lines, batches, startDate, endDate, selectedQualificationId, reportType]);

  const bs = useMemo(() => AccountingService.generateBalanceSheet(reportSummariesBS, accounts), [reportSummariesBS, accounts]);
  
  const isReport = useMemo(() => {
    return AccountingService.generateIncomeStatement(reportSummariesIS, accounts);
  }, [reportSummariesIS, accounts]);

  const cfsReport = useMemo(() => {
    const periodLines = lines.filter(l => {
      const entry = entries.find(e => e.id === l.journalEntryId);
      return entry && entry.date >= startDate && entry.date <= endDate;
    });
    return AccountingService.generateCashFlow(reportSummariesIS, accounts, periodLines);
  }, [reportSummariesIS, accounts, lines, entries, startDate, endDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const timestamp = new Date().toISOString().split('T')[0];
    let filename = "";

    if (reportType === 'BS') {
      filename = `Balance_Sheet_${timestamp}.csv`;
      csvContent += "Category,Account Name,Balance\n";
      bs.assets.forEach(a => csvContent += `Assets,"${a.accountName}",${a.balance}\n`);
      csvContent += `Total Assets,,${bs.totalAssets}\n`;
      bs.liabilities.forEach(l => csvContent += `Liabilities,"${l.accountName}",${l.balance}\n`);
      csvContent += `Total Liabilities,,${bs.totalLiabilities}\n`;
      bs.equity.forEach(e => csvContent += `Equity,"${e.accountName}",${e.balance}\n`);
      csvContent += `Total Equity,,${bs.totalEquity}\n`;
    } else if (reportType === 'IS') {
      filename = `Income_Statement_${timestamp}.csv`;
      csvContent += "Category,Account Name,Balance\n";
      isReport.revenue.forEach(r => csvContent += `Revenue,"${r.accountName}",${r.balance}\n`);
      csvContent += `Total Revenue,,${isReport.totalRevenue}\n`;
      isReport.expenses.forEach(e => csvContent += `Expenses,"${e.accountName}",${e.balance}\n`);
      csvContent += `Total Expenses,,${isReport.totalExpenses}\n`;
      csvContent += `Net Income,,${isReport.netIncome}\n`;
    } else if (reportType === 'CFS') {
      filename = `Cash_Flow_${timestamp}.csv`;
      csvContent += "Activity,Item,Amount\n";
      csvContent += `Operating,Net Income,${cfsReport.netIncome}\n`;
      csvContent += `Operating,Depreciation Adjustment,${cfsReport.depreciationAdjustment}\n`;
      csvContent += `Operating,Change in Receivables,${cfsReport.changeInAR}\n`;
      csvContent += `Operating,Change in Payables,${cfsReport.changeInAP}\n`;
      csvContent += `Total Operating Activity,,${cfsReport.operatingCashFlow}\n`;
      csvContent += `Investing,Capital Expenditure,${cfsReport.investingCashFlow}\n`;
      csvContent += `Financing,Equity Contributions/Drawings,${cfsReport.financingCashFlow}\n`;
      csvContent += `Net Cash Flow,,${cfsReport.netCashFlow}\n`;
      csvContent += `Ending Cash Balance,,${cfsReport.endingCash}\n`;
    } else if (reportType === 'TB') {
      filename = `Trial_Balance_${timestamp}.csv`;
      csvContent += "Account Code,Account Title,Debit,Credit\n";
      reportSummariesBS.filter(s => {
        const acc = accounts.find(a => a.id === s.accountId);
        return acc && !acc.isHeader;
      }).forEach(s => {
        const acc = accounts.find(a => a.id === s.accountId);
        csvContent += `${acc?.code || ''},"${s.accountName}",${s.totalDebit > 0 ? s.totalDebit : 0},${s.totalCredit > 0 ? s.totalCredit : 0}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currencySymbol = currency === 'USD' ? '$' : currency === 'PHP' ? '₱' : currency === 'EUR' ? '€' : currency;

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const activeQualification = qualifications.find(q => q.id === selectedQualificationId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 print:m-0 print:p-0">
      {/* Print-Only Confidentiality Watermark */}
      <div className="hidden print:flex justify-between items-center mb-8 border-b-2 border-slate-900 pb-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full border-2 border-slate-900 flex items-center justify-center overflow-hidden shrink-0">
             {logoUrl ? (
               <img src={logoUrl} className="w-full h-full object-cover" alt="Institutional Logo" />
             ) : (
               <Building2 size={32} />
             )}
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{orgName}</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Official Institutional Financial Record</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Classification</p>
           <p className="text-xs font-black text-rose-600 uppercase">Highly Confidential</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm no-print">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex bg-slate-100 rounded-2xl p-1.5 border border-slate-200">
            <ReportTab active={reportType === 'BS'} onClick={() => { setReportType('BS'); setSelectedQualificationId(''); }} label="Balance Sheet" />
            <ReportTab active={reportType === 'IS'} onClick={() => setReportType('IS')} label="Profit & Loss" />
            <ReportTab active={reportType === 'CFS'} onClick={() => { setReportType('CFS'); setSelectedQualificationId(''); }} label="Cash Flow" />
            <ReportTab active={reportType === 'TB'} onClick={() => { setReportType('TB'); setSelectedQualificationId(''); }} label="Trial Balance" />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer size={16} /> Print Report
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg"
            >
              <Download size={16} /> Export Data
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-10 pt-6 border-t border-slate-100">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 rounded-lg"><Calendar size={18} className="text-slate-400" /></div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fiscal Range</p>
               <div className="flex items-center gap-2">
                  <input type="date" className="bg-transparent border-none outline-none text-xs text-slate-800 font-black p-0 focus:ring-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <span className="text-slate-300 font-bold text-[10px]">TO</span>
                  <input type="date" className="bg-transparent border-none outline-none text-xs text-slate-800 font-black p-0 focus:ring-0" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
             </div>
           </div>

           {reportType === 'IS' && (
             <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
               <div className="p-2 bg-indigo-50 rounded-lg"><Award size={18} className={`text-indigo-600 ${selectedQualificationId ? 'animate-pulse' : ''}`} /></div>
               <div>
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Functional Segment</p>
                 <div className="relative">
                    <select 
                      className="bg-transparent border-none outline-none text-xs text-indigo-700 font-black p-0 pr-6 focus:ring-0 appearance-none cursor-pointer"
                      value={selectedQualificationId}
                      onChange={(e) => setSelectedQualificationId(e.target.value)}
                    >
                      <option value="">Consolidated (Global View)</option>
                      {qualifications.map(q => (
                        <option key={q.id} value={q.id}>{q.name}</option>
                      ))}
                    </select>
                    <ChevronRight size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-indigo-300 pointer-events-none rotate-90" />
                 </div>
               </div>
             </div>
           )}
           
           <div className="flex-1 flex justify-end">
              {selectedQualificationId ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100 animate-in zoom-in duration-300">
                  <Filter size={16} className="text-amber-600" />
                  <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Segment Filter Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Consolidated & Reconciled</span>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-visible flex flex-col min-h-[800px] print:border-none print:shadow-none print:rounded-none">
        <div className="p-16 border-b border-slate-50 bg-slate-50/20 text-center print:bg-white print:p-8">
          <div className="flex items-center justify-center gap-2 mb-4 no-print">
             <div className="w-12 h-1 bg-indigo-600 rounded-full"></div>
             <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
             <div className="w-12 h-1 bg-indigo-600 rounded-full"></div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{orgName.toUpperCase()}</h2>
          <div className="text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
            <span>Financial Information Segment</span>
            {activeQualification && (
              <>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-indigo-600">Qualification: {activeQualification.name}</span>
              </>
            )}
          </div>
          
          <div className="mt-8">
            <h1 className="text-lg font-black text-indigo-700 uppercase tracking-widest print:text-slate-900">
              {reportType === 'BS' ? 'Statement of Financial Position' : 
               reportType === 'IS' ? 'Statement of Comprehensive Income' : 
               reportType === 'CFS' ? 'Statement of Cash Flows' : 'Trial Balance Registry'}
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">
              {reportType === 'BS' ? `AS OF ${formatDateLabel(endDate).toUpperCase()}` : `PERIOD ENDING ${formatDateLabel(endDate).toUpperCase()}`}
            </p>
          </div>
        </div>

        <div className="p-16 flex-1 bg-white print:p-8">
          {reportType === 'BS' && (
            <div className="space-y-12 max-w-3xl mx-auto">
              <FinancialSection title="I. ASSETS" items={bs.assets} total={bs.totalAssets} symbol={currencySymbol} />
              <FinancialSection title="II. LIABILITIES" items={bs.liabilities} total={bs.totalLiabilities} symbol={currencySymbol} />
              <FinancialSection title="III. OWNER'S EQUITY" items={bs.equity} total={bs.totalEquity} symbol={currencySymbol} />
              
              <div className="pt-10 mt-10 border-t-2 border-slate-900 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 uppercase tracking-widest">TOTAL LIABILITIES AND EQUITY</span>
                <span className="text-lg font-mono font-black text-slate-900 underline decoration-double decoration-slate-900 underline-offset-4">
                  {currencySymbol} {formatCurrency(bs.totalLiabilities + bs.totalEquity)}
                </span>
              </div>
            </div>
          )}

          {reportType === 'IS' && (
            <div className="space-y-12 max-w-3xl mx-auto">
              <FinancialSection title="REVENUE SOURCES" items={isReport.revenue} total={isReport.totalRevenue} symbol={currencySymbol} />
              <FinancialSection title="OPERATING EXPENSES" items={isReport.expenses} total={isReport.totalExpenses} symbol={currencySymbol} />
              
              <div className={`pt-10 mt-10 border-t-2 border-slate-900 flex justify-between items-center ${isReport.netIncome >= 0 ? 'text-emerald-700 print:text-slate-900' : 'text-rose-700 print:text-slate-900'}`}>
                <span className="text-sm font-black uppercase tracking-widest">NET COMPREHENSIVE INCOME / (LOSS)</span>
                <span className="text-lg font-mono font-black underline decoration-double underline-offset-4">
                  {currencySymbol} {formatCurrency(isReport.netIncome)}
                </span>
              </div>
            </div>
          )}

          {reportType === 'CFS' && (
            <div className="space-y-12 max-w-3xl mx-auto">
              <div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                   <div className="w-2 h-2 bg-indigo-600 rounded-full no-print"></div>
                   CASH FLOW FROM OPERATING ACTIVITIES
                </h4>
                <div className="space-y-4 px-5">
                   <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                      <span className="flex-1">Net Income / Profit for the Period</span>
                      <span className="font-mono text-xs w-32 text-right">{formatCurrency(cfsReport.netIncome)}</span>
                   </div>
                   
                   <div className="py-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Adjustments for non-cash items:</p>
                     <div className="space-y-2 pl-4">
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                           <span>Depreciation & Amortization Expense</span>
                           <span className="font-mono">{formatCurrency(cfsReport.depreciationAdjustment)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                           <span>(Increase) / Decrease in Trade Receivables</span>
                           <span className="font-mono">{formatCurrency(cfsReport.changeInAR)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                           <span>Increase / (Decrease) in Accounts Payable</span>
                           <span className="font-mono">{formatCurrency(cfsReport.changeInAP)}</span>
                        </div>
                     </div>
                   </div>

                   <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-black text-slate-900 uppercase tracking-widest">
                      <span>NET CASH FROM OPERATING ACTIVITIES</span>
                      <span className="border-b-2 border-slate-200 pb-1">{formatCurrency(cfsReport.operatingCashFlow)}</span>
                   </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                   <div className="w-2 h-2 bg-indigo-600 rounded-full no-print"></div>
                   CASH FLOW FROM INVESTING ACTIVITIES
                </h4>
                <div className="space-y-4 px-5">
                   <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                      <span>Payments for Capital Expenditure (Fixed Assets)</span>
                      <span className="font-mono">{formatCurrency(cfsReport.investingCashFlow)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-black text-slate-900 uppercase tracking-widest">
                      <span>NET CASH USED IN INVESTING ACTIVITIES</span>
                      <span className="border-b-2 border-slate-200 pb-1">{formatCurrency(cfsReport.investingCashFlow)}</span>
                   </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                   <div className="w-2 h-2 bg-indigo-600 rounded-full no-print"></div>
                   CASH FLOW FROM FINANCING ACTIVITIES
                </h4>
                <div className="space-y-4 px-5">
                   <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                      <span>Owner Contributions / (Drawings)</span>
                      <span className="font-mono">{formatCurrency(cfsReport.financingCashFlow)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs font-black text-slate-900 uppercase tracking-widest">
                      <span>NET CASH FROM FINANCING ACTIVITIES</span>
                      <span className="border-b-2 border-slate-200 pb-1">{formatCurrency(cfsReport.financingCashFlow)}</span>
                   </div>
                </div>
              </div>

              <div className="pt-10 mt-10 border-t-4 border-double border-slate-900 bg-slate-50/50 p-8 rounded-3xl print:bg-white print:p-0">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-black text-indigo-700 uppercase tracking-[0.2em] print:text-slate-900">
                       <span>NET INCREASE / (DECREASE) IN CASH</span>
                       <span className="font-mono">{currencySymbol} {formatCurrency(cfsReport.netCashFlow)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                       <span>Add: Cash at Beginning of Period</span>
                       <span className="font-mono">{formatCurrency(0)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-slate-900 text-lg font-black text-slate-900 uppercase tracking-widest">
                       <span>CASH AT END OF PERIOD</span>
                       <span className="font-mono underline decoration-double underline-offset-4">{currencySymbol} {formatCurrency(cfsReport.endingCash)}</span>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {reportType === 'TB' && (
            <div className="max-w-4xl mx-auto overflow-hidden rounded-[2rem] border border-slate-200 print:border-slate-900">
              <table className="min-w-full divide-y divide-slate-100 print:divide-slate-900">
                <thead className="bg-slate-50 print:bg-white">
                  <tr>
                    <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-900">G/L Account Title</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-900">Debit</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-900">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {reportSummariesBS.filter(s => {
                    const acc = accounts.find(a => a.id === s.accountId);
                    return acc && !acc.isHeader;
                  }).map(s => (
                    <tr key={s.accountId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-10 py-5 text-sm font-bold text-slate-800 tracking-tight">{s.accountName.toUpperCase()}</td>
                      <td className="px-10 py-5 text-right font-mono text-xs font-bold text-slate-600">{s.totalDebit > 0 ? formatCurrency(s.totalDebit) : '—'}</td>
                      <td className="px-10 py-5 text-right font-mono text-xs font-bold text-slate-600">{s.totalCredit > 0 ? formatCurrency(s.totalCredit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Print Footer: Signatures & Certification */}
        <div className="hidden print:block p-16 pt-0">
           <div className="grid grid-cols-2 gap-20 pt-20">
              <div className="space-y-12">
                 <div className="border-t border-slate-900 pt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prepared & Certified Correct By:</p>
                    <p className="text-sm font-black text-slate-900 mt-1 uppercase">Institutional Accountant</p>
                 </div>
              </div>
              <div className="space-y-12">
                 <div className="border-t border-slate-900 pt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reviewed & Approved By:</p>
                    <p className="text-sm font-black text-slate-900 mt-1 uppercase">Institutional President</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="px-16 py-10 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 print:bg-white print:border-slate-900">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 print:bg-white print:border print:border-slate-900">
                <ShieldCheck size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-900">Internal Certification</p>
                <p className="text-xs font-bold text-slate-700">Audit-Ready Snapshot • GAAP Compliant</p>
             </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] print:text-slate-900">
             <div className="flex items-center gap-1.5"><Clock size={14} /> SYS_SYNC: {new Date().toLocaleTimeString()}</div>
             <div className="w-1 h-1 bg-slate-200 rounded-full print:bg-slate-900"></div>
             <div className="italic text-indigo-400 print:text-slate-900">AccounTech Engine v4.0.1</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportTab: React.FC<{ active: boolean, label: string, onClick: () => void }> = ({ active, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white text-indigo-600 shadow-md shadow-indigo-50 border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
  >
    {label}
  </button>
);

const FinancialSection: React.FC<{ title: string, items: TransactionSummary[], total: number, symbol: string }> = ({ title, items, total, symbol }) => {
  const visibleItems = items.filter(i => Math.abs(i.balance) > 0.01);
  
  return (
    <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] mb-8 flex items-center gap-4">
         <div className="flex-1 h-px bg-slate-100 print:bg-slate-900"></div>
         {title}
         <div className="flex-1 h-px bg-slate-100 print:bg-slate-900"></div>
      </h4>
      <div className="space-y-4 px-5">
        {visibleItems.length > 0 ? visibleItems.map(item => (
          <div key={item.accountId} className="flex justify-between items-center group">
            <div className="flex items-center gap-3">
               <ChevronRight size={12} className="text-slate-200 group-hover:text-indigo-400 transition-colors print:text-slate-900" />
               <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors tracking-tight print:text-slate-900">{item.accountName}</span>
            </div>
            <span className="font-mono text-xs font-medium text-slate-500 group-hover:text-slate-800 transition-colors print:text-slate-900">
              {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )) : (
          <div className="py-4 text-center text-slate-300 italic text-[10px] uppercase tracking-widest print:text-slate-400">
            No activity attributed to this segment.
          </div>
        )}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-100 text-sm font-black text-slate-900 uppercase tracking-widest print:border-slate-900">
          <span>SUBTOTAL {title}</span>
          <span className="border-b-2 border-slate-900 pb-1">{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;
