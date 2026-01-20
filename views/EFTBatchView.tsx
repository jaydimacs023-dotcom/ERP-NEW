import React, { useState, useMemo } from 'react';
import { 
  EFTBatch, EFTTransaction, BankAccount, Vendor, Payable
} from '../types';
import EmptyState from '../components/EmptyState';
import {
  Zap, Plus, Search, Filter, ChevronDown, Download, Upload,
  X, CheckCircle, Clock, XCircle, Send, FileText, AlertCircle,
  Building, Calendar, Banknote, ArrowRight, RotateCcw, Eye, Trash2
} from 'lucide-react';

interface EFTBatchViewProps {
  orgId: string;
  batches: EFTBatch[];
  bankAccounts: BankAccount[];
  vendors: Vendor[];
  payables: Payable[];
  currentUserId?: string;
  onCreateBatch: (batch: EFTBatch) => void;
  onUpdateBatch: (id: string, updates: Partial<EFTBatch>) => void;
  onDeleteBatch?: (id: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type BatchStatus = 'DRAFT' | 'PENDING' | 'SUBMITTED' | 'PROCESSED' | 'PARTIALLY_PROCESSED' | 'FAILED' | 'CANCELLED';

const BATCH_STATUS_CONFIG: Record<BatchStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: <FileText size={14} /> },
  PENDING: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: <Clock size={14} /> },
  SUBMITTED: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <Send size={14} /> },
  PROCESSED: { label: 'Processed', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: <CheckCircle size={14} /> },
  PARTIALLY_PROCESSED: { label: 'Partial', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: <AlertCircle size={14} /> },
  FAILED: { label: 'Failed', color: 'text-rose-600', bgColor: 'bg-rose-50', icon: <XCircle size={14} /> },
  CANCELLED: { label: 'Cancelled', color: 'text-slate-400', bgColor: 'bg-slate-50', icon: <XCircle size={14} /> },
};

const EFTBatchView: React.FC<EFTBatchViewProps> = ({
  orgId,
  batches,
  bankAccounts,
  vendors,
  payables,
  currentUserId,
  onCreateBatch,
  onUpdateBatch,
  onDeleteBatch,
  onNotify
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<EFTBatch | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all');

  // Form state
  const [formData, setFormData] = useState({
    bankAccountId: '',
    fileFormat: 'ISO20022' as 'ISO20022' | 'NACHA' | 'BACS' | 'SEPA',
    paymentDate: new Date().toISOString().slice(0, 10),
    description: '',
    selectedPayableIds: [] as string[],
  });

  // Filter data
  const orgBatches = useMemo(() => 
    batches.filter(b => b.orgId === orgId && !b.isDeleted),
    [batches, orgId]
  );

  const orgBankAccounts = useMemo(() => 
    bankAccounts.filter(b => b.orgId === orgId && !b.isDeleted && b.type !== 'CASH'),
    [bankAccounts, orgId]
  );

  const orgVendors = useMemo(() => 
    vendors.filter(v => v.orgId === orgId && !v.isDeleted),
    [vendors, orgId]
  );

  const orgPayables = useMemo(() => 
    payables.filter(p => p.orgId === orgId && !p.isDeleted && 
      p.paymentMethod === 'EFT' &&
      (p.status === 'approved' || p.status === 'partially_paid')),
    [payables, orgId]
  );

  // Filter batches
  const filteredBatches = useMemo(() => {
    return orgBatches.filter(b => {
      const matchesSearch = b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orgBatches, searchTerm, statusFilter]);

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const drafts = orgBatches.filter(b => b.status === 'DRAFT');
    const pending = orgBatches.filter(b => b.status === 'PENDING' || b.status === 'SUBMITTED');
    const processed = orgBatches.filter(b => b.status === 'PROCESSED');
    
    return {
      draftCount: drafts.length,
      draftAmount: drafts.reduce((sum, b) => sum + b.totalAmount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, b) => sum + b.totalAmount, 0),
      processedCount: processed.length,
      processedAmount: processed.reduce((sum, b) => sum + b.totalAmount, 0),
      totalTransactions: orgBatches.reduce((sum, b) => sum + b.transactionCount, 0),
    };
  }, [orgBatches]);

  // Get next batch number
  const getNextBatchNumber = () => {
    const maxNum = orgBatches.reduce((max, b) => {
      const num = parseInt(b.batchNumber.replace(/\D/g, '')) || 0;
      return num > max ? num : max;
    }, 0);
    return `EFT-${new Date().getFullYear()}-${String(maxNum + 1).padStart(4, '0')}`;
  };

  // Generate ISO20022 XML
  const generateISO20022 = (batch: EFTBatch): string => {
    const bank = orgBankAccounts.find(b => b.id === batch.bankAccountId);
    const now = new Date().toISOString();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${batch.batchNumber}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${batch.transactionCount}</NbOfTxs>
      <CtrlSum>${batch.totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${bank?.bankName || 'Originator'}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${batch.batchNumber}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${batch.transactionCount}</NbOfTxs>
      <CtrlSum>${batch.totalAmount.toFixed(2)}</CtrlSum>
      <ReqdExctnDt>${batch.paymentDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${bank?.bankName || 'Debtor'}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${bank?.accountNumber || ''}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${bank?.bankName?.substring(0, 8).toUpperCase() || 'BANKPH00'}</BIC>
        </FinInstnId>
      </DbtrAgt>`;

    batch.transactions.forEach((txn, idx) => {
      const vendor = orgVendors.find(v => v.id === txn.vendorId);
      xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${batch.batchNumber}-${String(idx + 1).padStart(3, '0')}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="PHP">${txn.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${txn.beneficiaryName}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${txn.beneficiaryAccount}</IBAN>
          </Id>
        </CdtrAcct>
        <CdtrAgt>
          <FinInstnId>
            <BIC>${txn.beneficiaryBankCode || 'BANKPH00'}</BIC>
          </FinInstnId>
        </CdtrAgt>
        <RmtInf>
          <Ustrd>${txn.reference || 'Payment'}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
    });

    xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

    return xml;
  };

  // Generate NACHA file
  const generateNACHA = (batch: EFTBatch): string => {
    const bank = orgBankAccounts.find(b => b.id === batch.bankAccountId);
    const now = new Date();
    const fileDate = now.toISOString().slice(2, 10).replace(/-/g, '');
    const fileTime = now.toTimeString().slice(0, 5).replace(':', '');
    
    let nacha = '';
    
    // File Header Record (1)
    nacha += `1${('01').padStart(2, '0')}${('0').padStart(10, ' ')}${('0').padStart(10, ' ')}`;
    nacha += `${fileDate}${fileTime}A094101${('0').padStart(23, ' ')}${bank?.bankName?.substring(0, 23).padEnd(23, ' ') || ''.padEnd(23, ' ')}`;
    nacha += `${'AT-ERP'.padEnd(23, ' ')}${''.padEnd(8, ' ')}\n`;
    
    // Batch Header Record (5)
    nacha += `5200${(bank?.bankName || '').substring(0, 16).padEnd(16, ' ')}`;
    nacha += `${''.padEnd(20, ' ')}${('000000000').padStart(10, '0')}PPD`;
    nacha += `${'PAYROLL'.padEnd(10, ' ')}${batch.paymentDate.replace(/-/g, '').substring(2)}`;
    nacha += `${batch.paymentDate.replace(/-/g, '').substring(2)}${''.padEnd(3, ' ')}1`;
    nacha += `${('09100001').padStart(8, '0')}0000001\n`;
    
    // Entry Detail Records (6)
    batch.transactions.forEach((txn, idx) => {
      nacha += `6${('22').padStart(2, '0')}${(txn.beneficiaryBankCode || '000000000').padStart(9, '0')}`;
      nacha += `${txn.beneficiaryAccount.padEnd(17, ' ')}`;
      nacha += `${(Math.round(txn.amount * 100)).toString().padStart(10, '0')}`;
      nacha += `${('').padEnd(15, ' ')}${txn.beneficiaryName.substring(0, 22).padEnd(22, ' ')}`;
      nacha += `${'  '}0${('09100001').padStart(8, '0')}${String(idx + 1).padStart(7, '0')}\n`;
    });
    
    // Batch Control Record (8)
    const totalAmount = batch.transactions.reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
    nacha += `8200${String(batch.transactionCount).padStart(6, '0')}`;
    nacha += `${('0').padStart(10, '0')}${totalAmount.toString().padStart(12, '0')}`;
    nacha += `${('000000000').padStart(10, '0')}${''.padEnd(19, ' ')}${''.padEnd(6, ' ')}`;
    nacha += `${('09100001').padStart(8, '0')}0000001\n`;
    
    // File Control Record (9)
    nacha += `9000001000001${String(batch.transactionCount).padStart(8, '0')}`;
    nacha += `${('0').padStart(10, '0')}${totalAmount.toString().padStart(12, '0')}`;
    nacha += `${''.padEnd(39, ' ')}\n`;
    
    return nacha;
  };

  // Handlers
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bankAccountId) {
      onNotify('error', 'Please select a bank account.');
      return;
    }
    if (formData.selectedPayableIds.length === 0) {
      onNotify('error', 'Please select at least one payable.');
      return;
    }

    // Build transactions from selected payables
    const transactions: EFTTransaction[] = formData.selectedPayableIds.map((payableId, idx) => {
      const payable = orgPayables.find(p => p.id === payableId);
      const vendor = payable ? orgVendors.find(v => v.id === payable.vendorId) : null;
      
      return {
        id: `eft-txn-${Date.now()}-${idx}`,
        batchId: '',
        payableId,
        vendorId: payable?.vendorId || '',
        beneficiaryName: vendor?.name || payable?.vendor || 'Unknown',
        beneficiaryAccount: vendor?.bankAccountNumber || '',
        beneficiaryBankCode: vendor?.bankCode || '',
        amount: payable?.balance || 0,
        reference: payable?.invoiceNumber || '',
        status: 'PENDING',
      };
    });

    const batchNumber = getNextBatchNumber();
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    const newBatch: EFTBatch = {
      id: `eft-batch-${Date.now()}`,
      orgId,
      batchNumber,
      bankAccountId: formData.bankAccountId,
      fileFormat: formData.fileFormat,
      paymentDate: formData.paymentDate,
      description: formData.description,
      transactions,
      transactionCount: transactions.length,
      totalAmount,
      status: 'DRAFT',
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };

    onCreateBatch(newBatch);
    onNotify('success', `EFT Batch ${batchNumber} created with ${transactions.length} transactions.`);
    setShowCreateModal(false);
    resetForm();
  };

  const handleSubmit = (batch: EFTBatch) => {
    if (batch.status !== 'DRAFT' && batch.status !== 'PENDING') {
      onNotify('error', 'Only draft or pending batches can be submitted.');
      return;
    }

    onUpdateBatch(batch.id, {
      status: 'SUBMITTED',
      submittedBy: currentUserId,
      submittedAt: new Date().toISOString(),
    });

    onNotify('success', `Batch ${batch.batchNumber} submitted for processing.`);
  };

  const handleDownloadFile = (batch: EFTBatch) => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (batch.fileFormat === 'ISO20022' || batch.fileFormat === 'SEPA') {
      content = generateISO20022(batch);
      filename = `${batch.batchNumber}.xml`;
      mimeType = 'application/xml';
    } else {
      content = generateNACHA(batch);
      filename = `${batch.batchNumber}.txt`;
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onUpdateBatch(batch.id, { fileGenerated: true });
    onNotify('success', `EFT file ${filename} downloaded.`);
  };

  const handleMarkProcessed = (batch: EFTBatch) => {
    onUpdateBatch(batch.id, {
      status: 'PROCESSED',
      processedAt: new Date().toISOString(),
    });
    onNotify('success', `Batch ${batch.batchNumber} marked as processed.`);
  };

  const handleCancel = (batch: EFTBatch) => {
    if (batch.status === 'PROCESSED') {
      onNotify('error', 'Cannot cancel a processed batch.');
      return;
    }

    onUpdateBatch(batch.id, {
      status: 'CANCELLED',
    });
    onNotify('info', `Batch ${batch.batchNumber} cancelled.`);
  };

  const resetForm = () => {
    setFormData({
      bankAccountId: '',
      fileFormat: 'ISO20022',
      paymentDate: new Date().toISOString().slice(0, 10),
      description: '',
      selectedPayableIds: [],
    });
  };

  const togglePayableSelection = (payableId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedPayableIds: prev.selectedPayableIds.includes(payableId)
        ? prev.selectedPayableIds.filter(id => id !== payableId)
        : [...prev.selectedPayableIds, payableId]
    }));
  };

  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const getBankName = (id: string) => orgBankAccounts.find(b => b.id === id)?.bankName || 'Unknown';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Zap className="text-violet-600" size={28} />
            EFT Batch Management
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Create and manage electronic fund transfer batches.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-md font-medium text-sm"
        >
          <Plus size={18} /> New EFT Batch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Draft Batches</p>
          <p className="text-2xl font-black mt-1 text-slate-600">{summaryMetrics.draftCount}</p>
          <p className="text-xs text-slate-500">₱{formatCurrency(summaryMetrics.draftAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Pending / Submitted</p>
          <p className="text-2xl font-black mt-1 text-amber-600">{summaryMetrics.pendingCount}</p>
          <p className="text-xs text-amber-500">₱{formatCurrency(summaryMetrics.pendingAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Processed</p>
          <p className="text-2xl font-black mt-1 text-emerald-600">{summaryMetrics.processedCount}</p>
          <p className="text-xs text-emerald-500">₱{formatCurrency(summaryMetrics.processedAmount)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Total Transactions</p>
          <p className="text-2xl font-black mt-1 text-violet-600">{summaryMetrics.totalTransactions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search batches..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BatchStatus | 'all')}
            className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm appearance-none"
          >
            <option value="all">All Statuses</option>
            {Object.entries(BATCH_STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch #</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank / Date</th>
              <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Format</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Txns</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBatches.length > 0 ? (
              filteredBatches
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(batch => {
                  const statusConfig = BATCH_STATUS_CONFIG[batch.status];
                  
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-violet-600">{batch.batchNumber}</span>
                        {batch.description && (
                          <p className="text-xs text-slate-400 mt-0.5">{batch.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{getBankName(batch.bankAccountId)}</p>
                        <p className="text-xs text-slate-400">{batch.paymentDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 text-slate-600 rounded">
                          {batch.fileFormat}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-mono font-semibold text-slate-600">{batch.transactionCount}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-semibold text-slate-700">₱{formatCurrency(batch.totalAmount)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setSelectedBatch(batch); setShowDetailModal(true); }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {(batch.status === 'DRAFT' || batch.status === 'PENDING' || batch.status === 'SUBMITTED') && (
                            <button
                              onClick={() => handleDownloadFile(batch)}
                              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                              title="Download EFT File"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          {batch.status === 'DRAFT' && (
                            <button
                              onClick={() => handleSubmit(batch)}
                              className="p-1.5 hover:bg-violet-50 rounded-lg text-violet-600 transition-colors"
                              title="Submit"
                            >
                              <Send size={16} />
                            </button>
                          )}
                          {batch.status === 'SUBMITTED' && (
                            <button
                              onClick={() => handleMarkProcessed(batch)}
                              className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
                              title="Mark Processed"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {batch.status !== 'PROCESSED' && batch.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancel(batch)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                              title="Cancel"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <EmptyState 
                    icon={<Zap className="text-slate-300" size={48} />}
                    title="No EFT batches found"
                    description="Create your first EFT batch to get started."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">New EFT Batch</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Bank Account *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.bankAccountId}
                    onChange={e => setFormData({...formData, bankAccountId: e.target.value})}
                  >
                    <option value="">Select Bank...</option>
                    {orgBankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">File Format *</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                    value={formData.fileFormat}
                    onChange={e => setFormData({...formData, fileFormat: e.target.value as 'ISO20022' | 'NACHA' | 'BACS' | 'SEPA'})}
                  >
                    <option value="ISO20022">ISO 20022 (XML)</option>
                    <option value="SEPA">SEPA Credit Transfer</option>
                    <option value="NACHA">NACHA / ACH</option>
                    <option value="BACS">BACS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Payment Date *</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.paymentDate}
                    onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Description</label>
                  <input 
                    type="text"
                    placeholder="Optional description..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              {/* Payables Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  Select Payables for EFT ({formData.selectedPayableIds.length} selected)
                </label>
                <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                  {orgPayables.length > 0 ? (
                    orgPayables.map(p => {
                      const vendor = orgVendors.find(v => v.id === p.vendorId);
                      const isSelected = formData.selectedPayableIds.includes(p.id);
                      
                      return (
                        <div 
                          key={p.id}
                          onClick={() => togglePayableSelection(p.id)}
                          className={`flex items-center justify-between p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                            isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                            }`}>
                              {isSelected && <CheckCircle className="text-white" size={12} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">{vendor?.name || p.vendor}</p>
                              <p className="text-xs text-slate-400">{p.invoiceNumber} • Due: {p.dueDate}</p>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold text-slate-600">
                            ₱{formatCurrency(p.balance)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No EFT payables available. Make sure payables have payment method set to EFT.
                    </div>
                  )}
                </div>
                {formData.selectedPayableIds.length > 0 && (
                  <div className="flex justify-end">
                    <p className="text-sm font-semibold text-slate-600">
                      Total: ₱{formatCurrency(
                        orgPayables
                          .filter(p => formData.selectedPayableIds.includes(p.id))
                          .reduce((sum, p) => sum + p.balance, 0)
                      )}
                    </p>
                  </div>
                )}
              </div>
            </form>

            <div className="p-6 border-t bg-slate-50/50 flex gap-3">
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)} 
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate as any}
                disabled={formData.selectedPayableIds.length === 0 || !formData.bankAccountId}
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-600 text-white rounded-xl shadow-md">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{selectedBatch.batchNumber}</h3>
                  <p className="text-xs text-slate-500">{selectedBatch.transactionCount} transactions • ₱{formatCurrency(selectedBatch.totalAmount)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Batch Info */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Bank</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{getBankName(selectedBatch.bankAccountId)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Payment Date</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{selectedBatch.paymentDate}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">File Format</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{selectedBatch.fileFormat}</p>
                </div>
              </div>

              {/* Transactions */}
              <h4 className="text-sm font-bold text-slate-700 mb-3">Transactions</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Beneficiary</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Account</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Reference</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBatch.transactions.map(txn => (
                      <tr key={txn.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{txn.beneficiaryName}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-600">{txn.beneficiaryAccount || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{txn.reference || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">₱{formatCurrency(txn.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            txn.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' :
                            txn.status === 'FAILED' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex gap-3">
              <button 
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
              {(selectedBatch.status === 'DRAFT' || selectedBatch.status === 'PENDING' || selectedBatch.status === 'SUBMITTED') && (
                <button 
                  onClick={() => { handleDownloadFile(selectedBatch); setShowDetailModal(false); }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Download EFT File
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EFTBatchView;
