
import React, { useState, useMemo } from 'react';
import ModalPortal from '../components/ModalPortal';
import { 
  Terminal, Building2, Plus, Globe, ShieldCheck, 
  CheckCircle2, AlertCircle, Calendar, CreditCard, 
  Trash2, X, Play, Pause, MoreVertical, Search,
  Activity, Users, DollarSign, Layers, Info, Check, Lock,
  ShieldAlert, Hash
} from 'lucide-react';
import { Organization, SubscriptionStatus, PlanType } from '../types';
import { generateUUID } from '../utils/uuid';

interface TenantManagementViewProps {
  organizations: Organization[];
  onAddTenant: (org: Organization) => void;
  onUpdateTenant: (id: string, updates: Partial<Organization>) => void;
}

const TenantManagementView: React.FC<TenantManagementViewProps> = ({ organizations, onAddTenant, onUpdateTenant }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Provisioning Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [plan, setPlan] = useState<PlanType>('BASIC');

  const filteredOrgs = organizations.filter(o => 
    o.id !== 'org-system' && 
    (o.name.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm))
  );

  const stats = useMemo(() => {
    const active = organizations.filter(o => o.subscriptionStatus === 'ACTIVE').length;
    const basicCount = organizations.filter(o => o.planType === 'BASIC').length;
    const profCount = organizations.filter(o => o.planType === 'PROFESSIONAL').length;
    const entCount = organizations.filter(o => o.planType === 'ENTERPRISE').length;
    
    // New Pricing logic: 49, 149, 499
    const mrr = (basicCount * 49) + (profCount * 149) + (entCount * 499);

    return { active, mrr, total: organizations.length - 1 };
  }, [organizations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTenant({
      id: generateUUID(),
      name: newOrgName,
      currency: currency,
      isVatRegistered: true,
      subscriptionStatus: 'ACTIVE',
      planType: plan,
      createdAt: new Date().toISOString()
    });
    setNewOrgName('');
    setShowModal(false);
  };

  const toggleStatus = (org: Organization) => {
    if (org.subscriptionStatus === 'ACTIVE') {
      onUpdateTenant(org.id, { subscriptionStatus: 'SUSPENDED' });
    } else if (org.subscriptionStatus === 'SUSPENDED') {
      onUpdateTenant(org.id, { subscriptionStatus: 'ACTIVE' });
    }
  };

  const handleVerifyPayment = (org: Organization) => {
    if (org.pendingPlanType) {
      onUpdateTenant(org.id, {
        planType: org.pendingPlanType,
        subscriptionStatus: 'ACTIVE',
        pendingPlanType: undefined,
        paymentReference: undefined
      });
    }
  };

  const getStatusColor = (status: SubscriptionStatus) => {
    switch (status) {
      case 'ACTIVE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'SUSPENDED': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'TRIAL': return 'text-orange-500 bg-[#F47721]/10 border-orange-400/20';
      case 'EXPIRED': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'PENDING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20 animate-pulse';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-600 text-white rounded-lg shadow-lg">
              <Terminal size={24} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Provisioning & Subscriptions</h1>
          </div>
          <p className="text-gray-500 font-medium italic">Developer Operations Console: Multi-Tenant Lifecycle Management</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-8 py-3 bg-gray-800 text-white rounded text-sm font-semibold uppercase tracking-wide hover:bg-gray-700 transition-all shadow-md active:scale-95"
        >
          <Plus size={18} /> Provision New Tenant
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard label="Active Instances" value={stats.active.toString()} icon={<Activity size={20} />} color="emerald" />
        <StatsCard label="Platform Tenants" value={stats.total.toString()} icon={<Layers size={20} />} color="orange" />
        <StatsCard label="Live Sessions" value="14" icon={<Users size={20} />} color="orange" />
        <StatsCard label="Est. Platform MRR" value={`$${stats.mrr}`} icon={<DollarSign size={20} />} color="rose" />
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
         <div className="p-8 border-b bg-gray-50 flex items-center gap-3">
            <Info size={20} className="text-[#F47721]" />
            <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Internal Service Matrix (Admin)</h3>
         </div>
         <div className="grid grid-cols-3 divide-x divide-gray-100">
            <PlanInfo 
              tier="BASIC" 
              price="$49/mo" 
              desc="Standard Bookkeeping" 
              features={["General Ledger", "Standard COA", "Core Reports", "Manual Posting"]} 
              locked={["Ops Modules", "Subsidiaries", "Payroll", "Fixed Assets"]}
            />
            <PlanInfo 
              tier="PROFESSIONAL" 
              price="$149/mo" 
              desc="Operational Heart" 
              features={["Registries", "8-Hour Batch Forecast", "AR/AP Subs", "Banking & OR", "Portals"]} 
              locked={["PO Workflow", "Asset Depreciation", "Audit Deltas", "Forensic Logs"]}
            />
            <PlanInfo 
              tier="ENTERPRISE" 
              price="$499/mo" 
              desc="Strategic Oversight" 
              features={["PO Approval Cycles", "Asset Depr. Engine", "Full Payroll", "Forensic Audit", "RBAC Matrix"]} 
              locked={[]}
            />
         </div>
      </div>

      <div className="bg-gray-900 rounded-md shadow-md border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-800/50">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                placeholder="Filter Tenant Ledger..." 
                className="w-full pl-12 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <table className="min-w-full text-left">
           <thead className="bg-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-700">
             <tr>
               <th className="px-8 py-5">Tenant Organization</th>
               <th className="px-8 py-5">Subscription Plan</th>
               <th className="px-8 py-5">Status</th>
               <th className="px-8 py-5 text-right">Dev Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-700">
             {filteredOrgs.map(org => (
               <tr key={org.id} className="hover:bg-gray-800/50 transition-colors group">
                 <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-rose-500 transition-colors border border-gray-600 shadow-sm">
                          <Building2 size={24} />
                       </div>
                       <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-200 group-hover:text-white">{org.name}</div>
                          <div className="text-xs font-mono font-bold text-gray-500 mt-1 tracking-tighter uppercase flex items-center gap-2 group-hover:text-gray-400 transition-colors">
                            {org.id}
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(org.id);
                                alert('Organization UUID copied!');
                              }}
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold text-amber-400 transition-colors"
                              title="Copy UUID"
                            >
                              COPY
                            </button>
                          </div>
                       </div>
                    </div>
                 </td>
                 <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CreditCard size={14} className="text-gray-500" />
                            <span className={`text-xs font-semibold uppercase tracking-wide ${org.planType === 'ENTERPRISE' ? 'text-rose-500' : org.planType === 'PROFESSIONAL' ? 'text-orange-500' : 'text-orange-500'}`}>
                                {org.planType} Tier
                            </span>
                        </div>
                        {org.subscriptionStatus === 'PENDING' && (
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase animate-pulse">
                                <ShieldAlert size={10} /> Verify Upgrade: {org.pendingPlanType}
                            </div>
                        )}
                    </div>
                 </td>
                 <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide ${getStatusColor(org.subscriptionStatus)}`}>
                       <CheckCircle2 size={12} /> {org.subscriptionStatus}
                    </span>
                 </td>
                 <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       {org.subscriptionStatus === 'PENDING' && (
                          <button 
                            onClick={() => handleVerifyPayment(org)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold uppercase tracking-wide shadow-sm shadow-amber-900/40 hover:bg-amber-500 transition-all"
                          >
                             <Hash size={12} /> Confirm {org.paymentReference}
                          </button>
                       )}
                       <button 
                        onClick={() => toggleStatus(org)}
                        className={`p-2 rounded border border-gray-600 transition-all ${org.subscriptionStatus === 'ACTIVE' ? 'text-rose-500 hover:border-rose-400' : org.subscriptionStatus === 'SUSPENDED' ? 'text-emerald-500 hover:border-emerald-400' : 'text-gray-400 cursor-not-allowed border-gray-500/70'}`}
                        disabled={org.subscriptionStatus !== 'ACTIVE' && org.subscriptionStatus !== 'SUSPENDED'}
                        title={org.subscriptionStatus === 'ACTIVE' ? 'Suspend tenant' : org.subscriptionStatus === 'SUSPENDED' ? 'Reactivate tenant' : 'Status cannot be toggled by this action'}
                       >
                          {org.subscriptionStatus === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                       </button>
                       <button className="p-2 rounded border border-gray-600 hover:border-gray-500 text-gray-400 transition-all">
                          <MoreVertical size={16} />
                       </button>
                    </div>
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-xl overflow-hidden animate-in zoom-in duration-300 border border-gray-200">
             <div className="p-8 border-b flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-gray-800 text-white rounded shadow-sm"><Building2 size={24} /></div>
                   <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Direct Provisioning</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={28} /></button>
             </div>

             <form onSubmit={handleSubmit} className="p-5 space-y-8">
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Institutional Title</label>
                      <input 
                        required autoFocus placeholder="e.g. Philippine Skills Center"
                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-rose-500 font-bold text-gray-800"
                        value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">G/L Currency</label>
                         <select className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-md outline-none font-bold text-gray-800 appearance-none"
                           value={currency} onChange={e => setCurrency(e.target.value)}>
                            <option value="PHP">PHP</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">License Tier</label>
                         <select className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-md outline-none font-bold text-gray-800 appearance-none"
                           value={plan} onChange={e => setPlan(e.target.value as PlanType)}>
                            <option value="BASIC">Basic</option>
                            <option value="PROFESSIONAL">Professional</option>
                            <option value="ENTERPRISE">Enterprise</option>
                         </select>
                      </div>
                   </div>
                </div>

                <div className="bg-amber-50 p-6 rounded border border-amber-100 flex gap-4">
                   <AlertCircle size={24} className="text-amber-600 shrink-0" />
                   <p className="text-xs text-amber-900 leading-relaxed font-bold">
                     Manual provisioning bypasses the payment gateway. Use only for internal institutional testing or direct-billed Enterprise clients.
                   </p>
                </div>

                <div className="pt-4 flex gap-4">
                   <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded">Discard</button>
                   <button type="submit" className="flex-1 py-4 bg-gray-800 text-white rounded-md text-sm font-semibold shadow-md active:scale-95 transition-all">Launch Environment</button>
                </div>
             </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

const PlanInfo: React.FC<{ tier: string, price: string, desc: string, features: string[], locked: string[] }> = ({ tier, price, desc, features, locked }) => (
  <div className="p-8">
     <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{tier}</p>
     <div className="flex items-baseline gap-2 mb-2">
        <span className="text-lg font-semibold text-gray-900 tracking-tight">{price}</span>
     </div>
     <p className="text-xs text-[#F47721] font-bold italic mb-6">{desc}</p>
     <div className="space-y-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
             <div className="w-4 h-4 rounded-full bg-emerald-50 text-[#F47721] flex items-center justify-center shrink-0">
                <Check size={10} strokeWidth={4} />
             </div>
             <span className="text-xs font-medium text-gray-600">{f}</span>
          </div>
        ))}
        {locked.map((f, i) => (
          <div key={i} className="flex items-center gap-2 opacity-50">
             <div className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                <Lock size={10} strokeWidth={4} />
             </div>
             <span className="text-xs font-medium text-gray-400 line-through decoration-gray-300">{f}</span>
          </div>
        ))}
     </div>
  </div>
);

const StatsCard: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded border border-gray-200 shadow-sm flex items-center gap-5">
    <div className={`w-14 h-14 rounded flex items-center justify-center border shrink-0 shadow-sm transition-all ${
      color === 'emerald' ? 'bg-emerald-50 text-[#F47721] border-emerald-100' :
      color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' :
      'bg-orange-50 text-[#F47721] border-orange-100'
    }`}>
       {icon}
    </div>
    <div>
       <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
       <p className="text-lg font-semibold text-gray-900 tracking-tight">{value}</p>
    </div>
  </div>
);

export default TenantManagementView;

