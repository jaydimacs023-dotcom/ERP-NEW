
import React, { useState } from 'react';
import { Database, ShieldCheck, ArrowRight, Lock, Mail, Building2, Info, UserCircle, PlusCircle, X, Globe, Sparkles, ChevronLeft } from 'lucide-react';
import { Organization, User } from '../types';

interface LoginViewProps {
  onLogin: (user: User) => void;
  onRegister: (org: Organization, admin: User) => void;
  organizations: Organization[];
  users: User[];
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, organizations, users }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgId, setOrgId] = useState(organizations[0]?.id || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration State
  const [regOrgName, setRegOrgName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCurrency, setRegCurrency] = useState('PHP');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const trimmedEmail = email.trim().toLowerCase();
      const user = users.find(u => 
        u.email.toLowerCase() === trimmedEmail && 
        u.orgId === orgId && 
        u.password === password
      );
      
      if (user) {
        onLogin(user);
      } else {
        setError('Authentication failed. Check your credentials or Organization ID.');
        setLoading(false);
      }
    }, 800);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const newOrgId = `org-trial-${Date.now()}`;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 14); // 14 Day Trial

    const newOrg: Organization = {
      id: newOrgId,
      name: regOrgName,
      currency: regCurrency,
      isVatRegistered: true,
      subscriptionStatus: 'TRIAL',
      planType: 'PROFESSIONAL', 
      licenseExpiry: expiry.toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const newAdmin: User = {
      id: `user-${Date.now()}`,
      name: 'Workspace Owner',
      email: regEmail,
      password: regPassword,
      role: 'ADMIN',
      orgId: newOrgId
    };

    setTimeout(() => {
      onRegister(newOrg, newAdmin);
      setLoading(false);
      setIsRegistering(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-500/20 mb-6">
            <Database className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">AccounTech<span className="text-indigo-500">.</span></h1>
          <p className="text-slate-400 mt-2 font-medium">Universal Multi-Tenant ERP Suite</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
          {!isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Select Organization</label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <select 
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-indigo-500/50"
                    value={orgId}
                    onChange={e => setOrgId(e.target.value)}
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id} className="bg-slate-900">{org.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="email" required placeholder="admin@organization.ph"
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={email} onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Access Token / Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="password" required placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={password} onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3 animate-in fade-in slide-in-from-top-2">
                  <X className="text-rose-500 shrink-0" size={18} />
                  <p className="text-xs text-rose-200 font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Validating Session...' : <>Authorize & Enter <ArrowRight size={18} /></>}
              </button>

              <div className="pt-4 border-t border-slate-800 text-center">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <Sparkles size={14} /> Start 14-Day Free Trial
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-6 animate-in slide-in-from-right-10 duration-300">
              <button 
                type="button" 
                onClick={() => setIsRegistering(false)}
                className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-slate-300 mb-2"
              >
                <ChevronLeft size={16} /> Back to Sign In
              </button>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Institutional Name</label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    required placeholder="e.g. Phoenix Skills Academy"
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={regOrgName} onChange={e => setRegOrgName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Work Email (Admin)</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input 
                    type="email" required placeholder="admin@ Phoenix.edu"
                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Currency</label>
                  <select 
                    className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none"
                    value={regCurrency} onChange={e => setRegCurrency(e.target.value)}
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Password</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
                    value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-3">
                <Info className="text-indigo-400 shrink-0" size={18} />
                <p className="text-[10px] text-indigo-200 font-medium leading-relaxed">
                  Your trial workspace includes <strong>Professional Tier</strong> features. No credit card required for the 14-day evaluation period.
                </p>
              </div>

              <button 
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Provisioning Workspace...' : <>Launch Trial Environment <Sparkles size={18} /></>}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center flex flex-col gap-4">
           <div className="flex items-center justify-center gap-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
             <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> ISO 27001 Secure</span>
             <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
             <span>TLS 1.3 Encryption</span>
           </div>
           <p className="text-[9px] text-slate-600 font-bold max-w-xs mx-auto uppercase tracking-tighter leading-relaxed">
             Institutional access is restricted to authorized personnel. All connections are audited and IP-logged for system security compliance.
           </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
