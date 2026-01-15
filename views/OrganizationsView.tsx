
import React, { useState } from 'react';
import { Organization } from '../types';
import { Building2, Plus, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface OrganizationsViewProps {
  orgs: Organization[];
  onAddOrg: (org: Organization) => void;
  onSwitch: (id: string) => void;
  currentOrgId: string;
}

const OrganizationsView: React.FC<OrganizationsViewProps> = ({ orgs, onAddOrg, onSwitch, currentOrgId }) => {
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Fixed: Added missing required properties (subscriptionStatus, planType, createdAt) to satisfy Organization interface
    onAddOrg({
      id: `org-${Date.now()}`,
      name: newOrgName,
      currency: currency,
      isVatRegistered: false,
      subscriptionStatus: 'ACTIVE',
      planType: 'BASIC',
      createdAt: new Date().toISOString()
    });
    setNewOrgName('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
          <p className="text-sm text-slate-500">Manage all tenant accounts within your AccounTech workspace.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={18} /> Onboard New Tenant
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map(org => (
          <div 
            key={org.id} 
            className={`bg-white rounded-2xl p-6 border-2 transition-all cursor-pointer group ${org.id === currentOrgId ? 'border-indigo-600 shadow-xl shadow-indigo-50' : 'border-slate-100 hover:border-indigo-200 hover:shadow-lg shadow-slate-50'}`}
            onClick={() => onSwitch(org.id)}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-xl ${org.id === currentOrgId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                <Building2 size={24} />
              </div>
              {org.id === currentOrgId && (
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                   <CheckCircle2 size={12} /> Active
                </div>
              )}
            </div>
            
            <h3 className="text-lg font-black text-slate-900 mb-1">{org.name}</h3>
            <p className="text-xs text-slate-400 font-mono uppercase mb-4">{org.id}</p>
            
            <div className="flex items-center gap-4 border-t pt-4 border-slate-50">
               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Globe size={14} /> {org.currency}
               </div>
               <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-500" /> Compliant
               </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Onboard New Tenant</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Business Legal Name</label>
                <input 
                  autoFocus
                  required
                  placeholder="e.g. Phoenix Logistics Ltd"
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Functional Currency</label>
                <select 
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="PHP">PHP - Philippine Peso</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                </select>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                 <ShieldCheck className="text-amber-600 shrink-0" size={20} />
                 <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                   Onboarding will automatically seed a GAAP-compliant Chart of Accounts template for this organization. You can customize it later in the COA module.
                 </p>
              </div>
              <div className="flex gap-3 pt-4">
                 <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                 <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100">Initialize Ledger</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationsView;
