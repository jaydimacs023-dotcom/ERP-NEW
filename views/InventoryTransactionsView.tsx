import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, X, ChevronDown, Package, MapPin, Calendar, Hash, FileText, Filter, Search, ArrowUpRight, ArrowDownLeft, RefreshCcw, Check } from 'lucide-react';
import { InventoryTransaction, StockItem, InventoryTransactionType, Organization } from '../types';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter, PageOrder } from '../services/IDataService';

interface InventoryTransactionsViewProps {
  orgId: string;
  transactions: InventoryTransaction[];
  items: StockItem[];
  locations: any[];
  currency: string;
  isLoading?: boolean;
  organization?: Organization;
}

const PAGE_SIZE = 10;
const INVENTORY_TRANSACTION_COLUMNS = 'id,org_id,reference_number,stock_item_id,from_location_id,to_location_id,transaction_type,quantity,unit_cost,total_cost,notes,journal_entry_id,created_by,created_at,is_deleted';

interface TransactionWithDetails extends InventoryTransaction {
  item?: StockItem;
  location?: any;
}

const TRANSACTION_TYPE_LABELS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'Stock Inbound',
  SALE: 'Stock Outbound',
  ADJUSTMENT: 'Manual Adj.',
  TRANSFER: 'Inter-Whse Transfer',
  RETURN: 'Customer Return',
  DAMAGE: 'Damage Claim',
  WRITEOFF: 'Write-off (Expensed)',
};

const TRANSACTION_TYPE_UI: Record<InventoryTransactionType, { color: string, icon: React.ReactNode }> = {
  PURCHASE: { color: 'bg-emerald-100 text-emerald-700', icon: <ArrowDownLeft size={12} /> },
  SALE: { color: 'bg-orange-100 text-orange-700', icon: <ArrowUpRight size={12} /> },
  ADJUSTMENT: { color: 'bg-amber-100 text-amber-700', icon: <RefreshCcw size={12} /> },
  TRANSFER: { color: 'bg-indigo-100 text-orange-700', icon: <RefreshCcw size={12} /> },
  RETURN: { color: 'bg-blue-100 text-blue-700', icon: <ArrowDownLeft size={12} /> },
  DAMAGE: { color: 'bg-rose-100 text-rose-700', icon: <ArrowUpRight size={12} /> },
  WRITEOFF: { color: 'bg-gray-100 text-gray-700', icon: <ArrowUpRight size={12} /> },
};

export const InventoryTransactionsView: React.FC<InventoryTransactionsViewProps> = ({
  orgId,
  transactions,
  items,
  locations,
  currency,
  isLoading = false,
  organization,
}) => {
  const brandColor = organization?.primaryColor || '#F47721';
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<InventoryTransactionType | 'ALL'>('ALL');
  const [selectedItemFilter, setSelectedItemFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'item' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [serverTransactions, setServerTransactions] = useState<InventoryTransaction[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');


  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, selectedItemFilter, selectedTypeFilter, sortBy, sortOrder]);

  const transactionFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    filters.push({ column: 'is_deleted', operator: 'eq', value: false });
    if (selectedTypeFilter !== 'ALL') filters.push({ column: 'transaction_type', operator: 'eq', value: selectedTypeFilter });
    if (selectedItemFilter !== 'ALL') filters.push({ column: 'stock_item_id', operator: 'eq', value: selectedItemFilter });
    return filters;
  }, [orgId, selectedItemFilter, selectedTypeFilter]);

  const transactionOrder = useMemo<PageOrder[]>(() => {
    if (sortBy === 'type') return [{ column: 'transaction_type', ascending: sortOrder === 'asc' }];
    return [{ column: 'created_at', ascending: sortOrder === 'asc' }];
  }, [sortBy, sortOrder]);

  const canUseServerRows = sortBy !== 'item';

  useEffect(() => {
    if (!orgId || !canUseServerRows) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<InventoryTransaction>('inventory_transactions', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: INVENTORY_TRANSACTION_COLUMNS,
      filters: transactionFilters,
      search: debouncedSearchTerm.trim()
        ? { columns: ['reference_number', 'notes'], term: debouncedSearchTerm }
        : undefined,
      orderBy: transactionOrder,
    })
      .then(result => {
        if (!isActive) return;
        setServerTransactions(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[InventoryTransactionsView] Failed to load transaction page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load inventory transactions.');
        setServerTransactions([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) setIsLoadingPage(false);
      });

    return () => {
      isActive = false;
    };
  }, [canUseServerRows, currentPage, debouncedSearchTerm, orgId, transactionFilters, transactionOrder]);

  const transactionsWithDetails = useMemo<TransactionWithDetails[]>(() => {
    const sourceTransactions = (!orgId || pageLoadError || !canUseServerRows) ? transactions : serverTransactions;

    return sourceTransactions
      .filter((t) => !t.isDeleted)
      .map((t) => {
        const normalized = {
          ...t,
          type: (t as any).type || (t as any).transactionType,
          warehouseLocationId: (t as any).warehouseLocationId || (t as any).toLocationId || (t as any).fromLocationId,
        } as TransactionWithDetails;

        return {
          ...normalized,
          item: items.find((i) => i.id === normalized.stockItemId),
          location: locations.find((l) => l.id === normalized.warehouseLocationId),
        };
      });
  }, [canUseServerRows, items, locations, orgId, pageLoadError, serverTransactions, transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactionsWithDetails;

    if (selectedTypeFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.type === selectedTypeFilter);
    }

    if (selectedItemFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.stockItemId === selectedItemFilter);
    }

    if (debouncedSearchTerm && (!orgId || pageLoadError || !canUseServerRows)) {
      const lowerSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(t => 
        t.item?.code.toLowerCase().includes(lowerSearch) ||
        t.item?.name.toLowerCase().includes(lowerSearch) ||
        t.referenceNumber?.toLowerCase().includes(lowerSearch)
      );
    }

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
  }, [canUseServerRows, debouncedSearchTerm, orgId, pageLoadError, selectedItemFilter, selectedTypeFilter, sortBy, sortOrder, transactionsWithDetails]);

  const summaries = useMemo(() => {
    const totalQty = transactionsWithDetails.reduce((acc, t) => acc + t.quantity, 0);
    const summary = {
      totalTransactions: transactionsWithDetails.length,
      totalQty,
      purchases: transactionsWithDetails.filter((t) => t.type === 'PURCHASE').length,
      sales: transactionsWithDetails.filter((t) => t.type === 'SALE').length,
      abnormal: transactionsWithDetails.filter((t) => ['DAMAGE', 'WRITEOFF', 'ADJUSTMENT'].includes(t.type)).length,
    };
    return summary;
  }, [transactionsWithDetails]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedTypeFilter !== 'ALL' ||
    selectedItemFilter !== 'ALL' ||
    sortBy !== 'date' ||
    sortOrder !== 'desc';

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedTransactions,
    setCurrentPage: setFallbackCurrentPage,
  } = usePaginatedRows(filteredTransactions, [debouncedSearchTerm, selectedItemFilter, selectedTypeFilter, sortBy, sortOrder], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError || !canUseServerRows;
  const paginatedTransactions = useFallbackRows ? fallbackPaginatedTransactions : filteredTransactions;
  const totalItems = useFallbackRows ? filteredTransactions.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + paginatedTransactions.length, totalItems);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const handleExport = () => {
    const csv = [
      ['Date', 'Item Code', 'Item Name', 'Type', 'Quantity', 'Unit', 'Location', 'Reference', 'Notes'].join(','),
      ...filteredTransactions.map((t) =>
        [
          new Date(t.createdAt).toLocaleDateString(),
          `"${t.item?.code || ''}"`,
          `"${t.item?.name || ''}"`,
          `"${TRANSACTION_TYPE_LABELS[t.type]}"`,
          t.quantity,
          `"${t.item?.unitOfMeasure || ''}"`,
          `"${t.location?.code || ''}"`,
          `"${t.referenceNumber || ''}"`,
          `"${t.notes || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_Log_${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-gray-800 tracking-tight">Audit Ledger</h2>
          <p className="text-sm text-gray-500 font-normal italic">Comprehensive historical log of every stock movement and ownership change.</p>
        </div>
        <div className="flex gap-3">
           <button
             onClick={handleExport}
             disabled={filteredTransactions.length === 0}
             style={{ backgroundColor: brandColor }}
             className="flex items-center gap-2 px-6 py-3 text-white rounded font-semibold text-xs uppercase tracking-[0.2em] shadow-lg shadow-gray-300/20 hover:opacity-90 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
           >
             <Download className="w-4 h-4" />
             Export Audit CSV
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded border border-gray-200 shadow-sm group">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Log Entries</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold text-gray-800 tracking-tight">{summaries.totalTransactions}</p>
            <FileText style={{ color: brandColor }} size={40} />
          </div>
        </div>
        <div className="bg-emerald-50 p-6 rounded border border-emerald-100 shadow-sm">
          <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide mb-1">Stock Receipts</p>
          <p className="text-3xl font-semibold text-emerald-600 tracking-tight">{summaries.purchases}</p>
        </div>
        <div className="bg-orange-50 p-6 rounded border border-orange-100 shadow-sm">
          <p className="text-[10px] font-semibold text-orange-800 uppercase tracking-wide mb-1">Dispatches</p>
          <p className="text-3xl font-semibold tracking-tight" style={{ color: brandColor }}>{summaries.sales}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded border border-rose-100 shadow-sm group">
          <p className="text-[10px] font-semibold text-rose-800 uppercase tracking-wide mb-1">Risk Events</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-semibold text-rose-600 tracking-tight">{summaries.abnormal}</p>
            <div className="text-[8px] font-semibold bg-rose-200 text-rose-700 px-2 py-1 rounded group-hover:bg-rose-600 group-hover:text-white transition-colors">WATCHLIST</div>
          </div>
        </div>
      </div>

      <div className="p-8 bg-white rounded-md border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Search</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search inventory transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand focus:bg-white transition-all text-sm font-bold text-gray-800"
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3 flex-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Event Type</label>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand focus:bg-white transition-all text-sm font-bold text-gray-800 appearance-none"
              >
                <option value="ALL">All Event Types</option>
                {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Item</label>
              <select
                value={selectedItemFilter}
                onChange={(e) => setSelectedItemFilter(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand focus:bg-white transition-all text-sm font-bold text-gray-800 appearance-none"
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Sort</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand focus:bg-white transition-all text-sm font-bold text-gray-800 appearance-none font-mono"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="type-asc">Type A - Z</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTypeFilter('ALL');
              setSelectedItemFilter('ALL');
              setSortBy('date');
              setSortOrder('desc');
            }}
            className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Reset filters"
          >
            Clear filters
          </button>

          <div className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching transactions
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-8 py-5 text-[10px] font-semibold text-white uppercase tracking-wide">Temporal Marker</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-white uppercase tracking-wide">Inventory Object</th>
                <th className="px-6 py-5 text-[10px] font-semibold text-white uppercase tracking-wide">Movement Logic</th>
                <th className="px-6 py-5 text-right text-[10px] font-semibold text-white uppercase tracking-wide">Delta</th>
                <th className="px-8 py-5 text-right text-[10px] font-semibold text-white uppercase tracking-wide">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(isLoading || isLoadingPage) ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="w-10 h-10 border-4 border-orange-200 rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: brandColor }}></div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.3em]">Querying Archive Nodes...</p>
                   </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-8 py-20 text-center">
                      <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">No matching snapshots found</p>
                      <p className="text-xs text-gray-400 mt-2 italic font-medium">Try adjusting your temporal filters or search criteria.</p>
                   </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => (
                  <React.Fragment key={tx.id}>
                    <tr className="hover:bg-gray-50 transition-colors group cursor-pointer"
                        onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-gray-300" />
                            <div>
                               <p className="text-xs font-semibold text-gray-900">{new Date(tx.createdAt).toLocaleDateString()}</p>
                               <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <div>
                            <p className="text-xs font-semibold text-gray-900 tracking-tight">{tx.item?.code}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate max-w-[120px]">{tx.item?.name}</p>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide flex items-center gap-1 ${TRANSACTION_TYPE_UI[tx.type].color} bg-white border border-black/5`}>
                               {TRANSACTION_TYPE_UI[tx.type].icon}
                               {TRANSACTION_TYPE_LABELS[tx.type]}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono">
                         <div className="text-sm font-semibold">
                            {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                            <span className="text-[9px] text-gray-400 ml-1 font-bold">{tx.item?.unitOfMeasure}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button style={{ color: brandColor }} className={`p-2 rounded-xl transition-all ${expandedId === tx.id ? 'bg-gray-200 text-gray-800' : 'text-gray-400'}`}>
                            <ChevronDown size={14} />
                         </button>
                      </td>
                    </tr>
                    {expandedId === tx.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-8 py-6 border-t border-gray-100">
                           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                              <div className="space-y-4">
                                 <div>
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Movement Path</p>
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                       <MapPin size={14} style={{ color: brandColor }} />
                                       {tx.location?.name || 'Undefined Cluster'} ({tx.location?.code || 'N/A'})
                                    </div>
                                 </div>
                                 <div>
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Control Reference</p>
                                    <div className="flex items-center gap-2 text-xs font-mono font-semibold text-gray-800">
                                       <Hash size={14} className="text-gray-300" />
                                       {tx.referenceNumber || 'INTERNAL_JOURNAL'}
                                    </div>
                                 </div>
                              </div>

                              <div className="md:col-span-2">
                                 <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Auditor Remarks</p>
                                 <div className="p-4 bg-white rounded border border-gray-200 text-xs font-bold text-gray-600 italic">
                                    "{tx.notes || 'No manual annotation provided for this movement.'}"
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 {tx.unitCost && (
                                    <>
                                       <div>
                                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Fiscal Unit Cost</p>
                                          <p className="text-sm font-semibold text-gray-900 font-mono">{currency} {tx.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                       </div>
                                       <div className="p-3 rounded text-white shadow-lg shadow-gray-300/20" style={{ backgroundColor: brandColor }}>
                                          <p className="text-[8px] font-semibold uppercase tracking-wide opacity-80 mb-0.5">Impact Value</p>
                                          <p className="text-sm font-semibold font-mono">{currency} {(tx.unitCost * Math.abs(tx.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                       </div>
                                    </>
                                 )}
                                 <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Executor: <span className="text-gray-600 font-semibold">{tx.createdBy || 'SYSTEM_DAEMON'}</span></p>
                                 </div>
                              </div>
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredTransactions.length > 0 && (
           <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm"><Check size={16} style={{ color: brandColor }} /></div>
                  <div>
                     <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Archive Integrity</p>
                     <p className="text-xs font-bold text-gray-600">Total volume recorded on this view: {summaries.totalQty.toLocaleString()} units mapped.</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center justify-end gap-1.5"><FileText size={12} /> RECORD_IMMUTABLE</p>
                  <p className="text-[9px] font-bold text-gray-300 italic mt-1 uppercase">Log Cursor: {new Date().toLocaleString()}</p>
               </div>
           </div>
        )}
      </div>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="transactions"
        />
    </div>
  );
};

export default InventoryTransactionsView;

