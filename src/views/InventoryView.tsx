import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Eye, Search, ChevronDown, RotateCcw } from 'lucide-react';
import { InventoryLevel, StockItem } from '../types';
import { InventoryService } from '../services/InventoryService';

interface InventoryViewProps {
  items: StockItem[];
  levels: InventoryLevel[];
  reorderPoints: any[];
  onSelectItem?: (itemId: string) => void;
  currency: string;
  isLoading?: boolean;
}

interface StockStatus {
  item: StockItem;
  level: InventoryLevel | null;
  availableQuantity: number;
  status: 'RED' | 'YELLOW' | 'GREEN' | 'BLUE';
  statusLabel: string;
  isLowStock: boolean;
  isOverstocked: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  levels,
  reorderPoints,
  onSelectItem,
  currency,
  isLoading = false,
}) => {
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'BLUE'>('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');

  const stockStatuses = useMemo(() => {
    const statuses: StockStatus[] = items
      .filter((item) => !item.isDeleted && item.type === 'STOCK_ITEM')
      .map((item) => {
        const itemLevels = levels.filter((l) => l.stockItemId === item.id && !l.isDeleted);
        const totalQuantity = itemLevels.reduce((sum, l) => sum + (l.quantityOnHand || 0), 0);
        const availableQuantity = InventoryService.getAvailableQuantity(itemLevels);

        const isLowStock = InventoryService.isLowStock(
          availableQuantity,
          item.reorderLevel,
          item.safetyStock
        );
        const isOverstocked = InventoryService.isOverstocked(
          availableQuantity,
          (item.reorderQuantity || 0) * 2
        );

        const status = InventoryService.getStockStatusBadge(
          availableQuantity,
          item.reorderLevel,
          item.safetyStock,
          item.reorderQuantity || 0
        );

        return {
          item,
          level: itemLevels.length > 0 ? itemLevels[0] : null,
          availableQuantity,
          status,
          statusLabel:
            status === 'RED'
              ? 'Critical'
              : status === 'YELLOW'
                ? 'Low Stock'
                : status === 'BLUE'
                  ? 'Overstock'
                  : 'Optimal',
          isLowStock,
          isOverstocked,
        };
      });

    return statuses;
  }, [items, levels]);

  const filteredStatuses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stockStatuses.filter((s) => {
      const searchableText = [
        s.item.code,
        s.item.name,
        s.item.unitOfMeasure,
      ].join(' ').toLowerCase();

      if (normalizedSearch !== '' && !searchableText.includes(normalizedSearch)) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [stockStatuses, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  // Calculate summaries
  const summaries = useMemo(() => {
    const summary = {
      totalItems: items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM').length,
      criticalItems: stockStatuses.filter((s) => s.status === 'RED').length,
      lowStockItems: stockStatuses.filter((s) => s.status === 'YELLOW').length,
      overstockedItems: stockStatuses.filter((s) => s.status === 'BLUE').length,
      totalQuantity: stockStatuses.reduce((sum, s) => sum + s.availableQuantity, 0),
    };
    return summary;
  }, [items, stockStatuses]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RED':
        return 'bg-red-50 border-red-200';
      case 'YELLOW':
        return 'bg-yellow-50 border-yellow-200';
      case 'BLUE':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-green-50 border-green-200';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'RED':
        return 'text-red-700 bg-red-100';
      case 'YELLOW':
        return 'text-yellow-700 bg-yellow-100';
      case 'BLUE':
        return 'text-orange-700 bg-orange-100';
      default:
        return 'text-green-700 bg-green-100';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl text-gray-900 mb-2">Inventory Dashboard</h1>
        <p className="text-gray-600">Real-time stock status and alerts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total Items</p>
          <p className="text-2xl font-bold text-gray-900">{summaries.totalItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
          <p className="text-sm text-red-700 mb-1 font-medium">Critical (RED)</p>
          <p className="text-2xl font-bold text-red-600">{summaries.criticalItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm">
          <p className="text-sm text-yellow-700 mb-1 font-medium">Low Stock (YELLOW)</p>
          <p className="text-2xl font-bold text-yellow-600">{summaries.lowStockItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
          <p className="text-sm text-orange-700 mb-1 font-medium">Overstock (BLUE)</p>
          <p className="text-2xl font-bold text-[#F47721]">{summaries.overstockedItems}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
          <p className="text-sm text-green-700 mb-1 font-medium">Total Qty</p>
          <p className="text-2xl font-bold text-green-600">{summaries.totalQuantity.toFixed(0)}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-3">Status Legend</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-sm text-gray-700">
              <strong className="text-red-700">RED:</strong> Below safety stock
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-700">
              <strong className="text-yellow-700">YELLOW:</strong> Below reorder level
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-sm text-gray-700">
              <strong className="text-green-700">GREEN:</strong> Optimal stock
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F47721]"></div>
            <span className="text-sm text-gray-700">
              <strong className="text-orange-700">BLUE:</strong> Overstock detected
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'BLUE')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="ALL">All</option>
              <option value="RED">Critical</option>
              <option value="YELLOW">Low Stock</option>
              <option value="GREEN">Optimal</option>
              <option value="BLUE">Overstock</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredStatuses.length}</span> of {summaries.totalItems} items
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-sans">
              <thead className="bg-brand border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Item</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Available</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Reorder Level</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Safety Stock</th>
                  <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
                  <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Alerts</th>
                  <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStatuses.length > 0 ? filteredStatuses.map((status) => (
                  <tr key={status.item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{status.item.code}</div>
                      <div className="text-xs text-gray-600">{status.item.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {status.availableQuantity.toFixed(0)} {status.item.unitOfMeasure}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{status.item.reorderLevel}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{status.item.safetyStock}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusTextColor(status.status)}`}>
                        {status.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {status.isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-yellow-800">
                          <AlertTriangle className="w-3 h-3" />
                          Stock below reorder level
                        </span>
                      ) : status.isOverstocked ? (
                        <span className="inline-flex items-center gap-1 text-orange-800">
                          <TrendingUp className="w-3 h-3" />
                          Overstock detected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <TrendingUp className="w-3 h-3" />
                          Stock level is optimal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectItem?.(status.item.id)}
                        className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {hasActiveFilters ? 'Try adjusting your search or filters.' : 'No items match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Text */}
      {filteredStatuses.length > 0 && (
        <div className="mt-6 text-sm text-gray-600">
          Showing {filteredStatuses.length} of {summaries.totalItems} item{summaries.totalItems !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default InventoryView;
