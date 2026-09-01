import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDown, ArrowUp, Check, ChevronDown, ClipboardCheck,
  Download, History, PackageSearch, Plus, RotateCcw, Search, ShieldCheck, Undo2, X,
} from 'lucide-react';
import { ChartOfAccount, InventoryLevel, Organization, StockAdjustment, StockItem } from '../types';
import { InventoryService } from '../services/InventoryService';
import { DataExportService } from '../services/DataExportService';

interface StockAdjustmentsViewProps {
  adjustments: StockAdjustment[];
  items: StockItem[];
  levels: InventoryLevel[];
  locations: any[];
  accounts?: ChartOfAccount[];
  onAdd: (adj: Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, adj: Partial<StockAdjustment>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReverse?: (id: string, reversalDate: string, reason: string) => Promise<void>;
  initialItemId?: string;
  onInitialItemConsumed?: () => void;
  currency: string;
  isLoading?: boolean;
  currentUserId?: string;
  organization?: Organization;
}

type EventKind = 'COUNT' | 'FOUND' | 'DAMAGE' | 'LOST' | 'EXPIRED' | 'SHRINKAGE';

interface FormData {
  stockItemId: string;
  warehouseLocationId: string;
  eventKind: EventKind;
  quantity: string;
  postingDate: string;
  reason: string;
  notes: string;
}

const EVENT_OPTIONS: Array<{
  value: EventKind;
  label: string;
  description: string;
  adjustmentType: StockAdjustment['adjustmentType'];
  direction: 'COUNT' | 'IN' | 'OUT';
}> = [
  { value: 'COUNT', label: 'Count differs from system', description: 'Enter the quantity physically counted.', adjustmentType: 'PHYSICAL_COUNT', direction: 'COUNT' },
  { value: 'FOUND', label: 'Unrecorded stock found', description: 'Add stock that is present but missing from the system.', adjustmentType: 'CORRECTION', direction: 'IN' },
  { value: 'DAMAGE', label: 'Item was damaged', description: 'Remove unusable damaged stock.', adjustmentType: 'DAMAGE', direction: 'OUT' },
  { value: 'LOST', label: 'Item was lost', description: 'Remove stock that cannot be located.', adjustmentType: 'LOST', direction: 'OUT' },
  { value: 'EXPIRED', label: 'Item expired', description: 'Remove stock that can no longer be issued.', adjustmentType: 'EXPIRED', direction: 'OUT' },
  { value: 'SHRINKAGE', label: 'Other stock shortage', description: 'Remove a verified shortage for another reason.', adjustmentType: 'SHRINKAGE', direction: 'OUT' },
];

const today = () => new Date().toISOString().slice(0, 10);
const INITIAL_FORM: FormData = {
  stockItemId: '', warehouseLocationId: '', eventKind: 'COUNT', quantity: '',
  postingDate: today(), reason: '', notes: '',
};

const eventForAdjustment = (type: string): EventKind => {
  if (type === 'PHYSICAL_COUNT') return 'COUNT';
  if (type === 'CORRECTION' || type === 'ADJUSTMENT') return 'FOUND';
  if (type === 'DAMAGE' || type === 'DAMAGED') return 'DAMAGE';
  if (type === 'LOST') return 'LOST';
  if (type === 'EXPIRED') return 'EXPIRED';
  return 'SHRINKAGE';
};

export const StockAdjustmentsView: React.FC<StockAdjustmentsViewProps> = ({
  adjustments, items, levels, locations, accounts: _accounts = [], onAdd,
  onUpdate: _onUpdate, onDelete: _onDelete, onReverse, currency,
  initialItemId, onInitialItemConsumed, isLoading = false, currentUserId: _currentUserId, organization,
}) => {
  const brandColor = organization?.primaryColor || '#F47721';
  const [showForm, setShowForm] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | EventKind>('ALL');
  const [postingFilter, setPostingFilter] = useState<'ALL' | 'POSTED' | 'REVERSED'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH'>('ALL');
  const [itemQuery, setItemQuery] = useState('');
  const [warehouseQuery, setWarehouseQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reversing, setReversing] = useState<StockAdjustment | null>(null);
  const [reversalDate, setReversalDate] = useState(today());
  const [reversalReason, setReversalReason] = useState('');
  const requestIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!initialItemId) return;
    const item = items.find(value => value.id === initialItemId);
    requestIdRef.current = crypto.randomUUID();
    setFormData({ ...INITIAL_FORM, stockItemId: initialItemId, warehouseLocationId: item?.defaultWarehouseId || item?.warehouseLocationId || '' });
    setReviewing(false);
    setError(null);
    setShowForm(true);
    onInitialItemConsumed?.();
  }, [initialItemId, items, onInitialItemConsumed]);

  const stockItems = useMemo(() => items.filter(item => !item.isDeleted && item.isActive && item.type === 'STOCK_ITEM'), [items]);
  const activeLocations = useMemo(() => locations.filter(location => !location.isDeleted && location.isActive), [locations]);
  const activeAdjustments = useMemo(() => adjustments.filter(adjustment => !adjustment.isDeleted), [adjustments]);
  const selectableItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return !query ? stockItems : stockItems.filter(item => [item.code, item.name, item.barcode, item.unitOfMeasure].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [itemQuery, stockItems]);
  const selectableLocations = useMemo(() => {
    const query = warehouseQuery.trim().toLowerCase();
    return !query ? activeLocations : activeLocations.filter(location => [location.code, location.name].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [activeLocations, warehouseQuery]);

  const selectedItem = stockItems.find(item => item.id === formData.stockItemId);
  const selectedLocation = activeLocations.find(location => location.id === formData.warehouseLocationId);
  const selectedEvent = EVENT_OPTIONS.find(option => option.value === formData.eventKind) || EVENT_OPTIONS[0];
  const selectedLevel = levels.find(level => !level.isDeleted && level.stockItemId === formData.stockItemId && level.warehouseLocationId === formData.warehouseLocationId);
  const systemQuantity = Number(selectedLevel?.quantityOnHand || 0);
  const reservedQuantity = Number(selectedLevel?.quantityReserved || 0);
  const enteredQuantity = Number(formData.quantity || 0);
  const quantityChange = selectedEvent.direction === 'COUNT'
    ? InventoryService.calculateCountVariance(systemQuantity, enteredQuantity)
    : selectedEvent.direction === 'IN' ? enteredQuantity : -enteredQuantity;
  const resultingQuantity = systemQuantity + quantityChange;
  const estimatedUnitCost = Number(selectedItem?.standardCost || selectedItem?.costPrice || 0);
  const estimatedValue = Math.abs(quantityChange) * estimatedUnitCost;

  const filteredAdjustments = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return activeAdjustments.filter(adjustment => {
      const item = stockItems.find(value => value.id === adjustment.stockItemId);
      const location = activeLocations.find(value => value.id === adjustment.warehouseLocationId);
      const matchesSearch = !search || [adjustment.adjustmentNumber, item?.code, item?.name, location?.code, location?.name, adjustment.reason]
        .filter(Boolean).join(' ').toLowerCase().includes(search);
      const matchesPosting = postingFilter === 'ALL'
        || (postingFilter === 'POSTED' && Boolean(adjustment.journalEntryId) && !adjustment.reversedAt)
        || (postingFilter === 'REVERSED' && Boolean(adjustment.reversedAt));
      const recordDate = String(adjustment.postingDate || adjustment.createdAt).slice(0, 7);
      const matchesDate = dateFilter === 'ALL' || recordDate === today().slice(0, 7);
      return matchesSearch && matchesPosting && matchesDate && (typeFilter === 'ALL' || eventForAdjustment(adjustment.adjustmentType) === typeFilter);
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeAdjustments, activeLocations, dateFilter, postingFilter, searchTerm, stockItems, typeFilter]);

  const validate = () => {
    if (!formData.stockItemId) return 'Select a stock item.';
    if (!formData.warehouseLocationId) return 'Select a warehouse.';
    if (!Number.isFinite(enteredQuantity) || enteredQuantity < 0) return 'Enter a valid quantity.';
    if (selectedEvent.direction !== 'COUNT' && enteredQuantity <= 0) return 'Quantity must be greater than zero.';
    if (selectedEvent.direction === 'COUNT' && quantityChange === 0) return 'The counted quantity matches the system quantity; no adjustment is required.';
    if (quantityChange < 0 && resultingQuantity < 0) return `Only ${systemQuantity.toLocaleString()} ${selectedItem?.unitOfMeasure || 'units'} are on hand.`;
    if (!formData.postingDate) return 'Posting date is required.';
    if (!formData.reason.trim()) return 'Enter a reason for the adjustment.';
    return null;
  };

  const startAdjustment = (itemId = '', warehouseLocationId = '') => {
    requestIdRef.current = crypto.randomUUID();
    setFormData({ ...INITIAL_FORM, stockItemId: itemId, warehouseLocationId });
    setItemQuery(''); setWarehouseQuery('');
    setReviewing(false);
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!reviewing) { setReviewing(true); return; }

    setSubmitting(true);
    try {
      await onAdd({
        orgId: organization?.id || '', adjustmentNumber: '', stockItemId: formData.stockItemId,
        warehouseLocationId: formData.warehouseLocationId, adjustmentType: selectedEvent.adjustmentType,
        quantity: enteredQuantity, quantityChange, expectedQuantity: systemQuantity,
        countedQuantity: selectedEvent.direction === 'COUNT' ? enteredQuantity : undefined,
        postingDate: formData.postingDate, reason: formData.reason.trim(), notes: formData.notes.trim(),
        isApproved: true,
        requestId: requestIdRef.current,
      } as Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>);
      setSuccess('Adjustment and balanced journal entry posted successfully.');
      setShowForm(false); setReviewing(false); setFormData(INITIAL_FORM);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inventory posting failed.');
    } finally { setSubmitting(false); }
  };

  const submitReversal = async () => {
    if (!reversing || !onReverse) return;
    if (!reversalDate || !reversalReason.trim()) { setError('Reversal date and reason are required.'); return; }
    setSubmitting(true); setError(null);
    try {
      await onReverse(reversing.id, reversalDate, reversalReason.trim());
      setSuccess(`Adjustment ${reversing.adjustmentNumber} was reversed with a linked Inventory transaction.`);
      setReversing(null); setReversalReason(''); setReversalDate(today());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inventory reversal failed.');
    } finally { setSubmitting(false); }
  };

  const hasFilters = searchTerm.trim() !== '' || typeFilter !== 'ALL' || postingFilter !== 'ALL' || dateFilter !== 'ALL';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400"><ShieldCheck size={15} style={{ color: brandColor }} /> Inventory control</div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Count & Adjust</h2>
          <p className="mt-1 text-sm text-gray-500">Record what physically happened. Inventory and accounting post together.</p>
        </div>
        {!showForm && <button onClick={() => startAdjustment()} disabled={isLoading || submitting} className="inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50" style={{ backgroundColor: brandColor }}><Plus size={17} /> New count or adjustment</button>}
      </header>

      {error && <Notice tone="error" text={error} onClose={() => setError(null)} />}
      {success && <Notice tone="success" text={success} onClose={() => setSuccess(null)} />}

      {!showForm && <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Posted adjustments" value={activeAdjustments.length.toLocaleString()} icon={<History size={18} />} />
        <Metric label="Count variances" value={activeAdjustments.filter(value => value.adjustmentType === 'PHYSICAL_COUNT').length.toLocaleString()} icon={<ClipboardCheck size={18} />} />
        <Metric label="Stock increases" value={activeAdjustments.filter(value => value.quantityChange > 0).length.toLocaleString()} icon={<ArrowUp size={18} />} positive />
        <Metric label="Stock decreases" value={activeAdjustments.filter(value => value.quantityChange < 0).length.toLocaleString()} icon={<ArrowDown size={18} />} negative />
      </section>}

      {showForm && <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: brandColor }}>{reviewing ? 'Step 2 of 2 · Review' : 'Step 1 of 2 · Physical event'}</p><h3 className="mt-1 text-lg font-semibold text-gray-900">{reviewing ? 'Confirm the impact' : 'What happened to the stock?'}</h3></div>
          <button type="button" onClick={() => { setShowForm(false); setReviewing(false); }} className="rounded p-2 text-gray-400 hover:bg-white hover:text-gray-700" aria-label="Close adjustment form"><X size={19} /></button>
        </div>

        {!reviewing ? <div className="space-y-6 p-5 md:p-7">
          <fieldset><legend className="mb-3 text-sm font-semibold text-gray-800">Choose the event</legend><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {EVENT_OPTIONS.map(option => <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition ${formData.eventKind === option.value ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" className="sr-only" name="eventKind" value={option.value} checked={formData.eventKind === option.value} onChange={() => setFormData(current => ({ ...current, eventKind: option.value, quantity: '' }))} />
              <span className="text-sm font-semibold text-gray-900">{option.label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{option.description}</span>
            </label>)}
          </div></fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2"><input aria-label="Find SKU" value={itemQuery} onChange={event => setItemQuery(event.target.value)} placeholder="Find by code, name, barcode, or unit…" className="h-9 w-full rounded border border-gray-200 px-3 text-xs outline-none focus:border-brand" /><Field label="Stock item" required><select value={formData.stockItemId} onChange={event => { const itemId = event.target.value; const item = stockItems.find(value => value.id === itemId); setFormData(current => ({ ...current, stockItemId: itemId, warehouseLocationId: item?.defaultWarehouseId || item?.warehouseLocationId || current.warehouseLocationId })); }}><option value="">Select item…</option>{selectableItems.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field></div>
            <div className="space-y-2"><input aria-label="Find warehouse" value={warehouseQuery} onChange={event => setWarehouseQuery(event.target.value)} placeholder="Find warehouse by code or name…" className="h-9 w-full rounded border border-gray-200 px-3 text-xs outline-none focus:border-brand" /><Field label="Warehouse" required><select value={formData.warehouseLocationId} onChange={event => setFormData(current => ({ ...current, warehouseLocationId: event.target.value }))}><option value="">Select warehouse…</option>{selectableLocations.map(location => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select></Field></div>
          </div>

          {selectedItem && selectedLocation && <div className="grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-3"><StockFact label="On hand" value={`${systemQuantity.toLocaleString()} ${selectedItem.unitOfMeasure}`} /><StockFact label="Reserved" value={`${reservedQuantity.toLocaleString()} ${selectedItem.unitOfMeasure}`} /><StockFact label="Available" value={`${(systemQuantity - reservedQuantity).toLocaleString()} ${selectedItem.unitOfMeasure}`} /></div>}

          <div className="grid gap-5 md:grid-cols-2">
            <Field label={selectedEvent.direction === 'COUNT' ? 'Quantity physically counted' : 'Quantity affected'} required hint={selectedItem?.unitOfMeasure ? `Unit: ${selectedItem.unitOfMeasure}` : undefined}><input type="number" min="0" step="any" inputMode="decimal" value={formData.quantity} onChange={event => setFormData(current => ({ ...current, quantity: event.target.value }))} /></Field>
            <Field label="Posting date" required hint="Must fall in an open accounting period."><input type="date" value={formData.postingDate} onChange={event => setFormData(current => ({ ...current, postingDate: event.target.value }))} /></Field>
          </div>
          <Field label="Reason" required><input value={formData.reason} maxLength={240} placeholder="Briefly explain why this happened" onChange={event => setFormData(current => ({ ...current, reason: event.target.value }))} /></Field>
          <Field label="Notes" hint="Optional audit details, count sheet reference, or supervisor note."><textarea rows={3} value={formData.notes} onChange={event => setFormData(current => ({ ...current, notes: event.target.value }))} /></Field>
        </div> : <div className="space-y-6 p-5 md:p-7">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-gray-200 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Inventory impact</p><div className="mt-4 space-y-3 text-sm">
              <ReviewRow label="Event" value={selectedEvent.label} /><ReviewRow label="Item" value={`${selectedItem?.code} — ${selectedItem?.name}`} /><ReviewRow label="Warehouse" value={`${selectedLocation?.code} — ${selectedLocation?.name}`} /><ReviewRow label="Current quantity" value={`${systemQuantity.toLocaleString()} ${selectedItem?.unitOfMeasure || ''}`} />
              {selectedEvent.direction === 'COUNT' && <ReviewRow label="Counted quantity" value={`${enteredQuantity.toLocaleString()} ${selectedItem?.unitOfMeasure || ''}`} />}
              <ReviewRow label="Change" value={`${quantityChange > 0 ? '+' : ''}${quantityChange.toLocaleString()} ${selectedItem?.unitOfMeasure || ''}`} tone={quantityChange > 0 ? 'positive' : 'negative'} /><ReviewRow label="Quantity after posting" value={`${resultingQuantity.toLocaleString()} ${selectedItem?.unitOfMeasure || ''}`} strong />
            </div></section>
            <section className="rounded-xl border border-gray-200 bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Accounting preview</p><p className="mt-3 text-sm text-slate-300">The server uses the item's Inventory Class and valuation method. Users cannot override the accounts.</p><div className="mt-5 space-y-3 text-sm">
              <ReviewRow dark label="Debit" value={quantityChange > 0 ? 'Inventory Asset' : ['DAMAGE', 'LOST', 'EXPIRED'].includes(selectedEvent.adjustmentType) ? 'Write-off Expense' : 'Inventory Adjustment'} /><ReviewRow dark label="Credit" value={quantityChange > 0 ? 'Inventory Adjustment' : 'Inventory Asset'} /><ReviewRow dark label="Estimated value" value={`${currency} ${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} strong /><ReviewRow dark label="Posting date" value={formData.postingDate} />
            </div><p className="mt-5 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-400">Final cost and accounts are validated during atomic posting. A failure creates no partial stock or journal records.</p></section>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Posting is permanent. If it is wrong, use the linked <strong>Reverse</strong> action instead of editing or deleting it.</div>
        </div>}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => reviewing ? setReviewing(false) : setShowForm(false)} className="rounded border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">{reviewing ? 'Back to details' : 'Cancel'}</button><button type="submit" disabled={submitting} className="rounded px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: brandColor }}>{submitting ? 'Posting…' : reviewing ? 'Approve and post' : 'Review impact'}</button></div>
      </form>}

      {!showForm && <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4">
          <div className="relative min-w-[240px] flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search item, warehouse, reason…" className="h-10 w-full rounded border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-brand" /></div>
          <div className="relative"><select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'ALL' | EventKind)} className="h-10 appearance-none rounded border border-gray-200 bg-white pl-3 pr-9 text-sm font-medium outline-none focus:border-brand"><option value="ALL">All events</option>{EVENT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /></div>
          <div className="relative"><select aria-label="Posting status" value={postingFilter} onChange={event => setPostingFilter(event.target.value as 'ALL' | 'POSTED' | 'REVERSED')} className="h-10 appearance-none rounded border border-gray-200 bg-white pl-3 pr-9 text-sm font-medium outline-none focus:border-brand"><option value="ALL">All posting statuses</option><option value="POSTED">Posted</option><option value="REVERSED">Reversed</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /></div>
          <button type="button" onClick={() => setDateFilter(current => current === 'THIS_MONTH' ? 'ALL' : 'THIS_MONTH')} className={`h-10 rounded border px-3 text-sm font-semibold ${dateFilter === 'THIS_MONTH' ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-600'}`}>This month</button>
          <button onClick={() => { setSearchTerm(''); setTypeFilter('ALL'); setPostingFilter('ALL'); setDateFilter('ALL'); }} disabled={!hasFilters} className="rounded p-2.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Clear filters"><RotateCcw size={16} /></button>
          <button onClick={() => DataExportService.exportToCSV(filteredAdjustments.map(adjustment => { const item = stockItems.find(value => value.id === adjustment.stockItemId); const location = activeLocations.find(value => value.id === adjustment.warehouseLocationId); return { Number: adjustment.adjustmentNumber, Date: adjustment.postingDate || adjustment.createdAt, ItemCode: item?.code || '', Item: item?.name || '', Warehouse: location?.name || '', Type: adjustment.adjustmentType, QuantityChange: adjustment.quantityChange, Reason: adjustment.reason, JournalEntry: adjustment.journalEntryId || '' }; }), `Inventory_Adjustments_${today()}.csv`)} disabled={!filteredAdjustments.length} className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Download size={15} /> Export</button>
        </div>
        {isLoading ? <div className="p-12 text-center text-sm text-gray-500">Loading Inventory adjustments…</div> : filteredAdjustments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 text-left">Reference</th><th className="px-4 py-3 text-left">Item and warehouse</th><th className="px-4 py-3 text-left">Event</th><th className="px-4 py-3 text-right">Change</th><th className="px-4 py-3 text-left">Reason</th><th className="px-4 py-3 text-left">Accounting</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-gray-100">
          {filteredAdjustments.map(adjustment => { const item = stockItems.find(value => value.id === adjustment.stockItemId); const location = activeLocations.find(value => value.id === adjustment.warehouseLocationId); return <tr key={adjustment.id} className="align-top hover:bg-gray-50">
            <td className="px-4 py-3"><p className="font-mono text-xs font-semibold text-gray-800">{adjustment.adjustmentNumber}</p><p className="mt-1 text-xs text-gray-500">{new Date(adjustment.postingDate || adjustment.createdAt).toLocaleDateString()}</p></td>
            <td className="px-4 py-3"><p className="font-semibold text-gray-900">{item?.code} · {item?.name}</p><p className="mt-1 text-xs text-gray-500">{location?.code} — {location?.name}</p></td>
            <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{EVENT_OPTIONS.find(value => value.value === eventForAdjustment(adjustment.adjustmentType))?.label}</span></td>
            <td className={`px-4 py-3 text-right font-mono font-semibold ${adjustment.quantityChange > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{adjustment.quantityChange > 0 ? '+' : ''}{Number(adjustment.quantityChange).toLocaleString()} {item?.unitOfMeasure}</td>
            <td className="max-w-[260px] px-4 py-3 text-gray-600">{adjustment.reason}</td>
            <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${adjustment.journalEntryId ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{adjustment.journalEntryId ? <Check size={12} /> : <AlertCircle size={12} />}{adjustment.journalEntryId ? 'Posted with journal' : 'Posting incomplete'}</span></td>
            <td className="px-4 py-3 text-right">{adjustment.reversedAt ? <span className="text-xs font-semibold text-gray-400">Reversed</span> : adjustment.journalEntryId && onReverse ? <button onClick={() => { setReversing(adjustment); setError(null); }} className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><Undo2 size={14} /> Reverse</button> : null}</td>
          </tr>; })}
        </tbody></table></div> : <div className="p-14 text-center"><PackageSearch className="mx-auto text-gray-300" size={38} /><p className="mt-3 font-semibold text-gray-700">No adjustments found</p><p className="mt-1 text-sm text-gray-500">{hasFilters ? 'Clear the filters to see more records.' : 'Start with a physical count or stock event.'}</p></div>}
      </section>}

      {reversing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="reverse-title" className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">Linked correction</p><h3 id="reverse-title" className="mt-1 text-xl font-semibold text-gray-900">Reverse {reversing.adjustmentNumber}</h3><p className="mt-2 text-sm leading-6 text-gray-500">The original remains unchanged. The system creates an opposite Inventory movement and balanced journal entry using the original cost.</p></div>
        <div className="space-y-5 p-6"><Field label="Reversal date" required hint="Must fall in an open accounting period."><input type="date" value={reversalDate} onChange={event => setReversalDate(event.target.value)} /></Field><Field label="Reason for reversal" required><textarea rows={3} value={reversalReason} maxLength={240} placeholder="Explain why the original posting must be reversed" onChange={event => setReversalReason(event.target.value)} /></Field></div>
        <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4"><button onClick={() => setReversing(null)} disabled={submitting} className="rounded border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button><button onClick={submitReversal} disabled={submitting} className="rounded bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Reversing…' : 'Confirm reversal'}</button></div>
      </section></div>}
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactElement }> = ({ label, required, hint, children }) => <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}{required ? ' *' : ''}</span>{React.cloneElement(children, { className: 'min-h-11 w-full rounded border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10' })}{hint && <span className="block text-xs text-gray-500">{hint}</span>}</label>;
const StockFact: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="bg-gray-50 px-4 py-3"><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-gray-900">{value}</p></div>;
const ReviewRow: React.FC<{ label: string; value: string; tone?: 'positive' | 'negative'; strong?: boolean; dark?: boolean }> = ({ label, value, tone, strong, dark }) => <div className={`flex items-start justify-between gap-5 border-b pb-3 last:border-0 last:pb-0 ${dark ? 'border-slate-800' : 'border-gray-100'}`}><span className={dark ? 'text-slate-400' : 'text-gray-500'}>{label}</span><span className={`text-right ${strong ? 'font-semibold' : 'font-medium'} ${tone === 'positive' ? 'text-emerald-600' : tone === 'negative' ? 'text-rose-600' : dark ? 'text-white' : 'text-gray-900'}`}>{value}</span></div>;
const Metric: React.FC<{ label: string; value: string; icon: React.ReactNode; positive?: boolean; negative?: boolean }> = ({ label, value, icon, positive, negative }) => <div className="rounded-lg border border-gray-200 bg-white p-4"><div className={`flex items-center justify-between ${positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-gray-400'}`}>{icon}<span className="text-2xl font-semibold text-gray-900">{value}</span></div><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p></div>;
const Notice: React.FC<{ tone: 'error' | 'success'; text: string; onClose: () => void }> = ({ tone, text, onClose }) => <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><div className="flex items-center gap-2">{tone === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}<span className="font-medium">{text}</span></div><button onClick={onClose} className="rounded p-1 hover:bg-white/60" aria-label="Dismiss message"><X size={15} /></button></div>;

export default StockAdjustmentsView;
