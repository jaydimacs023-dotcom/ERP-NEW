import React, { useEffect, useMemo, useState } from 'react';
import { AuditLog } from '../types';
import { ChevronDown, Clock, Filter, History, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter } from '../services/IDataService';

interface AuditTrailProps {
  orgId: string;
  logs?: AuditLog[];
  brandColor?: string;
}

type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';

const todayKey = () => new Date().toISOString().split('T')[0];
const PAGE_SIZE = 7;
const AUDIT_COLUMNS = 'id,org_id,user_id,action,entity_type,entity_id,details,ip_address,user_agent,created_at';

const dateStartIso = (date: string) => `${date}T00:00:00.000Z`;
const dateEndIso = (date: string) => `${date}T23:59:59.999Z`;

const tomorrowIsoStart = () => {
  const date = new Date(`${todayKey()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
};

const monthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
};

const AuditTrail: React.FC<AuditTrailProps> = ({ orgId, logs = [], brandColor = '#4f46e5' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverLogs, setServerLogs] = useState<AuditLog[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const orgLogs = useMemo(
    () => logs.filter(log => log.orgId === orgId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [logs, orgId]
  );

  const actionOptions = useMemo(
    () => ['ALL', ...Array.from(new Set([...orgLogs.map(log => log.action), ...serverLogs.map(log => log.action)].filter(Boolean))).sort()],
    [orgLogs, serverLogs]
  );

  const entityOptions = useMemo(
    () => ['ALL', ...Array.from(new Set([...orgLogs.map(log => log.entityType), ...serverLogs.map(log => log.entityType)].filter(Boolean))).sort()],
    [orgLogs, serverLogs]
  );

  const auditFilters = useMemo(() => {
    const filters: PageFilter[] = [{ column: 'org_id', operator: 'eq', value: orgId }];

    if (actionFilter !== 'ALL') {
      filters.push({ column: 'action', operator: 'eq', value: actionFilter });
    }

    if (entityFilter !== 'ALL') {
      filters.push({ column: 'entity_type', operator: 'eq', value: entityFilter });
    }

    if (dateFilterMode === 'TODAY') {
      filters.push({ column: 'created_at', operator: 'gte', value: dateStartIso(todayKey()) });
      filters.push({ column: 'created_at', operator: 'lt', value: tomorrowIsoStart() });
    } else if (dateFilterMode === 'THIS_MONTH') {
      const { start, end } = monthRange();
      filters.push({ column: 'created_at', operator: 'gte', value: start });
      filters.push({ column: 'created_at', operator: 'lt', value: end });
    } else if (dateFilterMode === 'CUSTOM') {
      if (dateFrom) {
        filters.push({ column: 'created_at', operator: 'gte', value: dateStartIso(dateFrom) });
      }
      if (dateTo) {
        filters.push({ column: 'created_at', operator: 'lte', value: dateEndIso(dateTo) });
      }
    }

    return filters;
  }, [actionFilter, dateFilterMode, dateFrom, dateTo, entityFilter, orgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, dateFilterMode, dateFrom, dateTo, debouncedSearchTerm, entityFilter, orgId]);

  useEffect(() => {
    let isActive = true;

    const loadAuditPage = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const result = await DataServiceFactory.getService().fetchPage<AuditLog>('audit_logs', {
          page: currentPage,
          pageSize: PAGE_SIZE,
          columns: AUDIT_COLUMNS,
          filters: auditFilters,
          search: debouncedSearchTerm.trim()
            ? {
              columns: ['action', 'entity_type', 'details', 'ip_address'],
              term: debouncedSearchTerm
            }
            : undefined,
          orderBy: [{ column: 'created_at', ascending: false }]
        });

        if (!isActive) return;
        setServerLogs(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      } catch (error) {
        if (!isActive) return;
        console.error('[AuditTrail] Failed to load audit logs page:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load audit logs.');
        setServerLogs([]);
        setServerTotal(0);
        setServerTotalPages(1);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    if (orgId) {
      loadAuditPage();
    }

    return () => {
      isActive = false;
    };
  }, [auditFilters, currentPage, debouncedSearchTerm, orgId]);

  const localFilteredLogs = useMemo(() => {
    const term = debouncedSearchTerm.trim().toLowerCase();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return orgLogs.filter(log => {
      const matchesSearch =
        !term ||
        String(log.userId || '').toLowerCase().includes(term) ||
        String(log.action || '').toLowerCase().includes(term) ||
        String(log.entityType || '').toLowerCase().includes(term) ||
        String(log.entityId || '').toLowerCase().includes(term) ||
        String(log.details || '').toLowerCase().includes(term) ||
        String(log.ipAddress || '').toLowerCase().includes(term);

      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
      const matchesEntity = entityFilter === 'ALL' || log.entityType === entityFilter;

      const logDate = new Date(log.createdAt);
      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = log.createdAt.slice(0, 10) === todayKey();
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = logDate.getMonth() === month && logDate.getFullYear() === year;
      } else if (dateFilterMode === 'CUSTOM') {
        const current = log.createdAt.slice(0, 10);
        const afterFrom = !dateFrom || current >= dateFrom;
        const beforeTo = !dateTo || current <= dateTo;
        matchesDate = afterFrom && beforeTo;
      }

      return matchesSearch && matchesAction && matchesEntity && matchesDate;
    });
  }, [actionFilter, dateFilterMode, dateFrom, dateTo, debouncedSearchTerm, entityFilter, orgLogs]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedLogs,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(localFilteredLogs, [debouncedSearchTerm, actionFilter, entityFilter, dateFilterMode, dateFrom, dateTo]);

  const useFallbackRows = !!loadError;
  const paginatedLogs = useFallbackRows ? fallbackPaginatedLogs : serverLogs;
  const totalItems = useFallbackRows ? localFilteredLogs.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverLogs.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;

  const summary = useMemo(() => {
    const visibleLogs = useFallbackRows ? localFilteredLogs : serverLogs;
    const users = new Set(visibleLogs.map(log => log.userId).filter(Boolean)).size;
    const entityTypes = new Set(visibleLogs.map(log => log.entityType).filter(Boolean)).size;
    const todayEvents = dateFilterMode === 'TODAY' && !useFallbackRows
      ? serverTotal
      : visibleLogs.filter(log => log.createdAt.slice(0, 10) === todayKey()).length;

    return {
      total: totalItems,
      users,
      entityTypes,
      todayEvents
    };
  }, [dateFilterMode, localFilteredLogs, serverLogs, serverTotal, totalItems, useFallbackRows]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    actionFilter !== 'ALL' ||
    entityFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('ALL');
    setEntityFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setShowActionDropdown(false);
    setShowEntityDropdown(false);
    setShowDateDropdown(false);
  };

  const dateFilterLabel =
    dateFilterMode === 'ALL'
      ? 'All'
      : dateFilterMode === 'TODAY'
        ? 'Today'
        : dateFilterMode === 'THIS_MONTH'
          ? 'This Month'
          : 'Between...';

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Organization Audit Trail</h2>
          <p className="text-sm italic text-gray-500">{summary.total} audit records for this organization</p>
        </div>
        <div
          className="px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
          style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor, borderColor: 'var(--acm-primary-light)' }}
        >
          <ShieldCheck size={18} />
          {summary.total} Events
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Events</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.users}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Entity Types</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{summary.entityTypes}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Today</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.todayEvents}</p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowActionDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Action:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{actionFilter === 'ALL' ? 'All' : actionFilter}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showActionDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {actionOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => { setActionFilter(option); setShowActionDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${actionFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        style={actionFilter === option ? { backgroundColor: brandColor } : undefined}
                      >
                        {option === 'ALL' ? 'All Actions' : option}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <div
              onClick={() => setShowEntityDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Entity:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{entityFilter === 'ALL' ? 'All' : entityFilter}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showEntityDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEntityDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {entityOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => { setEntityFilter(option); setShowEntityDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${entityFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                        style={entityFilter === option ? { backgroundColor: brandColor } : undefined}
                      >
                        {option === 'ALL' ? 'All Entities' : option.replaceAll('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
            >
              <span className="text-[13px] text-gray-500 mr-1">Date:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">{dateFilterLabel}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showDateDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-gray-100 p-1">
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100 rounded"
                    >
                      All Dates
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'TODAY' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                      style={dateFilterMode === 'TODAY' ? { backgroundColor: brandColor } : undefined}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] rounded ${dateFilterMode === 'THIS_MONTH' ? 'text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                      style={dateFilterMode === 'THIS_MONTH' ? { backgroundColor: brandColor } : undefined}
                    >
                      This Month
                    </button>
                  </div>

                  <div className="p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDateDropdown(false)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDateDropdown(false)}
                        className="px-4 py-1 rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                        style={{ backgroundColor: brandColor }}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="p-2 text-gray-400 transition-colors"
            style={hasActiveFilters ? { color: brandColor } : undefined}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <Filter size={14} />
            <span>{totalItems} record{totalItems !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead style={{ backgroundColor: brandColor }}>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide w-48">Timestamp</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide w-32">User</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide w-32">Action</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide w-40">Entity</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <History size={32} className="text-gray-300" />
                    <p>Loading audit records...</p>
                  </div>
                </td>
              </tr>
            ) : totalItems === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <History size={32} className="text-gray-300" />
                    <p>{loadError ? 'Unable to load audit records from Supabase.' : 'No audit records found for the current search and filter.'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                      <Clock size={14} className="text-gray-400" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: 'var(--acm-primary-light)', color: brandColor }}
                      >
                        {log.userId.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-gray-600">{log.userId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-2 py-1 rounded text-xs font-bold uppercase"
                      style={['POST', 'CREATE', 'REVERSE', 'UPDATE', 'DELETE'].includes(log.action)
                        ? { backgroundColor: 'var(--acm-primary-light)', color: brandColor }
                        : undefined}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-tight">{log.entityType.replace('_', ' ')}</span>
                      <span className="text-gray-900 font-mono text-xs">{log.entityId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 leading-relaxed">
                      {log.details}
                      {log.ipAddress && (
                        <div className="text-xs text-gray-400 mt-2">IP: {log.ipAddress}</div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="audit records"
        />
      </div>
    </div>
  );
};

export default AuditTrail;
