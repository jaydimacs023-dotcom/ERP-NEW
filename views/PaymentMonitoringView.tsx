import React, { useState, useMemo } from 'react';
import { PaymentHistory, Organization } from '../types';
import { CreditCard, Calendar, DollarSign, AlertCircle, CheckCircle2, Search, Filter, Building2 } from 'lucide-react';

interface PaymentMonitoringViewProps {
  payments: PaymentHistory[];
  organizations: Organization[];
}

const PaymentMonitoringView: React.FC<PaymentMonitoringViewProps> = ({ payments, organizations }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'OVERDUE' | 'PENDING'>('ALL');

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const org = organizations.find(o => o.id === p.orgId);
      const matchesSearch = 
        (org?.name.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [payments, organizations, searchTerm, filterStatus]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OVERDUE': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CANCELLED': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <CreditCard className="text-indigo-600" size={28} />
            Payment Monitoring Dashboard
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Master payment tracking across all tenant organizations.</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Collected</p>
              <p className="text-2xl font-black text-emerald-600 mt-2">USD {stats.paid.toLocaleString()}</p>
            </div>
            <CheckCircle2 size={32} className="text-emerald-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Collection</p>
              <p className="text-2xl font-black text-amber-600 mt-2">USD {stats.pending.toLocaleString()}</p>
            </div>
            <Calendar size={32} className="text-amber-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overdue Amounts</p>
              <p className="text-2xl font-black text-rose-600 mt-2">USD {stats.overdue.toLocaleString()}</p>
            </div>
            <AlertCircle size={32} className="text-rose-200" />
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Search by tenant name, invoice, or description..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-1 focus:ring-indigo-600 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
      </div>

      {/* Payment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenant Organization</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid Date</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPayments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-8 py-12 text-center text-slate-500">
                  <p className="text-sm font-semibold">No payments found</p>
                </td>
              </tr>
            ) : (
              filteredPayments.map(payment => {
                const org = organizations.find(o => o.id === payment.orgId);
                return (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{org?.name || 'Unknown'}</p>
                          <p className="text-[9px] text-slate-500">{payment.orgId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest bg-slate-50 border-slate-200 text-slate-700">
                        {payment.planType}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-800">{payment.invoiceNumber || 'N/A'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <DollarSign size={14} className="text-slate-400" />
                        {payment.amount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-semibold text-slate-700">{formatDate(payment.dueDate)}</p>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-semibold text-slate-700">{payment.paidDate ? formatDate(payment.paidDate) : '-'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentMonitoringView;
