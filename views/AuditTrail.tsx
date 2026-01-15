
import React from 'react';
import { AuditLog } from '../types';
import { ShieldCheck, History, User, FileJson, Clock } from 'lucide-react';

interface AuditTrailProps {
  logs: AuditLog[];
}

const AuditTrail: React.FC<AuditTrailProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">System Audit Trail</h2>
          <p className="text-sm text-slate-500">Immutable history of all system transactions and modifications.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={18} />
          Audit Ready
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Timestamp</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">User</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Action</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">Entity</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[...logs].reverse().map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <Clock size={14} className="text-slate-400" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {log.userId.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-slate-600">{log.userId}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    log.action === 'POST' ? 'bg-indigo-100 text-indigo-700' :
                    log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                    log.action === 'REVERSE' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-tight">{log.entityType.replace('_', ' ')}</span>
                    <span className="text-slate-900 font-mono text-xs">{log.entityId}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-600 line-clamp-2 leading-relaxed">
                    {log.details}
                  </div>
                  {(log.newState || log.previousState) && (
                    <button className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 text-[11px]">
                      <FileJson size={12} /> View State Delta
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-12 text-center">
            <History size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium">No audit entries found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
