import React, { useState, useMemo } from 'react';
import {
  RecurringBill,
  RecurringBillHistory,
  RecurrenceFrequency,
  Vendor,
  ChartOfAccount,
  BankAccount,
  TaxCategory,
  WHTCategory,
  Payable
} from '../types';
import { RecurringBillService } from '../services/RecurringBillService';
import EmptyState from '../components/EmptyState';
import {
  Plus, Edit2, Pause, Play, Trash2, Search, Filter, Calendar,
  DollarSign, Clock, AlertCircle, CheckCircle, TrendingUp,
  ChevronRight, X, Save, Copy, ChevronDown, TrendingDown
} from 'lucide-react';

interface RecurringBillsViewProps {
  recurringBills: RecurringBill[];
  history: RecurringBillHistory[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  bankAccounts: BankAccount[];
  withholdingCategories?: WHTCategory[];
  onCreateBill: (bill: Partial<RecurringBill>) => void;
  onUpdateBill: (id: string, updates: Partial<RecurringBill>) => void;
  onDeleteBill: (id: string) => void;
  onGeneratePayables?: (billIds: string[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface BillFormData {
  billName: string;
  vendorId: string;
  description: string;
  amount: number;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate: string;
  billDaysAfterMonth: string;
  paymentTermsDays: string;
  glAccountId: string;
  autoCreatePayable: boolean;
  includeWithholding: boolean;
  appliedRatePercent: string;
}

const RecurringBillsView: React.FC<RecurringBillsViewProps> = ({
  recurringBills,
  history,
  vendors,
  accounts,
  bankAccounts,

  onCreateBill,
  onUpdateBill,
  onDeleteBill,
  onGeneratePayables,
  onNotify
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'>('all');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const [formData, setFormData] = useState<BillFormData>({
    billName: '',
    vendorId: '',
    description: '',
    amount: 0,
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    billDaysAfterMonth: '1',
    paymentTermsDays: '30',
    glAccountId: '',
    autoCreatePayable: true,
    includeWithholding: false,
    appliedRatePercent: '0'
  });

  // Filter and search
  const filteredBills = useMemo(() => {
    let result = recurringBills.filter(b => !b.isDeleted);

    if (statusFilter !== 'all') {
      result = result.filter(b => b.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(b =>
        b.billName.toLowerCase().includes(term) ||
        vendors.find(v => v.id === b.vendorId)?.name.toLowerCase().includes(term)
      );
    }

    return result;
  }, [recurringBills, statusFilter, searchTerm, vendors]);

  // Summary statistics
  const stats = useMemo(() => {
    return RecurringBillService.getSummaryStats(filteredBills);
  }, [filteredBills]);

  // Due and upcoming bills
  const dueBills = useMemo(() => {
    return RecurringBillService.getDueBills(filteredBills.filter(b => b.status === 'ACTIVE'));
  }, [filteredBills]);

  const upcomingBills = useMemo(() => {
    return RecurringBillService.getUpcomingBills(filteredBills.filter(b => b.status === 'ACTIVE'), 30);
  }, [filteredBills]);

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    ACTIVE: { label: 'Active', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    PAUSED: { label: 'Paused', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    COMPLETED: { label: 'Completed', color: 'text-slate-600', bgColor: 'bg-slate-100' },
    CANCELLED: { label: 'Cancelled', color: 'text-rose-600', bgColor: 'bg-rose-50' }
  };

  const getVendorName = (vendorId: string) => {
    return vendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor';
  };

  const getAccountName = (accountId: string) => {
    return accounts.find(a => a.id === accountId)?.accountName || '-';
  };

  const handleSubmit = () => {
    const validation = RecurringBillService.validateRecurringBill({
      billName: formData.billName,
      vendorId: formData.vendorId,
      description: formData.description,
      amount: formData.amount,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      billDaysAfterMonth: formData.billDaysAfterMonth ? parseInt(formData.billDaysAfterMonth) : undefined,
      paymentTermsDays: formData.paymentTermsDays ? parseInt(formData.paymentTermsDays) : undefined,
      autoCreatePayable: formData.autoCreatePayable,
      includeWithholding: formData.includeWithholding,
      appliedRatePercent: formData.appliedRatePercent ? parseFloat(formData.appliedRatePercent) : 0
    });

    if (!validation.valid) {
      validation.errors.forEach(err => onNotify('error', err));
      return;
    }

    const billData: Partial<RecurringBill> = {
      orgId: '', // Will be set by parent
      billName: formData.billName,
      vendorId: formData.vendorId,
      description: formData.description,
      amount: formData.amount,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      billDaysAfterMonth: formData.billDaysAfterMonth ? parseInt(formData.billDaysAfterMonth) : undefined,
      paymentTermsDays: formData.paymentTermsDays ? parseInt(formData.paymentTermsDays) : undefined,
      nextBillDate: formData.startDate,
      glAccountId: formData.glAccountId || undefined,
      autoCreatePayable: formData.autoCreatePayable,
      includeWithholding: formData.includeWithholding,
      appliedRatePercent: formData.appliedRatePercent ? parseFloat(formData.appliedRatePercent) : 0,
      status: 'ACTIVE',
      totalBillsGenerated: 0
    };

    if (editingId) {
      onUpdateBill(editingId, billData);
      onNotify('success', 'Recurring bill updated successfully');
    } else {
      onCreateBill(billData);
      onNotify('success', 'Recurring bill created successfully');
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      billName: '',
      vendorId: '',
      description: '',
      amount: 0,
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      billDaysAfterMonth: '1',
      paymentTermsDays: '30',
      glAccountId: '',
      autoCreatePayable: true,
      includeWithholding: false,
      appliedRatePercent: '0'
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (bill: RecurringBill) => {
    setFormData({
      billName: bill.billName,
      vendorId: bill.vendorId,
      description: bill.description,
      amount: bill.amount,
      frequency: bill.frequency,
      startDate: bill.startDate,
      endDate: bill.endDate || '',
      billDaysAfterMonth: bill.billDaysAfterMonth?.toString() || '1',
      paymentTermsDays: bill.paymentTermsDays?.toString() || '30',
      glAccountId: bill.glAccountId || '',
      autoCreatePayable: bill.autoCreatePayable,
      includeWithholding: bill.includeWithholding || false,
      appliedRatePercent: bill.appliedRatePercent?.toString() || '0'
    });
    setEditingId(bill.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Bills</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalRecurringBills}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Active</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.activeBills}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Monthly</p>
          <p className="text-lg font-black text-slate-900 mt-1">${stats.totalMonthlyAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Annual</p>
          <p className="text-lg font-black text-slate-900 mt-1">${stats.totalAnnualAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Due</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{dueBills.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Next 30 Days</p>
          <p className="text-2xl font-black text-violet-600 mt-1">{upcomingBills.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter size={16} /> Filters & Search
          </h3>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all"
          >
            <Plus size={14} /> Add Recurring Bill
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bill name or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Recurring Bill' : 'Create Recurring Bill'}
              </h2>
              <button
                onClick={resetForm}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Bill Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Bill Details</h3>
                <input
                  type="text"
                  placeholder="Bill Name (e.g., 'Office Rent', 'SaaS Subscription')"
                  value={formData.billName}
                  onChange={(e) => setFormData(f => ({ ...f, billName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData(f => ({ ...f, vendorId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Amount & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData(f => ({ ...f, frequency: e.target.value as RecurrenceFrequency }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SEMIANNUAL">Semi-annual</option>
                    <option value="ANNUAL">Annual</option>
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Terms & GL Account */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={formData.paymentTermsDays}
                    onChange={(e) => setFormData(f => ({ ...f, paymentTermsDays: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">GL Account</label>
                  <select
                    value={formData.glAccountId}
                    onChange={(e) => setFormData(f => ({ ...f, glAccountId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Account</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.accountName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Withholding */}
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.includeWithholding}
                    onChange={(e) => setFormData(f => ({ ...f, includeWithholding: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="text-sm font-bold text-slate-700">Include Withholding</span>
                </label>
                {formData.includeWithholding && (
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.appliedRatePercent}
                    onChange={(e) => setFormData(f => ({ ...f, appliedRatePercent: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>

              {/* Auto-create */}
              <label className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <input
                  type="checkbox"
                  checked={formData.autoCreatePayable}
                  onChange={(e) => setFormData(f => ({ ...f, autoCreatePayable: e.target.checked }))}
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-600"
                />
                <span className="text-sm font-bold text-emerald-700">Automatically create payables when due</span>
              </label>
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Save size={14} /> Save Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <EmptyState
          icon={<AlertCircle size={48} />}
          title="No Recurring Bills"
          description="Create your first recurring bill to automate regular payments"
        />
      ) : (
        <div className="space-y-3">
          {filteredBills.map(bill => {
            const vendor = vendors.find(v => v.id === bill.vendorId);
            const config = statusConfig[bill.status];
            const nextDates = RecurringBillService.getNextBillDates(bill, 3);
            const billHistory = history.filter(h => h.recurringBillId === bill.id).slice(0, 5);
            const isExpanded = expandedBillId === bill.id;

            return (
              <div key={bill.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Bill Header */}
                <div
                  className="p-4 flex items-start justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-sm font-bold text-slate-900">{bill.billName}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{RecurringBillService.formatFrequency(bill.frequency)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span>💰 {vendor?.name || 'Unknown Vendor'}</span>
                      <span>${bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-slate-500">Next: {new Date(bill.nextBillDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {bill.status === 'ACTIVE' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateBill(bill.id, { status: 'PAUSED' });
                        }}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Pause size={16} />
                      </button>
                    )}
                    {bill.status === 'PAUSED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateBill(bill.id, { status: 'ACTIVE' });
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(bill);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this recurring bill?')) {
                          onDeleteBill(bill.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-4">
                    {/* Details Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase">Annual Amount</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">
                          ${(bill.amount * RecurringBillService.getAnnualMultiplier(bill.frequency)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase">Total Generated</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">{bill.totalBillsGenerated}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase">GL Account</p>
                        <p className="text-sm text-slate-900 mt-1">{getAccountName(bill.glAccountId || '')}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase">Payment Terms</p>
                        <p className="text-sm text-slate-900 mt-1">{bill.paymentTermsDays} days</p>
                      </div>
                    </div>

                    {/* Next Dates */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Upcoming Bills</h4>
                      <div className="flex flex-wrap gap-2">
                        {nextDates.map((date, i) => (
                          <span key={i} className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-lg">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Recent History */}
                    {billHistory.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Recent Activity</h4>
                        <div className="space-y-1 text-xs">
                          {billHistory.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                              <span>{new Date(h.billDate).toLocaleDateString()}</span>
                              <span className="font-semibold text-slate-900">${h.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${h.status === 'CREATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {h.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecurringBillsView;
