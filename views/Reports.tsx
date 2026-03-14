import React, { useState, useMemo } from 'react';
import { TransactionSummary, ChartOfAccount, JournalEntry, JournalLine, AccountClass, Qualification, Batch } from '../types';
import { AccountingService } from '../accountingService';
import { Printer, Download, Clock, Calendar, Award, CheckCircle2, AlertCircle, Info, ChevronRight, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Filter, Building2, BarChart, Wrench } from 'lucide-react';
import CustomReportBuilder from './CustomReportBuilder';

interface ReportsProps {
  summaries: TransactionSummary[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  qualifications: Qualification[];
  batches: Batch[];
  orgName?: string;
  currency?: string;
  logoUrl?: string;
}

type ReportType = 'BS' | 'IS' | 'TB' | 'CFS' | 'CUSTOM';

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
    return `\u20B1 ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
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

  const currencySymbol = currency === 'USD' ? '$' : currency === 'PHP' ? '\u20B1' : currency === 'EUR' ? '€' : currency;

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const activeQualification = qualifications.find(q => q.id === selectedQualificationId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 no-print">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Institutional Financial Reports</h2>
          <p className="text-sm text-gray-500 font-normal italic">Standardized statements and regulatory reporting for educational institutions.</p>
        </div>
      </header>

      <div className="bg-white p-8 rounded border border-gray-200 shadow-sm no-print">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex bg-gray-100 rounded p-1.5 border border-gray-200 flex-wrap">
              <ReportTab active={reportType === 'BS'} onClick={() => { setReportType('BS'); setSelectedQualificationId(''); }} label="Balance Sheet" />
              <ReportTab active={reportType === 'IS'} onClick={() => setReportType('IS')} label="Profit & Loss" />
              <ReportTab active={reportType === 'CFS'} onClick={() => { setReportType('CFS'); setSelectedQualificationId(''); }} label="Cash Flow" />
              <ReportTab active={reportType === 'TB'} onClick={() => { setReportType('TB'); setSelectedQualificationId(''); }} label="Trial Balance" />
              <ReportTab active={reportType === 'CUSTOM'} onClick={() => { setReportType('CUSTOM'); setSelectedQualificationId(''); }} label="Custom Builder" icon={<Wrench size={12} />} />
              <ReportTab active={reportType === 'QR'} onClick={() => setReportType('QR')} label="Compliance" />
            </div>

            <div className="flex items-center gap-3">
              {reportType !== 'CUSTOM' && (
                <>
                  <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-all border border-gray-200 font-bold text-sm">
                    <Printer size={18} className="text-[#025959]" /> Print
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 bg-[#025959] text-white rounded hover:bg-[#014242] transition-all shadow-lg font-bold text-sm">
                    <Download size={18} /> Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {reportType !== 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-5 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg"><Calendar size={18} className="text-gray-400" /></div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Fiscal Range</p>
                  <div className="flex items-center gap-2">
                    <input type="date" className="bg-transparent border-none outline-none text-xs text-gray-800 font-semibold p-0 focus:ring-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="text-gray-300 font-bold text-xs">TO</span>
                    <input type="date" className="bg-transparent border-none outline-none text-xs text-gray-800 font-semibold p-0 focus:ring-0" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {reportType === 'IS' && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
                  <div className="p-2 bg-[#025959]/5 rounded-lg"><Award size={18} className={`text-[#025959] ${selectedQualificationId ? 'animate-pulse' : ''}`} /></div>
                  <div>
                    <p className="text-xs font-bold text-[#025959] uppercase tracking-wide leading-none mb-1">Functional Segment</p>
                    <div className="relative">
                      <select
                        className="bg-transparent border-none outline-none text-xs text-[#025959] font-bold p-0 pr-6 focus:ring-0 appearance-none cursor-pointer"
                        value={selectedQualificationId}
                        onChange={(e) => setSelectedQualificationId(e.target.value)}
                      >
                        <option value="">Consolidated (Global View)</option>
                        {qualifications.map(q => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                      <ChevronRight size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#025959]/60 pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 flex justify-end">
                {selectedQualificationId ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#025959]/5 rounded border border-[#025959]/20 animate-in zoom-in duration-300">
                    <Filter size={16} className="text-[#025959]" />
                    <span className="text-xs font-bold text-[#025959] uppercase tracking-wide">Segment Filter Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#025959]/5 rounded border border-[#025959]/20">
                    <CheckCircle2 size={16} className="text-[#025959]" />
                    <span className="text-xs font-bold text-[#025959] uppercase tracking-wide">Consolidated & Reconciled</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Report Builder */}
      {reportType === 'CUSTOM' && (
        <CustomReportBuilder
          accounts={accounts}
          entries={entries}
          lines={lines}
          currency={currency}
        />
      )}

      {/* Standard Reports Container */}
      {reportType !== 'CUSTOM' && (
        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-visible flex flex-col min-h-[800px] print:border-none print:shadow-none print:rounded-none">
          <div className="p-16 border-b border-gray-50 bg-gray-50/20 text-center print:bg-white print:p-8">
            <div className="flex items-center justify-center gap-2 mb-4 no-print">
              <div className="w-12 h-1 bg-[#025959] rounded-full"></div>
              <div className="w-2 h-2 bg-[#025959] rounded-full"></div>
              <div className="w-12 h-1 bg-[#025959] rounded-full"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{orgName.toUpperCase()}</h2>
            <div className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-wide flex items-center justify-center gap-2">
              <span>Financial Information Segment</span>
              {activeQualification && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-[#025959]">Qualification: {activeQualification.name}</span>
                </>
              )}
            </div>

            <div className="mt-8">
              <h1 className="text-lg font-bold text-[#025959] uppercase tracking-wide print:text-gray-900">
                {reportType === 'BS' ? 'Statement of Financial Position' :
                  reportType === 'IS' ? 'Statement of Comprehensive Income' :
                    reportType === 'CFS' ? 'Statement of Cash Flows' :
                      reportType === 'TB' ? 'Trial Balance Registry' : 'Regulatory Report'}
              </h1>
              <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wide">
                {reportType === 'BS' ? `AS OF ${formatDateLabel(endDate).toUpperCase()}` : `PERIOD ENDING ${formatDateLabel(endDate).toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="p-16 flex-1 bg-white print:p-8">
            {(!reportSummariesBS || reportSummariesBS.length === 0) && (!reportSummariesIS || reportSummariesIS.length === 0) ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                <div className="p-4 bg-gray-100 rounded-full">
                  <BarChart size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 uppercase tracking-wide">No Report Data Available</h3>
                <p className="text-sm text-gray-500 max-w-sm">There are no transactions recorded for the selected period. Please check your date range or create some journal entries to generate reports.</p>
              </div>
            ) : (
              <>
                {reportType === 'BS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <FinancialSection title="I. ASSETS" items={bs.assets} total={bs.totalAssets} symbol={currencySymbol} />
                    <FinancialSection title="II. LIABILITIES" items={bs.liabilities} total={bs.totalLiabilities} symbol={currencySymbol} />
                    <FinancialSection title="III. OWNER'S EQUITY" items={bs.equity} total={bs.totalEquity} symbol={currencySymbol} />

                    <div className="pt-10 mt-6 border-t-2 border-gray-800 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">TOTAL LIABILITIES AND EQUITY</span>
                      <span className="text-lg font-mono font-semibold text-gray-900 underline decoration-double decoration-gray-900 underline-offset-4">
                        {formatCurrency(bs.totalLiabilities + bs.totalEquity)}
                      </span>
                    </div>
                  </div>
                )}

                {reportType === 'IS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <FinancialSection title="REVENUE SOURCES" items={isReport.revenue} total={isReport.totalRevenue} symbol={currencySymbol} />
                    <FinancialSection title="OPERATING EXPENSES" items={isReport.expenses} total={isReport.totalExpenses} symbol={currencySymbol} />

                    <div className={`pt-10 mt-6 border-t-2 border-gray-800 flex justify-between items-center ${isReport.netIncome >= 0 ? 'text-[#025959] print:text-gray-900' : 'text-rose-700 print:text-gray-900'}`}>
                      <span className="text-sm font-semibold uppercase tracking-wide">NET COMPREHENSIVE INCOME / (LOSS)</span>
                      <span className="text-lg font-mono font-semibold underline decoration-double underline-offset-4">
                        {formatCurrency(isReport.netIncome)}
                      </span>
                    </div>
                  </div>
                )}

                {reportType === 'CFS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-[#025959] rounded-full no-print"></div>
                        CASH FLOW FROM OPERATING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-sm font-bold text-gray-700">
                          <span className="flex-1">Net Income / Profit for the Period</span>
                          <span className="font-mono text-xs w-32 text-right">{formatCurrency(cfsReport.netIncome)}</span>
                        </div>

                        <div className="py-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Adjustments for non-cash items:</p>
                          <div className="space-y-2 pl-4">
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>Depreciation & Amortization Expense</span>
                              <span className="font-mono">{formatCurrency(cfsReport.depreciationAdjustment)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>(Increase) / Decrease in Trade Receivables</span>
                              <span className="font-mono">{formatCurrency(cfsReport.changeInAR)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>Increase / (Decrease) in Accounts Payable</span>
                              <span className="font-mono">{formatCurrency(cfsReport.changeInAP)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH FROM OPERATING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.operatingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-[#F47721] rounded-full no-print"></div>
                        CASH FLOW FROM INVESTING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                          <span>Payments for Capital Expenditure (Fixed Assets)</span>
                          <span className="font-mono">{formatCurrency(cfsReport.investingCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH USED IN INVESTING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.investingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-[#F47721] rounded-full no-print"></div>
                        CASH FLOW FROM FINANCING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                          <span>Owner Contributions / (Drawings)</span>
                          <span className="font-mono">{formatCurrency(cfsReport.financingCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH FROM FINANCING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.financingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 mt-6 border-t-4 border-double border-gray-800 bg-gray-50 p-8 rounded-md print:bg-white print:p-0">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-bold text-[#025959] uppercase tracking-wide print:text-gray-900">
                          <span>NET INCREASE / (DECREASE) IN CASH</span>
                          <span className="font-mono">{formatCurrency(cfsReport.netCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wide">
                          <span>Add: Cash at Beginning of Period</span>
                          <span className="font-mono">{formatCurrency(0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-gray-800 text-lg font-semibold text-gray-900 uppercase tracking-wide">
                          <span>CASH AT END OF PERIOD</span>
                          <span className="font-mono underline decoration-double underline-offset-4">{formatCurrency(cfsReport.endingCash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportType === 'TB' && (
                  <div className="max-w-4xl mx-auto overflow-hidden rounded border border-gray-200 print:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-100 print:divide-gray-900">
                      <thead className="bg-gray-50 print:bg-white">
                        <tr>
                          <th className="px-5 py-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">G/L Account Title</th>
                          <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Debit</th>
                          <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                        {reportSummariesBS.filter(s => {
                          const acc = accounts.find(a => a.id === s.accountId);
                          return acc && !acc.isHeader;
                        }).map(s => (
                          <tr key={s.accountId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-5 text-sm font-bold text-gray-800 tracking-tight">{s.accountName.toUpperCase()}</td>
                            <td className="px-5 py-5 text-right font-mono text-xs font-bold text-gray-600">{s.totalDebit > 0 ? formatCurrency(s.totalDebit) : '—'}</td>
                            <td className="px-5 py-5 text-right font-mono text-xs font-bold text-gray-600">{s.totalCredit > 0 ? formatCurrency(s.totalCredit) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hidden print:block p-16 pt-0">
            <div className="grid grid-cols-2 gap-20 pt-20">
              <div className="space-y-12">
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prepared & Certified Correct By:</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 uppercase">Institutional Accountant</p>
                </div>
              </div>
              <div className="space-y-12">
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reviewed & Approved By:</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 uppercase">Institutional President</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-16 py-10 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6 print:bg-white print:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#025959]/10 flex items-center justify-center text-[#025959] print:bg-white print:border print:border-gray-800">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Internal Certification</p>
                <p className="text-xs font-bold text-gray-700">Audit-Ready Snapshot • GAAP Compliant</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-300 uppercase tracking-wide print:text-gray-900">
              <div className="flex items-center gap-1.5"><Clock size={14} /> SYS_SYNC: {new Date().toLocaleTimeString()}</div>
              <div className="w-1 h-1 bg-gray-200 rounded-full print:bg-gray-800"></div>
              <div className="italic text-[#025959] print:text-gray-900">AccounTech Engine v4.0.1</div>
            </div>
          </div>
        </div>
      )}

      {/* Print-Only Confidentiality Watermark - Moved to the bottom of the main flow */}
      <div className="hidden print:flex justify-between items-center border-b-2 border-gray-800 pb-8 mt-12 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full border-2 border-gray-800 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} className="w-full h-full object-cover" alt="Institutional Logo" />
            ) : (
              <Building2 size={32} className="text-gray-900" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold uppercase tracking-tight leading-none">{orgName}</h1>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Official Institutional Financial Record</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Security Classification</p>
          <p className="text-xs font-semibold text-rose-600 uppercase">Highly Confidential</p>
        </div>
      </div>
    </div>
  );
};

const ReportTab: React.FC<{ active: boolean, label: string, onClick: () => void, icon?: React.ReactNode }> = ({ active, label, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${active ? 'bg-white text-[#025959] shadow-md shadow-gray-50 border border-[#025959]/20' : 'text-gray-400 hover:text-gray-600'}`}
  >
    {icon}{label}
  </button>
);

const FinancialSection: React.FC<{ title: string, items: TransactionSummary[], total: number, symbol: string }> = ({ title, items, total, symbol }) => {
  const visibleItems = items.filter(i => Math.abs(i.balance) > 0.01);

  return (
    <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
        {title}
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
      </h4>
      <div className="space-y-4 px-5">
        {visibleItems.length > 0 ? visibleItems.map(item => (
          <div key={item.accountId} className="flex justify-between items-center group">
            <div className="flex items-center gap-3">
              <ChevronRight size={12} className="text-gray-200 group-hover:text-orange-400 transition-colors print:text-gray-900" />
              <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors tracking-tight print:text-gray-900">{item.accountName}</span>
            </div>
            <span className="font-mono text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors print:text-gray-900">
              {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )) : (
          <div className="py-4 text-center text-gray-300 italic text-xs uppercase tracking-wide print:text-gray-400">
            No activity attributed to this segment.
          </div>
        )}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100 text-sm font-semibold text-gray-900 uppercase tracking-wide print:border-gray-800">
          <span>SUBTOTAL {title}</span>
          <span className="border-b-2 border-gray-800 pb-1">{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;

