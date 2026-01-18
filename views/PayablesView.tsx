import React, { useMemo, useState } from 'react';
import { Vendor, Payable, WithholdingType } from '../types';
import { Search, Calculator, Building, Coins, AlertCircle, Calendar, Link as LinkIcon, X, Plus } from 'lucide-react';

interface PayablesViewProps {
  orgId: string;
  vendors: Vendor[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  onCreatePayable: (payable: Payable) => void;
}

const PayablesView: React.FC<PayablesViewProps> = ({ orgId, vendors, vendorTaxSettings = [], atcCategories = [], atcItems = [], atcRates = [], onCreatePayable }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [vendorId, setVendorId] = useState<string>('');
  const [grossAmount, setGrossAmount] = useState<number>(0);
  const [withholdingType, setWithholdingType] = useState<WithholdingType | undefined>(undefined);
  const [appliedRatePercent, setAppliedRatePercent] = useState<number>(0);
  const [refNo, setRefNo] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().slice(0,10));

  const vendor = useMemo(() => vendors.find(v => v.id === vendorId), [vendors, vendorId]);
  // Auto-resolve withholding type and rate from vendor tax settings
  React.useEffect(() => {
    if (!vendorId) {
      setWithholdingType(undefined);
      setAppliedRatePercent(0);
      return;
    }
    const setting = vendorTaxSettings.find((s: any) => s.vendorId === vendorId && s.isActive);
    if (!setting) {
      setWithholdingType(undefined);
      setAppliedRatePercent(0);
      return;
    }
    setWithholdingType(setting.withholdingType);
    // Resolve rate from atcRates
    let rateRow: any | undefined = undefined;
    if (setting.atcRateId) {
      rateRow = atcRates.find((r: any) => r.id === setting.atcRateId);
    } else if (setting.atcItemId && setting.withholdingType) {
      const candidates = atcRates.filter((r: any) => r.atcItemId === setting.atcItemId && r.withholdingType === setting.withholdingType);
      // Pick latest by effectiveDate
      candidates.sort((a: any, b: any) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
      rateRow = candidates[0];
    }
    setAppliedRatePercent(rateRow?.ratePercent ?? 0);
  }, [vendorId, vendorTaxSettings, atcRates]);

  const withholdingAmount = useMemo(() => Number((grossAmount * (appliedRatePercent || 0)).toFixed(2)), [grossAmount, appliedRatePercent]);
  const netPayable = useMemo(() => Number((grossAmount - withholdingAmount).toFixed(2)), [grossAmount, withholdingAmount]);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.tin?.includes(searchTerm)
  );

  const resetForm = () => {
    setVendorId('');
    setGrossAmount(0);
    setWithholdingType(undefined);
    setAppliedRatePercent(0);
    setRefNo('');
    setBillDate(new Date().toISOString().slice(0,10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !grossAmount) return;

    const payable: Payable = {
      id: `pay-${Date.now()}`,
      orgId,
      vendorId,
      refNo,
      billDate,
      grossAmount,
      withholdingType,
      appliedRatePercent,
      withholdingAmount,
      netPayable,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    onCreatePayable(payable);
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Coins className="text-indigo-600" size={28} />
            Payables & Withholding
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Create vendor bills and automatically compute withholding tax.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> New Payable
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search vendors by name or TIN..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Calculator size={20} /></div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Create Payable</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Building size={12} /> Vendor
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium appearance-none"
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                  >
                    <option value="">Select Vendor...</option>
                    {filteredVendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}{v.tin ? ` • ${v.tin}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Reference No.</label>
                    <input placeholder="BILL-2026-00001" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                      value={refNo} onChange={e => setRefNo(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> Bill Date</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                      value={billDate} onChange={e => setBillDate(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Gross Amount</label>
                    <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                      value={grossAmount} onChange={e => setGrossAmount(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5 text-emerald-600"><LinkIcon size={12}/> Withholding Type</label>
                    <select className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl outline-none text-sm"
                      value={withholdingType || ''} onChange={e => setWithholdingType((e.target.value || undefined) as WithholdingType | undefined)}>
                      <option value="">None</option>
                      <option value="EXPANDED">Expanded (2307)</option>
                      <option value="FINAL">Final (2306)</option>
                    </select>
                  </div>
                </div>

                {withholdingType && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Applied Rate (%)</label>
                      <input type="number" step="0.0001" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                        value={appliedRatePercent} onChange={e => setAppliedRatePercent(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Withholding Amount</label>
                      <input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                        value={withholdingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Net Payable</label>
                  <input readOnly className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none font-mono text-sm"
                    value={netPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   For now, select withholding type and rate manually. In the next step, we'll auto-resolve ATC & rate from the vendor's tax settings.
                 </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Post Payable</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayablesView;
