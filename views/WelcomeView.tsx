import React from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface WelcomeViewProps {
  onLoginClick: () => void;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onLoginClick }) => {
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(41,171,226,0.28),transparent_34%),radial-gradient(circle_at_50%_70%,rgba(0,0,0,0.8),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,13,28,0.35)_0%,rgba(4,13,28,0.84)_100%)]" />
      <div className="absolute left-[8%] top-[18%] h-64 w-64 rounded-full bg-[#29ABE2]/10 blur-3xl" />
      <div className="absolute right-[10%] bottom-[12%] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-7xl">
          <div className="mx-auto max-w-5xl text-center">
            <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:gap-8">
              <img
                src="/at-erp-logo.svg"
                alt="AT-ERP logo"
                className="h-24 w-24 object-contain drop-shadow-[0_12px_32px_rgba(41,171,226,0.4)] md:h-36 md:w-36"
              />
              <div className="text-center md:text-left">
                <h1 className="text-5xl font-black leading-none tracking-tight drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] md:text-7xl">
                  <span className="bg-gradient-to-r from-[#29ABE2] via-[#6DD5FA] to-[#1565C0] bg-clip-text text-transparent">
                    Accoun
                  </span>
                  <span className="text-white">Tech.</span>
                </h1>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-300 md:text-xl md:tracking-[0.34em]">
                  SMART SOLUTIONS FOR THE MODERN ECONOMY
                </p>
              </div>
            </div>

            <p className="mx-auto mt-0 italic max-w-3xl text-sm text-slate-300/90 md:text-sm md:tracking-wide">
              A secure, multi-tenant ERP workspace for finance, operations, and institutional control.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={onLoginClick}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1565C0] to-[#0D47A1] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(41,171,226,0.35)] transition-all hover:from-[#29ABE2] hover:to-[#1565C0] active:scale-95"
              >
                Login
                <ArrowRight size={16} />
              </button>

              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                <ShieldCheck size={14} className="text-emerald-400" />
                Authorized access only
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WelcomeView;
