import React, { useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  GraduationCap,
  Printer,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { BankAccount, JournalEntry, JournalLine, Payment, Sponsor, Student } from '../types';
import { format } from 'date-fns';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';

interface ARCollectionReceiptViewProps {
  entries: JournalEntry[];
  lines: JournalLine[];
  payments?: Payment[];
  bankAccounts: BankAccount[];
  students: Student[];
  sponsors: Sponsor[];
  currency: string;
  brandColor?: string;
}

type PayerTypeFilter = 'ALL' | 'SPONSOR' | 'STUDENT' | 'OTHER';
type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM';

interface CollectionRow {
  entry: JournalEntry;
  payerName: string;
  payerType: PayerTypeFilter;
  bankName: string;
  amount: number;
}

const todayKey = () => new Date().toISOString().split('T')[0];

const ARCollectionReceiptView: React.FC<ARCollectionReceiptViewProps> = ({
  entries,
  lines,
  payments = [],
  bankAccounts,
  students,
  sponsors,
  currency,
  brandColor = '#4f46e5',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<CollectionRow | null>(null);
  const [payerTypeFilter, setPayerTypeFilter] = useState<PayerTypeFilter>('ALL');
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [columnOrder, setColumnOrder] = useState(['receiptNo', 'payer', 'date', 'bank', 'amount']);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  const currencySymbol = currency === 'PHP' ? '₱' : currency;
  const formatCurrencyNumber = (val: number) =>
    val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCurrency = (val: number) =>
    `${currencySymbol} ${formatCurrencyNumber(val)}`;
  const renderAccountingAmount = (val: number) => (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-medium text-gray-800 tabular-nums">
      <span className="text-left">{currencySymbol}</span>
      <span className="truncate text-right">{formatCurrencyNumber(val)}</span>
    </span>
  );

  const collectionRows = useMemo<CollectionRow[]>(() => {
    const journalRows = entries
      .filter(entry => entry.sourceType === 'COLLECTION' && entry.status === 'POSTED')
      .map(entry => {
        const entryLines = lines.filter(line => line.journalEntryId === entry.id);
        const arLine = entryLines.find(line => line.contactId);
        const cashLine = entryLines.find(line => line.debit > 0);

        let payerName = 'Unknown';
        let payerType: PayerTypeFilter = 'OTHER';

        if (arLine?.contactId && arLine.contactType === 'SPONSOR') {
          payerType = 'SPONSOR';
          payerName = sponsors.find(sponsor => sponsor.id === arLine.contactId)?.name || 'Unknown Sponsor';
        } else if (arLine?.contactId && arLine.contactType === 'STUDENT') {
          payerType = 'STUDENT';
          const student = students.find(item => item.id === arLine.contactId);
          payerName = student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
        }

        const bank = bankAccounts.find(account => account.glAccountId === cashLine?.accountId);

        return {
          entry,
          payerName,
          payerType,
          bankName: bank?.bankName || 'Treasury',
          amount: cashLine?.debit || 0,
        };
      });

    const collectionEntryIds = new Set(journalRows.map(row => row.entry.id));
    const finalizedPaymentStatuses = new Set(['OPEN', 'POSTED', 'CLOSED']);
    const paymentRows = payments
      .filter(payment =>
        !payment.isDeleted &&
        finalizedPaymentStatuses.has(payment.status) &&
        (!payment.journalEntryId || !collectionEntryIds.has(payment.journalEntryId))
      )
      .map(payment => {
        let payerName = 'Unassigned Payor';
        let payerType: PayerTypeFilter = 'OTHER';

        if (payment.sponsorId) {
          payerType = 'SPONSOR';
          payerName = sponsors.find(sponsor => sponsor.id === payment.sponsorId)?.name || 'Unknown Sponsor';
        } else if (payment.studentId) {
          payerType = 'STUDENT';
          const student = students.find(item => item.id === payment.studentId);
          payerName = student ? `${student.lastName}, ${student.firstName}` : 'Unknown Student';
        }

        const journalLine = payment.journalEntryId
          ? lines.find(line => line.journalEntryId === payment.journalEntryId && line.debit > 0)
          : undefined;
        const bank = bankAccounts.find(account =>
          account.id === payment.bankAccountId ||
          account.glAccountId === journalLine?.accountId
        );
        const receiptNo = String(payment.crNo || payment.paymentNo || payment.glEntryNumber || '').trim() || payment.id;
        const description = String(payment.notes || '').trim() || `Payment ${payment.paymentNo}`;

        return {
          entry: {
            id: `payment-${payment.id}`,
            orgId: payment.orgId,
            periodId: '',
            date: payment.paymentDate,
            description,
            reference: receiptNo,
            glEntryNumber: payment.glEntryNumber,
            status: 'POSTED',
            createdBy: payment.createdBy || payment.postedBy || 'system',
            createdAt: payment.createdAt || payment.postedAt || payment.paymentDate,
            sourceType: 'PAYMENT',
            sourceRef: payment.id
          } as JournalEntry,
          payerName,
          payerType,
          bankName: bank?.bankName || 'Treasury',
          amount: Number(payment.amountReceived || 0) + Number(payment.ewtAmountCertified || 0),
        };
      });

    return [...journalRows, ...paymentRows]
      .sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());
  }, [bankAccounts, entries, lines, payments, sponsors, students]);

  const filteredCollections = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    return collectionRows.filter(row => {
      const matchesSearch =
        !normalizedTerm ||
        (row.entry.reference || '').toLowerCase().includes(normalizedTerm) ||
        (row.entry.description || '').toLowerCase().includes(normalizedTerm) ||
        row.payerName.toLowerCase().includes(normalizedTerm) ||
        row.bankName.toLowerCase().includes(normalizedTerm);

      const matchesPayerType = payerTypeFilter === 'ALL' || row.payerType === payerTypeFilter;

      const entryDate = row.entry.date;
      const dateObj = new Date(entryDate);
      let matchesDate = true;

      if (dateFilterMode === 'TODAY') {
        matchesDate = entryDate === todayKey();
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = dateObj.getFullYear() === currentYear && dateObj.getMonth() === currentMonth;
      } else if (dateFilterMode === 'CUSTOM') {
        const afterFrom = !dateFrom || entryDate >= dateFrom;
        const beforeTo = !dateTo || entryDate <= dateTo;
        matchesDate = afterFrom && beforeTo;
      }

      return matchesSearch && matchesPayerType && matchesDate;
    });
  }, [collectionRows, dateFilterMode, dateFrom, dateTo, payerTypeFilter, searchTerm]);

  const summary = useMemo(() => {
    const totalAmount = filteredCollections.reduce((sum, row) => sum + row.amount, 0);
    const todayAmount = filteredCollections
      .filter(row => row.entry.date === todayKey())
      .reduce((sum, row) => sum + row.amount, 0);
    const sponsorCount = filteredCollections.filter(row => row.payerType === 'SPONSOR').length;
    const studentCount = filteredCollections.filter(row => row.payerType === 'STUDENT').length;

    return {
      count: filteredCollections.length,
      totalAmount,
      todayAmount,
      sponsorCount,
      studentCount,
    };
  }, [filteredCollections]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedCollections,
    setCurrentPage
  } = usePaginatedRows(filteredCollections, [searchTerm, payerTypeFilter, dateFilterMode, dateFrom, dateTo]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    payerTypeFilter !== 'ALL' ||
    dateFilterMode !== 'ALL' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearchTerm('');
    setPayerTypeFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setShowPayerDropdown(false);
    setShowDateDropdown(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const payerFilterLabel =
    payerTypeFilter === 'ALL' ? 'All' : payerTypeFilter === 'SPONSOR' ? 'Sponsors' : payerTypeFilter === 'STUDENT' ? 'Students' : 'Other';

  const dateFilterLabel =
    dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...';

  const registryColumns = useMemo(() => {
    const baseColumns = [
      {
        key: 'receiptNo',
        label: 'Receipt No.',
        width: 'w-40',
        align: 'text-left' as const,
        render: (row: CollectionRow) => row.entry.reference || '-',
      },
      {
        key: 'payer',
        label: 'Sponsor/Student',
        width: 'w-64',
        align: 'text-left' as const,
        render: (row: CollectionRow) => row.payerName,
      },
      {
        key: 'date',
        label: 'Transaction Date',
        width: 'w-32',
        align: 'text-left' as const,
        render: (row: CollectionRow) => row.entry.date ? format(new Date(row.entry.date), 'MM-dd-yyyy') : '-',
      },
      {
        key: 'bank',
        label: 'Bank',
        width: 'w-44',
        align: 'text-left' as const,
        render: (row: CollectionRow) => row.bankName,
      },
      {
        key: 'amount',
        label: 'Amount',
        width: 'w-36',
        align: 'text-right' as const,
        render: (row: CollectionRow) => renderAccountingAmount(row.amount),
      },
    ];

    return columnOrder.map(key => baseColumns.find(column => column.key === key)).filter(Boolean) as typeof baseColumns;
  }, [columnOrder, currency]);

  const handleColumnDragStart = (event: React.DragEvent, index: number) => {
    setDraggedColumnIdx(index);
    event.dataTransfer.effectAllowed = 'move';
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '0.5';
    }
  };

  const handleColumnDragEnd = (event: React.DragEvent) => {
    setDraggedColumnIdx(null);
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = '1';
    }
  };

  const handleColumnDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault();
    if (draggedColumnIdx === null || draggedColumnIdx === dropIndex) return;

    const nextOrder = [...columnOrder];
    const [draggedKey] = nextOrder.splice(draggedColumnIdx, 1);
    nextOrder.splice(dropIndex, 0, draggedKey);
    setColumnOrder(nextOrder);
    setDraggedColumnIdx(null);
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Collection Receipt</h2>
        <p className="text-sm text-gray-500 font-normal italic">Review and print posted collection receipts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible Receipts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{summary.count}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Collected</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(summary.totalAmount)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Collected Today</p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(summary.todayAmount)}</p>
        </div>
        <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sponsors / Students</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {summary.sponsorCount} / {summary.studentCount}
          </p>
        </div>
      </div>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-72">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search receipts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative">
            <div
              onClick={() => setShowPayerDropdown(prev => !prev)}
              className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
            >
              <span className="text-[13px] text-gray-500 mr-1 truncate">Payer:</span>
              <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">{payerFilterLabel}</span>
              <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
            </div>

            {showPayerDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPayerDropdown(false)}></div>
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1">
                    {(['ALL', 'SPONSOR', 'STUDENT', 'OTHER'] as PayerTypeFilter[]).map(option => {
                      const label =
                        option === 'ALL' ? 'All Payers' : option === 'SPONSOR' ? 'Sponsors' : option === 'STUDENT' ? 'Students' : 'Other';

                      return (
                        <button
                          key={option}
                          onClick={() => {
                            setPayerTypeFilter(option);
                            setShowPayerDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[13px] rounded transition-colors ${
                            payerTypeFilter === option ? 'font-bold text-white' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          style={payerTypeFilter === option ? { backgroundColor: brandColor } : undefined}
                        >
                          {label}
                        </button>
                      );
                    })}
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
            <span>{filteredCollections.length} record{filteredCollections.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-emerald-600 border-b">
            <tr>
              {registryColumns.map((column, index) => (
                <th
                  key={column.key}
                  draggable
                  onDragStart={(event) => handleColumnDragStart(event, index)}
                  onDragEnd={handleColumnDragEnd}
                  onDragOver={handleColumnDragOver}
                  onDrop={(event) => handleColumnDrop(event, index)}
                  className={`px-4 py-3 ${column.align} cursor-move font-semibold text-white ${draggedColumnIdx === index ? 'bg-emerald-700 border-dashed border-2 border-emerald-300 opacity-50' : ''} group select-none transition-colors border-x border-transparent hover:bg-emerald-700 hover:border-emerald-200 relative`}
                  style={columnWidths[column.key] ? { width: columnWidths[column.key], minWidth: columnWidths[column.key] } : undefined}
                  title="Drag to reorder column"
                >
                  <div className={`flex items-center ${column.align === 'text-right' ? 'justify-end' : ''} text-[13px] font-bold text-white`}>
                    {column.label}
                  </div>
                  <div
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      const th = event.currentTarget.parentElement;
                      if (!th) return;
                      resizeRef.current = {
                        colKey: column.key,
                        startX: event.clientX,
                        startWidth: th.getBoundingClientRect().width,
                      };
                      const onMouseMove = (moveEvent: MouseEvent) => {
                        if (!resizeRef.current) return;
                        const diff = moveEvent.clientX - resizeRef.current.startX;
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
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredCollections.length > 0 ? paginatedCollections.map(row => (
              <tr
                key={row.entry.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                onClick={() => setSelected(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(row);
                  }
                }}
                title="Click to view collection receipt"
              >
                {registryColumns.map(column => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 ${column.align} cursor-pointer`}
                    style={columnWidths[column.key] ? { width: columnWidths[column.key], minWidth: columnWidths[column.key] } : undefined}
                  >
                    {column.key === 'payer' ? (
                      <span className="inline-flex items-center gap-2 font-medium text-gray-800">
                        {row.payerType === 'SPONSOR' ? (
                          <Building2 size={14} className="text-gray-400" />
                        ) : row.payerType === 'STUDENT' ? (
                          <GraduationCap size={14} className="text-gray-400" />
                        ) : (
                          <FileText size={14} className="text-gray-400" />
                        )}
                        {column.render(row)}
                      </span>
                    ) : column.key === 'bank' ? (
                      <span className="inline-flex items-center gap-2 font-medium text-gray-800">
                        <Calendar size={14} className="text-gray-400" />
                        {column.render(row)}
                      </span>
                    ) : (
                      <span className="font-medium text-gray-800">{column.render(row)}</span>
                    )}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={registryColumns.length} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  <div>No collection receipts found</div>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-3 px-5 py-2 text-white rounded text-sm font-semibold transition-all"
                      style={{ backgroundColor: brandColor }}
                    >
                      Clear Filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCollections.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="receipts"
        />
      </div>

      {selected && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 relative print:shadow-none print:border-none">
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-2 rounded hover:bg-gray-100 text-gray-400 print:hidden">
                <X size={18} />
              </button>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Official Receipt</h2>
                  <p className="text-sm text-gray-500">Collection Receipt</p>
                </div>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded print:hidden"
                  style={{ backgroundColor: brandColor }}
                >
                  <Printer size={14} /> Print
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Receipt No.</p>
                  <p className="text-sm font-bold text-gray-800">{selected.entry.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                  <p className="text-sm font-bold text-gray-800">{format(new Date(selected.entry.date), 'yyyy-MM-dd')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Received From</p>
                  <p className="text-sm font-semibold text-gray-800">{selected.payerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Bank</p>
                  <p className="text-sm font-semibold text-gray-800">{selected.bankName}</p>
                </div>
              </div>

              <div className="border rounded-md">
                <div
                  className="grid grid-cols-3 text-xs font-semibold text-white uppercase tracking-wide px-4 py-2 border-b"
                  style={{ backgroundColor: brandColor }}
                >
                  <div>Description</div>
                  <div className="text-right col-span-2">Amount</div>
                </div>
                <div className="grid grid-cols-3 px-4 py-4 text-sm text-gray-700">
                  <div className="col-span-2">{selected.entry.description}</div>
                  <div className="text-right font-mono font-semibold text-gray-900">{formatCurrency(selected.amount)}</div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Received</p>
                  <p className="text-xl font-bold" style={{ color: brandColor }}>{formatCurrency(selected.amount)}</p>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ARCollectionReceiptView;
