import React, { useState } from 'react';
import { Download, FilePlus2, Plus, Trash2, Upload } from 'lucide-react';
import { InventoryLevel, OpeningInventoryLine, Organization, StockItem, WarehouseLocation } from '../types';

interface Props {
  items: StockItem[];
  warehouses: WarehouseLocation[];
  organization?: Organization;
  levels?: InventoryLevel[];
  onPost: (document: { documentNumber: string; postingDate: string; remarks: string; lines: OpeningInventoryLine[] }) => Promise<void>;
}

const blankLine = (): OpeningInventoryLine => ({ warehouseLocationId: '', stockItemId: '', quantity: 0, unitCost: 0 });

export default function OpeningInventoryView({ items, warehouses, organization, levels = [], onPost }: Props) {
  const brandColor = organization?.primaryColor || '#F47721';
  const [documentNumber, setDocumentNumber] = useState(`OPEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('Beginning inventory');
  const [lines, setLines] = useState<OpeningInventoryLine[]>([blankLine()]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState('');

  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const totalValue = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);
  const activeWarehouses = warehouses.filter(warehouse => warehouse.isActive && !warehouse.isDeleted);
  const activeItems = items.filter(item => item.type === 'STOCK_ITEM' && item.isActive && !item.isDeleted);

  const updateLine = (index: number, updates: Partial<OpeningInventoryLine>) =>
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line));

  const downloadTemplate = () => {
    const csv = 'warehouse_code,item_code,quantity,unit_cost,batch_lot,expiration_date,remarks\nMAIN,ITEM-001,10,25.00,,,Beginning balance\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Opening_Inventory_Template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setError('');
    setImportSummary('');
    const rows = (await file.text()).split(/\r?\n/).filter(row => row.trim());
    const headers = (rows.shift() || '').split(',').map(value => value.trim().toLowerCase());
    const requiredHeaders = ['warehouse_code', 'item_code', 'quantity', 'unit_cost'];
    if (requiredHeaders.some(header => !headers.includes(header))) {
      setError(`CSV requires these columns: ${requiredHeaders.join(', ')}.`);
      return;
    }
    const imported: OpeningInventoryLine[] = [];
    const rowErrors: string[] = [];
    rows.forEach((row, index) => {
      const values = row.split(',').map(value => value.trim());
      const value = (header: string) => values[headers.indexOf(header)] || '';
      const warehouse = activeWarehouses.find(entry => entry.code.toLowerCase() === value('warehouse_code').toLowerCase());
      const item = activeItems.find(entry => entry.code.toLowerCase() === value('item_code').toLowerCase());
      const quantity = Number(value('quantity'));
      const unitCost = Number(value('unit_cost'));
      const errors = [
        !warehouse ? `warehouse "${value('warehouse_code')}" was not found` : '',
        !item ? `item "${value('item_code')}" was not found` : '',
        !Number.isFinite(quantity) || quantity <= 0 ? 'quantity must be greater than zero' : '',
        !Number.isFinite(unitCost) || unitCost < 0 ? 'unit cost must be zero or greater' : '',
      ].filter(Boolean);
      if (errors.length) {
        rowErrors.push(`Row ${index + 2}: ${errors.join('; ')}`);
        return;
      }
      imported.push({
        warehouseLocationId: warehouse!.id,
        stockItemId: item!.id,
        quantity,
        unitCost,
        batchLot: value('batch_lot') || undefined,
        expirationDate: value('expiration_date') || undefined,
        remarks: value('remarks') || undefined,
      });
    });
    const keys = imported.map(line => `${line.stockItemId}:${line.warehouseLocationId}`);
    if (new Set(keys).size !== keys.length) rowErrors.push('The CSV contains duplicate item and warehouse combinations.');
    if (rowErrors.length) {
      setError(rowErrors.slice(0, 8).join(' | '));
      return;
    }
    if (!imported.length) {
      setError('The CSV contains no valid Inventory lines.');
      return;
    }
    setLines(imported);
    setImportSummary(`${imported.length} valid line${imported.length === 1 ? '' : 's'} imported and ready for review.`);
  };

  const post = async () => {
    if (!documentNumber.trim() || !postingDate) {
      setError('Document number and posting date are required.');
      return;
    }
    if (!lines.length || lines.some(line => !line.stockItemId || !line.warehouseLocationId || line.quantity <= 0 || line.unitCost < 0)) {
      setError('Every line requires a warehouse, item, positive quantity, and valid unit cost.');
      return;
    }
    const lineKeys = lines.map(line => `${line.stockItemId}:${line.warehouseLocationId}`);
    if (new Set(lineKeys).size !== lineKeys.length) {
      setError('Each stock item and warehouse combination may appear only once in the document.');
      return;
    }
    const existingBalance = lines.find(line => levels.some(level =>
      !level.isDeleted
      && level.stockItemId === line.stockItemId
      && level.warehouseLocationId === line.warehouseLocationId
      && Number(level.quantityOnHand || 0) !== 0
    ));
    if (existingBalance) {
      setError('Opening Inventory cannot be posted for an item and warehouse that already has a stock balance. Use Count & Adjust instead.');
      return;
    }
    setPosting(true);
    setError('');
    try {
      await onPost({ documentNumber: documentNumber.trim(), postingDate, remarks: remarks.trim(), lines });
      setLines([blankLine()]);
      setDocumentNumber(`OPEN-${Date.now()}`);
      setImportSummary('');
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
          <p className="text-sm font-normal text-gray-500">One-time setup for beginning balances. Use Count & Adjust for routine corrections.</p>
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
            <input required readOnly value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} placeholder="Document number"/>
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
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadTemplate} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Download size={15}/> Template</button>
            <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Upload size={15}/> Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={event => { void importCsv(event.target.files?.[0]); event.target.value = ''; }}/></label>
            <button type="button" onClick={() => setLines(current => [...current, blankLine()])} className="flex items-center gap-2 rounded border px-4 py-2 text-sm font-semibold transition-colors hover:bg-brand/5" style={{ borderColor: brandColor, color: brandColor }}><Plus size={16}/> Add Line</button>
          </div>
        </div>

        <div className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Posting creates permanent Inventory ledger movements and balanced entries: debit Inventory Asset, credit Opening Balance Equity. Every line is posted together or none is posted.
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

        {importSummary && <div className="mx-6 mt-5 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importSummary}</div>}
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
