
import React, { useState, useMemo } from 'react';
import { User, Student, Trainer } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import { 
  UserCog, Search, Plus, Trash2, X, Shield, Users, 
  Key, Mail, Eye, EyeOff, ShieldCheck, UserCircle,
  ChevronRight, Lock, GraduationCap, Award, AlertCircle
} from 'lucide-react';

interface UsersManagementViewProps {
  users: User[];
  students?: Student[];
  trainers?: Trainer[];
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

const ROLES = [
  { id: 'ADMIN', label: 'Administrator', desc: 'Full access to Financials & Operations', icon: ShieldCheck },
  { id: 'ACCOUNTANT', label: 'Accountant', desc: 'Financial reporting & General Ledger only', icon: Users },
  { id: 'REGISTRAR', label: 'Registrar', desc: 'Student, Trainer & Batch Management only', icon: Users },
  { id: 'FINANCE_MANAGER', label: 'Finance Manager', desc: 'Full financial access with approval rights', icon: Shield },
  { id: 'AP_SPECIALIST', label: 'AP Specialist', desc: 'Accounts Payable & Vendor management', icon: Users },
  { id: 'AR_SPECIALIST', label: 'AR Specialist', desc: 'Accounts Receivable & Collections', icon: Users },
  { id: 'STUDENT', label: 'Student Portal', desc: 'Student self-service portal access', icon: GraduationCap },
  { id: 'TRAINER', label: 'Trainer Portal', desc: 'Trainer schedule & class management', icon: Award },
];

const UsersManagementView: React.FC<UsersManagementViewProps> = ({ 
  users, 
  students = [], 
  trainers = [],
  onAddUser, 
  onDeleteUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'REGISTRAR' as string,
    studentId: '' as string,
    trainerId: '' as string,
  });
  const [formError, setFormError] = useState('');

  // Get students/trainers that don't already have user accounts
  const availableStudents = useMemo(() => {
    const linkedStudentIds = new Set(users.filter(u => u.studentId).map(u => u.studentId));
    return students.filter(s => !s.isDeleted && !linkedStudentIds.has(s.id));
  }, [students, users]);

  const availableTrainers = useMemo(() => {
    const linkedTrainerIds = new Set(users.filter(u => u.trainerId).map(u => u.trainerId));
    return trainers.filter(t => !t.isDeleted && !linkedTrainerIds.has(t.id));
  }, [trainers, users]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'REGISTRAR',
      studentId: '',
      trainerId: '',
    });
    setFormError('');
  };

  const handleRoleChange = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      role: roleId,
      studentId: roleId === 'STUDENT' ? prev.studentId : '',
      trainerId: roleId === 'TRAINER' ? prev.trainerId : '',
    }));
    setFormError('');
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setFormData(prev => ({
        ...prev,
        studentId,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email || prev.email,
      }));
    }
  };

  const handleTrainerSelect = (trainerId: string) => {
    const trainer = trainers.find(t => t.id === trainerId);
    if (trainer) {
      setFormData(prev => ({
        ...prev,
        trainerId,
        name: `${trainer.firstName} ${trainer.lastName}`,
        email: trainer.email || prev.email,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!formData.name || !formData.email) {
      setFormError('Name and Email are required');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    // Role-specific validation
    if (formData.role === 'STUDENT' && !formData.studentId) {
      setFormError('Please select a student record to link this account to');
      return;
    }

    if (formData.role === 'TRAINER' && !formData.trainerId) {
      setFormError('Please select a trainer record to link this account to');
      return;
    }

    // Check for duplicate email
    if (users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
      setFormError('A user with this email already exists');
      return;
    }

    const newUser: User = {
      id: generateUUID(),
      orgId: '', // Will be set by App.tsx
      name: formData.name,
      email: formData.email,
      password: formData.password, // Will be hashed by the service
      role: formData.role as any,
      studentId: formData.role === 'STUDENT' ? formData.studentId : undefined,
      trainerId: formData.role === 'TRAINER' ? formData.trainerId : undefined,
    };

    onAddUser(newUser);
    setShowModal(false);
    resetForm();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'SYSTEM_ADMIN': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'ACCOUNTANT': return 'bg-teal-50 text-teal-600 border-teal-100';
      case 'REGISTRAR': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'FINANCE_MANAGER': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'AP_SPECIALIST': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      case 'AR_SPECIALIST': return 'bg-teal-50 text-teal-600 border-teal-100';
      case 'STUDENT': return 'bg-teal-50 text-teal-600 border-teal-100';
      case 'TRAINER': return 'bg-orange-50 text-orange-600 border-orange-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'SYSTEM_ADMIN':
        return <ShieldCheck size={12} />;
      case 'STUDENT':
        return <GraduationCap size={12} />;
      case 'TRAINER':
        return <Award size={12} />;
      default:
        return <Users size={12} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <UserCog className="text-teal-600" size={28} />
            Users & Security
          </h2>
          <p className="text-sm text-slate-500 font-normal italic">Institutional identity management and role-based access control (RBAC).</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-all shadow-md font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Onboard New User
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Search by name or email..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-1 focus:ring-teal-600 outline-none transition-all"
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
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm border-2 border-white ${user.role === 'ADMIN' ? 'bg-rose-500' : 'bg-teal-500'}`}>
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
                    {getRoleIcon(user.role)}
                    {user.role}
                  </div>
                  {user.studentId && (
                    <div className="text-[10px] text-slate-400 mt-1">Linked to Student</div>
                  )}
                  {user.trainerId && (
                    <div className="text-[10px] text-slate-400 mt-1">Linked to Trainer</div>
                  )}
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
                    <button className="p-2 hover:bg-slate-100 text-slate-300 hover:text-teal-600 rounded-xl transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-8 py-12">
                  <EmptyState 
                    title="No system users"
                    description="Onboard your first user to give them access to the ERP system."
                    actionLabel="Onboard User"
                    onAction={() => setShowModal(true)}
                    icon={<Users size={48} className="text-slate-300" />}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-xl shadow-teal-100">
                  <Plus size={24} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Onboard User</h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-bold">
                  <AlertCircle size={20} />
                  {formError}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Institutional Role (RBAC)</label>
                  <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                    {ROLES.map(r => {
                      const RoleIcon = r.icon;
                      const isDisabled = (r.id === 'STUDENT' && availableStudents.length === 0) ||
                                        (r.id === 'TRAINER' && availableTrainers.length === 0);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleRoleChange(r.id)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                            isDisabled 
                              ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                              : formData.role === r.id 
                                ? 'bg-teal-600 border-teal-700 text-white shadow-lg' 
                                : 'bg-white border-slate-100 hover:border-teal-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <RoleIcon size={18} className={formData.role === r.id ? 'text-white' : isDisabled ? 'text-slate-300' : 'text-slate-500'} />
                            <div>
                              <div className={`text-xs font-black uppercase tracking-tight ${formData.role === r.id ? 'text-white' : isDisabled ? 'text-slate-300' : 'text-slate-800'}`}>
                                {r.label}
                              </div>
                              <div className={`text-[10px] mt-0.5 ${formData.role === r.id ? 'text-teal-100' : 'text-slate-400'}`}>
                                {isDisabled ? 'No unlinked records available' : r.desc}
                              </div>
                            </div>
                          </div>
                          {formData.role === r.id ? <ShieldCheck size={20} /> : <div className={`w-5 h-5 rounded-full border-2 ${isDisabled ? 'border-slate-200' : 'border-slate-100'}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Student Selection (only shown when role is STUDENT) */}
                {formData.role === 'STUDENT' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Link to Student Record *</label>
                    <select
                      required
                      value={formData.studentId}
                      onChange={e => handleStudentSelect(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- Select a student --</option>
                      {availableStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.email || 'No email'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 px-1">
                      This will allow the student to log in and access their portal.
                    </p>
                  </div>
                )}

                {/* Trainer Selection (only shown when role is TRAINER) */}
                {formData.role === 'TRAINER' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Link to Trainer Record *</label>
                    <select
                      required
                      value={formData.trainerId}
                      onChange={e => handleTrainerSelect(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none font-bold text-slate-800"
                    >
                      <option value="">-- Select a trainer --</option>
                      {availableTrainers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName} ({t.email || 'No email'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 px-1">
                      This will allow the trainer to log in and access their portal.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Full Name *</label>
                  <input 
                    required 
                    placeholder="e.g. Maria Clara" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none font-bold text-slate-800"
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Institutional Email *</label>
                  <div className="relative">
                    <input 
                      required 
                      type="email" 
                      placeholder="name@institution.edu" 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none font-bold text-slate-800"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Initial Password * (min 8 characters)</label>
                  <div className="relative">
                    <input 
                      required 
                      type="password" 
                      placeholder="••••••••" 
                      minLength={8}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-600 outline-none font-bold text-slate-800"
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                    <Key className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  </div>
                  <p className="text-[10px] text-slate-400 px-1">
                    The user should change this password after first login.
                  </p>
                </div>
              </div>

              <div className="bg-teal-50 p-6 rounded-[2rem] border border-teal-100 flex gap-4">
                <Lock size={24} className="text-teal-600 shrink-0" />
                <p className="text-[11px] text-teal-900 leading-relaxed font-bold">
                  {formData.role === 'STUDENT' 
                    ? 'Student users can only access their own portal with enrollment info, grades, and attendance.'
                    : formData.role === 'TRAINER'
                    ? 'Trainer users can only access their schedule, assigned batches, and student roster.'
                    : 'User permissions are role-based. A Registrar is isolated from financial G/L modules per security policy.'}
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-4 text-sm font-black text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-teal-600 text-white rounded-2xl text-sm font-black shadow-2xl shadow-teal-100 active:scale-95 transition-all">Onboard to System</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagementView;
