import React, { useState, useMemo } from 'react';
import { 
  CheckVoucher, BankAccount, Vendor, Payable, CheckStatus
} from '../types';
import { 
  Search, Filter, Calendar, Printer, Download, ChevronUp, ChevronDown, 
  CheckCircle, XCircle, Clock, FileText, AlertCircle, Eye, Calculator, ArrowUpDown
} from 'lucide-react';

interface CheckRegisterViewProps {
  checks: CheckVoucher[];
  bankAccounts: BankAccount[];
  vendors: Vendor[];
  payables: Payable[];
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  currency?: string;
}

interface CheckRegisterFilter {
  status: CheckStatus | 'all';
  bankAccountId: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
}

const CheckRegisterView: React.FC<CheckRegisterViewProps> = ({
  checks = [],
  bankAccounts = [],
  vendors = [],
  payables = [],
  onNotify,
  currency = '₱'
}) => {
  const [filters, setFilters] = useState<CheckRegisterFilter>({
    status: 'all',
    bankAccountId: 'all',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const [sortField, setSortField] = useState<'checkDate' | 'checkNumber' | 'amount'>('checkDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const formatCurrency = (val: number) => {
    const symbol = currency === 'PHP' ? '\u20B1' : currency === 'USD' ? '$' : '';
    return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredChecks = useMemo(() => {
    return checks.filter(check => {
      const matchStatus = filters.status === 'all' || check.status === filters.status;
      const matchBank = filters.bankAccountId === 'all' || check.bankAccountId === filters.bankAccountId;
      const matchSearch = filters.searchTerm === '' || 
        check.checkNumber.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        check.payeeName.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        check.amount.toString().includes(filters.searchTerm);
      
      const checkDate = new Date(check.checkDate);
      const matchStart = !filters.startDate || checkDate >= new Date(filters.startDate);
      const matchEnd = !filters.endDate || checkDate <= new Date(filters.endDate);

      return matchStatus && matchBank && matchSearch && matchStart && matchEnd;
    });
  }, [checks, filters]);

  const sortedChecks = useMemo(() => {
    return [...filteredChecks].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'checkDate') {
        comparison = new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime();
      } else if (sortField === 'checkNumber') {
        comparison = a.checkNumber.localeCompare(b.checkNumber, undefined, { numeric: true });
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredChecks, sortField, sortDirection]);

  const stats = useMemo(() => {
    return {
      totalCount: filteredChecks.length,
      totalAmount: filteredChecks.reduce((sum, c) => sum + c.amount, 0),
      released: filteredChecks.filter(c => c.status === 'RELEASED'),
      cleared: filteredChecks.filter(c => c.status === 'CLEARED'),
      voided: filteredChecks.filter(c => c.status === 'VOIDED'),
    };
  }, [filteredChecks]);

  const toggleSort = (field: 'checkDate' | 'checkNumber' | 'amount') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportToCSV = () => {
    if (sortedChecks.length === 0) {
      onNotify('info', 'No checks to export');
      return;
    }

    const headers = ['Check #', 'Date', 'Bank Account', 'Payee', 'Amount', 'Status'];
    const rows = sortedChecks.map(c => [
      c.checkNumber,
      c.checkDate,
      bankAccounts.find(ba => ba.id === c.bankAccountId)?.accountName || 'Unknown',
      c.payeeName,
      c.amount.toFixed(2),
      c.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `check_register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('success', `Exported ${sortedChecks.length} checks to CSV`);
  };

  const getStatusStyle = (status: CheckStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'PRINTED': return 'bg-teal-50 text-teal-600 border-teal-200'; // Changed from blue to teal
      case 'RELEASED': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'CLEARED': return 'bg-emerald-50 text-teal-600 border-teal-200';
      case 'VOIDED': return 'bg-rose-50 text-rose-600 border-rose-200';
      case 'STALE': return 'bg-amber-50 text-amber-600 border-amber-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: CheckStatus) => {
    switch (status) {
      case 'DRAFT': return <Clock size={12} />;
      case 'PRINTED': return <Printer size={12} />;
      case 'RELEASED': return <FileText size={12} />;
      case 'CLEARED': return <CheckCircle size={12} />;
      case 'VOIDED': return <XCircle size={12} />;
      case 'STALE': return <AlertCircle size={12} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Check Register</h2>
          <p className="text-sm font-normal italic text-slate-500">Track disbursement history and monitor bank clearance statuses.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard 
          label="Total Checks" 
          value={stats.totalCount.toString()} 
          icon={<Calculator size={20} />} 
          color="teal" 
        />
        <SummaryCard 
          label="Total Amount" 
          value={formatCurrency(stats.totalAmount)} 
          icon={<FileText size={20} />} 
          color="teal" 
        />
        <SummaryCard 
          label="Released" 
          value={stats.released.length.toString()} 
          subValue={formatCurrency(stats.released.reduce((s, c) => s + c.amount, 0))}
          icon={<Clock size={20} />} 
          color="purple" 
        />
        <SummaryCard 
          label="Cleared" 
          value={stats.cleared.length.toString()} 
          subValue={formatCurrency(stats.cleared.reduce((s, c) => s + c.amount, 0))}
          icon={<CheckCircle size={20} />} 
          color="emerald" 
        />
        <SummaryCard 
          label="Voided" 
          value={stats.voided.length.toString()} 
          subValue={formatCurrency(stats.voided.reduce((s, c) => s + c.amount, 0))}
          icon={<XCircle size={20} />} 
          color="rose" 
        />
      </div>

      {/* Filters & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search check #, payee, or amount..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition-all text-sm font-medium"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
          </div>
          <div className="flex gap-2">
            <select 
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value as any})}
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PRINTED">Printed</option>
              <option value="RELEASED">Released</option>
              <option value="CLEARED">Cleared</option>
              <option value="VOIDED">Voided</option>
              <option value="STALE">Stale</option>
            </select>
            <select 
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-sm font-medium"
              value={filters.bankAccountId}
              onChange={(e) => setFilters({...filters, bankAccountId: e.target.value})}
            >
              <option value="all">All Bank Accounts</option>
              {bankAccounts.map(ba => (
                <option key={ba.id} value={ba.id}>{ba.accountName}</option>
              ))}
            </select>
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all text-sm font-bold shadow-sm"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="date" 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-teal-500 outline-none"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="hidden md:block h-4 w-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Sort by:
            <button 
              onClick={() => toggleSort('checkDate')}
              className={`px-2 py-1 rounded transition-colors ${sortField === 'checkDate' ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 '}`}
            >
              Date {sortField === 'checkDate' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('checkNumber')}
              className={`px-2 py-1 rounded transition-colors ${sortField === 'checkNumber' ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 '}`}
            >
              Number {sortField === 'checkNumber' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => toggleSort('amount')}
              className={`px-2 py-1 rounded transition-colors ${sortField === 'amount' ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 '}`}
            >
              Amount {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
      </div>

      {/* Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Check #</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank Account</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</th>
              <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedChecks.length > 0 ? (
              sortedChecks.map((check) => (
                <tr key={check.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono font-bold text-teal-600">{check.checkNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-600">
                      {new Date(check.checkDate).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">
                        {bankAccounts.find(ba => ba.id === check.bankAccountId)?.accountName || 'Unknown Account'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {bankAccounts.find(ba => ba.id === check.bankAccountId)?.accountNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                      {check.payeeName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-mono font-black text-slate-900">
                      {formatCurrency(check.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${getStatusStyle(check.status)}`}>
                        {getStatusIcon(check.status)}
                        {check.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 bg-slate-50/50">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle size={40} className="text-slate-300" />
                    <p className="text-lg font-bold">No Records Found</p>
                    <p className="text-sm">Try adjusting your filters or search terms.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {sortedChecks.length > 0 && (
            <tfoot className="bg-slate-50/50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Showing {sortedChecks.length} of {checks.length} records
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Filtered</span>
                    <span className="text-lg font-mono font-black text-teal-600">{formatCurrency(stats.totalAmount)}</span>
                  </div>
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; subValue?: string; icon: React.ReactNode; color: string }> = ({ 
  label, value, subValue, icon, color 
}) => {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    emerald: 'bg-emerald-50 text-teal-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-teal-300 transition-all">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 group-hover:scale-110 transition-transform ${colorMap[color] || colorMap.teal}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-xl font-black text-slate-900 tracking-tight truncate">{value}</p>
        {subValue && <p className="text-[10px] font-mono font-bold text-slate-500 truncate">{subValue}</p>}
      </div>
    </div>
  );
};

export default CheckRegisterView;
