import React, { useState, useMemo } from 'react';
import { Vendor, ChartOfAccount, JournalEntryLine, AccountClass } from '../types';
import EmptyState from '../components/EmptyState';
import { 
  Search, Plus, Truck, Mail, Phone, Trash2, X, 
  ShieldCheck, Globe, Building, Filter, FileText, 
  Link as LinkIcon, AlertCircle, Fingerprint, MapPin
} from 'lucide-react';

interface VendorsViewProps {
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  lines: JournalEntryLine[];
  onAddVendor: (vendor: Vendor) => void;
  onUpdateVendor: (vendor: Vendor) => void;
  onDeleteVendor: (id: string) => void;
}

const VendorsView: React.FC<VendorsViewProps> = ({ 
  vendors, accounts, lines, onAddVendor, onUpdateVendor, onDeleteVendor 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    category: 'Supplies',
    tin: '',
    email: '',
    contactNumber: '',
    address: '',
    apAccountId: ''
  });

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.tin?.includes(searchTerm)
  );

  // Filter possible AP accounts from COA (Liabilities, code 21xx)
  const apAccounts = accounts.filter(a => 
    !a.isHeader && 
    a.class === AccountClass.LIABILITY && 
    (a.name.toLowerCase().includes('payable') || a.code.startsWith('21'))
  );

  // Calculate Vendor Payable Balances (Subsidiary Ledger)
  // Logic: Credit - Debit for Liabilities
  const vendorApBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    lines.forEach(line => {
      if (line.contactId && line.contactType === 'VENDOR') {
        const acc = accounts.find(a => a.id === line.accountId);
        if (!acc || acc.class !== AccountClass.LIABILITY || !acc.name.toLowerCase().includes('payable')) return;
        
        const val = line.credit - line.debit;
        balances[line.contactId] = (balances[line.contactId] || 0) + val;
      }
    });
    return balances;
  }, [lines, accounts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const newVendor: Vendor = {
      id: `ven-${Date.now()}`,
      orgId: 'temp',
      name: formData.name,
      category: formData.category || 'Other',
      tin: formData.tin,
      email: formData.email,
      contactNumber: formData.contactNumber || '',
      address: formData.address || '',
      apAccountId: formData.apAccountId || undefined,
      createdAt: new Date().toISOString()
    };

    onAddVendor(newVendor);
    setShowModal(false);
    setFormData({ category: 'Supplies', apAccountId: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Truck className="text-indigo-600" size={28} />
            Vendor Master Registry
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage procurement partners and monitor outstanding payables.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> Add New Supplier
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search suppliers by name, TIN or category..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-sm font-medium">
          <Filter size={16} /> Filter Category
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Vendor & G/L Link</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">TIN / Category</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Contact</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Unpaid Balance</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVendors.length > 0 ? filteredVendors.map(vendor => {
              const linkedAcc = accounts.find(a => a.id === vendor.apAccountId);
              const balance = vendorApBalances[vendor.id] || 0;
              
              return (
                <tr key={vendor.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm shrink-0">
                        <Building size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 leading-tight">{vendor.name}</div>
                        <div className="text-[9px] font-bold text-indigo-500 mt-1 uppercase tracking-tighter flex items-center gap-1">
                          <LinkIcon size={10} /> {linkedAcc ? `[${linkedAcc.code}] ${linkedAcc.name}` : 'No G/L Linked'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                       <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Fingerprint size={10} /> {vendor.tin || 'No TIN'}
                       </div>
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded w-fit border border-slate-200">
                         {vendor.category}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs text-slate-600 font-normal flex items-center gap-1.5 mb-1 truncate w-40"><Mail size={12} className="text-slate-400" /> {vendor.email}</div>
                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {vendor.contactNumber}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-mono font-bold ${balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-400 uppercase">Accounts Payable</div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {confirmDelete === vendor.id ? (
                      <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-1">
                         <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Cancel</button>
                         <button onClick={() => { onDeleteVendor(vendor.id); setConfirmDelete(null); }} className="px-2 py-1 text-[10px] font-semibold uppercase text-rose-600 bg-rose-50 rounded">Confirm</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(vendor.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="px-6 py-12">
                <EmptyState 
                  title="No suppliers registered"
                  description="Add your first vendor to your procurement master registry."
                  actionLabel="Add Supplier"
                  onAction={() => setShowModal(true)}
                  icon={<Truck size={48} className="text-slate-300" />}
                />
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Truck size={20} /></div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Onboard Supplier</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Business Name / Legal Entity</label>
                  <input required placeholder="e.g. Acme Office Supplies Inc." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-bold text-slate-800"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Fingerprint size={12} /> Tax ID (TIN)</label>
                    <input placeholder="000-000-000-000" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-mono font-medium"
                      value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Category</label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="Supplies">Supplies</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Services">Services</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Rent">Rent</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 text-indigo-600">
                    <LinkIcon size={12} /> Default G/L Payables Account
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-bold text-indigo-700 appearance-none"
                    value={formData.apAccountId} 
                    onChange={e => setFormData({...formData, apAccountId: e.target.value})}
                  >
                    <option value="">Select AP Account...</option>
                    {apAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Billing Email</label>
                    <input required type="email" placeholder="billing@vendor.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Contact Number</label>
                    <input placeholder="Official Phone" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} /> Business Address</label>
                  <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium resize-none"
                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   Proper TIN documentation is critical for withholding tax (EWT) reporting. Ensure the address matches the BIR Certificate of Registration (COR).
                 </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Discard</button>
                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Onboard Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorsView;