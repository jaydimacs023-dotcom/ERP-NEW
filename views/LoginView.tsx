
import React, { useState, useMemo } from 'react';
import { Database, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, ChevronRight, KeyRound } from 'lucide-react';
import { Organization, User } from '../types';
import { authService } from '../services/AuthService';

interface LoginViewProps {
  onLogin: (user: User) => void;
  onRegister: (org: Organization, admin: User) => void;
  onForgotPassword: () => void;
  organizations: Organization[];
  users: User[];
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegister, onForgotPassword, organizations, users }) => {
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
    <div className="w-screen h-screen bg-gray-900 flex items-center justify-center p-4 overflow-auto relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-[#F47721]/10 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] bg-rose-600/10 rounded-full blur-[160px]"></div>
      </div>

      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-8 items-center justify-center relative z-10 my-auto py-8">

        {/* Left Column: Product Branding Only */}
        {!isRegistering && (
          <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-left-12 duration-700 hidden lg:block text-center lg:text-left">
            <div>

              <h1 className="text-4xl font-semibold text-white tracking-tighter leading-none mb-3"><span className="text-orange-500">Accoun</span>Tech.</h1>
              <p className="text-sm text-gray-400 font-medium leading-relaxed">
                The world-class, multi-tenant ERP core for institutional compliance and financial oversight.
              </p>
            </div>
          </div>
        )}

        {/* Right Column: Interactive Login Form */}
        <div className="w-full max-w-sm bg-gray-800/80 backdrop-blur-3xl border border-gray-700 p-8 rounded-md shadow-md ring-4 ring-white/5 animate-in slide-in-from-right-12 duration-700">
          {!isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <header className="space-y-1 text-center lg:text-left">
                <h2 className="text-lg font-semibold text-white uppercase tracking-tight">Authorize</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Provide institutional credentials</p>
              </header>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Identity (Email)</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                      type="email" required placeholder="staff@institution.ph"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-400/20 focus:border-orange-400 transition-all"
                      value={email} onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Access Token (Password)</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                      type="password" required placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-bold outline-none focus:ring-4 focus:ring-orange-400/20 focus:border-orange-400 transition-all"
                      value={password} onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded flex gap-3">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-red-300 font-bold leading-relaxed">{error}</p>
                </div>
              )}

              <button
                disabled={loading}
                className="w-full py-3.5 bg-[#F47721] text-white rounded text-sm font-semibold uppercase tracking-wide shadow-md shadow-gray-300/30 hover:bg-[#E06610] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>Open Workspace <ArrowRight size={16} /></>
                )}
              </button>

              {/* Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs font-bold text-gray-500 hover:text-orange-400 transition-colors inline-flex items-center gap-1"
                >
                  <KeyRound size={12} /> Forgot Password?
                </button>
              </div>

              <div className="pt-4 border-t border-gray-700 text-center">
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-orange-400 transition-colors flex items-center justify-center gap-2 mx-auto"
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
                  className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 hover:text-white transition-colors mb-4"
                >
                  <ChevronRight size={16} className="rotate-180" /> Cancel Provisioning
                </button>
                <h2 className="text-xl font-semibold text-white uppercase tracking-tight">Provisioning</h2>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Establish a new ERP workspace</p>
              </header>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Legal Institutional Title</label>
                  <input
                    required placeholder="e.g. Phoenix Skills Center"
                    className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-medium outline-none focus:border-orange-400 transition-all"
                    value={regOrgName} onChange={e => setRegOrgName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Workspace Email (Primary Admin)</label>
                  <input
                    type="email" required placeholder="admin@center.ph"
                    className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-medium outline-none focus:border-orange-400 transition-all"
                    value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Currency</label>
                    <select
                      className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-medium outline-none appearance-none"
                      value={regCurrency} onChange={e => setRegCurrency(e.target.value)}
                    >
                      <option value="PHP">PHP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Admin Pass</label>
                    <input
                      type="password" required placeholder="••••••••" minLength={8}
                      className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded text-gray-200 text-sm font-medium outline-none focus:border-orange-400 transition-all"
                      value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {regPassword && passwordStrength && (
                  <div className="space-y-3 p-4 bg-gray-700/30 rounded border border-gray-600/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                        <ShieldCheck size={14} /> Password Strength
                      </span>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${passwordStrength.strength === 'weak' ? 'text-red-400' :
                        passwordStrength.strength === 'fair' ? 'text-amber-400' :
                          passwordStrength.strength === 'good' ? 'text-emerald-400' :
                            'text-orange-400'
                        }`}>
                        {passwordStrength.strength}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strengthColors[passwordStrength.strength]}`}
                        style={{ width: `${Math.min(100, (passwordStrength.score / 7) * 100)}%` }}
                      />
                    </div>
                    {passwordStrength.feedback.length > 0 && passwordStrength.strength !== 'strong' && (
                      <ul className="space-y-1">
                        {passwordStrength.feedback.slice(0, 3).map((tip, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="w-1 h-1 bg-gray-600 rounded-full" />
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
                className="w-full py-3.5 bg-[#F47721] text-white rounded text-sm font-semibold uppercase tracking-wide shadow-md hover:bg-[#E06610] active:scale-95 transition-all flex items-center justify-center gap-3"
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

export default LoginView;

