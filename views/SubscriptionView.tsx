
import React, { useState } from 'react';
import { 
  CreditCard, Check, ShieldCheck, Zap, Database, 
  Sparkles, ArrowRight, CheckCircle2, ChevronLeft,
  Smartphone, Landmark, Info, Copy, ExternalLink,
  Lock, Wallet, Hash, Clock, Loader2, UserCheck,
  Calculator, GraduationCap, History, ShoppingCart,
  Layers, Users, Award
} from 'lucide-react';
import { Organization, PlanType } from '../types';

interface SubscriptionViewProps {
  organization: Organization;
  onUpdate: (org: Organization) => void;
}

type CheckoutStep = 'SELECT' | 'PAYMENT';

const SubscriptionView: React.FC<SubscriptionViewProps> = ({ organization, onUpdate }) => {
  const [step, setStep] = useState<CheckoutStep>('SELECT');
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'GCASH' | 'BPI' | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const PLANS = [
    {
      id: 'BASIC' as PlanType,
      name: 'Ledger Core',
      price: '49',
      desc: 'Simple double-entry compliance for small service entities.',
      icon: <Database size={24} />,
      features: [
        'General Ledger & Journal Postings',
        'Standard Chart of Accounts',
        'Basic Balance Sheet & P&L',
        'Single Administrator License',
        'Cloud-Secure Data Vault'
      ],
      notIncluded: [
        'School Management Module',
        'Student & Trainer Portals',
        'AR/AP Subsidiary Ledgers',
        'Full Statutory Payroll'
      ]
    },
    {
      id: 'PROFESSIONAL' as PlanType,
      name: 'Institutional Ops',
      price: '149',
      desc: 'Complete School Management & Learner Self-Service.',
      icon: <GraduationCap size={24} />,
      isPopular: true,
      features: [
        'Everything in Core',
        'School Management Module',
        '8-Hour Rule Batch Forecasting',
        'Student Document Compliance',
        'Instructor Capacity Matrix',
        'Student & Trainer Hub Access',
        'Subsidiary AR & AP Ledgers',
        'Official Receipt (OR) Engine'
      ],
      notIncluded: [
        'Purchase Order Approvals',
        'Fixed Asset Depreciation',
        'Full Payroll & Payslips',
        'Forensic Delta Audit Trail'
      ]
    },
    {
      id: 'ENTERPRISE' as PlanType,
      name: 'Governance Pro',
      price: '499',
      desc: 'Institutional-grade control, HR, and asset management.',
      icon: <ShieldCheck size={24} />,
      features: [
        'Everything in Professional',
        'Institutional HR & Payroll Engine',
        'Statutory Deduction Logic',
        'Purchase Order (PO) Workflows',
        'Fixed Asset Life Management',
        'Depreciation Automation',
        'Forensic Audit (State Deltas)',
        'Budget Variance Tracking'
      ],
      notIncluded: []
    }
  ];

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    setStep('PAYMENT');
    setReferenceNumber('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitReference = () => {
    if (referenceNumber.trim() && selectedPlan) {
      setIsVerifying(true);
      setTimeout(() => {
        onUpdate({
          ...organization,
          subscriptionStatus: 'PENDING',
          pendingPlanType: selectedPlan,
          paymentReference: referenceNumber
        });
        setIsVerifying(false);
      }, 1500);
    }
  };

  const currentPlanDetails = PLANS.find(p => p.id === (organization.pendingPlanType || selectedPlan));

  if (organization.subscriptionStatus === 'PENDING' && currentPlanDetails) {
    return (
      <div className="max-w-3xl mx-auto py-12 animate-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-amber-50 p-12 text-center border-b border-amber-100 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-amber-200 overflow-hidden">
                <div className="h-full bg-amber-500 animate-[progress_10s_linear_infinite]" style={{ width: '40%' }}></div>
             </div>
             <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-6 text-amber-600 border-2 border-amber-100">
                <Clock size={40} className="animate-pulse" />
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Verification Queue</h2>
             <p className="text-slate-600 font-medium mt-2 italic px-10">We are verifying your institutional funds. Professional features unlock automatically upon validation.</p>
          </div>

          <div className="p-12 space-y-10">
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Tier</p>
                   <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{currentPlanDetails.name}</p>
                </div>
                <div className="space-y-1 text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Reference</p>
                   <p className="text-lg font-mono font-black text-teal-600">{organization.paymentReference}</p>
                </div>
             </div>

             <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 shrink-0">
                      <UserCheck size={20} className="text-teal-600" />
                   </div>
                   <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Onboarding Policy</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-1">
                        Professional and Enterprise licenses require a standard AML fund check. Your instructional modules and portals will be active within 60 minutes.
                      </p>
                   </div>
                </div>
             </div>

             <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-xl"
                >
                  Refresh Subscription Data
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'PAYMENT' && currentPlanDetails) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setStep('SELECT')}
          className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-teal-600 transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Plans
        </button>

        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand/10 border border-brand/20 rounded-full text-brand text-[10px] font-black uppercase tracking-widest">
            <Lock size={14} /> High-Security Checkout
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight uppercase">Authorize Tier Upgrade</h1>
          <p className="text-slate-500 font-medium italic">Establishing full institutional functionality for <span className="text-slate-900 font-black">{organization.name}</span>.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Subscription Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase">{currentPlanDetails.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Institutional License</p>
                  </div>
                  <p className="text-sm font-black text-slate-900">${currentPlanDetails.price}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total / Mo</span>
                  <span className="text-xl font-black text-teal-600">${currentPlanDetails.price}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-teal-50 rounded-[2rem] p-6 flex gap-3 border border-teal-100">
              <Info size={18} className="text-teal-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-teal-700 font-bold leading-relaxed">
                Platform operations verify all institutional transfers manually. Once verified, all requested School Management and Accounting modules will be hot-deployed to your instance.
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Choose Settlement Network</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => { setPaymentMethod('GCASH'); setReferenceNumber(''); }}
                className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all text-left ${
                  paymentMethod === 'GCASH' ? 'border-teal-600 bg-white shadow-xl ring-4 ring-teal-50' : 'border-slate-100 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${paymentMethod === 'GCASH' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">GCash Digital Wallet</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Secure Mobile Settlement</p>
                  </div>
                </div>
                {paymentMethod === 'GCASH' && <CheckCircle2 size={24} className="text-teal-600" />}
              </button>

              <button 
                onClick={() => { setPaymentMethod('BPI'); setReferenceNumber(''); }}
                className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all text-left ${
                  paymentMethod === 'BPI' ? 'border-teal-600 bg-white shadow-xl ring-4 ring-teal-50' : 'border-slate-100 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${paymentMethod === 'BPI' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Landmark size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Institutional BPI Deposit</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Corporate Bank-to-Bank Transfer</p>
                  </div>
                </div>
                {paymentMethod === 'BPI' && <CheckCircle2 size={24} className="text-teal-600" />}
              </button>
            </div>

            {paymentMethod && (
              <div className="bg-slate-950 rounded-[3rem] p-10 text-white shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-teal-400 uppercase tracking-[0.3em]">Institutional Settlement Vault</h4>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10">Compliance: Level 3</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipient Entity</p>
                       <p className="text-lg font-black tracking-tight uppercase">JAY B. DIMACULANGAN</p>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Target</p>
                       <div className="flex items-center gap-3">
                          <p className="text-2xl font-mono font-black text-teal-400 tracking-tighter">{paymentMethod === 'GCASH' ? '0955 231 5522' : '5606-0413-67'}</p>
                          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" onClick={() => { navigator.clipboard.writeText(paymentMethod === 'GCASH' ? '09552315522' : '5606041367'); }}><Copy size={14}/></button>
                       </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Hash size={12} className="text-teal-400" /> Fund Transfer Reference Number
                       </label>
                       <input 
                          type="text"
                          placeholder="Provide the unique network txn id..."
                          className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-5 text-2xl font-mono font-black text-white focus:border-teal-400 focus:ring-4 focus:ring-teal-400/20 outline-none transition-all placeholder:text-slate-800"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                       />
                    </div>

                    <button 
                      onClick={handleSubmitReference}
                      disabled={!referenceNumber.trim() || isVerifying}
                      className={`w-full py-5 rounded-3xl text-xs font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                        referenceNumber.trim() 
                          ? 'bg-teal-600 text-white shadow-teal-600/20' 
                          : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {isVerifying ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                      {isVerifying ? 'Verifying Integrity...' : 'Commit Activation Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-24 animate-in fade-in duration-700">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 border border-teal-100 rounded-full text-teal-600 text-[10px] font-black uppercase tracking-widest mb-2">
          <ShieldCheck size={14} /> Modular ERP Licensing
        </div>
        <h1 className="text-5xl font-black text-slate-800 tracking-tighter uppercase">Choose Your Scale</h1>
        <p className="text-slate-500 max-w-3xl mx-auto font-medium leading-relaxed italic">
          Unlock institutional governance with our modular framework. Each tier is calibrated for specific compliance requirements, from lean bookkeeping to full School Management.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLANS.map((plan) => {
          const isCurrent = organization.planType === plan.id;
          const isTrial = organization.subscriptionStatus === 'TRIAL';
          
          return (
            <div 
              key={plan.id}
              className={`relative bg-white rounded-[3rem] border-2 transition-all flex flex-col group ${
                isCurrent ? 'border-teal-600 shadow-2xl scale-105 z-10' : 'border-slate-100 hover:border-slate-300 shadow-sm'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white px-6 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl">
                  Institutional Standard
                </div>
              )}

              <div className="p-10 border-b border-slate-50">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 border shadow-sm transition-all group-hover:scale-110 ${
                  plan.id === 'ENTERPRISE' ? 'bg-slate-900 text-teal-400 border-slate-950' :
                  plan.id === 'PROFESSIONAL' ? 'bg-teal-50 text-teal-600 border-teal-100' :
                  'bg-slate-50 text-slate-400 border-slate-200'
                }`}>
                  {plan.icon}
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 uppercase">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-mono font-black text-slate-900 tracking-tighter">${plan.price}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ month</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-bold italic">{plan.desc}</p>
              </div>

              <div className="p-10 flex-1 space-y-5">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 p-0.5 rounded-full ${plan.id === 'ENTERPRISE' ? 'bg-teal-100 text-teal-600' : 'bg-emerald-100 text-teal-600'}`}>
                      <Check size={12} strokeWidth={4} />
                    </div>
                    <span className="text-[11px] font-black text-slate-700 leading-tight uppercase tracking-tight">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 opacity-30">
                    <div className="mt-0.5 p-0.5 bg-slate-100 text-slate-400 rounded-full">
                      <Lock size={10} strokeWidth={3} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase tracking-tight line-through">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="p-10 pt-0">
                {isCurrent && !isTrial ? (
                  <div className="w-full py-4 rounded-2xl border-2 border-teal-600 text-teal-600 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> Active Environment
                  </div>
                ) : (
                  <button 
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-4 rounded-3xl text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl ${
                      plan.id === 'ENTERPRISE' ? 'bg-slate-900 text-white shadow-teal-900/10 hover:bg-black' :
                      plan.id === 'PROFESSIONAL' ? 'bg-teal-600 text-white shadow-teal-900/10 hover:bg-teal-700' :
                      'bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isCurrent && isTrial ? 'Settle Full License' : 'Upgrade Instance'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Spotlight: School Management */}
      <div className="bg-white rounded-[3.5rem] p-12 border-2 border-teal-600 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-16">
         <div className="flex-1 space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
               Market Leading Capability
            </div>
            <h4 className="text-4xl font-black text-slate-800 tracking-tighter uppercase leading-none">
               Comprehensive School Management Engine
            </h4>
            <p className="text-sm text-slate-500 leading-relaxed font-bold italic">
               The Professional tier unlocks the 8-Hour Rule Forecast Engine, which dynamically computes program terminal dates based on real-time instructor capacity. 
               Bridge your academic logistics with your financial ledger in a single unified workspace.
            </p>
            <div className="flex flex-wrap gap-8 pt-4 border-t border-slate-100">
               <FeatureHighlight icon={<Users size={20}/>} label="Learner Registry" />
               <FeatureHighlight icon={<Layers size={20}/>} label="Batch Forecasts" />
               <FeatureHighlight icon={<Award size={20}/>} label="NTTC Accreditation" />
            </div>
         </div>
         <div className="shrink-0 relative z-10">
            <div className="w-64 h-64 bg-slate-900 rounded-[3rem] shadow-2xl p-10 text-white flex flex-col justify-between border-4 border-white/5 rotate-3">
               <GraduationCap size={48} className="text-teal-400" />
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Available on:</p>
                  <p className="text-xl font-black text-white uppercase tracking-tight">Professional+</p>
               </div>
            </div>
         </div>
         <div className="absolute top-0 right-0 p-12 opacity-[0.03] -mr-20 -mt-20">
            <GraduationCap size={350} />
         </div>
      </div>

      <div className="bg-slate-900 rounded-[3.5rem] p-12 text-white shadow-2xl flex flex-col md:flex-row items-center gap-12 border border-white/5">
         <div className="flex-1 space-y-4">
            <h4 className="text-2xl font-black uppercase tracking-tight flex items-center gap-4">
               <History size={32} className="text-teal-400" />
               Cryptographic Audit Anchoring
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
               Institutional data is immutable. Upgrading to **Enterprise** unlocks the forensic delta engine, which logs exact JSON state changes for every record, 
               providing a legal-grade audit trail for institutional donors and government regulators.
            </p>
         </div>
         <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 grid grid-cols-2 gap-10 shrink-0">
            <div className="text-center">
               <p className="text-3xl font-mono font-black text-teal-400">99.9%</p>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Uptime SLA</p>
            </div>
            <div className="text-center">
               <p className="text-3xl font-mono font-black text-emerald-400">AES-256</p>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Vault Privacy</p>
            </div>
         </div>
      </div>
    </div>
  );
};

const FeatureHighlight: React.FC<{ icon: React.ReactNode, label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-3">
     <div className="text-teal-600">{icon}</div>
     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

export default SubscriptionView;
