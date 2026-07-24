import React, { useState } from 'react';
import { FilePlus2, Plus, Trash2, Upload } from 'lucide-react';
import { OpeningInventoryLine, Organization, StockItem, WarehouseLocation } from '../types';

interface Props {
  items: StockItem[];
  warehouses: WarehouseLocation[];
  organization?: Organization;
  onPost: (document: { documentNumber: string; postingDate: string; remarks: string; lines: OpeningInventoryLine[] }) => Promise<void>;
}

const blankLine = (): OpeningInventoryLine => ({ warehouseLocationId: '', stockItemId: '', quantity: 0, unitCost: 0 });

export default function OpeningInventoryView({ items, warehouses, organization, onPost }: Props) {
  const brandColor = organization?.primaryColor || '#F47721';
  const [documentNumber, setDocumentNumber] = useState(`OPEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('Beginning inventory');
  const [lines, setLines] = useState<OpeningInventoryLine[]>([blankLine()]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const totalValue = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);
  const activeWarehouses = warehouses.filter(warehouse => warehouse.isActive && !warehouse.isDeleted);
  const activeItems = items.filter(item => item.type === 'STOCK_ITEM' && item.isActive && !item.isDeleted);

  const updateLine = (index: number, updates: Partial<OpeningInventoryLine>) =>
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line));

  const post = async () => {
    if (!documentNumber.trim() || !postingDate) {
      setError('Document number and posting date are required.');
      return;
    }
    if (!lines.length || lines.some(line => !line.stockItemId || !line.warehouseLocationId || line.quantity <= 0 || line.unitCost < 0)) {
      setError('Every line requires a warehouse, item, positive quantity, and valid unit cost.');
      return;
    }
    setPosting(true);
    setError('');
    try {
      await onPost({ documentNumber: documentNumber.trim(), postingDate, remarks: remarks.trim(), lines });
      setLines([blankLine()]);
      setDocumentNumber(`OPEN-${Date.now()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Opening inventory posting failed');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-800">Opening Inventory</h2>
          <p className="text-sm font-normal text-gray-500">Record one-time beginning stock balances before regular inventory transactions.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Document status</p>
          <p className="text-sm font-semibold text-gray-700">Unposted draft</p>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded text-white" style={{ backgroundColor: brandColor }}>
            <FilePlus2 size={19}/>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">Opening Balance Document</h3>
            <p className="text-xs text-gray-500">Complete the document details and add each item’s beginning quantity.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 border-b border-gray-200 p-6 md:grid-cols-3">
          <FormField label="Document Number *">
            <input required value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} placeholder="Document number"/>
          </FormField>
          <FormField label="Posting Date *">
            <input required type="date" value={postingDate} onChange={event => setPostingDate(event.target.value)}/>
          </FormField>
          <FormField label="Remarks">
            <input value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Optional remarks"/>
          </FormField>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Inventory Lines</p>
            <p className="mt-0.5 text-xs text-gray-500">Warehouse, stock item, and quantity are required for every line.</p>
          </div>
          <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold transition-colors hover:bg-brand/5" style={{ borderColor: brandColor, color: brandColor }}>
            <Plus size={16}/> Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-white" style={{ backgroundColor: brandColor }}>
              <tr>
                <th className="p-4 text-left">Warehouse</th><th className="p-4 text-left">Stock Item</th>
                <th className="p-4 text-right">Quantity</th><th className="p-4 text-right">Unit Cost</th>
                <th className="p-4 text-left">Batch / Lot</th><th className="p-4 text-left">Expiration</th>
                <th className="w-14" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-gray-100 transition-colors hover:bg-brand/5">
                  <td className="p-3"><select value={line.warehouseLocationId} onChange={event => updateLine(index, { warehouseLocationId: event.target.value })} className="h-10 w-full rounded border border-gray-200 bg-white px-3 outline-none focus:border-brand"><option value="">Select warehouse...</option>{activeWarehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name}</option>)}</select></td>
                  <td className="p-3"><select value={line.stockItemId} onChange={event => updateLine(index, { stockItemId: event.target.value })} className="h-10 w-full rounded border border-gray-200 bg-white px-3 outline-none focus:border-brand"><option value="">Select stock item...</option>{activeItems.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></td>
                  <td className="p-3"><input type="number" min="0" step="any" value={line.quantity || ''} onChange={event => updateLine(index, { quantity: Number(event.target.value) })} className="h-10 w-full rounded border border-gray-200 px-3 text-right font-mono outline-none focus:border-brand"/></td>
                  <td className="p-3"><input type="number" min="0" step="0.0001" value={line.unitCost || ''} onChange={event => updateLine(index, { unitCost: Number(event.target.value) })} className="h-10 w-full rounded border border-gray-200 px-3 text-right font-mono outline-none focus:border-brand"/></td>
                  <td className="p-3"><input value={line.batchLot || ''} onChange={event => updateLine(index, { batchLot: event.target.value })} placeholder="Optional" className="h-10 w-full rounded border border-gray-200 px-3 outline-none focus:border-brand"/></td>
                  <td className="p-3"><input type="date" value={line.expirationDate || ''} onChange={event => updateLine(index, { expirationDate: event.target.value })} className="h-10 w-full rounded border border-gray-200 px-3 outline-none focus:border-brand"/></td>
                  <td className="p-3 text-center"><button type="button" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove line ${index + 1}`} className="rounded p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <div className="mx-6 mt-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-8 text-sm">
            <Summary label="Total Quantity" value={totalQuantity.toLocaleString()}/>
            <Summary label="Opening Value" value={`${organization?.currency || ''} ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} brand/>
          </div>
          <button type="button" onClick={post} disabled={posting} className="flex items-center justify-center gap-2 rounded px-6 py-3 text-xs font-semibold uppercase text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: brandColor }}>
            <Upload size={16}/>{posting ? 'Posting…' : 'Post Opening Inventory'}
          </button>
        </div>
      </section>
    </div>
  );
}

const FormField: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
  <label className="space-y-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    {React.cloneElement(children, { className: 'h-11 w-full rounded border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand' })}
  </label>
);

const Summary: React.FC<{ label: string; value: string; brand?: boolean }> = ({ label, value, brand }) => (
  <div><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className={`mt-1 font-mono font-semibold ${brand ? 'text-brand' : 'text-gray-800'}`}>{value}</p></div>
);
