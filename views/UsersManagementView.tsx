import React, { useState } from 'react';
import { User } from '../types';
import { 
  UserCog, Search, Plus, Trash2, X, Shield, Users, 
  Key, Mail, Eye, EyeOff, ShieldCheck, UserCircle,
  ChevronRight, Lock
} from 'lucide-react';

interface UsersManagementViewProps {
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

const ROLES = [
  { id: 'ADMIN', label: 'Administrator', desc: 'Full access to Financials & Operations' },
  { id: 'ACCOUNTANT', label: 'Accountant', desc: 'Financial reporting & General Ledger only' },
  { id: 'REGISTRAR', label: 'Registrar', desc: 'Student, Trainer & Batch Management only' },
  { id: 'VIEWER', label: 'Viewer', desc: 'Read-only access to specific operational data' }
];

const UsersManagementView: React.FC<UsersManagementViewProps> = ({ users, onAddUser, onDeleteUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    password: '',
    role: 'REGISTRAR'
  });

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) return;

    const newUser: User = {
      id: `user-${Date.now()}`,
      orgId: 'temp',
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role as any
    };

    onAddUser(newUser);
    setShowModal(false);
    setFormData({ name: '', email: '', password: '', role: 'REGISTRAR' });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'ACCOUNTANT': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'REGISTRAR': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <UserCog className="text-indigo-600" size={28} />
            Users & Security
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional identity management and role-based access control (RBAC).</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Onboard New User
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Search by name or email..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">System User</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Role</th>
              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Authentication</th>
              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm border-2 border-white ${user.role === 'ADMIN' ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                      <UserCircle size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-800">{user.name}</div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getRoleBadge(user.role)}`}>
                    {user.role === 'ADMIN' ? <ShieldCheck size={12} /> : <Users size={12} />}
                    {user.role}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-300" /> {user.email}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300">Last login: Today 10:42 AM</div>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onDeleteUser(user.id)}
                      className="p-2 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-xl transition-all"
                      title="Revoke Access"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 text-slate-300 hover:text-indigo-600 rounded-xl transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
                  <Plus size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Onboard User</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Full Legal Name</label>
                  <input required autoFocus placeholder="e.g. Maria Clara" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-slate-800"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Institutional Email</label>
                  <div className="relative">
                    <input required type="email" placeholder="name@academy.ph" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-slate-800"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Security Credential</label>
                  <div className="relative">
                    <input required type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-mono font-bold text-slate-800"
                      value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Institutional Role (RBAC)</label>
                  <div className="grid grid-cols-1 gap-3">
                    {ROLES.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setFormData({...formData, role: r.id as any})}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                          formData.role === r.id ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-indigo-200'
                        }`}
                      >
                        <div>
                          <div className={`text-xs font-black uppercase tracking-tight ${formData.role === r.id ? 'text-white' : 'text-slate-800'}`}>{r.label}</div>
                          <div className={`text-[10px] mt-0.5 ${formData.role === r.id ? 'text-indigo-100' : 'text-slate-400'}`}>{r.desc}</div>
                        </div>
                        {formData.role === r.id ? <ShieldCheck size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-slate-100" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
                <Lock size={24} className="text-blue-600 shrink-0" />
                <p className="text-[11px] text-blue-900 leading-relaxed font-bold">
                  User permissions are absolute. Once onboarded, a Registrar will be strictly isolated from all financial G/L modules, as per system security policy.
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-indigo-100 active:scale-95 transition-all">Onboard to System</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagementView;