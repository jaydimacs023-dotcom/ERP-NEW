
import React, { useState } from 'react';
import { 
  CreditCard, Check, ShieldCheck, Zap, Database, 
  Sparkles, ArrowRight, CheckCircle2, ChevronLeft,
  Smartphone, Landmark, Info, Copy, ExternalLink,
  Lock, Wallet, Hash, Clock, Loader2, UserCheck
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
      name: 'Basic Ledger',
      price: '49',
      desc: 'Ideal for small training centers needing pure accounting compliance.',
      icon: <Database size={24} />,
      features: [
        'General Ledger Core',
        'Standard PH Chart of Accounts',
        'Income Statement & Balance Sheet',
        'Single User Access',
        'Cloud Data Security'
      ],
      notIncluded: [
        'Learner Registry',
        'Batch Projections',
        'Procurement (PO)',
        'Fixed Asset Registry'
      ]
    },
    {
      id: 'PROFESSIONAL' as PlanType,
      name: 'Professional Operations',
      price: '99',
      desc: 'Full operational suite for growing institutions and TVET providers.',
      icon: <Zap size={24} />,
      isPopular: true,
      features: [
        'Everything in Basic',
        'Learner & Trainer Master Data',
        'MIS 03-02 Batch Imports',
        'Automated Completion Forecasts',
        'Subsidiary Ledgers (AR/AP)',
        'Banking & Treasury Management'
      ],
      notIncluded: [
        'Procurement (PO)',
        'Fixed Asset Management',
        'System Audit Logs'
      ]
    },
    {
      id: 'ENTERPRISE' as PlanType,
      name: 'Enterprise Strategic',
      price: '299',
      desc: 'The complete ERP for multi-site institutions and large-scale operations.',
      icon: <Sparkles size={24} />,
      features: [
        'Everything in Professional',
        'Purchase Orders (PO)',
        'Fixed Asset Depreciation Engine',
        'Full System Audit Trails',
        'Advanced RBAC Security',
        'Unlimited User Capacity',
        'Dedicated Support'
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
      // Actual state update to PENDING for system admin verification
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
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verification in Progress</h2>
             <p className="text-slate-600 font-medium mt-2">Your payment reference is now in the System Verification Queue.</p>
          </div>

          <div className="p-12 space-y-10">
             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Tier</p>
                   <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{currentPlanDetails.name}</p>
                </div>
                <div className="space-y-1 text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference Submitted</p>
                   <p className="text-lg font-mono font-black text-brand">{organization.paymentReference}</p>
                </div>
             </div>

             <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                <div className="flex items-start gap-4">
                   <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 shrink-0">
                      <UserCheck size={20} className="text-indigo-600" />
                   </div>
                   <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Waiting for Owner Confirmation</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        A System Administrator will verify the funds against the transaction log and manually activate your institutional license. 
                        This process usually takes 1-2 hours during business hours.
                      </p>
                   </div>
                </div>

                <div className="flex items-center gap-4 py-4 px-6 bg-white rounded-2xl border border-slate-200">
                   <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[10px] font-black text-white">S</div>
                      <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center text-[10px] font-black text-white">V</div>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Services Active</p>
                </div>
             </div>

             <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Refresh Dashboard Status
                </button>
                <p className="text-center mt-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Secure Institutional Billing Module v4.0
                </p>
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
          className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-brand transition-colors group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Plans
        </button>

        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand/10 border border-brand/20 rounded-full text-brand text-[10px] font-black uppercase tracking-widest">
            <Lock size={14} /> Secure Checkout
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Institutional Payment</h1>
          <p className="text-slate-500 font-medium">Complete your subscription for <span className="text-slate-900 font-black">{currentPlanDetails.name}</span></p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Order Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-black text-slate-800">{currentPlanDetails.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Monthly Billing</p>
                  </div>
                  <p className="text-sm font-black text-slate-900">${currentPlanDetails.price}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Amount</span>
                  <span className="text-xl font-black text-brand">${currentPlanDetails.price}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-brand-light rounded-[2rem] p-6 flex gap-3">
              <Info size={18} className="text-brand shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand font-bold leading-relaxed">
                Enter your transaction reference number after making the transfer. Manual activation by the System Administrator is required.
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Select Transfer Method</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => { setPaymentMethod('GCASH'); setReferenceNumber(''); }}
                className={`flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all text-left ${
                  paymentMethod === 'GCASH' ? 'border-brand bg-white shadow-xl ring-4 ring-brand-light' : 'border-slate-100 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${paymentMethod === 'GCASH' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">GCash Mobile</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Instant Online Wallet Transfer</p>
                  </div>
                </div>
                {paymentMethod === 'GCASH' && <CheckCircle2 size={24} className="text-brand" />}
              </button>

              <button 
                onClick={() => { setPaymentMethod('BPI'); setReferenceNumber(''); }}
                className={`flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all text-left ${
                  paymentMethod === 'BPI' ? 'border-brand bg-white shadow-xl ring-4 ring-brand-light' : 'border-slate-100 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${paymentMethod === 'BPI' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Landmark size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">BPI Online Transfer</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Direct Bank-to-Bank Deposit</p>
                  </div>
                </div>
                {paymentMethod === 'BPI' && <CheckCircle2 size={24} className="text-brand" />}
              </button>
            </div>

            {paymentMethod && (
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 opacity-5">
                   {paymentMethod === 'GCASH' ? <Smartphone size={160} /> : <Landmark size={160} />}
                </div>
                <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-brand uppercase tracking-[0.3em]">Official Account Details</h4>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">Verified Partner</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {paymentMethod === 'GCASH' ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registered Name</p>
                          <p className="text-lg font-black tracking-tight">Jay B. Dimaculangan</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GCash Number</p>
                          <div className="flex items-center gap-3">
                            <p className="text-2xl font-mono font-black text-brand">0955 231 5522</p>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Copy size={14}/></button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Name</p>
                          <p className="text-lg font-black tracking-tight">Jay B. Dimaculangan</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">BPI Account Number</p>
                          <div className="flex items-center gap-3">
                            <p className="text-2xl font-mono font-black text-brand">5606041367</p>
                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Copy size={14}/></button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-8 border-t border-white/10 space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Hash size={12} className="text-brand" /> Transaction Reference Number
                       </label>
                       <input 
                          type="text"
                          placeholder="e.g. 9012 345 6789"
                          className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-xl font-mono font-black text-white focus:border-brand focus:ring-4 focus:ring-brand/20 outline-none transition-all placeholder:text-slate-700"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                       />
                       <p className="text-[9px] text-slate-500 font-bold italic">Verification is subject to System Admin confirmation (Manual Audit).</p>
                    </div>

                    <button 
                      onClick={handleSubmitReference}
                      disabled={!referenceNumber.trim() || isVerifying}
                      className={`w-full py-5 rounded-3xl text-sm font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                        referenceNumber.trim() 
                          ? 'bg-brand text-white shadow-brand/20 hover:scale-[1.02]' 
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 shadow-none'
                      }`}
                    >
                      {isVerifying ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <ShieldCheck size={20} />
                      )}
                      {isVerifying ? 'Submitting...' : referenceNumber.trim() ? 'Submit for Verification' : 'Enter Reference to Proceed'}
                    </button>
                    
                    <p className="text-[10px] text-slate-500 font-bold text-center mt-4 uppercase tracking-tighter">
                      Activation is not instant. System Admin will verify the transfer.
                    </p>
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
    <div className="space-y-12 max-w-6xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-2">
          <ShieldCheck size={14} /> Secure Billing Portal
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Institutional License & Tiering</h1>
        <p className="text-slate-500 max-w-2xl mx-auto font-medium">
          Scale your institutional capabilities. Choose a plan that aligns with your operational complexity and compliance requirements.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PLANS.map((plan) => {
          const isCurrent = organization.planType === plan.id;
          const isTrial = organization.subscriptionStatus === 'TRIAL';
          
          return (
            <div 
              key={plan.id}
              className={`relative bg-white rounded-[2.5rem] border-2 transition-all flex flex-col ${
                isCurrent ? 'border-brand shadow-2xl scale-105 z-10' : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="p-10 border-b border-slate-50">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border shadow-sm ${
                  plan.id === 'ENTERPRISE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                  plan.id === 'PROFESSIONAL' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {plan.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">${plan.price}</span>
                  <span className="text-sm font-bold text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{plan.desc}</p>
              </div>

              <div className="p-10 flex-1 space-y-4">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 p-0.5 bg-emerald-100 text-emerald-600 rounded-full">
                      <Check size={12} strokeWidth={4} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 leading-tight">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3 opacity-40">
                    <div className="mt-0.5 p-0.5 bg-slate-100 text-slate-400 rounded-full">
                      <ArrowRight size={12} strokeWidth={4} className="rotate-180" />
                    </div>
                    <span className="text-xs font-medium text-slate-400 leading-tight line-through">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="p-10 pt-0">
                {isCurrent && !isTrial ? (
                  <div className="w-full py-4 rounded-2xl border-2 border-brand text-brand text-center text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> Active Plan
                  </div>
                ) : (
                  <button 
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${
                      plan.id === 'ENTERPRISE' ? 'bg-rose-600 text-white shadow-rose-100 hover:bg-rose-700' :
                      plan.id === 'PROFESSIONAL' ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' :
                      'bg-slate-900 text-white shadow-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    {isCurrent && isTrial ? 'Activate License' : 'Upgrade to ' + plan.id}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
          <CreditCard size={160} />
        </div>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h4 className="text-2xl font-black tracking-tight">Institutional Billing Cycle</h4>
            <p className="text-slate-400 font-medium leading-relaxed italic">
              "Unified invoicing and secure payment gateways ensure that your institutional operations remain uninterrupted. 
              Our ERP system adheres to international security standards for financial data handling."
            </p>
            <div className="flex gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-brand uppercase tracking-widest">PCI-DSS</p>
                <p className="text-xs font-bold text-slate-300">Certified Compliant</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-brand uppercase tracking-widest">Encryption</p>
                <p className="text-xs font-bold text-slate-300">AES-256 Bit SSL</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Current Tier</span>
                <span className="text-brand">{organization.planType}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Account Status</span>
                <span className={organization.subscriptionStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                  {organization.subscriptionStatus}
                </span>
              </div>
              <div className="pt-4 mt-4 border-t border-white/10 flex justify-between items-center">
                 <p className="text-sm font-bold">Manage Billing Methods</p>
                 <button className="p-2 hover:bg-white/10 rounded-xl transition-all">
                    <ArrowRight size={20} />
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
