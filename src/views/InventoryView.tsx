import React, { useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Eye } from 'lucide-react';
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
  const [typeFilter, setTypeFilter] = React.useState<'ALL' | 'STOCK_ITEM' | 'NON_STOCK_ITEM'>('ALL');

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
    return stockStatuses.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && s.item.type !== typeFilter) return false;
      return true;
    });
  }, [stockStatuses, statusFilter, typeFilter]);

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
        return 'bg-blue-50 border-blue-200';
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
        return 'text-blue-700 bg-blue-100';
      default:
        return 'text-green-700 bg-green-100';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl text-gray-900 mb-2">Inventory Dashboard</h1>
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
        <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
          <p className="text-sm text-blue-700 mb-1 font-medium">Overstock (BLUE)</p>
          <p className="text-2xl font-bold text-blue-600">{summaries.overstockedItems}</p>
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
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-sm text-gray-700">
              <strong className="text-blue-700">BLUE:</strong> Overstock detected
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Status</option>
            <option value="RED">Critical (RED)</option>
            <option value="YELLOW">Low Stock (YELLOW)</option>
            <option value="GREEN">Optimal (GREEN)</option>
            <option value="BLUE">Overstock (BLUE)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type Filter</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            <option value="STOCK_ITEM">Stock Items</option>
            <option value="NON_STOCK_ITEM">Non-Stock Items</option>
          </select>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading inventory...</p>
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-600">
            <p>No items match your filter.</p>
          </div>
        ) : (
          filteredStatuses.map((status) => (
            <div
              key={status.item.id}
              className={`p-4 rounded-lg border-2 ${getStatusColor(status.status)}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{status.item.code}</p>
                  <p className="text-sm text-gray-600">{status.item.name}</p>
                </div>
                <button
                  onClick={() => onSelectItem?.(status.item.id)}
                  className="p-1 hover:bg-white rounded transition-colors"
                  title="View details"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusTextColor(status.status)}`}>
                  {status.statusLabel}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available:</span>
                  <span className="font-medium text-gray-900">
                    {status.availableQuantity.toFixed(0)} {status.item.unitOfMeasure}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reorder Level:</span>
                  <span className="text-gray-700">{status.item.reorderLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Safety Stock:</span>
                  <span className="text-gray-700">{status.item.safetyStock}</span>
                </div>
              </div>

              {/* Alerts */}
              {status.isLowStock && (
                <div className="p-2 bg-yellow-100 rounded text-xs text-yellow-800 flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Stock below reorder level</span>
                </div>
              )}

              {status.isOverstocked && (
                <div className="p-2 bg-blue-100 rounded text-xs text-blue-800 flex items-start gap-2">
                  <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Overstock detected</span>
                </div>
              )}

              {!status.isLowStock && !status.isOverstocked && status.status === 'GREEN' && (
                <div className="p-2 bg-green-100 rounded text-xs text-green-800 flex items-start gap-2">
                  <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Stock level is optimal</span>
                </div>
              )}
            </div>
          ))
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
