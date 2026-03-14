
import React, { useState } from 'react';
import { Organization } from '../types';
import { Building2, Plus, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Institutional Management</h2>
          <p className="text-sm font-normal italic text-gray-500">Manage all tenant accounts within your AccounTech workspace.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#F47721] text-white px-6 py-2.5 rounded font-bold shadow-lg shadow-gray-100 flex items-center gap-2 hover:bg-[#E06610] transition-all active:scale-95"
        >
          <Plus size={18} /> Onboard New Tenant
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map(org => (
          <div 
            key={org.id} 
            className={`bg-white rounded p-6 border-2 transition-all cursor-pointer group ${org.id === currentOrgId ? 'border-orange-500 shadow-sm shadow-gray-50' : 'border-gray-100 hover:border-orange-200 hover:shadow-lg shadow-gray-50'}`}
            onClick={() => onSwitch(org.id)}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded ${org.id === currentOrgId ? 'bg-[#F47721] text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-orange-50 group-hover:text-[#F47721]'} transition-colors`}>
                <Building2 size={24} />
              </div>
              {org.id === currentOrgId && (
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[#F47721] bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                   <CheckCircle2 size={12} /> Active
                </div>
              )}
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{org.name}</h3>
            <p className="text-xs text-gray-400 font-mono uppercase mb-4">{org.id}</p>
            
            <div className="flex items-center gap-4 border-t pt-4 border-gray-50">
               <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <Globe size={14} /> {org.currency}
               </div>
               <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <ShieldCheck size={14} className="text-emerald-500" /> Compliant
               </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded shadow-md w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">Onboard New Tenant</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Business Legal Name</label>
                <input 
                  autoFocus
                  required
                  placeholder="e.g. Phoenix Logistics Ltd"
                  className="w-full px-4 py-3 border rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Functional Currency</label>
                <select 
                  className="w-full px-4 py-3 border rounded focus:ring-2 focus:ring-orange-500 outline-none transition-all"
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
              <div className="bg-amber-50 p-4 rounded border border-amber-100 flex gap-3">
                 <ShieldCheck className="text-amber-600 shrink-0" size={20} />
                 <p className="text-xs text-amber-800 leading-relaxed font-medium">
                   Onboarding will automatically seed a GAAP-compliant Chart of Accounts template for this organization. You can customize it later in the COA module.
                 </p>
              </div>
              <div className="flex gap-3 pt-4">
                 <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                 <button type="submit" className="flex-1 py-3 bg-[#F47721] text-white rounded text-sm font-bold shadow-lg shadow-gray-100">Initialize Ledger</button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default OrganizationsView;

