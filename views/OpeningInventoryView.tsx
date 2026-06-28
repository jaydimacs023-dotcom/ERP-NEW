import React, { useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
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

  const updateLine = (index: number, updates: Partial<OpeningInventoryLine>) =>
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line));

  const post = async () => {
    if (lines.some(line => !line.stockItemId || !line.warehouseLocationId || line.quantity <= 0 || line.unitCost < 0)) {
      setError('Every line requires a warehouse, item, positive quantity, and valid unit cost.');
      return;
    }
    setPosting(true);
    setError('');
    try {
      await onPost({ documentNumber, postingDate, remarks, lines });
      setLines([blankLine()]);
      setDocumentNumber(`OPEN-${Date.now()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Opening inventory posting failed');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h2 className="text-xl font-semibold text-gray-900">Opening Inventory</h2>
        <p className="text-sm text-gray-500">One-time beginning balances. Posted documents are immutable.</p>
      </header>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ backgroundColor: brandColor }}>
          <input value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} className="h-11 px-3 rounded bg-white" placeholder="Document number" />
          <input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)} className="h-11 px-3 rounded bg-white" />
          <input value={remarks} onChange={e => setRemarks(e.target.value)} className="h-11 px-3 rounded bg-white" placeholder="Remarks" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b" style={{ backgroundColor: `${brandColor}12` }}><tr><th className="p-3 text-left">Warehouse</th><th className="p-3 text-left">Item</th><th className="p-3 text-right">Quantity</th><th className="p-3 text-right">Unit Cost</th><th className="p-3 text-left">Batch / Lot</th><th className="p-3 text-left">Expiration</th><th></th></tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b">
                  <td className="p-2"><select value={line.warehouseLocationId} onChange={e => updateLine(index, { warehouseLocationId: e.target.value })} className="w-full h-10 border rounded px-2"><option value="">Select...</option>{warehouses.filter(w => w.isActive && !w.isDeleted).map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></td>
                  <td className="p-2"><select value={line.stockItemId} onChange={e => updateLine(index, { stockItemId: e.target.value })} className="w-full h-10 border rounded px-2"><option value="">Select...</option>{items.filter(i => i.type === 'STOCK_ITEM' && i.isActive && !i.isDeleted).map(i => <option key={i.id} value={i.id}>{i.code} — {i.name}</option>)}</select></td>
                  <td className="p-2"><input type="number" min="0" step="any" value={line.quantity || ''} onChange={e => updateLine(index, { quantity: Number(e.target.value) })} className="w-full h-10 border rounded px-2 text-right" /></td>
                  <td className="p-2"><input type="number" min="0" step="0.0001" value={line.unitCost || ''} onChange={e => updateLine(index, { unitCost: Number(e.target.value) })} className="w-full h-10 border rounded px-2 text-right" /></td>
                  <td className="p-2"><input value={line.batchLot || ''} onChange={e => updateLine(index, { batchLot: e.target.value })} className="w-full h-10 border rounded px-2" /></td>
                  <td className="p-2"><input type="date" value={line.expirationDate || ''} onChange={e => updateLine(index, { expirationDate: e.target.value })} className="w-full h-10 border rounded px-2" /></td>
                  <td className="p-2"><button onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="p-2 text-red-500"><Trash2 size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <p className="px-5 pt-4 text-sm text-red-600">{error}</p>}
        <div className="p-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setLines(current => [...current, blankLine()])}
            className="flex items-center gap-2 px-4 py-2 border rounded text-sm transition-colors hover:bg-gray-50"
            style={{ borderColor: brandColor, color: brandColor }}
          >
            <Plus size={16}/> Add Line
          </button>
          <button
            onClick={post}
            disabled={posting}
            className="flex items-center gap-2 px-6 py-3 text-white rounded text-xs font-semibold uppercase shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            <Upload size={16}/>{posting ? 'Posting…' : 'Post Opening Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
}
