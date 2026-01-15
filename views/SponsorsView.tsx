import React, { useState, useMemo } from 'react';
import { Sponsor, ChartOfAccount, JournalEntryLine, AccountClass } from '../types';
import { 
  Search, Plus, Handshake, Mail, Phone, User, Trash2, X, 
  ShieldCheck, Globe, Building, Filter, FileText, TrendingUp,
  Link as LinkIcon, AlertCircle
} from 'lucide-react';

interface SponsorsViewProps {
  sponsors: Sponsor[];
  accounts: ChartOfAccount[];
  lines: JournalEntryLine[];
  onAddSponsor: (sponsor: Sponsor) => void;
  onUpdateSponsor: (sponsor: Sponsor) => void;
  onDeleteSponsor: (id: string) => void;
}

const SponsorsView: React.FC<SponsorsViewProps> = ({ 
  sponsors, accounts, lines, onAddSponsor, onUpdateSponsor, onDeleteSponsor 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Sponsor>>({
    name: '',
    type: 'CORPORATE',
    representative: '',
    email: '',
    contactNumber: '',
    arAccountId: '',
    isActive: true
  });

  const filteredSponsors = sponsors.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.representative?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter possible AR accounts from COA
  const arAccounts = accounts.filter(a => 
    !a.isHeader && 
    a.class === AccountClass.ASSET && 
    (a.name.toLowerCase().includes('receivable') || a.code.startsWith('12'))
  );

  // Calculate Sponsor Receivable Balances (Subsidiary Ledger)
  const sponsorArBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    lines.forEach(line => {
      if (line.contactId && line.contactType === 'SPONSOR') {
        const sponsor = sponsors.find(s => s.id === line.contactId);
        if (!sponsor) return;

        // Determine if this line belongs to a Receivable account
        const acc = accounts.find(a => a.id === line.accountId);
        if (!acc || acc.class !== AccountClass.ASSET || !acc.name.toLowerCase().includes('receivable')) return;
        
        // Dr - Cr for Assets (Receivables)
        const val = line.debit - line.credit;
        balances[line.contactId] = (balances[line.contactId] || 0) + val;
      }
    });
    return balances;
  }, [lines, accounts, sponsors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const newSponsor: Sponsor = {
      id: `spon-${Date.now()}`,
      orgId: 'temp',
      name: formData.name,
      type: formData.type as any,
      representative: formData.representative,
      email: formData.email,
      contactNumber: formData.contactNumber || '',
      arAccountId: formData.arAccountId || undefined,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    onAddSponsor(newSponsor);
    setShowModal(false);
    setFormData({ type: 'CORPORATE', isActive: true, arAccountId: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
            <Handshake className="text-indigo-600" size={28} />
            Financial Sponsors
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Manage donors, corporate grants, and subsidiary receivable mappings.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 font-medium text-sm active:scale-95"
        >
          <Plus size={18} /> New Sponsor
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search sponsors or representatives..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-sm font-medium">
          <Filter size={16} /> Filter Type
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sponsor & G/L Link</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Contact Info</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Outstanding AR</th>
              <th className="px-6 py-4 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSponsors.length > 0 ? filteredSponsors.map(sponsor => {
              const linkedAcc = accounts.find(a => a.id === sponsor.arAccountId);
              const balance = sponsorArBalances[sponsor.id] || 0;
              
              return (
                <tr key={sponsor.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                        <Building size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 leading-tight">{sponsor.name}</div>
                        <div className="text-[9px] font-bold text-indigo-500 mt-1 uppercase tracking-tighter flex items-center gap-1">
                          <LinkIcon size={10} /> {linkedAcc ? `${linkedAcc.code} - ${linkedAcc.name}` : 'No G/L Account Linked'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded border uppercase tracking-tight">
                      {sponsor.type}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs text-slate-600 font-normal flex items-center gap-1.5 mb-1"><Mail size={12} className="text-slate-400" /> {sponsor.email}</div>
                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {sponsor.contactNumber}</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-mono font-bold ${balance > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-400 uppercase">Receivable Balance</div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    {confirmDelete === sponsor.id ? (
                      <div className="flex items-center justify-end gap-2">
                         <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">Cancel</button>
                         <button onClick={() => { onDeleteSponsor(sponsor.id); setConfirmDelete(null); }} className="px-2 py-1 text-[10px] font-semibold uppercase text-rose-600 bg-rose-50 rounded">Confirm</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(sponsor.id)} className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic">No sponsors registered in the system.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md"><Handshake size={20} /></div>
                <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-tight">Onboard Sponsor</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Sponsor Name / Organization</label>
                  <input required placeholder="e.g. Phoenix Foundation" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Representative</label>
                    <input placeholder="Primary Contact Person" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.representative} onChange={e => setFormData({...formData, representative: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Sponsor Type</label>
                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                      <option value="CORPORATE">Corporate</option>
                      <option value="NGO">NGO / Foundation</option>
                      <option value="GOVERNMENT">Government Agency</option>
                      <option value="INDIVIDUAL">Individual Philanthropist</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 text-indigo-600">
                    <LinkIcon size={12} /> Default G/L Receivable Account
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-bold text-indigo-700 appearance-none"
                    value={formData.arAccountId} 
                    onChange={e => setFormData({...formData, arAccountId: e.target.value})}
                  >
                    <option value="">Select AR Account...</option>
                    {arAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 italic">This links the sponsor's subsidiary ledger to the correct Balance Sheet account.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Official Email</label>
                    <input required type="email" placeholder="finance@sponsor.org" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Contact Number</label>
                    <input placeholder="Official Trunkline" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-600 text-sm font-medium"
                      value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                 <AlertCircle className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   Linking to a specific Accounts Receivable account ensures that financial segments are isolated for different funding sources (e.g., separating Government grants from Corporate sponsorships).
                 </p>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-2xl">Discard</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold shadow-md active:scale-95 transition-all">Establish Link & Onboard</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SponsorsView;