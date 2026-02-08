import React, { useMemo, useState } from 'react';
import { Download, Eye, X, ChevronDown } from 'lucide-react';
import { InventoryTransaction, StockItem, InventoryTransactionType } from '../types';

interface InventoryTransactionsViewProps {
  transactions: InventoryTransaction[];
  items: StockItem[];
  locations: any[];
  currency: string;
  isLoading?: boolean;
}

interface TransactionWithDetails extends InventoryTransaction {
  item?: StockItem;
  location?: any;
}

const TRANSACTION_TYPE_LABELS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'Purchase Receipt',
  SALE: 'Sale/Dispatch',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
  RETURN: 'Return',
  DAMAGE: 'Damage',
  WRITEOFF: 'Write-off',
};

const TRANSACTION_TYPE_COLORS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'bg-green-100 text-green-800',
  SALE: 'bg-teal-100 text-teal-800',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
  TRANSFER: 'bg-purple-100 text-purple-800',
  RETURN: 'bg-orange-100 text-orange-800',
  DAMAGE: 'bg-red-100 text-red-800',
  WRITEOFF: 'bg-gray-100 text-gray-800',
};

export const InventoryTransactionsView: React.FC<InventoryTransactionsViewProps> = ({
  transactions,
  items,
  locations,
  currency,
  isLoading = false,
}) => {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<InventoryTransactionType | 'ALL'>('ALL');
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'item' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const transactionsWithDetails = useMemo<TransactionWithDetails[]>(() => {
    return transactions
      .filter((t) => !t.isDeleted)
      .map((t) => ({
        ...t,
        item: items.find((i) => i.id === t.stockItemId),
        location: locations.find((l) => l.id === t.warehouseLocationId),
      }));
  }, [transactions, items, locations]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactionsWithDetails;

    // Filter by type
    if (selectedTypeFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.type === selectedTypeFilter);
    }

    // Filter by item
    if (selectedItemFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.stockItemId === selectedItemFilter);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'item':
          comparison = (a.item?.code || '').localeCompare(b.item?.code || '');
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [transactionsWithDetails, selectedTypeFilter, selectedItemFilter, sortBy, sortOrder]);

  // Calculate summaries
  const summaries = useMemo(() => {
    const summary = {
      totalTransactions: transactionsWithDetails.length,
      purchases: transactionsWithDetails.filter((t) => t.type === 'PURCHASE').length,
      sales: transactionsWithDetails.filter((t) => t.type === 'SALE').length,
      adjustments: transactionsWithDetails.filter((t) => t.type === 'ADJUSTMENT').length,
      transfers: transactionsWithDetails.filter((t) => t.type === 'TRANSFER').length,
      returns: transactionsWithDetails.filter((t) => t.type === 'RETURN').length,
      damage: transactionsWithDetails.filter((t) => t.type === 'DAMAGE').length,
      writeoffs: transactionsWithDetails.filter((t) => t.type === 'WRITEOFF').length,
    };
    return summary;
  }, [transactionsWithDetails]);

  const handleExport = () => {
    const csv = [
      ['Date', 'Item Code', 'Item Name', 'Type', 'Quantity', 'Unit', 'Location', 'Reference', 'Notes'].join(','),
      ...filteredTransactions.map((t) =>
        [
          new Date(t.createdAt).toLocaleDateString(),
          t.item?.code || '',
          t.item?.name || '',
          TRANSACTION_TYPE_LABELS[t.type],
          t.quantity,
          t.item?.unitOfMeasure || '',
          t.location?.code || '',
          t.referenceNumber || '',
          t.notes || '',
        ]
          .map((v) => `"${v}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const uniqueItems = useMemo(
    () => Array.from(new Set(items.filter((i) => !i.isDeleted).map((i) => i.id))),
    [items]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Inventory Transactions</h1>
        <p className="text-gray-600">Complete audit trail of all stock movements</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-600 mb-1">Total</p>
          <p className="text-xl font-bold text-gray-900">{summaries.totalTransactions}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-green-200 shadow-sm">
          <p className="text-xs text-green-700 font-medium mb-1">Purchases</p>
          <p className="text-xl font-bold text-green-600">{summaries.purchases}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-teal-200 shadow-sm">
          <p className="text-xs text-teal-700 font-medium mb-1">Sales</p>
          <p className="text-xl font-bold text-teal-600">{summaries.sales}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
          <p className="text-xs text-red-700 font-medium mb-1">Damage/Writeoff</p>
          <p className="text-xl font-bold text-red-600">{summaries.damage + summaries.writeoffs}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-3 md:space-y-0 md:flex gap-3">
        {/* Type Filter */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Transaction Type</label>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Item Filter */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Item</label>
          <select
            value={selectedItemFilter}
            onChange={(e) => setSelectedItemFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="ALL">All Items</option>
            {uniqueItems.map((itemId) => {
              const item = items.find((i) => i.id === itemId);
              return (
                <option key={itemId} value={itemId}>
                  {item?.code} - {item?.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Sort By */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="date">Date</option>
            <option value="item">Item</option>
            <option value="type">Type</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        {/* Export Button */}
        <div className="flex items-end">
          <button
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="w-full md:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
            <div className="inline-block w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200 text-gray-600">
            <p>No transactions found.</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main Row */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === transaction.id ? null : transaction.id)
                        }
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <ChevronDown
                          className={`w-5 h-5 text-gray-600 transition-transform ${
                            expandedId === transaction.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <div>
                        <p className="font-semibold text-gray-900">{transaction.item?.code}</p>
                        <p className="text-xs text-gray-600">{transaction.item?.name}</p>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="ml-9 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Type</p>
                        <p className="font-medium text-gray-900">
                          {TRANSACTION_TYPE_LABELS[transaction.type]}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Quantity</p>
                        <p className="font-medium text-gray-900">
                          {transaction.quantity} {transaction.item?.unitOfMeasure}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Location</p>
                        <p className="font-medium text-gray-900">
                          {transaction.location?.code || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="ml-4">
                    <span
                      className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                        TRANSACTION_TYPE_COLORS[transaction.type]
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === transaction.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 ml-9 space-y-3">
                    {transaction.referenceNumber && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Reference
                          </p>
                          <p className="text-sm text-gray-900 font-mono">{transaction.referenceNumber}</p>
                        </div>
                      </div>
                    )}

                    {transaction.notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">
                          Notes
                        </p>
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {transaction.notes}
                        </p>
                      </div>
                    )}

                    {transaction.unitCost && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Unit Cost
                          </p>
                          <p className="text-sm text-gray-900 font-mono">
                            {currency} {transaction.unitCost.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Total Value
                          </p>
                          <p className="text-sm text-gray-900 font-mono font-bold">
                            {currency}{' '}
                            {(transaction.unitCost * transaction.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Created By
                        </p>
                        <p className="text-sm text-gray-600">
                          {transaction.createdBy || 'System'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Created At
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredTransactions.length > 0 && (
        <div className="mt-6 text-sm text-gray-600">
          Showing {filteredTransactions.length} of {transactionsWithDetails.length} transaction
          {transactionsWithDetails.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default InventoryTransactionsView;
