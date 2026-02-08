/**
 * Three-Way Matching Dashboard Component
 * 
 * Displays matching status of invoices against their corresponding POs and GRs
 * Highlights discrepancies and allows approval/exception handling
 */

import React, { useState, useMemo } from 'react';
import {
  ChartOfAccount,
  GoodsReceipt,
  GoodsReceiptLine,
  Payable,
  PurchaseOrder,
  PurchaseOrderLine,
  Vendor
} from '../types';
import {
  ThreeWayMatchingService,
  ThreeWayMatchResult,
  MatchingStatus,
  DiscrepancyType,
  DiscrepancyDetail
} from '../services/ThreeWayMatchingService';
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Download
} from 'lucide-react';

interface MatchingDashboardProps {
  payables: Payable[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  poLines: PurchaseOrderLine[];
  grLines: GoodsReceiptLine[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  onApproveException?: (payableId: string, notes: string) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type FilterStatus = 'all' | 'fully_matched' | 'partially_matched' | 'unmatched' | 'blocked';

const MatchingDashboard: React.FC<MatchingDashboardProps> = ({
  payables,
  purchaseOrders,
  goodsReceipts,
  poLines,
  grLines,
  vendors,
  onApproveException,
  onNotify
}) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exceptionNotes, setExceptionNotes] = useState<Record<string, string>>({});
  const [showExceptionModal, setShowExceptionModal] = useState<string | null>(null);

  // Perform 3-way matching for all payables
  const matchResults = useMemo(() => {
    return payables.map(payable => {
      const po = purchaseOrders.find(p => p.id === payable.purchaseOrderId);
      const gr = goodsReceipts.find(g => g.id === payable.goodsReceiptId);
      const vendor = vendors.find(v => v.id === payable.vendorId);
      const poLinesForPO = po ? poLines.filter(l => l.purchaseOrderId === po.id) : [];
      const grLinesForGR = gr ? grLines.filter(l => l.goodsReceiptId === gr.id) : [];

      return {
        payable,
        result: ThreeWayMatchingService.performThreeWayMatch(
          po || null,
          gr || null,
          payable,
          grLinesForGR,
          poLinesForPO,
          vendor
        )
      };
    });
  }, [payables, purchaseOrders, goodsReceipts, poLines, grLines, vendors]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    return ThreeWayMatchingService.getSummaryStats(matchResults.map(m => m.result));
  }, [matchResults]);

  // Apply filters
  const filteredResults = useMemo(() => {
    return matchResults.filter(({ result }) => {
      // Filter by status
      if (filterStatus !== 'all') {
        if (filterStatus === 'blocked' && result.blockers.length === 0) return false;
        if (filterStatus === 'fully_matched' && result.matchingStatus !== MatchingStatus.FULLY_MATCHED) return false;
        if (filterStatus === 'partially_matched' && result.matchingStatus !== MatchingStatus.PARTIALLY_MATCHED) return false;
        if (filterStatus === 'unmatched' && result.matchingStatus !== MatchingStatus.UNMATCHED) return false;
      }

      // Filter by search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          result.invoiceNumber.toLowerCase().includes(term) ||
          result.vendorName.toLowerCase().includes(term) ||
          result.poNumber.toLowerCase().includes(term) ||
          (result.grNumber && result.grNumber.toLowerCase().includes(term))
        );
      }

      return true;
    });
  }, [matchResults, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
          <div className="text-2xl font-bold text-orange-700">{summaryStats.totalInvoices}</div>
          <div className="text-sm text-[#F47721]">Total Invoices</div>
        </div>
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="text-2xl font-bold text-green-700">{summaryStats.fullyMatched}</div>
          <div className="text-sm text-green-600">Fully Matched</div>
        </div>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
          <div className="text-2xl font-bold text-amber-700">{summaryStats.partiallyMatched}</div>
          <div className="text-sm text-amber-600">Partially Matched</div>
        </div>
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <div className="text-2xl font-bold text-red-700">{summaryStats.unmatched}</div>
          <div className="text-sm text-red-600">Unmatched</div>
        </div>
        <div className="p-4 rounded-lg bg-red-100 border border-red-300">
          <div className="text-lg font-bold text-red-800">${summaryStats.blockedAmount.toFixed(2)}</div>
          <div className="text-sm text-red-700">Blocked Amount</div>
        </div>
      </div>

      {/* Amount Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="font-semibold text-gray-700">Approved to Pay</div>
          <div className="text-xl font-bold text-green-600">${summaryStats.approvedAmount.toFixed(2)}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="font-semibold text-gray-700">Needs Approval</div>
          <div className="text-xl font-bold text-amber-600">${summaryStats.warningAmount.toFixed(2)}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="font-semibold text-gray-700">Blocked</div>
          <div className="text-xl font-bold text-red-600">${summaryStats.blockedAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search invoice, vendor, PO, or GR..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400"
        >
          <option value="all">All Invoices</option>
          <option value="fully_matched">Fully Matched</option>
          <option value="partially_matched">Partially Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No invoices match filters</div>
        ) : (
          filteredResults.map(({ payable, result }) => (
            <MatchResultCard
              key={payable.id}
              result={result}
              payable={payable}
              isExpanded={expandedId === payable.id}
              onToggleExpand={() => setExpandedId(expandedId === payable.id ? null : payable.id)}
              onApproveException={() => {
                if (onApproveException) {
                  onApproveException(payable.id, exceptionNotes[payable.id] || '');
                  onNotify('success', 'Exception approved. Invoice ready for payment.');
                  setShowExceptionModal(null);
                }
              }}
              onShowExceptionModal={() => setShowExceptionModal(payable.id)}
              isShowingExceptionModal={showExceptionModal === payable.id}
              exceptionNotes={exceptionNotes[payable.id] || ''}
              onExceptionNotesChange={(notes) =>
                setExceptionNotes({ ...exceptionNotes, [payable.id]: notes })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

interface MatchResultCardProps {
  result: ThreeWayMatchResult;
  payable: Payable;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApproveException: () => void;
  onShowExceptionModal: () => void;
  isShowingExceptionModal: boolean;
  exceptionNotes: string;
  onExceptionNotesChange: (notes: string) => void;
}

const MatchResultCard: React.FC<MatchResultCardProps> = ({
  result,
  payable,
  isExpanded,
  onToggleExpand,
  onApproveException,
  onShowExceptionModal,
  isShowingExceptionModal,
  exceptionNotes,
  onExceptionNotesChange
}) => {
  const statusColor = ThreeWayMatchingService.getStatusColor(result.matchingStatus);
  const statusLabel = ThreeWayMatchingService.getStatusLabel(result.matchingStatus);

  const getStatusIcon = () => {
    switch (result.matchingStatus) {
      case MatchingStatus.FULLY_MATCHED:
        return <Check className="text-green-600" size={20} />;
      case MatchingStatus.PARTIALLY_MATCHED:
        return <AlertTriangle className="text-amber-600" size={20} />;
      case MatchingStatus.UNMATCHED:
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return <Info className="text-[#F47721]" size={20} />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header Row */}
      <div
        className={`p-4 cursor-pointer hover:bg-gray-50 flex items-center gap-4 justify-between ${statusColor}`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4 flex-1">
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          {getStatusIcon()}
          <div>
            <div className="font-semibold">{result.invoiceNumber}</div>
            <div className="text-sm text-gray-600">{result.vendorName}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-semibold">${result.totalInvoiceAmount.toFixed(2)}</div>
          <div className="text-sm font-medium">{statusLabel}</div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2">
          {result.blockers.length > 0 && (
            <span className="px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
              {result.blockers.length} Blocker{result.blockers.length !== 1 ? 's' : ''}
            </span>
          )}
          {result.warnings.length > 0 && (
            <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded">
              {result.warnings.length} Warning{result.warnings.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          {/* Document References */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-semibold text-gray-700">Purchase Order</div>
              <div className="text-lg font-bold text-gray-900">{result.poNumber}</div>
              <div className="text-xs text-gray-500">PO Amount: ${result.totalPOAmount.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-semibold text-gray-700">Goods Receipt</div>
              <div className="text-lg font-bold text-gray-900">{result.grNumber || 'N/A'}</div>
              <div className="text-xs text-gray-500">GR Amount: ${result.totalGRAmount.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-semibold text-gray-700">Invoice</div>
              <div className="text-lg font-bold text-gray-900">{result.invoiceNumber}</div>
              <div className="text-xs text-gray-500">Invoice Amount: ${result.totalInvoiceAmount.toFixed(2)}</div>
            </div>
          </div>

          {/* Amount Matching Summary */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded text-sm">
            <div className="font-semibold text-orange-900 mb-2">Amount Reconciliation</div>
            <div className="space-y-1 text-orange-800">
              <div>
                <span className="font-medium">PO Total:</span> ${result.totalPOAmount.toFixed(2)}
              </div>
              <div>
                <span className="font-medium">GR Total:</span> ${result.totalGRAmount.toFixed(2)}
                {result.totalPOAmount !== result.totalGRAmount && (
                  <span className="ml-2 text-red-600">
                    (Variance: ${Math.abs(result.totalPOAmount - result.totalGRAmount).toFixed(2)})
                  </span>
                )}
              </div>
              <div>
                <span className="font-medium">Invoice Total:</span> ${result.totalInvoiceAmount.toFixed(2)}
                {result.totalGRAmount !== result.totalInvoiceAmount && (
                  <span className="ml-2 text-red-600">
                    (Variance: ${Math.abs(result.totalGRAmount - result.totalInvoiceAmount).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Blockers (Critical - Prevents Payment) */}
          {result.blockers.length > 0 && (
            <DiscrepancySection
              title="🛑 Critical Issues (Blocks Payment)"
              discrepancies={result.blockers}
              variant="danger"
            />
          )}

          {/* Warnings (Major - Needs Approval) */}
          {result.warnings.length > 0 && (
            <DiscrepancySection
              title="⚠️ Warnings (Requires Approval)"
              discrepancies={result.warnings}
              variant="warning"
            />
          )}

          {/* Info (Minor - FYI) */}
          {result.info.length > 0 && (
            <DiscrepancySection
              title="ℹ️ Information (Minor)"
              discrepancies={result.info}
              variant="info"
            />
          )}

          {/* Line-by-Line Matching */}
          {result.lineMatches.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-gray-900">Line Item Matching</div>
              <div className="grid gap-2">
                {result.lineMatches.map((lineMatch, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">{lineMatch.poLine?.description || 'Unknown Item'}</div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        lineMatch.matchingStatus === MatchingStatus.FULLY_MATCHED
                          ? 'bg-green-100 text-green-800'
                          : lineMatch.matchingStatus === MatchingStatus.PARTIALLY_MATCHED
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {ThreeWayMatchingService.getStatusLabel(lineMatch.matchingStatus)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">PO:</span> {lineMatch.poLine?.qty || 0} @ ${lineMatch.poLine?.unitPrice || 0}
                      </div>
                      <div>
                        <span className="text-gray-600">GR:</span> {lineMatch.grLine?.quantity || 0} @ ${lineMatch.grLine?.unitCost || 0}
                      </div>
                      <div>
                        <span className="text-gray-600">Invoice:</span> ${lineMatch.invoiceLineAmount || 0}
                      </div>
                    </div>
                    {lineMatch.discrepancies.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 text-red-700">
                        {lineMatch.discrepancies.map((d, i) => (
                          <div key={i} className="text-xs">• {d.message}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200">
            {result.canProceedToPayment ? (
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                ✓ Ready for Payment
              </button>
            ) : (
              <>
                <button
                  onClick={onShowExceptionModal}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700"
                >
                  Request Exception
                </button>
                {isShowingExceptionModal && (
                  <ExceptionModal
                    exceptionNotes={exceptionNotes}
                    onNotesChange={onExceptionNotesChange}
                    onApprove={onApproveException}
                    onCancel={() => setShowExceptionModal ? setShowExceptionModal(false) : null}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface DiscrepancySectionProps {
  title: string;
  discrepancies: DiscrepancyDetail[];
  variant: 'danger' | 'warning' | 'info';
}

const DiscrepancySection: React.FC<DiscrepancySectionProps> = ({
  title,
  discrepancies,
  variant
}) => {
  const bgColor = {
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-orange-50 border-orange-200'
  }[variant];

  const textColor = {
    danger: 'text-red-900',
    warning: 'text-amber-900',
    info: 'text-orange-900'
  }[variant];

  return (
    <div className={`p-4 border rounded-lg ${bgColor}`}>
      <div className={`font-semibold ${textColor} mb-3`}>{title}</div>
      <div className="space-y-2">
        {discrepancies.map((d, idx) => (
          <div key={idx} className={`text-sm ${textColor}`}>
            <div className="font-medium">{d.message}</div>
            {d.variance !== undefined && d.tolerance !== undefined && (
              <div className="text-xs mt-1">
                Variance: {d.variance.toFixed(2)}% (Tolerance: {d.tolerance.toFixed(2)}%)
              </div>
            )}
            {d.poValue !== undefined && d.grValue !== undefined && (
              <div className="text-xs mt-1">
                PO: {d.poValue} → GR: {d.grValue}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ExceptionModalProps {
  exceptionNotes: string;
  onNotesChange: (notes: string) => void;
  onApprove: () => void;
  onCancel: () => void;
}

const ExceptionModal: React.FC<ExceptionModalProps> = ({
  exceptionNotes,
  onNotesChange,
  onApprove,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
        <h3 className="text-lg font-bold">Request Exception</h3>
        <p className="text-sm text-gray-600">
          Explain why this invoice should be approved despite discrepancies.
        </p>
        <textarea
          value={exceptionNotes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="E.g., Vendor confirmed delivery on different date due to shipping delays..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
          rows={4}
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            disabled={!exceptionNotes.trim()}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            Request Approval
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchingDashboard;
