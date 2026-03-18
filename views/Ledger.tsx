
import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ChartOfAccount, JournalEntry, JournalLine, Student,
  Trainer, Sponsor, Batch, NonStockItem, User, Qualification
} from '../types';
import { Search, RotateCcw, BookText, Plus, X, ChevronDown, CheckSquare, Download, FileSpreadsheet, FileText, ArrowUpDown, ChevronUp } from 'lucide-react';
import JournalForm from '../components/JournalForm';

interface LedgerProps {
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  students: Student[];
  sponsors: Sponsor[];
  trainers: Trainer[];
  batches: Batch[];
  items: NonStockItem[];
  qualifications?: Qualification[];
  users?: User[];
  currentUser?: any;
  onPostEntry?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => void;
  onApproveJournal?: (entryId: string) => void;
  onReverseJournal?: (entryId: string) => void;
  initialSearchTerm?: string;
}

const Ledger: React.FC<LedgerProps> = ({
  accounts, entries, lines, students, sponsors, trainers, batches, items, qualifications = [], users = [],
  currentUser, onPostEntry, onApproveJournal, onReverseJournal,
  initialSearchTerm = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ON_HOLD' | 'POSTED' | 'REVERSED'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'date', direction: 'desc' });

  // Column ordering and resize state
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'source', 'date', 'glReference', 'description', 'total', 'status', 'createdBy', 'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  const entryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    lines.forEach(line => {
      const id = line.journalEntryId;
      totals.set(id, (totals.get(id) || 0) + (line.debit || 0));
    });
    return totals;
  }, [lines]);

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const hasLetters = /[a-z]/i.test(term);
    const hasNumbers = /\d/.test(term);
    const numericTerm = term.replace(/[, ]/g, '');

    return entries.filter(entry => {
      const entryStatus = (entry.status === 'DRAFT' ? 'ON_HOLD' : (entry.status || 'ON_HOLD')) as JournalEntry['status'] | 'ON_HOLD';
      const matchesStatus = statusFilter === 'ALL' || entryStatus === statusFilter;

      let matchesDate = true;
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const entryDate = entry.date;

      if (dateFilterMode === 'TODAY') {
        matchesDate = entryDate === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = entryDate >= firstDayOfMonth && entryDate <= today;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || entryDate >= dateFrom) &&
                      (!dateTo || entryDate <= dateTo);
      }

      if (!term) {
        return matchesStatus && matchesDate;
      }

      const glRef = (entry.glEntryNumber || entry.reference || '').toLowerCase();
      const matchesGlRef = glRef.includes(term);

      const matchesOpenOnHoldDescription =
        hasLetters &&
        (entryStatus === 'POSTED' || entryStatus === 'ON_HOLD') &&
        (entry.description || '').toLowerCase().includes(term);

      const total = entryTotals.get(entry.id) || 0;
      const totalDigits = total
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .replace(/,/g, '');
      const matchesTotal = hasNumbers && totalDigits.includes(numericTerm);

      const matchesSearch = matchesGlRef || matchesOpenOnHoldDescription || matchesTotal;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [entries, entryTotals, searchTerm, statusFilter, dateFilterMode, dateFrom, dateTo]);

  const sortedEntries = useMemo(() => {
    if (sortConfig.direction === 'none') return filteredEntries;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const key = sortConfig.key;
    const getValue = (entry: JournalEntry) => {
      switch (key) {
        case 'source': return entry.sourceType || '';
        case 'date': return entry.date || '';
        case 'glReference': return (entry.glEntryNumber || entry.reference || '').trim();
        case 'description': return entry.description || '';
        case 'total': return entryTotals.get(entry.id) || 0;
        case 'status': return entry.status || 'ON_HOLD';
        case 'createdBy': return getCreatedByName(entry.createdBy) || '';
        case 'createdOn': return entry.createdAt || '';
        default: return (entry as any)[key] ?? '';
      }
    };
    return [...filteredEntries].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [filteredEntries, sortConfig, entryTotals]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 text-emerald-200 opacity-70" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-white" />
      : <ChevronDown size={12} className="ml-1 text-white" />;
  };

  const formatEntryDate = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'MM-dd-yyyy');
  };

  const getCreatedByName = (createdBy?: string) => {
    if (!createdBy) return '—';
    if (createdBy === 'system') return 'System';
    const user = users.find(u => u.id === createdBy);
    return user?.name || user?.email || createdBy;
  };

  const getDisplayStatusLabel = (status?: JournalEntry['status']) => {
    const map: Record<JournalEntry['status'], string> = {
      DRAFT: 'ON HOLD',
      ON_HOLD: 'ON HOLD',
      POSTED: 'POSTED',
      REVERSED: 'REVERSED',
      REVISION_REQUESTED: 'REVISION REQUESTED'
    };
    return status ? (map[status] || status) : 'ON HOLD';
  };

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getRegistryExportColumns = () => ([
    { key: 'source', label: 'Memo / Source', value: (e: JournalEntry) => e.sourceType || '-' },
    { key: 'date', label: 'Date', value: (e: JournalEntry) => formatEntryDate(e.date) },
    { key: 'glReference', label: 'GL Reference No.', value: (e: JournalEntry) => (e.glEntryNumber || e.reference || '-').trim() },
    { key: 'description', label: 'Description', value: (e: JournalEntry) => e.description || '-' },
    { key: 'total', label: 'Transaction Total', value: (e: JournalEntry) => entryTotals.get(e.id) || 0 },
    { key: 'status', label: 'Status', value: (e: JournalEntry) => getDisplayStatusLabel(e.status || 'ON_HOLD') },
    { key: 'createdBy', label: 'Created By', value: (e: JournalEntry) => getCreatedByName(e.createdBy) },
    { key: 'createdOn', label: 'Created On', value: (e: JournalEntry) => formatEntryDate(e.createdAt) },
  ]);

  const getExportRows = () => {
    const columns = getRegistryExportColumns();
    return filteredEntries.map(entry => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        row[col.label] = col.value(entry);
      });
      return row;
    });
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No journal entries to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:\"#,##0.00\"}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const formattedNumber = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        const value = col.key === 'total' && isNum ? `₱${formattedNumber}` : formattedNumber;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Journal_Entries_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No journal entries to export.'); return; }
    const columns = getRegistryExportColumns();
    const cols = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Journal Entries</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { font-size:12px; color:#6b7280; margin-bottom:12px; }
      table { width:100%; border-collapse:collapse; }
      th, td { border:1px solid #e5e7eb; padding:6px 8px; font-size:11px; }
      th { background:#059669; color:white; text-transform:uppercase; letter-spacing:.04em; }
      td.num { text-align:right; }
    </style></head><body>
      <h2>Journal Entries Registry</h2>
      <div class="subtitle">Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} — ${rows.length} record(s)</div>
      <table><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const formattedNumber = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        const value = col.key === 'total' && isNum ? `₱${formattedNumber}` : formattedNumber;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {!showEntryForm && !selectedEntry && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Journal Entries</h2>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowEntryForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300 shrink-0"
          >
            <Plus size={20} /> New Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar - Far Left */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-64">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search journal entries..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          {/* Status Filter */}
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="POSTED">POSTED</option>
              <option value="REVERSED">REVERSED</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <div
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
            >
              <span className="text-[13px] text-gray-500 mr-1">Date:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
              </span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showDateDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-gray-100 p-1">
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                    >
                      Remove Quick Filter
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                      className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                      disabled
                    >
                      Clear Filter
                    </button>
                  </div>

                  <div className="border-b border-gray-100 p-1">
                    <button
                      onClick={() => { setDateFilterMode('CUSTOM'); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                    </button>
                    <button
                      onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                    </button>
                  </div>

                  <div className="p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                        className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex justify-end items-center gap-2 pt-1">
                      <button
                        onClick={() => setShowDateDropdown(false)}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setDateFilterMode('ALL');
              setDateFrom('');
              setDateTo('');
            }}
            className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          {/* Export Dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm select-none"
              title="Export"
            >
              <Download size={16} />
              <span>Export</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)}></div>
                <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        exportToExcel();
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                    >
                      <FileSpreadsheet size={16} className="text-emerald-600" />
                      Export as Excel
                    </button>
                    <button
                      onClick={() => {
                        setShowExportDropdown(false);
                        exportToPdf();
                      }}
                      className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 rounded transition-colors"
                    >
                      <FileText size={16} className="text-red-500" />
                      Export as PDF
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full font-sans text-[13px]">
          <thead className="bg-emerald-600 border-b">
            <tr>
              {(() => {
                const columns = {
                  source: { key: 'source', label: 'Memo / Source', align: 'text-left', width: 160, sortKey: 'source' },
                  date: { key: 'date', label: 'Date', align: 'text-left', width: 110, sortKey: 'date' },
                  glReference: { key: 'glReference', label: 'GL Reference No.', align: 'text-left', width: 170, sortKey: 'glReference' },
                  description: { key: 'description', label: 'Description', align: 'text-left', width: 220, sortKey: 'description' },
                  total: { key: 'total', label: 'Transaction Total', align: 'text-right', width: 150, sortKey: 'total' },
                  status: { key: 'status', label: 'Status', align: 'text-center', width: 120, sortKey: 'status' },
                  createdBy: { key: 'createdBy', label: 'Created By', align: 'text-left', width: 170, sortKey: 'createdBy' },
                  createdOn: { key: 'createdOn', label: 'Created On', align: 'text-left', width: 130, sortKey: 'createdOn' },
                };

                return columnOrder.map((colKey, idx) => {
                  const col = columns[colKey as keyof typeof columns];
                  return (
                    <th
                      key={col.key}
                      className={`px-4 py-3 ${col.align} cursor-move font-semibold text-white ${draggedColumnIdx === idx ? 'bg-emerald-700 border-dashed border-2 border-emerald-300 opacity-50' : ''} group select-none transition-colors border-x border-transparent hover:bg-emerald-700 hover:border-emerald-200 relative`}
                      style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : { minWidth: col.width, width: col.width }}
                      draggable
                      onDragStart={(e) => {
                        setDraggedColumnIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedColumnIdx(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedColumnIdx === null || draggedColumnIdx === idx) return;
                        const newOrder = [...columnOrder];
                        const [draggedKey] = newOrder.splice(draggedColumnIdx, 1);
                        newOrder.splice(idx, 0, draggedKey);
                        setColumnOrder(newOrder);
                        setDraggedColumnIdx(null);
                      }}
                      title="Drag to reorder column"
                    >
                      <div
                        className={`flex items-center ${col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : ''} text-[13px] font-bold text-white cursor-pointer`}
                        onClick={() => handleSort(col.sortKey)}
                      >
                        {col.label} <SortIndicator columnKey={col.sortKey} />
                      </div>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (!th) return;
                          const startWidth = th.getBoundingClientRect().width;
                          resizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                          const onMouseMove = (ev: MouseEvent) => {
                            if (!resizeRef.current) return;
                            const diff = ev.clientX - resizeRef.current.startX;
                            const newWidth = Math.max(60, resizeRef.current.startWidth + diff);
                            setColumnWidths(prev => ({ ...prev, [resizeRef.current!.colKey]: newWidth }));
                          };
                          const onMouseUp = () => {
                            resizeRef.current = null;
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            document.body.style.cursor = '';
                            document.body.style.userSelect = '';
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                          document.body.style.cursor = 'col-resize';
                          document.body.style.userSelect = 'none';
                        }}
                        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-emerald-400 transition-colors z-10"
                        title="Drag to resize column"
                        draggable={false}
                      />
                    </th>
                  );
                });
              })()}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedEntries.length === 0 ? (
              <tr>
                <td colSpan={columnOrder.length} className="px-4 py-12 text-center text-gray-500">
                  <div className="p-6 bg-white rounded shadow-sm inline-block mb-4 border border-gray-100">
                    <BookText size={48} className="text-gray-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">No Journal Records</h3>
                    <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto italic font-medium">The ledger is currently empty. Manual entries or system-generated records will appear here once posted.</p>
                    <button
                      onClick={() => setShowEntryForm(true)}
                      className="mt-6 px-8 py-3 bg-gray-800 text-white rounded text-xs font-semibold uppercase tracking-wide shadow-md active:scale-95 transition-all"
                    >
                      Create First Entry
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEntries.map(entry => {
                const controlTotal = entryTotals.get(entry.id) || 0;
                const statusLabel = entry.status || 'ON_HOLD';

                const cells: Record<string, React.ReactNode> = {
                  source: (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                      <span className="text-[13px] font-medium text-gray-700">{entry.sourceType}</span>
                    </div>
                  ),
                  date: <span className="font-medium text-gray-800">{formatEntryDate(entry.date)}</span>,
                  glReference: (
                    <span className="text-[13px] font-medium text-gray-900">
                      {(entry.glEntryNumber || entry.reference)?.trim() || '—'}
                    </span>
                  ),
                  description: <span className="font-medium text-gray-800 line-clamp-2">{entry.description}</span>,
                  total: (
                    <span className="font-medium text-gray-800">
                      <span className="mr-1 text-gray-500">₱</span>
                      {controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ),
                  status: (
                    <span className="font-medium text-gray-800">
                      {getDisplayStatusLabel(statusLabel)}
                    </span>
                  ),
                  createdBy: <span className="font-medium text-gray-600">{getCreatedByName(entry.createdBy)}</span>,
                  createdOn: <span className="font-medium text-gray-600">{formatEntryDate(entry.createdAt)}</span>,
                };

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    {columnOrder.map(colKey => (
                      <td
                        key={colKey}
                        className={`px-4 py-3 ${
                          colKey === 'total' ? 'text-right' :
                          colKey === 'status' ? 'text-center' : 'text-left'
                        }`}
                        style={columnWidths[colKey] ? { width: columnWidths[colKey], minWidth: columnWidths[colKey] } : undefined}
                      >
                        {cells[colKey]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {showEntryForm && (
        <JournalForm
          accounts={accounts}
          students={students}
          trainers={trainers}
          sponsors={sponsors}
          batches={batches}
          items={items}
          qualifications={qualifications}
          entries={entries}
          onClose={() => setShowEntryForm(false)}
          onSubmit={(entry, lines) => {
            onPostEntry?.(entry, lines);
            setShowEntryForm(false);
          }}
        />
      )}

      {selectedEntry && (
        <JournalEntryDetail
          entry={selectedEntry}
          lines={lines.filter(l => l.journalEntryId === selectedEntry.id)}
          accounts={accounts}
          onClose={() => setSelectedEntry(null)}
          onApprove={onApproveJournal}
          onReverse={onReverseJournal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// --- Sub-component for Detail View ---
interface JournalEntryDetailProps {
  entry: JournalEntry;
  lines: JournalLine[];
  accounts: ChartOfAccount[];
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReverse?: (id: string) => void;
  currentUser?: any;
}

const JournalEntryDetail: React.FC<JournalEntryDetailProps> = ({ 
  entry, lines, accounts, onClose, onApprove, onReverse, currentUser 
}) => {
  const controlTotal = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
              title="Back to Journal Entries"
            >
              <X size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="p-2 bg-[#F47721] text-white rounded-xl shadow-md font-bold text-xs">VOUCHER</div>
            <div>
               <h3 className="text-lg font-bold text-slate-800 tracking-tight">Journal Entry Details</h3>
               <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-0.5">{entry.reference}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Header Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <DetailItem label="Memo / Source" value={entry.description} icon={<BookText size={14} />} />
            <DetailItem label="Transaction Date" value={entry.date} />
            <DetailItem label="GL Reference" value={(entry.glEntryNumber || entry.reference || '—')} highlight />
            <DetailItem label="Source Type" value={entry.sourceType} />
            <DetailItem label="Transaction Total" value={controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mono />
            <DetailItem label="Status" value={
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                entry.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                entry.status === 'REVERSED' ? 'bg-rose-100 text-rose-600' :
                'bg-blue-100 text-blue-700'
              }`}>
                {getDisplayStatusLabel(entry.status || 'ON_HOLD')}
              </span>
            } />
            <DetailItem label="Created By" value={getCreatedByName(entry.createdBy)} />
            <DetailItem label="Entry ID" value={entry.id} muted />
          </div>

          {/* Lines Table */}
          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Account Code</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Account Title</th>
                  <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Memo</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Debit</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 w-32">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => {
                  const acc = accounts.find(a => a.id === line.accountId);
                  return (
                    <tr key={line.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{acc?.code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{acc?.name}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-slate-600 italic line-clamp-1">{line.memo || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-mono font-bold text-slate-700">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 font-black">
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="px-5 py-4 text-xs uppercase tracking-widest text-slate-400">Total Voucher Value</td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {controlTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm text-slate-900 underline decoration-slate-300 decoration-2 underline-offset-4">
                    {lines.reduce((sum, l) => sum + (l.credit || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center bg-slate-50 -m-8 mt-4 p-8 border-t">
            <div className="flex gap-2">
               <button className="px-5 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-slate-600 uppercase tracking-wide shadow-sm" onClick={() => window.print()}>Print Voucher</button>
            </div>
            <div className="flex gap-4">
               {(entry.status === 'DRAFT' || entry.status === 'ON_HOLD') && (currentUser?.role === 'ACCOUNTANT' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN') && (
                  <button onClick={() => { onApprove?.(entry.id); onClose(); }} className="px-10 py-3 bg-[#F47721] text-white rounded-2xl text-sm font-bold shadow-xl shadow-orange-100 hover:bg-[#E06610] active:scale-95 transition-all">Authorize Posting</button>
               )}
               {entry.status === 'POSTED' && !entry.description.startsWith('REV:') && (
                 <button onClick={() => { onReverse?.(entry.id); onClose(); }} className="px-10 py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-2">
                    <RotateCcw size={16} /> Post Reversal
                 </button>
               )}
               <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-2xl text-sm font-bold shadow-lg shadow-slate-200 hover:bg-slate-900 active:scale-95 transition-all">Back to List</button>
            </div>
          </div>
        </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; highlight?: boolean; mono?: boolean; muted?: boolean }> = ({ 
  label, value, icon, highlight, mono, muted 
}) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
      {icon} {label}
    </p>
    <p className={`text-sm font-bold ${highlight ? 'text-gray-900 cursor-default' : 'text-slate-800'} ${mono ? 'font-mono' : ''} ${muted ? 'text-slate-400 text-[11px]' : ''}`}>
      {value}
    </p>
  </div>
);

export default Ledger;



