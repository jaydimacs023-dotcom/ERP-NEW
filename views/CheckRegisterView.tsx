import React, { useState, useMemo } from 'react';
import { 
  CheckVoucher, BankAccount, Vendor, Payable, 
  CheckStatus
} from '../types';
import EmptyState from '../components/EmptyState';
import {
  Download, Search, Filter, ChevronDown, Eye,
  AlertCircle, Clock, CheckCircle, XCircle, Plus,
  Calendar, DollarSign, Hash, Building, Trash2,
  TrendingUp, TrendingDown
} from 'lucide-react';

interface CheckRegisterViewProps {
  checks: CheckVoucher[];
  bankAccounts: BankAccount[];
  vendors: Vendor[];
  payables: Payable[];
  onViewCheck?: (checkId: string) => void;
  onExportCSV?: (checks: CheckVoucher[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface CheckRegisterFilter {
  status: CheckStatus | 'all';
  bankAccountId: string;
  startDate?: string;
  endDate?: string;
  searchTerm: string;
}

const CheckRegisterView: React.FC<CheckRegisterViewProps> = ({
  checks,
  bankAccounts,
  vendors,
  payables,
  onViewCheck,
  onExportCSV,
  onNotify
}) => {
  const [filters, setFilters] = useState<CheckRegisterFilter>({
    status: 'all',
    bankAccountId: 'all',
    startDate: undefined,
    endDate: undefined,
    searchTerm: ''
  });

  const [sortBy, setSortBy] = useState<'date' | 'number' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort checks
  const filteredChecks = useMemo(() => {
    let result = checks.filter(c => !c.isDeleted);

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(c => c.status === filters.status);
    }

    // Bank account filter
    if (filters.bankAccountId !== 'all') {
      result = result.filter(c => c.bankAccountId === filters.bankAccountId);
    }

    // Date range filter
    if (filters.startDate) {
      result = result.filter(c => new Date(c.checkDate) >= new Date(filters.startDate!));
    }
    if (filters.endDate) {
      result = result.filter(c => new Date(c.checkDate) <= new Date(filters.endDate!));
    }

    // Search filter
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(c =>
        c.checkNumber.toLowerCase().includes(term) ||
        c.payeeName.toLowerCase().includes(term) ||
        c.amount.toString().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime();
          break;
        case 'number':
          comparison = parseInt(a.checkNumber) - parseInt(b.checkNumber);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [checks, filters, sortBy, sortOrder]);

  // Calculate summary statistics
  const statistics = useMemo(() => {
    const stats = {
      totalChecks: filteredChecks.length,
      totalAmount: 0,
      byStatus: {
        draft: 0,
        printed: 0,
        released: 0,
        cleared: 0,
        voided: 0,
        stale: 0
      },
      pendingClearing: 0,
      pendingAmount: 0
    };

    filteredChecks.forEach(check => {
      stats.totalAmount += check.amount;
      stats.byStatus[check.status.toLowerCase() as keyof typeof stats.byStatus]++;
      if (check.status === 'RELEASED') {
        stats.pendingClearing++;
        stats.pendingAmount += check.amount;
      }
    });

    return stats;
  }, [filteredChecks]);

  const statusConfig: Record<CheckStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
    DRAFT: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: <Clock size={14} /> },
    PRINTED: { label: 'Printed', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <FileText size={14} /> },
    RELEASED: { label: 'Released', color: 'text-violet-600', bgColor: 'bg-violet-50', icon: <CheckCircle size={14} /> },
    CLEARED: { label: 'Cleared', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: <CheckCircle size={14} /> },
    VOIDED: { label: 'Voided', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: <XCircle size={14} /> },
    STALE: { label: 'Stale', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: <AlertCircle size={14} /> }
  };

  const handleExport = () => {
    if (onExportCSV) {
      onExportCSV(filteredChecks);
      onNotify('success', `Exported ${filteredChecks.length} checks to CSV`);
    }
  };

  const getVendorName = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor';
  };

  const getBankAccountName = (bankId: string) => {
    return bankAccounts.find(b => b.id === bankId)?.accountName || 'Unknown Account';
  };

  const FileText = () => <Clock size={14} />;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Total Checks */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Total Checks</p>
              <p className="text-2xl font-black text-slate-900 mt-2">{statistics.totalChecks}</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Hash size={18} className="text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Total Amount</p>
              <p className="text-2xl font-black text-slate-900 mt-2">${statistics.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <DollarSign size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Released Checks */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Released</p>
              <p className="text-2xl font-black text-violet-600 mt-2">{statistics.byStatus.released}</p>
              <p className="text-xs text-slate-500 mt-1">${statistics.pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-2.5 bg-violet-50 rounded-lg">
              <TrendingUp size={18} className="text-violet-600" />
            </div>
          </div>
        </div>

        {/* Cleared Checks */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Cleared</p>
              <p className="text-2xl font-black text-emerald-600 mt-2">{statistics.byStatus.cleared}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Voided Checks */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Voided</p>
              <p className="text-2xl font-black text-rose-600 mt-2">{statistics.byStatus.voided}</p>
            </div>
            <div className="p-2.5 bg-rose-50 rounded-lg">
              <XCircle size={18} className="text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter size={16} /> Filters & Search
          </h3>
          <button
            onClick={handleExport}
            disabled={filteredChecks.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {/* Search */}
          <div className="col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Check #, Payee name, Amount..."
              value={filters.searchTerm}
              onChange={(e) => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: (e.target.value as any) }))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PRINTED">Printed</option>
            <option value="RELEASED">Released</option>
            <option value="CLEARED">Cleared</option>
            <option value="VOIDED">Voided</option>
            <option value="STALE">Stale</option>
          </select>

          {/* Bank Account Filter */}
          <select
            value={filters.bankAccountId}
            onChange={(e) => setFilters(f => ({ ...f, bankAccountId: e.target.value }))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Bank Accounts</option>
            {bankAccounts
              .filter(b => b.type !== 'CASH' && !b.isDeleted)
              .map(b => (
                <option key={b.id} value={b.id}>
                  {b.accountName}
                </option>
              ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value || undefined }))}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center justify-center text-slate-400">→</div>
          <div className="col-span-1 relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value || undefined }))}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
        <span className="text-xs font-semibold text-slate-600 uppercase">Sort by:</span>
        <button
          onClick={() => { setSortBy('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'date' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => { setSortBy('number'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'number' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Check # {sortBy === 'number' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => { setSortBy('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'amount' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Check Register Table */}
      {filteredChecks.length === 0 ? (
        <EmptyState
          icon={<AlertCircle size={48} />}
          title="No Checks Found"
          description={filters.searchTerm || filters.status !== 'all' ? 'Try adjusting your filters' : 'No checks have been created yet'}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-tight">Check #</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-tight">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-tight">Bank Account</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-tight">Payee</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-tight">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-tight">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-tight">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredChecks.map((check) => {
                  const config = statusConfig[check.status];
                  return (
                    <tr key={check.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-slate-900">#{check.checkNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {new Date(check.checkDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-slate-400" />
                          <span className="text-sm text-slate-600">{getBankAccountName(check.bankAccountId)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-900 font-medium">{check.payeeName}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-slate-900">
                          ${check.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full ${config.bgColor} ${config.color}`}>
                          {config.icon}
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onViewCheck && onViewCheck(check.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Showing {filteredChecks.length} of {checks.length} checks</span>
            <span className="font-bold text-slate-900">
              Total: ${filteredChecks.reduce((sum, c) => sum + c.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckRegisterView;
