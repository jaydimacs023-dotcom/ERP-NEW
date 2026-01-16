
import React, { useRef } from 'react';
import { 
  Database, Download, Upload, Trash2, History, ShieldCheck, 
  AlertCircle, CloudLightning, RefreshCw, FileJson, Server
} from 'lucide-react';
import { AuditLog } from '../types';

interface MaintenanceViewProps {
  logs: AuditLog[];
  onExport: () => void;
  onImport: (data: any) => void;
  onReset?: () => void;
}

const MaintenanceView: React.FC<MaintenanceViewProps> = ({ logs, onExport, onImport, onReset }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (confirm("Critical: Importing this backup will overwrite your current institutional data. Proceed?")) {
            onImport(json);
          }
        } catch (err) {
          alert("Invalid backup file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">System Maintenance & Data Utility</h2>
        <p className="text-sm text-slate-500 font-normal italic">Institutional disaster recovery and immutable data portability.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 space-y-6 shadow-sm">
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Download size={24}/></div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Export Full Snapshot</h3>
           </div>
           <p className="text-sm text-slate-500 leading-relaxed font-medium">
             Generate a GAAP-compliant JSON archive of your entire organizational ledger, student registry, and system configurations. This file serves as an offline backup.
           </p>
           <button 
             onClick={onExport}
             className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
           >
             <FileJson size={18} /> Download Backup (.json)
           </button>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 space-y-6 shadow-sm">
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg"><Upload size={24}/></div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Restore Environment</h3>
           </div>
           <p className="text-sm text-slate-500 leading-relaxed font-medium">
             Re-hydrate your institution's environment from a previously exported backup. Warning: Current state will be replaced.
           </p>
           <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
           >
             <Server size={18} /> Upload & Re-hydrate Ledger
           </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <ShieldCheck size={200} />
         </div>
         <div className="relative z-10 space-y-8">
            <div className="flex justify-between items-center">
               <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Security Protocol</h4>
               <div className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2">
                  <ShieldCheck size={12} className="text-emerald-400" /> AES-256 Readiness
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><History size={16}/></div>
                     <span className="text-[10px] font-black uppercase tracking-widest">Soft Delete Registry</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                    All deletions are marked as <code className="text-brand">isDeleted</code>. No records are permanently purged without platform administrator intervention.
                  </p>
               </div>
               <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center"><AlertCircle size={16}/></div>
                     <span className="text-[10px] font-black uppercase tracking-widest">Audit Immutability</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                    Deletion metadata includes timestamps and actor IDs. Audits are stored in an append-only collection for forensic review.
                  </p>
               </div>
               <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><CloudLightning size={16}/></div>
                     <span className="text-[10px] font-black uppercase tracking-widest">Disaster Recovery</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                    State management is reactive. Restoring a ledger re-computes all analytical summaries instantly across all connected modules.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MaintenanceView;
