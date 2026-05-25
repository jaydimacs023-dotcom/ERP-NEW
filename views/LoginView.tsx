
import React, { useState, useMemo } from 'react';
import { Database, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, ChevronRight, KeyRound } from 'lucide-react';
import { InstitutionType, Organization, User } from '../types';
import { authService } from '../services/AuthService';

interface LoginViewProps {
  onLogin: (user: User) => void;
  onRegister: (org: Organization, admin: User) => void;
  onForgotPassword: () => void;
  onBackToWelcome?: () => void;
  organizations: Organization[];
  users: User[];
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onForgotPassword, onBackToWelcome, organizations, users }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration State
  const [regOrgName, setRegOrgName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCurrency, setRegCurrency] = useState('PHP');
  const [regInstitutionType, setRegInstitutionType] = useState<InstitutionType>('TRAINING');

  // Password strength analysis
  const passwordStrength = useMemo(() => {
    if (!regPassword) return null;
    return authService.analyzePasswordStrength(regPassword);
  }, [regPassword]);

  const strengthColors = {
    weak: 'bg-red-500',
    fair: 'bg-amber-500',
    good: 'bg-emerald-500',
    strong: 'bg-[#F47721]',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Authenticate with Supabase or Mock - system auto-detects org from user record
      const result = await authService.login(email, password);

      if (result) {
        const user = result.user;
        // Block login if not email verified
        if (user.isEmailVerified === false) {
          setError('Email not verified. Please check your inbox for a verification link.');
          setLoading(false);
          return;
        }
        onLogin(user);
      } else {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    if (passwordStrength && passwordStrength.strength === 'weak') {
      setError('Password is too weak. Please use a stronger password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newOrgId = `org-trial-${Date.now()}`;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 14);

      const newOrg: Organization = {
        id: newOrgId,
        name: regOrgName,
        currency: regCurrency,
        institutionType: regInstitutionType,
        isVatRegistered: true,
        subscriptionStatus: 'TRIAL',
        planType: 'PROFESSIONAL',
        licenseExpiry: expiry.toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };

      // Password will be hashed by SupabaseDataService.createUser()
      const newAdmin: User = {
        id: `user-${Date.now()}`,
        name: 'Workspace Owner',
        email: regEmail,
        password: regPassword, // Will be hashed to password_hash by the service
        role: 'ADMIN',
        orgId: newOrgId
      };

      // Async registration with password hashing
      onRegister(newOrg, newAdmin);
      setLoading(false);
      setIsRegistering(false);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06162B] text-white">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_50%_70%,rgba(0,0,0,0.8),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,13,28,0.35)_0%,rgba(4,13,28,0.84)_100%)]" />
      <div className="absolute left-[8%] top-[18%] h-64 w-64 rounded-full bg-[#F47721]/10 blur-3xl" />
      <div className="absolute right-[10%] bottom-[12%] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="mx-auto max-w-5xl text-center lg:text-left">
              <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:gap-8">
                <img
                  src="/accountech-logo.png"
                  alt="Accountech logo"
                  className="h-24 w-24 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:h-36 md:w-36"
                />
                <div className="text-center md:text-left">
                  <h1 className="text-5xl font-black leading-none tracking-tight drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:text-7xl">
                    <span className="bg-gradient-to-r from-[#d8b35b] via-[#f5de9e] to-[#b78422] bg-clip-text text-transparent">
                      Accoun
                    </span>
                    <span className="text-white">Tech.</span>
                  </h1>
                  <p className="mt-2 italic text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-300 md:text-xl md:tracking-[0.34em]">
                    SMART SOLUTIONS FOR THE MODERN ECONOMY
                  </p>
                </div>
              </div>

             

              
            </section>

            <div className="relative w-full max-w-md justify-self-center rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl md:p-8">
              {!isRegistering ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <header className="space-y-1 text-center lg:text-left">
                    <h2 className="text-lg font-semibold text-white uppercase tracking-tight">Authorize</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Provide institutional credentials
                    </p>
                  </header>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Identity (Email)</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#F47721] transition-colors" size={18} />
                        <input
                          type="email"
                          required
                          placeholder="staff@institution.ph"
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/10 rounded-xl text-slate-100 text-sm font-medium outline-none focus:ring-4 focus:ring-[#F47721]/20 focus:border-[#F47721] transition-all"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Access Token (Password)</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#F47721] transition-colors" size={18} />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 border border-white/10 rounded-xl text-slate-100 text-sm font-medium outline-none focus:ring-4 focus:ring-[#F47721]/20 focus:border-[#F47721] transition-all"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
                      <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                      <p className="text-xs text-red-300 font-bold leading-relaxed">{error}</p>
                    </div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#F47721] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(244,119,33,0.35)] transition-all hover:bg-[#E06610] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        Open Workspace
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition-colors hover:text-[#F47721]"
                    >
                      <KeyRound size={12} /> Forgot Password?
                    </button>
                  </div>

                  <div className="pt-4 border-t border-white/10 text-center">
                    <button
                      type="button"
                      onClick={() => setIsRegistering(true)}
                      className="mx-auto inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:text-[#F47721]"
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
                      className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 transition-colors hover:text-white"
                    >
                      <ChevronRight size={16} className="rotate-180" /> Cancel Provisioning
                    </button>
                    <h2 className="text-xl font-semibold text-white uppercase tracking-tight">Provisioning</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                      Establish a new ERP workspace
                    </p>
                  </header>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Legal Institutional Title</label>
                      <input
                        required
                        placeholder="e.g. Phoenix Skills Center"
                        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-[#F47721] focus:ring-4 focus:ring-[#F47721]/20"
                        value={regOrgName}
                        onChange={e => setRegOrgName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Workspace Email (Primary Admin)</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@center.ph"
                        className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-[#F47721] focus:ring-4 focus:ring-[#F47721]/20"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Currency</label>
                        <select
                          className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-[#F47721] focus:ring-4 focus:ring-[#F47721]/20"
                          value={regCurrency}
                          onChange={e => setRegCurrency(e.target.value)}
                        >
                          <option value="PHP">PHP</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Institution</label>
                        <select
                          className="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-[#F47721] focus:ring-4 focus:ring-[#F47721]/20"
                          value={regInstitutionType}
                          onChange={e => setRegInstitutionType(e.target.value as InstitutionType)}
                        >
                          <option value="TRAINING">Training</option>
                          <option value="ACADEMIC">Academic</option>
                          <option value="HYBRID">Hybrid</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2">Admin Pass</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          minLength={8}
                          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-sm font-medium text-slate-100 outline-none transition-all focus:border-[#F47721] focus:ring-4 focus:ring-[#F47721]/20"
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {regPassword && passwordStrength && (
                      <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            <ShieldCheck size={14} /> Password Strength
                          </span>
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              passwordStrength.strength === 'weak'
                                ? 'text-red-400'
                                : passwordStrength.strength === 'fair'
                                  ? 'text-amber-400'
                                  : passwordStrength.strength === 'good'
                                    ? 'text-emerald-400'
                                    : 'text-orange-400'
                            }`}
                          >
                            {passwordStrength.strength}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${strengthColors[passwordStrength.strength]}`}
                            style={{ width: `${Math.min(100, (passwordStrength.score / 7) * 100)}%` }}
                          />
                        </div>
                        {passwordStrength.feedback.length > 0 && passwordStrength.strength !== 'strong' && (
                          <ul className="space-y-1">
                            {passwordStrength.feedback.slice(0, 3).map((tip, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="h-1 w-1 rounded-full bg-slate-500" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={loading}
                    className="w-full rounded-full bg-[#F47721] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(244,119,33,0.35)] transition-all hover:bg-[#E06610] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Initializing...' : 'Launch Professional Instance'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginView;
