/**
 * RevenueRecognitionView
 * 
 * Manages deferred revenue and revenue recognition schedules.
 * Allows users to:
 * - Create deferred revenue schedules from upfront payments
 * - View and manage recognition schedules
 * - Run recognition entries to transfer deferred to earned revenue
 * - View recognition history and deferred balances
 */

import React, { useState, useMemo } from 'react';
import ModalPortal from '../components/ModalPortal';
import {
  Calendar, Plus, Search, Filter, Edit2, Trash2, X, Check,
  DollarSign, Clock, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Play, Pause, History, PieChart, RefreshCw, FileText
} from 'lucide-react';
import {
  RevenueSchedule,
  RevenueRecognitionEntry,
  ChartOfAccount,
  RecognitionMethod,
  RecognitionPeriod,
  RevenueScheduleStatus
} from '../types';
import { RevenueRecognitionService, RecognitionPeriodInfo } from '../services/RevenueRecognitionService';

interface Customer {
  id: string;
  name: string;
}

interface RevenueRecognitionViewProps {
  orgId: string;
  currency: string;
  schedules: RevenueSchedule[];
  entries: RevenueRecognitionEntry[];
  customers: Customer[];
  accounts: ChartOfAccount[];
  onCreateSchedule: (schedule: Partial<RevenueSchedule>) => void;
  onUpdateSchedule: (id: string, updates: Partial<RevenueSchedule>) => void;
  onDeleteSchedule: (id: string) => void;
  onCreateEntry: (entry: Partial<RevenueRecognitionEntry>) => void;
  onUpdateEntry: (id: string, updates: Partial<RevenueRecognitionEntry>) => void;
  onPostJournal: (entry: any, lines: any[]) => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

const RECOGNITION_METHODS: { value: RecognitionMethod; label: string; description: string }[] = [
  { value: 'STRAIGHT_LINE', label: 'Straight-Line', description: 'Equal amounts over the service period' },
  { value: 'PERCENTAGE_OF_COMPLETION', label: 'Percentage of Completion', description: 'Based on milestones or % complete' },
  { value: 'POINT_IN_TIME', label: 'Point in Time', description: 'Recognized at delivery/completion' }
];

const RECOGNITION_PERIODS: { value: RecognitionPeriod; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' }
];

const STATUS_OPTIONS: { value: RevenueScheduleStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export default function RevenueRecognitionView({
  orgId,
  currency,
  schedules,
  entries,
  customers,
  accounts,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onCreateEntry,
  onUpdateEntry,
  onPostJournal,
  onNotify
}: RevenueRecognitionViewProps) {
  // View state
  const [activeTab, setActiveTab] = useState<'schedules' | 'entries' | 'summary'>('schedules');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RevenueSchedule | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    description: '',
    totalAmount: 0,
    currency: currency,
    recognitionMethod: 'STRAIGHT_LINE' as RecognitionMethod,
    recognitionPeriod: 'MONTHLY' as RecognitionPeriod,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    deferredRevenueAccountId: '',
    revenueAccountId: '',
    sourceType: 'MANUAL' as 'INVOICE' | 'RECEIVABLE' | 'MANUAL',
    sourceReference: '',
    notes: ''
  });

  // Filters
  const liabilityAccounts = useMemo(() => 
    accounts.filter(a => a.class === 'LIABILITY' && !a.isHeader && !a.isDeleted),
    [accounts]
  );
  const revenueAccounts = useMemo(() => 
    accounts.filter(a => a.class === 'REVENUE' && !a.isHeader && !a.isDeleted),
    [accounts]
  );

  // Filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (s.isDeleted) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const customer = customers.find(c => c.id === s.customerId);
        return (
          s.description.toLowerCase().includes(search) ||
          s.sourceReference?.toLowerCase().includes(search) ||
          customer?.name.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [schedules, statusFilter, searchTerm, customers]);

  // Summary calculations
  const summary = useMemo(() => {
    const activeSchedules = schedules.filter(s => s.status === 'ACTIVE' && !s.isDeleted);
    return {
      totalDeferred: activeSchedules.reduce((sum, s) => sum + s.deferredBalance, 0),
      totalRecognized: schedules.filter(s => !s.isDeleted).reduce((sum, s) => sum + s.recognizedAmount, 0),
      activeCount: activeSchedules.length,
      dueForRecognition: RevenueRecognitionService.getSchedulesDueForRecognition(
        activeSchedules, 
        entries
      ).length
    };
  }, [schedules, entries]);

  // Customer summaries
  const customerSummaries = useMemo(() => 
    RevenueRecognitionService.calculateSummaryByCustomer(schedules.filter(s => !s.isDeleted)),
    [schedules]
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency || 'PHP'
    }).format(amount);
  };

  // Get customer name
  const getCustomerName = (customerId: string): string => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  // Get account info
  const getAccountName = (accountId: string): string => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : 'N/A';
  };

  // Get schedule entries
  const getScheduleEntries = (scheduleId: string): RevenueRecognitionEntry[] => {
    return entries.filter(e => e.scheduleId === scheduleId).sort((a, b) => 
      b.recognitionDate.localeCompare(a.recognitionDate)
    );
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      onNotify('error', 'Please select a customer');
      return;
    }
    if (!formData.totalAmount || formData.totalAmount <= 0) {
      onNotify('error', 'Please enter a valid amount');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      onNotify('error', 'Please enter start and end dates');
      return;
    }
    if (formData.startDate > formData.endDate) {
      onNotify('error', 'End date must be after start date');
      return;
    }
    if (!formData.deferredRevenueAccountId || !formData.revenueAccountId) {
      onNotify('error', 'Please select both deferred revenue and revenue accounts');
      return;
    }

    const customerName = getCustomerName(formData.customerId);

    if (editingSchedule) {
      onUpdateSchedule(editingSchedule.id, {
        ...formData,
        customerName,
        deferredBalance: formData.totalAmount - (editingSchedule.recognizedAmount || 0)
      });
      onNotify('success', 'Revenue schedule updated successfully');
    } else {
      const newSchedule = RevenueRecognitionService.createScheduleFromInvoice(
        orgId,
        formData.customerId,
        customerName,
        formData.totalAmount,
        formData.startDate,
        formData.endDate,
        formData.deferredRevenueAccountId,
        formData.revenueAccountId,
        {
          sourceType: formData.sourceType,
          sourceReference: formData.sourceReference,
          description: formData.description || `Deferred revenue - ${customerName}`,
          currency: formData.currency,
          recognitionMethod: formData.recognitionMethod,
          recognitionPeriod: formData.recognitionPeriod,
          notes: formData.notes
        }
      );
      onCreateSchedule(newSchedule);
      onNotify('success', 'Revenue schedule created successfully');
    }

    resetForm();
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      customerId: '',
      description: '',
      totalAmount: 0,
      currency: currency,
      recognitionMethod: 'STRAIGHT_LINE',
      recognitionPeriod: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      deferredRevenueAccountId: '',
      revenueAccountId: '',
      sourceType: 'MANUAL',
      sourceReference: '',
      notes: ''
    });
    setEditingSchedule(null);
    setShowForm(false);
  };

  // Edit schedule
  const handleEdit = (schedule: RevenueSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      customerId: schedule.customerId,
      description: schedule.description,
      totalAmount: schedule.totalAmount,
      currency: schedule.currency || currency,
      recognitionMethod: schedule.recognitionMethod,
      recognitionPeriod: schedule.recognitionPeriod || 'MONTHLY',
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      deferredRevenueAccountId: schedule.deferredRevenueAccountId,
      revenueAccountId: schedule.revenueAccountId,
      sourceType: schedule.sourceType,
      sourceReference: schedule.sourceReference || '',
      notes: schedule.notes || ''
    });
    setShowForm(true);
  };

  // Delete schedule
  const handleDelete = (schedule: RevenueSchedule) => {
    if (schedule.recognizedAmount > 0) {
      onNotify('warning', 'Cannot delete a schedule with recognized revenue. Cancel it instead.');
      return;
    }
    if (window.confirm(`Delete schedule "${schedule.description}"?`)) {
      onDeleteSchedule(schedule.id);
      onNotify('success', 'Schedule deleted');
    }
  };

  // Toggle pause/resume
  const handleToggleStatus = (schedule: RevenueSchedule) => {
    if (schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED') {
      onNotify('warning', 'Cannot modify a completed or cancelled schedule');
      return;
    }
    const newStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    onUpdateSchedule(schedule.id, { status: newStatus });
    onNotify('success', `Schedule ${newStatus === 'ACTIVE' ? 'resumed' : 'paused'}`);
  };

  // Run recognition for a schedule
  const handleRunRecognition = (schedule: RevenueSchedule) => {
    const scheduleEntries = getScheduleEntries(schedule.id);
    const periodsDue = RevenueRecognitionService.getPeriodsDueForRecognition(
      schedule, 
      scheduleEntries
    );

    if (periodsDue.length === 0) {
      onNotify('info', 'No periods due for recognition');
      return;
    }

    // Create recognition entries for all due periods
    let totalRecognized = 0;
    for (const period of periodsDue) {
      const entry = RevenueRecognitionService.createRecognitionEntry(schedule, period);
      onCreateEntry(entry);

      // Generate and post journal entry
      const { entry: journalEntry, lines } = RevenueRecognitionService.generateJournalEntry(
        schedule, 
        entry as RevenueRecognitionEntry
      );
      
      // Post the journal entry
      onPostJournal(journalEntry, lines);
      
      totalRecognized += period.amount;
    }

    // Update schedule
    const updates = RevenueRecognitionService.updateScheduleAfterRecognition(
      schedule,
      totalRecognized,
      new Date().toISOString().split('T')[0]
    );
    onUpdateSchedule(schedule.id, updates);

    onNotify('success', `Recognized ${formatCurrency(totalRecognized)} for ${periodsDue.length} period(s)`);
  };

  // Run all due recognitions
  const handleRunAllDue = () => {
    const dueSchedules = RevenueRecognitionService.getSchedulesDueForRecognition(
      schedules.filter(s => s.status === 'ACTIVE' && !s.isDeleted),
      entries
    );

    if (dueSchedules.length === 0) {
      onNotify('info', 'No schedules have periods due for recognition');
      return;
    }

    let totalSchedules = 0;
    let totalAmount = 0;

    for (const { schedule, periodsDue } of dueSchedules) {
      for (const period of periodsDue) {
        const entry = RevenueRecognitionService.createRecognitionEntry(schedule, period);
        onCreateEntry(entry);

        const { entry: journalEntry, lines } = RevenueRecognitionService.generateJournalEntry(
          schedule,
          entry as RevenueRecognitionEntry
        );
        onPostJournal(journalEntry, lines);
        
        totalAmount += period.amount;
      }

      const updates = RevenueRecognitionService.updateScheduleAfterRecognition(
        schedule,
        periodsDue.reduce((sum, p) => sum + p.amount, 0),
        new Date().toISOString().split('T')[0]
      );
      onUpdateSchedule(schedule.id, updates);
      totalSchedules++;
    }

    onNotify('success', `Processed ${totalSchedules} schedules, recognized ${formatCurrency(totalAmount)}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Revenue Recognition</h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage deferred revenue and recognition schedules</p>
        </div>
        <div className="flex gap-2">
          {summary.dueForRecognition > 0 && (
            <button
              onClick={handleRunAllDue}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Run All Due ({summary.dueForRecognition})
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="w-4 h-4" />
            Deferred Balance
          </div>
          <div className="text-lg font-bold text-brand">
            {formatCurrency(summary.totalDeferred)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            Total Recognized
          </div>
          <div className="text-lg font-bold text-brand">
            {formatCurrency(summary.totalRecognized)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            Active Schedules
          </div>
          <div className="text-lg font-bold text-brand">
            {summary.activeCount}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Due for Recognition
          </div>
          <div className="text-lg font-bold text-brand">
            {summary.dueForRecognition}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'schedules', label: 'Schedules', icon: Calendar },
            { id: 'entries', label: 'Recognition History', icon: History },
            { id: 'summary', label: 'Customer Summary', icon: PieChart }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'schedules' && (
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search schedules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="ALL">All Status</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recognized</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deferred</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No revenue schedules found. Create one to get started!
                  </td>
                </tr>
              ) : (
                filteredSchedules.map(schedule => {
                  const isExpanded = expandedRow === schedule.id;
                  const scheduleEntries = getScheduleEntries(schedule.id);
                  const periodsDue = RevenueRecognitionService.getPeriodsDueForRecognition(
                    schedule, 
                    scheduleEntries
                  );
                  const statusInfo = RevenueRecognitionService.getStatusInfo(schedule.status);
                  const progressPercent = schedule.totalAmount > 0 
                    ? Math.round((schedule.recognizedAmount / schedule.totalAmount) * 100)
                    : 0;

                  return (
                    <React.Fragment key={schedule.id}>
                      <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-brand/10' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : schedule.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div>
                              <div className="font-medium text-gray-900">{schedule.description}</div>
                              {schedule.sourceReference && (
                                <div className="text-xs text-gray-500">Ref: {schedule.sourceReference}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {schedule.customerName || getCustomerName(schedule.customerId)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(schedule.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-brand">
                          {formatCurrency(schedule.recognizedAmount)}
                          <div className="text-xs text-gray-400">{progressPercent}%</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-brand">
                          {formatCurrency(schedule.deferredBalance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {schedule.startDate} to {schedule.endDate}
                          <div className="text-xs text-gray-400">
                            {RevenueRecognitionService.getMethodLabel(schedule.recognitionMethod)}
                            {schedule.recognitionPeriod && ` - ${RevenueRecognitionService.getPeriodLabel(schedule.recognitionPeriod)}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {periodsDue.length > 0 && schedule.status === 'ACTIVE' && (
                            <span className="ml-1 inline-flex px-2 py-1 text-xs font-medium rounded-full bg-brand/10 text-brand">
                              {periodsDue.length} due
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {schedule.status === 'ACTIVE' && periodsDue.length > 0 && (
                              <button
                                onClick={() => handleRunRecognition(schedule)}
                                className="p-1.5 text-brand hover:bg-brand-light rounded-lg"
                                title="Run Recognition"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleStatus(schedule)}
                              className="p-1.5 rounded-lg text-brand hover:bg-brand-light"
                              title={schedule.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                              disabled={schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED'}
                            >
                              {schedule.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleEdit(schedule)}
                              className="p-1.5 text-brand hover:bg-brand-light rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(schedule)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-medium text-gray-900 mb-3">Schedule Details</h4>
                                <dl className="space-y-2 text-sm">
                                  <div className="flex">
                                    <dt className="w-40 text-gray-500">Deferred Account:</dt>
                                    <dd className="text-gray-900">{getAccountName(schedule.deferredRevenueAccountId)}</dd>
                                  </div>
                                  <div className="flex">
                                    <dt className="w-40 text-gray-500">Revenue Account:</dt>
                                    <dd className="text-gray-900">{getAccountName(schedule.revenueAccountId)}</dd>
                                  </div>
                                  <div className="flex">
                                    <dt className="w-40 text-gray-500">Last Recognition:</dt>
                                    <dd className="text-gray-900">{schedule.lastRecognitionDate || 'None'}</dd>
                                  </div>
                                  <div className="flex">
                                    <dt className="w-40 text-gray-500">Next Recognition:</dt>
                                    <dd className="text-gray-900">{schedule.nextRecognitionDate || 'N/A'}</dd>
                                  </div>
                                  {schedule.notes && (
                                    <div className="flex">
                                      <dt className="w-40 text-gray-500">Notes:</dt>
                                      <dd className="text-gray-900">{schedule.notes}</dd>
                                    </div>
                                  )}
                                </dl>
                                {/* Progress bar */}
                                <div className="mt-4">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Recognition Progress</span>
                                    <span>{progressPercent}%</span>
                                  </div>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-brand transition-all"
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                  <History className="w-4 h-4" /> Recognition History
                                </h4>
                                {scheduleEntries.length === 0 ? (
                                  <p className="text-sm text-gray-500">No recognition entries yet</p>
                                ) : (
                                  <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
                                    {scheduleEntries.slice(0, 10).map(entry => (
                                      <li key={entry.id} className="flex items-center gap-3 text-gray-700">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span>{entry.recognitionDate}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="font-medium">{formatCurrency(entry.amount)}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                          entry.status === 'POSTED' ? 'bg-brand/10 text-brand' :
                                          entry.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {entry.status}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Entries Tab */}
      {activeTab === 'entries' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Journal Ref</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No recognition entries yet
                  </td>
                </tr>
              ) : (
                entries
                  .sort((a, b) => b.recognitionDate.localeCompare(a.recognitionDate))
                  .map(entry => {
                    const schedule = schedules.find(s => s.id === entry.scheduleId);
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.recognitionDate}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {entry.periodStart} to {entry.periodEnd}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {schedule?.description || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-brand">
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            entry.status === 'POSTED' ? 'bg-brand/10 text-brand' :
                            entry.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {entry.journalEntryId || '-'}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedules</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Deferred</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recognized</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customerSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No customer data available
                  </td>
                </tr>
              ) : (
                customerSummaries.map(summary => {
                  const progressPercent = summary.totalDeferred > 0
                    ? Math.round((summary.totalRecognized / summary.totalDeferred) * 100)
                    : 0;
                  return (
                    <tr key={summary.customerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {summary.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {summary.scheduleCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(summary.totalDeferred)}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand">
                        {formatCurrency(summary.totalRecognized)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#F47721]">
                        {formatCurrency(summary.totalRemaining)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[100px]">
                            <div 
                              className="h-full bg-brand"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{progressPercent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <ModalPortal>
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-sm max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingSchedule ? 'Edit Revenue Schedule' : 'New Revenue Schedule'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="e.g., Tuition Fee - First Semester"
                  required
                />
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount *</label>
                  <input
                    type="number"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    placeholder="PHP"
                  />
                </div>
              </div>

              {/* Recognition Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recognition Method *</label>
                <select
                  value={formData.recognitionMethod}
                  onChange={(e) => setFormData({ ...formData, recognitionMethod: e.target.value as RecognitionMethod })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  {RECOGNITION_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {RECOGNITION_METHODS.find(m => m.value === formData.recognitionMethod)?.description}
                </p>
              </div>

              {/* Recognition Period (for straight-line) */}
              {formData.recognitionMethod === 'STRAIGHT_LINE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recognition Period *</label>
                  <select
                    value={formData.recognitionPeriod}
                    onChange={(e) => setFormData({ ...formData, recognitionPeriod: e.target.value as RecognitionPeriod })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  >
                    {RECOGNITION_PERIODS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    required
                  />
                </div>
              </div>

              {/* Account Mapping */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deferred Revenue Account *</label>
                  <select
                    value={formData.deferredRevenueAccountId}
                    onChange={(e) => setFormData({ ...formData, deferredRevenueAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    required
                  >
                    <option value="">Select Liability Account</option>
                    {liabilityAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Account *</label>
                  <select
                    value={formData.revenueAccountId}
                    onChange={(e) => setFormData({ ...formData, revenueAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    required
                  >
                    <option value="">Select Revenue Account</option>
                    {revenueAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Reference */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                  <select
                    value={formData.sourceType}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  >
                    <option value="MANUAL">Manual Entry</option>
                    <option value="INVOICE">From Invoice</option>
                    <option value="RECEIVABLE">From Receivable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={formData.sourceReference}
                    onChange={(e) => setFormData({ ...formData, sourceReference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  rows={2}
                  placeholder="Internal notes..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
}

