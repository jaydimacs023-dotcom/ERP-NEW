
import React, { useMemo, useState } from 'react';
import { Employee, Organization } from '../types';
import ModalPortal from '../components/ModalPortal';
import { 
  Users, Plus, Search, Mail, Phone, Briefcase, 
  ChevronRight, Trash2, X, Save, ShieldCheck, Landmark,
  Fingerprint, CreditCard, ChevronDown, RotateCcw
} from 'lucide-react';

interface EmployeesViewProps {
  employees: Employee[];
  organization?: Organization;
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

const EmployeesView: React.FC<EmployeesViewProps> = ({ 
  employees, organization, onAddEmployee, onUpdateEmployee, onDeleteEmployee 
}) => {
  const brandColor = organization?.primaryColor || 'var(--acm-primary)';
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    firstName: '',
    lastName: '',
    designation: '',
    basicSalary: 0,
    isActive: true,
    tin: '',
    sss: '',
    philhealth: '',
    pagibig: ''
  });

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return employees
      .filter(employee => {
        const searchableText = [
          `${employee.firstName} ${employee.lastName}`,
          employee.designation,
          employee.id,
          employee.tin || '',
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'ALL'
          || (statusFilter === 'ACTIVE' && employee.isActive)
          || (statusFilter === 'ARCHIVED' && !employee.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }, [employees, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'ALL';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmp) {
      onUpdateEmployee({ ...editingEmp, ...formData } as Employee);
    } else {
      const newEmp: Employee = {
        ...formData as Employee,
        id: `emp-${Date.now()}`,
        orgId: 'temp',
        createdAt: new Date().toISOString()
      };
      onAddEmployee(newEmp);
    }
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ 
      firstName: '', 
      lastName: '', 
      designation: '', 
      basicSalary: 0, 
      isActive: true,
      tin: '',
      sss: '',
      philhealth: '',
      pagibig: ''
    });
    setEditingEmp(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">HR / Staff Registry</h2>
          <p className="text-sm text-gray-500 font-normal italic">Institutional human resource master records and compensation templates.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          style={{ backgroundColor: brandColor }}
          className="flex items-center gap-2 px-6 py-2.5 text-white rounded hover:opacity-90 transition-all shadow-md shadow-brand/20 font-bold text-sm"
        >
          <Plus size={18} /> Register Staff
        </button>
      </header>

      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input 
              placeholder="Search employees..." 
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'ARCHIVED')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[160px]"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <div className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredEmployees.length}</span> of {employees.length} employees
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full font-sans">
            <thead className="bg-brand border-b">
              <tr>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Employee Information</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Designation</th>
                <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Monthly Basic</th>
                <th className="px-4 py-3 text-center text-[13px] font-bold text-white">Status</th>
                <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length > 0 ? filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-brand/10 text-brand border border-brand-light shadow-sm flex items-center justify-center font-bold text-xs shrink-0">
                        {emp.lastName[0]}{emp.firstName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{emp.lastName.toUpperCase()}, {emp.firstName}</div>
                        <div className="text-xs font-mono text-brand uppercase">EMP_ID: {emp.id.slice(-6)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <Briefcase size={14} className="text-gray-400" />
                      {emp.designation}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                    {emp.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase border ${emp.isActive ? 'bg-brand/10 text-brand border-brand-light' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      {emp.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingEmp(emp); setFormData(emp); setShowModal(true); }}
                        className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <button 
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <Users size={40} className="mx-auto mb-2 text-gray-300" />
                    {hasActiveFilters
                      ? 'Try adjusting your search or filters.'
                      : 'Register your first staff member to get started with HR management.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-md shadow-brand/20"><Users size={20} /></div>
                <h3 className="text-xl font-semibold text-gray-800 uppercase tracking-tight">{editingEmp ? 'Update Profile' : 'Register Staff Member'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-10">
              <section className="space-y-6">
                <div className="flex items-center gap-2">
                   <Fingerprint size={16} className="text-brand" />
                   <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Personal & Job Info</h4>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">First Name</label>
                    <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-bold" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Last Name</label>
                    <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-bold" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Job Designation</label>
                    <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-bold" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">Basic Monthly Salary</label>
                    <input type="number" step="0.01" required className="w-full px-4 py-3 bg-white border-2 border-brand-light rounded text-lg font-mono font-semibold text-brand focus:border-brand outline-none" value={formData.basicSalary} onChange={e => setFormData({...formData, basicSalary: Number(e.target.value)})} />
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-2">
                   <CreditCard size={16} className="text-brand" />
                   <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Statutory & Disbursement</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">TIN</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono" value={formData.tin} onChange={e => setFormData({...formData, tin: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">SSS #</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono" value={formData.sss} onChange={e => setFormData({...formData, sss: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">PhilHealth</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono" value={formData.philhealth} onChange={e => setFormData({...formData, philhealth: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Pag-IBIG</label>
                    <input className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-mono" value={formData.pagibig} onChange={e => setFormData({...formData, pagibig: e.target.value})} />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={formData.isActive} 
                    onChange={e => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <label htmlFor="isActive" className="text-sm font-semibold text-gray-700 cursor-pointer">Mark as Active Employee</label>
                </div>
              </section>

              <div className="pt-8 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-sm font-bold text-gray-400 hover:bg-gray-100 rounded transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-brand text-white rounded text-sm font-semibold shadow-sm shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> {editingEmp ? 'Apply Record Sync' : 'Finalize Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default EmployeesView;

