import React, { useState, useMemo, useEffect } from 'react';
import { PaymentHistory, Organization } from '../types';
import { CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle2, Search, Filter, Download } from 'lucide-react';

interface PaymentHistoryViewProps {
  payments: PaymentHistory[];
  currency: string;
  organization?: Organization;
}

const PaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({ payments, currency, organization }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'OVERDUE' | 'PENDING'>('ALL');
  const brandColor = organization?.primaryColor || '#059669';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchesSearch =
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, filterStatus]);

  const hasActiveFilters = searchTerm.trim().length > 0 || filterStatus !== 'ALL';

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const exportToCSV = () => {
    const headers = [
      'Invoice Number',
      'Description',
      'Plan Type',
      'Amount',
      'Due Date',
      'Paid Date',
      'Status',
      'Currency'
    ];

    const csvData = filteredPayments.map(payment => [
      payment.invoiceNumber || 'N/A',
      payment.description,
      payment.planType,
      payment.amount.toString(),
      formatDate(payment.dueDate),
      payment.paidDate ? formatDate(payment.paidDate) : 'Not Paid',
      payment.status,
      currency
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OVERDUE': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PENDING': return 'bg-brand/10 text-brand border-brand-light';
      case 'CANCELLED': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircle2 size={16} />;
      case 'OVERDUE': return <AlertCircle size={16} />;
      case 'PENDING': return <Calendar size={16} />;
      default: return <CreditCard size={16} />;
    }
  };

  const stats = useMemo(() => {
    const paid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const pending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
    const overdue = payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0);
    return { paid, pending, overdue };
  }, [payments]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Payment History
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">Track subscription payments and manage billing.</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-sm active:scale-95"
        >
          <Download size={18} /> Export Report
        </button>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.5fr_0.9fr_0.9fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search by description or invoice..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredPayments.length}</span> of <span className="font-semibold text-gray-900">{payments.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-8 py-5 text-[10px] font-semibold text-white uppercase tracking-wide">Invoice</th>
                <th className="px-8 py-5 text-[10px] font-semibold text-white uppercase tracking-wide">Plan Type</th>
                <th className="px-8 py-5 text-right text-[10px] font-semibold text-white uppercase tracking-wide">Amount</th>
                <th className="px-8 py-5 text-left text-[10px] font-semibold text-white uppercase tracking-wide">Due Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-semibold text-white uppercase tracking-wide">Paid Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-semibold text-white uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-gray-500">
                    <p className="text-sm font-semibold">No payments found</p>
                    <p className="text-xs text-gray-400 mt-2">Try adjusting your search or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-6">
                      <p className="text-sm font-semibold text-gray-800">{payment.invoiceNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-[240px]">{payment.description}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide bg-gray-50 border-gray-200 text-gray-700">
                        {payment.planType}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-sm font-semibold text-gray-800 flex items-center justify-end gap-2">
                        <DollarSign size={14} className="text-gray-400" />
                        {payment.amount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-semibold text-gray-700">{formatDate(payment.dueDate)}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-semibold text-gray-700">{payment.paidDate ? formatDate(payment.paidDate) : '-'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wide ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryView;

