import React, { useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Eye, Package, ShieldCheck, Box, Filter, Search, Download, Check, ArrowRight, BarChart3, Warehouse } from 'lucide-react';
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'BLUE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return s.item.name.toLowerCase().includes(term) || s.item.code.toLowerCase().includes(term);
      }
      return true;
    });
  }, [stockStatuses, statusFilter, searchTerm]);

  const summaries = useMemo(() => {
    return {
      totalItems: items.filter((i) => !i.isDeleted && i.type === 'STOCK_ITEM').length,
      criticalItems: stockStatuses.filter((s) => s.status === 'RED').length,
      lowStockItems: stockStatuses.filter((s) => s.status === 'YELLOW').length,
      optimalItems: stockStatuses.filter((s) => s.status === 'GREEN').length,
      totalQuantity: stockStatuses.reduce((sum, s) => sum + s.availableQuantity, 0),
    };
  }, [items, stockStatuses]);

  const STATUS_CONFIG = {
    RED: { color: 'bg-rose-100 text-rose-700', icon: <AlertTriangle size={12} />, border: 'border-rose-200' },
    YELLOW: { color: 'bg-amber-100 text-amber-700', icon: <TrendingDown size={12} />, border: 'border-amber-200' },
    GREEN: { color: 'bg-emerald-100 text-emerald-700', icon: <Check size={12} />, border: 'border-emerald-200' },
    BLUE: { color: 'bg-blue-100 text-blue-700', icon: <TrendingUp size={12} />, border: 'border-blue-200' },
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
             <Warehouse size={16} className="text-[#F47721]" />
             <div className="leading-none">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Active nodes</p>
                <p className="text-sm font-semibold text-gray-800">Operational</p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 p-6 rounded shadow-sm shadow-gray-300/20 group hover:-translate-y-1 transition-all">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Total Stock Keeping Units (SKU)</p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-semibold text-white tracking-tight">{summaries.totalItems}</p>
            <Package className="text-white/20 group-hover:text-orange-400/20 transition-colors" size={40} />
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

      <div className="p-8 bg-white rounded-md border border-gray-200 shadow-sm space-y-6">
         <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-1.5">
               <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">SKU Search Protocol</label>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Identify item by code, name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800"
                  />
               </div>
            </div>

            <div className="md:w-64 space-y-1.5">
               <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide ml-1">Inventory Health Filter</label>
               <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded outline-none focus:border-orange-400/20 focus:bg-white transition-all text-sm font-bold text-gray-800 appearance-none"
                  >
                    <option value="ALL">TOTAL SPECTRUM</option>
                    <option value="RED">CRITICAL STOCK-OUT</option>
                    <option value="YELLOW">LOW STOCK WARNING</option>
                    <option value="GREEN">OPTIMAL LEVELS</option>
                    <option value="BLUE">OVERSTOCK PHONICS</option>
                  </select>
               </div>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Inventory Object</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Health Status</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Available Qty</th>
                <th className="px-6 py-5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Target Range</th>
                <th className="px-8 py-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-10 h-10 border-4 border-orange-200 border-t-[#F47721] rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Synchronizing Clusters...</p>
                   </td>
                </tr>
              ) : filteredStatuses.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic font-medium">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Box className="w-12 h-12 text-gray-200 mx-auto" />
                        <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide not-italic">No objects in viewport</p>
                        <p className="text-xs">Adjust filters to broaden surveillance.</p>
                      </div>
                   </td>
                </tr>
              ) : (
                filteredStatuses.map((s) => (
                  <tr key={s.item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded flex items-center justify-center border shadow-sm ${STATUS_CONFIG[s.status].color} border-${STATUS_CONFIG[s.status].color.split('-')[1]}-200 bg-${STATUS_CONFIG[s.status].color.split('-')[1]}-50`}>
                             <Package size={18} />
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-900 tracking-tight uppercase">{s.item.code}</p>
                             <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[200px]">{s.item.name}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                       <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 w-fit ${STATUS_CONFIG[s.status].color} ${STATUS_CONFIG[s.status].bgColor} border border-black/5`}>
                          {STATUS_CONFIG[s.status].icon}
                          {s.statusLabel}
                       </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="space-y-0.5">
                          <p className="text-sm font-semibold font-mono">
                             {s.availableQuantity.toLocaleString()}
                          </p>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{s.item.unitOfMeasure}</p>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-gray-600 font-mono italic">
                             Min: {s.item.safetyStock || 0} / Opt: {s.item.reorderLevel || 0}
                          </p>
                          <div className="flex justify-end gap-1">
                             <div className={`h-1 rounded-full ${s.isBelowSafety ? 'bg-rose-500' : 'bg-emerald-500'} w-8`} />
                             <div className={`h-1 rounded-full ${s.isBelowReorder ? 'bg-amber-400' : 'bg-emerald-500'} w-12`} />
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button
                         onClick={() => onSelectItem?.(s.item.id)}
                         className="p-2.5 bg-gray-800 text-white rounded shadow-lg shadow-gray-300/10 hover:bg-black hover:-translate-y-0.5 transition-all active:scale-95"
                       >
                         <Eye size={14} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><ShieldCheck size={16} className="text-[#F47721]" /></div>
               <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Operational Integrity</p>
                  <p className="text-xs font-bold text-gray-600">Inventory coordinate system strictly mapped to Warehouse Clusters.</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5 font-mono">
                  {summaries.totalQuantity.toLocaleString()} TOTAL_UNITS
               </p>
               <p className="text-xs font-bold text-gray-300 italic mt-1 uppercase">Snapshot verified: {new Date().toLocaleTimeString()}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryView;

