
import React, { useRef } from 'react';
import { 
  Database, Download, Upload, Trash2, History, ShieldCheck, 
  AlertCircle, CloudLightning, RefreshCw, FileJson, Server,
  Cloud, Monitor, Zap, RotateCw
} from 'lucide-react';
import { AuditLog } from '../types';
import { config } from '../config/app';

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
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">System Maintenance & Data Utility</h2>
        <p className="text-sm text-gray-500 font-normal italic">Institutional disaster recovery and immutable data portability.</p>
      </header>

      {/* Feature Flag / Data Strategy Controller */}
      <div className="bg-white rounded-md border-2 border-orange-500 shadow-md overflow-hidden animate-in slide-in-from-top-4 duration-700">
         <div className="p-8 border-b bg-[#F47721] text-white flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white/20 rounded border border-white/20">
                  <Zap size={24} />
               </div>
               <div>
                  <h3 className="text-xl font-semibold uppercase tracking-tight leading-none">Data Strategy Controller</h3>
                  <p className="text-xs font-bold text-orange-100 uppercase tracking-wide mt-1">Instant Feature Flag Switching</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <span className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border-2 ${config.useMockData ? 'bg-white text-[#F47721] border-white' : 'bg-emerald-500 text-white border-emerald-400'}`}>
                  {config.useMockData ? 'Mock Local Active' : 'Cloud Supabase Active'}
               </span>
            </div>
         </div>
         
         <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
               <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  Manually override the system data source. This utilizes <code className="bg-gray-100 px-1 rounded text-[#F47721]">localStorage</code> to persist your choice across sessions.
               </p>
               <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => config.switchDataSource('MOCK')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded text-xs font-semibold uppercase tracking-wide transition-all ${config.useMockData ? 'bg-[#F47721] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                     <Monitor size={16} /> Force Mock
                  </button>
                  <button 
                    onClick={() => config.switchDataSource('CLOUD')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded text-xs font-semibold uppercase tracking-wide transition-all ${!config.useMockData ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                     <Cloud size={16} /> Force Supabase
                  </button>
               </div>
               <button 
                  onClick={() => config.clearOverride()}
                  className="w-full py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-rose-500 flex items-center justify-center gap-2 transition-colors"
               >
                  <RotateCw size={12} /> Reset to Environment Default
               </button>
            </div>

            <div className="p-8 bg-gray-50 rounded border border-gray-200 flex items-start gap-4">
               <AlertCircle size={24} className="text-amber-500 shrink-0 mt-0.5" />
               <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-800 uppercase tracking-tight">Architectural Note</p>
                  <p className="text-xs text-gray-500 leading-relaxed font-bold italic">
                     "Switching sources instantly clears the in-memory cache and re-initializes the Ledger Architecture. Ensure any unsaved Manual Postings are finalized before switching."
                  </p>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-md border border-gray-200 p-8 space-y-6 shadow-sm">
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-[#F47721] text-white rounded shadow-lg"><Download size={24}/></div>
              <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Export Full Snapshot</h3>
           </div>
           <p className="text-sm text-gray-500 leading-relaxed font-medium">
             Generate a GAAP-compliant JSON archive of your entire organizational ledger, student registry, and system configurations. This file serves as an offline backup.
           </p>
           <button 
             onClick={onExport}
             className="w-full py-4 bg-[#F47721] text-white rounded text-xs font-semibold uppercase tracking-wide hover:bg-[#E06610] transition-all shadow-sm shadow-gray-100 flex items-center justify-center gap-2"
           >
             <FileJson size={18} /> Download Backup (.json)
           </button>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-8 space-y-6 shadow-sm">
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-emerald-600 text-white rounded shadow-lg"><Upload size={24}/></div>
              <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Restore Environment</h3>
           </div>
           <p className="text-sm text-gray-500 leading-relaxed font-medium">
             Re-hydrate your institution's environment from a previously exported backup. Warning: Current state will be replaced.
           </p>
           <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="w-full py-4 bg-emerald-600 text-white rounded text-xs font-semibold uppercase tracking-wide hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-2"
           >
             <Server size={18} /> Upload & Re-hydrate Ledger
           </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-md p-5 text-white shadow-md relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <ShieldCheck size={200} />
         </div>
         <div className="relative z-10 space-y-8">
            <div className="flex justify-between items-center">
               <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Security Protocol</h4>
               <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/10 flex items-center gap-2">
                  <ShieldCheck size={12} className="text-emerald-400" /> AES-256 Readiness
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="p-6 bg-white/5 rounded-md border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-[#F47721]/20 text-orange-400 flex items-center justify-center"><History size={16}/></div>
                     <span className="text-xs font-semibold uppercase tracking-wide">Soft Delete Registry</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-bold">
                    All deletions are marked as <code className="text-brand">isDeleted</code>. No records are permanently purged without platform administrator intervention.
                  </p>
               </div>
               <div className="p-6 bg-white/5 rounded-md border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center"><AlertCircle size={16}/></div>
                     <span className="text-xs font-semibold uppercase tracking-wide">Audit Immutability</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-bold">
                    Deletion metadata includes timestamps and actor IDs. Audits are stored in an append-only collection for forensic review.
                  </p>
               </div>
               <div className="p-6 bg-white/5 rounded-md border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><CloudLightning size={16}/></div>
                     <span className="text-xs font-semibold uppercase tracking-wide">Disaster Recovery</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-bold">
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
