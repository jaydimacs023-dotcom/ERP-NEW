import React, { useMemo, useState } from 'react';
import { BadgeCheck, Mail, Search, Users } from 'lucide-react';
import { Organization, User } from '../types';

interface Props {
  organization?: Organization;
  users: User[];
}

const roleLabel = (role: User['role']) => role
  .toLowerCase()
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const EmployeeDirectoryView: React.FC<Props> = ({ organization, users }) => {
  const [search, setSearch] = useState('');
  const employees = useMemo(() => users
    .filter(user => user.role !== 'SYSTEM_ADMIN' && !user.isDeleted)
    .filter(user => {
      const query = search.trim().toLowerCase();
      return !query || `${user.id} ${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
      if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
      return a.name.localeCompare(b.name);
    }), [search, users]);

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-slate-100 bg-[linear-gradient(115deg,#f8fafc_55%,color-mix(in_srgb,var(--brand)_8%,white))] p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">Organization directory</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Employees</h2>
          <p className="mt-1 text-sm text-slate-500">All ERP users of {organization?.name || 'this organization'}, beginning with the tenant administrator.</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active employees</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><Users size={20} className="text-brand"/>{employees.length}</p>
        </div>
      </div>
      <div className="p-4">
        <label className="relative block max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, role, or employee ID" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10"/>
        </label>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Employee ID</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Contact</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(employee => <tr key={employee.id} className="transition hover:bg-slate-50/80">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 font-bold text-brand">{employee.name.slice(0, 1).toUpperCase()}</span><div><p className="font-semibold text-slate-900">{employee.name}</p>{employee.role === 'ADMIN' && <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-700"><BadgeCheck size={13}/>Tenant administrator</p>}</div></div></td>
              <td className="px-5 py-4 font-mono text-xs text-slate-600">{employee.id}</td>
              <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{roleLabel(employee.role)}</span></td>
              <td className="px-5 py-4"><span className="flex items-center gap-2 text-slate-600"><Mail size={15} className="text-slate-400"/>{employee.email}</span></td>
            </tr>)}
          </tbody>
        </table>
        {!employees.length && <div className="p-12 text-center text-sm text-slate-500">No organization employees match this search.</div>}
      </div>
    </section>
  </div>;
};

export default EmployeeDirectoryView;
