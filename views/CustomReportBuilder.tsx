import React, { useState, useMemo, useCallback } from 'react';
import { ChartOfAccount, JournalEntry, JournalLine, AccountClass, Vendor, Student, Trainer, Employee, Batch, Qualification } from '../types';
import { Download, Printer, Plus, Trash2, GripVertical, Filter, Columns, ArrowUpDown, Save, FolderOpen, Play, X, ChevronDown, ChevronRight, BarChart3, Table, PieChart, Calendar, Eye, EyeOff } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

// ===== Types =====
export interface ReportColumn {
  id: string;
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency';
  visible: boolean;
  width?: number;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'isNull' | 'isNotNull';
  value: string;
  value2?: string; // For 'between' operator
}

export interface ReportSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportGroup {
  field: string;
  collapsed?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  dataSource: 'transactions' | 'chart_of_accounts' | 'entries' | 'contacts';
  columns: ReportColumn[];
  filters: ReportFilter[];
  sorts: ReportSort[];
  groups: ReportGroup[];
  createdAt: string;
  updatedAt?: string;
}

interface CustomReportBuilderProps {
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  vendors?: Vendor[];
  students?: Student[];
  trainers?: Trainer[];
  employees?: Employee[];
  batches?: Batch[];
  qualifications?: Qualification[];
  currency?: string;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

// ===== Available Columns by Data Source =====
const COLUMN_DEFINITIONS: Record<string, ReportColumn[]> = {
  transactions: [
    { id: 'date', field: 'date', label: 'Date', type: 'date', visible: true },
    { id: 'reference', field: 'reference', label: 'Reference', type: 'text', visible: true },
    { id: 'description', field: 'description', label: 'Description', type: 'text', visible: true },
    { id: 'accountCode', field: 'accountCode', label: 'Account Code', type: 'text', visible: true },
    { id: 'accountName', field: 'accountName', label: 'Account Name', type: 'text', visible: true },
    { id: 'accountClass', field: 'accountClass', label: 'Account Class', type: 'text', visible: false },
    { id: 'debit', field: 'debit', label: 'Debit', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'credit', field: 'credit', label: 'Credit', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'balance', field: 'balance', label: 'Balance', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'memo', field: 'memo', label: 'Memo', type: 'text', visible: false },
    { id: 'sourceType', field: 'sourceType', label: 'Source Type', type: 'text', visible: false },
    { id: 'status', field: 'status', label: 'Status', type: 'text', visible: false },
    { id: 'contactType', field: 'contactType', label: 'Contact Type', type: 'text', visible: false },
    { id: 'batchId', field: 'batchId', label: 'Batch', type: 'text', visible: false },
  ],
  accounts: [
    { id: 'code', field: 'code', label: 'Account Code', type: 'text', visible: true },
    { id: 'name', field: 'name', label: 'Account Name', type: 'text', visible: true },
    { id: 'class', field: 'class', label: 'Account Class', type: 'text', visible: true },
    { id: 'isActive', field: 'isActive', label: 'Active', type: 'text', visible: true },
    { id: 'isHeader', field: 'isHeader', label: 'Header Account', type: 'text', visible: false },
    { id: 'totalDebit', field: 'totalDebit', label: 'Total Debits', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'totalCredit', field: 'totalCredit', label: 'Total Credits', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'balance', field: 'balance', label: 'Balance', type: 'currency', visible: true, aggregation: 'sum' },
  ],
  entries: [
    { id: 'date', field: 'date', label: 'Date', type: 'date', visible: true },
    { id: 'reference', field: 'reference', label: 'Reference', type: 'text', visible: true },
    { id: 'description', field: 'description', label: 'Description', type: 'text', visible: true },
    { id: 'sourceType', field: 'sourceType', label: 'Source Type', type: 'text', visible: true },
    { id: 'status', field: 'status', label: 'Status', type: 'text', visible: true },
    { id: 'lineCount', field: 'lineCount', label: 'Line Count', type: 'number', visible: true, aggregation: 'sum' },
    { id: 'totalAmount', field: 'totalAmount', label: 'Total Amount', type: 'currency', visible: true, aggregation: 'sum' },
    { id: 'createdBy', field: 'createdBy', label: 'Created By', type: 'text', visible: false },
    { id: 'createdAt', field: 'createdAt', label: 'Created At', type: 'date', visible: false },
  ],
};

const FILTER_OPERATORS: Record<string, { label: string; requiresValue: boolean; requiresValue2?: boolean }> = {
  equals: { label: 'Equals', requiresValue: true },
  notEquals: { label: 'Not Equals', requiresValue: true },
  contains: { label: 'Contains', requiresValue: true },
  startsWith: { label: 'Starts With', requiresValue: true },
  endsWith: { label: 'Ends With', requiresValue: true },
  gt: { label: 'Greater Than', requiresValue: true },
  gte: { label: 'Greater Than or Equal', requiresValue: true },
  lt: { label: 'Less Than', requiresValue: true },
  lte: { label: 'Less Than or Equal', requiresValue: true },
  between: { label: 'Between', requiresValue: true, requiresValue2: true },
  isNull: { label: 'Is Empty', requiresValue: false },
  isNotNull: { label: 'Is Not Empty', requiresValue: false },
};

const DATA_SOURCES = [
  { id: 'transactions', label: 'Transaction Details', description: 'Individual journal line items with full details' },
  { id: 'chart_of_accounts', label: 'Account Summaries', description: 'Chart of accounts with debit/credit totals' },
  { id: 'entries', label: 'Journal Entries', description: 'Journal entry headers with line counts' },
];

const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  accounts,
  entries,
  lines,
  vendors = [],
  students = [],
  trainers = [],
  employees = [],
  batches = [],
  qualifications = [],
  currency = 'USD',
  onNotify
}) => {
  // ===== State =====
  const [dataSource, setDataSource] = useState<'transactions' | 'chart_of_accounts' | 'entries'>('transactions');
  const [columns, setColumns] = useState<ReportColumn[]>(COLUMN_DEFINITIONS.transactions);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sorts, setSorts] = useState<ReportSort[]>([{ field: 'date', direction: 'desc' }]);
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('AT_ERP_REPORT_TEMPLATES');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [templateName, setTemplateName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [activePanel, setActivePanel] = useState<'columns' | 'filters' | 'groups' | 'preview'>('columns');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // ===== Data Source Change Handler =====
  const handleDataSourceChange = useCallback((source: 'transactions' | 'chart_of_accounts' | 'entries') => {
    setDataSource(source);
    setColumns(COLUMN_DEFINITIONS[source] || []);
    setFilters([]);
    setSorts([{ field: source === 'transactions' ? 'date' : 'code', direction: 'desc' }]);
    setGroups([]);
  }, []);

  // ===== Build Raw Data =====
  const rawData = useMemo(() => {
    const postedEntries = entries.filter(e => e.status === 'POSTED' && e.date >= dateFrom && e.date <= dateTo);
    const entryIds = new Set(postedEntries.map(e => e.id));

    if (dataSource === 'transactions') {
      return lines
        .filter(l => entryIds.has(l.journalEntryId))
        .map(line => {
          const entry = postedEntries.find(e => e.id === line.journalEntryId);
          const account = accounts.find(a => a.id === line.accountId);
          return {
            id: line.id,
            date: entry?.date || '',
            reference: entry?.reference || '',
            description: entry?.description || '',
            accountCode: account?.code || '',
            accountName: account?.name || '',
            accountClass: account?.class || '',
            debit: line.debit || 0,
            credit: line.credit || 0,
            balance: (line.debit || 0) - (line.credit || 0),
            memo: line.memo || line.description || '',
            sourceType: entry?.sourceType || '',
            status: entry?.status || '',
            contactType: line.contactType || '',
            batchId: line.batchId || '',
          };
        });
    }

    if (dataSource === 'chart_of_accounts') {
      return accounts
        .filter(a => !a.isHeader && a.isActive)
        .map(account => {
          const accountLines = lines.filter(l => l.accountId === account.id && entryIds.has(l.journalEntryId));
          const totalDebit = accountLines.reduce((sum, l) => sum + (l.debit || 0), 0);
          const totalCredit = accountLines.reduce((sum, l) => sum + (l.credit || 0), 0);
          const isDebitNormal = account.class === 'ASSET' || account.class === 'EXPENSE';
          const balance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;
          return {
            id: account.id,
            code: account.code,
            name: account.name,
            class: account.class,
            isActive: account.isActive ? 'Yes' : 'No',
            isHeader: account.isHeader ? 'Yes' : 'No',
            totalDebit,
            totalCredit,
            balance,
          };
        });
    }

    if (dataSource === 'entries') {
      return postedEntries.map(entry => {
        const entryLines = lines.filter(l => l.journalEntryId === entry.id);
        const totalAmount = entryLines.reduce((sum, l) => sum + (l.debit || 0), 0);
        return {
          id: entry.id,
          date: entry.date,
          reference: entry.reference,
          description: entry.description,
          sourceType: entry.sourceType,
          status: entry.status,
          lineCount: entryLines.length,
          totalAmount,
          createdBy: entry.createdBy,
          createdAt: entry.createdAt,
        };
      });
    }

    return [];
  }, [dataSource, accounts, entries, lines, dateFrom, dateTo]);

  // ===== Apply Filters =====
  const filteredData = useMemo(() => {
    let data = [...rawData];

    for (const filter of filters) {
      data = data.filter(row => {
        const value = (row as any)[filter.field];
        const filterVal = filter.value;
        const filterVal2 = filter.value2;

        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === String(filterVal).toLowerCase();
          case 'notEquals':
            return String(value).toLowerCase() !== String(filterVal).toLowerCase();
          case 'contains':
            return String(value).toLowerCase().includes(String(filterVal).toLowerCase());
          case 'startsWith':
            return String(value).toLowerCase().startsWith(String(filterVal).toLowerCase());
          case 'endsWith':
            return String(value).toLowerCase().endsWith(String(filterVal).toLowerCase());
          case 'gt':
            return Number(value) > Number(filterVal);
          case 'gte':
            return Number(value) >= Number(filterVal);
          case 'lt':
            return Number(value) < Number(filterVal);
          case 'lte':
            return Number(value) <= Number(filterVal);
          case 'between':
            return Number(value) >= Number(filterVal) && Number(value) <= Number(filterVal2);
          case 'isNull':
            return value === null || value === undefined || value === '';
          case 'isNotNull':
            return value !== null && value !== undefined && value !== '';
          default:
            return true;
        }
      });
    }

    return data;
  }, [rawData, filters]);

  // ===== Apply Sorting =====
  const sortedData = useMemo(() => {
    const data = [...filteredData];
    
    for (const sort of sorts.slice().reverse()) {
      data.sort((a, b) => {
        const aVal = (a as any)[sort.field];
        const bVal = (b as any)[sort.field];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');
        return sort.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return data;
  }, [filteredData, sorts]);

  // ===== Apply Grouping =====
  const groupedData = useMemo(() => {
    if (groups.length === 0) {
      return { ungrouped: sortedData };
    }

    const grouped: Record<string, any[]> = {};
    
    for (const row of sortedData) {
      const groupKey = groups.map(g => (row as any)[g.field] || 'Unspecified').join(' > ');
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(row);
    }

    return grouped;
  }, [sortedData, groups]);

  // ===== Visible Columns =====
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);

  // ===== Column Toggle =====
  const toggleColumn = (columnId: string) => {
    setColumns(prev => prev.map(c => c.id === columnId ? { ...c, visible: !c.visible } : c));
  };

  // ===== Filter Management =====
  const addFilter = () => {
    const firstField = columns[0]?.field || 'date';
    setFilters(prev => [...prev, { id: `filter-${Date.now()}`, field: firstField, operator: 'equals', value: '' }]);
  };

  const updateFilter = (id: string, updates: Partial<ReportFilter>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  // ===== Sort Management =====
  const addSort = () => {
    const firstField = columns[0]?.field || 'date';
    setSorts(prev => [...prev, { field: firstField, direction: 'asc' }]);
  };

  const updateSort = (index: number, updates: Partial<ReportSort>) => {
    setSorts(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeSort = (index: number) => {
    setSorts(prev => prev.filter((_, i) => i !== index));
  };

  // ===== Group Management =====
  const addGroup = () => {
    const usedFields = new Set(groups.map(g => g.field));
    const availableField = columns.find(c => !usedFields.has(c.field))?.field || 'accountClass';
    setGroups(prev => [...prev, { field: availableField }]);
  };

  const updateGroup = (index: number, field: string) => {
    setGroups(prev => prev.map((g, i) => i === index ? { ...g, field } : g));
  };

  const removeGroup = (index: number) => {
    setGroups(prev => prev.filter((_, i) => i !== index));
  };

  // ===== Save/Load Templates =====
  const saveTemplate = () => {
    if (!templateName.trim()) {
      onNotify?.('error', 'Please enter a template name');
      return;
    }

    const template: ReportTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      dataSource,
      columns,
      filters,
      sorts,
      groups,
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedTemplates, template];
    setSavedTemplates(updated);
    localStorage.setItem('AT_ERP_REPORT_TEMPLATES', JSON.stringify(updated));
    setShowSaveModal(false);
    setTemplateName('');
    onNotify?.('success', `Template "${templateName}" saved successfully`);
  };

  const loadTemplate = (template: ReportTemplate) => {
    setDataSource(template.dataSource);
    setColumns(template.columns);
    setFilters(template.filters);
    setSorts(template.sorts);
    setGroups(template.groups);
    setShowLoadModal(false);
    onNotify?.('success', `Template "${template.name}" loaded`);
  };

  const deleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem('AT_ERP_REPORT_TEMPLATES', JSON.stringify(updated));
    onNotify?.('success', 'Template deleted');
  };

  // ===== Export =====
  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const timestamp = new Date().toISOString().split('T')[0];

    // Headers
    csvContent += visibleColumns.map(c => `"${c.label}"`).join(',') + '\n';

    // Data rows
    Object.entries(groupedData).forEach(([groupKey, rows]) => {
      if (groups.length > 0 && groupKey !== 'ungrouped') {
        csvContent += `\n"${groupKey}"\n`;
      }
      
      (rows as any[]).forEach(row => {
        csvContent += visibleColumns.map(col => {
          const val = row[col.field];
          if (col.type === 'currency') {
            return val?.toFixed(2) || '0.00';
          }
          return `"${String(val || '').replace(/"/g, '""')}"`;
        }).join(',') + '\n';
      });

      // Group totals
      if (groups.length > 0) {
        const totals = visibleColumns.map(col => {
          if (col.aggregation === 'sum' && col.type === 'currency') {
            const sum = (rows as any[]).reduce((acc, r) => acc + (r[col.field] || 0), 0);
            return sum.toFixed(2);
          }
          return '';
        });
        csvContent += totals.join(',') + '\n';
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Custom_Report_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify?.('success', 'Report exported to CSV');
  };

  const handlePrint = () => window.print();

  // ===== Format Helpers =====
  const formatValue = (value: any, column: ReportColumn) => {
    if (value === null || value === undefined) return '-';
    
    if (column.type === 'currency') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
    }
    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (column.type === 'number') {
      return new Intl.NumberFormat().format(value);
    }
    return String(value);
  };

  const totalRows = Object.values(groupedData).flat().length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Custom Report Builder</h2>
          <p className="text-sm text-gray-500 font-normal italic">Design and generate custom analytical and compliance reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowLoadModal(true)} className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-brand transition-colors text-xs font-semibold uppercase tracking-wide">
            <FolderOpen size={16} /> Load
          </button>
          <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-brand transition-colors text-xs font-semibold uppercase tracking-wide">
            <Save size={16} /> Save
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-all border border-gray-200 font-bold text-sm">
            <Printer size={18} className="text-brand" /> Print
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-bold text-sm">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Data Source & Date Range */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white p-5 rounded border border-gray-200">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 block">Data Source</label>
          <div className="flex gap-2 flex-wrap">
            {DATA_SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => handleDataSourceChange(source.id as any)}
                className={`flex-1 min-w-[150px] p-4 rounded border-2 text-left transition-all ${dataSource === source.id ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="text-sm font-bold text-gray-900">{source.label}</div>
                <div className="text-xs text-gray-500 mt-1">{source.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white p-5 rounded border border-gray-200">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Calendar size={12} /> Date Range
          </label>
          <div className="space-y-3">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
      </div>

      {/* Builder Panels */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {/* Panel Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'columns', icon: <Columns size={14} />, label: 'Columns', count: visibleColumns.length },
            { id: 'filters', icon: <Filter size={14} />, label: 'Filters', count: filters.length },
            { id: 'groups', icon: <BarChart3 size={14} />, label: 'Group & Sort', count: groups.length + sorts.length },
            { id: 'preview', icon: <Table size={14} />, label: 'Preview', count: totalRows },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePanel(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${activePanel === tab.id ? 'border-brand text-brand bg-brand/5' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && <span className="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <div className="p-6 min-h-[400px]">
          {/* Columns Panel */}
          {activePanel === 'columns' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">Select which columns to include in your report. Click to toggle visibility.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`flex items-center gap-3 p-3 rounded border-2 text-left transition-all ${col.visible ? 'border-brand bg-brand/5' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    {col.visible ? <Eye size={14} className="text-brand" /> : <EyeOff size={14} className="text-gray-400" />}
                    <div>
                      <div className="text-sm font-bold text-gray-900">{col.label}</div>
                      <div className="text-xs text-gray-500 uppercase">{col.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters Panel */}
          {activePanel === 'filters' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Add conditions to filter your report data.</p>
                <button onClick={addFilter} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded text-xs font-bold hover:bg-brand-hover transition-colors">
                  <Plus size={14} /> Add Filter
                </button>
              </div>
              
              {filters.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Filter size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No filters applied. Click "Add Filter" to add conditions.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filters.map(filter => (
                    <div key={filter.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded">
                      <select
                        value={filter.field}
                        onChange={e => updateFilter(filter.id, { field: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                      >
                        {columns.map(col => (
                          <option key={col.id} value={col.field}>{col.label}</option>
                        ))}
                      </select>
                      <select
                        value={filter.operator}
                        onChange={e => updateFilter(filter.id, { operator: e.target.value as any })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        {Object.entries(FILTER_OPERATORS).map(([key, op]) => (
                          <option key={key} value={key}>{op.label}</option>
                        ))}
                      </select>
                      {FILTER_OPERATORS[filter.operator]?.requiresValue && (
                        <input
                          type="text"
                          value={filter.value}
                          onChange={e => updateFilter(filter.id, { value: e.target.value })}
                          placeholder="Value..."
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      )}
                      {FILTER_OPERATORS[filter.operator]?.requiresValue2 && (
                        <input
                          type="text"
                          value={filter.value2 || ''}
                          onChange={e => updateFilter(filter.id, { value2: e.target.value })}
                          placeholder="To value..."
                          className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      )}
                      <button onClick={() => removeFilter(filter.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Groups & Sorts Panel */}
          {activePanel === 'groups' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Grouping */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Group By</h3>
                    <p className="text-xs text-gray-500 mt-1">Organize data into groups with subtotals</p>
                  </div>
                  <button onClick={addGroup} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                    <Plus size={12} /> Add Group
                  </button>
                </div>
                {groups.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded">
                    <BarChart3 size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No grouping applied</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                        <GripVertical size={14} className="text-gray-300" />
                        <select
                          value={group.field}
                          onChange={e => updateGroup(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                          {columns.map(col => (
                            <option key={col.id} value={col.field}>{col.label}</option>
                          ))}
                        </select>
                        <button onClick={() => removeGroup(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sorting */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Sort By</h3>
                    <p className="text-xs text-gray-500 mt-1">Order results by column values</p>
                  </div>
                  <button onClick={addSort} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">
                    <Plus size={12} /> Add Sort
                  </button>
                </div>
                <div className="space-y-2">
                  {sorts.map((sort, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                      <ArrowUpDown size={14} className="text-gray-400" />
                      <select
                        value={sort.field}
                        onChange={e => updateSort(index, { field: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        {columns.map(col => (
                          <option key={col.id} value={col.field}>{col.label}</option>
                        ))}
                      </select>
                      <select
                        value={sort.direction}
                        onChange={e => updateSort(index, { direction: e.target.value as any })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                      </select>
                      {sorts.length > 1 && (
                        <button onClick={() => removeSort(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview Panel */}
          {activePanel === 'preview' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-bold text-brand">{totalRows}</span> records
                  {groups.length > 0 && <span> in <span className="font-bold">{Object.keys(groupedData).length}</span> groups</span>}
                </p>
              </div>

              <div className="border border-gray-200 rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        {visibleColumns.map(col => (
                          <th key={col.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(groupedData).map(([groupKey, rows]) => (
                        <React.Fragment key={groupKey}>
                          {groups.length > 0 && groupKey !== 'ungrouped' && (
                            <tr className="bg-brand/5">
                              <td colSpan={visibleColumns.length} className="px-4 py-3 text-sm font-bold text-brand">
                                <ChevronRight size={14} className="inline mr-2" />
                                {groupKey}
                                <span className="ml-2 text-xs font-normal text-brand">({(rows as any[]).length} items)</span>
                              </td>
                            </tr>
                          )}
                          {(rows as any[]).slice(0, 50).map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-gray-50 transition-colors">
                              {visibleColumns.map(col => (
                                <td key={col.id} className={`px-4 py-3 text-sm whitespace-nowrap ${col.type === 'currency' ? 'font-mono text-right' : 'text-gray-700'}`}>
                                  {formatValue(row[col.field], col)}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {groups.length > 0 && (
                            <tr className="bg-gray-100 font-bold">
                              {visibleColumns.map(col => (
                                <td key={col.id} className={`px-4 py-2 text-xs ${col.type === 'currency' ? 'font-mono text-right' : ''}`}>
                                  {col.aggregation === 'sum' && col.type === 'currency' ? (
                                    formatValue((rows as any[]).reduce((acc, r) => acc + (r[col.field] || 0), 0), col)
                                  ) : col.field === visibleColumns[0]?.field ? 'Subtotal' : ''}
                                </td>
                              ))}
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    {groups.length === 0 && totalRows > 0 && (
                      <tfoot>
                        <tr className="bg-gray-800 text-white font-bold">
                          {visibleColumns.map(col => (
                            <td key={col.id} className={`px-4 py-3 text-xs ${col.type === 'currency' ? 'font-mono text-right' : ''}`}>
                              {col.aggregation === 'sum' && col.type === 'currency' ? (
                                formatValue(sortedData.reduce((acc, r) => acc + ((r as any)[col.field] || 0), 0), col)
                              ) : col.field === visibleColumns[0]?.field ? 'GRAND TOTAL' : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {totalRows > 50 && (
                  <div className="px-4 py-3 bg-amber-50 text-amber-800 text-xs font-medium border-t border-amber-200">
                    Preview limited to 50 rows. Export to CSV for full data.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-6 w-full max-w-md shadow-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Save Report Template</h3>
              <button onClick={() => setShowSaveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g., Monthly Expense Report"
                  className="w-full px-4 py-3 border border-gray-200 rounded text-sm"
                  autoFocus
                />
              </div>
              <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
                <p><strong>Data Source:</strong> {DATA_SOURCES.find(d => d.id === dataSource)?.label}</p>
                <p><strong>Columns:</strong> {visibleColumns.length} visible</p>
                <p><strong>Filters:</strong> {filters.length} conditions</p>
                <p><strong>Groups:</strong> {groups.length} levels</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-3 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={saveTemplate} className="flex-1 px-4 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors">
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Load Template Modal */}
      {showLoadModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-6 w-full max-w-lg shadow-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Load Report Template</h3>
              <button onClick={() => setShowLoadModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FolderOpen size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No saved templates yet</p>
                  <p className="text-xs mt-1">Save your first report configuration to reuse it later</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTemplates.map(template => (
                    <div key={template.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {DATA_SOURCES.find(d => d.id === template.dataSource)?.label} • 
                          {template.columns.filter(c => c.visible).length} columns • 
                          {template.filters.length} filters
                        </div>
                      </div>
                      <button onClick={() => loadTemplate(template)} className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-colors">
                        Load
                      </button>
                      <button onClick={() => deleteTemplate(template.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setShowLoadModal(false)} className="w-full px-4 py-3 border border-gray-200 rounded text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default CustomReportBuilder;

