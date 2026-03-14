
import React from 'react';
import { AuditLog } from '../types';
import { ShieldCheck, History, User, Clock } from 'lucide-react';

interface AuditTrailProps {
  orgId: string;
  logs: AuditLog[];
}

const AuditTrail: React.FC<AuditTrailProps> = ({ orgId, logs }) => {
  // Filter logs for current organization
  const orgLogs = logs.filter(log => log.orgId === orgId);
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Organization Audit Trail</h2>
          <p className="text-sm italic text-gray-500">{orgLogs.length} audit records for this organization</p>
        </div>
        <div className="bg-emerald-50 text-orange-700 px-4 py-2 rounded-lg border border-orange-200 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={18} />
          {orgLogs.length} Events
        </div>
      </div>

      <div className="bg-white rounded shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">Timestamp</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">User</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Action</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Entity</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orgLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <History size={32} className="text-gray-300" />
                    <p>No audit records for this organization yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              [...orgLogs].reverse().map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                      <Clock size={14} className="text-gray-400" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {log.userId.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-gray-600">{log.userId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${log.action === 'POST' ? 'bg-orange-100 text-orange-700' :
                        log.action === 'CREATE' ? 'bg-emerald-100 text-orange-700' :
                          log.action === 'REVERSE' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                      }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-gray-500 text-xs font-bold uppercase tracking-tight">{log.entityType.replace('_', ' ')}</span>
                      <span className="text-gray-900 font-mono text-xs">{log.entityId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-600 leading-relaxed">
                      {log.details}
                      {log.ipAddress && (
                        <div className="text-xs text-gray-400 mt-2">IP: {log.ipAddress}</div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {orgLogs.length === 0 && (
          <div className="p-12 text-center">
            <History size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">No audit entries found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;

