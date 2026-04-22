import React, { useMemo, useState } from 'react';
import { Download, Eye, X, ChevronDown, Search, RotateCcw } from 'lucide-react';
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
  SALE: 'bg-orange-100 text-orange-800',
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
  const [searchTerm, setSearchTerm] = useState('');
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

    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (normalizedSearch !== '') {
      filtered = filtered.filter((t) => {
        const searchableText = [
          t.item?.code || '',
          t.item?.name || '',
          t.location?.code || '',
          t.location?.name || '',
          t.referenceNumber || '',
          t.notes || '',
          t.createdBy || '',
        ].join(' ').toLowerCase();

        return searchableText.includes(normalizedSearch);
      });
    }

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
  }, [transactionsWithDetails, searchTerm, selectedTypeFilter, selectedItemFilter, sortBy, sortOrder]);

  const hasActiveFilters =
    searchTerm.trim() !== ''
    || selectedTypeFilter !== 'ALL'
    || selectedItemFilter !== 'ALL'
    || sortBy !== 'date'
    || sortOrder !== 'desc';

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
        <h1 className="text-xl text-gray-900 mb-2">Inventory Transactions</h1>
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
        <div className="bg-white p-3 rounded-lg border border-orange-200 shadow-sm">
          <p className="text-xs text-orange-700 font-medium mb-1">Sales</p>
          <p className="text-xl font-bold text-[#F47721]">{summaries.sales}</p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-red-200 shadow-sm">
          <p className="text-xs text-red-700 font-medium mb-1">Damage/Writeoff</p>
          <p className="text-xl font-bold text-red-600">{summaries.damage + summaries.writeoffs}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-y px-4 py-2 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Type:</span>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as InventoryTransactionType | 'ALL')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
            >
              <option value="ALL">All</option>
              {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Item:</span>
            <select
              value={selectedItemFilter}
              onChange={(e) => setSelectedItemFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="ALL">All</option>
              {uniqueItems.map((itemId) => {
                const item = items.find((i) => i.id === itemId);
                return (
                  <option key={itemId} value={itemId}>
                    {item?.code} - {item?.name}
                  </option>
                );
              })}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'item' | 'type')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[130px]"
            >
              <option value="date">Date</option>
              <option value="item">Item</option>
              <option value="type">Type</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Order:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[140px]"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTypeFilter('ALL');
              setSelectedItemFilter('ALL');
              setSortBy('date');
              setSortOrder('desc');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredTransactions.length}</span> of {transactionsWithDetails.length} transactions
          </div>

          <button
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading transactions...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Item</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Type</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Quantity</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Location</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Reference</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
                  <React.Fragment key={transaction.id}>
                    <tr className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{transaction.item?.code}</div>
                        <div className="text-xs text-gray-600">{transaction.item?.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                            TRANSACTION_TYPE_COLORS[transaction.type]
                          }`}
                        >
                          {TRANSACTION_TYPE_LABELS[transaction.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {transaction.quantity} {transaction.item?.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.location?.code || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.referenceNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                          className="inline-flex items-center gap-1 p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Toggle details"
                        >
                          <Eye className="w-4 h-4" />
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              expandedId === transaction.id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                    {expandedId === transaction.id && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</p>
                              <p className="mt-1 text-gray-900 font-mono">{transaction.referenceNumber || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</p>
                              <p className="mt-1 text-gray-700">{transaction.createdBy || 'System'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</p>
                              <p className="mt-1 text-gray-700">{new Date(transaction.createdAt).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</p>
                              <p className="mt-1 text-gray-700">{transaction.location?.name || transaction.location?.code || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</p>
                              <p className="mt-1 text-gray-900 font-mono">
                                {transaction.unitCost ? `${currency} ${transaction.unitCost.toFixed(2)}` : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</p>
                              <p className="mt-1 text-gray-900 font-mono font-bold">
                                {transaction.unitCost ? `${currency} ${(transaction.unitCost * transaction.quantity).toFixed(2)}` : '—'}
                              </p>
                            </div>
                            <div className="md:col-span-2">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</p>
                              <p className="mt-1 text-gray-700">{transaction.notes || 'No additional notes.'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {hasActiveFilters ? 'Try adjusting your search or filters.' : 'No transactions found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
