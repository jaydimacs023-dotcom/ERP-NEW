import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Eye,
  Package,
  ShieldCheck,
  Box,
  Search,
  Check,
  BarChart3,
  Warehouse,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { InventoryLevel, StockItem, Organization } from '../types';
import { InventoryService } from '../services/InventoryService';

interface InventoryViewProps {
  items: StockItem[];
  levels: InventoryLevel[];
  reorderPoints: any[];
  onSelectItem?: (itemId: string) => void;
  currency: string;
  isLoading?: boolean;
  organization?: Organization;
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
  onSelectItem,
  isLoading = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'BLUE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const stockStatuses = useMemo(() => {
    const statuses: StockStatus[] = items
      .filter((item) => !item.isDeleted && item.type === 'STOCK_ITEM')
      .map((item) => {
        const itemLevels = levels.filter((level) => level.stockItemId === item.id && !level.isDeleted);
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

    return stockStatuses.filter((status) => {
      const searchableText = [
        status.item.code,
        status.item.name,
        status.item.unitOfMeasure,
      ].join(' ').toLowerCase();

      if (normalizedSearch !== '' && !searchableText.includes(normalizedSearch)) return false;
      if (statusFilter !== 'ALL' && status.status !== statusFilter) return false;
      return true;
    });
  }, [stockStatuses, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  const summaries = useMemo(() => {
    return {
      totalItems: items.filter((item) => !item.isDeleted && item.type === 'STOCK_ITEM').length,
      criticalItems: stockStatuses.filter((status) => status.status === 'RED').length,
      lowStockItems: stockStatuses.filter((status) => status.status === 'YELLOW').length,
      optimalItems: stockStatuses.filter((status) => status.status === 'GREEN').length,
      totalQuantity: stockStatuses.reduce((sum, status) => sum + status.availableQuantity, 0),
    };
  }, [items, stockStatuses]);

  const getStatusTextColor = (status: StockStatus['status']) => {
    switch (status) {
      case 'RED':
        return 'bg-rose-100 text-rose-700';
      case 'YELLOW':
        return 'bg-amber-100 text-amber-700';
      case 'BLUE':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Stock Command Centre</h2>
          <p className="text-sm text-gray-500 font-normal italic">Real-time surveillance of global inventory levels and reorder triggers.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded border border-gray-200 shadow-sm flex items-center gap-3">
            <Warehouse size={16} className="text-brand" />
            <div className="leading-none">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active nodes</p>
              <p className="text-sm font-semibold text-gray-800">Operational</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 rounded shadow-sm shadow-gray-300/20 group hover:-translate-y-1 transition-all">
          <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Total Stock Keeping Units (SKU)</p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-semibold text-white tracking-tight">{summaries.totalItems}</p>
            <Package className="text-white/20 group-hover:text-brand/30 transition-colors" size={40} />
          </div>
        </div>

        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Stock Out (Critical)
          </p>
          <p className="text-xl font-semibold text-gray-800 tracking-tight">{summaries.criticalItems}</p>
        </div>

        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <TrendingDown size={12} /> Below Reorder Point
          </p>
          <p className="text-xl font-semibold text-gray-800 tracking-tight">{summaries.lowStockItems}</p>
        </div>

        <div className="bg-emerald-50 p-6 rounded border border-emerald-100 shadow-sm flex flex-col justify-between group">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">Optimal Balance</p>
          <div className="flex items-center justify-between">
            <p className="text-xl font-semibold text-emerald-600 tracking-tight">{summaries.optimalItems}</p>
            <div className="p-2 bg-emerald-600 text-white rounded shadow-lg shadow-emerald-900/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <BarChart3 size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full sm:w-64">
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full border-4 border-brand-light border-t-gray-300 animate-spin"></div>
            <p className="text-sm text-gray-600">Loading inventory...</p>
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
                {filteredStatuses.length > 0 ? (
                  filteredStatuses.map((status) => (
                    <tr key={status.item.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-brand/10 text-brand border border-brand-light shadow-sm flex items-center justify-center shrink-0">
                            <Package size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{status.item.code}</div>
                            <div className="text-xs text-gray-600">{status.item.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {status.availableQuantity.toFixed(0)} {status.item.unitOfMeasure}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {status.item.reorderLevel || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {status.item.safetyStock || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusTextColor(status.status)}`}>
                          {status.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {status.isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-amber-800">
                            <AlertTriangle className="w-3 h-3" />
                            Stock below reorder level
                          </span>
                        ) : status.isOverstocked ? (
                          <span className="inline-flex items-center gap-1 text-sky-700">
                            <TrendingUp className="w-3 h-3" />
                            Overstock detected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <Check className="w-3 h-3" />
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <Box size={40} className="mx-auto mb-2 text-gray-300" />
                      {hasActiveFilters ? 'Try adjusting your search or filters.' : 'No items match your filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && (
          <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                <ShieldCheck size={16} className="text-brand" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Operational Integrity</p>
                <p className="text-xs font-bold text-gray-600">
                  Inventory coordinate system strictly mapped to warehouse clusters.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5 font-mono">
                {summaries.totalQuantity.toLocaleString()} TOTAL_UNITS
              </p>
              <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">
                Snapshot verified: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryView;
