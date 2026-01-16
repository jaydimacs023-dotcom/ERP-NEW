
import React, { useState } from 'react';
import { Database, ShieldCheck, ArrowRight, Lock, Mail, Building2, UserCircle, Fingerprint, AlertCircle, ChevronRight, Briefcase, GraduationCap, Users, History, Terminal, Landmark, BookOpen, Key } from 'lucide-react';
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
  const [orgId, setOrgId] = useState(organizations.find(o => o.id === 'org-3')?.id || organizations[0]?.id || '');
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
        setError('Authentication failed. Ensure the correct Organization is selected for this user.');
        setLoading(false);
      }
    }, 800);
  };

  const handleQuickLogin = (roleEmail: string, roleOrgId: string, rolePass: string = 'password') => {
    setEmail(roleEmail);
    setOrgId(roleOrgId);
    setPassword(rolePass);
    setError('');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const newOrgId = `org-trial-${Date.now()}`;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 14);

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
    <div className="w-screen h-screen bg-slate-950 flex items-center justify-center p-4 overflow-auto relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-rose-600/10 rounded-full blur-[160px]"></div>
      </div>

      <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-center justify-center relative z-10 my-auto py-8">
        
        {/* Left Column: Product Branding & Demo Directory */}
        {!isRegistering && (
          <div className="w-full max-w-xl space-y-6 animate-in slide-in-from-left-12 duration-700 hidden lg:block">
            <div className="text-left">
              <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl shadow-2xl shadow-indigo-500/20 mb-4 border-2 border-white/5">
                <Database className="text-white" size={28} />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-3">AccounTech<span className="text-indigo-500">.</span></h1>
              <p className="text-sm text-slate-400 font-medium max-w-md leading-relaxed">
                The world-class, multi-tenant ERP core for institutional compliance and financial oversight.
              </p>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-6 space-y-6 shadow-2xl overflow-hidden relative group max-h-80 overflow-y-auto scrollbar-hide">
               <div className="absolute top-0 right-0 p-8 opacity-5 -mr-8 -mt-8">
                  <Fingerprint size={160} />
               </div>
               
               <header className="flex justify-between items-center relative z-10">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">Developer Console</h3>
                    <p className="text-sm font-black text-white uppercase tracking-tight">Credential Directory</p>
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                     v4.1
                  </div>
               </header>

               <div className="grid grid-cols-2 gap-2 relative z-10">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Admin</p>
                     <DemoItem 
                       role="System Architect" 
                       email="dev@accountech.io" 
                       pass="admin"
                       icon={<Terminal size={12}/>} 
                       onClick={() => handleQuickLogin('dev@accountech.io', 'org-system', 'admin')}
                       color="indigo"
                     />
                     <DemoItem 
                       role="President" 
                       email="president@manila.ph" 
                       icon={<ShieldCheck size={12}/>} 
                       onClick={() => handleQuickLogin('president@manila.ph', 'org-3')}
                       color="amber"
                     />
                     <DemoItem 
                       role="Admin" 
                       email="maria@manila.ph" 
                       icon={<Building2 size={12}/>} 
                       onClick={() => handleQuickLogin('maria@manila.ph', 'org-3')}
                       color="slate"
                     />
                  </div>
                  
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Finance</p>
                     <DemoItem 
                       role="Finance Manager" 
                       email="finance@manila.ph" 
                       icon={<Landmark size={12}/>} 
                       onClick={() => handleQuickLogin('finance@manila.ph', 'org-3')}
                       color="emerald"
                     />
                     <DemoItem 
                       role="Accountant" 
                       email="alicia@manila.ph" 
                       icon={<BookOpen size={12}/>} 
                       onClick={() => handleQuickLogin('alicia@manila.ph', 'org-3')}
                       color="indigo"
                     />
                     <DemoItem 
                       role="AR/AP Spec" 
                       email="ana@manila.ph" 
                       icon={<History size={12}/>} 
                       onClick={() => handleQuickLogin('ana@manila.ph', 'org-3')}
                       color="blue"
                     />
                  </div>

                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Ops</p>
                     <DemoItem 
                       role="Registrar" 
                       email="ricardo@manila.ph" 
                       icon={<Users size={12}/>} 
                       onClick={() => handleQuickLogin('ricardo@manila.ph', 'org-3')}
                       color="rose"
                     />
                     <DemoItem 
                       role="Trainer" 
                       email="juan.dc@academy.ph" 
                       icon={<GraduationCap size={12}/>} 
                       onClick={() => handleQuickLogin('juan.dc@academy.ph', 'org-3')}
                       color="emerald"
                     />
                  </div>

                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Student</p>
                     <DemoItem 
                       role="Learner" 
                       email="jose@learner.ph" 
                       icon={<UserCircle size={12}/>} 
                       onClick={() => handleQuickLogin('jose@learner.ph', 'org-3')}
                       color="indigo"
                     />
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Right Column: Interactive Login Form */}
        <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-3xl border border-slate-800 p-8 rounded-3xl shadow-2xl ring-24 ring-white/5 animate-in slide-in-from-right-12 duration-700">
          {!isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <header className="space-y-1 text-center lg:text-left">
                 <h2 className="text-2xl font-black text-white uppercase tracking-tight">Authorize</h2>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Provide institutional credentials</p>
              </header>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Institutional Tenant</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <select 
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border-2 border-slate-700 rounded-2xl text-slate-200 text-sm font-black outline-none appearance-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Identity (Email)</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input 
                      type="email" required placeholder="staff@institution.ph"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border-2 border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={email} onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Access Token (Password)</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input 
                      type="password" required placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border-2 border-slate-700 rounded-2xl text-slate-200 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={password} onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-red-300 font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Open Workspace <ArrowRight size={16} /></>
                )}
              </button>

              <div className="pt-4 border-t border-slate-800 text-center">
                <button 
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <Database size={12} /> Provision New Ledger
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-8 animate-in slide-in-from-right-12 duration-500">
              <header className="space-y-2">
                 <button 
                  type="button" 
                  onClick={() => setIsRegistering(false)}
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors mb-4"
                >
                  <ChevronRight size={16} className="rotate-180" /> Cancel Provisioning
                </button>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">Provisioning</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Establish a new ERP workspace</p>
              </header>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Legal Institutional Title</label>
                  <input 
                    required placeholder="e.g. Phoenix Skills Center"
                    className="w-full px-6 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-3xl text-slate-200 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                    value={regOrgName} onChange={e => setRegOrgName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Workspace Email (Primary Admin)</label>
                  <input 
                    type="email" required placeholder="admin@center.ph"
                    className="w-full px-6 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-3xl text-slate-200 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Currency</label>
                    <select 
                      className="w-full px-6 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-3xl text-slate-200 text-sm font-black outline-none appearance-none"
                      value={regCurrency} onChange={e => setRegCurrency(e.target.value)}
                    >
                      <option value="PHP">PHP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Admin Pass</label>
                    <input 
                      type="password" required placeholder="••••••••"
                      className="w-full px-6 py-5 bg-slate-800/50 border-2 border-slate-700 rounded-3xl text-slate-200 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                      value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white rounded-[2.2rem] text-sm font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {loading ? 'Initializing...' : 'Launch Professional Instance'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const DemoItem: React.FC<{ role: string, email: string, pass?: string, icon: React.ReactNode, onClick: () => void, color: string }> = ({ role, email, pass = 'password', icon, onClick, color }) => (
  <button 
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-[1.5rem] text-left hover:bg-white/10 hover:border-white/10 transition-all group active:scale-95 overflow-hidden"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-xl shrink-0 transition-transform group-hover:scale-110 ${
      color === 'indigo' ? 'bg-indigo-600 border-indigo-400 text-white' :
      color === 'emerald' ? 'bg-emerald-600 border-emerald-400 text-white' :
      color === 'amber' ? 'bg-amber-600 border-amber-400 text-white' :
      color === 'rose' ? 'bg-rose-600 border-rose-400 text-white' :
      color === 'blue' ? 'bg-blue-600 border-blue-400 text-white' :
      'bg-slate-700 border-slate-500 text-white'
    }`}>
      {icon}
    </div>
    <div className="flex-1 overflow-hidden">
       <div className="flex items-center gap-2">
          <p className="text-xs text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{role}</p>
          <div className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] font-black text-slate-500 uppercase">{pass}</div>
       </div>
       <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter truncate opacity-70">{email}</p>
    </div>
    <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
       <Key size={14} className="text-indigo-500" />
    </div>
  </button>
);

export default LoginView;
