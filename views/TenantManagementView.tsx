
import React, { useState, useMemo } from 'react';
import ModalPortal from '../components/ModalPortal';
import { 
  Building2, Plus,
  AlertCircle, CreditCard,
  X, Play, Pause, Search,
  Check, Lock,
  ShieldAlert, Hash
} from 'lucide-react';
import { Organization, SubscriptionStatus, PlanType, InstitutionType } from '../types';
import { generateUUID } from '../utils/uuid';

interface TenantManagementViewProps {
  organizations: Organization[];
  onAddTenant: (org: Organization) => void;
  onUpdateTenant: (id: string, updates: Partial<Organization>) => void;
}

const TenantManagementView: React.FC<TenantManagementViewProps> = ({ organizations, onAddTenant, onUpdateTenant }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editedPlan, setEditedPlan] = useState<PlanType>('BASIC');

  // Provisioning Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [plan, setPlan] = useState<PlanType>('BASIC');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('TRAINING');

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
      institutionType,
      isVatRegistered: true,
      subscriptionStatus: 'ACTIVE',
      planType: plan,
      createdAt: new Date().toISOString()
    });
    setNewOrgName('');
    setInstitutionType('TRAINING');
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

  const openEditPlan = (org: Organization) => {
    setEditingOrgId(org.id);
    setEditedPlan(org.planType);
  };

  const saveEditedPlan = () => {
    if (!editingOrgId) return;
    onUpdateTenant(editingOrgId, { planType: editedPlan });
    setEditingOrgId(null);
  };

  const closeEditPlan = () => {
    setEditingOrgId(null);
  };

  const getStatusColor = (status: SubscriptionStatus) => {
    switch (status) {
      case 'ACTIVE': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'SUSPENDED': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'TRIAL': return 'text-slate-700 bg-slate-50 border-slate-200';
      case 'EXPIRED': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'PENDING': return 'text-amber-700 bg-amber-50 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Tenant Management</h1>
          <p className="mt-1 text-sm text-slate-500">Provision tenants, manage plans, and monitor subscription status.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={16} /> New Tenant
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatsCard label="Active" value={stats.active.toString()} />
        <StatsCard label="Tenants" value={stats.total.toString()} />
        <StatsCard label="Live Sessions" value="14" />
        <StatsCard label="Estimated MRR" value={`$${stats.mrr}`} />
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
         <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Plan Matrix</h3>
         </div>
         <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
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

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                placeholder="Search tenants..."
                className="w-full rounded-md border border-slate-200 py-2 pl-10 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <table className="min-w-full text-left">
           <thead className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
             <tr>
               <th className="px-5 py-3">Tenant</th>
               <th className="px-5 py-3">Plan</th>
               <th className="px-5 py-3">Status</th>
               <th className="px-5 py-3 text-right">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {filteredOrgs.map(org => (
               <tr key={org.id} className="group transition-colors hover:bg-slate-50">
                 <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                       <div
                          className="h-9 w-9 rounded-md border"
                          style={{
                            backgroundColor: org.primaryColor ? `${org.primaryColor}20` : '#f59e0b33',
                            borderColor: org.primaryColor || '#f59e0b'
                          }}
                        />
                       <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">{org.name}</div>
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-slate-400">
                            {org.id}
                            <button 
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(org.id);
                                alert('Organization UUID copied!');
                              }}
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                              title="Copy UUID"
                            >
                              COPY
                            </button>
                          </div>
                       </div>
                    </div>
                 </td>
                 <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <CreditCard size={14} className="text-slate-400" />
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-700">
                                {org.planType}
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">{org.institutionType || 'TRAINING'}</span>
                        {org.subscriptionStatus === 'PENDING' && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                <ShieldAlert size={10} /> Verify Upgrade: {org.pendingPlanType}
                            </div>
                        )}
                    </div>
                 </td>
                 <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusColor(org.subscriptionStatus)}`}>
                       {org.subscriptionStatus}
                    </span>
                 </td>
                 <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                       {org.subscriptionStatus === 'PENDING' && (
                          <button 
                            onClick={() => handleVerifyPayment(org)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
                          >
                             <Hash size={12} /> Confirm {org.paymentReference}
                          </button>
                       )}
                       <button 
                        onClick={() => toggleStatus(org)}
                        className={`rounded-md border p-2 transition-colors ${org.subscriptionStatus === 'ACTIVE' ? 'border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700' : org.subscriptionStatus === 'SUSPENDED' ? 'border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700' : 'cursor-not-allowed border-slate-200 text-slate-300'}`}
                        disabled={org.subscriptionStatus !== 'ACTIVE' && org.subscriptionStatus !== 'SUSPENDED'}
                        title={org.subscriptionStatus === 'ACTIVE' ? 'Suspend tenant' : org.subscriptionStatus === 'SUSPENDED' ? 'Reactivate tenant' : 'Status cannot be toggled by this action'}
                       >
                          {org.subscriptionStatus === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                       </button>
                       <button
                         onClick={() => openEditPlan(org)}
                         className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                         title="Edit subscription plan"
                       >
                         <CreditCard size={12} />
                         Edit Plan
                       </button>
                    </div>
                 </td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>

      {editingOrgId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4">
            <div className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Edit Plan</p>
                  <p className="text-xs text-slate-500">Update the tenant subscription tier.</p>
                </div>
                <button onClick={closeEditPlan} className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X size={18} /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                    value={editedPlan}
                    onChange={(e) => setEditedPlan(e.target.value as PlanType)}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
                <button onClick={closeEditPlan} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={saveEditedPlan} className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Save</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/35 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
             <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div className="flex items-center gap-3">
                   <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600"><Building2 size={18} /></div>
                   <h3 className="text-base font-semibold text-slate-900">New Tenant</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X size={18} /></button>
             </div>

             <form onSubmit={handleSubmit} className="space-y-6 p-5">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tenant Name</label>
                      <input 
                        required autoFocus placeholder="e.g. Philippine Skills Center"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
                        value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                      />
                   </div>

                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                         <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Currency</label>
                         <select className="w-full appearance-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                           value={currency} onChange={e => setCurrency(e.target.value)}>
                            <option value="PHP">PHP</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Institution</label>
                         <select className="w-full appearance-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                           value={institutionType} onChange={e => setInstitutionType(e.target.value as InstitutionType)}>
                            <option value="TRAINING">Training</option>
                            <option value="ACADEMIC">Academic</option>
                            <option value="HYBRID">Hybrid</option>
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</label>
                         <select className="w-full appearance-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                           value={plan} onChange={e => setPlan(e.target.value as PlanType)}>
                            <option value="BASIC">Basic</option>
                            <option value="PROFESSIONAL">Professional</option>
                            <option value="ENTERPRISE">Enterprise</option>
                         </select>
                      </div>
                   </div>
                </div>

                <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                   <AlertCircle size={18} className="shrink-0 text-amber-700" />
                   <p className="text-xs leading-relaxed text-amber-900">
                     Manual provisioning bypasses the payment gateway. Use only for internal institutional testing or direct-billed Enterprise clients.
                   </p>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                   <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                   <button type="submit" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Create Tenant</button>
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
  <div className="p-5">
     <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{tier}</p>
     <div className="mb-1 flex items-baseline gap-2">
        <span className="text-base font-semibold tracking-tight text-slate-950">{price}</span>
     </div>
     <p className="mb-4 text-xs text-slate-500">{desc}</p>
     <div className="space-y-2">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
             <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Check size={10} strokeWidth={3} />
             </div>
             <span className="text-xs text-slate-600">{f}</span>
          </div>
        ))}
        {locked.map((f, i) => (
          <div key={i} className="flex items-center gap-2 opacity-50">
             <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Lock size={10} strokeWidth={3} />
             </div>
             <span className="text-xs text-slate-400 line-through decoration-slate-300">{f}</span>
          </div>
        ))}
     </div>
  </div>
);

const StatsCard: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="rounded-md border border-slate-200 bg-white p-4">
    <div>
       <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
       <p className="text-lg font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  </div>
);

export default TenantManagementView;

